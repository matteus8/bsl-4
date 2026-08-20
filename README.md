# BSL-4: Protocol Zero

**Assess the threat. Pour the drink.**

BSL-4 is a serverless application that tracks real-time atmospheric anomalies and doomsday environmental factors, prescribing the appropriate cocktail (or calming tea) to weather the crisis.

Whether it is a high-severity solar flare or an uncomfortably close asteroid, BSL-4 provides the exact liquid countermeasure you need.

## Architecture
This project utilizes a fully serverless, highly scalable stack:
- Frontend: Static assets hosted on AWS S3 (delivering a clinical, high-stakes UI).
- Compute: AWS Lambda via API Gateway to handle incoming threat-level calculations and fetch telemetry data.
- Database: Supabase (PostgreSQL) for logging threat records, severity scores, and corresponding drink prescriptions.

## Database Schema
> NOTE: this is rapidly changing...

The primary logging table public.threat_records tracks all incoming anomalies.

| Column | Type | Description |
|---|---|---|
| id | int8 | Primary key |
| threat_type | varchar | Category of the event (e.g., SPACE_WEATHER, ASTEROID) |
| title | varchar | Specific event identifier (e.g., CME, 2005 UE1) |
| severity_score | float8 | Calculated danger metric |
| description | text | Extended details of the threat |
| recommended_drink | varchar | The prescribed beverage (e.g., Solar Flare Margarita) |
| metadata | jsonb | Additional telemetry (e.g., is_hazardous, max_width_meters) |
| recorded_at | timestamp | Exact time of logging |


# Lambda DB Connection 

Ensure you use transaction pooler database pooler for AWS lambda and limit the connction count:
```bash
DATABASE_URL=postgres://[user]:[password]@[pooler-url]:5432/postgres?connection_limit=1
```

 > Deployment Connection Pooling Notes:
 > - AWS Lambda spins up concurrent instances rapidly. 
 > - You must use the Supabase connection string configured for Transaction Mode (database pooler) 
 > - keep connection_limit=1 to prevent exhausting database connections.