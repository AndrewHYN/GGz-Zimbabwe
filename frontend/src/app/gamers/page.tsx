"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface Gamer {
  id: number;
  gamer_tag: string;
  avatar?: string | null;
  location?: string;
  platform?: string;
  bio?: string;
  rank?: string;
  availability?: string;
  respect_points?: number;
  presence?: string;
  game_count?: number;
  win_percentage?: number;
}

export default function GamersPage() {
  const [gamers, setGamers] = useState<Gamer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profiles/gamers/", { credentials: "include" })
      .then((res) => { if (!res.ok) throw new Error("Failed"); return res.json(); })
      .then(setGamers)
      .catch(() => setGamers([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return gamers;
    return gamers.filter((gamer) => [gamer.gamer_tag, gamer.location, gamer.platform, gamer.rank, gamer.availability].filter(Boolean).some((value) => String(value).toLowerCase().includes(q)));
  }, [gamers, search]);

  if (loading) return <div className="mx-auto max-w-7xl px-4 py-8 text-ggz-text-secondary">Loading gamers…</div>;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-ggz-amber">Discovery</p><h1 className="mt-1 text-3xl font-bold text-ggz-text-primary">Find Players</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-ggz-text-secondary">Find gamers by identity, location, platform and competitive profile.</p></div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search gamers…" className="h-11 w-full rounded-xl border border-ggz-border bg-ggz-bg-2 px-4 text-sm text-ggz-text-primary outline-none focus:border-ggz-amber md:max-w-sm" />
      </div>
      {filtered.length === 0 ? <div className="rounded-2xl border border-ggz-border bg-ggz-bg-1 p-12 text-center text-sm text-ggz-text-secondary">No gamers match that search.</div> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{filtered.map((gamer) => (
        <Link key={gamer.id} href={"/profiles/" + encodeURIComponent(gamer.gamer_tag)} className="group rounded-2xl border border-ggz-border bg-ggz-bg-1 p-5 transition hover:-translate-y-0.5 hover:border-ggz-amber/40">
          <div className="flex items-start gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-ggz-bg-2">{gamer.avatar ? <Image src={gamer.avatar} alt="" fill sizes="48px" className="object-cover" /> : <div className="flex h-full w-full items-center justify-center font-bold text-ggz-amber">{gamer.gamer_tag.slice(0, 1)}</div>}</div>
            <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="truncate font-semibold text-ggz-text-primary group-hover:text-ggz-amber">{gamer.gamer_tag}</h2>{gamer.presence === "online" && <span className="h-2 w-2 rounded-full bg-emerald-400" />}</div><p className="mt-1 text-xs text-ggz-text-secondary">{gamer.location || "Location hidden"} · {gamer.platform || "Platform not set"}</p></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px]">{gamer.rank && <span className="rounded-full bg-purple-500/10 px-2.5 py-1 text-purple-300">{gamer.rank}</span>}{gamer.availability && <span className="rounded-full bg-ggz-amber/10 px-2.5 py-1 text-ggz-amber">{gamer.availability}</span>}{gamer.respect_points != null && <span className="rounded-full bg-ggz-bg-2 px-2.5 py-1 text-ggz-text-secondary">{gamer.respect_points} respect</span>}</div>
          <div className="mt-4 border-t border-ggz-border pt-3 text-xs text-ggz-text-muted">{gamer.game_count ?? 0} games <span className="mx-2">·</span>{gamer.win_percentage ?? 0}% match win rate</div>
          {gamer.bio && <p className="mt-3 line-clamp-2 text-sm leading-6 text-ggz-text-secondary">{gamer.bio}</p>}
        </Link>
      ))}</div>}
    </div>
  );
}
