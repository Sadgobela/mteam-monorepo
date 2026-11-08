"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTRIBUTION = "© OpenStreetMap contributors";
export const TBILISI: [number, number] = [41.7151, 44.8271];
const BRAND = "#6e45a0";

export interface MapPoint {
  id: number;
  lat: number;
  lng: number;
  label: string;
  href: string;
}

export function ListingMap({ points, label }: { points: MapPoint[]; label: string }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cleanup = () => {};
    let cancelled = false;
    void import("leaflet").then(({ default: L }) => {
      if (cancelled || !box.current) return;
      const map = L.map(box.current);
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);
      for (const point of points) {
        // Built as an element, so a title written by a user can never become HTML.
        const link = document.createElement("a");
        link.href = point.href;
        link.textContent = point.label;
        L.circleMarker([point.lat, point.lng], { radius: 9, color: BRAND, fillColor: BRAND, fillOpacity: 0.9 })
          .bindPopup(link)
          .addTo(map);
      }
      if (points.length === 0) map.setView(TBILISI, 12);
      else map.fitBounds(L.latLngBounds(points.map((point) => [point.lat, point.lng])), { maxZoom: 15, padding: [24, 24] });
      cleanup = () => map.remove();
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [points]);

  return <div ref={box} className="map" role="region" aria-label={label} />;
}
