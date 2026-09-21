"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useState } from "react";

interface RosterEntry {
  gamer_tag: string;
  avatar?: string | null;
  role: string;
  is_owner: boolean;
}

interface TeamDetail {
  id: number;
  name: string;
  tag: string;
  slug: string;
  description?: string | null;
  location?: string | null;
  status: string;
  game_name?: string | null;
  logo?: string | null;
  banner?: string | null;
  owner_gamer_tag?: string | null;
  member_count: number;
  wins: number;
  losses: number;
  matches_played: number;
  win_rate: number;
  roster: RosterEntry[];
  viewer_role?: string | null;
  is_manager: boolean;
  is_member: boolean;
}

export default function TeamDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch("/api/teams/" + encodeURIComponent(slug) + "/", { credentials: "include" })
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data) => {
        if (data) setTeam(data);
      })
      .catch(() => setTeam(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-8 text-ggz-text-secondary">Loading team…</div>;
  if (notFound || !team)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-ggz-border bg-ggz-bg-1 p-8">
          <h1 className="text-2xl font-bold text-ggz-text-primary">Team not found</h1>
          <Link href="/teams" className="mt-6 inline-block rounded-xl bg-ggz-amber px-5 py-2 text-sm font-semibold text-black">Back to teams</Link>
        </div>
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/teams" className="text-sm text-ggz-text-muted hover:text-ggz-amber">← All teams</Link>
      <div className="mt-3 overflow-hidden rounded-2xl border border-ggz-border bg-ggz-bg-1">
        {team.banner ? (
          <div className="relative h-40 w-full sm:h-52">
            <Image src={team.banner} alt="" fill sizes="100vw" className="object-cover" />
          </div>
        ) : null}
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-ggz-bg-2">
              {team.logo ? <Image src={team.logo} alt={team.name} fill sizes="64px" className="object-cover" /> : <span className="flex h-full w-full items-center justify-center font-bold text-ggz-amber">{team.name.slice(0, 2)}</span>}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-ggz-text-primary sm:text-3xl">{team.name}</h1>
              <p className="mt-1 font-mono text-xs text-ggz-text-muted">[{team.tag}] · {team.game_name || "Any game"}</p>
            </div>
            <span className="ml-auto rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-400">{team.status}</span>
          </div>
          {team.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-ggz-text-secondary">{team.description}</p>}
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Members", team.member_count],
              ["Wins", team.wins],
              ["Losses", team.losses],
              ["Win rate", team.win_rate + "%"],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-ggz-border bg-ggz-bg-2 p-3">
                <p className="text-[10px] uppercase tracking-wide text-ggz-text-muted">{label}</p>
                <p className="mt-1 text-lg font-bold text-ggz-text-primary">{value}</p>
              </div>
            ))}
          </div>
          {team.is_manager && <p className="mt-4 text-sm text-ggz-amber">You manage this team.</p>}
        </div>
      </div>

      <section className="mt-5 rounded-2xl border border-ggz-border bg-ggz-bg-1 p-5">
        <h2 className="font-semibold text-ggz-text-primary">Roster ({team.roster.length})</h2>
        {team.roster.length === 0 ? (
          <p className="mt-3 text-sm text-ggz-text-muted">No members yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {team.roster.map((member) => (
              <li key={member.gamer_tag} className="flex items-center gap-3 rounded-xl border border-ggz-border bg-ggz-bg-2 p-3">
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-ggz-bg-1">
                  {member.avatar ? <Image src={member.avatar} alt="" fill sizes="36px" className="object-cover" /> : <span className="flex h-full w-full items-center justify-center text-xs font-bold text-ggz-amber">{member.gamer_tag.slice(0, 1)}</span>}
                </div>
                <Link href={"/profiles/" + encodeURIComponent(member.gamer_tag)} className="text-sm font-semibold text-ggz-text-primary hover:text-ggz-amber">{member.gamer_tag}</Link>
                <span className="ml-auto rounded-full bg-ggz-bg-1 px-2.5 py-1 text-[11px] text-ggz-text-muted">{member.is_owner ? "Owner" : member.role}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
