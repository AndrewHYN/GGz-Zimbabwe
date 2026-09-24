"use client";

import { HoverCard } from "@/components/motion/HoverCard";
import { SafeImage } from "@/components/ui/SafeImage";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { formatViewers, type LiveStream } from "@/lib/live";

interface TwitchStreamCardProps {
  stream: LiveStream;
}

export function TwitchStreamCard({ stream }: TwitchStreamCardProps) {
  return (
    <HoverCard
      href={`/live/${encodeURIComponent(stream.broadcaster_login)}/`}
      className="group block overflow-hidden rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 transition-colors hover:border-ggz-amber/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ggz-amber"
      aria-label={`Watch ${stream.broadcaster_name} on GGz Live`}
      data-testid="twitch-stream-card"
    >
      <div className="relative aspect-video overflow-hidden bg-ggz-bg-2">
        <SafeImage
          src={stream.thumbnail_url || null}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          fallback={<div className="absolute inset-0 bg-[linear-gradient(135deg,var(--color-ggz-bg-3),var(--color-ggz-bg-1))]" aria-hidden="true" />}
        />
        <div className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-1 backdrop-blur-sm">
          <LiveIndicator />
        </div>
        <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">
          {formatViewers(stream.viewer_count)} viewers
        </div>
      </div>
      <div className="space-y-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-semibold text-ggz-text-primary transition-colors group-hover:text-ggz-amber">
            {stream.broadcaster_name}
          </p>
          {stream.language && (
            <span className="shrink-0 rounded border border-ggz-border px-1 text-[10px] uppercase text-ggz-text-muted">
              {stream.language}
            </span>
          )}
        </div>
        <p className="line-clamp-2 text-xs leading-5 text-ggz-text-secondary">
          {stream.title || `${stream.game_name || "Live"} on GGz Live`}
        </p>
        <p className="truncate text-[11px] text-ggz-text-muted">
          {stream.ggz_game_name || stream.game_name || "Just chatting"}
        </p>
      </div>
    </HoverCard>
  );
}
