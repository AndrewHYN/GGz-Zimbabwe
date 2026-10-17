"use client";

import { useCallback, useEffect, useRef } from "react";
import Script from "next/script";

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (
          element: HTMLElement,
          options: {
            center: { lat: number; lng: number };
            zoom: number;
            mapTypeControl?: boolean;
            streetViewControl?: boolean;
            fullscreenControl?: boolean;
          },
        ) => unknown;
        Marker: new (options: {
          map: unknown;
          position: { lat: number; lng: number };
          title?: string;
          label?: string;
        }) => unknown;
      };
    };
  }
}

interface RadarPoint {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  kind: string;
  game?: string;
}

interface RadarMapProps {
  points: RadarPoint[];
}

export default function RadarMap({ points }: RadarMapProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  const initializeMap = useCallback(() => {
    if (!elementRef.current || !window.google?.maps) return;

    const first = points[0];
    const center = first
      ? { lat: first.latitude, lng: first.longitude }
      : { lat: -17.8252, lng: 31.0335 };

    mapRef.current = new window.google.maps.Map(elementRef.current, {
      center,
      zoom: first ? 12 : 6,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true,
    });

    for (const point of points) {
      new window.google.maps.Marker({
        map: mapRef.current,
        position: { lat: point.latitude, lng: point.longitude },
        title: point.name + (point.game ? " · " + point.game : ""),
        label:
          point.kind === "radar_location"
            ? "G"
            : point.kind === "venue"
              ? "V"
              : "E",
      });
    }
  }, [points]);

  useEffect(() => {
    initializeMap();
  }, [initializeMap]);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    const center = points[0] ?? { latitude: -17.8252, longitude: 31.0335 };
    const bbox = [
      center.longitude - 0.08,
      center.latitude - 0.06,
      center.longitude + 0.08,
      center.latitude + 0.06,
    ].join(",");
    return (
      <div className="relative min-h-[520px] overflow-hidden rounded-2xl border border-ggz-border bg-ggz-bg-2">
        <iframe
          title="Gaming venues on OpenStreetMap"
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${center.latitude},${center.longitude}`}
        />
        <div className="absolute bottom-3 left-3 rounded-xl bg-black/80 px-4 py-2 text-xs text-white">
          {points.length} public locations · Select a venue in the results for
          details.
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[520px] overflow-hidden rounded-2xl border border-ggz-border bg-ggz-bg-2">
      <Script
        src={
          "https://maps.googleapis.com/maps/api/js?key=" +
          encodeURIComponent(apiKey)
        }
        strategy="afterInteractive"
        onLoad={initializeMap}
      />
      <div
        ref={elementRef}
        className="absolute inset-0"
        aria-label="GGz Radar interactive map"
      />
      <div className="pointer-events-none absolute left-3 top-3 rounded-xl border border-white/10 bg-black/60 px-3 py-2 backdrop-blur-sm">
        <p className="text-xs font-semibold text-white">GGz Radar</p>
        <p className="text-[10px] text-white/70">
          {points.length} mapped points
        </p>
      </div>
    </div>
  );
}
