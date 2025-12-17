"use client";
import { useEffect, useState } from "react";
import type { PricePoint } from "@/lib/types";

export function usePriceHistory(listingId?: string) {
  const [data, setData] = useState<PricePoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!listingId) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    fetch(`/api/listings/${encodeURIComponent(listingId)}/history`, {
      cache: "no-store",
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json?.history ?? []);
      })
      .catch((e) => {
        if (!cancelled && e.name !== "AbortError") setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [listingId]);

  return { data, loading, error };
}
