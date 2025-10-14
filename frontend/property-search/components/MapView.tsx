"use client";
import { useMemo, useRef, useCallback, useState } from "react";
import {
  GoogleMap,
  Marker,
  MarkerClustererF,
  useLoadScript,
  InfoWindowF,
} from "@react-google-maps/api";
import type { Listing } from "@/lib/types";

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
  // active marker id for InfoWindow
  const [active, setActive] = useState<string | null>(null); // <-- define setActive

  // const uniqueItems = Array.from(
  //   new Map(
  //     items
  //       .filter((i) => i.latitude && i.longitude)
  //       .map((i) => [i.listing_id, i]) // key: listing_id, value: listing object
  //   ).values()
  // );

  const uniqueItems = useMemo(() => {
    return Array.from(
      new Map(
        (items ?? [])
          .filter((i) => i.latitude && i.longitude)
          .map((i) => [i.listing_id, i])
      ).values()
    );
  }, [items]);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      // Fit to items initially if you want:
      const pts = items.filter((i) => i.latitude && i.longitude);
      if (pts.length) {
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
    [items, defaultCenter, defaultZoom]
  );

  const handleIdle = useCallback(() => {
    if (!mapRef.current || !onBoundsChanged) return;
    const b = mapRef.current.getBounds();
    if (!b) return;
    const ne = b.getNorthEast();
    const sw = b.getSouthWest();
    onBoundsChanged({
      north: ne.lat(),
      east: ne.lng(),
      south: sw.lat(),
      west: sw.lng(),
    });
  }, [onBoundsChanged]);

  const options = useMemo<google.maps.MapOptions>(
    () => ({
      mapId: undefined, // (optional) use a Cloud Styled Map ID
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      gestureHandling: "greedy",
    }),
    []
  );

  const metric = colorMetric ?? "school_distance"; // prop or from params
  // {
  //   uniqueItems.map((i) => {
  //     const val = (i as any)[metric] as number | undefined;
  //     const icon = {
  //       url: pinUrl(colorForDistance(val)),
  //       scaledSize: new google.maps.Size(32, 48),
  //     };
  //     return (
  //       <Marker
  //         key={i.listing_id}
  //         position={{ lat: i.latitude!, lng: i.longitude! }}
  //         clusterer={clusterer}
  //         icon={icon}
  //         onClick={() => {
  //           setActive(i.listing_id); // state for InfoWindow
  //           onSelectListing?.(i.listing_id);
  //         }}
  //       />
  //     );
  //   });
  // }

  function colorForCentreKm(km?: number) {
    if (km == null) return "#9ca3af";
    if (km <= 2) return "#16a34a";
    if (km <= 5) return "#84cc16";
    if (km <= 10) return "#f59e0b";
    return "#ef4444";
  }
  function sizeForPoi(count?: number) {
    if (!count || count <= 2) return 28;
    if (count <= 6) return 34;
    if (count <= 12) return 42;
    return 50;
  }

  // tiny SVG pin as data URL
  function pinUrl(hex: string) {
    const svg = encodeURIComponent(
      `<svg width="32" height="48" viewBox="0 0 32 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 48s14-17.1 14-28A14 14 0 1 0 2 20c0 10.9 14 28 14 28z" fill="${hex}"/>
      <circle cx="16" cy="18" r="6" fill="white"/>
    </svg>`
    );
    return `data:image/svg+xml;charset=UTF-8,${svg}`;
  }

  function colorForDistance(v?: number) {
    if (v == null) return "#808080"; // grey if unknown
    if (v <= 300) return "#16a34a"; // green-600
    if (v <= 800) return "#84cc16"; // lime-500
    if (v <= 1500) return "#f59e0b"; // amber-500
    return "#ef4444"; // red-500
  }

  // choose value for color metric
  const getMetricValue = (i: Listing) => {
    switch (colorMetric) {
      // case "poi_count":
      // use centre-based color but you could make a separate scale if you prefer
      // return i.centre_distance;
      case "school_distance":
        return (i as any).school_distance as number | undefined;
      case "clinic_distance":
        return (i as any).clinic_distance as number | undefined;
      case "restaurant_distance":
        return (i as any).restaurant_distance as number | undefined;
      case "centre_distance":
      // default:
      // return i.centre_distance;
    }
  };

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
        <MarkerClustererF>
          {(clusterer) => (
            <>
              {uniqueItems.map((i) => {
                const val = (i as any)[metric] as number | undefined;
                const icon = {
                  url: pinUrl(colorForDistance(val)),
                  scaledSize: new google.maps.Size(32, 48),
                };

                return (
                  <div key={i.listing_id}>
                    <Marker
                      position={{ lat: i.latitude!, lng: i.longitude! }}
                      clusterer={clusterer}
                      icon={icon}
                      onClick={() => {
                        setActive(i.listing_id); // show InfoWindow
                        onSelectListing?.(i.listing_id); // notify parent (triggers opinions panel)
                      }}
                    />

                    {/* ✅ Add this InfoWindow right below the Marker */}
                    {active === i.listing_id && (
                      <InfoWindowF
                        position={{ lat: i.latitude!, lng: i.longitude! }}
                        onCloseClick={() => setActive(null)}
                      >
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
                  </div>
                );
              })}
            </>
          )}
        </MarkerClustererF>

        {/* <MarkerClustererF>
          {(clusterer) => (
            <>
              {uniqueItems.map((i) => {
                const val = (i as any)[metric] as number | undefined;
                const icon = {
                  url: pinUrl(colorForDistance(val)),
                  scaledSize: new google.maps.Size(32, 48),
                };

                return (
                  <Marker
                    key={i.listing_id}
                    position={{ lat: i.latitude!, lng: i.longitude! }}
                    clusterer={clusterer}
                    icon={icon}
                    onClick={() => {
                      setActive(i.listing_id); // show InfoWindow for this marker
                      onSelectListing?.(i.listing_id); // highlight card
                    }}
                  />

                  
                );
              })}
            </>
          )}
        </MarkerClustererF> */}
      </GoogleMap>
    </div>
  );
}
