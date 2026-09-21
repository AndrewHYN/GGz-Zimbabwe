"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Game {
  id: number;
  name: string;
}

function csrfToken() {
  if (typeof document === "undefined") return "";
  return document.cookie.match(/(?:^|; )csrftoken=([^;]+)/)?.[1] ?? "";
}

export default function TeamCreatePage() {
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");
  const [game, setGame] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/games/", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setGames(data.results ?? data ?? []))
      .catch(() => setGames([]));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      if (!csrfToken()) await fetch("/api/csrf/", { credentials: "include" });
      const form = new FormData();
      form.append("name", name.trim());
      form.append("tag", tag.trim());
      form.append("description", description.trim());
      if (game) form.append("game", game);
      const res = await fetch("/api/teams/create/", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": csrfToken(), "X-Requested-With": "XMLHttpRequest" },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const details = data.errors ? " " + Object.values(data.errors).flat().join(" ") : "";
        throw new Error((data.error || "Team creation failed.") + details);
      }
      router.push("/teams/" + encodeURIComponent(data.slug));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Team creation failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/teams" className="text-sm text-ggz-text-muted hover:text-ggz-amber">← All teams</Link>
      <div className="mt-3 rounded-2xl border border-ggz-border bg-ggz-bg-1 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ggz-amber">Squad builder</p>
        <h1 className="mt-1 text-2xl font-bold text-ggz-text-primary">Create a team</h1>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="team-name" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ggz-text-muted">Team name</label>
            <input id="team-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} placeholder="e.g. Harare Kings" className="h-11 w-full rounded-xl border border-ggz-border bg-ggz-bg-2 px-4 text-sm text-ggz-text-primary outline-none focus:border-ggz-amber" />
          </div>
          <div>
            <label htmlFor="team-tag" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ggz-text-muted">Tag</label>
            <input id="team-tag" value={tag} onChange={(e) => setTag(e.target.value)} required maxLength={12} placeholder="e.g. HK" className="h-11 w-full rounded-xl border border-ggz-border bg-ggz-bg-2 px-4 text-sm text-ggz-text-primary outline-none focus:border-ggz-amber" />
          </div>
          <div>
            <label htmlFor="team-game" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ggz-text-muted">Game (optional)</label>
            <select id="team-game" value={game} onChange={(e) => setGame(e.target.value)} className="h-11 w-full rounded-xl border border-ggz-border bg-ggz-bg-2 px-3 text-sm text-ggz-text-primary outline-none focus:border-ggz-amber">
              <option value="">Any game</option>
              {games.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="team-description" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ggz-text-muted">Description</label>
            <textarea id="team-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="What is this squad about?" className="w-full resize-none rounded-xl border border-ggz-border bg-ggz-bg-2 px-4 py-3 text-sm leading-6 text-ggz-text-primary outline-none focus:border-ggz-amber" />
          </div>
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          <button type="submit" disabled={saving || !name.trim() || !tag.trim()} className="rounded-xl bg-ggz-amber px-5 py-2.5 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-40">
            {saving ? "Creating…" : "Create team"}
          </button>
        </form>
      </div>
    </div>
  );
}
