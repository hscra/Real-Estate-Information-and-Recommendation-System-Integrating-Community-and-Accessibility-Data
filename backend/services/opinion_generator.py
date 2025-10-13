import numpy as np
import pandas as pd
from numpy.random import default_rng

def _clip_round(x, lo=1, hi=5): return int(max(lo, min(hi, round(x))))
def _zscore(s: pd.Series):
    s = s.astype(float)
    m, sd = s.mean(), s.std(ddof=0)
    return (s - m) / (sd if sd > 1e-9 else 1.0)

def synthesize_opinions(df_listings: pd.DataFrame, n_per_listing: int = 3, seed: int = 42) -> pd.DataFrame:
    rng = default_rng(seed)
    df = df_listings.copy()

    for col, default in [
        ('build_year', 1995),
        ('centre_distance', df_listings.get('centre_distance', pd.Series([2.5])).fillna(2.5).mean()),
        ('poi_count', df_listings.get('poi_count', pd.Series([10])).fillna(10).mean()),
        ('has_parking_space', False),
        ('has_elevator', False),
        ('has_security', False),
        ('floor', 1),
        ('floor_count', df_listings.get('floor_count', pd.Series([5])).fillna(5).mean()),
    ]:
        if col not in df.columns:
            df[col] = default
        df[col] = df[col].fillna(default)

    z_build = _zscore(df['build_year'])
    z_poi   = _zscore(df['poi_count'])
    z_center= -_zscore(df['centre_distance'])

    base_cleanliness = 3.2 + 0.5 * z_build
    base_safety      = 3.0 + 0.3 * z_build + 0.4 * df['has_security'].astype(int)
    base_parking     = 2.6 + 1.4 * df['has_parking_space'].astype(int)
    base_noise       = 3.2 + 0.6 * z_poi - 0.4 * z_center
    base_transit     = 2.8 + 0.8 * z_center + 0.3 * z_poi
    base_sunlight    = 2.9 + 0.5 * (df['floor'] / (df['floor_count'].replace(0,1))) + 0.2 * df['has_elevator'].astype(int)

    def jitter(): return rng.normal(0, 0.6)

    def pick_phrase(score, low, mid, high):
        return low if score <= 2 else (mid if score == 3 else high)

    rows = []
    for idx, row in df.iterrows():
        for j in range(n_per_listing):
            cl = _clip_round(base_cleanliness.loc[idx] + jitter())
            sa = _clip_round(base_safety.loc[idx]      + jitter())
            pk = _clip_round(base_parking.loc[idx]     + jitter())
            nz = _clip_round(base_noise.loc[idx]       + jitter())
            tr = _clip_round(base_transit.loc[idx]     + jitter())
            su = _clip_round(base_sunlight.loc[idx]    + jitter())
            overall = _clip_round(0.2*cl + 0.2*sa + 0.2*pk + 0.15*(6-nz) + 0.15*tr + 0.1*su + np.random.normal(0,0.4))

            parts = [
                pick_phrase(cl, "Needed better cleaning", "Fairly clean overall", "Spotlessly clean"),
                pick_phrase(sa, "Area felt a bit sketchy", "Felt safe most of the time", "Very safe and calm"),
                pick_phrase(pk, "Parking was a headache", "Parking was manageable", "Lots of parking available"),
                "Not too noisy" if nz >= 4 else ("Noise ok" if nz == 3 else "A bit noisy"),
                pick_phrase(tr, "Hard to reach without a car", "Decent public transport", "Excellent public transport"),
                pick_phrase(su, "A bit dark inside", "Gets decent daylight", "Bright with great natural light"),
                pick_phrase(overall, "Mixed feelings overall", "Solid overall experience", "Would gladly recommend")
            ]
            np.random.shuffle(parts)
            text = " ".join(parts) + "."

            rows.append({
                'listing_id': row['listing_id'],
                'opinion_id': f"{row['listing_id']}-{j+1}",
                'cleanliness': cl, 'safety': sa, 'parking': pk, 'noise': nz,
                'transit_access': tr, 'sunlight': su, 'overall': overall,
                'text': text, 'source': 'synthetic_v1'
            })
    return pd.DataFrame(rows)
