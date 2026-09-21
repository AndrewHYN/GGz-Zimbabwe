"use client";

import RadarMap from "@/components/maps/RadarMap";
import { useEffect, useMemo, useState } from "react";

interface MapItem {
  id: number;
  kind: string;
  name: string;
  latitude: number;
  longitude: number;
  location?: string;
  category?: string;
  organization?: string;
  game?: string;
  distance_km?: number | null;
  rating_average?: number | null;
  event_count?: number;
  tournament_count?: number;
  url?: string;
}

interface RadarData {
  hotspots: MapItem[];
  venues: MapItem[];
  locations: MapItem[];
  events: MapItem[];
  tournaments: MapItem[];
  organizations: MapItem[];
}

const emptyData: RadarData = { hotspots: [], venues: [], locations: [], events: [], tournaments: [], organizations: [] };

export default function DiscoverPage() {
  const [data, setData] = useState<RadarData>(emptyData);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/radar/map/?q=" + encodeURIComponent(query), { credentials: "include", signal: controller.signal })
      .then((res) => { if (!res.ok) throw new Error("Radar unavailable"); return res.json(); })
      .then((payload) => setData({
        hotspots: payload.hotspots ?? [],
        venues: payload.venues ?? [],
        locations: payload.locations ?? [],
        events: payload.events ?? [],
        tournaments: payload.tournaments ?? [],
        organizations: payload.organizations ?? [],
      }))
      .catch((error) => { if (error.name !== "AbortError") setData(emptyData); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [query]);

  const items = useMemo(() => [...data.locations, ...data.venues, ...data.events, ...data.tournaments, ...data.organizations].slice(0, 60), [data]);
  const mapPoints = useMemo(() => items.filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)), [items]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ggz-amber">GGz Radar</p>
        <h1 className="mt-1 text-3xl font-bold text-ggz-text-primary">Nearby gaming</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ggz-text-secondary">The original GGz map system is now exposed through the 2.0 shell: public venues, organizations, events, tournaments and gamer hotspots.</p>
      </div>

      <div className="rounded-2xl border border-ggz-border bg-ggz-bg-1 p-4">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Radar…" className="h-11 w-full rounded-xl border border-ggz-border bg-ggz-bg-2 px-4 text-sm text-ggz-text-primary outline-none focus:border-ggz-amber" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <RadarMap points={mapPoints} />

        <div className="rounded-2xl border border-ggz-border bg-ggz-bg-1 p-4">
        
        <div className="rounded-2xl border border-ggz-border bg-ggz-bg-1 p-4">
          <div className="mb-3"><h2 className="font-semibold text-ggz-text-primary">Radar results</h2><p className="text-xs text-ggz-text-muted">{loading ? "Loading…" : items.length + " results"}</p></div>
          <div className="max-h-[470px] space-y-2 overflow-y-auto">
            {items.map((item, index) => (
              <div key={item.kind + "-" + item.id + "-" + index} className="rounded-xl border border-ggz-border bg-ggz-bg-2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-ggz-text-primary">{item.name}</p><p className="mt-0.5 text-xs text-ggz-text-secondary">{item.location || item.organization || item.game || "Zimbabwe"}</p></div>
                  <span className="shrink-0 rounded-full bg-ggz-amber/10 px-2 py-1 text-[10px] font-semibold uppercase text-ggz-amber">{item.kind.replace("_", " ")}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-ggz-text-muted">
                  {item.distance_km != null && <span>{item.distance_km} km</span>}
                  {item.rating_average != null && <span>{Number(item.rating_average).toFixed(1)} rating</span>}
                  {item.event_count != null && <span>{item.event_count} events</span>}
                  {item.tournament_count != null && <span>{item.tournament_count} tournaments</span>}
                </div>
                <p className="mt-2 text-[10px] text-ggz-text-muted">{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</p>
              </div>
            ))}
            {!loading && items.length === 0 && <p className="p-5 text-sm text-ggz-text-secondary">No public Radar results match that search.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
