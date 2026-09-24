// Shared GGz Live data shapes (server + client safe). The Django API always
// returns this normalized structure — the raw Twitch payload never crosses
// the wire.

export interface LiveStream {
  id: string;
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  game_id: string;
  game_name: string;
  title: string;
  viewer_count: number;
  language: string;
  thumbnail_url: string;
  started_at: string;
  is_live: boolean;
  ggz_game_id?: number;
  ggz_game_name?: string;
}

export interface LiveGameSummary {
  id: number;
  name: string;
  cover_art_url?: string | null;
  stream_count: number;
  viewers: number;
}

export interface LivePayload {
  available: boolean;
  mode?: "global" | "game" | "channel";
  streams: LiveStream[];
  games?: LiveGameSummary[];
  game?: { id: number; name: string; cover_art_url?: string | null };
  channel?: string;
  language?: string | null;
}

export function formatViewers(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(count);
}

export function twitchWatchUrl(login: string): string {
  return `https://www.twitch.tv/${login}`;
}
