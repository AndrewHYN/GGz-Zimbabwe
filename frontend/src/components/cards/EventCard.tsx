import Link from "next/link";
import Image from "next/image";

const MODE_COLORS: Record<string, string> = {
  online: "bg-emerald-500/20 text-emerald-400",
  offline: "bg-blue-500/20 text-blue-400",
  hybrid: "bg-purple-500/20 text-purple-400",
};

interface EventCardProps {
  id: number;
  name: string;
  date: string;
  location?: string;
  mode: string;
  banner_image?: string | null;
  organizer_name?: string;
  rsvp_count: number;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function EventCard({
  id,
  name,
  date,
  location,
  mode,
  banner_image,
  organizer_name,
  rsvp_count,
}: EventCardProps) {
  return (
    <Link
      href={`/events/${id}`}
      className="group block overflow-hidden rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 transition-colors hover:border-ggz-amber/40"
    >
      <div className="relative h-44 w-full bg-ggz-bg-2">
        {banner_image ? (
          <Image
            src={banner_image}
            alt={name}
            fill
            className="object-cover transition group-hover:scale-105"
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
            {name}
          </h2>
          <span
            className={`ml-2 shrink-0 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
              MODE_COLORS[mode] ?? "bg-zinc-500/15 text-zinc-400"
            }`}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </span>
        </div>

        <div className="mt-3 space-y-1 text-sm text-ggz-text-secondary">
          <p>{formatDate(date)}</p>
          {location && <p>{location}</p>}
          {organizer_name && <p className="text-ggz-text-muted">{organizer_name}</p>}
          <p>
            <span className="text-ggz-amber">{rsvp_count}</span>{" "}
            attending
          </p>
        </div>
      </div>
    </Link>
  );
}
