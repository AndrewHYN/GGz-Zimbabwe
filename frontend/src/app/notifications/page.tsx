"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

interface Notification {
  id: number;
  actor: { gamer_tag: string; avatar?: string | null };
  notification_type: string;
  message: string;
  target_url?: string | null;
  created_at: string;
  is_read: boolean;
}

function csrfToken() {
  if (typeof document === "undefined") return "";
  return document.cookie.match(/(?:^|; )csrftoken=([^;]+)/)?.[1] ?? "";
}

const INTERNAL_ROUTE_PATTERNS = [
  /^\/profiles\/[^/]+\/?$/,
  /^\/feed\/posts\/\d+\/?$/,
  /^\/tournaments\/[^/]+\/?$/,
  /^\/marketplace\/listing\/\d+\/?$/,
  /^\/teams\/[^/]+\/?$/,
  /^\/games\/\d+\/?$/,
  /^\/events\/\d+\/?$/,
];

function normalizeInternalTarget(target: string | null | undefined): string | null {
  if (!target) return null;
  if (/^\/messages\/\d+\/?$/.test(target)) return "/messages";
  return INTERNAL_ROUTE_PATTERNS.some((pattern) => pattern.test(target)) ? target : null;
}

function timeLabel(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  return Math.floor(hours / 24) + "d ago";
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    fetch("/api/notifications/", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Unauthenticated");
        return res.json();
      })
      .then((data) => setNotifications(Array.isArray(data) ? data : data.results ?? []))
      .catch(() => router.push("/auth/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function markOneRead(id: number) {
    try {
      if (!csrfToken()) await fetch("/api/csrf/", { credentials: "include" });
      const res = await fetch("/api/notifications/" + id + "/read/", {
        method: "POST",
        credentials: "include",
        headers: {
          "X-CSRFToken": csrfToken(),
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      if (!res.ok) throw new Error("Failed");
      setNotifications((items) => items.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    } catch {
      // Keep the unread state so the user can retry.
    }
  }

  async function markAllRead() {
    if (marking) return;
    setMarking(true);
    try {
      if (!csrfToken()) await fetch("/api/csrf/", { credentials: "include" });
      const res = await fetch("/api/notifications/mark-all-read/", {
        method: "POST",
        credentials: "include",
        headers: {
          "X-CSRFToken": csrfToken(),
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      if (!res.ok) throw new Error("Failed");
      setNotifications((items) => items.map((item) => ({ ...item, is_read: true })));
    } finally {
      setMarking(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl px-4 py-10 text-ggz-text-secondary">Loading notifications…</div>;
  }

  const unread = notifications.filter((item) => !item.is_read).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ggz-amber">Activity</p>
          <h1 className="mt-1 text-3xl font-bold text-ggz-text-primary">Notifications</h1>
          <p className="mt-1 text-sm text-ggz-text-secondary">{unread ? unread + " unread" : "You're all caught up"}</p>
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            disabled={marking}
            className="rounded-xl border border-ggz-border bg-ggz-bg-1 px-4 py-2 text-sm font-semibold text-ggz-text-primary transition hover:border-ggz-amber/50 disabled:opacity-50"
          >
            {marking ? "Saving…" : "Mark all read"}
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-ggz-border bg-ggz-bg-1 p-12 text-center">
          <p className="font-semibold text-ggz-text-primary">No notifications yet</p>
          <p className="mt-2 text-sm text-ggz-text-secondary">Follow gamers, join tournaments and interact with the community to see activity here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((item) => {
            const content = (
              <div className={"flex items-start gap-3 rounded-2xl border p-4 transition hover:bg-ggz-bg-2 " + (item.is_read ? "border-ggz-border bg-ggz-bg-1" : "border-ggz-amber/30 bg-ggz-amber/5")}>
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-ggz-bg-2">
                  {item.actor.avatar ? (
                    <Image src={item.actor.avatar} alt="" fill sizes="40px" className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-ggz-amber">{item.actor.gamer_tag.slice(0, 1).toUpperCase()}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-6 text-ggz-text-secondary">{item.message || item.notification_type}</p>
                  <p className="mt-1 text-xs text-ggz-text-muted">{item.actor.gamer_tag} · {timeLabel(item.created_at)}</p>
                </div>
                {!item.is_read ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      markOneRead(item.id);
                    }}
                    className="mt-1 shrink-0 rounded-full bg-ggz-amber px-2.5 py-1 text-[10px] font-semibold text-black hover:brightness-110"
                  >
                    Mark read
                  </button>
                ) : null}
              </div>
            );
            const href = normalizeInternalTarget(item.target_url);
            return href ? <Link key={item.id} href={href}>{content}</Link> : <div key={item.id}>{content}</div>;
          })}
        </div>
      )}
    </div>
  );
}
