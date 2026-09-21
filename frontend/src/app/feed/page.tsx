"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface Post {
  id: number;
  author: { gamer_tag: string; avatar?: string | null };
  content: string;
  created_at: string;
  like_count: number;
  comment_count: number;
  liked?: boolean;
  saved?: boolean;
  image?: string | null;
  game?: string | null;
}

interface Game { id: number; name: string; }

function csrfToken() {
  if (typeof document === "undefined") return "";
  return document.cookie.match(/(?:^|; )csrftoken=([^;]+)/)?.[1] ?? "";
}

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [body, setBody] = useState("");
  const [game, setGame] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  async function loadFeed() {
    const res = await fetch("/api/feed/", {
      credentials: "include",
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });
    if (!res.ok) throw new Error("Unauthenticated");
    const data = await res.json();
    setPosts(Array.isArray(data) ? data : data.results ?? []);
  }

  useEffect(() => {
    Promise.all([
      loadFeed(),
      fetch("/api/games/", { credentials: "include" })
        .then((res) => res.json())
        .then((data) => setGames(data.results ?? data ?? []))
        .catch(() => setGames([])),
    ])
      .catch(() => setAuthError(true))
      .finally(() => setLoading(false));
  }, []);

  const hasPosts = useMemo(() => posts.length > 0, [posts]);

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() || publishing) return;
    setPublishing(true);
    try {
      if (!csrfToken()) await fetch("/api/csrf/", { credentials: "include" });
      const form = new FormData();
      form.append("body", body.trim());
      if (game) form.append("game", game);
      if (image) form.append("image", image);

      const res = await fetch("/api/feed/create/", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": csrfToken(), "X-Requested-With": "XMLHttpRequest" },
        body: form,
      });
      if (!res.ok) throw new Error("Post failed");
      setBody("");
      setGame("");
      setImage(null);
      await loadFeed();
    } catch {
      // Keep the draft so the user can retry.
    } finally {
      setPublishing(false);
    }
  }

  async function togglePost(postId: number, kind: "like" | "save") {
    if (actionId != null) return;
    setActionId(postId);
    try {
      if (!csrfToken()) await fetch("/api/csrf/", { credentials: "include" });
      const res = await fetch("/api/feed/posts/" + postId + "/" + kind + "/", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": csrfToken(), "X-Requested-With": "XMLHttpRequest" },
      });
      if (!res.ok) throw new Error("Action failed");
      const data = await res.json();
      setPosts((items) => items.map((item) =>
        item.id === postId
          ? {
              ...item,
              ...(kind === "like" ? { liked: data.liked, like_count: data.count } : { saved: data.saved }),
            }
          : item
      ));
    } finally {
      setActionId(null);
    }
  }

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-8 text-ggz-text-secondary">Loading community…</div>;
  if (authError) return <div className="mx-auto max-w-3xl px-4 py-16 text-center"><div className="rounded-2xl border border-ggz-border bg-ggz-bg-1 p-8"><h1 className="text-2xl font-bold text-ggz-text-primary">Community Feed</h1><p className="mt-2 text-ggz-text-secondary">Sign in to see and share with your GGz community.</p><Link href="/auth/login" className="mt-6 inline-flex rounded-xl bg-ggz-amber px-5 py-3 font-semibold text-black">Log in</Link></div></div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-ggz-amber">GGz Community</p><h1 className="mt-1 text-3xl font-bold text-ggz-text-primary">Feed</h1><p className="mt-1 text-sm text-ggz-text-secondary">Gaming posts, reactions and community activity.</p></div>

      <form onSubmit={publish} className="mb-5 rounded-2xl border border-ggz-border bg-ggz-bg-1 p-4">
        <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={4} placeholder="What is happening in your gaming world?" className="w-full resize-none rounded-xl border border-ggz-border bg-ggz-bg-2 px-4 py-3 text-sm leading-6 text-ggz-text-primary outline-none focus:border-ggz-amber" />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <select value={game} onChange={(event) => setGame(event.target.value)} className="h-10 rounded-xl border border-ggz-border bg-ggz-bg-2 px-3 text-sm text-ggz-text-primary outline-none focus:border-ggz-amber">
            <option value="">No game tag</option>
            {games.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <label className="flex h-10 cursor-pointer items-center rounded-xl border border-ggz-border bg-ggz-bg-2 px-3 text-sm text-ggz-text-secondary">
            <input type="file" accept="image/*" className="sr-only" onChange={(event: ChangeEvent<HTMLInputElement>) => setImage(event.target.files?.[0] ?? null)} />
            {image ? image.name : "Add image"}
          </label>
          <button type="submit" disabled={publishing || !body.trim()} className="ml-auto rounded-xl bg-ggz-amber px-5 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-40">{publishing ? "Posting…" : "Post"}</button>
        </div>
      </form>

      {!hasPosts ? (
        <div className="rounded-2xl border border-ggz-border bg-ggz-bg-1 p-12 text-center"><p className="font-semibold text-ggz-text-primary">Nothing here yet</p><p className="mt-2 text-sm text-ggz-text-secondary">Be the first GGz gamer to share something.</p></div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <article key={post.id} className="rounded-2xl border border-ggz-border bg-ggz-bg-1 p-5 transition hover:border-ggz-amber/30">
              <Link href={"/profiles/" + encodeURIComponent(post.author.gamer_tag)} className="flex items-center gap-3">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-ggz-bg-2">
                  {post.author.avatar ? <Image src={post.author.avatar} alt="" fill sizes="40px" className="object-cover" /> : <div className="flex h-full w-full items-center justify-center text-sm font-bold text-ggz-amber">{post.author.gamer_tag.slice(0, 1)}</div>}
                </div>
                <div><p className="font-semibold text-ggz-text-primary">{post.author.gamer_tag}</p><p className="text-xs text-ggz-text-muted">{new Date(post.created_at).toLocaleString()}</p></div>
              </Link>

              <Link href={"/feed/posts/" + post.id} className="block">
                <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-ggz-text-secondary">{post.content}</p>
                {post.game && <span className="mt-3 inline-flex rounded-full bg-purple-500/10 px-2.5 py-1 text-[11px] font-medium text-purple-300">{post.game}</span>}
                {post.image && <div className="relative mt-4 aspect-video overflow-hidden rounded-xl border border-ggz-border bg-ggz-bg-2"><Image src={post.image} alt="" fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover" /></div>}
              </Link>

              <div className="mt-4 flex items-center gap-2 border-t border-ggz-border pt-3">
                <button type="button" onClick={() => togglePost(post.id, "like")} className={"rounded-lg px-3 py-2 text-xs font-medium transition " + (post.liked ? "bg-ggz-amber/10 text-ggz-amber" : "text-ggz-text-muted hover:bg-ggz-bg-2 hover:text-ggz-text-primary")} disabled={actionId === post.id}>♥ {post.like_count}</button>
                <Link href={"/feed/posts/" + post.id} className="rounded-lg px-3 py-2 text-xs text-ggz-text-muted hover:bg-ggz-bg-2 hover:text-ggz-text-primary">Comments · {post.comment_count}</Link>
                <button type="button" onClick={() => togglePost(post.id, "save")} className={"ml-auto rounded-lg px-3 py-2 text-xs font-medium transition " + (post.saved ? "bg-purple-500/10 text-purple-300" : "text-ggz-text-muted hover:bg-ggz-bg-2 hover:text-ggz-text-primary")} disabled={actionId === post.id}>{post.saved ? "Saved" : "Save"}</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
