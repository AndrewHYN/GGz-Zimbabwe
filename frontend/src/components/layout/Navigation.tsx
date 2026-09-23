"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  SearchIcon,
  BellIcon,
  MenuIcon,
  XIcon,
  ChevronDownIcon,
  SunIcon,
  MoonIcon,
  GamepadIcon,
  TrophyIcon,
  UsersIcon,
  StoreIcon,
  MessageIcon,
  HomeIcon,
  CalendarIcon,
} from "@/components/icons";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

interface User {
  id: number;
  username: string;
  displayName?: string;
  avatar?: string;
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    function listener(e: MouseEvent) {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    }
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [ref, handler]);
}

function NavDropdown({
  ref,
  open,
  children,
}: {
  ref: React.RefObject<HTMLDivElement | null>;
  open: boolean;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      ref={ref}
      className="absolute left-0 top-full mt-1 min-w-[220px] rounded-[var(--radius-md)] border border-ggz-border bg-ggz-bg-1 p-1 shadow-lg animate-fade-in"
    >
      {children}
    </div>
  );
}

function DropdownLink({ href, icon: Icon, label, pathname }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string; pathname: string }) {
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-ggz-surface text-ggz-amber"
          : "text-ggz-text-secondary hover:bg-ggz-surface hover:text-ggz-text-primary"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ggz-theme") as "light" | "dark" | null;
      return stored || "dark";
    }
    return "dark";
  });
  const [searchQuery, setSearchQuery] = useState("");

  const discoverRef = useRef<HTMLDivElement>(null);
  const communityRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useClickOutside(discoverRef, useCallback(() => setDiscoverOpen(false), []));
  useClickOutside(communityRef, useCallback(() => setCommunityOpen(false), []));
  useClickOutside(profileRef, useCallback(() => setProfileOpen(false), []));

  useEffect(() => {
    fetch("/api/me/", { credentials: "include", headers: { "X-Requested-With": "XMLHttpRequest" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.authenticated) {
          setUser({
            id: data.user.id,
            username: data.user.username,
            displayName: data.profile?.gamer_tag || data.user.username,
            avatar: data.profile?.avatar || undefined,
          });
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setMobileOpen(false);
    setDiscoverOpen(false);
    setCommunityOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("ggz-theme", next);
    document.documentElement.dataset.theme = next;
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  function getCsrfToken(): string {
    if (typeof document === "undefined") return "";
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : "";
  }

  async function handleLogout() {
    try {
      await fetch("/accounts/logout/", {
        method: "POST",
        credentials: "include",
        headers: {
          "X-CSRFToken": getCsrfToken(),
          "X-Requested-With": "XMLHttpRequest",
        },
      });
    } catch {
      // Server logout is best-effort; always leave the logged-out UI state.
    } finally {
      setUser(null);
      setProfileOpen(false);
      router.push("/");
      router.refresh();
    }
  }

  function isActive(pattern: string) {
    return pathname === pattern || pathname.startsWith(pattern + "/");
  }

  return (
    <nav className="sticky top-0 z-50 bg-ggz-base/85 backdrop-blur-lg border-b border-ggz-border">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        {/* Left section */}
        <div className="flex items-center gap-1">
          <Link href="/" className="mr-4 flex items-center gap-2 text-lg font-bold text-ggz-text-primary">
            <GamepadIcon className="h-6 w-6 text-ggz-amber" />
            <span>GGz</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {/* Discover */}
            <div ref={discoverRef} className="relative">
              <button
                onClick={() => {
                  setDiscoverOpen(!discoverOpen);
                  setCommunityOpen(false);
                  setProfileOpen(false);
                }}
                className="flex items-center gap-1 rounded-[var(--radius-md)] px-3 py-2 text-sm text-ggz-text-secondary hover:bg-ggz-surface hover:text-ggz-text-primary transition-colors"
              >
                Discover
                <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${discoverOpen ? "rotate-180" : ""}`} />
              </button>
              <NavDropdown ref={discoverRef} open={discoverOpen}>
                <DropdownLink href="/" pathname={pathname} icon={HomeIcon} label="Home" />
                <DropdownLink href="/gamers" pathname={pathname} icon={UsersIcon} label="Find Players" />
                <DropdownLink href="/leaderboards" pathname={pathname} icon={TrophyIcon} label="Rankings" />
                <DropdownLink href="/discover" pathname={pathname} icon={SearchIcon} label="Nearby Gaming" />
              </NavDropdown>
            </div>

            {/* Games */}
            <Link
              href="/games"
              className={`rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors ${
                isActive("/games")
                  ? "text-ggz-amber"
                  : "text-ggz-text-secondary hover:bg-ggz-surface hover:text-ggz-text-primary"
              }`}
            >
              Games
            </Link>

            {/* Compete */}
            <Link
              href="/tournaments"
              className={`rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors ${
                isActive("/tournaments")
                  ? "text-ggz-amber"
                  : "text-ggz-text-secondary hover:bg-ggz-surface hover:text-ggz-text-primary"
              }`}
            >
              Compete
            </Link>

            {/* Marketplace */}
            <Link
              href="/marketplace"
              className={`rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors ${
                isActive("/marketplace")
                  ? "text-ggz-amber"
                  : "text-ggz-text-secondary hover:bg-ggz-surface hover:text-ggz-text-primary"
              }`}
            >
              <span className="flex items-center gap-2">
                <StoreIcon className="h-4 w-4" />
                Marketplace
              </span>
            </Link>

            {/* Community */}
            <div ref={communityRef} className="relative">
              <button
                onClick={() => {
                  setCommunityOpen(!communityOpen);
                  setDiscoverOpen(false);
                  setProfileOpen(false);
                }}
                className="flex items-center gap-1 rounded-[var(--radius-md)] px-3 py-2 text-sm text-ggz-text-secondary hover:bg-ggz-surface hover:text-ggz-text-primary transition-colors"
              >
                Community
                <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${communityOpen ? "rotate-180" : ""}`} />
              </button>
              <NavDropdown ref={communityRef} open={communityOpen}>
                <DropdownLink href="/feed" pathname={pathname} icon={MessageIcon} label="Community Feed" />
                <DropdownLink href="/teams" pathname={pathname} icon={UsersIcon} label="Teams" />
                <DropdownLink href="/events" pathname={pathname} icon={CalendarIcon} label="Events" />
              </NavDropdown>
            </div>
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <form onSubmit={handleSearch} className="hidden md:flex items-center">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ggz-text-muted" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-48 rounded-[var(--radius-md)] border border-ggz-border bg-ggz-bg-2 pl-8 pr-3 text-sm text-ggz-text-primary placeholder:text-ggz-text-muted focus:border-ggz-amber focus:outline-none transition-colors"
              />
            </div>
          </form>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-ggz-text-secondary hover:bg-ggz-surface hover:text-ggz-text-primary transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
          </button>

          {!loading && (
            <>
              {user ? (
                <>
                  {/* Notifications */}
                  <Link
                    href="/notifications"
                    className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-ggz-text-secondary hover:bg-ggz-surface hover:text-ggz-text-primary transition-colors"
                  >
                    <BellIcon className="h-4 w-4" />
                  </Link>

                  {/* Messages */}
                  <Link
                    href="/messages"
                    className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-ggz-text-secondary hover:bg-ggz-surface hover:text-ggz-text-primary transition-colors"
                  >
                    <MessageIcon className="h-4 w-4" />
                  </Link>

                  {/* Profile dropdown */}
                  <div ref={profileRef} className="relative">
                    <button
                      onClick={() => {
                        setProfileOpen(!profileOpen);
                        setDiscoverOpen(false);
                        setCommunityOpen(false);
                      }}
                      className="flex items-center gap-2 rounded-[var(--radius-md)] p-1 hover:bg-ggz-surface transition-colors"
                    >
                      <Avatar
                        src={user.avatar}
                        alt={user.displayName || user.username}
                        size="sm"
                      />
                      <ChevronDownIcon className={`hidden sm:block h-3.5 w-3.5 text-ggz-text-secondary transition-transform ${profileOpen ? "rotate-180" : ""}`} />
                    </button>

                    <NavDropdown ref={profileRef} open={profileOpen}>
                      <div className="border-b border-ggz-border px-3 py-2 mb-1">
                        <p className="text-sm font-medium text-ggz-text-primary">{user.displayName || user.username}</p>
                        <p className="text-xs text-ggz-text-muted">@{user.username}</p>
                      </div>
                      <DropdownLink href="/dashboard" pathname={pathname} icon={HomeIcon} label="Dashboard" />
                      <DropdownLink href={`/profiles/${user.displayName || user.username}`} pathname={pathname} icon={UsersIcon} label="My Profile" />
                      <DropdownLink href="/teams" pathname={pathname} icon={UsersIcon} label="Teams" />
                      <DropdownLink href="/messages" pathname={pathname} icon={MessageIcon} label="Messages" />
                      <DropdownLink href="/accounts/security/" pathname={pathname} icon={GamepadIcon} label="Settings" />
                      <div className="my-1 border-t border-ggz-border" />
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm text-red-400 hover:bg-ggz-surface transition-colors"
                      >
                        Log out
                      </button>
                    </NavDropdown>
                  </div>
                </>
              ) : (
                <Link href="/auth/login">
                  <Button variant="primary" size="sm">
                    Log In
                  </Button>
                </Link>
              )}
            </>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex lg:hidden h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-ggz-text-secondary hover:bg-ggz-surface hover:text-ggz-text-primary transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-ggz-border bg-ggz-base animate-fade-in">
          <div className="mx-auto max-w-7xl px-4 py-4 space-y-3">
            {/* Mobile search */}
            <form onSubmit={handleSearch} className="flex items-center">
              <div className="relative w-full">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ggz-text-muted" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 w-full rounded-[var(--radius-md)] border border-ggz-border bg-ggz-bg-2 pl-10 pr-4 text-sm text-ggz-text-primary placeholder:text-ggz-text-muted focus:border-ggz-amber focus:outline-none transition-colors"
                />
              </div>
            </form>

            <div className="space-y-1">
              <Link
                href="/"
                className={`flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm transition-colors ${
                  pathname === "/" ? "bg-ggz-surface text-ggz-amber" : "text-ggz-text-secondary hover:bg-ggz-surface hover:text-ggz-text-primary"
                }`}
              >
                <HomeIcon className="h-4 w-4" />
                Home
              </Link>

              <Link
                href="/gamers"
                className={`flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm transition-colors ${
                  pathname === "/gamers" ? "bg-ggz-surface text-ggz-amber" : "text-ggz-text-secondary hover:bg-ggz-surface hover:text-ggz-text-primary"
                }`}
              >
                <UsersIcon className="h-4 w-4" />
                Find Players
              </Link>

              <Link
                href="/leaderboards"
                className={`flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm transition-colors ${
                  pathname === "/leaderboards" ? "bg-ggz-surface text-ggz-amber" : "text-ggz-text-secondary hover:bg-ggz-surface hover:text-ggz-text-primary"
                }`}
              >
                <TrophyIcon className="h-4 w-4" />
                Rankings
              </Link>

              <Link
                href="/discover"
                className={`flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm transition-colors ${
                  pathname === "/discover" ? "bg-ggz-surface text-ggz-amber" : "text-ggz-text-secondary hover:bg-ggz-surface hover:text-ggz-text-primary"
                }`}
              >
                <SearchIcon className="h-4 w-4" />
                Nearby Gaming
              </Link>

              <Link
                href="/games"
                className={`flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm transition-colors ${
                  isActive("/games") ? "text-ggz-amber" : "text-ggz-text-secondary hover:bg-ggz-surface hover:text-ggz-text-primary"
                }`}
              >
                <GamepadIcon className="h-4 w-4" />
                Games
              </Link>

              <Link
                href="/tournaments"
                className={`flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm transition-colors ${
                  isActive("/tournaments") ? "text-ggz-amber" : "text-ggz-text-secondary hover:bg-ggz-surface hover:text-ggz-text-primary"
                }`}
              >
                <TrophyIcon className="h-4 w-4" />
                Compete
              </Link>

              <Link
                href="/marketplace"
                className={`flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm transition-colors ${
                  isActive("/marketplace") ? "text-ggz-amber" : "text-ggz-text-secondary hover:bg-ggz-surface hover:text-ggz-text-primary"
                }`}
              >
                <StoreIcon className="h-4 w-4" />
                Marketplace
              </Link>

              <Link
                href="/feed"
                className={`flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm transition-colors ${
                  pathname === "/feed" ? "text-ggz-amber" : "text-ggz-text-secondary hover:bg-ggz-surface hover:text-ggz-text-primary"
                }`}
              >
                <MessageIcon className="h-4 w-4" />
                Community Feed
              </Link>

              <Link
                href="/teams"
                className={`flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm transition-colors ${
                  pathname === "/teams" ? "text-ggz-amber" : "text-ggz-text-secondary hover:bg-ggz-surface hover:text-ggz-text-primary"
                }`}
              >
                <UsersIcon className="h-4 w-4" />
                Teams
              </Link>

              <Link
                href="/events"
                className={`flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm transition-colors ${
                  pathname === "/events" ? "text-ggz-amber" : "text-ggz-text-secondary hover:bg-ggz-surface hover:text-ggz-text-primary"
                }`}
              >
                <CalendarIcon className="h-4 w-4" />
                Events
              </Link>
            </div>

            {!loading && user && (
              <div className="border-t border-ggz-border pt-3 space-y-1">
                <div className="flex items-center gap-3 px-3 py-2">
                  <Avatar src={user.avatar} alt={user.displayName || user.username} size="sm" />
                  <div>
                    <p className="text-sm font-medium text-ggz-text-primary">{user.displayName || user.username}</p>
                    <p className="text-xs text-ggz-text-muted">@{user.username}</p>
                  </div>
                </div>
                <Link
                  href="/dashboard"
                  className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-ggz-text-secondary hover:bg-ggz-surface hover:text-ggz-text-primary transition-colors"
                >
                  <HomeIcon className="h-4 w-4" />
                  Dashboard
                </Link>
                <Link
                  href="/notifications"
                  className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-ggz-text-secondary hover:bg-ggz-surface hover:text-ggz-text-primary transition-colors"
                >
                  <BellIcon className="h-4 w-4" />
                  Notifications
                </Link>
                <Link
                  href="/accounts/security/"
                  className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-ggz-text-secondary hover:bg-ggz-surface hover:text-ggz-text-primary transition-colors"
                >
                  <GamepadIcon className="h-4 w-4" />
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-red-400 hover:bg-ggz-surface transition-colors"
                >
                  Log out
                </button>
              </div>
            )}

            {!loading && !user && (
              <div className="border-t border-ggz-border pt-3">
                <Link href="/auth/login" className="block">
                  <Button variant="primary" size="sm" className="w-full">
                    Log In
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
