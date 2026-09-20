"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface Gamer {
  id: number;
  gamer_tag: string;
  avatar?: string;
  location?: string;
  platform?: string;
  bio?: string;
}

export default function GamersPage() {
  const [gamers, setGamers] = useState<Gamer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profiles/gamers/", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setGamers(data))
      .catch(() => setGamers([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = gamers.filter(
    (g) =>
      g.gamer_tag.toLowerCase().includes(search.toLowerCase()) ||
      (g.location && g.location.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="max-w-[1536px] mx-auto px-4 py-8">
        <p className="text-ggz-text-primary">Loading gamers...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1536px] mx-auto px-4 py-8">
      <div className="bg-ggz-bg-1 border border-ggz-border rounded-[var(--radius-lg)] p-6 space-y-6">
        <input
          type="text"
          placeholder="Search gamers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 bg-ggz-bg-1 border border-ggz-border rounded-[var(--radius-lg)] text-ggz-text-primary placeholder:text-ggz-text-primary/50 focus:outline-none focus:border-ggz-amber"
        />

        {filtered.length === 0 ? (
          <p className="text-ggz-text-primary">No gamers found</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((gamer) => (
              <Link
                key={gamer.id}
                href={`/profiles/${gamer.gamer_tag}`}
                className="block bg-ggz-bg-1 border border-ggz-border rounded-[var(--radius-lg)] p-4 hover:border-ggz-amber transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  {gamer.avatar ? (
                    <Image
                      src={gamer.avatar}
                      alt={gamer.gamer_tag}
                      className="w-10 h-10 rounded-full object-cover"
                      fill
                      sizes="40px"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-ggz-amber/20 flex items-center justify-center text-ggz-amber font-bold text-lg">
                      {gamer.gamer_tag[0]?.toUpperCase()}
                    </div>
                  )}
                  <span className="text-ggz-text-primary font-semibold">
                    {gamer.gamer_tag}
                  </span>
                </div>

                {gamer.location && (
                  <p className="text-ggz-text-primary text-sm">
                    {gamer.location}
                  </p>
                )}
                {gamer.platform && (
                  <p className="text-ggz-text-primary text-sm">
                    {gamer.platform}
                  </p>
                )}
                {gamer.bio && (
                  <p className="text-ggz-text-primary text-sm mt-2">
                    {gamer.bio.length > 80
                      ? gamer.bio.slice(0, 80) + "..."
                      : gamer.bio}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
