const API_BASE = process.env.NEXT_PUBLIC_DJANGO_URL || "http://localhost:8000";

import Link from "next/link";
import { SearchIcon, FilterIcon } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { GameArtwork } from "@/components/ui/GameArtwork";

const GENRES = ["All", "Action", "RPG", "Sports", "Strategy", "Shooter", "Adventure", "Simulation", "Fighting", "Racing"];
const PLATFORMS = ["All", "PC", "PlayStation", "Xbox", "Nintendo", "Mobile"];
const SORT_OPTIONS = [
  { label: "Popular", value: "popular" },
  { label: "Name A-Z", value: "name" },
  { label: "Newest", value: "newest" },
  { label: "Rating", value: "rating" },
];

interface Game {
  id: number;
  title: string;
  genre: string;
  platform: string;
  year: number | null;
  rating: number | null;
  artwork_url: string | null;
}

interface SearchParams {
  genre?: string;
  platform?: string;
  sort?: string;
  q?: string;
}

async function getGames(searchParams: SearchParams) {
  const params = new URLSearchParams();
  if (searchParams.genre && searchParams.genre !== "All") params.set("genre", searchParams.genre);
  if (searchParams.platform && searchParams.platform !== "All") params.set("platform", searchParams.platform);
  if (searchParams.sort) params.set("sort", searchParams.sort);
  if (searchParams.q) params.set("q", searchParams.q);

  const url = `${API_BASE}/games/?format=json&${params.toString()}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? data) as Game[];
  } catch {
    return [];
  }
}

function ActiveFilters({ searchParams }: { searchParams: SearchParams }) {
  const filters: { label: string; value: string }[] = [];
  if (searchParams.q) filters.push({ label: `"${searchParams.q}"`, value: "q" });
  if (searchParams.genre && searchParams.genre !== "All") filters.push({ label: searchParams.genre!, value: "genre" });
  if (searchParams.platform && searchParams.platform !== "All") filters.push({ label: searchParams.platform!, value: "platform" });

  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((f) => (
        <Badge key={f.value} className="bg-ggz-amber/10 text-ggz-amber">
          {f.label}
        </Badge>
      ))}
    </div>
  );
}

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const games = await getGames(params);

  return (
    <div className="max-w-[1536px] mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Games</h1>
        <p className="text-ggz-text-2 mt-1">Browse the gaming catalogue</p>
      </div>

      <form className="mb-6 flex flex-col gap-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ggz-text-2" />
          <input
            type="text"
            name="q"
            placeholder="Search games..."
            defaultValue={params.q}
            className="w-full bg-ggz-bg-2 border border-ggz-border rounded-[var(--radius-md)] pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-ggz-border-strong"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <FilterIcon className="h-4 w-4 text-ggz-text-2" />
            <span className="text-sm text-ggz-text-2">Filters</span>
          </div>

          <select
            name="genre"
            defaultValue={params.genre ?? "All"}
            className="bg-ggz-bg-2 border border-ggz-border rounded-[var(--radius-md)] px-3 py-1.5 text-sm focus:outline-none focus:border-ggz-border-strong"
          >
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g === "All" ? "All Genres" : g}
              </option>
            ))}
          </select>

          <select
            name="platform"
            defaultValue={params.platform ?? "All"}
            className="bg-ggz-bg-2 border border-ggz-border rounded-[var(--radius-md)] px-3 py-1.5 text-sm focus:outline-none focus:border-ggz-border-strong"
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p === "All" ? "All Platforms" : p}
              </option>
            ))}
          </select>

          <select
            name="sort"
            defaultValue={params.sort ?? "popular"}
            className="bg-ggz-bg-2 border border-ggz-border rounded-[var(--radius-md)] px-3 py-1.5 text-sm focus:outline-none focus:border-ggz-border-strong"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="bg-ggz-amber/10 text-ggz-amber border border-ggz-amber/30 rounded-[var(--radius-md)] px-4 py-1.5 text-sm font-medium hover:bg-ggz-amber/20 transition-colors"
          >
            Apply
          </button>
        </div>
      </form>

      <ActiveFilters searchParams={params} />

      {/* Loading state: Suspense boundary with fallback UI can wrap this section */}
      {games.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-ggz-text-2">
          <SearchIcon className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg font-medium">No games found</p>
          <p className="text-sm mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {games.map((game) => (
            <Link
              key={game.id}
              href={`/games/${game.id}`}
              className="bg-ggz-bg-1 border border-ggz-border rounded-[var(--radius-lg)] overflow-hidden hover:border-ggz-border-strong transition-all"
            >
              <GameArtwork
                src={game.artwork_url}
                alt={game.title}
                className="aspect-[16/10] w-full"
              />
              <div className="p-3">
                <h2 className="font-semibold truncate">{game.title}</h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {game.genre && (
                    <Badge className="text-xs">{game.genre}</Badge>
                  )}
                  {game.platform && (
                    <Badge className="text-xs">{game.platform}</Badge>
                  )}
                </div>
                {game.year && (
                  <p className="text-xs text-ggz-text-2 mt-2">{game.year}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
