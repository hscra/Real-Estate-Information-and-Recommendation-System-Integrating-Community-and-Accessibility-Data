import { NextRequest, NextResponse } from "next/server";

function backendBase() {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://backend:8000"
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  const { listingId } = await params;
  const base = backendBase();
  const inUrl = new URL(req.url);

  const out = new URL(
    `${base}/listings/${encodeURIComponent(listingId)}/opinions`
  );
  inUrl.searchParams.forEach((v, k) => out.searchParams.set(k, v));

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ listingId: string }> }
) {
  const { listingId } = await params;
  const base = backendBase();
  const inUrl = new URL(req.url);

  const out = new URL(
    `${base}/listings/${encodeURIComponent(listingId)}/opinions`
  );
  inUrl.searchParams.forEach((v, k) => out.searchParams.set(k, v));

  const body = await req.text();
  const res = await fetch(out.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": req.headers.get("content-type") || "application/json",
    },
    body,
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
