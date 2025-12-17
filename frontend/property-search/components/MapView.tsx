"use client";

import { useEffect, useMemo, useRef, useCallback } from "react";
import { GoogleMap, useLoadScript } from "@react-google-maps/api";
import type { Listing } from "@/lib/types";
import type { SearchParams } from "@/lib/useListings";

type Bounds = { south: number; west: number; north: number; east: number };

export default function MapView({
  items,
  onBoundsChanged,
  onSelectListing,
  defaultCenter = { lat: 50.0647, lng: 19.945 }, // Kraków
  defaultZoom = 12,
  selectedId,
  tileFilters,
}: {
  items: Listing[];
  onBoundsChanged?: (b: Bounds) => void;
  onSelectListing?: (id: string) => void;
  defaultCenter?: { lat: number; lng: number };
  selectedId?: string | null;
  defaultZoom?: number;
  tileFilters?: SearchParams;
  colorMetric?:
    | "centre_distance"
    | "poi_count"
    | "school_distance"
    | "clinic_distance"
    | "restaurant_distance";
}) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const selectedCircleRef = useRef<google.maps.Circle | null>(null);
  const prevSelectedIdRef = useRef<string | null>(null);
  const lastSelectedPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const pointsOverlayRef = useRef<google.maps.ImageMapType | null>(null);

  const tileQuery = useMemo(() => {
    const p = tileFilters;
    const qs = new URLSearchParams();
    if (!p) return "";
    if (p.city) qs.set("city", p.city);
    if (p.type) qs.set("type", p.type);
    if (p.min_m2 != null) qs.set("min_m2", String(p.min_m2));
    if (p.max_m2 != null) qs.set("max_m2", String(p.max_m2));
    if (p.min_price != null) qs.set("min_price", String(p.min_price));
    if (p.max_price != null) qs.set("max_price", String(p.max_price));
    if (p.rooms != null) qs.set("rooms", String(p.rooms));
    if (p.amenities?.length) qs.set("amenities", p.amenities.join(","));
    if (p.max_school != null) qs.set("max_school", String(p.max_school));
    if (p.max_clinic != null) qs.set("max_clinic", String(p.max_clinic));
    if (p.max_post_office != null)
      qs.set("max_post_office", String(p.max_post_office));
    if (p.max_restaurant != null)
      qs.set("max_restaurant", String(p.max_restaurant));
    if (p.max_college != null) qs.set("max_college", String(p.max_college));
    if (p.max_pharmacy != null) qs.set("max_pharmacy", String(p.max_pharmacy));
    if (p.max_kindergarten != null)
      qs.set("max_kindergarten", String(p.max_kindergarten));
    return qs.toString();
  }, [tileFilters]);

  const tileSuffix = useMemo(() => (tileQuery ? `?${tileQuery}` : ""), [tileQuery]);

  // de-dupe + drop rows without coords
  const uniqueItems = useMemo(() => {
    const arr = Array.isArray(items) ? items : [];
    return Array.from(
      new Map(
        arr
          .filter((i) => i.latitude != null && i.longitude != null)
          .map((i) => [i.listing_id, i])
      ).values()
    );
  }, [items]);

  // Map click → pick nearest listing and highlight + select its card
  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!mapRef.current || !e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();

      let best: Listing | null = null;
      let bestD = Infinity;

      const toRad = (x: number) => (x * Math.PI) / 180;
      const R = 6371000;

      for (const i of uniqueItems) {
        if (i.latitude == null || i.longitude == null) continue;
        const dLat = toRad(i.latitude - lat);
        const dLng = toRad(i.longitude - lng);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(lat)) *
            Math.cos(toRad(i.latitude)) *
            Math.sin(dLng / 2) ** 2;
        const d = 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }

      if (best?.latitude != null && best.longitude != null)
        onSelectListing?.(best.listing_id);
    },
    [uniqueItems, onSelectListing]
  );

  const metersPerPixel = (lat: number, zoomLevel: number) => {
    // Web Mercator approximation
    return (
      (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoomLevel)
    );
  };

  const updateSelectionCircle = useCallback(
    (pos: { lat: number; lng: number }) => {
      const map = mapRef.current;
      if (!map) return;

      const z = map.getZoom?.() ?? defaultZoom;
      const radius = metersPerPixel(pos.lat, z) * 10; // ~10px radius

      if (!selectedCircleRef.current) {
        selectedCircleRef.current = new google.maps.Circle({
          map,
          center: pos,
          radius,
          strokeColor: "#ffffff",
          strokeOpacity: 1,
          strokeWeight: 2,
          fillColor: "#ff3b30",
          fillOpacity: 0.65,
          clickable: false,
          zIndex: google.maps.Marker.MAX_ZINDEX,
        });
        return;
      }

      selectedCircleRef.current.setMap(map);
      selectedCircleRef.current.setCenter(pos);
      selectedCircleRef.current.setRadius(radius);
    },
    [defaultZoom]
  );

  // When a card is selected, pan/zoom to it
  useEffect(() => {
    if (!mapRef.current) return;

    if (!selectedId) {
      selectedCircleRef.current?.setMap(null);
      prevSelectedIdRef.current = null;
      lastSelectedPosRef.current = null;
      return;
    }

    const isNewSelection = prevSelectedIdRef.current !== selectedId;

    const match = uniqueItems.find((i) => i.listing_id === selectedId);
    if (match?.latitude != null && match.longitude != null) {
      lastSelectedPosRef.current = { lat: match.latitude, lng: match.longitude };
    }

    const pos = lastSelectedPosRef.current;
    if (!pos) return;

    // Keep the red circle visible even if `items` refreshes.
    updateSelectionCircle(pos);

    // Only pan/zoom when the selection changes (not when `items` updates due to bounds changes).
    if (isNewSelection) {
      try {
        suppressNextIdleRef.current = true;
        mapRef.current.panTo(pos);
        const z = mapRef.current.getZoom?.() ?? defaultZoom;
        if (z < 15) mapRef.current.setZoom(15);
      } catch {
        /* ignore */
      }
    }

    prevSelectedIdRef.current = selectedId;
  }, [selectedId, uniqueItems, updateSelectionCircle, defaultZoom]);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      map.setCenter(defaultCenter);
      map.setZoom(defaultZoom);

      const base = process.env.NEXT_PUBLIC_API_BASE || "/api";
      const isProxy = base.startsWith("/api");

      const pointsOverlay = new google.maps.ImageMapType({
        name: "points",
        opacity: 1.0,
        tileSize: new google.maps.Size(256, 256),
        getTileUrl: (coord: google.maps.Point, z: number) =>
          isProxy
            ? `${base}/tiles/points/${z}/${coord.x}/${coord.y}${tileSuffix}`
            : `${base}/tiles/points/${z}/${coord.x}/${coord.y}.png${tileSuffix}`,
      });
      pointsOverlayRef.current = pointsOverlay;

      const overlays = map.overlayMapTypes;
      let already = false;
      for (let i = 0; i < overlays.getLength(); i++) {
        const o = overlays.getAt(i) as google.maps.ImageMapType | null;
        if (o?.name === "points") {
          already = true;
          break;
        }
      }
      if (!already) overlays.insertAt(0, pointsOverlay);

      // Fit to items on first load if available
      const pts = uniqueItems;
      if (pts.length && pts.length <= 1500) {
        const bounds = new google.maps.LatLngBounds();
        pts.forEach((p) =>
          bounds.extend({ lat: p.latitude!, lng: p.longitude! })
        );
        map.fitBounds(bounds);
      } else {
        map.setZoom(defaultZoom);
        map.setCenter(defaultCenter);
      }
    },
    [defaultCenter, defaultZoom, uniqueItems, tileSuffix]
  );

  const prevBoundsRef = useRef<Bounds | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const suppressNextIdleRef = useRef<boolean>(false);

  const boundsNearlyEqual = (
    a: Bounds | null,
    b: Bounds | null,
    eps = 1e-3
  ) => {
    if (!a || !b) return false;
    return (
      Math.abs(a.north - b.north) < eps &&
      Math.abs(a.south - b.south) < eps &&
      Math.abs(a.east - b.east) < eps &&
      Math.abs(a.west - b.west) < eps
    );
  };

  const handleIdle = useCallback(() => {
    if (!mapRef.current) return;

    if (suppressNextIdleRef.current) {
      suppressNextIdleRef.current = false;
      return;
    }

    const map = mapRef.current;

    // Keep the selection highlight approximately constant size in pixels when zoom changes.
    const circle = selectedCircleRef.current;
    const center = circle?.getCenter();
    if (circle && center) {
      const z = map.getZoom?.() ?? defaultZoom;
      circle.setRadius(metersPerPixel(center.lat(), z) * 10);
    }

    if (!onBoundsChanged) return;

    const b = map.getBounds();
    if (!b) return;

    const ne = b.getNorthEast();
    const sw = b.getSouthWest();
    const next: Bounds = {
      north: ne.lat(),
      east: ne.lng(),
      south: sw.lat(),
      west: sw.lng(),
    };

    if (boundsNearlyEqual(prevBoundsRef.current, next)) return;
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = window.setTimeout(() => {
      prevBoundsRef.current = next;
      onBoundsChanged(next);
    }, 400);
  }, [onBoundsChanged, defaultZoom]);

  // Refresh overlay when filters change (otherwise the ImageMapType keeps using the old URL).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const base = process.env.NEXT_PUBLIC_API_BASE || "/api";
    const isProxy = base.startsWith("/api");

    const overlays = map.overlayMapTypes;
    let idx = -1;
    for (let i = 0; i < overlays.getLength(); i++) {
      const o = overlays.getAt(i) as google.maps.ImageMapType | null;
      if (o?.name === "points") {
        idx = i;
        break;
      }
    }
    if (idx < 0) return;

    const updated = new google.maps.ImageMapType({
      name: "points",
      opacity: 1.0,
      tileSize: new google.maps.Size(256, 256),
      getTileUrl: (coord: google.maps.Point, z: number) =>
        isProxy
          ? `${base}/tiles/points/${z}/${coord.x}/${coord.y}${tileSuffix}`
          : `${base}/tiles/points/${z}/${coord.x}/${coord.y}.png${tileSuffix}`,
    });
    pointsOverlayRef.current = updated;
    overlays.setAt(idx, updated);
  }, [tileSuffix]);

  const options = useMemo<google.maps.MapOptions>(
    () => ({
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      gestureHandling: "greedy",
    }),
    []
  );

  if (!isLoaded)
    return <div className="h-[60vh] w-full rounded-2xl bg-gray-200" />;

  return (
    <div className="h-[60vh] w-full rounded-2xl overflow-hidden border">
      <GoogleMap
        onLoad={onLoad}
        onIdle={handleIdle}
        onClick={handleMapClick}
        options={options}
        mapContainerStyle={{ height: "100%", width: "100%" }}
      >
        {/* Intentionally render only the raster tile overlay (no marker pins). */}
      </GoogleMap>
    </div>
  );
}

// "use client";
// import { useEffect, useMemo, useRef, useCallback, useState } from "react";
// import {
//   GoogleMap,
//   MarkerF,
//   // MarkerClustererF,
//   useLoadScript,
//   InfoWindowF,
// } from "@react-google-maps/api";
// import type { Listing } from "@/lib/types";
// // import {
// //   ClusterOptions,
// //   SuperClusterAlgorithm,
// //   // type MarkerClustererOptions,
// // } from "@googlemaps/markerclusterer";

// type Bounds = { south: number; west: number; north: number; east: number };

// export default function MapView({
//   items,
//   onBoundsChanged,
//   onSelectListing,
//   defaultCenter = { lat: 50.0647, lng: 19.945 }, // Kraków
//   defaultZoom = 12,
//   colorMetric = "centre_distance",
//   selectedId,
// }: {
//   items: Listing[];
//   onBoundsChanged?: (b: Bounds) => void;
//   onSelectListing?: (id: string) => void;
//   defaultCenter?: { lat: number; lng: number };
//   selectedId?: string | null;
//   defaultZoom?: number;
//   colorMetric?:
//     | "centre_distance"
//     | "poi_count"
//     | "school_distance"
//     | "clinic_distance"
//     | "restaurant_distance";
// }) {
//   const { isLoaded } = useLoadScript({
//     googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
//   });

//   const mapRef = useRef<google.maps.Map | null>(null);
//   const [active, setActive] = useState<string | null>(null);
//   const [zoom, setZoom] = useState<number>(defaultZoom);
//   const cap = zoom < 12 ? 800 : zoom < 14 ? 1500 : 2500;
//   // highlight state (hook)
//   const [highlight, setHighlight] = useState<{
//     lat: number;
//     lng: number;
//   } | null>(null);

//   // de-dupe + drop rows without coords
//   const uniqueItems = useMemo(() => {
//     const arr = Array.isArray(items) ? items : [];
//     return Array.from(
//       new Map(
//         arr
//           .filter((i) => i.latitude != null && i.longitude != null)
//           .map((i) => [i.listing_id, i])
//       ).values()
//     );
//   }, [items]);

//   // Map click → pick nearest visible listing and highlight + select its card
//   const handleMapClick = useCallback(
//     (e: google.maps.MapMouseEvent) => {
//       if (!mapRef.current || !e.latLng) return;
//       const lat = e.latLng.lat();
//       const lng = e.latLng.lng();

//       // Find nearest among currently displayed items (ensures a card exists to select)
//       let best: Listing | null = null;
//       let bestD = Infinity;
//       const toRad = (x: number) => (x * Math.PI) / 180;
//       const R = 6371000; // meters
//       for (const i of uniqueItems) {
//         if (i.latitude == null || i.longitude == null) continue;
//         const dLat = toRad(i.latitude - lat);
//         const dLng = toRad(i.longitude - lng);
//         const a =
//           Math.sin(dLat / 2) ** 2 +
//           Math.cos(toRad(lat)) *
//             Math.cos(toRad(i.latitude)) *
//             Math.sin(dLng / 2) ** 2;
//         const d = 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
//         if (d < bestD) {
//           bestD = d;
//           best = i;
//         }
//       }
//       if (best && best.latitude != null && best.longitude != null) {
//         const pos = { lat: best.latitude, lng: best.longitude };
//         setHighlight(pos);
//         onSelectListing?.(best.listing_id);
//       }
//     },
//     [uniqueItems]
//   );

//   const MAX_MARKERS = 500;
//   const displayItems = useMemo(() => {
//     const arr = uniqueItems;
//     if (arr.length <= cap) return arr;
//     const stride = Math.ceil(arr.length / cap);
//     return arr.filter((_, i) => i % stride === 0);
//   }, [uniqueItems, cap]);

//   // When a card is selected, pan/zoom to it and show a highlight only once per selection
//   useEffect(() => {
//     if (!selectedId || !mapRef.current) return;
//     const match = uniqueItems.find((i) => i.listing_id === selectedId);
//     if (!match || match.latitude == null || match.longitude == null) return;
//     const pos = { lat: match.latitude, lng: match.longitude };
//     try {
//       suppressNextIdleRef.current = true;
//       mapRef.current.panTo(pos);
//       const z = mapRef.current.getZoom?.() ?? defaultZoom;
//       if (z < 15) mapRef.current.setZoom(15);
//     } catch {
//       /* ignore */
//     }
//     setHighlight(pos);
//     setActive(selectedId);
//   }, [selectedId]);

//   const onLoad = useCallback(
//     (map: google.maps.Map) => {
//       mapRef.current = map;
//       map.setCenter(defaultCenter);
//       map.setZoom(defaultZoom);

//       const base = process.env.NEXT_PUBLIC_API_BASE || "";

//       // Insert the raster points overlay as the first overlay
//       const pointsOverlay = new google.maps.ImageMapType({
//         name: "points",
//         opacity: 1.0,
//         tileSize: new google.maps.Size(256, 256),
//         getTileUrl: (coord: google.maps.Point, zoom: number) =>
//           `${base}/tiles/points/${zoom}/${coord.x}/${coord.y}.png`,
//       });

//       // Avoid inserting more than once
//       const overlays = map.overlayMapTypes;
//       let already = false;
//       for (let i = 0; i < overlays.getLength(); i++) {
//         const o = overlays.getAt(i) as google.maps.ImageMapType | null;
//         if (o && o.name === "points") {
//           already = true;
//           break;
//         }
//       }
//       if (!already) overlays.insertAt(0, pointsOverlay);

//       if (onBoundsChanged) {
//         google.maps.event.addListenerOnce(map, "idle", () => {
//           const b = map.getBounds();
//           if (!b) return;
//           const ne = b.getNorthEast();
//           const sw = b.getSouthWest();
//           onBoundsChanged({
//             north: ne.lat(),
//             east: ne.lng(),
//             south: sw.lat(),
//             west: sw.lng(),
//           });
//         });
//       }

//       // Fit to items on first load if available
//       const pts = uniqueItems;
//       if (pts.length && pts.length <= 1500) {
//         const bounds = new google.maps.LatLngBounds();
//         pts.forEach((p) =>
//           bounds.extend({ lat: p.latitude!, lng: p.longitude! })
//         );
//         map.fitBounds(bounds);
//       } else {
//         map.setZoom(defaultZoom);
//         map.setCenter(defaultCenter);
//       }
//     },
//     [onBoundsChanged, defaultCenter, defaultZoom, uniqueItems]
//   );

//   const prevBoundsRef = useRef<Bounds | null>(null);
//   const debounceTimerRef = useRef<number | null>(null);
//   const suppressNextIdleRef = useRef<boolean>(false);

//   const boundsNearlyEqual = (
//     a: Bounds | null,
//     b: Bounds | null,
//     eps = 1e-3
//   ) => {
//     if (!a || !b) return false;
//     return (
//       Math.abs(a.north - b.north) < eps &&
//       Math.abs(a.south - b.south) < eps &&
//       Math.abs(a.east - b.east) < eps &&
//       Math.abs(a.west - b.west) < eps
//     );
//   };

//   // Note: clustering configured via clusterOptions below; no separate algorithm instance needed here.

//   const handleIdle = useCallback(() => {
//     if (!mapRef.current || !onBoundsChanged) return;
//     if (suppressNextIdleRef.current) {
//       suppressNextIdleRef.current = false;
//       return;
//     }
//     const b = mapRef.current.getBounds();
//     if (!b) return;
//     const ne = b.getNorthEast();
//     const sw = b.getSouthWest();
//     const next: Bounds = {
//       north: ne.lat(),
//       east: ne.lng(),
//       south: sw.lat(),
//       west: sw.lng(),
//     };

//     const z = mapRef.current?.getZoom?.();
//     if (typeof z === "number") setZoom((prev) => (prev !== z ? z : prev));

//     if (boundsNearlyEqual(prevBoundsRef.current, next)) return;
//     if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
//     debounceTimerRef.current = window.setTimeout(() => {
//       prevBoundsRef.current = next;
//       onBoundsChanged(next);
//     }, 400);
//   }, [onBoundsChanged]);

//   const options = useMemo<google.maps.MapOptions>(
//     () => ({
//       streetViewControl: false,
//       mapTypeControl: false,
//       fullscreenControl: false,
//       gestureHandling: "greedy",
//     }),
//     []
//   );

//   // Clusterer: dissolve around city zoom and be a bit sticky
//   const clusterOptions: ClusterOptions = useMemo<MarkerClustererOptions>(
//     () => ({
//       algorithm: new SuperClusterAlgorithm({
//         maxZoom: 18,
//         radius: 140,
//         minPoints: 4,
//       }),
//     }),
//     []
//   );

//   // color metric getter
//   const getMetricValue = (i: Listing) => {
//     switch (colorMetric) {
//       case "school_distance":
//         return (i as any).school_distance as number | undefined;
//       case "clinic_distance":
//         return (i as any).clinic_distance as number | undefined;
//       case "restaurant_distance":
//         return (i as any).restaurant_distance as number | undefined;
//       case "poi_count":
//         return (i as any).poi_count as number | undefined; // if you add a separate scale later
//       case "centre_distance":
//       default:
//         return (i as any).centre_distance as number | undefined;
//     }
//   };

//   function colorForDistance(v?: number) {
//     if (v == null) return "#808080";
//     if (v <= 300) return "#16a34a";
//     if (v <= 800) return "#84cc16";
//     if (v <= 1500) return "#f59e0b";
//     return "#ef4444";
//   }

//   function pinUrl(hex: string) {
//     const svg = encodeURIComponent(
//       `<svg width="32" height="48" viewBox="0 0 32 48" xmlns="http://www.w3.org/2000/svg">
//         <path d="M16 48s14-17.1 14-28A14 14 0 1 0 2 20c0 10.9 14 28 14 28z" fill="${hex}"/>
//         <circle cx="16" cy="18" r="6" fill="white"/>
//       </svg>`
//     );
//     return `data:image/svg+xml;charset=UTF-8,${svg}`;
//   }

//   function highlightIconUrl() {
//     const svg = encodeURIComponent(
//       `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
//        <circle cx="14" cy="14" r="7" fill="#ff5722" stroke="white" stroke-width="3"/>
//      </svg>`
//     );

//     return `data:image/svg+xml;charset=UTF-8,${svg}`;
//   }

//   // Cache icon data URLs per color to avoid recomputing per marker render
//   const iconUrlForHex = useMemo(() => {
//     const cache = new Map<string, string>();
//     return (hex: string) => {
//       let u = cache.get(hex);
//       if (!u) {
//         u = pinUrl(hex);
//         cache.set(hex, u);
//       }
//       return u;
//     };
//   }, []);

//   if (!isLoaded)
//     return <div className="h-[60vh] w-full rounded-2xl bg-gray-200" />;

//   return (
//     <div className="h-[60vh] w-full rounded-2xl overflow-hidden border">
//       <GoogleMap
//         onLoad={onLoad}
//         onIdle={handleIdle}
//         onClick={handleMapClick}
//         options={options}
//         mapContainerStyle={{ height: "100%", width: "100%" }}
//       >
//         {highlight && (
//           <MarkerF
//             position={highlight}
//             icon={
//               {
//                 url: highlightIconUrl(),
//                 scaledSize: new google.maps.Size(28, 28),
//                 anchor: new google.maps.Point(14, 14), // center the dot on the coord
//               } as google.maps.Icon
//             }
//             zIndex={google.maps.Marker.MAX_ZINDEX}
//           />
//         )}

//         {false && (
//           <MarkerClustererF options={clusterOptions}>
//             {(clusterer) => (
//               <>
//                 {displayItems.map((i) => {
//                   const val = getMetricValue(i);
//                   const hex = colorForDistance(val);
//                   const icon = { url: iconUrlForHex(hex) } as google.maps.Icon;
//                   return (
//                     <MarkerF
//                       key={i.listing_id}
//                       position={{ lat: i.latitude!, lng: i.longitude! }}
//                       clusterer={clusterer}
//                       icon={icon}
//                       onClick={() => {
//                         onSelectListing?.(i.listing_id);
//                       }}
//                     >
//                       {active === i.listing_id && (
//                         <InfoWindowF onCloseClick={() => setActive(null)}>
//                           <div className="text-sm space-y-1">
//                             <div className="font-medium">
//                               {i.city ?? "Property"}
//                             </div>
//                             <div>
//                               {i.square_m} m² • {i.rooms} rooms
//                             </div>
//                             <button
//                               className="mt-1 px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
//                               onClick={() => onSelectListing?.(i.listing_id)}
//                             >
//                               See opinions
//                             </button>
//                           </div>
//                         </InfoWindowF>
//                       )}
//                     </MarkerF>
//                   );
//                 })}
//               </>
//             )}
//           </MarkerClustererF>
//         )}
//       </GoogleMap>
//     </div>
//   );
// }
