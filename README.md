# BSL-4

> **THE WORLD IS ENDING... BUT IS IT REALLY?**

**Live Website:** [platformstaq.com](https://platformstaq.com)

BSL-4 is a real-time planetary hazard and crisis intelligence platform designed to cut through doom-mongering and internet hysteria by cross-referencing viral global panic with live physical sensor telemetry.

By aggregating real-time streams across seismic, atmospheric, orbital, and macroeconomic domains, BSL-4 calculates a deterministic danger score and delivers an authoritative, evidence-based assessment of what is actually happening in the world.

---

## The 4 Core Dashboard Sections

1. **1. The AI Verdict**  
   A synthesized composite **Global Panic Index** (scale 1.0 – 10.0) and automated editorial verdict powered by Google Gemini that contrasts physical sensor realities against algorithmic market jitters and social media noise.

2. **2. Geospatial Map & Local Reality**  
   A full-width interactive D3 Natural Earth radar map tracking global earthquakes (magnitude 4.5+) and active NOAA severe weather emergencies, complete with global location search and distance calculations to your current region.

3. **3. Orbital & Space Watch**  
   Dedicated deep-space monitoring tracking ranked **NASA NeoWs** near-Earth asteroid approaches (sorted by closest lunar distance and flyby velocity) alongside **NASA DONKI** space weather alerts (solar flares, coronal mass ejections, geomagnetic storm Kp-indices).

4. **4. The Macro Noise**  
   A filterable macroeconomic stream cross-referencing **Yahoo Finance** multi-market volatility indices (`^VIX`, `^GSPC`, `^FTSE`, `^N225`, `^HSI`, `GC=F`, `BTC-USD`) with a **Social Media Hysteria** debunk engine that contrasts viral headlines with verified sensor measurements.

---

## Live Data Sources

- **USGS Earthquakes**: Global seismic monitoring for events magnitude 4.5 and above.
- **NASA DONKI**: Solar flare classifications, coronal mass ejections, and geomagnetic storms.
- **NASA NeoWs**: Near-Earth asteroid trajectory, miss distance, and hazard classifications.
- **NOAA / Weather.gov**: Active severe convective weather, hurricane, tornado, and blizzard warnings.
- **Yahoo Finance**: Real-time multi-market indices, volatility benchmarks, and safe-haven commodities.
- **Open-Meteo & OpenStreetMap**: High-precision global geocoding for pinpoint proximity calculations.

---

## Architecture & Technology

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide icons, D3.js Natural Earth projections.
- **AI & Editorial Engine**: Python 3.12 AWS Lambda workers running Google Gemini (structured JSON synthesis) on scheduled EventBridge intervals.
- **Cloud Infrastructure**: AWS Lambda (serverless compute), Amazon CloudFront (global edge CDN), Amazon S3 (secure static distribution), AWS SSM Parameter Store, and Supabase PostgreSQL.