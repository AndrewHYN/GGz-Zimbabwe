"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";

export interface RadarPoint {
  key: string;
  name: string;
  latitude: number;
  longitude: number;
  layer: "venues" | "events" | "tournaments" | "organizations" | "hotspots";
}

interface RadarMapProps {
  points: RadarPoint[];
  selected: RadarPoint | undefined;
  onSelect: (key: string) => void;
}

const harare = { lat: -17.8252, lng: 31.0335 };

const layerColors: Record<RadarPoint["layer"], string> = {
  venues: "#fbbf24",
  events: "#38bdf8",
  tournaments: "#c084fc",
  organizations: "#34d399",
  hotspots: "#fb7185",
};

function OpenStreetMap({ points, selected, onSelect }: RadarMapProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<{ library: typeof Leaflet; map: Leaflet.Map }>();
  const [message, setMessage] = useState("");

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    let active = true;
    let map: Leaflet.Map | undefined;

    import("leaflet").then((library) => {
      if (!active) return;
      map = library.map(element, { scrollWheelZoom: false }).setView(harare, 6);
      library.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      })
        .on("tileerror", () => setMessage("Map tiles are unavailable. You can still use the results list."))
        .on("tileload", () => setMessage(""))
        .addTo(map);
      setEngine({ library, map });
    }).catch(() => {
      if (active) setMessage("The map could not load. You can still use the results list.");
    });

    return () => {
      active = false;
      map?.remove();
    };
  }, []);

  useEffect(() => {
    if (!engine) return;
    const { library, map } = engine;
    const markers = library.layerGroup().addTo(map);
    for (const point of points) {
      const label = document.createElement("span");
      label.textContent = point.name;
      library.circleMarker([point.latitude, point.longitude], {
        radius: 8,
        color: "#111827",
        weight: 2,
        fillColor: layerColors[point.layer],
        fillOpacity: 1,
      }).bindTooltip(label).on("click", () => onSelect(point.key)).addTo(markers);
    }
    if (points.length) {
      map.fitBounds(points.map(({ latitude, longitude }) => [latitude, longitude]), {
        padding: [25, 25],
        maxZoom: 13,
      });
    } else {
      map.setView(harare, 6);
    }
    return () => { markers.remove(); };
  }, [engine, onSelect, points]);

  useEffect(() => {
    if (selected) engine?.map.panTo([selected.latitude, selected.longitude]);
  }, [engine, selected]);

  return (
    <>
      <div ref={elementRef} role="region" aria-label="Gaming locations on OpenStreetMap" className="absolute inset-0" />
      {message && <p role="status" className="absolute inset-x-3 top-3 z-[500] ml-10 rounded-lg bg-ggz-bg-1 p-3 text-sm">{message}</p>}
    </>
  );
}

type LatLng = { lat: number; lng: number };
interface GoogleMap {
  fitBounds(bounds: { extend(point: LatLng): void }, padding: number): void;
  setCenter(center: LatLng): void;
  setZoom(zoom: number): void;
  panTo(center: LatLng): void;
}
interface GoogleMarker {
  addListener(event: string, callback: () => void): { remove(): void };
  setMap(map: GoogleMap | null): void;
}

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
        Marker: new (options: Record<string, unknown>) => GoogleMarker;
        LatLngBounds: new () => { extend(point: LatLng): void };
      };
    };
    gm_authFailure?: () => void;
  }
}

function GoogleRadar({ apiKey, points, selected, onSelect, fallback }: RadarMapProps & {
  apiKey: string;
  fallback: () => void;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<GoogleMap>();

  useEffect(() => {
    const previous = window.gm_authFailure;
    window.gm_authFailure = fallback;
    return () => { window.gm_authFailure = previous; };
  }, [fallback]);

  function initialize() {
    if (!elementRef.current || !window.google?.maps) {
      fallback();
      return;
    }
    const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;
    setMap(new window.google.maps.Map(elementRef.current, {
      center: harare,
      zoom: 6,
      mapTypeControl: true,
      mapTypeControlOptions: { mapTypeIds: ["roadmap", "satellite", "hybrid"] },
      streetViewControl: true,
      fullscreenControl: true,
      ...(mapId ? { mapId, tiltInteractionEnabled: true, headingInteractionEnabled: true } : {}),
    }));
  }

  useEffect(() => {
    const library = window.google?.maps;
    if (!map || !library) return;
    const bounds = new library.LatLngBounds();
    const markers = points.map((point) => {
      const position = { lat: point.latitude, lng: point.longitude };
      bounds.extend(position);
      const marker = new library.Marker({ map, position, title: point.name });
      const listener = marker.addListener("click", () => onSelect(point.key));
      return { marker, listener };
    });
    if (points.length > 1) {
      map.fitBounds(bounds, 32);
    } else if (points.length === 1) {
      map.setCenter({ lat: points[0].latitude, lng: points[0].longitude });
      map.setZoom(13);
    } else {
      map.setCenter(harare);
      map.setZoom(6);
    }
    return () => {
      for (const { marker, listener } of markers) {
        listener.remove();
        marker.setMap(null);
      }
    };
  }, [map, onSelect, points]);

  useEffect(() => {
    if (selected) map?.panTo({ lat: selected.latitude, lng: selected.longitude });
  }, [map, selected]);

  return (
    <>
      <Script src={"https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(apiKey)}
        strategy="afterInteractive" onReady={initialize} onError={fallback} />
      <div ref={elementRef} role="region" aria-label="Gaming locations on Google Maps" className="absolute inset-0" />
    </>
  );
}

export default function RadarMap(props: RadarMapProps) {
  const [failed, setFailed] = useState(false);
  const fallback = useCallback(() => setFailed(true), []);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  return (
    <div className="relative isolate h-[360px] overflow-hidden rounded-2xl border border-ggz-border bg-ggz-bg-2 lg:h-[515px]">
      {apiKey && !failed ? <GoogleRadar {...props} apiKey={apiKey} fallback={fallback} /> : <OpenStreetMap {...props} />}
    </div>
  );
}
