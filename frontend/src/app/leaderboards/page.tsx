"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface Entry {
  rank: number;
  gamer_tag: string;
  avatar?: string | null;
  respect_points?: number;
  tournament_wins?: number;
  game_count?: number;
  rank_label?: string;
  wins?: number;
  matches?: number;
  win_percentage?: number;
  game?: string;
}

interface Game { id: number; name: string; }

export default function LeaderboardsPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [game, setGame] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/games/", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setGames(data.results ?? data ?? []))
      .catch(() => setGames([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch("/api/leaderboards/" + (game ? "?game=" + encodeURIComponent(game) : ""), { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Leaderboard unavailable");
        return res.json();
      })
      .then((data) => setEntries(data.results ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [game]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ggz-amber">GGz Rankings</p>
          <h1 className="mt-1 text-3xl font-bold text-ggz-text-primary">{game ? "Game leaderboard" : "Community leaderboard"}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ggz-text-secondary">Rankings use real GGz profile and competition data rather than placeholder scores.</p>
        </div>
        <select value={game} onChange={(e) => setGame(e.target.value)} className="h-10 rounded-xl border border-ggz-border bg-ggz-bg-2 px-3 text-sm text-ggz-text-primary outline-none focus:border-ggz-amber">
          <option value="">Global rankings</option>
          {games.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-ggz-border bg-ggz-bg-1">
        <div className="grid grid-cols-[48px_1fr_auto] gap-3 border-b border-ggz-border px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-ggz-text-muted sm:grid-cols-[64px_1fr_140px_140px]">
          <span>#</span><span>Gamer</span><span className="hidden sm:block">Score</span><span className="text-right">Record</span>
        </div>
        {loading ? <div className="p-8 text-center text-sm text-ggz-text-secondary">Loading rankings…</div> : entries.length === 0 ? <div className="p-8 text-center text-sm text-ggz-text-secondary">No leaderboard entries yet.</div> : entries.map((entry) => (
          <Link key={entry.gamer_tag + "-" + entry.rank} href={"/profiles/" + encodeURIComponent(entry.gamer_tag)} className="grid grid-cols-[48px_1fr_auto] gap-3 border-b border-ggz-border/70 px-4 py-4 transition hover:bg-ggz-bg-2 sm:grid-cols-[64px_1fr_140px_140px]">
            <span className="self-center text-sm font-bold text-ggz-amber">{entry.rank}</span>
            <span className="flex min-w-0 items-center gap-3">
              <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-ggz-bg-2">
                {entry.avatar ? <Image src={entry.avatar} alt="" fill sizes="40px" className="object-cover" /> : <span className="flex h-full w-full items-center justify-center text-sm font-bold text-ggz-amber">{entry.gamer_tag.slice(0, 1)}</span>}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-ggz-text-primary">{entry.gamer_tag}</span>
                <span className="block text-xs text-ggz-text-muted">{entry.rank_label || entry.game || "GGz player"}</span>
              </span>
            </span>
            <span className="hidden self-center text-sm text-ggz-text-secondary sm:block">{game ? (entry.wins ?? 0) + " wins" : (entry.respect_points ?? 0) + " respect"}</span>
            <span className="self-center text-right text-xs text-ggz-text-muted">{game ? (entry.win_percentage ?? 0) + "%" : (entry.tournament_wins ?? 0) + " tournament wins"}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
