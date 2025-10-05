import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const backend = process.env.BACKEND_URL || "http://localhost:8000";
  const url = new URL(req.url);
  const qs = url.search; // includes leading ?
  const upstream = `${backend}/listings${qs}`;

  const res = await fetch(upstream, {
    headers: { Accept: "application/json" },
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") || "application/json",
    },
  });
}
