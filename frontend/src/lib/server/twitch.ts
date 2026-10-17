import type { LivePayload } from "../live";
import { find } from "./db";
let access: { client: string; token: string; until: number } | undefined;
const categories = new Map<string, { id: string | null; until: number }>();
export async function liveStreams(
  query: URLSearchParams,
): Promise<LivePayload> {
  const client = process.env.TWITCH_CLIENT_ID || process.env.IGDB_CLIENT_ID;
  const secret =
    process.env.TWITCH_CLIENT_SECRET || process.env.IGDB_CLIENT_SECRET;
  if (!client || !secret) return { available: false, streams: [], games: [] };
  try {
    const helix = async (
      resource: string,
      params: URLSearchParams,
      retry = true,
    ): Promise<Record<string, unknown>[]> => {
      if (!access || access.client !== client || access.until < Date.now()) {
        const response = await fetch("https://id.twitch.tv/oauth2/token", {
          method: "POST",
          body: new URLSearchParams({
            client_id: client,
            client_secret: secret,
            grant_type: "client_credentials",
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw Error("Twitch authentication unavailable");
        const data = await response.json();
        if (
          typeof data.access_token !== "string" ||
          !Number.isFinite(data.expires_in)
        )
          throw Error("Invalid Twitch token response");
        access = {
          client,
          token: data.access_token,
          until: Date.now() + Math.max(0, data.expires_in - 60) * 1000,
        };
      }
      const response = await fetch(
        `https://api.twitch.tv/helix/${resource}?${params}`,
        {
          headers: {
            "Client-Id": client,
            Authorization: `Bearer ${access.token}`,
          },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (response.status === 401 && retry) {
        access = undefined;
        return helix(resource, params, false);
      }
      if (!response.ok) throw Error("Twitch request unavailable");
      const payload = await response.json();
      if (!Array.isArray(payload.data)) throw Error("Invalid Twitch response");
      return payload.data;
    };
    const params = new URLSearchParams({ first: "20" });
    const channel = query.get("channel");
    if (channel) {
      if (!/^[a-zA-Z0-9_]{1,40}$/.test(channel))
        return { available: true, streams: [] };
      params.set("user_login", channel);
    }
    const game = query.get("game")
      ? await find("game", query.get("game")!)
      : undefined;
    if (query.get("game")) {
      if (!game || game.hidden)
        return { available: true, streams: [], games: [] };
      let category = game.twitch_category_id || game.twitch_id;
      const cacheKey = `${client}:${game.id}`;
      const cached = categories.get(cacheKey);
      if (!category && cached && cached.until > Date.now())
        category = cached.id;
      if (!category && !(cached && cached.until > Date.now())) {
        let data: Record<string, unknown>[] = [];
        if (game.igdb_id)
          data = await helix(
            "games",
            new URLSearchParams({ igdb_id: String(game.igdb_id) }),
          );
        if (!data.length)
          data = await helix("games", new URLSearchParams({ name: game.name }));
        category = data.find(
          (g) =>
            (g.igdb_id && String(g.igdb_id) === String(game.igdb_id)) ||
            String(g.name).toLowerCase() === game.name.toLowerCase(),
        )?.id;
        categories.set(cacheKey, {
          id: category ? String(category) : null,
          until: Date.now() + (category ? 3600000 : 300000),
        });
      }
      if (!category)
        return {
          available: true,
          streams: [],
          games: [],
          game: { id: game.id, name: game.name },
        };
      params.set("game_id", String(category));
    }
    const streams = (await helix("streams", params))
      .filter(
        (s) =>
          typeof s.user_login === "string" &&
          /^[a-zA-Z0-9_]{1,40}$/.test(s.user_login),
      )
      .map((s) => {
        const thumb = String(s.thumbnail_url ?? "")
          .replace("{width}", "640")
          .replace("{height}", "360");
        return {
          id: String(s.id),
          broadcaster_id: String(s.user_id),
          broadcaster_login: String(s.user_login),
          broadcaster_name: String(s.user_name ?? s.user_login),
          game_id: String(s.game_id ?? ""),
          game_name: String(s.game_name ?? ""),
          title: String(s.title ?? ""),
          viewer_count: Math.max(0, Number(s.viewer_count) || 0),
          language: String(s.language ?? ""),
          thumbnail_url: thumb.startsWith("https://static-cdn.jtvnw.net/")
            ? thumb
            : "",
          started_at: String(s.started_at ?? ""),
          is_live: true,
          ...(game ? { ggz_game_id: game.id, ggz_game_name: game.name } : {}),
        };
      });
    return {
      available: true,
      mode: channel ? "channel" : game ? "game" : "global",
      streams,
      games: game
        ? [
            {
              id: game.id,
              name: game.name,
              cover_art_url: game.cover_art_url,
              stream_count: streams.length,
              viewers: streams.reduce((n, s) => n + s.viewer_count, 0),
            },
          ]
        : [],
      ...(game
        ? {
            game: {
              id: game.id,
              name: game.name,
              cover_art_url: game.cover_art_url,
            },
          }
        : {}),
      ...(channel ? { channel } : {}),
    };
  } catch {
    return { available: false, streams: [], games: [] };
  }
}
