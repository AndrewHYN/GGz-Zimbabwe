"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch, dispatchAuthChanged } from "@/lib/api";
const links = [
  ["Play", "/tournaments"],
  ["Players", "/gamers"],
  ["Venues", "/discover"],
] as const;
export default function Navigation() {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<{ tag: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const refresh = useCallback(() => {
    fetch("/api/me/", {
      credentials: "include",
      headers: { "X-Requested-With": "XMLHttpRequest" },
    })
      .then(async (response) => {
        if (response.status === 401) return null;
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => {
        setAccount(
          data?.authenticated
            ? { tag: data.profile?.gamer_tag || data.user.username }
            : null,
        );
        setNotice("");
      })
      .catch(() =>
        setNotice("Account connection unavailable. Please try again."),
      )
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener("ggz:auth-changed", refresh);
    return () => window.removeEventListener("ggz:auth-changed", refresh);
  }, [refresh]);
  useEffect(() => {
    function close(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  async function logout() {
    try {
      await apiFetch("/api/auth/logout/", { method: "POST" });
      dispatchAuthChanged();
      setOpen(false);
      router.push("/");
      router.refresh();
    } catch {
      setNotice("Could not sign out. Please try again.");
    }
  }
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="wordmark" aria-label="GGz home">
          GG<span>z</span>
          <i>ZW</i>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {links.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              aria-current={path.startsWith(href) ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <Link href="/organize/" className="organizer-link">
            For organizers ↗
          </Link>
          {loading ? (
            <span className="header-loading">Connecting…</span>
          ) : account ? (
            <Link className="arena-button small" href="/dashboard/">
              My events ↗
            </Link>
          ) : (
            <Link className="arena-button small" href="/auth/login/">
              Sign in ↗
            </Link>
          )}
          <button
            className="menu-toggle"
            aria-expanded={open}
            aria-controls="ggz-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen(!open)}
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="ggz-menu"
          className="mobile-nav"
          aria-label="Account and mobile navigation"
        >
          {links.map(([label, href]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}>
              {label} ↗
            </Link>
          ))}
          <Link href="/organize/" onClick={() => setOpen(false)}>
            For organizers ↗
          </Link>
          {account && (
            <>
              <Link
                href={`/profiles/${encodeURIComponent(account.tag)}/`}
                onClick={() => setOpen(false)}
              >
                My profile
              </Link>
              <Link href="/notifications/" onClick={() => setOpen(false)}>
                Notifications
              </Link>
              <Link href="/messages/" onClick={() => setOpen(false)}>
                Messages
              </Link>
              <Link href="/accounts/security/" onClick={() => setOpen(false)}>
                Account settings
              </Link>
              <button onClick={logout}>Sign out</button>
            </>
          )}
        </nav>
      )}
      {notice && (
        <p className="header-notice" role="status">
          {notice}
        </p>
      )}
    </header>
  );
}
