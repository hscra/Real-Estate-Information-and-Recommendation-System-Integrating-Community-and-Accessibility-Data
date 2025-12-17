# Property Search (Full Stack)

FastAPI backend + Postgres/PostGIS + Next.js frontend for searching property listings, viewing price history/predictions, and running a “what‑if” price impact scenario.

## Repo Structure

- `backend/` FastAPI API + SQLAlchemy + services (predictions, opinions, price impact)
- `frontend/property-search/` Next.js UI
- `requirements.txt` Python dependencies

## Prerequisites

- Python 3.10+ (recommended) and `pip`
- Node.js 18+ and `npm`
- Postgres (optionally with PostGIS; recommended if `USE_POSTGIS=true`)
- Google Maps API key (for the map UI)

## Quick Start

### 1) Database

Configure `DATABASE_URL` in `.env` (repo root). Example:

`DATABASE_URL=postgresql+psycopg2://postgres:pass@localhost:5432/realestate`

Also used:

- `SCHEMA` (default `realestate`)
- `VIEW_OR_TABLE` (default `fact_listings`)
- `USE_POSTGIS` (`true`/`false`)

### 2) Backend (FastAPI)

From repo root:

- Install: `python -m pip install -r requirements.txt`
- Run: `uvicorn backend.app:app --reload --port 8000`
- Health check: `curl -s http://localhost:8000/health`

### 3) Frontend (Next.js)

From `frontend/property-search/`:

- Install: `npm install`
- Create `frontend/property-search/.env.local` with:
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...`
  - `BACKEND_URL=http://localhost:8000` (used by Next.js API routes to reach the backend)
- Run: `npm run dev`
- Open: `http://localhost:3000`

Note: the UI calls the backend through Next.js API routes under `/api/*` (same-origin), so you generally should not set `NEXT_PUBLIC_API_BASE` unless you know what you’re doing.

## Key API Endpoints

- `GET /health`
- `GET /listings` (requires bbox params: `south`, `west`, `north`, `east`)
- `GET /listings/{listing_id}/history`
- `GET /listings/{listing_id}/opinions`
- `POST /listings/{listing_id}/price-impact` (scenario-based price adjustment)
- `GET /tiles/points/{z}/{x}/{y}.png` (PNG overlay tiles; accepts the same filter query params as `/listings`)

## Tests / Validation

- Unit tests (no real DB): `python -m pytest backend/tests/test_app.py`
- Opt-in API perf checks (hits a running backend): `RUN_API_BENCH=1 python -m pytest backend/tests/test_ap.py -s`
- Opt-in price impact scenario sweep: `RUN_SCENARIO_SWEEP=1 python -m pytest backend/tests/test_ap.py -k scenario -s`

## Run With Docker (recommended for sharing)

This repo includes a `docker-compose.yml` that starts:

- Postgres + PostGIS (`db`)
- FastAPI backend (`backend`) on `http://localhost:8000`
- Next.js frontend (`frontend`) on `http://localhost:3000`

Steps:

- Install Docker Desktop (or Docker Engine + Compose)
- From repo root: `docker compose up --build`
- Open: `http://localhost:3000`

Notes:

- If you change frontend environment variables, rebuild (`docker compose up --build`) because `NEXT_PUBLIC_*` values are baked at build time.
- The database container initializes from `backend/db/init/` on first run; the data volume persists in `db_data`.
