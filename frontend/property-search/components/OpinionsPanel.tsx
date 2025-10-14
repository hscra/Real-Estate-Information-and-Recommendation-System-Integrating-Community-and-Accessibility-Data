"use client";

import { useOpinions } from "@/lib/useOpinions";
import { OpinionCard } from "./OpinionCard";

export function OpinionsPanel({ listingId }: { listingId?: string }) {
  const { data, loading, err } = useOpinions(listingId, 3);

  if (!listingId) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Select a property to see opinions.
      </div>
    );
  }
  if (loading) return <div className="p-4">Loading opinions…</div>;
  if (err)
    return <div className="p-4 text-red-600">Failed to load opinions.</div>;
  if (!data || !data.opinions?.length)
    return <div className="p-4">No opinions yet.</div>;

  return (
    <div className="p-4 space-y-3">
      {data.opinions.map((op) => (
        <OpinionCard key={op.opinion_id} op={op} />
      ))}
    </div>
  );
}
