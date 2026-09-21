"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface Post {
  id: number;
  author: { gamer_tag: string; avatar?: string | null };
  content: string;
  created_at: string;
  like_count: number;
  comment_count: number;
}

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    fetch("/api/feed/", { credentials: "include", headers: { "X-Requested-With": "XMLHttpRequest" } })
      .then((res) => { if (!res.ok) throw new Error("Unauthenticated"); return res.json(); })
      .then((data) => setPosts(Array.isArray(data) ? data : data.results ?? []))
      .catch(() => setAuthError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-8 text-ggz-text-secondary">Loading community…</div>;
  if (authError) return <div className="mx-auto max-w-3xl px-4 py-16 text-center"><div className="rounded-2xl border border-ggz-border bg-ggz-bg-1 p-8"><h1 className="text-2xl font-bold text-ggz-text-primary">Community Feed</h1><p className="mt-2 text-sm text-ggz-text-secondary">Sign in to see your GGz community.</p><Link href="/auth/login" className="mt-6 inline-flex rounded-xl bg-ggz-amber px-5 py-3 font-semibold text-black">Log in</Link></div></div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-ggz-amber">GGz Community</p><h1 className="mt-1 text-3xl font-bold text-ggz-text-primary">Feed</h1><p className="mt-1 text-sm text-ggz-text-secondary">Gaming posts and community activity.</p></div>
      {posts.length === 0 ? (
        <div className="rounded-2xl border border-ggz-border bg-ggz-bg-1 p-12 text-center"><p className="font-semibold text-ggz-text-primary">Nothing here yet</p><p className="mt-2 text-sm text-ggz-text-secondary">The feed will fill as GGz gamers share posts and activity.</p></div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Link key={post.id} href={"/feed/posts/" + post.id} className="block rounded-2xl border border-ggz-border bg-ggz-bg-1 p-5 transition hover:border-ggz-amber/40 hover:bg-ggz-bg-2">
              <div className="flex items-start gap-3">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-ggz-bg-2">
                  {post.author.avatar ? <Image src={post.author.avatar} alt="" fill sizes="40px" className="object-cover" /> : <div className="flex h-full w-full items-center justify-center text-sm font-bold text-ggz-amber">{post.author.gamer_tag.slice(0, 1)}</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="font-semibold text-ggz-text-primary">{post.author.gamer_tag}</span><span className="text-xs text-ggz-text-muted">{new Date(post.created_at).toLocaleString()}</span></div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ggz-text-secondary">{post.content}</p>
                  <div className="mt-4 flex gap-4 text-xs text-ggz-text-muted"><span>{post.like_count} likes</span><span>{post.comment_count} comments</span></div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
