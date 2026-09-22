"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Provider {
  provider: string;
  name: string;
  connected: boolean;
  display_name: string;
  available: boolean;
}

interface SecurityOverview {
  username: string;
  email: string;
  providers: Provider[];
  presence: { show_online_status: boolean; show_last_seen: boolean };
}

function csrfToken() {
  if (typeof document === "undefined") return "";
  return document.cookie.match(/(?:^|; )csrftoken=([^;]+)/)?.[1] ?? "";
}

async function ensureCsrf() {
  if (!csrfToken()) await fetch("/api/csrf/", { credentials: "include" });
}

export default function SecurityPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword1, setNewPassword1] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/security/overview/", { credentials: "include" })
      .then((res) => {
        if (cancelled) return null;
        if (res.status === 401 || res.status === 403) {
          setAuthError(true);
          return null;
        }
        if (!res.ok) throw new Error("Failed");
        return res.json() as Promise<SecurityOverview>;
      })
      .then((data) => {
        if (!cancelled && data) setOverview(data);
      })
      .catch(() => {
        if (!cancelled) setOverview(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  async function updatePresence(showOnlineStatus: boolean, showLastSeen: boolean) {
    if (action) return;
    setAction("presence");
    setNotice("");
    try {
      await ensureCsrf();
      const res = await fetch("/api/security/presence/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken(), "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ show_online_status: showOnlineStatus, show_last_seen: showLastSeen }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Update failed");
      setOverview((prev) => (prev ? { ...prev, presence: { show_online_status: data.show_online_status, show_last_seen: data.show_last_seen } } : prev));
      setNotice("Presence privacy updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Update failed");
    } finally {
      setAction(null);
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (action) return;
    setAction("password");
    setNotice("");
    try {
      await ensureCsrf();
      const form = new FormData();
      form.append("old_password", oldPassword);
      form.append("new_password1", newPassword1);
      form.append("new_password2", newPassword2);
      const res = await fetch("/accounts/password_change/", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": csrfToken() },
        body: form,
      });
      if (!res.ok) throw new Error("Password change failed. Check your current password.");
      setNotice("Password changed. Please sign in again.");
      router.push("/auth/login");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Password change failed");
    } finally {
      setAction(null);
    }
  }

  async function exportData() {
    if (action) return;
    setAction("export");
    setNotice("");
    try {
      const res = await fetch("/api/security/export/", { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "ggz-data-export.json";
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice("Your data export has downloaded.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Export failed");
    } finally {
      setAction(null);
    }
  }

  async function unlinkProvider(provider: string) {
    if (action) return;
    setAction("unlink-" + provider);
    setNotice("");
    try {
      await ensureCsrf();
      const form = new FormData();
      const res = await fetch("/accounts/security/unlink/" + encodeURIComponent(provider) + "/", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": csrfToken() },
        body: form,
      });
      if (!res.ok) throw new Error("Unlink failed");
      setVersion((value) => value + 1);
      setNotice(provider + " disconnected.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unlink failed");
    } finally {
      setAction(null);
    }
  }

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-8 text-ggz-text-secondary">Loading security settings…</div>;
  if (authError || !overview)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-ggz-border bg-ggz-bg-1 p-8">
          <h1 className="text-2xl font-bold text-ggz-text-primary">Account security</h1>
          <p className="mt-2 text-ggz-text-secondary">Sign in to manage your security settings.</p>
          <Link href="/auth/login" className="mt-6 inline-block rounded-xl bg-ggz-amber px-5 py-2 text-sm font-semibold text-black">Log in</Link>
        </div>
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ggz-amber">Settings</p>
      <h1 className="mt-1 text-3xl font-bold text-ggz-text-primary">Account security</h1>
      <p className="mt-1 text-sm text-ggz-text-secondary">Signed in as @{overview.username} · {overview.email}</p>

      <section className="mt-6 rounded-2xl border border-ggz-border bg-ggz-bg-1 p-5">
        <h2 className="font-semibold text-ggz-text-primary">Change password</h2>
        <form onSubmit={changePassword} className="mt-4 space-y-3">
          <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required placeholder="Current password" autoComplete="current-password" className="h-11 w-full rounded-xl border border-ggz-border bg-ggz-bg-2 px-4 text-sm text-ggz-text-primary outline-none focus:border-ggz-amber" />
          <input type="password" value={newPassword1} onChange={(e) => setNewPassword1(e.target.value)} required placeholder="New password" autoComplete="new-password" className="h-11 w-full rounded-xl border border-ggz-border bg-ggz-bg-2 px-4 text-sm text-ggz-text-primary outline-none focus:border-ggz-amber" />
          <input type="password" value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} required placeholder="Confirm new password" autoComplete="new-password" className="h-11 w-full rounded-xl border border-ggz-border bg-ggz-bg-2 px-4 text-sm text-ggz-text-primary outline-none focus:border-ggz-amber" />
          <button type="submit" disabled={action === "password"} className="rounded-xl bg-ggz-amber px-5 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-40">
            {action === "password" ? "Saving…" : "Change password"}
          </button>
        </form>
      </section>

      <section className="mt-4 rounded-2xl border border-ggz-border bg-ggz-bg-1 p-5">
        <h2 className="font-semibold text-ggz-text-primary">Presence privacy</h2>
        <div className="mt-4 space-y-3 text-sm">
          <label className="flex items-center gap-3 text-ggz-text-secondary">
            <input type="checkbox" checked={overview.presence.show_online_status} onChange={(e) => updatePresence(e.target.checked, overview.presence.show_last_seen)} disabled={action === "presence"} className="h-4 w-4 accent-amber-500" />
            Show my online status
          </label>
          <label className="flex items-center gap-3 text-ggz-text-secondary">
            <input type="checkbox" checked={overview.presence.show_last_seen} onChange={(e) => updatePresence(overview.presence.show_online_status, e.target.checked)} disabled={action === "presence"} className="h-4 w-4 accent-amber-500" />
            Show when I was last seen
          </label>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-ggz-border bg-ggz-bg-1 p-5">
        <h2 className="font-semibold text-ggz-text-primary">Connected accounts</h2>
        <div className="mt-4 space-y-2">
          {overview.providers.map((item) => (
            <div key={item.provider} className="flex items-center gap-3 rounded-xl border border-ggz-border bg-ggz-bg-2 p-3 text-sm">
              <span className="font-semibold text-ggz-text-primary">{item.name}</span>
              <span className="text-ggz-text-muted">{item.connected ? (item.display_name || "Connected") : item.available ? "Not connected" : "Unavailable"}</span>
              <span className="ml-auto">
                {item.connected ? (
                  <button type="button" onClick={() => unlinkProvider(item.provider)} disabled={action === "unlink-" + item.provider} className="rounded-lg px-3 py-1.5 text-xs text-red-400 hover:bg-red-400/10 disabled:opacity-40">Unlink</button>
                ) : item.available ? (
                  <a href={"/accounts/auth/" + item.provider + "/start/"} className="rounded-lg bg-ggz-amber px-3 py-1.5 text-xs font-semibold text-black hover:brightness-110">Connect</a>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-ggz-border bg-ggz-bg-1 p-5">
        <h2 className="font-semibold text-ggz-text-primary">Your data</h2>
        <p className="mt-1 text-sm text-ggz-text-secondary">Download a copy of your GGz profile, posts, connections and listings.</p>
        <button type="button" onClick={exportData} disabled={action === "export"} className="mt-3 rounded-xl border border-ggz-border bg-ggz-bg-2 px-4 py-2 text-sm font-semibold text-ggz-text-primary hover:border-ggz-amber/50 disabled:opacity-40">
          {action === "export" ? "Preparing…" : "Download my data"}
        </button>
      </section>

      {notice && <p className="mt-4 text-sm text-ggz-text-secondary" role="status">{notice}</p>}
    </div>
  );
}
