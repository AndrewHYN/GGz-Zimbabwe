import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-ggz-border bg-ggz-bg-1">
      <div className="max-w-[1536px] mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <Link href="/" className="flex items-center gap-1 font-bold text-xl text-ggz-text-primary hover:text-ggz-amber transition-colors mb-3">
              GGz<span className="text-ggz-amber">.</span>
            </Link>
            <p className="text-sm text-ggz-text-muted leading-relaxed">
              Zimbabwe&apos;s gaming ecosystem for discovery, competition, and community.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ggz-text-primary mb-3">Explore</h3>
            <div className="space-y-2">
              <Link href="/games" className="block text-sm text-ggz-text-muted hover:text-ggz-text-primary transition-colors">Games</Link>
              <Link href="/tournaments" className="block text-sm text-ggz-text-muted hover:text-ggz-text-primary transition-colors">Tournaments</Link>
              <Link href="/events" className="block text-sm text-ggz-text-muted hover:text-ggz-text-primary transition-colors">Events</Link>
              <Link href="/marketplace" className="block text-sm text-ggz-text-muted hover:text-ggz-text-primary transition-colors">Marketplace</Link>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ggz-text-primary mb-3">Community</h3>
            <div className="space-y-2">
              <Link href="/feed" className="block text-sm text-ggz-text-muted hover:text-ggz-text-primary transition-colors">Feed</Link>
              <Link href="/teams" className="block text-sm text-ggz-text-muted hover:text-ggz-text-primary transition-colors">Teams</Link>
              <Link href="/gamers" className="block text-sm text-ggz-text-muted hover:text-ggz-text-primary transition-colors">Find Players</Link>
              <Link href="/leaderboards" className="block text-sm text-ggz-text-muted hover:text-ggz-text-primary transition-colors">Rankings</Link>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ggz-text-primary mb-3">Legal</h3>
            <div className="space-y-2">
              <Link href="/privacy" className="block text-sm text-ggz-text-muted hover:text-ggz-text-primary transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="block text-sm text-ggz-text-muted hover:text-ggz-text-primary transition-colors">Terms of Service</Link>
              <Link href="/cookies" className="block text-sm text-ggz-text-muted hover:text-ggz-text-primary transition-colors">Cookie Policy</Link>
              <Link href="/refund" className="block text-sm text-ggz-text-muted hover:text-ggz-text-primary transition-colors">Refund Policy</Link>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-ggz-border-subtle">
        <div className="max-w-[1536px] mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-ggz-text-muted">
          <span>&copy; {new Date().getFullYear()} GGz</span>
          <span>Built for competitive gaming communities.</span>
        </div>
      </div>
    </footer>
  );
}
