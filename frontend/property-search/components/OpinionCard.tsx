"use client";

import type { Opinion } from "@/lib/types";

export function OpinionCard({ op }: { op: Opinion }) {
  return (
    <div className="rounded-2xl border p-4 shadow-sm space-y-2">
      <div className="text-xs text-gray-500">Synthetic • {op.source}</div>
      <p className="text-sm leading-5">{op.review_text}</p>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <Metric label="Clean" value={op.cleanliness} />
        <Metric label="Safety" value={op.safety} />
        <Metric label="Parking" value={op.parking} />
        <Metric label="Noise" value={op.noise} />
        <Metric label="Transit" value={op.transit_access} />
        <Metric label="Sunlight" value={op.sunlight} />
      </div>

      <div className="pt-1 text-sm font-medium">Overall: {op.overall}/5</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border px-2 py-1 flex items-center justify-between">
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
