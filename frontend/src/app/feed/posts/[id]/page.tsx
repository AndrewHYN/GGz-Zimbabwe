"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useState } from "react";

interface Comment {
  id: number;
  author: { gamer_tag: string; avatar?: string | null };
  body: string;
  created_at?: string | null;
}

interface PostDetail {
  id: number;
  author: { gamer_tag: string; avatar?: string | null };
  content: string;
  created_at?: string | null;
  like_count: number;
  comment_count: number;
  liked?: boolean;
  saved?: boolean;
  image?: string | null;
  game?: string | null;
  comments: Comment[];
}

function csrfToken() {
  if (typeof document === "undefined") return "";
  return document.cookie.match(/(?:^|; )csrftoken=([^;]+)/)?.[1] ?? "";
}

async function ensureCsrf() {
  if (!csrfToken()) await fetch("/api/csrf/", { credentials: "include" });
}

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/feed/posts/" + encodeURIComponent(id) + "/", { credentials: "include" })
      .then((res) => {
        if (cancelled) return null;
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!res.ok) throw new Error("Failed");
        return res.json() as Promise<PostDetail>;
      })
      .then((detail) => {
        if (!cancelled && detail) setPost(detail);
      })
      .catch(() => {
        if (!cancelled) setPost(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, version]);

  async function togglePost(kind: "like" | "save" | "report") {
    if (!post || action) return;
    setAction(kind);
    setNotice("");
    try {
      await ensureCsrf();
      const res = await fetch("/api/feed/posts/" + post.id + "/" + kind + "/", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": csrfToken(), "X-Requested-With": "XMLHttpRequest" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Action failed");
      if (kind === "like") setPost({ ...post, liked: data.liked, like_count: data.count ?? post.like_count });
      if (kind === "save") setPost({ ...post, saved: data.saved });
      if (kind === "report") setNotice(data.message || "Thanks — our moderators will review this post.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Action failed");
    } finally {
      setAction(null);
    }
  }

  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    const body = comment.trim();
    if (!post || !body || action) return;
    setAction("comment");
    setNotice("");
    try {
      await ensureCsrf();
      const res = await fetch("/api/feed/posts/" + post.id + "/comments/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken(), "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Comment failed");
      setComment("");
      setVersion((value) => value + 1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Comment failed");
    } finally {
      setAction(null);
    }
  }

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-8 text-ggz-text-secondary">Loading post…</div>;
  if (notFound || !post)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-ggz-border bg-ggz-bg-1 p-8">
          <h1 className="text-2xl font-bold text-ggz-text-primary">Post not found</h1>
          <Link href="/feed" className="mt-6 inline-block rounded-xl bg-ggz-amber px-5 py-2 text-sm font-semibold text-black">Back to feed</Link>
        </div>
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/feed" className="text-sm text-ggz-text-muted hover:text-ggz-amber">← Back to feed</Link>
      <article className="mt-3 rounded-2xl border border-ggz-border bg-ggz-bg-1 p-5">
        <Link href={"/profiles/" + encodeURIComponent(post.author.gamer_tag)} className="flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-ggz-bg-2">
            {post.author.avatar ? <Image src={post.author.avatar} alt="" fill sizes="40px" className="object-cover" /> : <div className="flex h-full w-full items-center justify-center text-sm font-bold text-ggz-amber">{post.author.gamer_tag.slice(0, 1)}</div>}
          </div>
          <div>
            <p className="font-semibold text-ggz-text-primary">{post.author.gamer_tag}</p>
            <p className="text-xs text-ggz-text-muted">{post.created_at ? new Date(post.created_at).toLocaleString() : ""}</p>
          </div>
        </Link>
        <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-ggz-text-secondary">{post.content}</p>
        {post.game && <span className="mt-3 inline-flex rounded-full bg-purple-500/10 px-2.5 py-1 text-[11px] font-medium text-purple-300">{post.game}</span>}
        {post.image && <div className="relative mt-4 aspect-video overflow-hidden rounded-xl border border-ggz-border bg-ggz-bg-2"><Image src={post.image} alt="" fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover" /></div>}
        <div className="mt-4 flex items-center gap-2 border-t border-ggz-border pt-3">
          <button type="button" onClick={() => togglePost("like")} disabled={action != null} className={"rounded-lg px-3 py-2 text-xs font-medium transition " + (post.liked ? "bg-ggz-amber/10 text-ggz-amber" : "text-ggz-text-muted hover:bg-ggz-bg-2 hover:text-ggz-text-primary")}>♥ {post.like_count}</button>
          <button type="button" onClick={() => togglePost("save")} disabled={action != null} className={"rounded-lg px-3 py-2 text-xs font-medium transition " + (post.saved ? "bg-purple-500/10 text-purple-300" : "text-ggz-text-muted hover:bg-ggz-bg-2 hover:text-ggz-text-primary")}>{post.saved ? "Saved" : "Save"}</button>
          <button type="button" onClick={() => togglePost("report")} disabled={action != null} className="ml-auto rounded-lg px-3 py-2 text-xs text-ggz-text-muted transition hover:bg-ggz-bg-2 hover:text-ggz-text-primary">Report</button>
        </div>
        {notice && <p className="mt-3 text-sm text-ggz-text-secondary" role="status">{notice}</p>}
      </article>

      <section className="mt-4 rounded-2xl border border-ggz-border bg-ggz-bg-1 p-5">
        <h2 className="font-semibold text-ggz-text-primary">Comments ({post.comments.length})</h2>
        <form onSubmit={submitComment} className="mt-3 flex gap-2">
          <input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="Write a comment…" className="h-10 min-w-0 flex-1 rounded-xl border border-ggz-border bg-ggz-bg-2 px-4 text-sm text-ggz-text-primary outline-none focus:border-ggz-amber" />
          <button type="submit" disabled={action != null || !comment.trim()} className="rounded-xl bg-ggz-amber px-4 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-40">
            {action === "comment" ? "…" : "Reply"}
          </button>
        </form>
        <div className="mt-4 space-y-3">
          {post.comments.length === 0 && <p className="text-sm text-ggz-text-muted">No comments yet. Start the conversation.</p>}
          {post.comments.map((item) => (
            <div key={item.id} className="flex gap-3 rounded-xl border border-ggz-border bg-ggz-bg-2 p-3">
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-ggz-bg-1">
                {item.author.avatar ? <Image src={item.author.avatar} alt="" fill sizes="32px" className="object-cover" /> : <span className="flex h-full w-full items-center justify-center text-xs font-bold text-ggz-amber">{item.author.gamer_tag.slice(0, 1)}</span>}
              </div>
              <div className="min-w-0">
                <p className="text-xs"><Link href={"/profiles/" + encodeURIComponent(item.author.gamer_tag)} className="font-semibold text-ggz-text-primary hover:text-ggz-amber">{item.author.gamer_tag}</Link> <span className="text-ggz-text-muted">{item.created_at ? new Date(item.created_at).toLocaleString() : ""}</span></p>
                <p className="mt-1 break-words text-sm text-ggz-text-secondary">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
