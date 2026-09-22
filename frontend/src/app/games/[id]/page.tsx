"use client";

import { Badge } from "@/components/ui/Badge";
import { GameArtwork } from "@/components/ui/GameArtwork";
import { StarIcon, ExternalLinkIcon } from "@/components/icons";
import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useState } from "react";

interface Review {
  id: number;
  reviewer: { gamer_tag: string; avatar?: string | null };
  rating: number;
  review: string;
  created_at?: string | null;
}

interface LeaderboardEntry {
  gamer_tag: string;
  avatar?: string | null;
  wins: number;
  matches: number;
  win_percentage: number;
}

interface CommunityPost {
  id: number;
  author: { gamer_tag: string };
  content: string;
  like_count: number;
  comment_count: number;
  created_at?: string | null;
}

interface PlayerPreview {
  gamer_tag: string;
  avatar?: string | null;
}

interface LinkedTournament {
  id: number;
  name: string;
  slug: string;
  status: string;
}

interface LinkedEvent {
  id: number;
  name: string;
  status: string;
}

interface LinkedListing {
  id: number;
  title: string;
  price: string;
}

interface GameNewsItem {
  title: string;
  source_name: string;
  url: string;
  image_url?: string | null;
  published_at?: string | null;
}

interface Game {
  id: number;
  name: string;
  description: string;
  genre: string;
  platform: string;
  release_year: number | null;
  developer: string;
  igdb_rating?: number | null;
  cover_art_url?: string | null;
  steam_url?: string | null;
  epic_url?: string | null;
  store_url?: string | null;
  trailer_url?: string | null;
  trailer_embed_url?: string | null;
  igdb_url?: string | null;
  average_rating?: number | null;
  review_count: number;
  user_review?: { id: number; rating: number; review: string } | null;
  reviews: Review[];
  leaderboard: LeaderboardEntry[];
  is_wishlisted: boolean;
  wishlist_count: number;
  player_count_total: number;
  tournament_count: number;
  event_count: number;
  available_players: PlayerPreview[];
  challengers: { id: number; gamer_tag: string }[];
  community_posts: CommunityPost[];
  upcoming_tournaments: LinkedTournament[];
  related_events: LinkedEvent[];
  related_listings: LinkedListing[];
  game_news: GameNewsItem[];
}

function csrfToken() {
  if (typeof document === "undefined") return "";
  return document.cookie.match(/(?:^|; )csrftoken=([^;]+)/)?.[1] ?? "";
}

function Stars({ value }: { value: number }) {
  return (
    <span className="text-ggz-amber" aria-label={`${value} out of 5 stars`}>
      {"★".repeat(value)}{"☆".repeat(5 - value)}
    </span>
  );
}

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [version, setVersion] = useState(0);
  const [rating, setRating] = useState("5");
  const [reviewText, setReviewText] = useState("");
  const [saving, setSaving] = useState(false);
  const [wishlisting, setWishlisting] = useState(false);
  const [challenging, setChallenging] = useState(false);
  const [opponent, setOpponent] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/games/" + encodeURIComponent(id) + "/", { credentials: "include" })
      .then((res) => {
        if (cancelled) return null;
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!res.ok) throw new Error("Failed");
        return res.json() as Promise<Game>;
      })
      .then((detail) => {
        if (!cancelled && detail) {
          const normalized: Game = {
            ...detail,
            review_count: detail.review_count ?? 0,
            reviews: detail.reviews ?? [],
            leaderboard: detail.leaderboard ?? [],
            is_wishlisted: detail.is_wishlisted ?? false,
            wishlist_count: detail.wishlist_count ?? 0,
            available_players: detail.available_players ?? [],
            challengers: detail.challengers ?? [],
            community_posts: detail.community_posts ?? [],
            upcoming_tournaments: detail.upcoming_tournaments ?? [],
            related_events: detail.related_events ?? [],
            related_listings: detail.related_listings ?? [],
            game_news: detail.game_news ?? [],
          };
          setGame(normalized);
          if (normalized.user_review) {
            setRating(String(normalized.user_review.rating));
            setReviewText(normalized.user_review.review);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setGame(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, version]);

  async function submitReview(event: React.FormEvent) {
    event.preventDefault();
    if (!game || saving) return;
    setSaving(true);
    setNotice("");
    try {
      if (!csrfToken()) await fetch("/api/csrf/", { credentials: "include" });
      const res = await fetch("/api/games/" + game.id + "/reviews/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken(), "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ rating: Number(rating), review: reviewText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error("Sign in to review this game.");
      if (!res.ok) throw new Error(data.error || "Review failed");
      setNotice(data.created ? "Review posted." : "Review updated.");
      setVersion((value) => value + 1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Review failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleWishlist() {
    if (!game || wishlisting) return;
    setWishlisting(true);
    setNotice("");
    try {
      if (!csrfToken()) await fetch("/api/csrf/", { credentials: "include" });
      const res = await fetch("/api/games/" + game.id + "/wishlist/", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": csrfToken(), "X-Requested-With": "XMLHttpRequest" },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error("Sign in to use your wishlist.");
      if (!res.ok) throw new Error(data.error || "Wishlist update failed");
      setGame({ ...game, is_wishlisted: data.wishlisted, wishlist_count: data.wishlist_count ?? game.wishlist_count });
      setNotice(data.wishlisted ? "Added to your wishlist." : "Removed from your wishlist.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Wishlist update failed");
    } finally {
      setWishlisting(false);
    }
  }

  async function submitChallenge(event: React.FormEvent) {
    event.preventDefault();
    if (!game || challenging || !opponent) return;
    setChallenging(true);
    setNotice("");
    try {
      if (!csrfToken()) await fetch("/api/csrf/", { credentials: "include" });
      const res = await fetch("/api/games/" + game.id + "/challenge/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken(), "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ opponent }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error("Sign in to challenge a friend.");
      if (!res.ok) throw new Error(data.error || "Challenge failed");
      setNotice(data.message || "Challenge sent.");
      setOpponent("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Challenge failed");
    } finally {
      setChallenging(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-[1536px] px-4 py-8 text-ggz-text-secondary">Loading game…</div>;
  if (notFound || !game)
    return (
      <div className="mx-auto max-w-[1536px] px-4 py-8 text-center">
        <h1 className="mb-4 text-3xl font-bold">Game Not Found</h1>
        <p className="mb-6 text-ggz-text-muted">The game you are looking for does not exist or could not be loaded.</p>
        <Link href="/games" className="text-ggz-amber hover:underline">Back to Games</Link>
      </div>
    );

  const storeLinks = [
    ["Steam", game.steam_url],
    ["Epic Games", game.epic_url],
    ["Store", game.store_url],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <div className="mx-auto max-w-[1536px] px-4 py-8">
      <Link href="/games" className="mb-6 inline-flex items-center gap-2 text-ggz-text-muted transition-colors hover:text-ggz-text-primary">
        ← Back to Games
      </Link>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="mx-auto w-full max-w-[280px]">
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-ggz-border">
            <GameArtwork src={game.cover_art_url ?? null} alt={game.name} className="aspect-[3/4] w-full object-cover" />
          </div>
          <button
            type="button"
            onClick={toggleWishlist}
            disabled={wishlisting}
            className={"mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40 " + (game.is_wishlisted ? "border border-ggz-amber/50 bg-ggz-amber/10 text-ggz-amber" : "bg-ggz-amber text-black hover:brightness-110")}
          >
            {wishlisting ? "Working…" : game.is_wishlisted ? "✓ In Wishlist" : "+ Add to Wishlist"}
          </button>
          <p className="mt-2 text-center text-xs text-ggz-text-muted">{game.wishlist_count} gamer{game.wishlist_count === 1 ? "" : "s"} wishlisted this</p>
        </div>

        <div className="min-w-0">
          <h1 className="text-3xl font-bold">{game.name}</h1>
          <div className="mb-4 mt-3 flex flex-wrap gap-2">
            {game.genre && <Badge>{game.genre}</Badge>}
            {game.platform && <Badge>{game.platform}</Badge>}
            {game.release_year && <Badge>{game.release_year}</Badge>}
            {game.developer && <Badge>{game.developer}</Badge>}
          </div>
          <p className="leading-relaxed text-ggz-text-secondary">{game.description || "No description available."}</p>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            {game.igdb_rating != null && (
              <span className="flex items-center gap-2">
                <StarIcon className="h-5 w-5 text-yellow-500" />
                <span className="font-semibold">{game.igdb_rating}</span>
                <span className="text-sm text-ggz-text-muted">/ 100 IGDB</span>
              </span>
            )}
            {game.average_rating != null && (
              <span className="text-sm text-ggz-text-secondary">
                <Stars value={Math.round(game.average_rating)} /> <strong className="text-ggz-text-primary">{game.average_rating}</strong> community average · {game.review_count} review{game.review_count === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {storeLinks.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-xl font-semibold">Get the Game</h2>
              <div className="flex flex-wrap gap-3">
                {storeLinks.map(([name, url]) => (
                  <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-ggz-border bg-ggz-surface px-4 py-2 transition-colors hover:bg-ggz-surface-hover">
                    {name}
                    <ExternalLinkIcon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {game.trailer_embed_url && (
        <section className="mt-8 max-w-3xl">
          <h2 className="mb-3 text-xl font-semibold">Trailer</h2>
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-ggz-border">
            <iframe
              src={game.trailer_embed_url}
              title={`${game.name} official trailer`}
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="aspect-video w-full"
            />
          </div>
        </section>
      )}

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xl font-semibold">Community reviews ({game.review_count})</h2>
          <form onSubmit={submitReview} className="mb-4 rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="text-sm text-ggz-text-secondary">
                Your rating
                <select value={rating} onChange={(e) => setRating(e.target.value)} className="ml-2 h-10 rounded-xl border border-ggz-border bg-ggz-bg-2 px-3 text-sm text-ggz-text-primary outline-none focus:border-ggz-amber">
                  {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} star{value === 1 ? "" : "s"}</option>)}
                </select>
              </label>
              <button type="submit" disabled={saving} className="rounded-xl bg-ggz-amber px-5 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-40 sm:ml-auto">
                {saving ? "Saving…" : game.user_review ? "Update review" : "Post review"}
              </button>
            </div>
            <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} rows={3} maxLength={2000} placeholder="What did you think?" className="mt-3 w-full resize-none rounded-xl border border-ggz-border bg-ggz-bg-2 px-4 py-3 text-sm leading-6 text-ggz-text-primary outline-none focus:border-ggz-amber" />
          </form>
          {notice && <p className="mb-3 text-sm text-ggz-text-secondary" role="status">{notice}</p>}
          {game.reviews.length === 0 ? (
            <p className="rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 p-6 text-center text-sm text-ggz-text-muted">No reviews yet. Be the first to rate this game.</p>
          ) : (
            <div className="space-y-3">
              {game.reviews.map((review) => (
                <article key={review.id} className="rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 p-4">
                  <div className="flex items-center gap-3">
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-ggz-bg-2">
                      {review.reviewer.avatar ? <Image src={review.reviewer.avatar} alt="" fill sizes="36px" className="object-cover" /> : <span className="flex h-full w-full items-center justify-center text-xs font-bold text-ggz-amber">{review.reviewer.gamer_tag.slice(0, 1)}</span>}
                    </div>
                    <div className="min-w-0">
                      <Link href={"/profiles/" + encodeURIComponent(review.reviewer.gamer_tag)} className="truncate text-sm font-semibold text-ggz-text-primary hover:text-ggz-amber">{review.reviewer.gamer_tag}</Link>
                      <p className="text-xs text-ggz-text-muted"><Stars value={review.rating} /> · {review.created_at ? new Date(review.created_at).toLocaleDateString() : ""}</p>
                    </div>
                  </div>
                  {review.review && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-ggz-text-secondary">{review.review}</p>}
                </article>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Leaderboard</h2>
            <Link href={"/leaderboards?game=" + game.id} className="text-sm text-ggz-amber hover:underline">Full rankings</Link>
          </div>
          {game.leaderboard.length === 0 ? (
            <p className="rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 p-6 text-center text-sm text-ggz-text-muted">
              No ranked matches recorded for this game yet. <Link href="/tournaments" className="text-ggz-amber hover:underline">Join a tournament</Link> to appear here.
            </p>
          ) : (
            <ol className="space-y-2">
              {game.leaderboard.map((entry, index) => (
                <li key={entry.gamer_tag}>
                  <Link href={"/profiles/" + encodeURIComponent(entry.gamer_tag)} className="flex items-center gap-3 rounded-xl border border-ggz-border bg-ggz-bg-1 p-3 transition hover:border-ggz-amber/40">
                    <span className="w-6 text-center text-sm font-bold text-ggz-amber">{index + 1}</span>
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-ggz-bg-2">
                      {entry.avatar ? <Image src={entry.avatar} alt="" fill sizes="36px" className="object-cover" /> : <span className="flex h-full w-full items-center justify-center text-xs font-bold text-ggz-amber">{entry.gamer_tag.slice(0, 1)}</span>}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ggz-text-primary">{entry.gamer_tag}</span>
                    <span className="text-xs text-ggz-text-muted">{entry.wins}W · {entry.matches}M · {entry.win_percentage}%</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-3">
        <div className="rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-ggz-text-primary">Players</h2>
            <Link href="/gamers" className="text-xs font-semibold text-ggz-amber hover:underline">Find players</Link>
          </div>
          {game.available_players.length === 0 ? (
            <p className="text-sm text-ggz-text-muted">No players have added this game yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {game.available_players.slice(0, 12).map((player) => (
                <Link key={player.gamer_tag} href={"/profiles/" + encodeURIComponent(player.gamer_tag)} className="flex items-center gap-2 rounded-full border border-ggz-border bg-ggz-bg-2 py-1 pl-1 pr-3 transition hover:border-ggz-amber/40">
                  <span className="relative block h-6 w-6 overflow-hidden rounded-full bg-ggz-bg-1">
                    {player.avatar ? <Image src={player.avatar} alt="" fill sizes="24px" className="object-cover" /> : <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-ggz-amber">{player.gamer_tag.slice(0, 1)}</span>}
                  </span>
                  <span className="text-xs font-medium text-ggz-text-primary">{player.gamer_tag}</span>
                </Link>
              ))}
            </div>
          )}
          {game.challengers.length > 0 && (
            <form onSubmit={submitChallenge} className="mt-4 border-t border-ggz-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ggz-text-muted">Challenge a friend</p>
              <div className="mt-2 flex gap-2">
                <select value={opponent} onChange={(e) => setOpponent(e.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border border-ggz-border bg-ggz-bg-2 px-3 text-sm text-ggz-text-primary outline-none focus:border-ggz-amber">
                  <option value="">Select player…</option>
                  {game.challengers.map((challenger) => <option key={challenger.id} value={challenger.id}>{challenger.gamer_tag}</option>)}
                </select>
                <button type="submit" disabled={challenging || !opponent} className="rounded-xl bg-ggz-amber px-4 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-40">
                  {challenging ? "…" : "Challenge"}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 p-5">
          <h2 className="font-semibold text-ggz-text-primary">Community posts</h2>
          {game.community_posts.length === 0 ? (
            <p className="mt-3 text-sm text-ggz-text-muted">No posts about this game yet. <Link href="/feed" className="text-ggz-amber hover:underline">Start the conversation</Link>.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {game.community_posts.map((post) => (
                <Link key={post.id} href={"/feed/posts/" + post.id} className="block rounded-xl border border-ggz-border bg-ggz-bg-2 p-3 transition hover:border-ggz-amber/40">
                  <p className="truncate text-sm font-medium text-ggz-text-primary">{post.author.gamer_tag}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-ggz-text-secondary">{post.content}</p>
                  <p className="mt-1 text-[11px] text-ggz-text-muted">♥ {post.like_count} · 💬 {post.comment_count}</p>
                </Link>
              ))}
            </div>
          )}
          <h2 className="mb-3 mt-6 font-semibold text-ggz-text-primary">Game news</h2>
          {game.game_news.length === 0 ? (
            <p className="text-sm text-ggz-text-muted">No news items for this game.</p>
          ) : (
            <div className="space-y-2">
              {game.game_news.map((item) => (
                <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-ggz-border bg-ggz-bg-2 p-3 transition hover:border-ggz-amber/40">
                  <p className="text-sm font-medium leading-5 text-ggz-text-primary">{item.title}</p>
                  <p className="mt-1 text-[11px] text-ggz-text-muted">{item.source_name}</p>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 p-5">
          <h2 className="font-semibold text-ggz-text-primary">Tournaments</h2>
          {game.upcoming_tournaments.length === 0 ? (
            <p className="mt-3 text-sm text-ggz-text-muted">No upcoming tournaments. <Link href="/tournaments" className="text-ggz-amber hover:underline">Browse all</Link>.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {game.upcoming_tournaments.map((tournament) => (
                <li key={tournament.id}>
                  <Link href={"/tournaments/" + tournament.slug} className="block rounded-xl border border-ggz-border bg-ggz-bg-2 p-3 text-sm transition hover:border-ggz-amber/40">
                    <span className="font-medium text-ggz-text-primary">{tournament.name}</span>
                    <span className="ml-2 text-xs text-ggz-text-muted">{tournament.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <h2 className="mb-3 mt-6 font-semibold text-ggz-text-primary">Events</h2>
          {game.related_events.length === 0 ? (
            <p className="text-sm text-ggz-text-muted">No upcoming events. <Link href="/events" className="text-ggz-amber hover:underline">Browse all</Link>.</p>
          ) : (
            <ul className="space-y-2">
              {game.related_events.map((event) => (
                <li key={event.id}>
                  <Link href={"/events/" + event.id} className="block rounded-xl border border-ggz-border bg-ggz-bg-2 p-3 text-sm transition hover:border-ggz-amber/40">
                    <span className="font-medium text-ggz-text-primary">{event.name}</span>
                    <span className="ml-2 text-xs text-ggz-text-muted">{event.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <h2 className="mb-3 mt-6 font-semibold text-ggz-text-primary">Marketplace</h2>
          {game.related_listings.length === 0 ? (
            <p className="text-sm text-ggz-text-muted">Nothing listed for this game. <Link href="/marketplace" className="text-ggz-amber hover:underline">Browse all</Link>.</p>
          ) : (
            <ul className="space-y-2">
              {game.related_listings.map((listing) => (
                <li key={listing.id}>
                  <Link href={"/marketplace/listing/" + listing.id} className="block rounded-xl border border-ggz-border bg-ggz-bg-2 p-3 text-sm transition hover:border-ggz-amber/40">
                    <span className="font-medium text-ggz-text-primary">{listing.title}</span>
                    <span className="ml-2 text-xs text-ggz-amber">${listing.price}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {game.igdb_url && (
            <a href={game.igdb_url} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 text-sm text-ggz-amber hover:underline">
              View on IGDB <ExternalLinkIcon className="h-4 w-4" />
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
