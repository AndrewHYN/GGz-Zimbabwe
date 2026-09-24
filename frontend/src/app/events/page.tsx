const API_BASE = process.env.NEXT_PUBLIC_DJANGO_URL || "http://localhost:8000";

import { CalendarIcon } from "@/components/icons";
import { EventCard } from "@/components/cards";
import { EmptyState } from "@/components/ui/EmptyState";
import { MotionReveal } from "@/components/motion/MotionReveal";

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
  organizer_name?: string | null;
  rsvp_count?: number;
}

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
    <div className="mx-auto max-w-[1536px] px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ggz-text-primary">Events</h1>
        <p className="mt-1 text-ggz-text-secondary">Upcoming gaming events</p>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon size={40} />}
          title="No events found"
          description="LANs, meetups, and online nights will show up here."
          action={{ label: "View all events", href: "/events" }}
        />
      ) : (
        <MotionReveal>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
              <EventCard
                key={e.id}
                id={e.id}
                name={e.name}
                date={e.start_date}
                location={e.location}
                mode={e.mode}
                banner_image={e.banner}
                organizer_name={e.organization_name ?? e.organizer_name}
                game_name={e.game_name}
                rsvp_count={e.rsvp_count ?? null}
                status={e.status}
              />
            ))}
          </div>
        </MotionReveal>
      )}
    </div>
  );
}
