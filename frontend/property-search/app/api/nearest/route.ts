import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const backend = process.env.BACKEND_URL || "http://localhost:8000";
  const inUrl = new URL(req.url);

  const out = new URL(`${backend}/nearest`);
  inUrl.searchParams.forEach((v, k) => out.searchParams.set(k, v));

  const res = await fetch(out.toString(), {
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
