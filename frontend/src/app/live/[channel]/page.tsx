import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TwitchPlayer } from "@/components/live/TwitchPlayer";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatViewers, twitchWatchUrl, type LivePayload } from "@/lib/live";
import { BroadcastIcon, ExternalLinkIcon } from "@/components/icons";

const API_BASE = process.env.NEXT_PUBLIC_DJANGO_URL || "http://localhost:8000";

export const metadata: Metadata = {
  title: "Watch live",
  description: "Watch a live stream on GGz Live.",
};

async function fetchChannel(channel: string): Promise<LivePayload | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/live/?channel=${encodeURIComponent(channel)}`,
      { next: { revalidate: 30 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as LivePayload;
  } catch {
    return null;
  }
}

export default async function WatchStreamPage({
  params,
}: {
  params: Promise<{ channel: string }>;
}) {
  const { channel } = await params;
  const login = channel.toLowerCase();
  if (!/^[a-z0-9_]{1,40}$/.test(login)) notFound();

  const live = await fetchChannel(login);
  if (!live?.available) {
    return (
      <div className="animate-page-enter mx-auto max-w-3xl px-4 pb-24 pt-10">
        <EmptyState
          icon={<BroadcastIcon size={40} />}
          title="Live discovery isn't connected"
          description="Stream lookup will be available once live discovery is connected."
          action={{ label: "Back to GGz Live", href: "/live/" }}
        />
      </div>
    );
  }

  const stream = live.streams[0];

  if (!stream) {
    return (
      <div className="animate-page-enter mx-auto max-w-3xl px-4 pb-24 pt-10">
        <EmptyState
          icon={<BroadcastIcon size={40} />}
          title={`${login} isn't live right now`}
          description="This channel is offline or not streaming a GGz-related category. Browse everyone who is live right now."
          action={{ label: "Back to GGz Live", href: "/live/" }}
        />
      </div>
    );
  }

  return (
    <div className="animate-page-enter mx-auto max-w-5xl px-4 pb-24 pt-8" data-testid="watch-page">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/live/" className="text-sm text-ggz-text-secondary hover:text-ggz-text-primary">
          ← GGz Live
        </Link>
        <a
          href={twitchWatchUrl(stream.broadcaster_login)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ggz-amber hover:underline"
        >
          Watch on Twitch <ExternalLinkIcon className="h-4 w-4" />
        </a>
      </div>

      <TwitchPlayer channel={stream.broadcaster_login} title={stream.broadcaster_name} />

      <div className="mt-5">
        <div className="flex flex-wrap items-center gap-3">
          <LiveIndicator />
          <span className="text-sm font-semibold text-ggz-text-primary">
            {stream.broadcaster_name}
          </span>
          <span className="text-sm text-ggz-text-secondary">
            {formatViewers(stream.viewer_count)} viewers
          </span>
          {stream.ggz_game_id ? (
            <Link
              href={`/games/${stream.ggz_game_id}/`}
              className="rounded-full border border-ggz-border bg-ggz-bg-1 px-2.5 py-1 text-xs text-ggz-text-secondary transition hover:border-ggz-amber/40 hover:text-ggz-text-primary"
            >
              {stream.ggz_game_name || stream.game_name}
            </Link>
          ) : stream.game_name ? (
            <span className="rounded-full border border-ggz-border bg-ggz-bg-1 px-2.5 py-1 text-xs text-ggz-text-secondary">
              {stream.game_name}
            </span>
          ) : null}
        </div>
        <h1 className="mt-3 text-xl font-semibold text-ggz-text-primary md:text-2xl">
          {stream.title || `${stream.broadcaster_name} is live`}
        </h1>
        <p className="mt-2 text-sm text-ggz-text-secondary">
          Streamed from Twitch, surfaced by GGz Live. The player above is optional — you can
          always continue on Twitch directly.
        </p>
      </div>
    </div>
  );
}
