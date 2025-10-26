"use client";
import { useState } from "react";
import type { SearchParams } from "@/lib/useListings";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
        {label}
      </span>
      {children}
    </label>
  );
}

const baseInput =
  "h-11 w-full rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 " +
  "dark:bg-neutral-900 dark:text-gray-100 dark:border-neutral-700 dark:placeholder-gray-400 " +
  "dark:focus:ring-blue-400 dark:focus:border-blue-400";

export function Filters({ onChange }: { onChange: (p: SearchParams) => void }) {
  const [local, setLocal] = useState<SearchParams>({
    page: 1,
    page_size: 24,
    sort: "recent",
  });

  function set<K extends keyof SearchParams>(k: K, v: SearchParams[K]) {
    const next = { ...local, [k]: v, page: 1 };
    setLocal(next);
    onChange(next);
  }

  const TYPE_OPTIONS = [
    { value: "", label: "All types" },
    { value: "apartmentBuilding", label: "Apartment building" },
    { value: "blockOfFlats", label: "Block of flats" },
    { value: "tenement", label: "Tenement" },
  ];

  // helpers: parse numbers, enforce ≥1, allow empty → undefined
  const parseGe1 = (v: string) => {
    if (v.trim() === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 ? n : undefined;
  };

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-6 gap-3 p-4 rounded-2xl border border-gray-200 bg-white/95 backdrop-blur-sm shadow-sm
                 dark:bg-neutral-950/80 dark:border-neutral-800"
    >
      {/* City */}
      {/* <input
        className="border rounded px-3 py-2"
        placeholder="City"
        value={(local.city as string) ?? ""}
        onChange={(e) => set("city", e.target.value || undefined)}
      /> */}

      {/* Property type */}
      <Field label="Property type">
        <select
          className="border rounded px-3 py-2 w-full"
          value={(local.type as string) ?? ""}
          onChange={(e) => set("type", e.target.value || undefined)}
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      {/* Min m² (≥1) */}
      <Field label="Min area (m²)">
        <input
          type="number"
          className="border rounded px-3 py-2"
          inputMode="numeric"
          min={1}
          step={1}
          placeholder="Min m²"
          value={local.min_m2 ?? ""}
          onChange={(e) => set("min_m2", parseGe1(e.target.value))}
          onBlur={(e) => {
            if (parseGe1(e.target.value) === undefined)
              e.currentTarget.value = "";
          }}
        />
      </Field>

      {/* Max m² (≥1) */}
      <Field label="Max area (m²)">
        <input
          type="number"
          className="border rounded px-3 py-2"
          inputMode="numeric"
          min={1}
          step={1}
          placeholder="Max m²"
          value={local.max_m2 ?? ""}
          onChange={(e) => set("max_m2", parseGe1(e.target.value))}
          onBlur={(e) => {
            if (parseGe1(e.target.value) === undefined)
              e.currentTarget.value = "";
          }}
        />
      </Field>

      {/* Max price */}
      <Field label="Max price (PLN)">
        <input
          type="number"
          className="border rounded px-3 py-2"
          inputMode="numeric"
          min={1}
          step={1000}
          placeholder="Max price"
          value={local.max_price ?? ""}
          onChange={(e) => set("max_price", parseGe1(e.target.value))}
          onBlur={(e) => {
            if (parseGe1(e.target.value) === undefined)
              e.currentTarget.value = "";
          }}
        />
      </Field>

      {/* Sort */}
      {/* <Field label="Sort by">
        <select
          className="border rounded px-3 py-2"
          value={(local.sort as string) ?? "recent"}
          onChange={(e) => set("sort", e.target.value as any)}
        >
          <option value="recent">Recent</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
          <option value="m2_asc">m² ↑</option>
          <option value="m2_desc">m² ↓</option>
        </select>
      </Field> */}

      {/* Amenities */}
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
              checked={(local.amenities ?? []).includes(key)}
              onChange={(e) => {
                const setA = new Set(local.amenities ?? []);
                e.target.checked ? setA.add(key) : setA.delete(key);
                set("amenities", Array.from(setA));
              }}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      {/* Distances (m) */}
      {/* Distances (m) */}
      <div className="col-span-2 md:col-span-6">
        <Field label="Max distance to… (meters)">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(
              [
                ["max_school", "School"],
                ["max_clinic", "Clinic"],
                ["max_post_office", "Post office"],
                ["max_restaurant", "Restaurant"],
                ["max_college", "College"],
                ["max_pharmacy", "Pharmacy"],
              ] as const
            ).map(([k, ph]) => (
              <input
                key={k}
                type="number"
                inputMode="numeric"
                min={1}
                step={10}
                placeholder={ph}
                value={(local[k] as number | undefined) ?? ""}
                onChange={(e) => set(k, parseGe1(e.target.value) as any)}
                onBlur={(e) => {
                  if (parseGe1(e.target.value) === undefined)
                    e.currentTarget.value = "";
                }}
                className={
                  // remove the baseInput height so our size wins
                  baseInput.replace("h-11", "") +
                  " h-12 text-base text-center font-medium rounded-lg shadow-sm w-full"
                }
              />
            ))}
          </div>
        </Field>
      </div>

      {/* Color metric */}
      <Field label="Color markers by">
        <select
          className={baseInput}
          value={(local.color_metric as string) ?? "school_distance"}
          onChange={(e) => set("color_metric", e.target.value as any)}
        >
          <option value="school_distance">School distance</option>
          <option value="clinic_distance">Clinic distance</option>
          <option value="post_office_distance">Post office distance</option>
          <option value="restaurant_distance">Restaurant distance</option>
          <option value="college_distance">College distance</option>
          <option value="pharmacy_distance">Pharmacy distance</option>
        </select>
      </Field>
    </div>
  );
}
