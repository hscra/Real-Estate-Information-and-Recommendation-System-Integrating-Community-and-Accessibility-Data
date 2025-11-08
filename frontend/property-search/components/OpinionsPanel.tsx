"use client";

import { useEffect, useState } from "react";
import { useOpinions } from "@/lib/useOpinions";
import { OpinionCard } from "./OpinionCard";
import OpinionForm from "./OpinionForm";

export function OpinionsPanel({ listingId }: { listingId?: string }) {
  const n = 3;
  const { data, loading, err } = useOpinions(listingId, n);
  const [local, setLocal] = useState(data);

  useEffect(() => setLocal(data), [data]);

  if (!listingId) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Select a property to see opinions.
      </div>
    );
  }

  return (
    <div>
      <OpinionForm listingId={listingId} n={n} onSaved={(d) => setLocal(d)} />

      {loading && <div className="p-4">Loading opinions…</div>}
      {err && <div className="p-4 text-red-600">Failed to load opinions.</div>}
      {!loading && !err && (!local || !local.opinions?.length) && (
        <div className="p-4">No opinions yet. Be the first to share.</div>
      )}

      <div className="p-4 space-y-3">
        {(local?.opinions ?? []).map((op) => (
          <OpinionCard key={op.opinion_id} op={op} />
        ))}
      </div>
    </div>
  );
}

// "use client";

// import { useOpinions } from "@/lib/useOpinions";
// import { OpinionCard } from "./OpinionCard";
// import OpinionForm from "./OpinionForm";
// import { useState, useEffect } from "react";

// export function OpinionsPanel({ listingId }: { listingId?: string }) {
//   const { data, loading, err } = useOpinions(listingId, 3);

//   if (!listingId) {
//     return (
//       <div className="p-4 text-sm text-gray-500">
//         Select a property to see opinions.
//       </div>
//     );
//   }
//   if (loading) return <div className="p-4">Loading opinions…</div>;
//   if (err)
//     return <div className="p-4 text-red-600">Failed to load opinions.</div>;
//   if (!data || !data.opinions?.length)
//     return <div className="p-4">No opinions yet.</div>;

//   return (
//     <div className="p-4 space-y-3">
//       {data.opinions.map((op) => (
//         <OpinionCard key={op.opinion_id} op={op} />
//       ))}
//     </div>
//   );
// }
