"use client";
import type { ListingsResponse, Listing, PricePoint } from "../lib/types";
import { usePriceHistory } from "@/lib/usePriceHistory";
import { useMemo, useRef } from "react";

function Card({
  item,
  selected,
  onClick,
}: {
  item: Listing;
  selected: boolean;
  onClick: () => void;
}) {
  // Prefer history sent with the list; if not present and selected, fetch on demand
  const embedded = item.price_history ?? [];
  const { data: fetchedHist } = usePriceHistory(
    selected ? item.listing_id : undefined
  );
  const hist: PricePoint[] =
    (embedded && embedded.length ? embedded : fetchedHist) ?? [];
  const ref = useRef<HTMLDivElement | null>(null);
  // compute price per square meter safely
  const pricePerM2 =
    item.price != null && item.square_m ? item.price / item.square_m : null;

  // Highlight is optional; avoid auto-scrolling here to prevent bouncing when map pans

  return (
    <div
      id={`card-${item.listing_id}`}
      ref={ref}
      onClick={onClick}
      className={[
        "rounded-2xl border shadow p-4 flex flex-col gap-2 bg-white cursor-pointer transition-all duration-200",
        selected
          ? "ring-2 ring-red-800 bg-red-50"
          : "hover:border-gray-400",
      ].join(" ")}
    >
      <div className="text-sm capitalize text-black">{item.city}</div>
      <div className="text-sm capitalize text-black">
        {item.type?.toUpperCase() || "—"}
      </div>
      <div className="text-sm font-bold text-blue-700">
        {item.square_m ?? "?"} m² · {item.rooms ?? "?"} rooms
      </div>
      <div className="text-xl font-bold text-gray-700">
        {item.price?.toLocaleString("pl-PL")} PLN
      </div>
      <div className="text-xl font-bold text-red-700">
        {pricePerM2 != null
          ? `(${Math.round(pricePerM2).toLocaleString("pl-PL")} PLN/m²)`
          : `(${item.price?.toLocaleString("pl-PL") ?? "?"} PLN)`}
      </div>
      {[item.predicted_svm, item.predicted_hgbr, item.predicted_nn].some(
        (v) => typeof v !== "undefined"
      ) && (
        <div className="mt-1 grid grid-cols-3 gap-1 text-[11px] text-gray-800">
          {item.predicted_svm !== undefined && (
            <span className="rounded-md border px-2 py-1 bg-blue-50 border-blue-200">
              SVM: {Math.round(item.predicted_svm).toLocaleString("pl-PL")}
            </span>
          )}
          {item.predicted_hgbr !== undefined && (
            <span className="rounded-md border px-2 py-1 bg-amber-50 border-amber-200">
              HGBR: {Math.round(item.predicted_hgbr).toLocaleString("pl-PL")}
            </span>
          )}
          {item.predicted_nn !== undefined && (
            <span className="rounded-md border px-2 py-1 bg-purple-50 border-purple-200">
              NN: {Math.round(item.predicted_nn).toLocaleString("pl-PL")}
            </span>
          )}
        </div>
      )}
      {hist.length > 0 && (
        <div className="text-xs text-gray-700">
          {(() => {
            const last = hist[hist.length - 1];
            const prev = hist.length > 1 ? hist[hist.length - 2] : null;
            const diff = prev ? last.price - prev.price : null;
            const pct = prev && prev.price ? (diff! / prev.price) * 100 : null;
            return (
              <div>
                <span className="font-medium">Last change:</span>{" "}
                {prev ? (
                  <>
                    {prev.date} → {last.date}:{" "}
                    <span
                      className={diff! >= 0 ? "text-red-600" : "text-green-600"}
                    >
                      {diff! >= 0 ? "+" : ""}
                      {Math.round(diff!).toLocaleString("pl-PL")} PLN
                      {pct !== null && ` (${pct.toFixed(1)}%)`}
                    </span>
                  </>
                ) : (
                  <>{last.date}</>
                )}
              </div>
            );
          })()}
          {/* Full price history */}
          <div className="mt-1 border-t pt-1">
            <div className="font-medium mb-1">Price history:</div>
            <ul className="space-y-0.5 max-h-32 overflow-auto pr-1">
              {hist.map((p) => (
                <li
                  key={`${p.date}-${p.price}`}
                  className="flex justify-between"
                >
                  <span>{p.date}</span>
                  <span>{Math.round(p.price).toLocaleString("pl-PL")} PLN</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <div className="text-xs text-gray-700 grid grid-cols-2 gap-y-1 mt-2">
        <div>🎒: {Math.round((item.school_distance ?? 0) * 1000)} m</div>
        <div>🚑: {Math.round((item.clinic_distance ?? 0) * 1000)} m</div>
        <div>📮: {Math.round((item.post_office_distance ?? 0) * 1000)} m</div>
        <div>👶: {Math.round((item.kindergarten_distance ?? 0) * 1000)} m</div>
        <div>🍝: {Math.round((item.restaurant_distance ?? 0) * 1000)} m</div>
        <div>🎓: {Math.round((item.college_distance ?? 0) * 1000)} m</div>
        <div>💊: {Math.round((item.pharmacy_distance ?? 0) * 1000)} m</div>
      </div>
    </div>
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
}
