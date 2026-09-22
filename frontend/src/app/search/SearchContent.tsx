"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface SearchResult {
  id: number;
  title?: string;
  username?: string;
  name?: string;
  type: "game" | "gamer" | "team" | "tournament" | "event";
  slug?: string;
}

const TYPE_LABELS: Record<string, string> = {
  game: "Games",
  gamer: "Gamers",
  team: "Teams",
  tournament: "Tournaments",
  event: "Events",
};

const TYPE_ROUTES: Record<string, string> = {
  game: "/games",
  gamer: "/profiles",
  team: "/teams",
  tournament: "/tournaments",
  event: "/events",
};

function resultHref(item: SearchResult): string {
  if (item.type === "gamer" && item.username) return "/profiles/" + encodeURIComponent(item.username);
  return `${TYPE_ROUTES[item.type]}/${item.slug || item.id}`;
}

export default function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search/?q=${encodeURIComponent(query)}`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          const flattened: SearchResult[] = [
            ...(data.games ?? []).map((g: { id: number; name: string }) => ({
              id: g.id,
              name: g.name,
              type: "game" as const,
            })),
            ...(data.gamers ?? []).map(
              (u: { id: number; gamer_tag: string }) => ({
                id: u.id,
                username: u.gamer_tag,
                type: "gamer" as const,
              })
            ),
            ...(data.teams ?? []).map(
              (t: { id: number; name: string; slug: string }) => ({
                id: t.id,
                name: t.name,
                slug: t.slug,
                type: "team" as const,
              })
            ),
            ...(data.tournaments ?? []).map(
              (t: { id: number; name: string; slug: string }) => ({
                id: t.id,
                name: t.name,
                slug: t.slug,
                type: "tournament" as const,
              })
            ),
            ...(data.events ?? []).map((e: { id: number; name: string }) => ({
              id: e.id,
              name: e.name,
              type: "event" as const,
            })),
          ];
          setResults(flattened);
        } else {
          setResults([]);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query]);

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {});

  const typeOrder = ["game", "gamer", "team", "tournament", "event"];
  const hasResults = results.length > 0;

  return (
    <div className="max-w-[1536px] mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">
        {query ? `Search results for "${query}"` : "Search"}
      </h1>

      {loading ? (
        <div className="text-center py-12 text-ggz-text-muted">Loading...</div>
      ) : hasResults ? (
        <div className="space-y-8">
          {typeOrder.map((type) => {
            const items = grouped[type];
            if (!items || items.length === 0) return null;
            return (
              <section key={type}>
                <h2 className="text-lg font-semibold mb-3 text-ggz-text-muted">
                  {TYPE_LABELS[type]}
                </h2>
                <div className="bg-ggz-bg-1 border border-ggz-border rounded-[var(--radius-lg)] divide-y divide-ggz-border">
                  {items.map((item) => (
                    <Link
                      key={item.id}
                      href={resultHref(item)}
                      className="block px-4 py-3 hover:bg-ggz-bg-2 transition-colors"
                    >
                      {item.title || item.username || item.name || `#${item.id}`}
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-ggz-text-muted">
          No results found for &apos;{query}&apos;
        </div>
      )}
    </div>
  );
}
