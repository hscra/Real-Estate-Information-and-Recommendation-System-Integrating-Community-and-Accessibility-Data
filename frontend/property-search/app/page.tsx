"use client";
import { useState } from "react";
import { Filters } from "../components/Filters";
import { Results } from "../components/Results";
import { useListings, type SearchParams } from "../lib/useListings";
import MapView from "@/components/MapView";

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

  return (
    <main>
      <h1 className="text-2xl font-bold mb-4">Property Search</h1>
      <Filters onChange={(p) => setParams(p)} />
      {/* Map (sync bounds to API) */}
      <MapView
        items={data?.items ?? []}
        onSelectListing={(id) => setSelectedId(id)}
        onBoundsChanged={(b) => {
          // Attach bounds to params so backend can filter by viewport
          setParams((prev) => ({
            ...prev,
            bbox_south: b.south,
            bbox_west: b.west,
            bbox_north: b.north,
            bbox_east: b.east,
            page: 1,
          }));
        }}
        // onSelectListing={(id) => {
        //   // Optional: scroll to that card or open details modal
        //   const el = document.getElementById(`card-${id}`);
        //   el?.scrollIntoView({ behavior: "smooth", block: "center" });
        //   el?.classList.add("ring", "ring-blue-500");
        //   setTimeout(() => el?.classList.remove("ring", "ring-blue-500"), 1200);
        // }}
      />
      {loading && <div className="mt-4">Loading…</div>}
      {error && <div className="mt-4 text-red-600">{error}</div>}
      <Results
        data={data}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onPage={(page) => setParams((prev) => ({ ...prev, page }))}
      />
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
