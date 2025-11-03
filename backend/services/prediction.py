"""Lightweight loader for per-listing price predictions from main/.

This is tolerant about file formats and naming so you can drop
JSON/joblib/parquet files exported from notebooks into the main folder
without changing code.

Supported conventions (any one of these is enough):
- main/predictions.json with either:
    {"<listing_id>": {"svm": 1.0, "hgbr": 1.0, "nn": 1.0}, ...}
  or
    {"svm": {"<listing_id>": 1.0, ...}, "hgbr": {...}, "nn": {...}}
- main/predictions.joblib (same shapes as above)
- main/predicted_{svm,hgbr,nn}.{json,joblib}
- main/predictions.parquet with columns: listing_id, predicted_svm, predicted_hgbr, predicted_nn
  (also accepts id as alias for listing_id; and predicted_price_per_sqm -> svm,
   pred_price_per_sqm -> nn)
- main/predictions.csv with the same column rules as parquet

If none are found, returns an empty mapping so callers can safely proceed.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Optional

import json

try:
    import joblib  # type: ignore
except Exception:  # pragma: no cover - optional
    joblib = None  # type: ignore

try:
    import pandas as pd  # type: ignore
except Exception:  # pragma: no cover - optional
    pd = None  # type: ignore

try:
    import nbformat  # type: ignore
except Exception:  # pragma: no cover - optional
    nbformat = None  # type: ignore

def _detect_base_dir() -> Path:
    """Return the most likely path to the repo's main/ directory.

    Works whether the server starts from repo root or backend/.
    """
    here = Path(__file__).resolve()
    # candidates to probe
    candidates = [
        Path("main"),                 # CWD/main
        here.parents[2] / "main",     # <repo_root>/main assuming backend/services/
        here.parents[3] / "main" if len(here.parents) > 3 else Path("main"),
    ]
    for p in candidates:
        try:
            if p.exists():
                return p
        except Exception:
            continue
    return candidates[0]

BASE = _detect_base_dir()


def _safe_read_json(path: Path) -> Optional[dict]:
    try:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        return None
    except Exception:
        return None


def _safe_read_joblib(path: Path) -> Optional[dict]:
    if joblib is None:
        return None
    try:
        obj = joblib.load(path)
        if isinstance(obj, dict):
            return obj
        return None
    except FileNotFoundError:
        return None
    except Exception:
        return None


def _model_hint_from_name(path: Path | str | None) -> Optional[str]:
    try:
        name = str(path).lower() if path is not None else ""
    except Exception:
        name = ""
    if any(k in name for k in ("hgbr", "hist", "hgb")):
        return "hgbr"
    if "svm" in name:
        return "svm"
    if any(k in name for k in ("nn", "neural")):
        return "nn"
    return None


def _extract_from_wide_df(df, *, prefer: Optional[str] = None) -> Optional[dict]:
    """Extract mapping from a wide dataframe with tolerant column names.

    Accepted columns:
    - id or listing_id
    - predicted_svm or svm
    - predicted_hgbr or hgbr
    - predicted_nn or nn
    - predicted_price_per_sqm (treated as svm unless prefer == "hgbr" -> hgbr)
    - pred_price_per_sqm (treated as nn)
    """
    try:
        cols = {str(c).lower(): c for c in df.columns}
        id_col = cols.get("listing_id") or cols.get("id")
        # model-specific columns
        svm_col = cols.get("predicted_svm") or cols.get("svm")
        hgbr_col = cols.get("predicted_hgbr") or cols.get("hgbr")
        nn_col = cols.get("predicted_nn") or cols.get("nn")
        # tolerant aliases from notebooks
        alias_ppsqm = cols.get("predicted_price_per_sqm")
        if alias_ppsqm:
            # decide model based on preference or default to SVM
            if prefer == "hgbr" and not hgbr_col:
                hgbr_col = alias_ppsqm
            elif not svm_col:
                svm_col = alias_ppsqm
        if not nn_col:
            nn_col = cols.get("pred_price_per_sqm")  # map as NN

        if not id_col or not (svm_col or hgbr_col or nn_col):
            return None

        out: Dict[str, dict] = {}
        for _, row in df.iterrows():
            lid = str(row[id_col])
            rec: dict = {}
            if svm_col and svm_col in df.columns:
                try:
                    rec["svm"] = float(row[svm_col])
                except Exception:
                    pass
            if hgbr_col and hgbr_col in df.columns:
                try:
                    rec["hgbr"] = float(row[hgbr_col])
                except Exception:
                    pass
            if nn_col and nn_col in df.columns:
                try:
                    rec["nn"] = float(row[nn_col])
                except Exception:
                    pass
            if rec:
                out[lid] = rec
        return out if out else None
    except Exception:
        return None


def _safe_read_parquet(path: Path) -> Optional[dict]:
    if pd is None:
        return None
    try:
        if not path.exists():
            return None
        df = pd.read_parquet(path)
        hint = _model_hint_from_name(path)
        return _extract_from_wide_df(df, prefer=hint)
    except Exception:
        return None


def _safe_read_csv(path: Path) -> Optional[dict]:
    if pd is None:
        return None
    try:
        if not path.exists():
            return None
        df = pd.read_csv(path)
        hint = _model_hint_from_name(path)
        return _extract_from_wide_df(df, prefer=hint)
    except Exception:
        return None


def _normalize(obj: dict | None) -> Dict[str, dict]:
    """Return mapping listing_id -> {svm?, hgbr?, nn?} from various shapes."""
    if not obj:
        return {}

    # Shape A: {"id": {"svm": .., "hgbr": .., "nn": ..}, ...}
    if all(isinstance(v, dict) for v in obj.values()):
        out: Dict[str, dict] = {}
        for lid, rec in obj.items():
            if not isinstance(rec, dict):
                continue
            keep = {k: float(v) for k, v in rec.items() if k in ("svm", "hgbr", "nn")}
            if keep:
                out[str(lid)] = keep
        if out:
            return out

    # Shape B: {"svm": {"id": val}, "hgbr": {...}, "nn": {...}}
    if any(k in obj for k in ("svm", "hgbr", "nn")):
        out: Dict[str, dict] = {}
        for model_key in ("svm", "hgbr", "nn"):
            sub = obj.get(model_key)
            if isinstance(sub, dict):
                for lid, v in sub.items():
                    out.setdefault(str(lid), {})[model_key] = float(v)
        if out:
            return out

    return {}


def _load_all() -> Dict[str, dict]:
    # Try combined JSON/joblib
    for stem in ("predictions", "predicted", "preds"):
        js = _safe_read_json(BASE / f"{stem}.json")
        if js:
            got = _normalize(js)
            if got:
                return got
        jl = _safe_read_joblib(BASE / f"{stem}.joblib") or _safe_read_joblib(BASE / f"{stem}.pkl")
        if jl:
            got = _normalize(jl)
            if got:
                return got

    # Try per-model files
    out: Dict[str, dict] = {}
    for model_key in ("svm", "hgbr", "nn"):
        for ext in ("json", "joblib", "pkl"):
            path = BASE / f"predicted_{model_key}.{ext}"
            data = _safe_read_json(path) if ext == "json" else _safe_read_joblib(path)
            if isinstance(data, dict):
                for lid, v in data.items():
                    try:
                        out.setdefault(str(lid), {})[model_key] = float(v)
                    except Exception:
                        continue
                break

    if out:
        return out

    # Parquet/CSV wide fallbacks
    pq = _safe_read_parquet(BASE / "predictions.parquet")
    if pq:
        return pq
    cs = _safe_read_csv(BASE / "predictions.csv")
    if cs:
        return cs

    # Heuristic: scan for any CSV/Parquet in main/ that look like predictions
    # e.g., "svr_price_per_sqm_by_id.csv" from notebooks
    try:
        for p in sorted(BASE.glob("*.csv")):
            got = _safe_read_csv(p)
            if got:
                return got
        for p in sorted(BASE.glob("*.parquet")):
            got = _safe_read_parquet(p)
            if got:
                return got
    except Exception:
        pass

    # Try to parse saved outputs from notebooks in main/
    nb_found: Dict[str, dict] = {}
    if nbformat is not None:
        for nb_name in (
            "data_predication.ipynb",
            "data_prediction_NN.ipynb",
            "data_analysis_each_property.ipynb",
            "data_analysis.ipynb",
            "data.ipynb",
        ):
            nb_path = BASE / nb_name
            try:
                if not nb_path.exists():
                    continue
                nb = nbformat.read(nb_path, as_version=4)
                for cell in nb.cells:
                    if cell.get("cell_type") != "code":
                        continue
                    for out in cell.get("outputs", []) or []:
                        # Prefer application/json payloads
                        data = out.get("data") if isinstance(out, dict) else None
                        if isinstance(data, dict) and "application/json" in data:
                            got = _normalize(data["application/json"])  # type: ignore[arg-type]
                            if got:
                                nb_found.update(got)
                                break
                        # Fallback: text/plain that looks like JSON
                        txt = None
                        if isinstance(data, dict) and "text/plain" in data:
                            txt = data["text/plain"]
                        elif isinstance(out, dict) and out.get("output_type") == "stream":
                            txt = out.get("text")
                        if txt:
                            try:
                                parsed = json.loads(txt if isinstance(txt, str) else "".join(txt))
                                got = _normalize(parsed)
                                if got:
                                    nb_found.update(got)
                                    break
                            except Exception:
                                pass
                if nb_found:
                    return nb_found
            except Exception:
                # ignore notebook parse issues and continue
                continue

    return {}


# Simple in-process cache
_CACHE: Optional[Dict[str, dict]] = None


def get_predictions(listing_ids: list[str]) -> Dict[str, dict]:
    """Return predictions for the given listing_ids.

    The returned mapping may not contain all ids and may not include all
    three models per id depending on available files.
    """
    global _CACHE
    if _CACHE is None:
        _CACHE = _load_all()
    if not _CACHE:
        return {}
    return {lid: _CACHE[lid] for lid in listing_ids if lid in _CACHE}
