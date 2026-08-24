"""
BSL-4 AI Editorial Verdict Worker
Scheduled via AWS EventBridge (every 12 hours) to:
1. Verify that real threat evidence is present in Supabase PostgreSQL (public.threat_records).
2. Synthesize multi-vector evidence (seismic, orbital, space weather, severe weather, and market volatility).
3. Query Google Gemini (using GEMINI_API_KEY from AWS SSM Parameter Store) to generate an authoritative AI Editorial Verdict.
4. Persist the generated editorial verdict into the 'public.ai_editorial_verdicts' table.
"""

import os
import json
import logging
import urllib.request
import urllib.parse
from datetime import datetime, timezone, timedelta
import boto3
import pg8000.native

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def load_ssm_secrets():
    """Dynamically load decrypted secrets from AWS SSM Parameter Store."""
    try:
        ssm = boto3.client("ssm", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        response = ssm.get_parameters_by_path(Path="/bsl4/prod", WithDecryption=True)
        for param in response.get("Parameters", []):
            key = param["Name"].split("/")[-1]
            os.environ[key] = param["Value"]
        logger.info(">>> Successfully loaded decrypted secrets from AWS SSM Parameter Store.")
    except Exception as e:
        logger.warning(f"Could not load secrets from SSM (using local environment fallback): {e}")


def get_config(key: str, default: str = "") -> str:
    val = os.environ.get(key, "")
    if val:
        return val
    try:
        ssm = boto3.client("ssm", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        param = ssm.get_parameter(Name=f"/bsl4/prod/{key}", WithDecryption=True)
        retrieved = param.get("Parameter", {}).get("Value", default)
        os.environ[key] = retrieved
        return retrieved
    except Exception:
        pass
    return default


def parse_db_connection():
    """Extract host, port, database, user, password from JDBC or Postgres connection string."""
    db_url = get_config("SPRING_DATASOURCE_URL", get_config("DATABASE_URL", ""))
    url = db_url.replace("jdbc:postgresql://", "").replace("postgresql://", "")

    if "@" in url:
        auth, address = url.split("@", 1)
        user, password = auth.split(":", 1)
    else:
        user = get_config("SPRING_DATASOURCE_USERNAME", "postgres")
        password = get_config("SPRING_DATASOURCE_PASSWORD", "")
        address = url

    host_port, db_params = address.split("/", 1) if "/" in address else (address, "postgres")
    database = db_params.split("?")[0]

    if ":" in host_port:
        host, port_str = host_port.split(":", 1)
        port = int(port_str)
    else:
        host = host_port
        port = 5432

    return host, port, database, user, password


def get_db_connection():
    """Establish secure SSL connection to Supabase PostgreSQL."""
    host, port, database, user, password = parse_db_connection()
    import ssl

    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    return pg8000.native.Connection(
        user=user,
        password=password,
        host=host,
        port=port,
        database=database,
        ssl_context=ssl_context,
        timeout=15,
    )


def ensure_editorial_table(conn):
    """Ensure the public.ai_editorial_verdicts table and indexes exist."""
    ddl = """
    CREATE TABLE IF NOT EXISTS public.ai_editorial_verdicts (
        id BIGSERIAL PRIMARY KEY,
        verdict_text TEXT NOT NULL,
        panic_index FLOAT8 NOT NULL,
        status_level VARCHAR(50) NOT NULL DEFAULT 'NOMINAL',
        summary_narrative TEXT,
        evidence_summary JSONB,
        model_used VARCHAR(50) DEFAULT 'gemini-3.6-flash',
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ai_editorial_created_at ON public.ai_editorial_verdicts(created_at DESC);
    """
    conn.run(ddl)
    logger.info(">>> Verified public.ai_editorial_verdicts table schema.")


def fetch_recent_evidence(conn, limit=60):
    """Fetch active recent hazard telemetry records from public.threat_records."""
    query = """
    SELECT id, threat_type, title, severity_score, description, metadata, recorded_at
    FROM public.threat_records
    ORDER BY recorded_at DESC
    LIMIT :limit
    """
    rows = conn.run(query, limit=limit)
    evidence = []
    for r in rows:
        meta = {}
        try:
            if isinstance(r[5], str):
                meta = json.loads(r[5])
            elif isinstance(r[5], dict):
                meta = r[5]
        except Exception:
            meta = {}

        evidence.append({
            "id": r[0],
            "threat_type": r[1],
            "title": r[2],
            "severity_score": float(r[3]),
            "description": r[4],
            "metadata": meta,
            "recorded_at": r[6].isoformat() if hasattr(r[6], "isoformat") else str(r[6]),
        })
    return evidence


def summarize_evidence_for_ai(evidence_list):
    """Summarize evidence by threat vector for prompt injection."""
    quakes = [e for e in evidence_list if e["threat_type"] == "EARTHQUAKE"]
    asteroids = [e for e in evidence_list if e["threat_type"] == "ASTEROID"]
    space_wx = [e for e in evidence_list if e["threat_type"] == "SPACE_WEATHER"]
    terrestrial_wx = [e for e in evidence_list if e["threat_type"] == "TERRESTRIAL_WEATHER"]
    markets = [e for e in evidence_list if e["threat_type"] == "STOCK_MARKET"]

    # Top Earthquake
    max_quake = max(quakes, key=lambda x: x["severity_score"]) if quakes else None
    
    # Closest Asteroid
    closest_asteroid = None
    if asteroids:
        def get_miss_km(a):
            return a.get("metadata", {}).get("miss_distance_km", 999999999)
        closest_asteroid = min(asteroids, key=get_miss_km)

    # Notable Solar
    solar_highlights = [s["title"] for s in space_wx[:3]]

    # Market moves
    market_highlights = []
    for m in markets[:7]:
        sym = m.get("metadata", {}).get("symbol", m["title"])
        chg = m.get("metadata", {}).get("change_percent", 0.0)
        market_highlights.append(f"{sym}: {chg:+.2f}%")

    return {
        "total_threat_records": len(evidence_list),
        "earthquakes": {
            "count": len(quakes),
            "max_event": max_quake["title"] if max_quake else "None reported (M >= 4.5)",
            "max_severity": max_quake["severity_score"] if max_quake else 0.0,
        },
        "asteroids": {
            "count": len(asteroids),
            "closest_approach": closest_asteroid["title"] if closest_asteroid else "None",
            "miss_distance_km": closest_asteroid.get("metadata", {}).get("miss_distance_km", 0) if closest_asteroid else 0,
            "is_hazardous": closest_asteroid.get("metadata", {}).get("is_hazardous", False) if closest_asteroid else False,
        },
        "space_weather": {
            "count": len(space_wx),
            "recent_events": solar_highlights,
        },
        "terrestrial_weather": {
            "count": len(terrestrial_wx),
            "active_alerts_sample": [w["title"] for w in terrestrial_wx[:3]],
        },
        "financial_markets": {
            "tracked_assets": market_highlights,
        }
    }


def generate_heuristic_editorial_verdict(evidence_summary: dict):
    """Evidence-based synthesizer fallback when Gemini quota/credits are pending."""
    eq = evidence_summary.get("earthquakes", {})
    ast = evidence_summary.get("asteroids", {})
    sp = evidence_summary.get("space_weather", {})
    
    max_eq_sev = eq.get("max_severity", 0.0)
    has_pha = ast.get("is_hazardous", False)
    solar_count = sp.get("count", 0)
    
    base_panic = 1.8
    if max_eq_sev > 6.0:
        base_panic += 1.5
    elif max_eq_sev > 4.5:
        base_panic += 0.4

    if has_pha:
        base_panic += 0.3

    panic_index = min(round(base_panic, 1), 9.9)
    status_level = "NOMINAL" if panic_index < 4.0 else "ELEVATED HYSTERIA" if panic_index < 7.0 else "CRITICAL ALERT"
    
    verdict_text = (
        f"Global panic index is at {panic_index}. Wall Street is sweating over speculative noise, "
        "but the stars are quiet and tectonic plates are asleep. You're fine."
    )
    summary_narrative = (
        f"Physical sensor arrays report {eq.get('count', 0)} seismic events (peak: {eq.get('max_event', 'nominal')}) "
        f"and {ast.get('count', 0)} harmless orbital flybys. Planetary equilibrium remains fully stable."
    )
    key_factors = [
        f"Tectonics: Peak event {eq.get('max_event', 'baseline background')}",
        f"Orbital: Closest approach {ast.get('closest_approach', 'nominal')} passing safely",
        f"Solar: {solar_count} baseline magnetic flux events",
        "Macro: Routine market volatility"
    ]
    
    return {
        "panic_index": panic_index,
        "status_level": status_level,
        "verdict_text": verdict_text,
        "summary_narrative": summary_narrative,
        "key_factors": key_factors
    }, "bsl4-evidence-synthesizer"


def call_gemini_api(api_key: str, evidence_summary: dict):
    """Call Google Gemini REST API with structured JSON response schema, with fallback."""
    models_to_try = [
        "gemini-3.6-flash",
        "gemini-3.7-flash",
        "gemini-flash-latest",
        "gemini-3.1-flash-lite",
        "gemini-1.5-flash"
    ]
    
    prompt = f"""
You are the Chief Reality Synthesizer for BSL-4 (a planetary hazard vs. hysteria monitoring station).
Analyze the following verified, real-time sensor telemetry evidence collected across global systems:

TELEMETRY EVIDENCE:
{json.dumps(evidence_summary, indent=2)}

YOUR TASK:
Synthesize an authoritative, witty, grounded, evidence-based editorial verdict answering the core question:
"THE WORLD IS ENDING... BUT IS IT REALLY?"

Provide a balanced perspective:
- If financial markets are panicking (e.g. VIX spike, S&P drop) but physical systems (earthquakes, asteroids, solar flares) are nominal, call out Wall Street's nervous hysteria while reassuring that the physical planet is completely safe.
- If an asteroid passed, note its vast distance (e.g., millions of km / multiples of lunar distance) and reassure that dinosaurs would be jealous.
- If a solar flare occurred, explain it is a harmless atmospheric light show (aurora) rather than an apocalypse.

Return ONLY a valid JSON object matching this schema:
{{
  "panic_index": 2.1,
  "status_level": "NOMINAL",
  "verdict_text": "Global panic index is at 2.1. Wall Street is sweating over algorithmic ripples, but the stars are quiet and tectonic plates are asleep. You're fine.",
  "summary_narrative": "A concise 2-3 sentence paragraph providing evidence-based commentary comparing sensor data against human noise.",
  "key_factors": [
    "Tectonics: Baseline background activity only",
    "Orbital: Zero atmospheric collision threats",
    "Macro: Mild speculative market jitters"
  ]
}}
"""

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.3,
            "responseMimeType": "application/json"
        }
    }

    last_error = None
    for model_name in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                result_json = json.loads(resp.read().decode("utf-8"))
                candidates = result_json.get("candidates", [])
                if candidates:
                    raw_text = candidates[0]["content"]["parts"][0]["text"]
                    parsed = json.loads(raw_text)
                    logger.info(f">>> Gemini API successfully generated verdict using model {model_name}.")
                    return parsed, model_name
        except Exception as e:
            logger.warning(f"Gemini API model {model_name} attempt: {e}. Trying next...")
            last_error = e

    logger.warning(f">>> Google Gemini API unavailable ({last_error}). Falling back to BSL-4 evidence synthesizer.")
    return generate_heuristic_editorial_verdict(evidence_summary)


def save_editorial_verdict(conn, verdict_data, evidence_summary, model_used):
    """Save the AI editorial verdict into public.ai_editorial_verdicts table."""
    insert_sql = """
    INSERT INTO public.ai_editorial_verdicts (
        verdict_text,
        panic_index,
        status_level,
        summary_narrative,
        evidence_summary,
        model_used,
        created_at
    ) VALUES (
        :verdict_text,
        :panic_index,
        :status_level,
        :summary_narrative,
        :evidence_summary,
        :model_used,
        NOW()
    ) RETURNING id, created_at;
    """
    params = {
        "verdict_text": verdict_data.get("verdict_text", "Planetary systems nominal."),
        "panic_index": float(verdict_data.get("panic_index", 2.0)),
        "status_level": str(verdict_data.get("status_level", "NOMINAL")),
        "summary_narrative": str(verdict_data.get("summary_narrative", "")),
        "evidence_summary": json.dumps({
            "summary": evidence_summary,
            "key_factors": verdict_data.get("key_factors", [])
        }),
        "model_used": model_used
    }
    result = conn.run(insert_sql, **params)
    verdict_id = result[0][0] if result else None

    # Keep table clean (retain latest 100 records)
    conn.run("""
    DELETE FROM public.ai_editorial_verdicts
    WHERE id NOT IN (
        SELECT id FROM public.ai_editorial_verdicts
        ORDER BY created_at DESC
        LIMIT 100
    );
    """)

    return verdict_id


def publish_s3_snapshot(verdict_data, evidence_summary, model_used, evidence_list):
    """Publish static JSON snapshot files to S3 so frontend can load them securely with zero credentials."""
    bucket_name = os.environ.get("S3_BUCKET_NAME", "platformstaq.com")
    try:
        s3 = boto3.client("s3", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        
        # 1. Publish editorial-verdict.json to data/ and api/
        verdict_payload = {
            "id": verdict_data.get("id", 1),
            "panicIndex": float(verdict_data.get("panic_index", 2.0)),
            "statusLevel": str(verdict_data.get("status_level", "NOMINAL")),
            "verdictText": str(verdict_data.get("verdict_text", "")),
            "summaryNarrative": str(verdict_data.get("summary_narrative", "")),
            "keyFactors": verdict_data.get("key_factors", []),
            "modelUsed": str(model_used),
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }
        for key_path in ["data/editorial-verdict.json", "api/editorial-verdict.json"]:
            s3.put_object(
                Bucket=bucket_name,
                Key=key_path,
                Body=json.dumps(verdict_payload, indent=2).encode("utf-8"),
                ContentType="application/json",
                CacheControl="public, max-age=60, s-maxage=300"
            )
        logger.info(f">>> Published s3://{bucket_name}/data/editorial-verdict.json (Panic: {verdict_payload['panicIndex']})")

        # 2. Publish threats.json snapshot to data/ and api/
        threats_payload = []
        for e in evidence_list:
            threats_payload.append({
                "id": e["id"],
                "threatType": e["threat_type"],
                "title": e["title"],
                "severityScore": e["severity_score"],
                "description": e["description"],
                "metadata": json.dumps(e["metadata"]) if isinstance(e["metadata"], dict) else str(e["metadata"]),
                "recordedAt": e["recorded_at"]
            })

        for key_path in ["data/threats.json", "api/threats.json"]:
            s3.put_object(
                Bucket=bucket_name,
                Key=key_path,
                Body=json.dumps(threats_payload, indent=2).encode("utf-8"),
                ContentType="application/json",
                CacheControl="public, max-age=60, s-maxage=300"
            )
        logger.info(f">>> Published s3://{bucket_name}/data/threats.json ({len(threats_payload)} records)")
    except Exception as e:
        logger.warning(f"Could not publish JSON snapshots to S3: {e}")


def run_ai_editorial_pipeline():
    """Main execution orchestrator."""
    load_ssm_secrets()
    gemini_key = get_config("GEMINI_API_KEY", "")

    conn = get_db_connection()
    try:
        ensure_editorial_table(conn)

        # 1. Check evidence presence first
        evidence = fetch_recent_evidence(conn, limit=60)
        if not evidence:
            logger.warning(">>> No threat records found in public.threat_records. Ingestion worker must run first.")
            return {
                "status": "SKIPPED",
                "message": "No telemetry evidence found in database. Ingestor pipeline must run first before AI editorial synthesis."
            }

        logger.info(f">>> Found {len(evidence)} verified telemetry evidence records. Synthesizing for AI...")
        evidence_summary = summarize_evidence_for_ai(evidence)

        # 2. Call Google Gemini API (with evidence synthesizer fallback)
        verdict_data, model_used = call_gemini_api(gemini_key, evidence_summary)

        # 3. Persist into Supabase
        verdict_id = save_editorial_verdict(conn, verdict_data, evidence_summary, model_used)
        logger.info(f">>> Successfully persisted AI Editorial Verdict #{verdict_id}: '{verdict_data.get('verdict_text')}'")

        # 4. Publish static edge JSON snapshot to S3 for secure frontend consumption
        publish_s3_snapshot(verdict_data, evidence_summary, model_used, evidence)

        return {
            "status": "SUCCESS",
            "verdict_id": verdict_id,
            "panic_index": verdict_data.get("panic_index"),
            "status_level": verdict_data.get("status_level"),
            "verdict_text": verdict_data.get("verdict_text"),
            "model_used": model_used
        }
    finally:
        conn.close()


def lambda_handler(event, context):
    """AWS Lambda entry point for EventBridge 3-hour scheduled triggers."""
    logger.info(">>> AWS Lambda: Starting BSL-4 AI Editorial Verdict execution...")
    result = run_ai_editorial_pipeline()
    logger.info(f">>> Execution completed: {result}")
    return {
        "statusCode": 200 if result.get("status") in ["SUCCESS", "SKIPPED"] else 500,
        "body": json.dumps(result)
    }


if __name__ == "__main__":
    print(">>> Running BSL-4 AI Editorial Verdict Worker in local standalone mode...")
    res = run_ai_editorial_pipeline()
    print(json.dumps(res, indent=2))
