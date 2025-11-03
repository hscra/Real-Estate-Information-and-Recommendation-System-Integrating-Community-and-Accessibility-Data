from __future__ import annotations

"""
Rule-based estimator for hypothetical price impacts due to neighborhood
infrastructure or accessibility changes. This does not retrain or run ML
models in-process; instead it applies transparent elasticities to a chosen
base price (observed or predicted) and returns a breakdown.

All coefficients are conservative, easy to reason about, and can be tuned.
"""

from dataclasses import dataclass
from typing import Dict, Optional


@dataclass
class Scenario:
    centre_distance_km_change: float = 0.0
    transit_upgrade: bool = False
    transit_access_delta: Optional[float] = None  # ± points on 1–5 scale
    new_poi_delta: int = 0  # net change in POIs nearby
    # distance changes in meters; negative = closer, positive = farther
    # accepted keys: school, clinic, post_office, kindergarten, restaurant, college, pharmacy
    amenity_distance_changes: Optional[Dict[str, float]] = None


def estimate_price_impact(base_price: float, scenario: Scenario) -> dict:
    """Return adjusted price and breakdown based on a simple elasticity model.

    Output keys:
      - adjusted_price, delta_amount, delta_pct
      - breakdown: mapping factor -> percent contribution (± as fraction)
    """
    if base_price is None or not (isinstance(base_price, (int, float))):
        base_price = 0.0

    # Coefficients (fractions)
    COEF_CENTER_PER_KM = 0.01      # ±1.0% per km farther/closer to center
    COEF_TRANSIT_UPGRADE = 0.03    # +3% for a notable transit upgrade nearby
    COEF_TRANSIT_PER_POINT = 0.015 # ±1.5% per 1-point change on 1–5 scale
    COEF_POI_PER_UNIT = 0.0001     # +0.01% per additional POI
    COEF_AMENITY_PER_M = 1e-5      # ±0.001% per meter closer/farther (0.5% per 500m)

    delta_pct = 0.0
    breakdown: Dict[str, float] = {}

    # Center distance (negative change = closer => +pct)
    if scenario.centre_distance_km_change:
        c = -COEF_CENTER_PER_KM * float(scenario.centre_distance_km_change)
        if c:
            breakdown["centre_distance"] = c
            delta_pct += c

    # Transit changes
    if scenario.transit_upgrade:
        breakdown["transit_upgrade"] = COEF_TRANSIT_UPGRADE
        delta_pct += COEF_TRANSIT_UPGRADE

    if scenario.transit_access_delta:
        c = COEF_TRANSIT_PER_POINT * float(scenario.transit_access_delta)
        if c:
            breakdown["transit_access"] = breakdown.get("transit_access", 0.0) + c
            delta_pct += c

    # New POIs nearby
    if scenario.new_poi_delta:
        c = COEF_POI_PER_UNIT * int(scenario.new_poi_delta)
        if c:
            breakdown["poi_density"] = c
            delta_pct += c

    # Amenity distance changes (meters)
    if scenario.amenity_distance_changes:
        for key, dm in scenario.amenity_distance_changes.items():
            if dm is None:
                continue
            # negative = closer -> positive impact
            c = -COEF_AMENITY_PER_M * float(dm)
            if c:
                label = f"amenity:{key}"
                breakdown[label] = c
                delta_pct += c

    adjusted_price = float(base_price) * (1.0 + float(delta_pct))
    delta_amount = adjusted_price - float(base_price)

    return {
        "adjusted_price": adjusted_price,
        "delta_amount": delta_amount,
        "delta_pct": delta_pct,
        "breakdown": breakdown,
    }

