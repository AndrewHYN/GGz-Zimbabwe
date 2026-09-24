"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { twitchWatchUrl } from "@/lib/live";

const MIN_EMBED_WIDTH = 400; // Twitch minimum player width

function subscribeToHostname() {
  return () => {};
}

function getClientHostname() {
  return window.location.hostname;
}

function getServerHostname() {
  return "";
}

interface TwitchPlayerProps {
  channel: string;
  title: string;
}

/**
 * Responsive Twitch embed. The iframe mounts only after layout (correct
 * `parent` domain from window.location, container wide enough for Twitch's
 * 400px minimum); otherwise a clean "Watch on Twitch" card renders instead.
 * The page never depends on the embed loading.
 */
export function TwitchPlayer({ channel, title }: TwitchPlayerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const parent = useSyncExternalStore(subscribeToHostname, getClientHostname, getServerHostname);
  const [canEmbed, setCanEmbed] = useState(false);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setCanEmbed(width >= MIN_EMBED_WIDTH);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const watchUrl = twitchWatchUrl(channel);

  return (
    <div
      ref={wrapRef}
      className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1"
      data-testid="twitch-player"
    >
      {canEmbed && parent ? (
        <iframe
          src={`https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(parent)}&muted=false`}
          title={`${title} on Twitch`}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          data-testid="twitch-embed"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <LiveIndicator />
          <p className="text-sm text-ggz-text-secondary">
            {parent ? "Open this stream on Twitch to watch." : "Preparing the player…"}
          </p>
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-ggz-amber px-5 text-sm font-semibold text-black transition hover:bg-ggz-amber-light"
          >
            Watch on Twitch
          </a>
        </div>
      )}
    </div>
  );
}
