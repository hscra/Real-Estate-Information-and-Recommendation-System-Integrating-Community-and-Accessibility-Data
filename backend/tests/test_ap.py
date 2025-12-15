"""Opt-in API performance checks (pytest).

These are not unit tests: they send real HTTP requests to a running backend
process (and may hit the real database). They are skipped by default.

Run (example):
  RUN_API_BENCH=1 API_BASE=http://localhost:8000 python -m pytest backend/tests/test_ap.py -s

Optional:
  LISTING_ID=<some_listing_id>  # enables the opinions benchmark
  BENCH_DURATION_S=15           # default 15 seconds
  BENCH_CONCURRENCY=10          # default 10 workers
  BENCH_TIMEOUT_S=5             # per-request timeout seconds
"""

from __future__ import annotations

import json
import os
import threading
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from statistics import mean, pstdev
from typing import Dict, List, Optional

import pytest


@dataclass(frozen=True)
class Result:
    ok: bool
    status: Optional[int]
    elapsed_s: float
    bytes_read: int
    error: Optional[str]


def _percentile(sorted_vals: List[float], p: float) -> float:
    if not sorted_vals:
        return float("nan")
    if p <= 0:
        return sorted_vals[0]
    if p >= 100:
        return sorted_vals[-1]
    k = (len(sorted_vals) - 1) * (p / 100.0)
    f = int(k)
    c = min(f + 1, len(sorted_vals) - 1)
    if f == c:
        return sorted_vals[f]
    d0 = sorted_vals[f] * (c - k)
    d1 = sorted_vals[c] * (k - f)
    return d0 + d1


def _build_url(base: str, path: str, params: Dict[str, str] | None = None) -> str:
    base = base.rstrip("/")
    path = path if path.startswith("/") else f"/{path}"
    if not params:
        return f"{base}{path}"
    return f"{base}{path}?{urllib.parse.urlencode(params)}"


def _request_once(url: str, timeout_s: float) -> Result:
    start = time.perf_counter()
    status: Optional[int] = None
    bytes_read = 0
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            status = getattr(resp, "status", None)
            body = resp.read()
            bytes_read = len(body or b"")
        ok = (status is not None) and (200 <= status < 300)
        return Result(
            ok=ok,
            status=status,
            elapsed_s=time.perf_counter() - start,
            bytes_read=bytes_read,
            error=None,
        )
    except Exception as e:
        return Result(
            ok=False,
            status=status,
            elapsed_s=time.perf_counter() - start,
            bytes_read=bytes_read,
            error=str(e),
        )


def _run_duration(url: str, concurrency: int, duration_s: float, timeout_s: float) -> List[Result]:
    stop_at = time.perf_counter() + duration_s
    lock = threading.Lock()
    results: List[Result] = []

    def worker() -> None:
        local: List[Result] = []
        while time.perf_counter() < stop_at:
            local.append(_request_once(url, timeout_s))
        with lock:
            results.extend(local)

    threads = []
    for _ in range(concurrency):
        t = threading.Thread(target=worker, daemon=True)
        t.start()
        threads.append(t)
    for t in threads:
        t.join()
    return results


def _summarize(results: List[Result], *, elapsed_s: float) -> dict:
    lat_ms = sorted([r.elapsed_s * 1000.0 for r in results])
    ok = [r for r in results if r.ok]
    errors = [r for r in results if not r.ok]

    by_status: Dict[str, int] = {}
    for r in results:
        key = str(r.status) if r.status is not None else "no_status"
        by_status[key] = by_status.get(key, 0) + 1

    by_error: Dict[str, int] = {}
    for r in errors:
        key = (r.error or "unknown")[:120]
        by_error[key] = by_error.get(key, 0) + 1

    return {
        "requests": len(results),
        "ok": len(ok),
        "error": len(errors),
        "ok_rate": (len(ok) / len(results)) if results else 0.0,
        "elapsed_s": elapsed_s,
        "rps": (len(results) / elapsed_s) if elapsed_s > 0 else 0.0,
        "latency_ms": {
            "min": lat_ms[0] if lat_ms else None,
            "p50": _percentile(lat_ms, 50),
            "p95": _percentile(lat_ms, 95),
            "p99": _percentile(lat_ms, 99),
            "max": lat_ms[-1] if lat_ms else None,
            "mean": mean(lat_ms) if lat_ms else None,
            "std": pstdev(lat_ms) if len(lat_ms) > 1 else 0.0,
        },
        "status_counts": dict(sorted(by_status.items(), key=lambda kv: (-kv[1], kv[0]))),
        "error_counts": dict(sorted(by_error.items(), key=lambda kv: (-kv[1], kv[0]))),
        "bytes_avg": (sum(r.bytes_read for r in results) / len(results)) if results else 0.0,
    }


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except Exception:
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except Exception:
        return default


RUN_API_BENCH = os.environ.get("RUN_API_BENCH", "").strip() == "1"
RUN_PRED_EVAL = os.environ.get("RUN_PRED_EVAL", "").strip() == "1"
RUN_SCENARIO_SWEEP = os.environ.get("RUN_SCENARIO_SWEEP", "").strip() == "1"
API_BASE = os.environ.get("API_BASE", "http://localhost:8000").strip()
CONCURRENCY = max(1, _env_int("BENCH_CONCURRENCY", 10))
DURATION_S = max(1.0, _env_float("BENCH_DURATION_S", 15.0))
TIMEOUT_S = max(0.5, _env_float("BENCH_TIMEOUT_S", 5.0))


@pytest.mark.skipif(not RUN_API_BENCH, reason="Set RUN_API_BENCH=1 to enable real API benchmarks.")
def test_perf_health() -> None:
    url = _build_url(API_BASE, "/health")
    t0 = time.perf_counter()
    results = _run_duration(url, CONCURRENCY, DURATION_S, TIMEOUT_S)
    elapsed = time.perf_counter() - t0
    summary = _summarize(results, elapsed_s=elapsed)
    summary.update({"name": "health", "url": url, "concurrency": CONCURRENCY, "duration_s": DURATION_S})
    print(json.dumps(summary, indent=2, sort_keys=True))
    assert summary["ok_rate"] > 0.99


@pytest.mark.skipif(not RUN_API_BENCH, reason="Set RUN_API_BENCH=1 to enable real API benchmarks.")
def test_perf_listings_bbox() -> None:
    # Kraków-ish bbox; adjust if your dataset focuses on another city.
    params = {
        "south": "49.966",
        "west": "19.768",
        "north": "50.132",
        "east": "20.165",
        "page": "1",
        "page_size": os.environ.get("BENCH_PAGE_SIZE", "24"),
        "sort": os.environ.get("BENCH_SORT", "recent"),
    }
    if os.environ.get("BENCH_INCLUDE_HISTORY", "").strip() == "1":
        params["include_history"] = "true"

    url = _build_url(API_BASE, "/listings", params)
    t0 = time.perf_counter()
    results = _run_duration(url, CONCURRENCY, DURATION_S, TIMEOUT_S)
    elapsed = time.perf_counter() - t0
    summary = _summarize(results, elapsed_s=elapsed)
    summary.update({"name": "listings_bbox", "url": url, "concurrency": CONCURRENCY, "duration_s": DURATION_S})
    print(json.dumps(summary, indent=2, sort_keys=True))
    assert summary["ok_rate"] > 0.95


@pytest.mark.skipif(not RUN_API_BENCH, reason="Set RUN_API_BENCH=1 to enable real API benchmarks.")
def test_perf_opinions_for_listing() -> None:
    listing_id = os.environ.get("LISTING_ID", "").strip()
    if not listing_id:
        pytest.skip("Set LISTING_ID to benchmark /listings/{id}/opinions (cold vs warm can be compared manually).")

    n = os.environ.get("BENCH_OPINIONS_N", "3").strip() or "3"
    url = _build_url(API_BASE, f"/listings/{listing_id}/opinions", {"n": n})

    t0 = time.perf_counter()
    results = _run_duration(url, CONCURRENCY, DURATION_S, TIMEOUT_S)
    elapsed = time.perf_counter() - t0
    summary = _summarize(results, elapsed_s=elapsed)
    summary.update({"name": "opinions", "url": url, "concurrency": CONCURRENCY, "duration_s": DURATION_S})
    print(json.dumps(summary, indent=2, sort_keys=True))
    assert summary["ok_rate"] > 0.95


def _get_json(url: str, timeout_s: float) -> dict:
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=timeout_s) as resp:
        status = getattr(resp, "status", None)
        if status is None or not (200 <= status < 300):
            raise AssertionError(f"GET {url} -> {status}")
        data = resp.read()
    return json.loads(data.decode("utf-8"))


def _metrics(y_true: List[float], y_pred: List[float]) -> dict:
    if len(y_true) != len(y_pred):
        raise ValueError("y_true and y_pred length mismatch")
    n = len(y_true)
    if n == 0:
        return {"n": 0, "mae": None, "rmse": None, "mape": None}

    abs_err = []
    sq_err = []
    pct_err = []
    for t, p in zip(y_true, y_pred, strict=True):
        e = p - t
        abs_err.append(abs(e))
        sq_err.append(e * e)
        if t != 0:
            pct_err.append(abs(e / t))

    mae = sum(abs_err) / n
    rmse = (sum(sq_err) / n) ** 0.5
    mape = (sum(pct_err) / len(pct_err)) if pct_err else None
    return {"n": n, "mae": mae, "rmse": rmse, "mape": mape}


@pytest.mark.skipif(
    not (RUN_API_BENCH or RUN_PRED_EVAL),
    reason="Set RUN_PRED_EVAL=1 (or RUN_API_BENCH=1) to enable prediction evaluation.",
)
def test_prediction_coverage_and_accuracy() -> None:
    """Evaluate prediction coverage and error vs observed prices.

    Uses the live `/listings` API (so it reflects whatever your backend serves).
    Reports metrics against BOTH:
      - observed `price` (total)
      - observed `price_per_sqm` (= price / square_m)

    This helps when your stored predictions represent price-per-m² instead of total price.
    """
    page_size = max(1, min(int(os.environ.get("PRED_EVAL_PAGE_SIZE", "500")), 1000))
    max_pages = max(1, int(os.environ.get("PRED_EVAL_MAX_PAGES", "20")))

    # Same bbox as other tests; you can override via env if needed.
    south = os.environ.get("PRED_EVAL_SOUTH", "49.966")
    west = os.environ.get("PRED_EVAL_WEST", "19.768")
    north = os.environ.get("PRED_EVAL_NORTH", "50.132")
    east = os.environ.get("PRED_EVAL_EAST", "20.165")

    def page_url(page: int) -> str:
        return _build_url(
            API_BASE,
            "/listings",
            {
                "south": str(south),
                "west": str(west),
                "north": str(north),
                "east": str(east),
                "page": str(page),
                "page_size": str(page_size),
                "sort": "recent",
            },
        )

    first = _get_json(page_url(1), TIMEOUT_S)
    total = int(first.get("total") or 0)
    items0 = list(first.get("items") or [])
    assert isinstance(items0, list)

    models = ("svm", "hgbr", "nn")
    seen = 0
    pred_present: Dict[str, int] = {m: 0 for m in models}

    # Per-model pairs for two possible targets (total and per-sqm)
    y_true_total: Dict[str, List[float]] = {m: [] for m in models}
    y_pred_total: Dict[str, List[float]] = {m: [] for m in models}
    y_true_ppsqm: Dict[str, List[float]] = {m: [] for m in models}
    y_pred_ppsqm: Dict[str, List[float]] = {m: [] for m in models}

    def consume(items: list[dict]) -> None:
        nonlocal seen
        for it in items:
            seen += 1
            price = it.get("price")
            sqm = it.get("square_m")
            try:
                price_f = float(price) if price is not None else None
            except Exception:
                price_f = None
            try:
                sqm_f = float(sqm) if sqm is not None else None
            except Exception:
                sqm_f = None

            ppsqm_f: Optional[float] = None
            if price_f is not None and sqm_f not in (None, 0.0):
                try:
                    if sqm_f > 0:
                        ppsqm_f = price_f / sqm_f
                except Exception:
                    ppsqm_f = None

            for m in models:
                key = f"predicted_{m}"
                if key not in it or it.get(key) is None:
                    continue
                pred_present[m] += 1
                try:
                    pred = float(it.get(key))
                except Exception:
                    continue
                if price_f is not None:
                    y_true_total[m].append(price_f)
                    y_pred_total[m].append(pred)
                if ppsqm_f is not None:
                    y_true_ppsqm[m].append(ppsqm_f)
                    y_pred_ppsqm[m].append(pred)

    consume(items0)

    # Fetch more pages up to max_pages or until we covered 'total'
    for page in range(2, max_pages + 1):
        if total and seen >= total:
            break
        data = _get_json(page_url(page), TIMEOUT_S)
        items = list(data.get("items") or [])
        if not items:
            break
        consume(items)

    report: dict = {
        "sampled_items": seen,
        "total_reported_by_api": total,
        "page_size": page_size,
        "max_pages": max_pages,
        "bbox": {"south": south, "west": west, "north": north, "east": east},
        "coverage_on_sample": {m: (pred_present[m] / seen if seen else 0.0) for m in models},
        "models": {},
    }

    for m in models:
        mt_total = _metrics(y_true_total[m], y_pred_total[m])
        mt_ppsqm = _metrics(y_true_ppsqm[m], y_pred_ppsqm[m])
        # Heuristic: which target does this model seem closer to?
        # (Lower MAPE is usually more interpretable; if missing, fall back to MAE.)
        best_target = None
        if mt_total["n"] and mt_ppsqm["n"]:
            if mt_total["mape"] is not None and mt_ppsqm["mape"] is not None:
                best_target = "total_price" if mt_total["mape"] <= mt_ppsqm["mape"] else "price_per_sqm"
            else:
                best_target = "total_price" if (mt_total["mae"] or 0) <= (mt_ppsqm["mae"] or 0) else "price_per_sqm"
        report["models"][m] = {
            "predictions_present_in_sample": pred_present[m],
            "metrics_vs_total_price": mt_total,
            "metrics_vs_price_per_sqm": mt_ppsqm,
            "best_target_guess": best_target,
        }

    print(json.dumps(report, indent=2, sort_keys=True))

    # Only assert that we successfully sampled some items.
    assert seen > 0


def _md_table(rows: list[dict]) -> str:
    if not rows:
        return ""
    cols = list(rows[0].keys())
    lines = [
        "| " + " | ".join(cols) + " |",
        "| " + " | ".join(["---"] * len(cols)) + " |",
    ]
    for r in rows:
        lines.append("| " + " | ".join(str(r.get(c, "")) for c in cols) + " |")
    return "\n".join(lines)


@pytest.mark.skipif(not RUN_SCENARIO_SWEEP, reason="Set RUN_SCENARIO_SWEEP=1 to print scenario sensitivity sweep.")
def test_price_scenario_sensitivity_sweep() -> None:
    """Sanity-check monotonicity and reasonable bounds of the elasticity model.

    This is meant for thesis evaluation: it prints a small markdown table with
    inputs and outputs, and asserts basic expected properties:
      - closer-to-centre (negative km change) increases price
      - transit upgrade increases price
      - more POIs increases price
      - effects remain within a reasonable bound for the tested ranges
    """
    from backend.services.price_scenarios import Scenario, estimate_price_impact

    base_price = float(os.environ.get("SWEEP_BASE_PRICE", "500000"))

    rows: list[dict] = []

    # 1) Centre distance sensitivity (negative = closer -> higher)
    centre_changes = [-3.0, -1.0, -0.5, 0.0, 0.5, 1.0, 3.0]
    centre_adjusted: list[float] = []
    for dkm in centre_changes:
        sc = Scenario(centre_distance_km_change=dkm)
        out = estimate_price_impact(base_price, sc)
        centre_adjusted.append(float(out["adjusted_price"]))
        rows.append(
            {
                "case": "centre_distance",
                "centre_km_change": dkm,
                "transit_upgrade": False,
                "transit_delta": 0,
                "poi_delta": 0,
                "delta_pct": round(float(out["delta_pct"]) * 100.0, 3),
                "delta_pln": round(float(out["delta_amount"]), 2),
                "adjusted_pln": round(float(out["adjusted_price"]), 2),
            }
        )
    # As distance change increases (farther), adjusted price should not increase.
    assert all(a >= b for a, b in zip(centre_adjusted, centre_adjusted[1:]))

    # 2) Transit upgrade toggle
    off = estimate_price_impact(base_price, Scenario(transit_upgrade=False))
    on = estimate_price_impact(base_price, Scenario(transit_upgrade=True))
    assert float(on["adjusted_price"]) > float(off["adjusted_price"])
    rows.append(
        {
            "case": "transit_upgrade",
            "centre_km_change": 0,
            "transit_upgrade": False,
            "transit_delta": 0,
            "poi_delta": 0,
            "delta_pct": round(float(off["delta_pct"]) * 100.0, 3),
            "delta_pln": round(float(off["delta_amount"]), 2),
            "adjusted_pln": round(float(off["adjusted_price"]), 2),
        }
    )
    rows.append(
        {
            "case": "transit_upgrade",
            "centre_km_change": 0,
            "transit_upgrade": True,
            "transit_delta": 0,
            "poi_delta": 0,
            "delta_pct": round(float(on["delta_pct"]) * 100.0, 3),
            "delta_pln": round(float(on["delta_amount"]), 2),
            "adjusted_pln": round(float(on["adjusted_price"]), 2),
        }
    )

    # 3) POI delta sensitivity
    poi_deltas = [-50, -10, 0, 10, 50]
    poi_adjusted: list[float] = []
    for dpoi in poi_deltas:
        out = estimate_price_impact(base_price, Scenario(new_poi_delta=dpoi))
        poi_adjusted.append(float(out["adjusted_price"]))
        rows.append(
            {
                "case": "poi_delta",
                "centre_km_change": 0,
                "transit_upgrade": False,
                "transit_delta": 0,
                "poi_delta": dpoi,
                "delta_pct": round(float(out["delta_pct"]) * 100.0, 3),
                "delta_pln": round(float(out["delta_amount"]), 2),
                "adjusted_pln": round(float(out["adjusted_price"]), 2),
            }
        )
    # As POI delta increases, adjusted price should not decrease.
    assert all(a <= b for a, b in zip(poi_adjusted, poi_adjusted[1:]))

    # 4) Combined "stress" scenario bounds (keep within non-absurd range)
    stress = estimate_price_impact(
        base_price,
        Scenario(
            centre_distance_km_change=-3.0,  # much closer to centre
            transit_upgrade=True,
            transit_access_delta=1.0,
            new_poi_delta=50,
        ),
    )
    rows.append(
        {
            "case": "stress_combo",
            "centre_km_change": -3.0,
            "transit_upgrade": True,
            "transit_delta": 1.0,
            "poi_delta": 50,
            "delta_pct": round(float(stress["delta_pct"]) * 100.0, 3),
            "delta_pln": round(float(stress["delta_amount"]), 2),
            "adjusted_pln": round(float(stress["adjusted_price"]), 2),
        }
    )
    assert abs(float(stress["delta_pct"])) < 0.50  # < ±50% for these ranges

    print("\n" + _md_table(rows))
