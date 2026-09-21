"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (element: HTMLElement, options: { center: { lat: number; lng: number }; zoom: number; mapTypeControl?: boolean; streetViewControl?: boolean; fullscreenControl?: boolean }) => unknown;
        Marker: new (options: { map: unknown; position: { lat: number; lng: number }; title?: string; label?: string }) => unknown;
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

  function initializeMap() {
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
        label: point.kind === "radar_location" ? "G" : point.kind === "venue" ? "V" : "E",
      });
    }
  }

  useEffect(() => {
    initializeMap();
  }, [points]);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className="grid min-h-[520px] place-items-center rounded-2xl border border-ggz-border bg-[radial-gradient(circle_at_20%_20%,rgba(245,158,11,0.12),transparent_25%),radial-gradient(circle_at_75%_30%,rgba(139,92,246,0.14),transparent_28%),linear-gradient(135deg,#0e1720,#0a0e14)] p-8 text-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ggz-amber">GGz Radar</p>
          <h2 className="mt-2 text-xl font-semibold text-ggz-text-primary">Map provider not configured</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-ggz-text-secondary">Radar is connected to real GGz coordinates. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in the Next.js deployment to enable the interactive Google map, Street View controls and full map navigation.</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-ggz-border bg-black/20 p-3"><p className="text-xl font-bold text-ggz-text-primary">{points.length}</p><p className="text-xs text-ggz-text-muted">Visible points</p></div>
            <div className="rounded-xl border border-ggz-border bg-black/20 p-3"><p className="text-xl font-bold text-ggz-text-primary">Zimbabwe</p><p className="text-xs text-ggz-text-muted">Default region</p></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[520px] overflow-hidden rounded-2xl border border-ggz-border bg-ggz-bg-2">
      <Script
        src={"https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(apiKey)}
        strategy="afterInteractive"
        onLoad={initializeMap}
      />
      <div ref={elementRef} className="absolute inset-0" aria-label="GGz Radar interactive map" />
      <div className="pointer-events-none absolute left-3 top-3 rounded-xl border border-white/10 bg-black/60 px-3 py-2 backdrop-blur-sm">
        <p className="text-xs font-semibold text-white">GGz Radar</p>
        <p className="text-[10px] text-white/70">{points.length} mapped points</p>
      </div>
    </div>
  );
}
