"use client";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { OrganizationData, VenueData } from "@/lib/management-types";
import {
  EditorForm,
  PageShell,
  orgFields,
  venueFields,
  useResource,
  options,
} from "./shared";
export function Organizations({ slug }: { slug?: string }) {
  const { data, error, refresh } = useResource<
    OrganizationData | OrganizationData[]
  >(slug ? `/api/organizations/${slug}` : "/api/organizations");
  const save = async (path: string, body: Record<string, unknown>) => {
    const r = await apiFetch(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
    refresh();
    return r;
  };
  if (!slug) {
    const rows = Array.isArray(data) ? data : [];
    return (
      <PageShell title="Meet the communities" error={error}>
        <p className="mb-6 max-w-2xl text-ggz-text-secondary">
          Gaming lounges, organizers and communities building Zimbabwe’s scene.
          Verification badges are awarded after staff review.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {rows.map((o) => (
            <Link
              className="ggz-editor transition hover:border-ggz-amber"
              key={o.id}
              href={`/organizations/${o.slug}`}
            >
              <p className="ggz-eyebrow">
                {o.organization_type} · {o.verification_status}
              </p>
              <h2 className="mt-3 text-xl font-bold">{o.name}</h2>
              <p className="mt-2 line-clamp-3 text-sm text-ggz-text-secondary">
                {o.description}
              </p>
              <p className="mt-4 text-xs text-ggz-text-muted">
                {o.city || "Zimbabwe"}
                {o.is_owner ? " · You manage this" : ""}
              </p>
            </Link>
          ))}
        </div>
        {data && rows.length === 0 && (
          <p className="my-8 text-ggz-text-secondary">
            Be the first to register a gaming community.
          </p>
        )}
        <details className="ggz-editor mt-8">
          <summary className="cursor-pointer text-lg font-bold">
            Register an organization
          </summary>
          <div className="mt-6">
            <EditorForm
              fields={orgFields}
              submit="Submit for verification"
              save={(body) => save("/api/organizations/create", body)}
            />
          </div>
        </details>
      </PageShell>
    );
  }
  const o = !Array.isArray(data) ? data : null;
  return (
    <PageShell title={o?.name || "Organization"} error={error}>
      {o && (
        <>
          <p className="ggz-eyebrow">
            {o.organization_type} · {o.verification_status}
          </p>
          <p className="my-5 whitespace-pre-wrap text-ggz-text-secondary">
            {o.description}
          </p>
          {/^https?:\/\//.test(o.website) && (
            <a
              className="underline"
              href={o.website}
              target="_blank"
              rel="noopener noreferrer"
            >
              Visit website ↗
            </a>
          )}
          <h2 className="mb-4 mt-8 text-2xl font-bold">Venues</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {o.venues.map((v) => (
              <Link key={v.id} href={`/venues/${v.id}`} className="ggz-editor">
                <h3 className="text-lg font-bold">{v.name}</h3>
                <p className="mt-2 text-sm text-ggz-text-secondary">
                  {v.city} · {v.public_visible ? "Public" : "Private draft"}
                </p>
              </Link>
            ))}
          </div>
          {o.is_owner && (
            <div className="mt-8 grid items-start gap-5 lg:grid-cols-2">
              <details className="ggz-editor">
                <summary className="cursor-pointer font-bold">
                  Edit organization
                </summary>
                <div className="mt-5">
                  <EditorForm
                    fields={orgFields}
                    values={{
                      name: o.name,
                      description: o.description,
                      organization_type: o.organization_type,
                      city: o.city,
                      website: o.website,
                    }}
                    save={(body) =>
                      save(`/api/organizations/${slug}/edit`, body)
                    }
                  />
                </div>
              </details>
              <details className="ggz-editor">
                <summary className="cursor-pointer font-bold">
                  Add a venue
                </summary>
                <div className="mt-5">
                  <EditorForm
                    fields={venueFields}
                    submit="Save venue"
                    save={(body) =>
                      save(`/api/organizations/${slug}/venue`, body)
                    }
                  />
                </div>
              </details>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
export function Venue({ id }: { id: string }) {
  const {
    data: v,
    error,
    refresh,
  } = useResource<VenueData>(`/api/venues/${id}`);
  return (
    <PageShell title={v?.name || "Gaming venue"} error={error}>
      {v && (
        <>
          <p className="ggz-eyebrow">
            {v.organization_name} · {v.verification_status}
          </p>
          <div className="my-6 grid gap-6 md:grid-cols-2">
            <section className="ggz-editor">
              <p className="whitespace-pre-wrap text-ggz-text-secondary">
                {v.description}
              </p>
              <p className="mt-5">
                {v.address}, {v.city}
              </p>
              <p className="mt-2 text-sm text-ggz-text-secondary">
                {v.opening_hours} {v.phone}
              </p>
              {v.public_visible && (
                <a
                  className="mt-4 inline-block text-ggz-amber underline"
                  href={`https://www.openstreetmap.org/?mlat=${v.latitude}&mlon=${v.longitude}#map=16/${v.latitude}/${v.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open map ↗
                </a>
              )}
            </section>
            <section className="ggz-editor">
              <h2 className="mb-4 text-xl font-bold">Community reviews</h2>
              <p className="mb-4 text-ggz-amber">
                {v.rating_average?.toFixed(1) || "No rating yet"} ·{" "}
                {v.rating_count} reviews
              </p>
              {v.reviews.map((r) => (
                <article
                  key={r.id}
                  className="mb-4 border-b border-ggz-border pb-4"
                >
                  <p className="text-sm font-semibold">
                    {r.author.gamer_tag} · {r.rating}/5
                  </p>
                  <p className="mt-1 text-sm text-ggz-text-secondary">
                    {r.body}
                  </p>
                </article>
              ))}
              {!v.is_owner && (
                <EditorForm
                  fields={[
                    {
                      name: "rating",
                      label: "Your rating",
                      options: options(["5", "4", "3", "2", "1"]),
                    },
                    {
                      name: "body",
                      label: "Your experience",
                      type: "textarea",
                    },
                  ]}
                  submit="Save review"
                  save={async (body) => {
                    await apiFetch(`/api/venues/${id}/review`, {
                      method: "POST",
                      body: JSON.stringify(body),
                    });
                    refresh();
                  }}
                />
              )}
            </section>
          </div>
          {v.is_owner && (
            <details className="ggz-editor">
              <summary className="cursor-pointer font-bold">Edit venue</summary>
              <div className="mt-5">
                <EditorForm
                  fields={venueFields}
                  values={
                    { ...v, reviews: undefined } as unknown as Record<
                      string,
                      string | number | boolean
                    >
                  }
                  save={async (body) => {
                    await apiFetch(`/api/venues/${id}/edit`, {
                      method: "POST",
                      body: JSON.stringify(body),
                    });
                    refresh();
                  }}
                />
              </div>
            </details>
          )}
        </>
      )}
    </PageShell>
  );
}
