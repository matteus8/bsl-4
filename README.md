# BSL-4: Protocol Zero

**Assess the threat. Pour the drink.**

BSL-4 is a serverless application that tracks real-time atmospheric anomalies, space weather events, seismic disasters, financial market crises, and doomsday environmental factors, prescribing the appropriate cocktail (or calming tea) to weather the crisis.

Whether it is a high-severity solar flare, an uncomfortably close asteroid, a major earthquake, or a stock market crash, BSL-4 calculates the danger level and provides the exact liquid countermeasure you need.

---

---

## Local Development & Testing

### 1. Run Backend Container
```bash
docker build -t bsl4-backend ./backend
docker run -p 8080:8080 --env-file backend/.env bsl4-backend
```
Backend API will be live at `http://localhost:8080`.

### 2. Run Next.js Frontend
```bash
cd frontend
npm run dev
```
Open `http://localhost:3000` to view the tactical doomsday dashboard.

### 3. Build Frontend for S3 Deployment
```bash
cd frontend
npm run build
```
Generates static assets in `frontend/out/` ready for upload to AWS S3 & CloudFront.

---

## Connection Pooling Notes
Ensure you use transaction pooler port `5432` for Supabase PostgreSQL:
```bash
SPRING_DATASOURCE_URL=jdbc:postgresql://[pooler-url]:5432/postgres?sslmode=require&prepareThreshold=0&connection_limit=1
```
- Keep `connection_limit=1` to prevent connection exhaustion in serverless environments like AWS Lambda.