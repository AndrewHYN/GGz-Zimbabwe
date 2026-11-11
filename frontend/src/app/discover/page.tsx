"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import RadarMap, { type RadarPoint } from "@/components/maps/RadarMap";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { useDiscovery } from "@/lib/useDiscovery";

interface MapItem {
  id: number;
  kind: string;
  name: string;
  latitude: number;
  longitude: number;
  location?: string;
  organization?: string;
  organization_url?: string;
  verification_status?: string;
  game?: string;
  url?: string;
}

interface Hotspot {
  latitude: number;
  longitude: number;
  gamer_count: number;
  popular_games: string[];
}

interface RadarData {
  hotspots: Hotspot[];
  venues: MapItem[];
  locations: MapItem[];
  events: MapItem[];
  tournaments: MapItem[];
  organizations: MapItem[];
}

interface Result extends RadarPoint {
  detail: string;
  href?: string;
  verified?: boolean;
}

const layers = [
  { id: "venues", name: "Venues", color: "bg-amber-400" },
  { id: "organizations", name: "Organizations", color: "bg-emerald-400" },
  { id: "events", name: "Events", color: "bg-sky-400" },
  { id: "tournaments", name: "Tournaments", color: "bg-purple-400" },
  { id: "hotspots", name: "Gamer hotspots", color: "bg-rose-400" },
] as const;

function itemResult(item: MapItem, layer: RadarPoint["layer"]): Result {
  let href: string | undefined;
  if (item.kind === "radar_location" && /^\/organizations\/[\w-]+\/$/.test(item.organization_url ?? "")) {
    href = item.organization_url + "#venue-" + item.id;
  } else if (/^\/(organizations|events|tournaments)\/[\w-]+\/$/.test(item.url ?? "")) {
    href = item.url;
  }
  return {
    key: item.kind + "-" + item.id,
    name: item.name,
    latitude: item.latitude,
    longitude: item.longitude,
    layer,
    detail: [item.location, item.organization || item.game].filter(Boolean).join(" · "),
    verified: item.verification_status === "VERIFIED",
    href,
  };
}

export default function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState<RadarPoint["layer"][]>(layers.map((layer) => layer.id));
  const [selectedKey, setSelectedKey] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const { data, loading, error, retry } = useDiscovery<RadarData>(
    "/api/radar/map/?q=" + encodeURIComponent(query),
  );

  const points = useMemo(() => {
    if (!data) return [];
    const q = query.toLowerCase();
    return [
      ...(data.locations ?? []).map((item) => itemResult(item, "venues")),
      ...(data.venues ?? []).map((item) => itemResult(item, "venues")),
      ...(data.organizations ?? []).map((item) => itemResult(item, "organizations")),
      ...(data.events ?? []).map((item) => itemResult(item, "events")),
      ...(data.tournaments ?? []).map((item) => itemResult(item, "tournaments")),
      ...(data.hotspots ?? [])
        .filter((item) => !q || item.popular_games.some((game) => game.toLowerCase().includes(q)))
        .map((item): Result => ({
          key: "hotspot-" + item.latitude + "-" + item.longitude,
          name: "Gamer hotspot",
          latitude: item.latitude,
          longitude: item.longitude,
          layer: "hotspots",
          detail: item.gamer_count + " gamers" + (item.popular_games.length ? " · " + item.popular_games.join(", ") : ""),
        })),
    ].filter((point) => visible.includes(point.layer)
      && (!verifiedOnly || point.layer !== "venues" || point.verified)
      && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90
      && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180);
  }, [data, query, verifiedOnly, visible]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSelectedKey("");
    setQuery(String(new FormData(event.currentTarget).get("q") ?? "").trim());
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">GGz Radar</h1>
          <p className="mt-1 text-sm text-ggz-text-secondary">Find gaming venues and events across Zimbabwe.</p>
        </div>
        <Link href="/organizations/" className="text-sm font-semibold text-ggz-amber hover:underline">Browse organizations</Link>
      </div>
      <form onSubmit={search} role="search" aria-label="Search Radar" className="flex max-w-2xl gap-2">
        <input type="search" name="q" aria-label="City, venue, or game" placeholder="City, venue, or game"
          className="min-w-0 flex-1 rounded-xl border border-ggz-border bg-ggz-bg-2 px-3 text-sm focus:border-ggz-amber" />
        <Button type="submit">Search</Button>
      </form>
      <fieldset className="my-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <legend className="mb-2 text-sm font-semibold">Map layers</legend>
        {layers.map((layer) => (
          <label key={layer.id} className="inline-flex min-h-8 items-center gap-1.5">
            <input type="checkbox" checked={visible.includes(layer.id)} className="accent-amber-400"
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setVisible((current) => checked ? [...current, layer.id] : current.filter((value) => value !== layer.id));
              }} />
            <span aria-hidden="true" className={"size-2 rounded-full " + layer.color} />{layer.name}
          </label>
        ))}
        <label className="inline-flex min-h-8 items-center gap-1.5">
          <input type="checkbox" checked={verifiedOnly} onChange={(event) => setVerifiedOnly(event.target.checked)} className="accent-amber-400" />
          Verified venues only
        </label>
      </fieldset>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <RadarMap points={points} selected={points.find((point) => point.key === selectedKey)} onSelect={setSelectedKey} />
        <section className="min-w-0 rounded-2xl border border-ggz-border bg-ggz-bg-1 p-4">
          <h2 className="text-lg font-semibold">Radar results</h2>
          {loading && <p role="status" className="mt-3 text-sm text-ggz-text-secondary">Searching Radar…</p>}
          {error ? (
            <ErrorState title="Radar results are unavailable" message="Try loading locations again." onRetry={retry} />
          ) : !loading && (points.length ? (
            <ul className="mt-3 max-h-[440px] space-y-2 overflow-y-auto">
              {points.map((point) => (
                <li key={point.key} className={"min-w-0 rounded-xl border bg-ggz-bg-2 p-3 " + (selectedKey === point.key ? "border-ggz-amber" : "border-ggz-border")}>
                  <button type="button" onClick={() => setSelectedKey(point.key)} aria-pressed={point.key === selectedKey}
                    className="block text-left font-semibold hover:text-ggz-amber">
                    {point.name}
                  </button>
                  {point.detail && <p className="mt-1 text-sm text-ggz-text-secondary">{point.detail}</p>}
                  {point.href && <Link href={point.href} className="mt-2 inline-block text-sm text-ggz-amber hover:underline">View details</Link>}
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-ggz-text-secondary">No public results match the current search and layers.</p>)}
        </section>
      </div>
    </section>
  );
}
