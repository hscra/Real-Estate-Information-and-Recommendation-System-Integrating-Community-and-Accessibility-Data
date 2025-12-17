import { NextRequest, NextResponse } from "next/server";

function backendBase() {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://backend:8000"
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  const { listingId } = await params;
  const base = backendBase();

  const out = new URL(`${base}/listings/${encodeURIComponent(listingId)}/history`);
  const res = await fetch(out.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
    },
  });
}
