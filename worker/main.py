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
    req_headers = {"User-Agent": "BSL4ProtocolZero/1.0", "Accept": "application/json"}
    if headers:
        req_headers.update(headers)
    
    req = urllib.request.Request(url, headers=req_headers)
    with urllib.request.urlopen(req, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


# Pre-cached cocktail recipes from TheCocktailDB for instant sub-millisecond execution
COCKTAIL_REGISTRY = {
    "Earthquake": {
        "drink_name": "Earthquake",
        "instructions": "Pour 1 oz Gin, 1 oz Bourbon, 1 oz Pernod into glass over cracked ice. Stir well.",
        "glass": "Cocktail glass",
        "thumb_url": "https://www.thecocktaildb.com/images/media/drink/brambl1541421443.jpg",
        "ingredients": ["1 oz Gin", "1 oz Bourbon", "1 oz Pernod"]
    },
    "Zombie": {
        "drink_name": "Zombie",
        "instructions": "Blend all ingredients with crushed ice. Pour into highball glass and garnish with mint and fruit slice.",
        "glass": "Hurricane glass",
        "thumb_url": "https://www.thecocktaildb.com/images/media/drink/2x8thr1504816928.jpg",
        "ingredients": ["1 1/2 oz Dark Rum", "1 1/2 oz Light Rum", "1 oz Gold Rum", "1/2 oz Triple Sec", "1 oz Lime Juice", "1 oz Pineapple Juice"]
    },
    "Hurricane": {
        "drink_name": "Hurricane",
        "instructions": "Shake dark rum, light rum, passion fruit syrup, orange juice, and lime juice with ice. Strain into hurricane glass.",
        "glass": "Hurricane glass",
        "thumb_url": "https://www.thecocktaildb.com/images/media/drink/quqyqp1480879103.jpg",
        "ingredients": ["2 oz Dark Rum", "2 oz Light Rum", "1 oz Passion Fruit Syrup", "1 oz Orange Juice", "1/2 oz Lime Juice"]
    },
    "Manhattan": {
        "drink_name": "Manhattan",
        "instructions": "Stir bourbon, sweet vermouth, and bitters with ice. Strain into chilled cocktail glass and garnish with cherry.",
        "glass": "Cocktail glass",
        "thumb_url": "https://www.thecocktaildb.com/images/media/drink/yk70e31606771240.jpg",
        "ingredients": ["2 oz Bourbon", "3/4 oz Sweet Vermouth", "2 dashes Angostura Bitters", "1 Maraschino Cherry"]
    },
    "Negroni": {
        "drink_name": "Negroni",
        "instructions": "Stir equal parts gin, Campari, and sweet vermouth into glass over ice. Garnish with orange peel.",
        "glass": "Old-fashioned glass",
        "thumb_url": "https://www.thecocktaildb.com/images/media/drink/qgdu971561574065.jpg",
        "ingredients": ["1 oz Gin", "1 oz Campari", "1 oz Sweet Vermouth", "1 twist Orange Peel"]
    },
    "Kamikaze": {
        "drink_name": "Kamikaze",
        "instructions": "Shake vodka, triple sec, and lime juice with ice. Strain into cocktail glass.",
        "glass": "Cocktail glass",
        "thumb_url": "https://www.thecocktaildb.com/images/media/drink/d7ff7u1606855412.jpg",
        "ingredients": ["1 oz Vodka", "1 oz Triple Sec", "1 oz Lime Juice"]
    },
    "Margarita": {
        "drink_name": "Margarita",
        "instructions": "Rub rim of glass with lime wedge, dip in salt. Shake tequila, triple sec, and lime juice with ice. Strain into glass.",
        "glass": "Margarita glass",
        "thumb_url": "https://www.thecocktaildb.com/images/media/drink/5noda61589575158.jpg",
        "ingredients": ["2 oz Tequila", "1 oz Triple Sec", "1 oz Fresh Lime Juice", "Coarse Salt"]
    },
    "Tequila Sunrise": {
        "drink_name": "Tequila Sunrise",
        "instructions": "Pour tequila and orange juice into highball glass over ice. Slowly pour grenadine down inside of glass.",
        "glass": "Highball glass",
        "thumb_url": "https://www.thecocktaildb.com/images/media/drink/quqyqp1480879103.jpg",
        "ingredients": ["2 oz Tequila", "4 oz Orange Juice", "1/2 oz Grenadine"]
    },
    "Dark and Stormy": {
        "drink_name": "Dark and Stormy",
        "instructions": "Fill highball glass with ice, add ginger beer, float dark rum on top. Garnish with lime wedge.",
        "glass": "Highball glass",
        "thumb_url": "https://www.thecocktaildb.com/images/media/drink/t1070g1606766050.jpg",
        "ingredients": ["2 oz Dark Rum", "4 oz Ginger Beer", "1/2 oz Lime Juice"]
    },
    "Whiskey Sour": {
        "drink_name": "Whiskey Sour",
        "instructions": "Shake whiskey, lemon juice, and simple syrup with ice. Strain into rocks glass.",
        "glass": "Old-fashioned glass",
        "thumb_url": "https://www.thecocktaildb.com/images/media/drink/hbkfsh1589574990.jpg",
        "ingredients": ["2 oz Bourbon", "3/4 oz Fresh Lemon Juice", "1/2 oz Simple Syrup"]
    },
    "Bloody Mary": {
        "drink_name": "Bloody Mary",
        "instructions": "Stir vodka, tomato juice, lemon juice, Worcestershire, Tabasco, salt, and pepper over ice.",
        "glass": "Highball glass",
        "thumb_url": "https://www.thecocktaildb.com/images/media/drink/t6caa21582485702.jpg",
        "ingredients": ["1 1/2 oz Vodka", "3 oz Tomato Juice", "1 dash Worcestershire", "1 dash Tabasco"]
    },
    "Gin Tonic": {
        "drink_name": "Gin Tonic",
        "instructions": "Pour gin and tonic water into highball glass over ice cubes. Garnish with lime wedge.",
        "glass": "Highball glass",
        "thumb_url": "https://www.thecocktaildb.com/images/media/drink/qcgz0t1643821443.jpg",
        "ingredients": ["2 oz Gin", "5 oz Tonic Water", "1 Lime Wedge"]
    },
    "Hot Toddy": {
        "drink_name": "Hot Toddy",
        "instructions": "Pour boiling water into mug, add whiskey, honey, and lemon juice. Stir until dissolved.",
        "glass": "Irish coffee cup",
        "thumb_url": "https://www.thecocktaildb.com/images/media/drink/yvvwys1461867858.jpg",
        "ingredients": ["2 oz Whiskey", "1 tbsp Honey", "1/2 oz Lemon Juice", "1 cup Boiling Water"]
    },
    "Panic Button Martini": {
        "drink_name": "Panic Button Martini",
        "instructions": "Pour navy-strength gin and dry vermouth into mixing glass with ice. Stir vigorously and strain.",
        "glass": "Martini glass",
        "thumb_url": "https://www.thecocktaildb.com/images/media/drink/hbkfsh1589574990.jpg",
        "ingredients": ["2 1/2 oz Navy Strength Gin", "1/2 oz Dry Vermouth", "2 dashes Orange Bitters"]
    }
}


# --- COCKTAIL PRESCRIPTION ENGINE ---

def prescribe_drink(threat_type: str, severity: float):
    """Prescribes a situation-matched cocktail protocol in O(1) time."""
    t_type = (threat_type or "GENERAL").upper()
    
    if severity >= 8.5:
        if t_type in ("EARTHQUAKE", "ASTEROID"):
            name = "Earthquake"
        elif t_type == "TERRESTRIAL_WEATHER":
            name = "Hurricane"
        else:
            name = "Zombie"
    elif severity >= 6.0:
        if t_type == "SPACE_WEATHER":
            name = "Tequila Sunrise"
        elif t_type == "ASTEROID":
            name = "Kamikaze"
        elif t_type == "EARTHQUAKE":
            name = "Manhattan"
        elif t_type == "TERRESTRIAL_WEATHER":
            name = "Dark and Stormy"
        else:
            name = "Margarita"
    elif severity >= 4.0:
        if t_type == "SPACE_WEATHER":
            name = "Margarita"
        elif t_type == "ASTEROID":
            name = "Whiskey Sour"
        elif t_type == "EARTHQUAKE":
            name = "Negroni"
        elif t_type == "TERRESTRIAL_WEATHER":
            name = "Bloody Mary"
        else:
            name = "Gin Tonic"
    else:
        name = "Hot Toddy"

    return COCKTAIL_REGISTRY.get(name, COCKTAIL_REGISTRY["Hot Toddy"])


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
            
            cocktail = prescribe_drink("EARTHQUAKE", severity)
            metadata = {
                "magnitude": mag,
                "place": place,
                "longitude": lon,
                "latitude": lat,
                "depth_km": depth,
                "tsunami_alert": tsunami,
                "cocktail": cocktail
            }
            
            rec_dt = datetime.fromtimestamp(time_epoch / 1000.0, timezone.utc) if time_epoch else datetime.now(timezone.utc)
            
            records.append({
                "threat_type": "EARTHQUAKE",
                "title": title,
                "severity_score": severity,
                "description": f"Magnitude {mag:.1f} earthquake at {place} (Depth: {depth:.1f} km, Tsunami: {tsunami})",
                "recommended_drink": cocktail["drink_name"],
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
                cocktail = prescribe_drink("SPACE_WEATHER", severity)
                short_desc = (body[:200] + "...") if len(body) > 200 else body
                
                metadata = {
                    "message_id": msg_id,
                    "message_type": msg_type,
                    "cocktail": cocktail
                }
                
                rec_dt = datetime.fromisoformat(issue_time.replace("Z", "+00:00")) if issue_time else datetime.now(timezone.utc)
                
                records.append({
                    "threat_type": "SPACE_WEATHER",
                    "title": f"{msg_type} Solar Event",
                    "severity_score": severity,
                    "description": short_desc,
                    "recommended_drink": cocktail["drink_name"],
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
                
                cocktail = prescribe_drink("ASTEROID", severity)
                metadata = {
                    "max_width_meters": max_diam,
                    "is_hazardous": is_haz,
                    "cocktail": cocktail
                }
                
                records.append({
                    "threat_type": "ASTEROID",
                    "title": name,
                    "severity_score": severity,
                    "description": f"Hazardous: {is_haz} | Max Diameter: {max_diam:.1f} meters",
                    "recommended_drink": cocktail["drink_name"],
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


def fetch_weather_and_markets():
    """Ingests NWS active alerts with spatial coordinates and synthetic financial volatility indices."""
    records = []
    
    # 1. NWS Alerts
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
            
            cocktail = prescribe_drink("TERRESTRIAL_WEATHER", severity)
            metadata = {
                "event": event,
                "place": area_desc,
                "nws_severity": severity_str,
                "urgency": urgency,
                "cocktail": cocktail
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
                "recommended_drink": cocktail["drink_name"],
                "metadata": json.dumps(metadata),
                "recorded_at": rec_dt.strftime("%Y-%m-%d %H:%M:%S")
            })
        logger.info(f"Parsed {len(records)} NWS weather alerts.")
    except Exception as e:
        logger.warning(f"NWS Weather ingestion notice: {e}")

    # 2. Financial Markets
    records.append({
        "threat_type": "STOCK_MARKET",
        "title": "CBOE VIX Volatility Alert",
        "severity_score": 7.4,
        "description": "Global equity volatility index baseline tracking liquidity and hedge positioning.",
        "recommended_drink": "Panic Button Martini",
        "metadata": json.dumps({
            "symbol": "^VIX",
            "price": 28.5,
            "cocktail": prescribe_drink("STOCK_MARKET", 7.4)
        }),
        "recorded_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    })
    
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
                INSERT INTO threat_records (threat_type, title, severity_score, description, recommended_drink, metadata, recorded_at)
                VALUES (:threat_type, :title, :severity_score, :description, :recommended_drink, CAST(:metadata AS jsonb), CAST(:recorded_at AS timestamp))
                """,
                threat_type=r["threat_type"],
                title=r["title"],
                severity_score=r["severity_score"],
                description=r["description"],
                recommended_drink=r["recommended_drink"],
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
    logger.info(">>> Starting BSL-4 DEFCON Protocol Zero 30-Minute Threat Ingestion Pipeline...")
    
    all_records = []
    all_records.extend(fetch_earthquakes())
    all_records.extend(fetch_space_weather())
    all_records.extend(fetch_asteroids())
    all_records.extend(fetch_weather_and_markets())
    
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
