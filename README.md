# BSL-4

> **THE WORLD IS ENDING... BUT IS IT REALLY?**

**Live Website:** [platformstaq.com](https://platformstaq.com)

BSL-4 is a real-time planetary hazard and crisis intelligence platform designed to cut through doom-mongering and internet hysteria by cross-referencing global events with live physical sensor arrays. 

By aggregating streams across seismic, atmospheric, orbital, and macroeconomic domains, BSL-4 calculates a composite danger score and delivers a clear, evidence-based assessment of what is actually happening in the world.

---

## The 4 Core Dashboard Sections

BSL-4 organizes planetary telemetry into four analytical domains:

1. **1. The AI Verdict**  
   A synthesized composite **Global Panic Index** (scale 1.0 – 10.0) that combines all live data streams into a single, plain-English summary of current global stability.

2. **2. Geospatial Map & Local Reality**  
   A full-width interactive D3 Natural Earth radar map tracking global earthquakes (magnitude 4.5+) and active NOAA severe weather emergencies, complete with location search and proximity distance calculations to your current region.

3. **3. Orbital & Space Watch**  
   Dedicated deep-space monitoring tracking **NASA NeoWs** near-Earth asteroid approaches (miss distance, diameter, relative velocity) and **NASA DONKI** space weather (solar flares, coronal mass ejections, geomagnetic storm alerts) with physical reality takeaways.

4. **4. The Macro Noise**  
   A filterable stream cross-referencing **Yahoo Finance** multi-market volatility indices (`^VIX`, `^GSPC`, `^FTSE`, `^N225`, `^HSI`, `GC=F`, `BTC-USD`) with an internet **Social Media Hysteria** debunk engine that contrasts viral claims with physical sensor measurements.

---

## Live Data Sources

- **USGS Earthquakes**: Global seismic monitoring for events magnitude 4.5 and above.
- **NASA DONKI**: Solar flare classifications, coronal mass ejections, and geomagnetic storms.
- **NASA NeoWs**: Near-Earth asteroid trajectory, miss distance, and hazard classifications.
- **NOAA / Weather.gov**: Active severe convective weather, hurricane, tornado, and blizzard warnings.
- **Yahoo Finance**: Real-time multi-market indices, volatility benchmarks, and safe-haven commodities.
- **Open-Meteo & OpenStreetMap**: High-precision global geocoding for pinpoint distance and proximity calculations.

---

## Architecture & Technology

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, D3.js TopoJSON geographic projections.
- **Backend API**: Java 21, Spring Boot REST API with SQL Haversine spatial calculation endpoints.
- **Ingestion Worker**: Python scheduled batch ETL pipelines with multi-source data normalization and deduplication.
- **Cloud Infrastructure**: AWS Lambda (serverless compute), Amazon CloudFront (global edge CDN), Amazon S3, and Supabase PostgreSQL.