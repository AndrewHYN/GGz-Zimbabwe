"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { ErrorState } from "@/components/ui/ErrorState";
import { ApiError } from "@/lib/api";
import { useDiscovery, type PublicOrganization } from "@/lib/useDiscovery";

interface OrganizationDetail extends PublicOrganization {
  website: string;
  venues: { id: number; name: string; type: string; address: string; description: string; opening_hours: string; verified: boolean }[];
  events: { id: number; name: string; start_date: string }[];
}

export default function OrganizationPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: organization, error, loading, retry } = useDiscovery<OrganizationDetail>(
    "/api/organizations/" + encodeURIComponent(slug) + "/",
  );
  const missing = error instanceof ApiError && error.status === 404;
  useEffect(() => {
    const venue = window.location.hash.slice(1);
    if (organization && /^venue-[0-9]+$/.test(venue)) document.getElementById(venue)?.scrollIntoView();
  }, [organization]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/organizations/" className="mb-5 inline-block text-sm text-ggz-amber">← Organizations</Link>
      {loading && <p role="status" className="text-ggz-text-secondary">Loading organization…</p>}
      {error ? (
        <ErrorState
          title={missing ? "Organization not found" : "Organization unavailable"}
          message={missing ? "Return to the directory to browse public organizations." : "Try loading this profile again."}
          onRetry={missing ? undefined : retry}
        />
      ) : organization && (
        <>
          <section className="rounded-2xl border border-ggz-border bg-ggz-bg-1 p-5 sm:p-7">
            <div className="flex items-center gap-4">
              <Avatar src={organization.logo} alt={organization.name} size="lg" />
              <div className="min-w-0">
                <h1 className="break-words text-3xl font-bold">{organization.name}</h1>
                <p className="text-sm text-ggz-text-secondary">
                  {[organization.type, organization.location, organization.verified && "Verified"].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            {organization.description && <p className="mt-5 whitespace-pre-line leading-relaxed text-ggz-text-secondary">{organization.description}</p>}
            {/^https?:\/\//i.test(organization.website) && (
              <a href={organization.website} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm text-ggz-amber">Visit website</a>
            )}
          </section>
          <section className="mt-7">
            <h2 className="mb-3 text-xl font-semibold">Public venues</h2>
            {organization.venues.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {organization.venues.map((venue) => (
                  <article key={venue.id} id={"venue-" + venue.id} className="scroll-mt-20 rounded-xl border border-ggz-border bg-ggz-bg-1 p-4">
                    <h3 className="font-semibold">{venue.name}</h3>
                    <p className="text-sm text-ggz-text-secondary">{venue.type}{venue.verified ? " · Verified" : ""}</p>
                    {venue.address && <p className="mt-2 text-sm">{venue.address}</p>}
                    {venue.opening_hours && <p className="mt-1 text-sm text-ggz-text-secondary">{venue.opening_hours}</p>}
                    {venue.description && <p className="mt-2 text-sm text-ggz-text-secondary">{venue.description}</p>}
                  </article>
                ))}
              </div>
            ) : <p className="text-sm text-ggz-text-secondary">No public venues listed.</p>}
          </section>
          {organization.events.length > 0 && (
            <section className="mt-7">
              <h2 className="mb-3 text-xl font-semibold">Events</h2>
              <ul className="space-y-2">
                {organization.events.map((event) => (
                  <li key={event.id}>
                    <Link href={"/events/" + event.id + "/"} className="text-ggz-amber hover:underline">{event.name}</Link>
                    <time dateTime={event.start_date} className="ml-3 text-sm text-ggz-text-secondary">
                      {new Date(event.start_date).toLocaleDateString("en-ZW", { dateStyle: "medium", timeZone: "Africa/Harare" })}
                    </time>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
