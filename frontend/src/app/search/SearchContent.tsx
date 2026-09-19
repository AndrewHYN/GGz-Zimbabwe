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
  gamer: "/gamers",
  team: "/teams",
  tournament: "/tournaments",
  event: "/events",
};

export default function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query) {
      setResults([]);
      setLoading(false);
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
          setResults(data.results || data);
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
                      href={`${TYPE_ROUTES[type]}/${item.slug || item.id}`}
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
