"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface Post {
  id: string;
  author: {
    username: string;
    avatar_url: string;
  };
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
    async function fetchPosts() {
      try {
        const res = await fetch("/api/feed/", {
          credentials: "include",
          headers: { "X-Requested-With": "XMLHttpRequest" },
        });
        if (res.status === 401 || res.status === 403) {
          setAuthError(true);
          return;
        }
        const data = await res.json();
        setResults(Array.isArray(data) ? data : (data.results ?? data));
      } catch {
        setAuthError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchPosts();
  }, []);

  if (loading) {
    return (
      <div className="max-w-[1536px] mx-auto px-4 py-8">
        <p className="text-ggz-text-muted">Loading...</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="max-w-[1536px] mx-auto px-4 py-8">
        <div className="bg-ggz-bg-1 border border-ggz-border rounded-[var(--radius-lg)] p-8 text-center">
          <h1 className="text-2xl font-bold text-ggz-text-primary mb-4">
            Community Feed
          </h1>
          <p className="text-ggz-text-secondary mb-6">
            You need to be logged in to view the feed.
          </p>
          <Link
            href="/auth/login"
            className="inline-block bg-ggz-amber text-black font-semibold px-6 py-2 rounded-[var(--radius-lg)] hover:opacity-90 transition"
          >
            Log In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1536px] mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ggz-text-primary mb-6">
        Community Feed
      </h1>

      {posts.length === 0 ? (
        <div className="bg-ggz-bg-1 border border-ggz-border rounded-[var(--radius-lg)] p-8 text-center">
          <p className="text-ggz-text-muted">
            No posts yet. Be the first to share something!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/feed/posts/${post.id}`}
              className="block bg-ggz-bg-1 border border-ggz-border rounded-[var(--radius-lg)] p-5 hover:border-ggz-amber/40 transition"
            >
              <div className="flex items-start gap-3">
                <Image
                  src={post.author.avatar}
                  alt={post.author.gamer_tag}
                  className="w-10 h-10 rounded-full bg-ggz-border object-cover"
                  fill
                  sizes="40px"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-ggz-text-primary">
                      {post.author.gamer_tag}
                    </span>
                    <span className="text-xs text-ggz-text-muted">
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-ggz-text-secondary whitespace-pre-wrap break-words">
                    {post.content}
                  </p>
                  <div className="flex gap-4 mt-3 text-sm text-ggz-text-muted">
                    <span>{post.like_count} like{post.like_count !== 1 && "s"}</span>
                    <span>{post.comment_count} comment{post.comment_count !== 1 && "s"}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
