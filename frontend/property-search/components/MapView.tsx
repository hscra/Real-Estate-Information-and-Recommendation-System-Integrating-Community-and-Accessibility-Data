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
  // highlight state (hook)
  const [highlight, setHighlight] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Add a map click handler that calls the backend nearest endpoint and moves the highlight
  const handleMapClick = useCallback(async (e: google.maps.MapMouseEvent) => {
    if (!mapRef.current || !e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    const zoom = mapRef.current.getZoom() ?? 12;
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || "";

    try {
      const res = await fetch(
        // `${base}/nearest?lat=${lat}&lng=${lng}&zoom=${zoom}&max_px=12`
        `/api/nearest?lat=${lat}&lng=${lng}&zoom=${zoom}&max_px=12`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.found) {
        setHighlight({ lat: data.latitude, lng: data.longitude });
        onSelectListing?.(data.listing_id); // selecting the card
      }
    } catch {
      /* ignore */
    }
  }, []);

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

      const base = process.env.NEXT_PUBLIC_API_BASE || "";

      // Insert the raster points overlay as the first overlay
      const pointsOverlay = new google.maps.ImageMapType({
        name: "points",
        opacity: 1.0,
        tileSize: new google.maps.Size(256, 256),
        getTileUrl: (coord: google.maps.Point, zoom: number) =>
          `${base}/tiles/points/${zoom}/${coord.x}/${coord.y}.png`,
      });

      // Avoid inserting more than once
      const overlays = map.overlayMapTypes;
      let already = false;
      for (let i = 0; i < overlays.getLength(); i++) {
        const o = overlays.getAt(i) as google.maps.ImageMapType | null;
        if (o && o.name === "points") {
          already = true;
          break;
        }
      }
      if (!already) overlays.insertAt(0, pointsOverlay);

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

  function highlightIconUrl() {
    const svg = encodeURIComponent(
      `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
       <circle cx="14" cy="14" r="7" fill="#ff5722" stroke="white" stroke-width="3"/>
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
        onClick={handleMapClick}
        options={options}
        mapContainerStyle={{ height: "100%", width: "100%" }}
      >
        {highlight && (
          <MarkerF
            position={highlight}
            icon={{ url: highlightIconUrl() } as google.maps.Icon}
            zIndex={google.maps.Marker.MAX_ZINDEX}
          />
        )}

        {false && (
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
        )}
      </GoogleMap>
    </div>
  );
}
