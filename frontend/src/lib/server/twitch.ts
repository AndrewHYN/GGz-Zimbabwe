import type { LivePayload } from "../live";
let access: { token: string; until: number } | undefined;
export async function liveStreams(
  query: URLSearchParams,
): Promise<LivePayload> {
  const clientId = process.env.TWITCH_CLIENT_ID || process.env.IGDB_CLIENT_ID;
  const secret =
    process.env.TWITCH_CLIENT_SECRET || process.env.IGDB_CLIENT_SECRET;
  if (!clientId || !secret) return { available: false, streams: [], games: [] };
  if (!access || access.until < Date.now()) {
    const response = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: secret,
        grant_type: "client_credentials",
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return { available: false, streams: [] };
    const data = await response.json();
    access = {
      token: data.access_token,
      until: Date.now() + (data.expires_in - 60) * 1000,
    };
  }
  const params = new URLSearchParams({ first: "20" });
  if (query.get("channel")) params.set("user_login", query.get("channel")!);
  if (query.get("game")) {
    const { find } = await import("./db");
    const game = await find("game", query.get("game")!);
    if (game?.twitch_id) params.set("game_id", game.twitch_id);
    else return { available: true, streams: [], games: [] };
  }
  const response = await fetch(
    `https://api.twitch.tv/helix/streams?${params}`,
    {
      headers: {
        "Client-Id": clientId,
        Authorization: `Bearer ${access.token}`,
      },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 30 },
    },
  );
  if (!response.ok) return { available: false, streams: [] };
  const payload = await response.json();
  return {
    available: true,
    streams: payload.data.map((s: Record<string, string>) => ({
      id: s.id,
      broadcaster_id: s.user_id,
      broadcaster_login: s.user_login,
      broadcaster_name: s.user_name,
      game_id: s.game_id,
      game_name: s.game_name,
      title: s.title,
      viewer_count: Number(s.viewer_count),
      language: s.language,
      thumbnail_url: s.thumbnail_url
        .replace("{width}", "640")
        .replace("{height}", "360"),
      started_at: s.started_at,
      is_live: true,
    })),
    games: [],
  };
}
