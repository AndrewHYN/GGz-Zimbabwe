"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { useDiscovery, type PublicOrganization } from "@/lib/useDiscovery";

export default function OrganizationsPage() {
  const [query, setQuery] = useState("");
  const { data, error, loading, retry } = useDiscovery<PublicOrganization[]>(
    "/api/organizations/" + (query ? "?q=" + encodeURIComponent(query) : ""),
  );

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(String(new FormData(event.currentTarget).get("q") ?? "").trim());
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold">Organizations</h1>
      <form role="search" aria-label="Search organizations" onSubmit={search} className="my-5 flex max-w-xl gap-2">
        <input type="search" name="q" aria-label="Organization name or city" placeholder="Name or city"
          className="min-w-0 flex-1 rounded-xl border border-ggz-border bg-ggz-bg-2 px-3 text-sm focus:border-ggz-amber" />
        <Button type="submit">Search</Button>
      </form>
      {loading && <p role="status" className="text-ggz-text-secondary">Loading organizations…</p>}
      {error ? (
        <ErrorState title="Organizations are unavailable" message="Try loading the directory again." onRetry={retry} />
      ) : data?.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((organization) => (
            <Link key={organization.id} href={"/organizations/" + organization.slug + "/"}
              className="min-w-0 rounded-2xl border border-ggz-border bg-ggz-bg-1 p-4 hover:border-ggz-amber">
              <div className="flex items-center gap-3">
                <Avatar src={organization.logo} alt={organization.name} />
                <div className="min-w-0">
                  <h2 className="break-words font-semibold">{organization.name}</h2>
                  <p className="text-sm text-ggz-text-secondary">
                    {[organization.type, organization.location, organization.verified && "Verified"].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
              {organization.description && <p className="mt-3 line-clamp-2 text-sm text-ggz-text-secondary">{organization.description}</p>}
            </Link>
          ))}
        </div>
      ) : !loading && (
        <p className="py-5 text-ggz-text-secondary">
          {query ? "No public organizations match “" + query + "”." : "There are no public organizations to show yet."}
        </p>
      )}
    </section>
  );
}
