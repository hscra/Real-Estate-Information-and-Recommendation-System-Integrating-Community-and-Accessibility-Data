"use client";
import type { ListingsResponse, Listing } from "../lib/types";
import { useMemo, useEffect, useRef } from "react";

function Card({
  item,
  selected,
  onClick,
}: {
  item: Listing;
  selected: boolean;
  onClick: () => void;
}) {
  const hist = item.price_history ?? [];
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selected && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
      // brief highlight pulse
      ref.current.classList.add("ring", "ring-blue-800");
      const t = setTimeout(
        () => ref.current?.classList.remove("ring", "ring-blue-500"),
        900
      );
      return () => clearTimeout(t);
    }
  }, [selected]);

  return (
    <div
      id={`card-${item.listing_id}`}
      ref={ref}
      onClick={onClick}
      className={[
        "rounded-2xl border shadow p-4 flex flex-col gap-2 bg-white cursor-pointer transition-all duration-200",
        selected
          ? "border-4 border-red-800 bg-red-50 scale-[1.02]"
          : "hover:border-gray-400",
      ].join(" ")}
    >
      <div className="text-lg font-semibold capitalize text-gray-700">
        {item.city} · {item.type?.toUpperCase() || "—"}
      </div>
      <div className="text-sm text-gray-700">
        {item.square_m ?? "?"} m² · {item.rooms ?? "?"} rooms
      </div>
      <div className="text-xl font-bold text-gray-700">
        {item.price?.toLocaleString("pl-PL")} PLN
      </div>
      {/* … your price history block … */}
    </div>
    // <div className="rounded-2xl border shadow p-4 flex flex-col gap-3 bg-white text-gray-900">
    //   {/* Header */}
    //   <div className="text-lg font-semibold capitalize">
    //     {item.city} · {item.type?.toUpperCase() || "—"}
    //   </div>

    //   {/* Basic info */}
    //   <div className="text-sm text-gray-700">
    //     {item.square_m ?? "?"} m² · {item.rooms ?? "?"} rooms
    //   </div>

    //   {/* Current price */}
    //   <div className="text-xl font-bold">
    //     Current: {item.price?.toLocaleString("pl-PL")} PLN
    //   </div>

    //   {/* 🧾 Full price history */}
    //   {hist.length > 0 && (
    //     <div className="text-xs text-gray-700 border-t pt-2">
    //       <span className="font-medium text-gray-800">Price history:</span>
    //       <ul className="list-disc ml-4 mt-1 space-y-0.5">
    //         {hist.map((p, idx) => (
    //           <li key={idx}>
    //             <span className="text-gray-600">{p.date}:</span>{" "}
    //             <span className="font-semibold">
    //               {p.price.toLocaleString("pl-PL")} PLN
    //             </span>
    //           </li>
    //         ))}
    //       </ul>
    //     </div>
    //   )}
    // </div>
    // <div className="rounded-2xl border shadow p-4 flex flex-col gap-2 bg-white text-gray-900">
    //   <div className="text-lg font-semibold">
    //     {item.city} · {item.type?.toUpperCase()}
    //   </div>
    //   <div className="text-sm">
    //     {item.square_m ?? "?"} m² · {item.rooms ?? "?"} rooms
    //   </div>
    //   <div className="text-xl font-bold">
    //     {item.price?.toLocaleString()} PLN
    //   </div>
    //   <div className="text-xs text-gray-500">
    //     Floor {item.floor}/{item.floor_count} · Built {item.build_year}
    //   </div>
    //   <div className="text-xs">
    //     Amenities:{" "}
    //     {[
    //       item.has_balcony && "Balcony",
    //       item.has_elevator && "Elevator",
    //       item.has_parking_space && "Parking",
    //       item.has_security && "Security",
    //       item.has_storage_room && "Storage",
    //     ]
    //       .filter(Boolean)
    //       .join(", ") || "—"}
    //   </div>
    //   {diff !== null && (
    //     <div
    //       className={
    //         diff >= 0
    //           ? "text-red-600 font-medium"
    //           : "text-green-600 font-medium"
    //       }
    //     >
    //       {diff > 0 ? "+" : ""}
    //       {diff.toLocaleString("pl-PL")} PLN
    //       {pct !== null && ` (${pct.toFixed(1)}%)`}
    //     </div>
    //   )}

    //   {hist.length > 1 && (
    //     <div className="text-xs text-gray-600">
    //       {hist.length} price points · {hist[0].date} → {hist.at(-1)!.date}
    //     </div>
    //   )}
    // </div>
  );
}

export function Results({
  data,
  onPage,
  selectedId,
  onSelect,
}: {
  data: ListingsResponse | null;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onPage: (p: number) => void;
}) {
  const uniqueItems = useMemo(() => {
    if (!data) return [];
    // keep the last occurrence per listing_id
    return Array.from(
      new Map(data.items.map((i) => [i.listing_id, i])).values()
    );
  }, [data]);

  if (!data) return null;

  return (
    <div className="mt-4">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {uniqueItems.map((i) => (
          <Card
            key={i.listing_id}
            item={i}
            selected={i.listing_id === selectedId}
            onClick={() => onSelect?.(i.listing_id)}
          />
        ))}
      </div>
      <div className="flex justify-between items-center mt-4">
        <span className="text-sm text-gray-600">
          Total {data.total.toLocaleString()} results
        </span>
        <div className="inline-flex gap-2">
          <button
            className="px-4 py-2 border rounded"
            disabled={data.page <= 1}
            onClick={() => onPage(data.page - 1)}
          >
            Prev
          </button>
          <button
            className="px-4 py-2 border rounded"
            disabled={data.page * data.page_size >= data.total}
            onClick={() => onPage(data.page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );

  // return (
  //   <div className="mt-4">
  //     <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
  //       {data.items.map((i) => (
  //         <Card key={i.listing_id} item={i} />
  //       ))}
  //     </div>
  //     <div className="flex justify-between items-center mt-4">
  //       <span className="text-sm text-gray-600">
  //         Total {data.total.toLocaleString()} results
  //       </span>
  //       <div className="inline-flex gap-2">
  //         <button
  //           className="px-4 py-2 border rounded"
  //           disabled={data.page <= 1}
  //           onClick={() => onPage(data.page - 1)}
  //         >
  //           Prev
  //         </button>
  //         <button
  //           className="px-4 py-2 border rounded"
  //           disabled={data.page * data.page_size >= data.total}
  //           onClick={() => onPage(data.page + 1)}
  //         >
  //           Next
  //         </button>
  //       </div>
  //     </div>
  //   </div>
  // );
}
