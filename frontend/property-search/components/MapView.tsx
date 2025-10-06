"use client";
import { useMemo, useRef, useCallback } from "react";
import {
  GoogleMap,
  Marker,
  MarkerClustererF,
  useLoadScript,
} from "@react-google-maps/api";
import type { Listing } from "@/lib/types";

type Bounds = { south: number; west: number; north: number; east: number };

export default function MapView({
  items,
  onBoundsChanged,
  onSelectListing,
  defaultCenter = { lat: 50.0647, lng: 19.945 }, // Kraków
  defaultZoom = 12,
}: {
  items: Listing[];
  onBoundsChanged?: (b: Bounds) => void;
  onSelectListing?: (id: string) => void;
  defaultCenter?: { lat: number; lng: number };
  defaultZoom?: number;
}) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const uniqueItems = Array.from(
    new Map(
      items
        .filter((i) => i.latitude && i.longitude)
        .map((i) => [i.listing_id, i]) // key: listing_id, value: listing object
    ).values()
  );

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
              {uniqueItems
                .filter((i) => i.latitude && i.longitude)
                .map((i) => (
                  <Marker
                    key={i.listing_id}
                    position={{ lat: i.latitude!, lng: i.longitude! }}
                    clusterer={clusterer}
                    onClick={() => onSelectListing?.(i.listing_id)}
                  />
                ))}
            </>
          )}
          {/* {(clusterer) =>
            items
              .filter((i) => i.latitude && i.longitude)
              .map((i) => (
                <Marker
                  key={i.listing_id}
                  position={{ lat: i.latitude!, lng: i.longitude! }}
                  clusterer={clusterer}
                  onClick={() => onSelectListing?.(i.listing_id)}
                />
              ))
          } */}
        </MarkerClustererF>
      </GoogleMap>
    </div>
  );
}
