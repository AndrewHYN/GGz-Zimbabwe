"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { useDiscovery } from "@/lib/useDiscovery";

const categories = [
  { key: "games", label: "Games", path: "games" },
  { key: "gamers", label: "Gamers", path: "profiles" },
  { key: "organizations", label: "Organizations", path: "organizations" },
  { key: "teams", label: "Teams", path: "teams" },
  { key: "tournaments", label: "Tournaments", path: "tournaments" },
  { key: "events", label: "Events", path: "events" },
] as const;

interface SearchResult {
  id: number;
  gamer_tag?: string;
  name?: string;
  slug?: string;
}

type SearchResponse = Partial<Record<(typeof categories)[number]["key"], SearchResult[]>>;

export default function SearchContent() {
  const router = useRouter();
  const query = (useSearchParams().get("q") ?? "").trim();
  const { data, error, loading, retry } = useDiscovery<SearchResponse>(
    query ? "/api/search/?q=" + encodeURIComponent(query) : null,
  );
  const results = categories.flatMap((category) => {
    const items = data?.[category.key] ?? [];
    return items.length ? [{ ...category, items }] : [];
  });

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    router.push(next ? "/search/?q=" + encodeURIComponent(next) : "/search/");
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-5 text-3xl font-bold">Search GGz</h1>
      <form onSubmit={search} role="search" aria-label="Search all of GGz" className="flex gap-2">
        <input key={query} type="search" name="q" aria-label="Search query" defaultValue={query}
          placeholder="Search games, gamers, and organizations"
          className="min-w-0 flex-1 rounded-xl border border-ggz-border bg-ggz-bg-2 px-3 text-sm focus:border-ggz-amber" />
        <Button type="submit">Search</Button>
      </form>
      {loading && <p role="status" className="py-6 text-sm text-ggz-text-secondary">Searching…</p>}
      {error ? (
        <ErrorState title="Search is unavailable" message="Your query is still here. Try again in a moment." onRetry={retry} />
      ) : !loading && query && (
        results.length ? (
          <div className="mt-7 space-y-6">
            {results.map((category) => (
              <section key={category.key}>
                <h2 className="mb-2 text-lg font-semibold">{category.label}</h2>
                <ul className="divide-y divide-ggz-border rounded-xl border border-ggz-border bg-ggz-bg-1">
                  {category.items.map((item) => (
                    <li key={item.id}>
                      <Link href={"/" + category.path + "/" + encodeURIComponent(item.gamer_tag ?? item.slug ?? item.id) + "/"}
                        className="block px-4 py-3 hover:bg-ggz-surface hover:text-ggz-amber">
                        {item.gamer_tag ?? item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : <p className="py-6 text-ggz-text-secondary">No results found for “{query}”.</p>
      )}
    </section>
  );
}
