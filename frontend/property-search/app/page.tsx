"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { Filters } from "../components/Filters";
import { Results } from "../components/Results";
import { useListings, type SearchParams } from "../lib/useListings";
import MapView from "@/components/MapView";
import { OpinionsPanel } from "@/components/OpinionsPanel";
import { PriceImpactPanel } from "@/components/PriceImpactPanel";
import { ListingsResponse, Listing } from "@/lib/types";

type Bounds = { south: number; west: number; north: number; east: number };

const DEFAULT_KRAKOW: Bounds = {
  south: 49.966,
  west: 19.768,
  north: 50.132,
  east: 20.165, // rough bbox
};

export default function Page() {
  const [params, setParams] = useState<SearchParams>({
    // type: undefined,
    page: 1,
    page_size: 500,
    sort: "recent",
    include_history: true,
  });
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [data_1, setData] = useState<ListingsResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectionSource, setSelectionSource] = useState<"card" | "map" | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const { data, loading, error } = useListings(params, bounds ?? undefined);
  const [items, setItems] = useState<Listing[]>([]);
  const [listingsData, setListingsData] = useState<ListingsResponse | null>(
    null
  );
  const [filters, setFilters] = useState<SearchParams>({
    page: 1,
    page_size: 24,
    sort: "recent",
  });

  function applyFilters(p: SearchParams) {
    setParams(p);
  }

  function onBoundsChanged(b: Bounds) {
    setBounds(b);
  }

  function appendFilters(qs: URLSearchParams, f: SearchParams) {
    if (f.city) qs.set("city", f.city);
    if (f.type) qs.set("type", f.type);
    if (f.min_m2) qs.set("min_m2", String(f.min_m2));
    if (f.max_m2) qs.set("max_m2", String(f.max_m2));
    if (f.max_price) qs.set("max_price", String(f.max_price));
    if (f.amenities?.length) qs.set("amenities", f.amenities.join(","));
    if (f.max_school) qs.set("max_school", String(f.max_school));
    if (f.max_clinic) qs.set("max_clinic", String(f.max_clinic));
    if (f.max_post_office) qs.set("max_post_office", String(f.max_post_office));
    if (f.max_restaurant) qs.set("max_restaurant", String(f.max_restaurant));
    if (f.max_college) qs.set("max_college", String(f.max_college));
    if (f.max_pharmacy) qs.set("max_pharmacy", String(f.max_pharmacy));
    if (f.color_metric) qs.set("color_metric", f.color_metric);
    qs.set("page", String(f.page ?? 1));
    qs.set("page_size", String(f.page_size ?? 24));
    qs.set("sort", f.sort ?? "recent");
  }

  // one AbortController shared across requests
  const abortRef = useRef<AbortController | null>(null);
  const FIRST_LOAD_LIMIT = 3000;

  // When a card is selected, scroll the map into view
  useEffect(() => {
    if (selectedId && mapRef.current) {
      mapRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedId]);

  return (
    <main className="grid grid-cols-12 gap-4">
      {/* --- LEFT SIDE --- */}
      <section className="col-span-8">
        <h1 className="text-2xl font-bold mb-4">Property Search</h1>

        <Filters onChange={(p) => setParams(p)} />
        {/* <Filters onChange={applyFilters} /> */}
        {/* Map */}

        <div ref={mapRef as any}>
          <MapView
            items={data?.items ?? []}
            // items={items}
            // onBoundsChanged={handleBoundsChange} // <-- pass the aborting fetcher
            onBoundsChanged={onBoundsChanged}
            // onSelectListing={handleSelect}
            onSelectListing={(id) => {
              setSelectedId(id);
              setSelectionSource("map");
            }}
            selectedId={selectedId}
            // defaultCenter / defaultZoom / colorMetric as you like
          />
        </div>

        {loading && <div className="mt-4">Loading…</div>}
        {error && <div className="mt-4 text-red-600">{error}</div>}

        <Results
          data={data ?? null}
          // data={listingsData}
          selectedId={selectedId}
          selectionSource={selectionSource}
          onSelect={(id) => {
            setSelectedId(id);
            setSelectionSource("card");
          }}
          onPage={(page) => setParams((prev) => ({ ...prev, page }))}
        />
      </section>

      {/* --- RIGHT SIDE: OPINIONS PANEL --- */}
      <aside className="col-span-4 border-l overflow-y-auto h-[calc(100vh-2rem)]">
        {/* Opinions for selected listing */}
        <OpinionsPanel listingId={selectedId ?? undefined} />
        {/* What-if price impact controls */}
        <PriceImpactPanel listingId={selectedId ?? undefined} />
      </aside>
    </main>
  );
}
