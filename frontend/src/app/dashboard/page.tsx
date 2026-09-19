"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Profile {
  gamer_tag?: string;
  user: { username: string };
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profiles/me/", {
      credentials: "include",
      headers: { "X-Requested-With": "XMLHttpRequest" },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      })
      .then((data) => setProfile(data))
      .catch(() => {
        window.location.href = "/auth/login";
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-[1536px] mx-auto px-4 py-8">
        <p className="text-ggz-text-primary">Loading...</p>
      </div>
    );
  }

  if (!profile) return null;

  const actions = [
    { label: "Create Post", href: "/feed/create" },
    { label: "Find Players", href: "/gamers" },
    { label: "Browse Games", href: "/games" },
    { label: "My Listings", href: "/marketplace/my-listings" },
  ];

  return (
    <div className="max-w-[1536px] mx-auto px-4 py-8">
      <div className="bg-ggz-bg-1 border border-ggz-border rounded-[var(--radius-lg)] p-6 space-y-8">
        <section>
          <h1 className="text-2xl font-bold text-ggz-amber">
            Welcome back, {profile.gamer_tag || profile.user.username}
          </h1>
        </section>

        <section>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="block bg-ggz-bg-1 border border-ggz-border rounded-[var(--radius-lg)] p-4 text-center text-ggz-text-primary hover:border-ggz-amber transition-colors"
              >
                {action.label}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <p className="text-ggz-text-primary">Activity feed coming soon</p>
        </section>
      </div>
    </div>
  );
}
