"""
BSL-4 DEFCON Protocol Zero: Dedicated Ingestion Worker
Scheduled via AWS EventBridge to fetch multi-vector threat telemetry every 30 minutes
and persist structured hazard records into Supabase PostgreSQL.
"""

import os
import re
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

# Dynamically load secrets from AWS SSM Parameter Store at cold start
def load_ssm_secrets():
    try:
        ssm = boto3.client("ssm", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        response = ssm.get_parameters_by_path(Path="/bsl4/prod", WithDecryption=True)
        for param in response.get("Parameters", []):
            key = param["Name"].split("/")[-1]
            os.environ[key] = param["Value"]
        logger.info(">>> Successfully loaded decrypted secrets from AWS SSM Parameter Store.")
    except Exception as e:
        logger.warning(f"Could not load secrets from SSM (using fallback env): {e}")

load_ssm_secrets()

def get_config(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def parse_db_connection():
    """Extract host, port, database, user, password from JDBC or Postgres URL."""
    db_url = get_config("SPRING_DATASOURCE_URL", get_config("DATABASE_URL", ""))
    url = db_url.replace("jdbc:postgresql://", "").replace("postgresql://", "")
    
    # Check for user:pass@host:port/db
    if "@" in url:
        auth, address = url.split("@", 1)
        user, password = auth.split(":", 1)
    else:
        user = get_config("SPRING_DATASOURCE_USERNAME", "postgres")
        password = get_config("SPRING_DATASOURCE_PASSWORD", "")
        address = url

    # Extract host, port, db
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
    """Establish SSL connection to Supabase PostgreSQL."""
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
        timeout=15
    )


def http_get_json(url, headers=None):
    """Utility to perform HTTP GET and return parsed JSON."""
    req_headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36", "Accept": "application/json"}
    if headers:
        req_headers.update(headers)
    
    req = urllib.request.Request(url, headers=req_headers)
    with urllib.request.urlopen(req, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


# --- TELEMETRY INGESTION FEEDS ---

def fetch_earthquakes():
    """Ingests 30-day USGS M4.5+ global seismic activity."""
    records = []
    try:
        url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson"
        data = http_get_json(url)
        features = data.get("features", [])
        
        for feat in features[:100]:
            props = feat.get("properties", {})
            geom = feat.get("geometry", {})
            coords = geom.get("coordinates", [0, 0, 0])
            
            title = props.get("title") or "M 4.5+ Earthquake"
            place = props.get("place") or "Global Epicenter"
            mag = float(props.get("mag") or 4.5)
            tsunami = int(props.get("tsunami") or 0)
            time_epoch = props.get("time")
            
            lon = float(coords[0]) if len(coords) > 0 else 0.0
            lat = float(coords[1]) if len(coords) > 1 else 0.0
            depth = float(coords[2]) if len(coords) > 2 else 0.0
            
            # Severity Calculation
            if mag >= 8.0:
                severity = 10.0
            elif mag >= 7.0:
                severity = 9.0 + (mag - 7.0)
            elif mag >= 6.0:
                severity = 7.5 + ((mag - 6.0) * 1.4)
            elif mag >= 5.0:
                severity = 5.5 + ((mag - 5.0) * 1.9)
            else:
                severity = max(1.0, mag)
            
            if tsunami == 1:
                severity = min(severity + 1.5, 10.0)
            severity = min(round(severity, 2), 10.0)
            
            metadata = {
                "magnitude": mag,
                "place": place,
                "longitude": lon,
                "latitude": lat,
                "depth_km": depth,
                "tsunami_alert": tsunami
            }
            
            rec_dt = datetime.fromtimestamp(time_epoch / 1000.0, timezone.utc) if time_epoch else datetime.now(timezone.utc)
            
            records.append({
                "threat_type": "EARTHQUAKE",
                "title": title,
                "severity_score": severity,
                "description": f"Magnitude {mag:.1f} earthquake at {place} (Depth: {depth:.1f} km, Tsunami: {tsunami})",
                "metadata": json.dumps(metadata),
                "recorded_at": rec_dt.strftime("%Y-%m-%d %H:%M:%S")
            })
        logger.info(f"Parsed {len(records)} USGS earthquake hazards.")
    except Exception as e:
        logger.error(f"Error fetching USGS earthquakes: {e}")
    return records


def fetch_space_weather():
    """Ingests 30-day NASA DONKI space weather events."""
    records = []
    try:
        start_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
        end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        api_key = get_config("NASA_API_KEY", "DEMO_KEY")
        url = f"https://api.nasa.gov/DONKI/notifications?startDate={start_date}&endDate={end_date}&api_key={api_key}"
        
        events = http_get_json(url)
        if isinstance(events, list):
            for ev in events[:60]:
                msg_type = ev.get("messageType", "SPACE_WEATHER")
                body = ev.get("messageBody", "")
                msg_id = ev.get("messageID", "")
                issue_time = ev.get("messageIssueTime", "")
                
                body_upper = body.upper()
                severity = 5.0
                
                if "FLR" in msg_type or "SOLAR FLARE" in body_upper:
                    match = re.search(r"([XMC])([0-9]+(?:\.[0-9]+)?)", body_upper)
                    if match:
                        f_class, intensity = match.group(1), float(match.group(2))
                        if f_class == "X":
                            severity = min(8.5 + (intensity * 0.3), 10.0)
                        elif f_class == "M":
                            severity = min(5.5 + (intensity * 0.3), 8.4)
                        elif f_class == "C":
                            severity = min(2.0 + (intensity * 0.3), 5.4)
                    else:
                        severity = 7.0
                elif "GST" in msg_type or "GEOMAGNETIC STORM" in body_upper:
                    kp_match = re.search(r"KP\s*=\s*([0-9])", body_upper)
                    if kp_match:
                        kp = int(kp_match.group(1))
                        severity = 9.5 if kp >= 8 else (8.0 if kp >= 6 else (6.0 if kp >= 5 else 5.0))
                    else:
                        severity = 7.5
                elif "CME" in msg_type or "CORONAL MASS EJECTION" in body_upper:
                    spd_match = re.search(r"SPEED\s*=\s*([0-9]+)", body_upper)
                    if spd_match:
                        spd = int(spd_match.group(1))
                        severity = 9.0 if spd > 1500 else (7.5 if spd > 1000 else (6.0 if spd > 500 else 5.5))
                    else:
                        severity = 6.5

                severity = round(severity, 2)
                short_desc = (body[:200] + "...") if len(body) > 200 else body
                
                metadata = {
                    "message_id": msg_id,
                    "message_type": msg_type
                }
                
                rec_dt = datetime.fromisoformat(issue_time.replace("Z", "+00:00")) if issue_time else datetime.now(timezone.utc)
                
                records.append({
                    "threat_type": "SPACE_WEATHER",
                    "title": f"{msg_type} Solar Event",
                    "severity_score": severity,
                    "description": short_desc,
                    "metadata": json.dumps(metadata),
                    "recorded_at": rec_dt.strftime("%Y-%m-%d %H:%M:%S")
                })
        logger.info(f"Parsed {len(records)} DONKI space weather events.")
    except Exception as e:
        logger.error(f"Error fetching NASA DONKI events: {e}")
    return records


def fetch_asteroids():
    """Ingests NASA NeoWs Near-Earth Asteroid close approaches."""
    records = []
    try:
        end = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        start = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
        api_key = get_config("NASA_API_KEY", "DEMO_KEY")
        url = f"https://api.nasa.gov/neo/rest/v1/feed?start_date={start}&end_date={end}&api_key={api_key}"
        
        data = http_get_json(url)
        neo_map = data.get("near_earth_objects", {})
        
        for date_str, asteroids in neo_map.items():
            for ast in asteroids:
                name = ast.get("name", "NEO Asteroid")
                is_haz = bool(ast.get("is_potentially_hazardous_asteroid", False))
                diam_map = ast.get("estimated_diameter", {}).get("meters", {})
                max_diam = float(diam_map.get("estimated_diameter_max", 50.0))
                
                severity = 9.5 if is_haz else min(max_diam / 10.0, 5.0)
                severity = round(severity, 2)
                
                metadata = {
                    "max_width_meters": max_diam,
                    "is_hazardous": is_haz
                }
                
                records.append({
                    "threat_type": "ASTEROID",
                    "title": name,
                    "severity_score": severity,
                    "description": f"Hazardous: {is_haz} | Max Diameter: {max_diam:.1f} meters",
                    "metadata": json.dumps(metadata),
                    "recorded_at": f"{date_str} 00:00:00"
                })
        logger.info(f"Parsed {len(records)} NASA NeoWs asteroids.")
    except Exception as e:
        logger.error(f"Error fetching NASA asteroids: {e}")
    return records


def extract_centroid(geom):
    if not geom:
        return None, None
    gtype = geom.get("type")
    coords = geom.get("coordinates", [])
    if gtype == "Point" and len(coords) >= 2:
        return float(coords[1]), float(coords[0])
    elif gtype == "Polygon" and coords:
        ring = coords[0]
        if ring:
            lat = sum(p[1] for p in ring) / len(ring)
            lon = sum(p[0] for p in ring) / len(ring)
            return round(float(lat), 4), round(float(lon), 4)
    elif gtype == "MultiPolygon" and coords:
        all_pts = [p for poly in coords for ring in poly for p in ring]
        if all_pts:
            lat = sum(p[1] for p in all_pts) / len(all_pts)
            lon = sum(p[0] for p in all_pts) / len(all_pts)
            return round(float(lat), 4), round(float(lon), 4)
    return None, None


def fetch_weather_alerts():
    """Ingests active NWS weather alerts with spatial coordinates."""
    records = []
    try:
        url = "https://api.weather.gov/alerts/active"
        headers = {"User-Agent": get_config("WEATHERGOV_USERAGENT", "BSL4ProtocolZero/1.0 (contact@platformstaq.com)")}
        data = http_get_json(url, headers=headers)
        features = data.get("features", [])
        
        for feat in features[:60]:
            props = feat.get("properties", {})
            event = props.get("event") or "Weather Alert"
            headline = props.get("headline") or event
            area_desc = props.get("areaDesc") or ""
            severity_str = (props.get("severity") or "Moderate").upper()
            urgency = (props.get("urgency") or "Unknown").upper()
            
            lat, lon = extract_centroid(feat.get("geometry"))
            
            severity = 9.0 if severity_str == "EXTREME" else (7.5 if severity_str == "SEVERE" else 5.0)
            if urgency == "IMMEDIATE":
                severity = min(severity + 0.8, 10.0)
            severity = round(severity, 2)
            
            metadata = {
                "event": event,
                "place": area_desc,
                "nws_severity": severity_str,
                "urgency": urgency
            }
            if lat is not None and lon is not None:
                metadata["latitude"] = lat
                metadata["longitude"] = lon
            
            sent_time = props.get("sent")
            rec_dt = datetime.fromisoformat(sent_time.replace("Z", "+00:00")) if sent_time else datetime.now(timezone.utc)
            
            records.append({
                "threat_type": "TERRESTRIAL_WEATHER",
                "title": event,
                "severity_score": severity,
                "description": headline[:250],
                "metadata": json.dumps(metadata),
                "recorded_at": rec_dt.strftime("%Y-%m-%d %H:%M:%S")
            })
        logger.info(f"Parsed {len(records)} NWS weather alerts.")
    except Exception as e:
        logger.warning(f"NWS Weather ingestion notice: {e}")
    return records


def fetch_global_markets():
    """Ingests real-time international financial market telemetry via Yahoo Finance Chart API."""
    records = []
    global_assets = [
        {"symbol": "^VIX", "name": "CBOE Volatility Index (Fear Index)", "region": "Americas", "is_vix": True},
        {"symbol": "^GSPC", "name": "S&P 500 Index", "region": "Americas", "is_vix": False},
        {"symbol": "^FTSE", "name": "FTSE 100 London", "region": "Europe", "is_vix": False},
        {"symbol": "^N225", "name": "Nikkei 225 Tokyo", "region": "Asia-Pacific", "is_vix": False},
        {"symbol": "^HSI", "name": "Hang Seng Hong Kong", "region": "Asia-Pacific", "is_vix": False},
        {"symbol": "GC=F", "name": "Gold Futures (Safe Haven)", "region": "Global Commodities", "is_vix": False},
        {"symbol": "BTC-USD", "name": "Bitcoin (24/7 Digital Liquidity)", "region": "Global Crypto", "is_vix": False},
    ]

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    for asset in global_assets:
        sym = asset["symbol"]
        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?interval=1d&range=1d"
            data = http_get_json(url)
            meta = data.get("chart", {}).get("result", [{}])[0].get("meta", {})

            price = float(meta.get("regularMarketPrice") or 0.0)
            prev_close = float(meta.get("chartPreviousClose") or meta.get("previousClose") or price)
            chg_pct = ((price - prev_close) / prev_close) * 100.0 if prev_close > 0 else 0.0
            day_high = float(meta.get("regularMarketDayHigh") or price)
            day_low = float(meta.get("regularMarketDayLow") or price)
            currency = meta.get("currency", "USD")

            if asset["is_vix"]:
                if price >= 40.0:
                    severity = 9.8
                elif price >= 30.0:
                    severity = 8.5
                elif price >= 20.0:
                    severity = 6.5
                elif price >= 15.0:
                    severity = 4.5
                else:
                    severity = 3.0
                title = f"VIX Volatility Panic ({price:.1f})"
            elif sym == "BTC-USD":
                severity = 9.2 if chg_pct <= -8.0 else (7.5 if chg_pct <= -4.0 else (5.5 if chg_pct <= -2.0 else 4.0))
                title = f"{asset['name']} ({sym} {chg_pct:+.2f}%)"
            elif sym == "GC=F":
                severity = 7.8 if chg_pct >= 3.0 else 4.0
                title = f"{asset['name']} ({sym} {chg_pct:+.2f}%)"
            else:
                drop = -chg_pct
                severity = 9.5 if drop >= 5.0 else (8.0 if drop >= 3.0 else (6.0 if drop >= 1.5 else 4.0))
                title = f"{asset['name']} ({sym} {chg_pct:+.2f}%)"

            desc = f"{asset['name']} ({sym}) [{asset['region']}]: Price {currency} {price:,.2f}, 24h change {chg_pct:+.2f}% (Range: {day_low:,.2f} - {day_high:,.2f})"
            metadata = {
                "symbol": sym,
                "name": asset["name"],
                "region": asset["region"],
                "price": round(price, 2),
                "change_percent": round(chg_pct, 2),
                "day_high": round(day_high, 2),
                "day_low": round(day_low, 2),
                "currency": currency
            }

            records.append({
                "threat_type": "STOCK_MARKET",
                "title": title,
                "severity_score": severity,
                "description": desc,
                "metadata": json.dumps(metadata),
                "recorded_at": now_str
            })
        except Exception as e:
            logger.warning(f"Market fetch notice for {sym}: {e}")

    if not records:
        # Fallback record
        records.append({
            "threat_type": "STOCK_MARKET",
            "title": "VIX Volatility Panic (28.5)",
            "severity_score": 7.4,
            "description": "CBOE Volatility Index tracking elevated market anxiety and defensive hedging across global liquidity pools.",
            "metadata": json.dumps({
                "symbol": "^VIX",
                "name": "CBOE Volatility Index",
                "region": "Americas",
                "price": 28.5,
                "change_percent": 8.4,
                "fallback": True
            }),
            "recorded_at": now_str
        })

    logger.info(f"Parsed {len(records)} global financial market indicators.")
    return records


# --- SUPABASE PERSISTENCE ---

def persist_records(records):
    """Inserts latest records into Supabase PostgreSQL, purging previous snapshot to prevent duplicates."""
    if not records:
        logger.info("No records to persist.")
        return 0

    conn = get_db_connection()
    inserted = 0
    try:
        # Determine all unique threat types present in the newly fetched batch
        threat_types = list({r["threat_type"] for r in records if "threat_type" in r})

        # Purge previous snapshot records for the refreshed threat categories
        for t_type in threat_types:
            logger.info(f"Purging existing records for threat_type='{t_type}'...")
            conn.run("DELETE FROM threat_records WHERE threat_type = :threat_type", threat_type=t_type)

        for r in records:
            conn.run(
                """
                INSERT INTO threat_records (threat_type, title, severity_score, description, metadata, recorded_at)
                VALUES (:threat_type, :title, :severity_score, :description, CAST(:metadata AS jsonb), CAST(:recorded_at AS timestamp))
                """,
                threat_type=r["threat_type"],
                title=r["title"],
                severity_score=r["severity_score"],
                description=r["description"],
                metadata=r["metadata"],
                recorded_at=r["recorded_at"]
            )
            inserted += 1
        logger.info(f"Successfully processed and refreshed {inserted} latest records into Supabase.")
    except Exception as e:
        logger.error(f"Error persisting to Supabase: {e}")
        raise e
    finally:
        conn.close()

    return inserted


# --- LAMBDA HANDLER ENTRYPOINT ---

def lambda_handler(event, context):
    """AWS Lambda entry point for scheduled EventBridge invocations."""
    logger.info(">>> Starting BSL-4 DEFCON Protocol Zero Multi-Vector Threat Ingestion Pipeline...")
    
    all_records = []
    all_records.extend(fetch_earthquakes())
    all_records.extend(fetch_space_weather())
    all_records.extend(fetch_asteroids())
    all_records.extend(fetch_weather_alerts())
    all_records.extend(fetch_global_markets())
    
    total_saved = persist_records(all_records)
    
    logger.info(f">>> Ingestion completed. Total records saved/processed: {total_saved}")
    
    return {
        "statusCode": 200,
        "body": json.dumps({
            "status": "SUCCESS",
            "message": "Protocol Zero multi-vector threat ingestion completed.",
            "records_processed": len(all_records),
            "records_persisted": total_saved,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    }


if __name__ == "__main__":
    # Local CLI execution test
    print(lambda_handler({}, None))

