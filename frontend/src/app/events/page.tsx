const API_BASE = process.env.NEXT_PUBLIC_DJANGO_URL || "http://localhost:8000";

import Link from "next/link";
import Image from "next/image";

const MODE_COLORS: Record<string, string> = {
  online: "bg-emerald-500/20 text-emerald-400",
  offline: "bg-blue-500/20 text-blue-400",
  hybrid: "bg-purple-500/20 text-purple-400",
};

interface Event {
  id: number;
  name: string;
  start_date: string | null;
  location: string | null;
  mode: string;
  status: string;
  banner: string | null;
  game_name: string | null;
  organization_name: string | null;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Events | GGz",
  description: "Browse upcoming gaming events.",
};

export default async function EventsPage() {
  let events: Event[] = [];
  try {
    const res = await fetch(`${API_BASE}/api/events/`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      events = data.results ?? data;
    }
  } catch {
    // Render an empty state when the Django API is unavailable.
  }

  return (
    <div className="max-w-[1536px] mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ggz-text-primary">Events</h1>
        <p className="mt-1 text-ggz-text-secondary">Upcoming gaming events</p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 p-12 text-center">
          <p className="text-ggz-text-muted">No events found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <Link
              key={e.id}
              href={`/events/${e.id}`}
              className="group overflow-hidden rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 transition-colors hover:border-ggz-amber/40"
            >
              <div className="relative h-44 w-full bg-zinc-800">
                {e.banner ? (
                  <Image
                    src={e.banner}
                    alt={e.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-ggz-text-muted text-sm">
                    No image
                  </div>
                )}
              </div>

              <div className="p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-ggz-text-primary group-hover:text-ggz-amber transition-colors">
                    {e.name}
                  </h2>
                  <span
                    className={`ml-2 shrink-0 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      MODE_COLORS[e.mode] ?? "bg-zinc-500/15 text-zinc-400"
                    }`}
                  >
                    {e.mode.charAt(0).toUpperCase() + e.mode.slice(1)}
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-sm text-ggz-text-secondary">
                  <p>{e.start_date ? formatDate(e.start_date) : "Date TBD"}</p>
                  {e.location && <p>{e.location}</p>}
                  <p className="text-ggz-text-muted">
                    {e.organization_name ?? "Community event"}
                  </p>
                  {e.game_name && <p>{e.game_name}</p>}
                  <p>
                    <span className="text-ggz-amber">{e.status}</span>
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
