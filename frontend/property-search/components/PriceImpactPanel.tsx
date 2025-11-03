"use client";

import { useMemo, useState } from "react";
import type {
  PriceImpactRequest,
  PriceImpactResponse,
} from "@/lib/types";

const defaultScenario: PriceImpactRequest = {
  centre_distance_km_change: 0,
  transit_upgrade: false,
  transit_access_delta: 0,
  new_poi_delta: 0,
  amenity_distance_changes: { school: 0, pharmacy: 0 },
};

export function PriceImpactPanel({ listingId }: { listingId?: string }) {
  const [scenario, setScenario] = useState<PriceImpactRequest>(defaultScenario);
  const [result, setResult] = useState<PriceImpactResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const backend =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  const pct = useMemo(() => {
    if (!result) return null;
    return (result.delta_pct * 100).toFixed(2);
  }, [result]);

  async function run() {
    if (!listingId) return;
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch(
        `${backend}/listings/${encodeURIComponent(listingId)}/price-impact`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(scenario),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as PriceImpactResponse;
      setResult(data);
    } catch (e: any) {
      setErr(e?.message || "Failed to compute price impact");
    } finally {
      setLoading(false);
    }
  }

  if (!listingId) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Select a property to run what‑if price impact.
      </div>
    );
  }

  return (
    <div className="p-4 border-t">
      <h3 className="text-lg font-semibold mb-2">What‑If Price Impact</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Labeled label="Δ center distance (km)">
          <input
            type="number"
            step={0.1}
            className="border rounded px-2 py-1 w-full"
            value={scenario.centre_distance_km_change ?? 0}
            onChange={(e) =>
              setScenario((s) => ({
                ...s,
                centre_distance_km_change: Number(e.target.value || 0),
              }))
            }
          />
        </Labeled>
        <Labeled label="Transit upgrade">
          <input
            type="checkbox"
            checked={!!scenario.transit_upgrade}
            onChange={(e) =>
              setScenario((s) => ({ ...s, transit_upgrade: e.target.checked }))
            }
          />
        </Labeled>
        <Labeled label="Δ transit score (± points)">
          <input
            type="number"
            step={0.5}
            className="border rounded px-2 py-1 w-full"
            value={scenario.transit_access_delta ?? 0}
            onChange={(e) =>
              setScenario((s) => ({
                ...s,
                transit_access_delta: Number(e.target.value || 0),
              }))
            }
          />
        </Labeled>
        <Labeled label="Δ nearby POIs (count)">
          <input
            type="number"
            step={1}
            className="border rounded px-2 py-1 w-full"
            value={scenario.new_poi_delta ?? 0}
            onChange={(e) =>
              setScenario((s) => ({
                ...s,
                new_poi_delta: Number(e.target.value || 0),
              }))
            }
          />
        </Labeled>
      </div>

      <div className="mt-3">
        <div className="grid grid-cols-3 gap-2">
          {[
            ["school", "School Δm"],
            ["pharmacy", "Pharmacy Δm"],
            ["restaurant", "Restaurant Δm"],
          ].map(([k, label]) => (
            <Labeled key={k} label={label}>
              <input
                type="number"
                className="border rounded px-2 py-1 w-full"
                value={scenario.amenity_distance_changes?.[k] ?? 0}
                onChange={(e) =>
                  setScenario((s) => ({
                    ...s,
                    amenity_distance_changes: {
                      ...(s.amenity_distance_changes || {}),
                      [k]: Number(e.target.value || 0),
                    },
                  }))
                }
              />
            </Labeled>
          ))}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          className="px-4 py-2 rounded border bg-blue-600 text-white disabled:opacity-60"
          disabled={loading}
          onClick={run}
        >
          {loading ? "Computing…" : "Estimate Impact"}
        </button>
        <button
          className="px-3 py-2 rounded border"
          onClick={() => {
            setScenario(defaultScenario);
            setResult(null);
            setErr(null);
          }}
        >
          Reset
        </button>
      </div>

      {err && <div className="mt-2 text-sm text-red-600">{err}</div>}

      {result && (
        <div className="mt-3 rounded-xl border p-3 bg-white">
          <div className="text-sm text-gray-700">
            Base: <b>{Math.round(result.base_price).toLocaleString("pl-PL")}</b> PLN
          </div>
          <div className="text-sm text-gray-700">
            Adjusted: <b>{Math.round(result.adjusted_price).toLocaleString("pl-PL")}</b> PLN
          </div>
          <div className="text-sm">
            Change: <b>{Math.round(result.delta_amount).toLocaleString("pl-PL")}</b> PLN ({pct}%)
          </div>
          <div className="mt-2 text-xs text-gray-600">
            Used {result.used_prediction ? "prediction" : "listing price"} as base
          </div>
          {result.breakdown && Object.keys(result.breakdown).length > 0 && (
            <div className="mt-2">
              <div className="font-medium text-sm">Breakdown</div>
              <ul className="mt-1 text-sm space-y-1">
                {Object.entries(result.breakdown).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span className="text-gray-700">{k}</span>
                    <span className={v >= 0 ? "text-green-700" : "text-red-700"}>
                      {(v * 100).toFixed(2)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-600">{label}</span>
      {children}
    </label>
  );
}

