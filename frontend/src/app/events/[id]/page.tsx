"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useState } from "react";

interface Attendee {
  gamer_tag: string;
  avatar?: string | null;
}

interface EventDetail {
  id: number;
  name: string;
  description?: string | null;
  start_date?: string | null;
  location?: string | null;
  city?: string | null;
  mode: string;
  status: string;
  banner?: string | null;
  capacity?: number | null;
  rsvp_count: number;
  spots_remaining?: number | null;
  game_name?: string | null;
  organization_name?: string | null;
  organizer: { gamer_tag?: string | null; avatar?: string | null };
  is_organizer: boolean;
  is_rsvped: boolean;
  attendees: Attendee[];
}

function csrfToken() {
  if (typeof document === "undefined") return "";
  return document.cookie.match(/(?:^|; )csrftoken=([^;]+)/)?.[1] ?? "";
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [action, setAction] = useState(false);
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/events/" + encodeURIComponent(id) + "/", { credentials: "include" })
      .then((res) => {
        if (cancelled) return null;
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!res.ok) throw new Error("Failed");
        return res.json() as Promise<EventDetail>;
      })
      .then((detail) => {
        if (!cancelled && detail) setEvent(detail);
      })
      .catch(() => {
        if (!cancelled) setEvent(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, version]);

  async function mutate(kind: "rsvp" | "leave") {
    if (!event || action) return;
    setAction(true);
    setNotice("");
    try {
      if (!csrfToken()) await fetch("/api/csrf/", { credentials: "include" });
      const res = await fetch("/api/events/" + encodeURIComponent(String(event.id)) + "/" + kind + "/", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": csrfToken(), "X-Requested-With": "XMLHttpRequest" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || "Action failed");
      setNotice(data.message || (kind === "rsvp" ? "RSVP saved." : "RSVP removed."));
      setVersion((value) => value + 1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Action failed");
    } finally {
      setAction(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-8 text-ggz-text-secondary">Loading event…</div>;
  if (notFound || !event)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-ggz-border bg-ggz-bg-1 p-8">
          <h1 className="text-2xl font-bold text-ggz-text-primary">Event not found</h1>
          <Link href="/events" className="mt-6 inline-block rounded-xl bg-ggz-amber px-5 py-2 text-sm font-semibold text-black">Back to events</Link>
        </div>
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/events" className="text-sm text-ggz-text-muted hover:text-ggz-amber">← All events</Link>
      <div className="mt-3 overflow-hidden rounded-2xl border border-ggz-border bg-ggz-bg-1">
        {event.banner ? (
          <div className="relative h-48 w-full sm:h-64">
            <Image src={event.banner} alt="" fill sizes="100vw" className="object-cover" />
          </div>
        ) : null}
        <div className="p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ggz-amber">{event.game_name || event.organization_name || "GGz event"}</p>
          <h1 className="mt-1 text-3xl font-bold text-ggz-text-primary">{event.name}</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-ggz-amber/20 px-2.5 py-1 text-ggz-amber">{event.status}</span>
            <span className="rounded-full bg-ggz-bg-2 px-2.5 py-1 capitalize text-ggz-text-secondary">{event.mode}</span>
          </div>
          {event.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-ggz-text-secondary">{event.description}</p>}
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <p className="text-ggz-text-secondary">Starts: <span className="text-ggz-text-primary">{event.start_date ? new Date(event.start_date).toLocaleString() : "TBD"}</span></p>
            <p className="text-ggz-text-secondary">Where: <span className="text-ggz-text-primary">{event.location || event.city || "Online"}</span></p>
            <p className="text-ggz-text-secondary">Attending: <span className="text-ggz-text-primary">{event.rsvp_count}{event.capacity ? " / " + event.capacity : ""}</span></p>
            <p className="text-ggz-text-secondary">Organizer: <span className="text-ggz-text-primary">{event.organizer.gamer_tag || "GGz"}</span></p>
          </div>
          <div className="mt-5">
            {event.is_rsvped ? (
              <button onClick={() => mutate("leave")} disabled={action} className="rounded-xl border border-ggz-border bg-ggz-bg-2 px-5 py-2 text-sm font-semibold text-ggz-text-primary hover:border-red-400/50 disabled:opacity-40">
                {action ? "Working…" : "Leave event"}
              </button>
            ) : (
              <button onClick={() => mutate("rsvp")} disabled={action} className="rounded-xl bg-ggz-amber px-5 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-40">
                {action ? "Working…" : "RSVP"}
              </button>
            )}
          </div>
          {notice && <p className="mt-3 text-sm text-ggz-text-secondary" role="status">{notice}</p>}
        </div>
      </div>

      <section className="mt-5 rounded-2xl border border-ggz-border bg-ggz-bg-1 p-5">
        <h2 className="font-semibold text-ggz-text-primary">Attendees ({event.attendees.length})</h2>
        {event.attendees.length === 0 ? (
          <p className="mt-3 text-sm text-ggz-text-muted">No RSVPs yet.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {event.attendees.map((attendee) => (
              <li key={attendee.gamer_tag}>
                <Link href={"/profiles/" + encodeURIComponent(attendee.gamer_tag)} className="block rounded-full border border-ggz-border bg-ggz-bg-2 px-3 py-1 text-xs text-ggz-text-secondary hover:text-ggz-amber">
                  {attendee.gamer_tag}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
