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
  { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
  const { z, x, y } = await params;
  const base = backendBase();

  const out = new URL(
    `${base}/tiles/points/${encodeURIComponent(z)}/${encodeURIComponent(x)}/${encodeURIComponent(y)}.png`
  );
  const inUrl = new URL(req.url);
  inUrl.searchParams.forEach((v, k) => out.searchParams.set(k, v));
  const res = await fetch(out.toString(), { cache: "no-store" });
  const buf = await res.arrayBuffer();

  return new NextResponse(buf, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "image/png",
      "cache-control": res.headers.get("cache-control") || "public, max-age=3600",
    },
  });
}
