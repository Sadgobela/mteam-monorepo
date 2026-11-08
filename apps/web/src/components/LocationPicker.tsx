"use client";

import type { CircleMarker } from "leaflet";
import { useEffect, useRef, useState } from "react";
import { PIN_COLOR, TBILISI, TILE_ATTRIBUTION, TILE_URL } from "./ListingMap";

const HIDDEN = { opacity: 0, fillOpacity: 0 };
const SHOWN = { opacity: 1, fillOpacity: 0.9 };

/** An optional pin for the posting form. The chosen point travels in hidden fields with the rest of the form. */
export function LocationPicker({ label, clearLabel }: { label: string; clearLabel: string }) {
  const box = useRef<HTMLDivElement>(null);
  const pin = useRef<CircleMarker | null>(null);
  const [point, setPoint] = useState<{ lat: string; lng: string } | null>(null);

  useEffect(() => {
    let cleanup = () => {};
    let cancelled = false;
    void import("leaflet").then(({ default: L }) => {
      if (cancelled || !box.current) return;
      const map = L.map(box.current).setView(TBILISI, 12);
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);
      const marker = L.circleMarker(TBILISI, { radius: 9, color: PIN_COLOR, fillColor: PIN_COLOR, ...HIDDEN }).addTo(map);
      pin.current = marker;
      map.on("click", (event) => {
        marker.setLatLng(event.latlng).setStyle(SHOWN);
        // The map repeats sideways, so a click on another copy of the world must be wrapped into valid coordinates.
        const { lat, lng } = event.latlng.wrap();
        setPoint({ lat: lat.toFixed(6), lng: lng.toFixed(6) });
      });
      cleanup = () => map.remove();
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  function clear() {
    (pin.current as CircleMarker).setStyle(HIDDEN);
    setPoint(null);
  }

  return (
    <div className="field">
      <small>{label}</small>
      <div ref={box} className="map small" role="region" aria-label={label} />
      {point && (
        <>
          <input type="hidden" name="lat" value={point.lat} />
          <input type="hidden" name="lng" value={point.lng} />
          <button type="button" className="btn ghost" onClick={clear}>{clearLabel}</button>
        </>
      )}
    </div>
  );
}
