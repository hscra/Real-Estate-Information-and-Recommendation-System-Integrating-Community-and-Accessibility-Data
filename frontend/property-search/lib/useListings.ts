"use client";
import { useEffect, useState } from "react";
import type { Listing, ListingsResponse } from "@/lib/types";

export type Bounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

const DEFAULT_KRAKOW: Bounds = {
  south: 49.966,
  west: 19.768,
  north: 50.132,
  east: 20.165,
};

export type SearchParams = {
  city?: string;
  type?: "apartmentBuilding" | "blockOfFlats" | "tenement";
  min_m2?: number;
  max_m2?: number;
  min_price?: number;
  max_price?: number;
  rooms?: number;
  amenities?: string[];
  page?: number;
  page_size?: number;
  sort?: "price_asc" | "price_desc" | "m2_asc" | "m2_desc" | "recent";
  include_history?: boolean;

  bbox_south?: number;
  bbox_west?: number;
  bbox_north?: number;
  bbox_east?: number;

  max_school?: number;
  max_clinic?: number;
  max_post_office?: number;
  max_restaurant?: number;
  max_college?: number;
  max_pharmacy?: number;
  max_kindergarten?: number;

  color_metric?: keyof Listing;
};

export function useListings(params: SearchParams, bounds?: Bounds) {
  const [data, setData] = useState<ListingsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const b = bounds ?? DEFAULT_KRAKOW; // ensure we always have bounds
    const qs = new URLSearchParams({
      south: String(b.south),
      west: String(b.west),
      north: String(b.north),
      east: String(b.east),
      page: String(params.page ?? 1),
      page_size: String(params.page_size ?? 24),
      sort: params.sort ?? "recent",
    });
    if (params.city) qs.set("city", params.city);
    if (params.type) qs.set("type", params.type);
    if (params.min_m2) qs.set("min_m2", String(params.min_m2));
    if (params.max_m2) qs.set("max_m2", String(params.max_m2));
    if (params.min_price) qs.set("min_price", String(params.min_price));
    if (params.max_price) qs.set("max_price", String(params.max_price));
    if (params.amenities?.length)
      qs.set("amenities", params.amenities.join(","));
    // pass-through flag to request price history from backend
    if (params.include_history) qs.set("include_history", "true");
    if (params.max_school) qs.set("max_school", String(params.max_school));
    if (params.max_clinic) qs.set("max_clinic", String(params.max_clinic));
    if (params.max_post_office)
      qs.set("max_post_office", String(params.max_post_office));
    if (params.max_restaurant)
      qs.set("max_restaurant", String(params.max_restaurant));
    if (params.max_college) qs.set("max_college", String(params.max_college));
    if (params.max_pharmacy)
      qs.set("max_pharmacy", String(params.max_pharmacy));
    if (params.max_kindergarten)
      qs.set("max_kindergarten", String(params.max_kindergarten));

    setLoading(true);
    setError(null);
    fetch(`/api/listings?${qs.toString()}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          try {
            console.error("listings 422 detail:", await res.json());
          } catch {}
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json) => setData(json))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
    // include JSON-serializable deps only
  }, [JSON.stringify(params), JSON.stringify(bounds ?? DEFAULT_KRAKOW)]);

  return { data, loading, error };
}
