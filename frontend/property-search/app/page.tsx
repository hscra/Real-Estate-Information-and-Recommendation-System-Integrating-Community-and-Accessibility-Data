"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { Filters } from "../components/Filters";
import { Results } from "../components/Results";
import { useListings, type SearchParams } from "../lib/useListings";
import MapView from "@/components/MapView";
import { OpinionsPanel } from "@/components/OpinionsPanel";
import { ListingsResponse, Listing } from "@/lib/types";

type Bounds = { south: number; west: number; north: number; east: number };

export default function Page() {
  const [params, setParams] = useState<SearchParams>({
    // type: undefined,
    page: 1,
    page_size: 24,
    sort: "recent",
    include_history: true,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, loading, error } = useListings(params);
  const [items, setItems] = useState<Listing[]>([]);
  const [listingsData, setListingsData] = useState<ListingsResponse | null>(
    null
  );
  const [filters, setFilters] = useState<SearchParams>({
    page: 1,
    page_size: 24,
    sort: "recent",
  });
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [data_1, setData] = useState<ListingsResponse | null>(null);

  function applyFilters(p: SearchParams) {
    setFilters(p);
    if (bounds) fetchListings(bounds, p); // re-fetch map+cards with filters
  }

  function onBoundsChanged(b: Bounds) {
    setBounds(b);
    fetchListings(b, filters); // same params for map & cards
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

  async function fetchListings(b: Bounds, f: SearchParams) {
    const qs = new URLSearchParams({
      north: String(b.north),
      south: String(b.south),
      east: String(b.east),
      west: String(b.west),
      limit: "10000",
    });
    appendFilters(qs, f);
    const res = await fetch(`/api/listings?${qs.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const json = await res.json();
    setData(json); // <-- single source of truth
  }

  const handleBoundsChange = useCallback(async (b: any) => {
    const qs = new URLSearchParams({
      south: String(b.south),
      west: String(b.west),
      north: String(b.north),
      east: String(b.east),
      limit: "10000",
    });

    const res = await fetch(`/api/listings?${qs}`);
    if (!res.ok) return;
    const json = await res.json();
    setListingsData(json);
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);
  // one AbortController shared across requests
  const abortRef = useRef<AbortController | null>(null);
  const FIRST_LOAD_LIMIT = 3000;

  const fetchByBounds = useCallback(async (b?: Bounds | null) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const url = !b
        ? `/api/listings?limit=${FIRST_LOAD_LIMIT}` // nationwide preview
        : `/api/listings?` +
          new URLSearchParams({
            north: String(b.north),
            south: String(b.south),
            east: String(b.east),
            west: String(b.west),
            limit: "10000", // return all in bbox (or a high cap)
          }).toString();

      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const data: Listing[] = Array.isArray(json) ? json : json.items ?? [];
      setItems(data);
      // const qs = new URLSearchParams({
      //   south: String(b.south),
      //   west: String(b.west),
      //   north: String(b.north),
      //   east: String(b.east),
      //   limit: "10000",
      //   // include any other filters you use (rooms, price, etc.)
      // });

      // const res = await fetch(`/api/listings?${qs.toString()}`, {
      //   signal: ctrl.signal,
      //   cache: "no-store", // avoids Next fetch cache surprises
      // });
      // if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // const json = await res.json();
      // const data: Listing[] = json.items ?? [];
      // setItems(data); // only runs if not aborted
    } catch (err: any) {
      if (err?.name === "AbortError") return; // stale request — ignore
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchByBounds(null); // first load → nationwide preview
  }, [fetchByBounds]);

  return (
    <main className="grid grid-cols-12 gap-4">
      {/* --- LEFT SIDE --- */}
      <section className="col-span-8">
        <h1 className="text-2xl font-bold mb-4">Property Search</h1>

        {/* <Filters onChange={(p) => setParams(p)} /> */}
        <Filters onChange={applyFilters} />
        {/* Map */}

        <MapView
          items={listingsData?.items ?? []}
          // items={items}
          // onBoundsChanged={handleBoundsChange} // <-- pass the aborting fetcher
          onBoundsChanged={onBoundsChanged}
          onSelectListing={handleSelect}
          // onSelectListing={(id) => setSelectedId(id)}
          // defaultCenter / defaultZoom / colorMetric as you like
        />

        {loading && <div className="mt-4">Loading…</div>}
        {error && <div className="mt-4 text-red-600">{error}</div>}

        <Results
          data={data_1}
          // data={listingsData}
          selectedId={selectedId}
          onSelect={handleSelect}
          onPage={(page) => setParams((prev) => ({ ...prev, page }))}
        />
      </section>

      {/* --- RIGHT SIDE: OPINIONS PANEL --- */}
      <aside className="col-span-4 border-l overflow-y-auto h-[calc(100vh-2rem)]">
        {/* Pass the selected listing ID */}
        <OpinionsPanel listingId={selectedId ?? undefined} />
      </aside>
    </main>
  );
}

// import Image from "next/image";

// export default function Home() {
//   return (
//     <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
//       <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
//         <Image
//           className="dark:invert"
//           src="/next.svg"
//           alt="Next.js logo"
//           width={180}
//           height={38}
//           priority
//         />
//         <ol className="font-mono list-inside list-decimal text-sm/6 text-center sm:text-left">
//           <li className="mb-2 tracking-[-.01em]">
//             Get started by editing{" "}
//             <code className="bg-black/[.05] dark:bg-white/[.06] font-mono font-semibold px-1 py-0.5 rounded">
//               app/page.tsx
//             </code>
//             .
//           </li>
//           <li className="tracking-[-.01em]">
//             Save and see your changes instantly.
//           </li>
//         </ol>

//         <div className="flex gap-4 items-center flex-col sm:flex-row">
//           <a
//             className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
//             href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//             target="_blank"
//             rel="noopener noreferrer"
//           >
//             <Image
//               className="dark:invert"
//               src="/vercel.svg"
//               alt="Vercel logomark"
//               width={20}
//               height={20}
//             />
//             Deploy now
//           </a>
//           <a
//             className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto md:w-[158px]"
//             href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//             target="_blank"
//             rel="noopener noreferrer"
//           >
//             Read our docs
//           </a>
//         </div>
//       </main>
//       <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
//         <a
//           className="flex items-center gap-2 hover:underline hover:underline-offset-4"
//           href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//           target="_blank"
//           rel="noopener noreferrer"
//         >
//           <Image
//             aria-hidden
//             src="/file.svg"
//             alt="File icon"
//             width={16}
//             height={16}
//           />
//           Learn
//         </a>
//         <a
//           className="flex items-center gap-2 hover:underline hover:underline-offset-4"
//           href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//           target="_blank"
//           rel="noopener noreferrer"
//         >
//           <Image
//             aria-hidden
//             src="/window.svg"
//             alt="Window icon"
//             width={16}
//             height={16}
//           />
//           Examples
//         </a>
//         <a
//           className="flex items-center gap-2 hover:underline hover:underline-offset-4"
//           href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//           target="_blank"
//           rel="noopener noreferrer"
//         >
//           <Image
//             aria-hidden
//             src="/globe.svg"
//             alt="Globe icon"
//             width={16}
//             height={16}
//           />
//           Go to nextjs.org →
//         </a>
//       </footer>
//     </div>
//   );
// }
