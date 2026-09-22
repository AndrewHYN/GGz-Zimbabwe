"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Game { id: number; name: string; cover_art_url?: string | null; platform?: string | null; }
interface ProfileData {
  id: number; gamer_tag: string; username: string; avatar?: string | null; cover?: string | null; bio?: string | null; location?: string | null;
  platform?: string | null; rank: string; availability: string; respect_points: number; respect_level: string; tournament_wins: number;
  matches_played: number; match_wins: number; win_percentage: number; follower_count: number; following_count: number; is_following: boolean;
  is_friend: boolean; is_self: boolean; presence: string; games: Game[];
}
interface ProfilePageProps { params: Promise<{ gamerTag: string }>; }

function csrfToken() {
  if (typeof document === "undefined") return "";
  return document.cookie.match(/(?:^|; )csrftoken=([^;]+)/)?.[1] ?? "";
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const { gamerTag } = use(params);
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profiles/detail/" + encodeURIComponent(gamerTag) + "/", { credentials: "include", headers: { "X-Requested-With": "XMLHttpRequest" } })
      .then((res) => {
        if (cancelled) return null;
        if (!res.ok) throw new Error("Not found");
        return res.json() as Promise<ProfileData>;
      })
      .then((data) => {
        if (!cancelled && data) setProfile(data);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gamerTag, version]);

  async function profileAction(kind: string) {
    if (!profile || action) return;
    setAction(kind);
    setNotice("");
    try {
      if (!csrfToken()) await fetch("/api/csrf/", { credentials: "include" });
      const res = await fetch("/api/profiles/" + encodeURIComponent(profile.gamer_tag) + "/" + kind + "/", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": csrfToken(), "X-Requested-With": "XMLHttpRequest" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || "Action failed");
      if (kind === "follow" || kind === "unfollow" || kind === "block" || kind === "unblock" || kind === "respect") {
        setVersion((value) => value + 1);
      }
      setNotice(data.message || (kind === "respect" ? "Respect sent." : "Community action updated."));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Action failed");
    } finally {
      setAction("");
    }
  }

  async function startMessage() {
    if (!profile || action) return;
    setAction("message");
    setNotice("");
    try {
      if (!csrfToken()) await fetch("/api/csrf/", { credentials: "include" });
      const res = await fetch("/api/messages/start/" + encodeURIComponent(profile.gamer_tag) + "/", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": csrfToken(), "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || "Unable to start conversation");
      if (data.conversation_id) {
        router.push("/messages");
      } else {
        setNotice(data.message || "Message request sent.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to start conversation");
    } finally {
      setAction("");
    }
  }

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-8 text-ggz-text-secondary">Loading profile…</div>;
  if (!profile) return <div className="mx-auto max-w-3xl px-4 py-16 text-center"><div className="rounded-2xl border border-ggz-border bg-ggz-bg-1 p-8"><h1 className="text-2xl font-bold text-ggz-text-primary">Profile not found</h1><p className="mt-2 text-sm text-ggz-text-secondary">That gamer tag does not exist.</p></div></div>;

  const stats = [
    ["Followers", profile.follower_count], ["Following", profile.following_count], ["Respect", profile.respect_points],
    ["Wins", profile.match_wins], ["Matches", profile.matches_played], ["Win rate", profile.win_percentage + "%"], ["Tournament wins", profile.tournament_wins],
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="overflow-hidden rounded-2xl border border-ggz-border bg-ggz-bg-1">
        <div className="relative h-40 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.18),transparent_34%),linear-gradient(135deg,#17111f,#0f1720)] sm:h-56">
          {profile.cover && <Image src={profile.cover} alt="" fill priority sizes="100vw" className="object-cover opacity-70" />}
          <div className="absolute inset-0 bg-gradient-to-t from-ggz-bg-1 via-black/5 to-transparent" />
        </div>

        <div className="relative px-5 pb-6 sm:px-8">
          <div className="-mt-12 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:items-end">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-ggz-bg-1 bg-ggz-bg-2 sm:h-32 sm:w-32">
              {profile.avatar ? <Image src={profile.avatar} alt={profile.gamer_tag} fill sizes="128px" className="object-cover" /> : <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-ggz-amber">{profile.gamer_tag.slice(0, 1)}</div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-ggz-text-primary sm:text-3xl">{profile.gamer_tag}</h1>
                <span className={"h-2.5 w-2.5 rounded-full " + (profile.presence === "online" ? "bg-emerald-400" : "bg-zinc-500")} />
              </div>
              <p className="mt-1 text-sm text-ggz-text-secondary">@{profile.username} · {profile.location || "Zimbabwe"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-xl bg-ggz-amber/10 px-3 py-2 text-xs font-semibold text-ggz-amber">{profile.availability}</span>
              <span className="rounded-xl bg-purple-500/10 px-3 py-2 text-xs font-semibold text-purple-300">{profile.rank}</span>
            </div>
          </div>

          {profile.bio && <p className="mt-5 max-w-3xl text-sm leading-6 text-ggz-text-secondary">{profile.bio}</p>}

          {!profile.is_self && (
            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={() => profileAction(profile.is_following ? "unfollow" : "follow")} disabled={!!action} className={"rounded-xl px-4 py-2 text-sm font-semibold transition " + (profile.is_following ? "border border-ggz-border bg-ggz-bg-2 text-ggz-text-primary hover:border-ggz-amber/50" : "bg-ggz-amber text-black hover:brightness-110")}>{action === "follow" || action === "unfollow" ? "Saving…" : profile.is_following ? "Following" : "Follow"}</button>
              <button onClick={startMessage} disabled={!!action} className="rounded-xl border border-ggz-border bg-ggz-bg-2 px-4 py-2 text-sm font-semibold text-ggz-text-primary transition hover:border-ggz-amber/50">{action === "message" ? "Opening…" : "Message"}</button>
              <button onClick={() => profileAction("respect")} disabled={!!action} className="rounded-xl border border-ggz-border bg-ggz-bg-2 px-4 py-2 text-sm font-semibold text-ggz-text-primary transition hover:border-ggz-amber/50">{action === "respect" ? "Sending…" : "Give Respect"}</button>
              <button onClick={() => profileAction("report")} disabled={!!action} className="rounded-xl px-3 py-2 text-sm text-ggz-text-muted transition hover:bg-ggz-bg-2 hover:text-ggz-text-primary">Report</button>
              <button onClick={() => profileAction("block")} disabled={!!action} className="rounded-xl px-3 py-2 text-sm text-red-400 transition hover:bg-red-400/10">Block</button>
            </div>
          )}

          {notice && <p className="mt-3 text-sm text-ggz-text-secondary" role="status">{notice}</p>}

          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{stats.map(([label, value]) => <div key={String(label)} className="rounded-xl border border-ggz-border bg-ggz-bg-2 p-3"><p className="text-[10px] uppercase tracking-wide text-ggz-text-muted">{label}</p><p className="mt-1 text-lg font-bold text-ggz-text-primary">{value}</p></div>)}</div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
            <section>
              <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-ggz-text-primary">Games</h2><Link href="/games" className="text-xs font-semibold text-ggz-amber">Browse all</Link></div>
              {profile.games.length === 0 ? <div className="mt-3 rounded-xl border border-ggz-border bg-ggz-bg-2 p-6 text-sm text-ggz-text-secondary">No games added yet.</div> : <div className="mt-3 grid gap-3 sm:grid-cols-2">{profile.games.map((game) => <Link key={game.id} href={"/games/" + game.id} className="flex items-center gap-3 rounded-xl border border-ggz-border bg-ggz-bg-2 p-3 transition hover:border-ggz-amber/40"><div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-ggz-bg-1">{game.cover_art_url ? <Image src={game.cover_art_url} alt="" fill sizes="48px" className="object-cover" /> : <span className="flex h-full w-full items-center justify-center text-xs text-ggz-text-muted">GGz</span>}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-ggz-text-primary">{game.name}</p><p className="text-xs text-ggz-text-muted">{game.platform || "Gaming profile"}</p></div></Link>)}</div>}
            </section>

            <aside className="rounded-2xl border border-ggz-border bg-ggz-bg-2 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ggz-text-muted">Reputation</p>
              <p className="mt-2 text-2xl font-bold text-ggz-amber">{profile.respect_level}</p>
              <p className="mt-1 text-sm text-ggz-text-secondary">{profile.respect_points} Respect points</p>
              <div className="mt-5 space-y-2 text-xs text-ggz-text-secondary"><p><span className="text-ggz-text-muted">Platform:</span> {profile.platform || "Not set"}</p><p><span className="text-ggz-text-muted">Presence:</span> {profile.presence}</p><p><span className="text-ggz-text-muted">Relationship:</span> {profile.is_friend ? "Friend" : profile.is_following ? "Following" : "Community member"}</p></div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
