# BSL-4

> **THE WORLD IS ENDING... BUT IS IT REALITY?**

[![GitHub Source](https://img.shields.io/badge/GitHub-matteus8%2Fbsl--4-blue?logo=github)](https://github.com/matteus8/bsl-4/tree/main)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Production](https://img.shields.io/badge/Live-platformstaq.com-FF007F)](https://platformstaq.com)

BSL-4 is a serverless planetary telemetry and crisis analysis platform designed to cross-reference global threats with physical reality. By synthesizing live feeds across seismic, orbital, solar, atmospheric, macroeconomic, and internet vectors, BSL-4 calculates composite panic ratings and cuts through doom-mongering hysteria.

---

## 4-Section Single-Page Layout

BSL-4 chunks information into four distinct analytical domains:

1. **1. The AI Verdict**: Top-level composite **Global Panic Index** (scale 1.0 – 10.0) and dynamically generated reality synthesis (*"Global panic index is at 2.1. Wall Street is sweating, but the stars are quiet and tectonic plates are asleep. You're fine."*).
2. **2. Geospatial Map & Local Reality**: Full-width interactive D3 Natural Earth radar map tracking global earthquakes (M 4.5+) and active NOAA severe weather emergencies with instant pinpoint location proximity.
3. **3. Orbital & Space Watch**: Dedicated cosmic monitoring box tracking **NASA NeoWs** near-Earth asteroid flybys and **NASA DONKI** space weather (X/M-class solar flares, CMEs, geomagnetic storms) with witty physical reality takeaways.
4. **4. The Macro Noise**: Filterable feed separating real **Yahoo Finance** multi-market indices (`^VIX`, `^GSPC`, `^FTSE`, `^N225`, `^HSI`, `GC=F`, `BTC-USD`) from viral **Social Media Hysteria** claims cross-referenced with real sensor arrays.

---

## Project Structure (Monorepo)

```
bsl-4/
├── backend/                  # Spring Boot 4.1.0 / Java 21 REST API
│   ├── src/                  # Controllers, Models, Services, SSM Config
│   ├── Dockerfile            # Container build with AWS Lambda Web Adapter
│   └── pom.xml               # Maven configuration & AWS SDK v2
├── frontend/                 # Next.js 14 (App Router) + Tailwind CSS + TypeScript
│   ├── src/app/              # 4-Section Layout Single-Page Dashboard
│   ├── src/components/       # AIVerdictBanner, TacticalRadarMap, OrbitalSpaceWatch, MacroNoiseSection
│   ├── src/lib/              # Geo calculation & client API layer
│   └── out/                  # Static export build (synced to S3)
├── worker/                   # Dedicated Ingestion Worker (Python 3.12)
│   ├── main.py               # Ingestion pipeline & Supabase persistence
│   └── requirements.txt      # Pure Python dependencies (pg8000)
├── .env.example              # Template configuration for local dev & cloud deployments
└── .gitignore                # Hardened exclusions for secrets and deploy scripts
```

---

## Quickstart & Local Development

### 1. Clone & Configure Environment
```bash
git clone https://github.com/matteus8/bsl-4.git
cd bsl-4
cp .env.example .env
```
Configure `.env` with your Supabase PostgreSQL credentials and NASA API key.

---

### 2. Run Backend (Spring Boot / Docker)

**Option A: Using Docker (Recommended)**
```bash
docker build -t bsl4-backend ./backend
docker run -p 8080:8080 --env-file .env bsl4-backend
```

**Option B: Using Local Java 21 & Maven**
```bash
cd backend
./mvnw spring-boot:run
```
The REST API will be active at `http://localhost:8080`.

---

### 3. Run Frontend (Next.js 14)
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` to view the interactive dashboard.

---

### 4. Run Ingestion Worker (Python 3.12)
To manually trigger a full multi-vector data pull into Supabase:
```bash
cd worker
pip install -r requirements.txt
python main.py
```

---

## Telemetry Feeds & Data Pipelines

1. **NASA Space Weather (DONKI) & Asteroid Feed (NeoWs)**:
   - Near-Earth object tracking and hazardous asteroid flyby scoring.
   - Dynamic solar flare (X/M/C-class), geomagnetic storm (Kp-index), and Coronal Mass Ejection (CME) severity calculation.
2. **USGS Earthquake Hazards Feed**:
   - Ingestion of 30-day global seismic events (M 4.5+).
   - Dynamic severity calculation based on Richter magnitude and tsunami alert flags.
3. **NWS Atmospheric Threats (Weather.gov)**:
   - Severe atmospheric threats, hurricane alerts, tornado emergencies, and extreme weather warnings.
4. **International Financial Market Telemetry (Yahoo Finance)**:
   - Polling across continuous international market trading hours:
     - **Americas**: CBOE Volatility Index (`^VIX`), S&P 500 (`^GSPC`)
     - **Europe**: FTSE 100 London (`^FTSE`)
     - **Asia-Pacific**: Nikkei 225 Tokyo (`^N225`), Hang Seng Hong Kong (`^HSI`)
     - **Commodities & Liquidity**: Gold Futures (`GC=F`), Bitcoin (`BTC-USD`)

---

## Database Schema (`public.threat_records`)

| Column | Type | Description |
|---|---|---|
| `id` | int8 | Primary key (auto-incrementing) |
| `threat_type` | varchar | Category (`SPACE_WEATHER`, `ASTEROID`, `EARTHQUAKE`, `TERRESTRIAL_WEATHER`, `STOCK_MARKET`) |
| `title` | varchar | Specific event identifier (e.g. CME Event, M 5.7 Earthquake, Solar Flare X2.8, VIX Spike) |
| `severity_score` | float8 | Calculated danger metric (0.0 to 10.0 scale) |
| `description` | text | Extended details of the threat |
| `metadata` | jsonb | Telemetry parameters, coordinates, depth, market ranges, and pricing |
| `recorded_at` | timestamp | Exact time of physical occurrence |

---

## Security & Best Practices

- **Zero Hardcoded Secrets**: All production secrets are stored in **AWS Systems Manager (SSM) Parameter Store** and decrypted dynamically via AWS KMS using IAM role credentials at cold start.
- **Strict Concurrency Limits**: AWS Lambda concurrency is bounded to prevent runaway compute costs.
- **Edge Security**: Cloudflare Bot Fight Mode and WAF protect against scrapers and DDoS traffic before reaching AWS.