import { readPlatform } from "./platform";
import { liveStreams } from "./twitch";
/** Server components call their own data layer directly. */
export async function serverFetch(
  input: string | URL,
  _options?: unknown,
): Promise<Response> {
  void _options;
  const url = new URL(input, "http://ggz.internal");
  const path = url.pathname.split("/").filter(Boolean).slice(1);
  const data =
    path[0] === "live"
      ? await liveStreams(url.searchParams)
      : await readPlatform(path, url.searchParams);
  return Response.json(data);
}
