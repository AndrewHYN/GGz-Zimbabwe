"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Me {
  user: { username: string };
  profile?: { gamer_tag?: string | null };
}

const features = [
  ["Find Players", "/gamers", "Discover gamers by identity, location, platform and rank."],
  ["Games", "/games", "Browse games, artwork, ratings and community activity."],
  ["Compete", "/tournaments", "Join tournaments, follow matches and track results."],
  ["Squads", "/teams", "Build teams, invite players and manage rosters."],
  ["Community", "/feed", "Share posts and follow what the GGz community is doing."],
  ["Radar", "/discover", "Explore real gaming locations, events and tournament hotspots."],
  ["Events", "/events", "Find online and local gaming events."],
  ["Marketplace", "/marketplace", "Buy, sell and save gaming gear."],
  ["Rankings", "/leaderboards", "See respect, tournament and game performance."],
  ["Messages", "/messages", "Keep GGz conversations in one place."],
] as const;

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me/", { credentials: "include", headers: { "X-Requested-With": "XMLHttpRequest" } })
      .then((res) => {
        if (!res.ok) throw new Error("Unauthenticated");
        return res.json();
      })
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="mx-auto max-w-7xl px-4 py-10 text-ggz-text-secondary">Loading dashboard…</div>;

  if (!me) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-ggz-border bg-ggz-bg-1 p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ggz-amber">GGz 2.0</p>
          <h1 className="mt-3 text-3xl font-bold text-ggz-text-primary">Your gaming command center</h1>
          <p className="mt-3 text-ggz-text-secondary">Sign in to manage your profile, community activity, squads, tournaments and messages.</p>
          <Link href="/auth/login" className="mt-6 inline-flex rounded-xl bg-ggz-amber px-5 py-3 font-semibold text-black hover:brightness-110">Log in</Link>
        </div>
      </div>
    );
  }

  const name = me.profile?.gamer_tag || me.user.username;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <section className="overflow-hidden rounded-2xl border border-ggz-border bg-ggz-bg-1">
        <div className="relative border-b border-ggz-border px-6 py-8 sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.13),transparent_35%),radial-gradient(circle_at_top_left,rgba(139,92,246,0.12),transparent_38%)]" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ggz-amber">Player dashboard</p>
            <h1 className="mt-2 text-3xl font-bold text-ggz-text-primary">Welcome back, {name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ggz-text-secondary">Everything that makes GGz useful is one step away. Discover gamers, play, compete, meet up, trade gear and stay connected.</p>
          </div>
        </div>

        <div className="grid gap-px bg-ggz-border sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([label, href, detail]) => (
            <Link key={href} href={href} className="group bg-ggz-bg-1 p-5 transition hover:bg-ggz-bg-2">
              <p className="font-semibold text-ggz-text-primary transition-colors group-hover:text-ggz-amber">{label}</p>
              <p className="mt-1 text-sm leading-6 text-ggz-text-secondary">{detail}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
