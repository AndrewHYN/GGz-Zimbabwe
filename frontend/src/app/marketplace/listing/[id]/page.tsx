"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useState } from "react";

interface ListingDetail {
  id: number;
  title: string;
  description?: string | null;
  category: string;
  price: string;
  condition: string;
  location: string;
  platform?: string | null;
  status: string;
  game_name?: string | null;
  created_at?: string | null;
  images: string[];
  seller: { gamer_tag?: string | null; avatar?: string | null };
  is_owner: boolean;
  is_saved: boolean;
  save_count: number;
}

function csrfToken() {
  if (typeof document === "undefined") return "";
  return document.cookie.match(/(?:^|; )csrftoken=([^;]+)/)?.[1] ?? "";
}

export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [action, setAction] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeImage, setActiveImage] = useState(0);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/marketplace/" + encodeURIComponent(id) + "/", { credentials: "include" })
      .then((res) => {
        if (cancelled) return null;
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!res.ok) throw new Error("Failed");
        return res.json() as Promise<ListingDetail>;
      })
      .then((detail) => {
        if (!cancelled && detail) setListing(detail);
      })
      .catch(() => {
        if (!cancelled) setListing(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, version]);

  async function listingAction(kind: "save" | "report" | "contact") {
    if (!listing || action) return;
    setAction(true);
    setNotice("");
    try {
      if (!csrfToken()) await fetch("/api/csrf/", { credentials: "include" });
      const res = await fetch("/api/marketplace/" + listing.id + "/" + kind + "/", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": csrfToken(), "X-Requested-With": "XMLHttpRequest" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Action failed");
      if (kind === "save") {
        setVersion((value) => value + 1);
        setNotice(data.saved ? "Saved to your list." : "Removed from your list.");
      } else {
        setNotice(data.message || "Done.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Action failed");
    } finally {
      setAction(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-8 text-ggz-text-secondary">Loading listing…</div>;
  if (notFound || !listing)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-ggz-border bg-ggz-bg-1 p-8">
          <h1 className="text-2xl font-bold text-ggz-text-primary">Listing not found</h1>
          <Link href="/marketplace" className="mt-6 inline-block rounded-xl bg-ggz-amber px-5 py-2 text-sm font-semibold text-black">Back to marketplace</Link>
        </div>
      </div>
    );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/marketplace" className="text-sm text-ggz-text-muted hover:text-ggz-amber">← All listings</Link>
      <div className="mt-3 grid gap-5 lg:grid-cols-2">
        <div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-ggz-border bg-ggz-bg-1">
            {listing.images.length > 0 ? (
              <Image src={listing.images[Math.min(activeImage, listing.images.length - 1)]} alt={listing.title} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-ggz-text-muted">No image</div>
            )}
          </div>
          {listing.images.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {listing.images.map((src, index) => (
                <button key={src + index} type="button" onClick={() => setActiveImage(index)} className={"relative aspect-square overflow-hidden rounded-xl border transition " + (index === activeImage ? "border-ggz-amber" : "border-ggz-border")}>
                  <Image src={src} alt="" fill sizes="25vw" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-ggz-border bg-ggz-bg-1 p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-ggz-bg-2 px-2.5 py-1 text-ggz-text-secondary">{listing.category}</span>
            <span className="rounded-full bg-ggz-bg-2 px-2.5 py-1 text-ggz-text-secondary">{listing.condition}</span>
            <span className="rounded-full bg-ggz-amber/20 px-2.5 py-1 text-ggz-amber">{listing.status}</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold text-ggz-text-primary sm:text-3xl">{listing.title}</h1>
          <p className="mt-1 text-2xl font-bold text-ggz-amber">${listing.price}</p>
          {listing.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-ggz-text-secondary">{listing.description}</p>}
          <div className="mt-4 space-y-1 text-sm text-ggz-text-secondary">
            <p>Location: <span className="text-ggz-text-primary">{listing.location}</span></p>
            {listing.game_name && <p>Game: <span className="text-ggz-text-primary">{listing.game_name}</span></p>}
            {listing.platform && <p>Platform: <span className="text-ggz-text-primary">{listing.platform}</span></p>}
          </div>
          <div className="mt-5 flex items-center gap-3 border-t border-ggz-border pt-4">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-ggz-bg-2">
              {listing.seller.avatar ? <Image src={listing.seller.avatar} alt="" fill sizes="40px" className="object-cover" /> : <span className="flex h-full w-full items-center justify-center text-sm font-bold text-ggz-amber">{(listing.seller.gamer_tag || "?").slice(0, 1)}</span>}
            </div>
            {listing.seller.gamer_tag ? (
              <Link href={"/profiles/" + encodeURIComponent(listing.seller.gamer_tag)} className="text-sm font-semibold text-ggz-text-primary hover:text-ggz-amber">{listing.seller.gamer_tag}</Link>
            ) : (
              <span className="text-sm text-ggz-text-muted">Unknown seller</span>
            )}
          </div>
          {!listing.is_owner && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => listingAction("contact")} disabled={action} className="rounded-xl bg-ggz-amber px-4 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-40">
                {action ? "Working…" : "Contact seller"}
              </button>
              <button onClick={() => listingAction("save")} disabled={action} className="rounded-xl border border-ggz-border bg-ggz-bg-2 px-4 py-2 text-sm font-semibold text-ggz-text-primary hover:border-ggz-amber/50 disabled:opacity-40">
                {action ? "Working…" : listing.is_saved ? "Saved ✓" : "Save"}
              </button>
              <button onClick={() => listingAction("report")} disabled={action} className="rounded-xl px-3 py-2 text-sm text-ggz-text-muted transition hover:bg-ggz-bg-2 hover:text-ggz-text-primary disabled:opacity-40">
                Report
              </button>
            </div>
          )}
          {notice && <p className="mt-3 text-sm text-ggz-text-secondary" role="status">{notice}</p>}
        </div>
      </div>
    </div>
  );
}
