import Link from "next/link";
import { serverList } from "@/lib/server-data";
import {
  CompetitionCard,
  ServiceNotice,
} from "@/components/competition/CompetitionCard";
import type { Competition } from "@/lib/competition";
export const metadata = {
  title: "Play",
  description: "Find and join local gaming competitions in Zimbabwe.",
};
const filters = [
  ["all", "All events"],
  ["registration", "Join now"],
  ["live", "Live"],
  ["completed", "Results"],
] as const;
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const selected = filters.some(([key]) => key === status) ? status : "all";
  const { items, unavailable } =
    await serverList<Competition>("/api/tournaments/");
  const events = items.filter(
    (e) =>
      selected === "all" ||
      (selected === "registration"
        ? e.status === "Registration Open"
        : selected === "live"
          ? e.status === "Live"
          : e.status === "Completed"),
  );
  return (
    <div className="arena-container arena-section">
      <div className="page-heading">
        <p className="eyebrow">THE LOCAL COMPETITION BOARD</p>
        <h1>
          Find your next <em>match.</em>
        </h1>
        <p>Check the game, platform and rules. Then make your move.</p>
      </div>
      <div className="filter-row">
        {filters.map(([key, label]) => (
          <Link
            key={key}
            className={`filter-button ${selected === key ? "active" : ""}`}
            href={
              key === "all" ? "/tournaments/" : `/tournaments/?status=${key}`
            }
          >
            {label}
          </Link>
        ))}
        <Link className="text-link host-link" href="/tournaments/create/">
          Host an event ↗
        </Link>
      </div>
      {unavailable ? (
        <ServiceNotice />
      ) : events.length ? (
        <div className="competition-grid">
          {events.map((event, index) => (
            <CompetitionCard key={event.id} event={event} index={index} />
          ))}
        </div>
      ) : (
        <div className="arena-empty">
          <div>
            <h2>No events in this view yet.</h2>
            <p>Try another filter, meet players or host a free competition.</p>
            <Link className="arena-button secondary" href="/gamers/">
              Find players ↗
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
