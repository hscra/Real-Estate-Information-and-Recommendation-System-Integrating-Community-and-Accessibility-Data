"""Lightweight backend unit tests.

These tests avoid touching the real database by focusing on a health check
endpoint and pure helper functions.
Run with: `pytest backend/tests` (or `python -m pytest backend/tests`).
"""

import math
from fastapi.testclient import TestClient

from backend.app import app, _deg_bbox_from_radius, _haversine_m

client = TestClient(app)


def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"ok": True}


def test_deg_bbox_from_radius_returns_reasonable_box():
    lat, lng = 50.0647, 19.9450  # Krakow reference point
    south, west, north, east = _deg_bbox_from_radius(lat, lng, 1000.0)

    expected_delta = 1000.0 / 111_320.0
    assert math.isclose(north - lat, expected_delta, rel_tol=1e-5)
    assert math.isclose(lat - south, expected_delta, rel_tol=1e-5)
    assert east > lng and west < lng


def test_haversine_distance_zero_and_nonzero():
    assert _haversine_m(0, 0, 0, 0) == 0

    # About 1 km east at the equator (degrees -> meters approximation)
    dist = _haversine_m(0, 0, 0, 0.009)
    assert 900 <= dist <= 1100
