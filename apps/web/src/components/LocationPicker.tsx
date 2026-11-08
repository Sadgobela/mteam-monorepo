"use client";

import { useEffect, useRef, useState } from "react";
import { TBILISI, TILE_ATTRIBUTION, TILE_URL } from "./ListingMap";

/** An optional pin for the posting form. The chosen point travels in hidden fields with the rest of the form. */
export function LocationPicker({ label }: { label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState<{ lat: string; lng: string } | null>(null);

  useEffect(() => {
    let cleanup = () => {};
    let cancelled = false;
    void import("leaflet").then(({ default: L }) => {
      if (cancelled || !box.current) return;
      const map = L.map(box.current).setView(TBILISI, 12);
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);
      const pin = L.circleMarker(TBILISI, { radius: 9, color: "#6e45a0", fillOpacity: 0 }).addTo(map);
      map.on("click", (event) => {
        pin.setLatLng(event.latlng).setStyle({ fillOpacity: 0.9 });
        setPoint({ lat: event.latlng.lat.toFixed(6), lng: event.latlng.lng.toFixed(6) });
      });
      cleanup = () => map.remove();
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  return (
    <div className="field">
      <small>{label}</small>
      <div ref={box} className="map small" role="region" aria-label={label} />
      {point && (
        <>
          <input type="hidden" name="lat" value={point.lat} />
          <input type="hidden" name="lng" value={point.lng} />
        </>
      )}
    </div>
  );
}
