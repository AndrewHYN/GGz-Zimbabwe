import Link from "next/link";
import { eventTime, type Competition } from "@/lib/competition";
export function CompetitionCard({
  event,
  index = 0,
}: {
  event: Competition;
  index?: number;
}) {
  const open = event.status === "Registration Open";
  return (
    <Link
      href={`/tournaments/${event.slug}/`}
      className={`competition-card card-tone-${index % 3}`}
    >
      <div className="competition-card-art">
        <span className="card-game">{event.game_name}</span>
        <span className="card-glyph" aria-hidden="true">
          {index % 2 ? "↗" : "VS"}
        </span>
        <span className="event-status">
          {open ? "JOIN NOW" : event.status.toUpperCase()}
        </span>
      </div>
      <div className="competition-card-body">
        <p className="eyebrow">
          {event.mode === "online" ? "ONLINE" : event.location || "IN PERSON"} ·{" "}
          {event.format || "1v1"}
        </p>
        <h3>{event.name}</h3>
        <p className="event-date">
          {eventTime(event.start_date)} <span>CAT</span>
        </p>
        <div className="card-bottom">
          <span>
            {event.participant_count}/{event.max_participants} players
          </span>
          <strong>{open ? "Join event" : "View event"} ↗</strong>
        </div>
      </div>
    </Link>
  );
}
export function ServiceNotice({
  message = "Events are temporarily unavailable. Please try again shortly.",
}: {
  message?: string;
}) {
  return (
    <div className="service-notice" role="status">
      <strong>Taking a short timeout.</strong>
      <p>{message}</p>
      <a href="">Try again ↗</a>
    </div>
  );
}
