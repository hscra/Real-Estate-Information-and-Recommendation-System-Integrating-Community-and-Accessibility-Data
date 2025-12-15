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
- Run: `NEXT_PUBLIC_BACKEND_URL=http://localhost:8000 npm run dev`
- Open: `http://localhost:3000`

## Key API Endpoints

- `GET /health`
- `GET /listings` (requires bbox params: `south`, `west`, `north`, `east`)
- `GET /listings/{listing_id}/history`
- `GET /listings/{listing_id}/opinions`
- `POST /listings/{listing_id}/price-impact` (scenario-based price adjustment)

## Tests / Validation

- Unit tests (no real DB): `python -m pytest backend/tests/test_app.py`
- Opt-in API perf checks (hits a running backend): `RUN_API_BENCH=1 python -m pytest backend/tests/test_ap.py -s`
- Opt-in price impact scenario sweep: `RUN_SCENARIO_SWEEP=1 python -m pytest backend/tests/test_ap.py -k scenario -s`

