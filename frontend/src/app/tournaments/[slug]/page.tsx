"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

interface Participant {
  gamer_tag: string;
  avatar?: string | null;
  status: string;
}

interface Match {
  id: number;
  round: number;
  status: string;
  score?: string | null;
  player_one?: string | null;
  player_two?: string | null;
  winner?: string | null;
}

interface TournamentDetail {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  rules?: string | null;
  format: string;
  status: string;
  mode: string;
  entry_type: string;
  prize_description?: string | null;
  game_name?: string | null;
  location?: string | null;
  city?: string | null;
  start_date?: string | null;
  registration_deadline?: string | null;
  max_participants: number;
  participant_count: number;
  organizer: { gamer_tag?: string | null; avatar?: string | null };
  is_organizer: boolean;
  registration_status?: string | null;
  participants: Participant[];
  matches: Match[];
}

function csrfToken() {
  if (typeof document === "undefined") return "";
  return document.cookie.match(/(?:^|; )csrftoken=([^;]+)/)?.[1] ?? "";
}

export default function TournamentDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [action, setAction] = useState(false);
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tournaments/" + encodeURIComponent(slug) + "/", { credentials: "include" })
      .then((res) => {
        if (cancelled) return null;
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!res.ok) throw new Error("Failed");
        return res.json() as Promise<TournamentDetail>;
      })
      .then((detail) => {
        if (!cancelled && detail) setTournament(detail);
      })
      .catch(() => {
        if (!cancelled) setTournament(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, version]);

  async function mutate(kind: "register" | "leave") {
    if (!tournament || action) return;
    setAction(true);
    setNotice("");
    try {
      if (!csrfToken()) await fetch("/api/csrf/", { credentials: "include" });
      const res = await fetch("/api/tournaments/" + encodeURIComponent(slug) + "/" + kind + "/", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": csrfToken(), "X-Requested-With": "XMLHttpRequest" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || "Action failed");
      setNotice(data.message || (kind === "register" ? "Registered." : "Registration withdrawn."));
      setVersion((value) => value + 1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Action failed");
    } finally {
      setAction(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-8 text-ggz-text-secondary">Loading tournament…</div>;
  if (notFound || !tournament)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-ggz-border bg-ggz-bg-1 p-8">
          <h1 className="text-2xl font-bold text-ggz-text-primary">Tournament not found</h1>
          <Link href="/tournaments" className="mt-6 inline-block rounded-xl bg-ggz-amber px-5 py-2 text-sm font-semibold text-black">Back to tournaments</Link>
        </div>
      </div>
    );

  const registered = tournament.registration_status === "Registered";
  const registrationOpen = tournament.status === "Registration Open";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/tournaments" className="text-sm text-ggz-text-muted hover:text-ggz-amber">← All tournaments</Link>
      <div className="mt-3 rounded-2xl border border-ggz-border bg-ggz-bg-1 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ggz-amber">{tournament.game_name || "GGz tournament"}</p>
        <h1 className="mt-1 text-3xl font-bold text-ggz-text-primary">{tournament.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-purple-500/15 px-2.5 py-1 text-purple-300">{tournament.format}</span>
          <span className="rounded-full bg-ggz-amber/20 px-2.5 py-1 text-ggz-amber">{tournament.status}</span>
          <span className="rounded-full bg-ggz-bg-2 px-2.5 py-1 text-ggz-text-secondary capitalize">{tournament.mode}</span>
        </div>
        {tournament.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-ggz-text-secondary">{tournament.description}</p>}
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <p className="text-ggz-text-secondary">Starts: <span className="text-ggz-text-primary">{tournament.start_date ? new Date(tournament.start_date).toLocaleString() : "TBD"}</span></p>
          <p className="text-ggz-text-secondary">Players: <span className="text-ggz-text-primary">{tournament.participant_count} / {tournament.max_participants}</span></p>
          <p className="text-ggz-text-secondary">Entry: <span className="text-ggz-text-primary">{tournament.entry_type}</span></p>
          <p className="text-ggz-text-secondary">Organizer: <span className="text-ggz-text-primary">{tournament.organizer.gamer_tag || "GGz"}</span></p>
        </div>
        {tournament.prize_description && <p className="mt-3 text-sm text-ggz-amber">Prize: {tournament.prize_description}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          {registered ? (
            <button onClick={() => mutate("leave")} disabled={action} className="rounded-xl border border-ggz-border bg-ggz-bg-2 px-5 py-2 text-sm font-semibold text-ggz-text-primary hover:border-red-400/50 disabled:opacity-40">
              {action ? "Working…" : "Leave tournament"}
            </button>
          ) : registrationOpen ? (
            <button onClick={() => mutate("register")} disabled={action} className="rounded-xl bg-ggz-amber px-5 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-40">
              {action ? "Working…" : "Register"}
            </button>
          ) : (
            <span className="text-sm text-ggz-text-muted">Registration is currently {tournament.status.toLowerCase()}.</span>
          )}
        </div>
        {notice && <p className="mt-3 text-sm text-ggz-text-secondary" role="status">{notice}</p>}
        {tournament.rules && (
          <div className="mt-6 border-t border-ggz-border pt-4">
            <h2 className="font-semibold text-ggz-text-primary">Rules</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ggz-text-secondary">{tournament.rules}</p>
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-ggz-border bg-ggz-bg-1 p-5">
          <h2 className="font-semibold text-ggz-text-primary">Participants ({tournament.participants.length})</h2>
          {tournament.participants.length === 0 ? (
            <p className="mt-3 text-sm text-ggz-text-muted">No registrations yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {tournament.participants.map((player) => (
                <li key={player.gamer_tag}>
                  <Link href={"/profiles/" + encodeURIComponent(player.gamer_tag)} className="text-sm text-ggz-text-secondary hover:text-ggz-amber">{player.gamer_tag}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border border-ggz-border bg-ggz-bg-1 p-5">
          <h2 className="font-semibold text-ggz-text-primary">Bracket ({tournament.matches.length})</h2>
          {tournament.matches.length === 0 ? (
            <p className="mt-3 text-sm text-ggz-text-muted">Bracket has not been generated yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {tournament.matches.map((match) => (
                <li key={match.id} className="rounded-xl border border-ggz-border bg-ggz-bg-2 p-3 text-sm">
                  <p className="text-ggz-text-primary">Round {match.round} · {match.status}</p>
                  <p className="mt-1 text-ggz-text-secondary">{match.player_one || "TBD"} vs {match.player_two || "TBD"}</p>
                  {match.score && <p className="mt-1 text-xs text-ggz-text-muted">Score: {match.score}{match.winner ? " · Winner: " + match.winner : ""}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
