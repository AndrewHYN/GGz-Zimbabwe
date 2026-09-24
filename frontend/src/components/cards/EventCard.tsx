import { HoverCard } from "@/components/motion/HoverCard";
import { MediaFallback } from "@/components/ui/MediaFallback";
import { SafeImage } from "@/components/ui/SafeImage";
import { StatusPill, eventModeTone, eventStatusTone } from "@/components/ui/StatusPill";

interface EventCardProps {
  id: number;
  name: string;
  date: string | null;
  location?: string | null;
  mode: string;
  banner_image?: string | null;
  organizer_name?: string | null;
  game_name?: string | null;
  rsvp_count?: number | null;
  status?: string | null;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", {
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
  game_name,
  rsvp_count,
  status,
}: EventCardProps) {
  return (
    <HoverCard
      href={`/events/${id}`}
      className="group block overflow-hidden rounded-[var(--radius-lg)] border border-ggz-border bg-ggz-bg-1 transition-colors hover:border-ggz-amber/40 hover:shadow-lg hover:shadow-black/20"
    >
      <div className="relative h-44 w-full bg-ggz-bg-2">
        <SafeImage
          src={banner_image}
          alt={name}
          fill
          sizes="(max-width: 640px) 100vw, 33vw"
          unoptimized
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          fallback={<MediaFallback kind="event" label={name} className="absolute inset-0" />}
        />
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-semibold text-ggz-text-primary transition-colors group-hover:text-ggz-amber">
            {name}
          </h2>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {status && <StatusPill label={status} tone={eventStatusTone(status)} />}
            <StatusPill
              label={mode.charAt(0).toUpperCase() + mode.slice(1)}
              tone={eventModeTone(mode)}
            />
          </div>
        </div>

        <div className="mt-3 space-y-1 text-sm text-ggz-text-secondary">
          <p>{date ? formatDate(date) : "Date TBD"}</p>
          {location && <p>{location}</p>}
          <p className="text-ggz-text-muted">{organizer_name ?? "Community event"}</p>
          {game_name && <p>{game_name}</p>}
          {typeof rsvp_count === "number" && (
            <p>
              <span className="text-ggz-amber">{rsvp_count}</span> attending
            </p>
          )}
        </div>
      </div>
    </HoverCard>
  );
}
