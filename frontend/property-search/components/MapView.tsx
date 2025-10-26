"use client";
import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import {
  GoogleMap,
  MarkerF,
  MarkerClustererF,
  useLoadScript,
  InfoWindowF,
} from "@react-google-maps/api";
import type { Listing } from "@/lib/types";
import {
  SuperClusterAlgorithm,
  type MarkerClustererOptions,
} from "@googlemaps/markerclusterer";

type Bounds = { south: number; west: number; north: number; east: number };

export default function MapView({
  items,
  onBoundsChanged,
  onSelectListing,
  defaultCenter = { lat: 50.0647, lng: 19.945 }, // Kraków
  defaultZoom = 12,
  colorMetric = "centre_distance",
}: {
  items: Listing[];
  onBoundsChanged?: (b: Bounds) => void;
  onSelectListing?: (id: string) => void;
  defaultCenter?: { lat: number; lng: number };
  selectedId?: string | null;
  defaultZoom?: number;
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
  const [active, setActive] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(defaultZoom);
  const cap = zoom < 12 ? 800 : zoom < 14 ? 1500 : 2500;

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

  const MAX_MARKERS = 500;
  const displayItems = useMemo(() => {
    const arr = uniqueItems;
    if (arr.length <= cap) return arr;
    const stride = Math.ceil(arr.length / cap);
    return arr.filter((_, i) => i % stride === 0);
  }, [uniqueItems, cap]);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      map.setCenter(defaultCenter);
      map.setZoom(defaultZoom);

      if (onBoundsChanged) {
        google.maps.event.addListenerOnce(map, "idle", () => {
          const b = map.getBounds();
          if (!b) return;
          const ne = b.getNorthEast();
          const sw = b.getSouthWest();
          onBoundsChanged({
            north: ne.lat(),
            east: ne.lng(),
            south: sw.lat(),
            west: sw.lng(),
          });
        });
      }

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
    [onBoundsChanged, defaultCenter, defaultZoom, uniqueItems]
  );

  const prevBoundsRef = useRef<Bounds | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

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

  // Note: clustering configured via clusterOptions below; no separate algorithm instance needed here.

  const handleIdle = useCallback(() => {
    if (!mapRef.current || !onBoundsChanged) return;
    const b = mapRef.current.getBounds();
    if (!b) return;
    const ne = b.getNorthEast();
    const sw = b.getSouthWest();
    const next: Bounds = {
      north: ne.lat(),
      east: ne.lng(),
      south: sw.lat(),
      west: sw.lng(),
    };

    const z = mapRef.current?.getZoom?.();
    if (typeof z === "number") setZoom((prev) => (prev !== z ? z : prev));

    if (boundsNearlyEqual(prevBoundsRef.current, next)) return;
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      prevBoundsRef.current = next;
      onBoundsChanged(next);
    }, 400);
  }, [onBoundsChanged]);

  const options = useMemo<google.maps.MapOptions>(
    () => ({
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      gestureHandling: "greedy",
    }),
    []
  );

  // Clusterer: dissolve around city zoom and be a bit sticky
  const clusterOptions = useMemo<MarkerClustererOptions>(
    () => ({
      algorithm: new SuperClusterAlgorithm({
        maxZoom: 18,
        radius: 140,
        minPoints: 4,
      }),
    }),
    []
  );

  // color metric getter
  const getMetricValue = (i: Listing) => {
    switch (colorMetric) {
      case "school_distance":
        return (i as any).school_distance as number | undefined;
      case "clinic_distance":
        return (i as any).clinic_distance as number | undefined;
      case "restaurant_distance":
        return (i as any).restaurant_distance as number | undefined;
      case "poi_count":
        return (i as any).poi_count as number | undefined; // if you add a separate scale later
      case "centre_distance":
      default:
        return (i as any).centre_distance as number | undefined;
    }
  };

  function colorForDistance(v?: number) {
    if (v == null) return "#808080";
    if (v <= 300) return "#16a34a";
    if (v <= 800) return "#84cc16";
    if (v <= 1500) return "#f59e0b";
    return "#ef4444";
  }

  function pinUrl(hex: string) {
    const svg = encodeURIComponent(
      `<svg width="32" height="48" viewBox="0 0 32 48" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 48s14-17.1 14-28A14 14 0 1 0 2 20c0 10.9 14 28 14 28z" fill="${hex}"/>
        <circle cx="16" cy="18" r="6" fill="white"/>
      </svg>`
    );
    return `data:image/svg+xml;charset=UTF-8,${svg}`;
  }

  // Cache icon data URLs per color to avoid recomputing per marker render
  const iconUrlForHex = useMemo(() => {
    const cache = new Map<string, string>();
    return (hex: string) => {
      let u = cache.get(hex);
      if (!u) {
        u = pinUrl(hex);
        cache.set(hex, u);
      }
      return u;
    };
  }, []);

  if (!isLoaded)
    return <div className="h-[60vh] w-full rounded-2xl bg-gray-200" />;

  return (
    <div className="h-[60vh] w-full rounded-2xl overflow-hidden border">
      <GoogleMap
        onLoad={onLoad}
        onIdle={handleIdle}
        options={options}
        mapContainerStyle={{ height: "100%", width: "100%" }}
      >
        <MarkerClustererF options={clusterOptions}>
          {(clusterer) => (
            <>
              {displayItems.map((i) => {
                const val = getMetricValue(i);
                const hex = colorForDistance(val);
                const icon = { url: iconUrlForHex(hex) } as google.maps.Icon;
                return (
                  <MarkerF
                    key={i.listing_id}
                    position={{ lat: i.latitude!, lng: i.longitude! }}
                    clusterer={clusterer}
                    icon={icon}
                    onClick={() => {
                      // setActive(i.listing_id);
                      onSelectListing?.(i.listing_id);
                    }}
                  >
                    {active === i.listing_id && (
                      <InfoWindowF onCloseClick={() => setActive(null)}>
                        <div className="text-sm space-y-1">
                          <div className="font-medium">
                            {i.city ?? "Property"}
                          </div>
                          <div>
                            {i.square_m} m² • {i.rooms} rooms
                          </div>
                          <button
                            className="mt-1 px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                            onClick={() => onSelectListing?.(i.listing_id)}
                          >
                            See opinions
                          </button>
                        </div>
                      </InfoWindowF>
                    )}
                  </MarkerF>
                );
              })}
            </>
          )}
        </MarkerClustererF>
      </GoogleMap>
    </div>
  );
}

// "use client";
// import { useEffect, useMemo, useRef, useCallback, useState } from "react";
// import {
//   GoogleMap,
//   Marker,
//   MarkerClustererF,
//   aoadScript,
//   InfoWindowF,
// } from "@react-google-maps/api";
// import type { Listing } from "@/lib/types";
// import {
//   SuperClusterAlgorithm,
//   type MarkerClustererOptions,
// } from "@googlemaps/markerclusterer";

// type Bounds = { south: number; west: number; north: number; east: number };

// export default function MapView({
//   items,
//   onBoundsChanged,
//   onSelectListing,
//   defaultCenter = { lat: 50.0647, lng: 19.945 }, // Kraków
//   defaultZoom = 12,
//   colorMetric = "centre_distance",
// }: {
//   items: Listing[];
//   onBoundsChanged?: (b: Bounds) => void;
//   onSelectListing?: (id: string) => void;
//   defaultCenter?: { lat: number; lng: number };
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
//   // active marker id for InfoWindow
//   const [active, setActive] = useState<string | null>(null); // <-- define setActive
//   // console.log("items type:", Array.isArray(items), items);
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

//   const onLoad = useCallback(
//     (map: google.maps.Map) => {
//       mapRef.current = map;

//       // start center of map
//       map.setCenter(defaultCenter);
//       map.setZoom(defaultZoom);

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
//       // Fit to items initially if you want:
//       const pts = items.filter((i) => i.latitude && i.longitude);
//       if (pts.length) {
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
//     [onBoundsChanged, defaultCenter, defaultZoom]
//   );

//   const handleIdle = useCallback(() => {
//     if (!mapRef.current || !onBoundsChanged) return;
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

//     if (boundsNearlyEqual(prevBoundsRef.current, next)) return;
//     if (debounceTimerRef.current) {
//       window.clearTimeout(debounceTimerRef.current);
//     }
//     debounceTimerRef.current = window.setTimeout(() => {
//       prevBoundsRef.current = next;
//       onBoundsChanged(next);
//     }, 250);
//   }, [onBoundsChanged]);

//   const options = useMemo<google.maps.MapOptions>(
//     () => ({
//       mapId: undefined, // (optional) use a Cloud Styled Map ID
//       streetViewControl: false,
//       mapTypeControl: false,
//       fullscreenControl: false,
//       gestureHandling: "greedy",
//     }),
//     []
//   );

//   const prevBoundsRef = useRef<Bounds | null>(null);
//   const debounceTimerRef = useRef<number | null>(null);

//   // helper to compare bounds with small tolerancd
//   const boundsNearlyEqual = (
//     a: Bounds | null,
//     b: Bounds | null,
//     eps = 1e-5
//   ) => {
//     if (!a || !b) return false;
//     return (
//       Math.abs(a.north - b.north) < eps &&
//       Math.abs(a.south - b.south) < eps &&
//       Math.abs(a.east - b.east) < eps &&
//       Math.abs(a.west - b.west) < eps
//     );
//   };

//   const clusterAlgorithm = useMemo(
//     () =>
//       new SuperClusterAlgorithm({
//         maxZoom: 15, // dissolve to individual markers at/after this zoom
//         radius: 80, // optional: cluster “stickiness”
//       }),
//     []
//   );

//   const clusterOptions = useMemo<MarkerClustererOptions>(
//     () => ({
//       algorithm: new SuperClusterAlgorithm({
//         maxZoom: 15, // clusters dissolve at/after this zoom
//         radius: 80, // cluster “stickiness”
//       }),
//     }),
//     []
//   );

//   const metric = colorMetric ?? "school_distance"; // prop or from params
//   // {
//   //   uniqueItems.map((i) => {
//   //     const val = (i as any)[metric] as number | undefined;
//   //     const icon = {
//   //       url: pinUrl(colorForDistance(val)),
//   //       scaledSize: new google.maps.Size(32, 48),
//   //     };
//   //     return (
//   //       <Marker
//   //         key={i.listing_id}
//   //         position={{ lat: i.latitude!, lng: i.longitude! }}
//   //         clusterer={clusterer}
//   //         icon={icon}
//   //         onClick={() => {
//   //           setActive(i.listing_id); // state for InfoWindow
//   //           onSelectListing?.(i.listing_id);
//   //         }}
//   //       />
//   //     );
//   //   });
//   // }

//   function colorForCentreKm(km?: number) {
//     if (km == null) return "#9ca3af";
//     if (km <= 2) return "#16a34a";
//     if (km <= 5) return "#84cc16";
//     if (km <= 10) return "#f59e0b";
//     return "#ef4444";
//   }
//   function sizeForPoi(count?: number) {
//     if (!count || count <= 2) return 28;
//     if (count <= 6) return 34;
//     if (count <= 12) return 42;
//     return 50;
//   }

//   // tiny SVG pin as data URL
//   function pinUrl(hex: string) {
//     const svg = encodeURIComponent(
//       `<svg width="32" height="48" viewBox="0 0 32 48" xmlns="http://www.w3.org/2000/svg">
//       <path d="M16 48s14-17.1 14-28A14 14 0 1 0 2 20c0 10.9 14 28 14 28z" fill="${hex}"/>
//       <circle cx="16" cy="18" r="6" fill="white"/>
//     </svg>`
//     );
//     return `data:image/svg+xml;charset=UTF-8,${svg}`;
//   }

//   function colorForDistance(v?: number) {
//     if (v == null) return "#808080"; // grey if unknown
//     if (v <= 300) return "#16a34a"; // green-600
//     if (v <= 800) return "#84cc16"; // lime-500
//     if (v <= 1500) return "#f59e0b"; // amber-500
//     return "#ef4444"; // red-500
//   }

//   // choose value for color metric
//   const getMetricValue = (i: Listing) => {
//     switch (colorMetric) {
//       // case "poi_count":
//       // use centre-based color but you could make a separate scale if you prefer
//       // return i.centre_distance;
//       case "school_distance":
//         return (i as any).school_distance as number | undefined;
//       case "clinic_distance":
//         return (i as any).clinic_distance as number | undefined;
//       case "restaurant_distance":
//         return (i as any).restaurant_distance as number | undefined;
//       case "centre_distance":
//       // default:
//       // return i.centre_distance;
//     }
//   };

//   if (!isLoaded)
//     return <div className="h-[60vh] w-full rounded-2xl bg-gray-200" />;

//   return (
//     <div className="h-[60vh] w-full rounded-2xl overflow-hidden border">
//       <GoogleMap
//         onLoad={onLoad}
//         onIdle={handleIdle}
//         options={options}
//         mapContainerStyle={{ height: "100%", width: "100%" }}
//       >
//         <MarkerClustererF options={clusterOptions}>
//           {(clusterer) => (
//             <>
//               {uniqueItems.map((i) => (
//                 <Marker
//                   key={i.listing_id}
//                   position={{ lat: i.latitude!, lng: i.longitude! }}
//                   clusterer={clusterer}
//                   icon={{
//                     url: pinUrl(colorForDistance((i as any)[metric])),
//                     scaledSize: new google.maps.Size(32, 48),
//                   }}
//                   onClick={() => {
//                     setActive(i.listing_id);
//                     onSelectListing?.(i.listing_id);
//                   }}
//                 />
//               ))}
//             </>
//           )}
//         </MarkerClustererF>
//         {/* <MarkerClustererF>
//           {(clusterer) => (
//             <>
//               {uniqueItems.map((i) => {
//                 const val = (i as any)[metric] as number | undefined;
//                 const icon = {
//                   url: pinUrl(colorForDistance(val)),
//                   scaledSize: new google.maps.Size(32, 48),
//                 };

//                 return (
//                   <Marker
//                     key={i.listing_id} // move the key HERE
//                     position={{ lat: i.latitude!, lng: i.longitude! }}
//                     clusterer={clusterer}
//                     icon={icon}
//                     onClick={() => {
//                       setActive(i.listing_id);
//                       onSelectListing?.(i.listing_id);
//                     }}
//                   >
//                     {active === i.listing_id && (
//                       <InfoWindowF onCloseClick={() => setActive(null)}>
//                         <div className="text-sm space-y-1">
//                           <div className="font-medium">
//                             {i.city ?? "Property"}
//                           </div>
//                           <div>
//                             {i.square_m} m² • {i.rooms} rooms
//                           </div>
//                           <button
//                             className="mt-1 px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
//                             onClick={() => onSelectListing?.(i.listing_id)}
//                           >
//                             See opinions
//                           </button>
//                         </div>
//                       </InfoWindowF>
//                     )}
//                   </Marker>
//                 );
//               })}
//             </>
//           )}
//         </MarkerClustererF> */}

//         {/* <MarkerClustererF>
//           {(clusterer) => (
//             <>
//               {uniqueItems.map((i) => {
//                 const val = (i as any)[metric] as number | undefined;
//                 const icon = {
//                   url: pinUrl(colorForDistance(val)),
//                   scaledSize: new google.maps.Size(32, 48),
//                 };

//                 return (
//                   <Marker
//                     key={i.listing_id}
//                     position={{ lat: i.latitude!, lng: i.longitude! }}
//                     clusterer={clusterer}
//                     icon={icon}
//                     onClick={() => {
//                       setActive(i.listing_id); // show InfoWindow for this marker
//                       onSelectListing?.(i.listing_id); // highlight card
//                     }}
//                   />

//                 );
//               })}
//             </>
//           )}
//         </MarkerClustererF> */}
//       </GoogleMap>
//     </div>
//   );
// }
