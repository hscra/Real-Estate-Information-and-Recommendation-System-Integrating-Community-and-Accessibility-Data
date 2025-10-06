"use client";
import { useState } from "react";
import type { SearchParams } from "@/lib/useListings";

export function Filters({ onChange }: { onChange: (p: SearchParams) => void }) {
  const [local, setLocal] = useState<SearchParams>({
    // type: "buy",
    page: 1,
    page_size: 24,
    sort: "recent",
  });

  function set<K extends keyof SearchParams>(k: K, v: SearchParams[K]) {
    const next = { ...local, [k]: v, page: 1 };
    setLocal(next);
    onChange(next);
  }

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-6 gap-3 p-4 bg-white rounded-2xlrounded-2xl border border-gray-200 bg-white/95 backdrop-blur-sm shadow-sm p-4 md:p-5
                    dark:bg-neutral-950/80 dark:border-neutral-800 "
    >
      <input
        className="border rounded px-3 py-2"
        placeholder="City"
        onChange={(e) => set("city", e.target.value)}
      />

      <select
        className="border rounded px-3 py-2"
        onChange={(e) => set("type", e.target.value as any)}
        defaultValue=""
      >
        <option value="apartmentBuilding">apartmentBuilding</option>
        <option value="blockOfFlats">blockOfFlats</option>
        <option value="tenement">tenement</option>
        <option value="">None</option>
      </select>

      <input
        type="number"
        className="border rounded px-3 py-2"
        placeholder="Min m²"
        onChange={(e) => set("min_m2", Number(e.target.value) || undefined)}
      />
      <input
        type="number"
        className="border rounded px-3 py-2"
        placeholder="Max m²"
        onChange={(e) => set("max_m2", Number(e.target.value) || undefined)}
      />
      <input
        type="number"
        className="border rounded px-3 py-2"
        placeholder="Max price"
        onChange={(e) => set("max_price", Number(e.target.value) || undefined)}
      />

      <select
        className="border rounded px-3 py-2"
        onChange={(e) => set("sort", e.target.value as any)}
        defaultValue="recent"
      >
        <option value="recent">Recent</option>
        <option value="price_asc">Price ↑</option>
        <option value="price_desc">Price ↓</option>
        <option value="m2_asc">m² ↑</option>
        <option value="m2_desc">m² ↓</option>
      </select>

      <div className="col-span-2 md:col-span-6 flex gap-3 flex-wrap">
        {[
          ["balcony", "Balcony"],
          ["elevator", "Elevator"],
          ["parking", "Parking"],
          ["security", "Security"],
          ["storage", "Storage"],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              onChange={(e) => {
                const arr = new Set(local.amenities ?? []);
                e.target.checked ? arr.add(key) : arr.delete(key);
                set("amenities", Array.from(arr));
              }}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
