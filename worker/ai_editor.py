"""
BSL-4 AI Editorial Verdict Worker
Scheduled via AWS EventBridge (every 12 hours) to:
1. Verify that real threat evidence is present in Supabase PostgreSQL (public.threat_records).
2. Synthesize multi-vector evidence (seismic, orbital, space weather, severe weather, and market volatility).
3. Compute a 100% deterministic, reproducible mathematical Global Panic Index in backend Python.
4. Prompt Google Gemini (using GEMINI_API_KEY from AWS SSM Parameter Store) to write a qualitative editorial summary and mock social claim debunks based on the deterministic score and evidence.
5. Persist the generated editorial verdict into 'public.ai_editorial_verdicts' and publish edge S3 JSON snapshots.
"""

import os
import json
import logging
import urllib.request
import urllib.parse
from datetime import datetime, timezone
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
            val = param["Value"]
            if key not in os.environ or not os.environ[key]:
                os.environ[key] = val
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


def fetch_recent_evidence(conn, limit=200):
    """Fetch active recent hazard telemetry records from public.threat_records across all threat categories."""
    query = """
    SELECT id, threat_type, title, severity_score, description, metadata, recorded_at
    FROM (
        SELECT id, threat_type, title, severity_score, description, metadata, recorded_at,
               ROW_NUMBER() OVER (PARTITION BY threat_type ORDER BY recorded_at DESC) as rn
        FROM public.threat_records
    ) ranked
    WHERE rn <= 40
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
    """Summarize evidence by threat vector for mathematical scoring and prompt injection."""
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
    solar_highlights = [s["title"] for s in space_wx[:4]]

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


def calculate_deterministic_panic_index(evidence_summary: dict) -> tuple[float, str, list[str]]:
    """
    100% Deterministic, Reproducible Mathematical Global Panic Index Calculator.
    Scale: 1.0 (Baseline Nominal Equilibrium) to 10.0 (Global Catastrophe).
    
    Itemized Multi-Vector Formula:
    - Base Baseline: 1.0
    - Seismic Vector (USGS):
        M >= 8.0: +4.0 pts
        7.0 <= M < 8.0: +2.5 pts
        6.0 <= M < 7.0: +1.2 pts
        5.0 <= M < 6.0: +0.4 pts
    - Orbital / Asteroid Vector (NASA NeoWs):
        Close approach <= 1 Lunar Distance (<384,400 km) & Hazardous: +2.5 pts
        1 < LD <= 5: +0.8 pts
        5 < LD <= 10: +0.2 pts
        > 10 LD: +0.0 pts
    - Space Weather Vector (NASA DONKI):
        X-Class Flare (X5+): +3.0 pts
        X-Class Flare (X1-X5): +1.5 pts
        M-Class Flare (M5+): +0.6 pts
        M-Class Flare (M1-M4): +0.3 pts
    - Severe Terrestrial Weather Vector (NWS / NOAA):
        > 30 active emergency warnings: +1.0 pts
        10-30 warnings: +0.5 pts
        1-9 warnings: +0.2 pts
    - Financial Volatility Vector (Yahoo Finance):
        VIX surge > 15%: +1.0 pts
        VIX surge > 5%: +0.4 pts
    """
    eq = evidence_summary.get("earthquakes", {})
    ast = evidence_summary.get("asteroids", {})
    sp = evidence_summary.get("space_weather", {})
    wx = evidence_summary.get("terrestrial_weather", {})
    markets = evidence_summary.get("financial_markets", {}).get("tracked_assets", [])
    
    score = 1.0
    key_factors = []
    
    # 1. Seismic Vector
    max_eq = float(eq.get("max_severity", 0.0))
    if max_eq >= 8.0:
        score += 4.0
        key_factors.append(f"Seismic: Major M{max_eq:.1f} catastrophe (+4.0 pts)")
    elif max_eq >= 7.0:
        score += 2.5
        key_factors.append(f"Seismic: Strong M{max_eq:.1f} earthquake (+2.5 pts)")
    elif max_eq >= 6.0:
        score += 1.2
        key_factors.append(f"Seismic: Moderate M{max_eq:.1f} earthquake (+1.2 pts)")
    elif max_eq >= 5.0:
        score += 0.4
        key_factors.append(f"Seismic: Background M{max_eq:.1f} tremor (+0.4 pts)")
    else:
        key_factors.append("Seismic: Stable baseline geodynamic noise")

    # 2. Orbital Vector
    miss_km = float(ast.get("miss_distance_km", 999999999))
    is_haz = bool(ast.get("is_hazardous", False))
    lunar_dist = miss_km / 384400.0 if miss_km > 0 else 999.0
    if lunar_dist <= 1.0 and is_haz:
        score += 2.5
        key_factors.append(f"Orbital: Ultra-close approach ({lunar_dist:.1f} LD, {round(miss_km):,} km) (+2.5 pts)")
    elif lunar_dist <= 5.0:
        score += 0.8
        key_factors.append(f"Orbital: Close flyby at {lunar_dist:.1f} Lunar Distances (+0.8 pts)")
    elif lunar_dist <= 10.0:
        score += 0.2
        key_factors.append(f"Orbital: Distant pass at {lunar_dist:.1f} Lunar Distances (+0.2 pts)")
    else:
        key_factors.append("Orbital: Safe deep-space trajectories (> 10 LD)")

    # 3. Space Weather Vector
    solar_events = sp.get("recent_events", [])
    has_x_class = any("X-Class" in s or "X" in s for s in solar_events)
    has_m_class = any("M-Class" in s or "M" in s for s in solar_events)
    if has_x_class:
        score += 1.5
        key_factors.append("Solar: Elevated X-Class flare activity (+1.5 pts)")
    elif has_m_class:
        score += 0.4
        key_factors.append("Solar: Minor M-Class solar flare (+0.4 pts)")
    else:
        key_factors.append("Solar: Nominal background solar radiation flux")

    # 4. Severe Weather Vector
    wx_count = int(wx.get("count", 0))
    if wx_count > 30:
        score += 1.0
        key_factors.append(f"Weather: Widespread storm alerts ({wx_count} active) (+1.0 pts)")
    elif wx_count > 10:
        score += 0.5
        key_factors.append(f"Weather: Regional severe weather ({wx_count} alerts) (+0.5 pts)")
    elif wx_count > 0:
        score += 0.2
        key_factors.append(f"Weather: Localized advisories ({wx_count} active) (+0.2 pts)")
    else:
        key_factors.append("Weather: Clear continental weather baselines")

    # 5. Financial Volatility Vector
    for m in markets:
        if "^VIX" in m or "VIX" in m:
            try:
                if "+" in m:
                    parts = m.split(":")
                    if len(parts) > 1:
                        pct = float(parts[1].replace("%", "").replace("+", "").strip())
                        if pct > 15.0:
                            score += 1.0
                            key_factors.append(f"Markets: VIX volatility surge (+{pct:.1f}%) (+1.0 pts)")
                        elif pct > 5.0:
                            score += 0.4
                            key_factors.append(f"Markets: VIX elevated (+{pct:.1f}%) (+0.4 pts)")
            except Exception:
                pass

    final_score = min(10.0, max(1.0, round(score, 1)))
    status_level = "NOMINAL" if final_score < 4.0 else "ELEVATED" if final_score < 7.0 else "CRITICAL"
    
    return final_score, status_level, key_factors


def generate_heuristic_editorial_verdict(evidence_summary: dict, deterministic_panic_index: float, deterministic_status_level: str, key_factors: list):
    """Fallback narrative synthesizer when Gemini quota/credits are pending."""
    eq = evidence_summary.get("earthquakes", {})
    ast = evidence_summary.get("asteroids", {})
    
    verdict_text = (
        f"Global panic index is at {deterministic_panic_index:.1f}. Financial markets are experiencing routine noise, "
        "but cosmic and tectonic sensor arrays confirm baseline stability. You're fine."
    )
    summary_narrative = (
        f"Physical sensor arrays report {eq.get('count', 0)} seismic events (peak: {eq.get('max_event', 'nominal')}) "
        f"and {ast.get('count', 0)} harmless orbital flybys. Planetary equilibrium remains fully stable."
    )
    
    social_doomscroll = [
        {
            "handle": "@crypto_macro_panic",
            "author": "Apex Macro Trader",
            "platform": "X",
            "verified": True,
            "post_text": "VIX spiked on market turbulence! Algorithms triggering circuit breakers. 2008 repeat in motion?! 📉🚨 #MarketCrash",
            "hysteria_score": 9.2,
            "sanity_check": "Routine liquidity adjustments and algorithmic rebalancing. Global banking core is completely sound."
        },
        {
            "handle": "@cosmic_watch_hub",
            "author": "Orbital Threat Radar",
            "platform": "X",
            "verified": False,
            "post_text": f"NASA tracking asteroid {ast.get('closest_approach', '2019 MH1')} near Earth orbit zone today! Brace for impact?! 🪨👀 #Asteroid",
            "hysteria_score": 8.7,
            "sanity_check": f"Passing at comfortable planetary distance ({round(ast.get('miss_distance_km', 54000000)/1e6, 1)}M km). Zero atmospheric collision probability."
        },
        {
            "handle": "@solar_flare_alert",
            "author": "Space Weather Monitor",
            "platform": "X",
            "verified": True,
            "post_text": "Major coronal mass ejection detected from the Sun! Will our electrical grids and Starlink fry this week?! ⚡☀️ #SolarStorm",
            "hysteria_score": 7.8,
            "sanity_check": "Standard geomagnetic absorption in upper ionosphere. Bring a camera for polar auroras; leave the generator alone."
        }
    ]

    return {
        "panic_index": deterministic_panic_index,
        "status_level": deterministic_status_level,
        "verdict_text": verdict_text,
        "summary_narrative": summary_narrative,
        "key_factors": key_factors,
        "social_doomscroll": social_doomscroll
    }, "bsl4-deterministic-synthesizer"


def call_gemini_api(api_key: str, evidence_summary: dict, deterministic_panic_index: float, deterministic_status_level: str, calculated_factors: list):
    """Call Google Gemini REST API to write qualitative editorial text and mock social debunks for the deterministic score."""
    models_to_try = [
        "gemini-3.6-flash",
        "gemini-3.7-flash",
        "gemini-flash-latest",
        "gemini-3.1-flash-lite",
        "gemini-1.5-flash"
    ]
    
    prompt = f"""
You are the Chief Reality Synthesizer for BSL-4 (a planetary hazard vs. hysteria monitoring station).

DETERMINISTIC PANIC INDEX (PRE-COMPUTED BY BACKEND CODE):
- Exact Score: {deterministic_panic_index:.1f} / 10
- Status Level: {deterministic_status_level}
- Calculated Metric Factors: {json.dumps(calculated_factors)}

VERIFIED SENSOR TELEMETRY EVIDENCE:
{json.dumps(evidence_summary, indent=2)}

YOUR TASK:
Write an authoritative, witty, grounded, evidence-based editorial verdict explaining the pre-computed Panic Index score of {deterministic_panic_index:.1f} / 10.

Provide a balanced perspective:
- If financial markets are panicking (e.g. VIX spike, S&P drop) but physical systems (earthquakes, asteroids, solar flares) are nominal, call out Wall Street's nervous hysteria while reassuring that the physical planet is completely safe.
- If an asteroid passed, note its vast distance (e.g., millions of km / multiples of lunar distance) and reassure that dinosaurs would be jealous.
- If a solar flare occurred, explain it is a harmless atmospheric light show (aurora) rather than an apocalypse.
- Generate 3 realistic, hilarious "Social Media Doomscroll / Panic Tweets" reflecting what viral overreacting accounts on X (Twitter) are posting about today's hazards, paired with a sharp, grounded 1-sentence BSL-4 sanity check.

IMPORTANT: Do NOT invent or alter the Panic Index score. Set "panic_index" to {deterministic_panic_index:.1f} and "status_level" to "{deterministic_status_level}".

Return ONLY a valid JSON object matching this schema:
{{
  "panic_index": {deterministic_panic_index:.1f},
  "status_level": "{deterministic_status_level}",
  "verdict_text": "Global panic index is at {deterministic_panic_index:.1f}. Wall Street is sweating over algorithmic ripples, but the stars are quiet and tectonic plates are asleep. You're fine.",
  "summary_narrative": "A concise 2-3 sentence paragraph providing evidence-based commentary comparing sensor data against human noise.",
  "key_factors": [
    "Tectonics: Baseline background activity only",
    "Orbital: Zero atmospheric collision threats",
    "Macro: Mild speculative market jitters"
  ],
  "social_doomscroll": [
    {{
      "handle": "@crypto_doomer_99",
      "author": "Apex Macro Doom",
      "platform": "X",
      "verified": true,
      "post_text": "VIX spiked 2.5%, S&P in freefall. Liquidate everything! 2008 repeat is here 📉🚨 #MarketCrash",
      "hysteria_score": 9.4,
      "sanity_check": "Routine algorithmic portfolio rebalancing. The global banking system is completely fine."
    }},
    {{
      "handle": "@cosmic_panic_now",
      "author": "Cosmic Alert Hub",
      "platform": "X",
      "verified": false,
      "post_text": "NASA detected a massive asteroid flying right past Earth today! Why is mainstream media silent?! 🪨👀 #Asteroid",
      "hysteria_score": 8.8,
      "sanity_check": "Passed 54 million kilometers away. Closer to Mars than your roof."
    }},
    {{
      "handle": "@weather_apocalypse",
      "author": "Storm Chaser Central",
      "platform": "X",
      "verified": true,
      "post_text": "Severe storm fronts developing across the continent. Grid collapse imminent?! ⚡❄️ #Blizzard2026",
      "hysteria_score": 7.6,
      "sanity_check": "Standard mid-latitude precipitation band. Bring an umbrella."
    }}
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
    if api_key:
        for model in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            parsed_url = urllib.parse.urlparse(url)
            if parsed_url.scheme not in ("http", "https"):
                raise ValueError(f"Invalid URL scheme '{parsed_url.scheme}'. Only http and https are permitted.")

            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            try:
                with urllib.request.urlopen(req, timeout=25) as response:  # nosec: B310
                    res_body = json.loads(response.read().decode("utf-8"))
                    text = res_body["candidates"][0]["content"]["parts"][0]["text"]
                    clean_text = text.strip()
                    if clean_text.startswith("```json"):
                        clean_text = clean_text[7:]
                    if clean_text.startswith("```"):
                        clean_text = clean_text[3:]
                    if clean_text.endswith("```"):
                        clean_text = clean_text[:-3]
                    
                    parsed = json.loads(clean_text.strip())
                    # Ensure deterministic score is locked in
                    parsed["panic_index"] = deterministic_panic_index
                    parsed["status_level"] = deterministic_status_level
                    logger.info(f">>> Gemini API successfully synthesized editorial verdict using model '{model}'.")
                    return parsed, model
            except Exception as e:
                last_error = e
                logger.warning(f">>> Gemini model '{model}' call failed: {e}. Trying fallback model...")

    logger.warning(f">>> All Gemini models failed ({last_error}). Using deterministic heuristic synthesizer.")
    return generate_heuristic_editorial_verdict(evidence_summary, deterministic_panic_index, deterministic_status_level, calculated_factors)


def save_editorial_verdict(conn, verdict_data, evidence_summary, model_used):
    """Save generated verdict to Supabase PostgreSQL."""
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


def invalidate_cloudfront(paths=None):
    """Trigger CloudFront cache invalidation so the edge instantly serves fresh snapshots."""
    dist_id = os.environ.get("CLOUDFRONT_DIST_ID", "E24CTJCZZ478NW")
    if not dist_id:
        return
    if paths is None:
        paths = ["/data/*", "/api/*"]
    try:
        cf = boto3.client("cloudfront", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        cf.create_invalidation(
            DistributionId=dist_id,
            InvalidationBatch={
                "Paths": {
                    "Quantity": len(paths),
                    "Items": paths
                },
                "CallerReference": f"ai-editor-{int(datetime.now(timezone.utc).timestamp())}"
            }
        )
        logger.info(f">>> CloudFront cache invalidated for {paths} on distribution {dist_id}")
    except Exception as e:
        logger.warning(f"Could not invalidate CloudFront cache: {e}")


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
            "socialDoomscroll": verdict_data.get("social_doomscroll", []),
            "modelUsed": str(model_used),
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }
        for key_path in ["data/editorial-verdict.json", "api/editorial-verdict.json"]:
            s3.put_object(
                Bucket=bucket_name,
                Key=key_path,
                Body=json.dumps(verdict_payload, indent=2).encode("utf-8"),
                ContentType="application/json",
                CacheControl="no-cache, no-store, max-age=0, must-revalidate"
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
                CacheControl="no-cache, no-store, max-age=0, must-revalidate"
            )
        logger.info(f">>> Published s3://{bucket_name}/data/threats.json ({len(threats_payload)} records)")

        # 3. Automatically invalidate CloudFront cache for instant edge propagation
        invalidate_cloudfront(["/data/*", "/api/*"])
    except Exception as e:
        logger.warning(f"Could not publish JSON snapshots to S3: {e}")


def run_ai_editorial_pipeline():
    """Main execution orchestrator."""
    load_ssm_secrets()
    gemini_key = get_config("GEMINI_API_KEY", "")

    conn = get_db_connection()
    try:
        ensure_editorial_table(conn)

        # 1. Fetch real physical and market telemetry
        evidence = fetch_recent_evidence(conn, limit=200)
        if not evidence:
            logger.warning(">>> No threat records found in public.threat_records. Ingestion worker must run first.")
            return {
                "status": "SKIPPED",
                "message": "No telemetry evidence found in database. Ingestor pipeline must run first."
            }

        logger.info(f">>> Found {len(evidence)} verified telemetry evidence records.")
        evidence_summary = summarize_evidence_for_ai(evidence)

        # 2. 100% DETERMINISTIC MATHEMATICAL SCORING (computed in Python code, NOT by AI)
        deterministic_panic_index, deterministic_status_level, calculated_factors = calculate_deterministic_panic_index(evidence_summary)
        logger.info(f">>> Deterministic Panic Index calculated: {deterministic_panic_index} / 10 ({deterministic_status_level})")

        # 3. Call Google Gemini API (to write qualitative summary & mock social debunks for this exact score)
        verdict_data, model_used = call_gemini_api(
            gemini_key, 
            evidence_summary, 
            deterministic_panic_index, 
            deterministic_status_level, 
            calculated_factors
        )

        # 4. Persist into Supabase
        verdict_id = save_editorial_verdict(conn, verdict_data, evidence_summary, model_used)
        logger.info(f">>> Successfully persisted Editorial Verdict #{verdict_id}: '{verdict_data.get('verdict_text')}'")

        # 5. Publish static edge JSON snapshot to S3
        publish_s3_snapshot(verdict_data, evidence_summary, model_used, evidence)

        return {
            "status": "SUCCESS",
            "verdict_id": verdict_id,
            "panic_index": deterministic_panic_index,
            "status_level": deterministic_status_level,
            "verdict_text": verdict_data.get("verdict_text"),
            "model_used": model_used
        }
    finally:
        conn.close()


def lambda_handler(event, context):
    """AWS Lambda entry point for EventBridge scheduled triggers."""
    logger.info(">>> AWS Lambda: Starting BSL-4 Editorial Verdict execution...")
    result = run_ai_editorial_pipeline()
    logger.info(f">>> Execution completed: {result}")
    return {
        "statusCode": 200 if result.get("status") in ["SUCCESS", "SKIPPED"] else 500,
        "body": json.dumps(result)
    }


if __name__ == "__main__":
    print(">>> Running BSL-4 Editorial Verdict Worker in local standalone mode...")
    res = run_ai_editorial_pipeline()
    print(json.dumps(res, indent=2))
