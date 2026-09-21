"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Notification {
  id: string;
  actor: {
    gamer_tag: string;
    avatar: string;
  };
  notification_type: string;
  message: string;
  target: string;
  created_at: string;
  is_read: boolean;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await fetch("/api/notifications/", {
          credentials: "include",
        });
        if (res.status === 401 || res.status === 403) {
          setAuthError(true);
          return;
        }
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : (data.results ?? data));
      } catch {
        setAuthError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (authError) router.push("/auth/login");
  }, [authError, router]);

  async function markAllRead() {
    try {
      await fetch("/api/notifications/mark-all-read/", {
        method: "POST",
        credentials: "include",
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );
    } catch {}
  }

  if (loading) {
    return (
      <div className="max-w-[1536px] mx-auto px-4 py-8">
        <p className="text-ggz-text-muted">Loading...</p>
      </div>
    );
  }

  if (authError) return null;

  return (
    <div className="max-w-[1536px] mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ggz-text-primary">
          Notifications
        </h1>
        {notifications.some((n) => !n.is_read) && (
          <button
            onClick={markAllRead}
            className="bg-ggz-amber text-black font-semibold px-5 py-2 rounded-[var(--radius-lg)] hover:opacity-90 transition"
          >
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-ggz-bg-1 border border-ggz-border rounded-[var(--radius-lg)] p-8 text-center">
          <p className="text-ggz-text-muted">No notifications yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`bg-ggz-bg-1 border rounded-[var(--radius-lg)] p-4 flex items-start gap-3 transition ${
                n.is_read
                  ? "border-ggz-border"
                  : "border-ggz-amber/40 bg-ggz-amber/5"
              }`}
            >
<Image
                  src={n.actor.avatar}
                  alt={n.actor.gamer_tag}
                  className="w-9 h-9 rounded-full bg-ggz-border object-cover shrink-0"
                  fill
                  sizes="36px"
                />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ggz-text-secondary">
                  <span className="font-semibold text-ggz-text-primary">
                    {n.actor.gamer_tag}
                  </span>{" "}
                  {n.notification_type}
                  {n.target && (
                    <>
                      {" "}
                      <span className="font-semibold text-ggz-amber">
                        {n.target}
                      </span>
                    </>
                  )}
                </p>
                <span className="text-[11px] text-ggz-text-muted">
                  {new Date(n.created_at).toLocaleDateString()}
                </span>
              </div>
              {!n.is_read && (
                <span className="w-2.5 h-2.5 rounded-full bg-ggz-amber shrink-0 mt-1" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
