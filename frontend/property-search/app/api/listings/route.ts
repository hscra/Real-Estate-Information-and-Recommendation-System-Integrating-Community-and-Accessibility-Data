import { NextRequest, NextResponse } from "next/server";

// export async function GET(req: NextRequest) {
//   const backend = process.env.BACKEND_URL || "http://localhost:8000";
//   const url = new URL(req.url);
//   const qs = url.search; // includes leading ?
//   const upstream = `${backend}/listings${qs}`;

//   const res = await fetch(upstream, {
//     headers: { Accept: "application/json" },
//   });
//   const text = await res.text();
//   return new NextResponse(text, {
//     status: res.status,
//     headers: {
//       "content-type": res.headers.get("content-type") || "application/json",
//     },
//   });
// }

export async function GET(req: NextRequest) {
  const backend = process.env.BACKEND_URL || "http://localhost:8000";
  const inUrl = new URL(req.url);

  const q = inUrl.searchParams;
  const north = q.get("north");
  const south = q.get("south");
  const east = q.get("east");
  const west = q.get("west");

  // Build an outgoing query with aliases to satisfy various backends
  const out = new URL(`${backend}/listings`);
  // pass through everything first
  q.forEach((v, k) => out.searchParams.set(k, v));

  if (north && south && east && west) {
    // Add aliases (harmless if backend ignores them)
    out.searchParams.set("bbox_north", north);
    out.searchParams.set("bbox_south", south);
    out.searchParams.set("bbox_east", east);
    out.searchParams.set("bbox_west", west);

    out.searchParams.set("max_lat", north);
    out.searchParams.set("min_lat", south);
    out.searchParams.set("max_lng", east);
    out.searchParams.set("min_lng", west);

    out.searchParams.set("lat_max", north);
    out.searchParams.set("lat_min", south);
    out.searchParams.set("lon_max", east);
    out.searchParams.set("lon_min", west);
  }

  // Helpful server-side logging (shows in Next server console)
  // console.log("[proxy] ->", out.toString());

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
