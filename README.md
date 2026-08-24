# BSL-4: Protocol Zero

**Global Planetary Hazard & Crisis Telemetry Platform**

BSL-4 is an enterprise serverless telemetry platform that aggregates, tracks, and scores real-time atmospheric anomalies, space weather events, seismic disasters, international financial market crises, and near-Earth asteroid approaches.

Whether it is a high-severity solar flare, an uncomfortably close asteroid, a major earthquake, or international stock market volatility, BSL-4 calculates composite danger levels with high-precision geospatial and telemetry metrics.

---

---

## Project Structure (Monorepo)

```
bsl-4/
├── backend/                  # Spring Boot 4.1.0 / Java 21 REST API
│   ├── src/                  # Controllers, Models, Services, SSM Config
│   ├── Dockerfile            # Container build with AWS Lambda Web Adapter
│   └── pom.xml               # Maven configuration & AWS SDK v2
├── frontend/                 # Next.js 14 (App Router) + Tailwind CSS + TypeScript
│   ├── src/app/              # Tactical DEFCON Bunker Dashboard
│   ├── src/components/       # Radar Map, DEFCON Gauge, Event Modals, Tactical Table
│   ├── src/lib/              # Haversine geo distance, API client
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
Edit `.env` with your Supabase credentials and NASA API key.

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
   - Near-Earth object tracking and hazardous asteroid scoring.
   - Dynamic solar flare (X/M/C-class), geomagnetic storm (Kp-index), and Coronal Mass Ejection (CME) severity calculation.
2. **USGS Earthquake Hazards Feed**:
   - Ingestion of 30-day seismic events (`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson`).
   - Dynamic severity calculation based on Richter magnitude and tsunami alert flags.
3. **NWS Atmospheric Threats (Weather.gov)**:
   - Severe atmospheric threats, hurricane alerts, tornado emergencies, and extreme weather warnings.
4. **International Financial Market Telemetry (Yahoo Finance)**:
   - Polling across continuous international market trading hours:
     - **Americas**: CBOE Volatility Index (`^VIX`), S&P 500 (`^GSPC`)
     - **Europe**: FTSE 100 London (`^FTSE`)
     - **Asia-Pacific**: Nikkei 225 Tokyo (`^N225`), Hang Seng Hong Kong (`^HSI`)
     - **Commodities & Liquidity**: Gold Futures (`GC=F`), Bitcoin (`BTC-USD`)
   - Snapshot deduplication via threat category purging before batch persistence.

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

- **Zero Hardcoded Secrets**: All production secrets (database passwords, API keys) are stored in **AWS Systems Manager (SSM) Parameter Store** and decrypted dynamically via AWS KMS using IAM role credentials at cold start.
- **Strict Concurrency Limits**: AWS Lambda concurrency is bounded to prevent runaway compute costs.
- **Edge Security**: Cloudflare Bot Fight Mode and WAF protect against scrapers and DDoS traffic before reaching AWS.