"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { HoverCard } from "@/components/motion/HoverCard";
import { SafeImage } from "@/components/ui/SafeImage";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { formatViewers, type LivePayload } from "@/lib/live";

interface GameLiveStripProps {
  gameId: number;
}

/**
 * Compact GGz LIVE section for game detail. Renders nothing when live
 * discovery is unavailable or the game has no live streams, so the game
 * page stays calm and never breaks on Twitch failure.
 */
export function GameLiveStrip({ gameId }: GameLiveStripProps) {
  const [data, setData] = useState<LivePayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/live/?game=${encodeURIComponent(gameId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: LivePayload | null) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  if (!data?.available || !data.streams?.length) return null;
  const streams = data.streams.slice(0, 3);

  return (
    <section className="mt-8" data-testid="game-live-section">
      <SectionHeader
        title="GGz LIVE"
        description={`${data.streams.length} live stream${data.streams.length === 1 ? "" : "s"} for this game.`}
        href="/live/"
        actionLabel="GGz Live"
        className="mb-3"
      />
      <div className="space-y-2">
        {streams.map((stream) => (
          <HoverCard
            key={stream.id || stream.broadcaster_login}
            href={`/live/${encodeURIComponent(stream.broadcaster_login)}/`}
            className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 p-2.5 transition-colors hover:border-ggz-amber/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ggz-amber"
            aria-label={`Watch ${stream.broadcaster_name}`}
          >
            <span className="relative block h-11 w-20 shrink-0 overflow-hidden rounded-md bg-ggz-bg-2">
              <SafeImage
                src={stream.thumbnail_url || null}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
                fallback={<div className="absolute inset-0 bg-[linear-gradient(135deg,var(--color-ggz-bg-3),var(--color-ggz-bg-1))]" aria-hidden="true" />}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-ggz-text-primary">{stream.broadcaster_name}</span>
                <LiveIndicator />
              </span>
              <span className="mt-0.5 block truncate text-xs text-ggz-text-secondary">{stream.title || stream.game_name}</span>
            </span>
            <span className="shrink-0 text-xs font-semibold text-ggz-amber">
              {formatViewers(stream.viewer_count)} viewers
            </span>
          </HoverCard>
        ))}
      </div>
      <Link href="/live/" className="mt-3 inline-block text-xs font-medium text-ggz-amber hover:underline">
        See all live streams →
      </Link>
    </section>
  );
}
