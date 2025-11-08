"use client";
import { useState } from "react";
import { createOpinion } from "@/lib/opinions";
import type { OpinionsResponse } from "@/lib/types";

export default function OpinionForm({
  listingId,
  onSaved,
  n = 3,
}: {
  listingId: string;
  onSaved?: (data: OpinionsResponse) => void;
  n?: number;
}) {
  const [form, setForm] = useState({
    user_name: "",
    review_text: "",
    cleanliness: 3,
    safety: 3,
    parking: 3,
    noise: 3,
    transit_access: 3,
    sunlight: 3,
    overall: 3,
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: string, v: any) => setForm((prev) => ({ ...prev, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!listingId) return;
    setSubmitting(true);
    setErr(null);
    try {
      const res = await createOpinion(
        listingId,
        { ...form, user_name: form.user_name || null },
        n
      );
      onSaved?.(res);
    } catch (e: any) {
      setErr(e?.message || "Failed to submit opinion");
    } finally {
      setSubmitting(false);
    }
  }

  const numInput = (k: keyof typeof form, label: string) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-600">{label} (1–5)</span>
      <input
        type="number"
        min={1}
        max={5}
        value={form[k] as number}
        onChange={(e) =>
          set(k, Math.max(1, Math.min(5, Number(e.target.value) || 3)))
        }
        className="border rounded px-2 py-1"
      />
    </label>
  );

  return (
    <form onSubmit={onSubmit} className="p-4 border-b space-y-3">
      <div className="text-sm font-medium">Share your experience</div>
      <input
        placeholder="Your name (optional)"
        value={form.user_name}
        onChange={(e) => set("user_name", e.target.value)}
        className="border rounded px-2 py-1 w-full"
      />
      <textarea
        placeholder="What did you think about the apartment or area?"
        value={form.review_text}
        onChange={(e) => set("review_text", e.target.value)}
        className="border rounded px-2 py-2 w-full"
        required
      />
      <div className="grid grid-cols-3 gap-2">
        {numInput("cleanliness", "Clean")}
        {numInput("safety", "Safety")}
        {numInput("parking", "Parking")}
        {numInput("noise", "Noise")}
        {numInput("transit_access", "Transit")}
        {numInput("sunlight", "Sunlight")}
        {numInput("overall", "Overall")}
      </div>
      {err && <div className="text-sm text-red-600">{err}</div>}
      <button
        disabled={submitting}
        className="bg-blue-600 text-white px-3 py-2 rounded"
      >
        {submitting ? "Submitting…" : "Post opinion"}
      </button>
    </form>
  );
}
