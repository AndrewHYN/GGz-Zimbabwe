"use client";

import { useState } from "react";
import { GamerCard, type GamerCardProps } from "@/components/cards/GamerCard";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { useDiscovery } from "@/lib/useDiscovery";

export default function GamersPage() {
  const [search, setSearch] = useState("");
  const { data, error, loading, retry } = useDiscovery<(GamerCardProps & { id: number })[]>("/api/profiles/gamers/");
  const query = search.trim().toLowerCase();
  const gamers = data?.filter((gamer) =>
    !query || [gamer.gamer_tag, gamer.location, gamer.platform, gamer.rank, gamer.availability]
      .some((value) => value?.toLowerCase().includes(query)),
  );

  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-bold">Find Players</h1>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Find gamers"
          placeholder="Gamer tag, city, or platform"
          className="h-11 w-full rounded-xl border border-ggz-border bg-ggz-bg-2 px-3 text-sm focus:border-ggz-amber sm:max-w-sm" />
      </div>
      {loading && <p role="status" className="text-ggz-text-secondary">Loading gamers…</p>}
      {error ? (
        <ErrorState title="Gamer discovery is unavailable" message="Try loading player profiles again." onRetry={retry} />
      ) : gamers?.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {gamers.map(({ id, ...gamer }) => <GamerCard key={id} {...gamer} />)}
        </div>
      ) : !loading && (
        <div className="rounded-xl border border-ggz-border bg-ggz-bg-1 p-5">
          <p className="text-sm text-ggz-text-secondary">{query ? "No gamers match that search." : "There are no gamers to show yet."}</p>
          {query && <Button variant="secondary" size="sm" onClick={() => setSearch("")} className="mt-3">Clear search</Button>}
        </div>
      )}
    </section>
  );
}
