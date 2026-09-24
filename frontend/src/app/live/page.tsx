import Link from "next/link";
import type { Metadata } from "next";
import { TwitchStreamCard } from "@/components/live/TwitchStreamCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { MotionReveal } from "@/components/motion/MotionReveal";
import { GamepadIcon, BroadcastIcon } from "@/components/icons";
import { formatViewers, type LiveGameSummary, type LivePayload } from "@/lib/live";

const API_BASE = process.env.NEXT_PUBLIC_DJANGO_URL || "http://localhost:8000";

export const metadata: Metadata = {
  title: "GGz Live",
  description: "What's happening in gaming right now — live streams across GGz games.",
};

interface FilterGame {
  id: number;
  name: string;
  cover_art_url?: string | null;
}

async function fetchLive(game?: string): Promise<LivePayload | null> {
  try {
    const path = game ? `/api/live/?game=${encodeURIComponent(game)}` : "/api/live/";
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 30 } });
    if (!res.ok) return null;
    return (await res.json()) as LivePayload;
  } catch {
    return null;
  }
}

async function fetchGames(): Promise<FilterGame[]> {
  try {
    const res = await fetch(`${API_BASE}/api/games/`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (Array.isArray(data) ? data : data.results ?? []) as FilterGame[];
  } catch {
    return [];
  }
}

function FilterChips({ games, active }: { games: FilterGame[]; active?: string }) {
  if (games.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2" data-testid="live-game-filter">
      <Link
        href="/live/"
        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
          !active
            ? "border-ggz-amber/60 bg-ggz-amber/10 text-ggz-amber"
            : "border-ggz-border bg-ggz-bg-1 text-ggz-text-secondary hover:border-ggz-border-strong hover:text-ggz-text-primary"
        }`}
      >
        All games
      </Link>
      {games.slice(0, 14).map((game) => (
        <Link
          key={game.id}
          href={`/live/?game=${game.id}`}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            active === String(game.id)
              ? "border-ggz-amber/60 bg-ggz-amber/10 text-ggz-amber"
              : "border-ggz-border bg-ggz-bg-1 text-ggz-text-secondary hover:border-ggz-border-strong hover:text-ggz-text-primary"
          }`}
        >
          {game.name}
        </Link>
      ))}
    </div>
  );
}

function LiveGamesRow({ games }: { games: LiveGameSummary[] }) {
  if (!games.length) return null;
  return (
    <section className="pb-12">
      <SectionHeader
        title="Popular GGz games live"
        description="Titles the community is streaming right now."
        className="mb-4"
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {games.slice(0, 8).map((game) => (
          <Link
            key={game.id}
            href={`/games/${game.id}/`}
            className="group flex items-center gap-3 rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 p-3 transition-colors hover:border-ggz-amber/40"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ggz-text-primary group-hover:text-ggz-amber">
                {game.name}
              </span>
              <span className="mt-0.5 block text-xs text-ggz-text-muted">
                {game.stream_count} live · {formatViewers(game.viewers)} viewers
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function LivePage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const { game } = await searchParams;
  const [live, games] = await Promise.all([fetchLive(game), fetchGames()]);
  const available = Boolean(live?.available);
  const streams = live?.streams ?? [];
  const filteredGame = live?.mode === "game" ? live.game : undefined;

  return (
    <div className="animate-page-enter mx-auto max-w-[1536px] px-4 pb-24 pt-10">
      <header className="pb-8">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-ggz-amber">
          <BroadcastIcon className="h-3.5 w-3.5" />
          GGz Live
        </p>
        <h1 className="text-3xl font-bold text-ggz-text-primary md:text-4xl">GGz Live</h1>
        <p className="mt-2 max-w-2xl text-sm text-ggz-text-secondary md:text-base">
          What&apos;s happening in gaming right now.
        </p>
        {available && streams.length > 0 && (
          <p className="mt-4">
            <LiveIndicator label={`${streams.length} live stream${streams.length === 1 ? "" : "s"}`} />
          </p>
        )}
      </header>

      <div className="pb-12">
        <FilterChips games={games} active={game} />
      </div>

      {!available ? (
        <EmptyState
          icon={<BroadcastIcon size={40} />}
          title="GGz Live is warming up"
          description="Live stream discovery isn't connected yet. When it is, streams will appear here."
          action={{ label: "Browse games", href: "/games/" }}
        />
      ) : streams.length === 0 ? (
        <MotionReveal>
          <EmptyState
            icon={<BroadcastIcon size={40} />}
            title={filteredGame ? `No one is live for ${filteredGame.name} right now` : "No live streams right now"}
            description="When GGz gamers go live, they'll show up here. Check back soon."
            action={{ label: "Browse games", href: "/games/" }}
          />
        </MotionReveal>
      ) : (
        <>
          <section className="pb-12" data-testid="live-now-section">
            <MotionReveal>
              <SectionHeader
                title={filteredGame ? `Live now — ${filteredGame.name}` : "Live now"}
                description={filteredGame ? undefined : "Streams from across the GGz community and beyond."}
                href={filteredGame ? "/live/" : undefined}
                actionLabel={filteredGame ? "All live" : undefined}
                className="mb-4"
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {streams.slice(0, 12).map((stream) => (
                  <TwitchStreamCard key={stream.id || stream.broadcaster_login} stream={stream} />
                ))}
              </div>
            </MotionReveal>
          </section>

          {!filteredGame && live?.games && live.games.length > 0 && (
            <MotionReveal>
              <LiveGamesRow games={live.games} />
            </MotionReveal>
          )}
        </>
      )}

      <section className="border-t border-ggz-border pt-10">
        <SectionHeader
          title="Browse live gaming"
          description="Jump into a GGz game and see who's streaming it."
          className="mb-4"
        />
        <div className="flex flex-wrap gap-3">
          <Link
            href="/games/"
            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-ggz-amber px-4 text-sm font-semibold text-black transition hover:bg-ggz-amber-light"
          >
            <GamepadIcon className="h-4 w-4" />
            All games
          </Link>
          <Link
            href="/gamers/"
            className="inline-flex h-10 items-center rounded-[var(--radius-md)] border border-ggz-border bg-ggz-bg-1 px-4 text-sm font-semibold text-ggz-text-primary transition hover:border-ggz-border-strong"
          >
            Find players
          </Link>
        </div>
      </section>
    </div>
  );
}
