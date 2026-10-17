"use client";
import { apiFetch } from "@/lib/api";
import { PageShell, EditorForm, useResource, options } from "./shared";
interface StaffData {
  role: string;
  promotions: {
    id: number;
    event_id: number;
    event_name?: string;
    campaign_description: string;
    status: string;
  }[];
  challenges: {
    id: number;
    status: string;
    challenger: { gamer_tag: string };
    opponent: { gamer_tag: string };
  }[];
  reports: {
    id: number;
    target_type: string;
    target_id: number;
    reason: string;
    details?: string;
    status?: string;
  }[];
  organizations: { id: number; name: string; verification_status: string }[];
  venues: { id: number; name: string; verification_status: string }[];
  audit: {
    id: number;
    action: string;
    target_id: number;
    reason: string;
    created_at: string;
  }[];
}
export function Moderation() {
  const { data, error, refresh } = useResource<StaffData>("/api/admin");
  const save = async (path: string, body: Record<string, unknown>) => {
    await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
    refresh();
  };
  return (
    <PageShell title="Moderation desk" eyebrow="Staff workspace" error={error}>
      {data && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            {[
              [
                "Open reports",
                data.reports.filter((r) => !r.status || r.status === "Open")
                  .length,
              ],
              [
                "Organizations awaiting review",
                data.organizations.filter(
                  (o) => o.verification_status === "Pending",
                ).length,
              ],
              ["Recorded actions", data.audit.length],
            ].map(([label, n]) => (
              <div className="ggz-editor" key={String(label)}>
                <p className="text-3xl font-bold text-ggz-amber">{n}</p>
                <p className="mt-1 text-sm text-ggz-text-secondary">{label}</p>
              </div>
            ))}
          </div>
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <section className="ggz-editor">
              <h2 className="mb-5 text-xl font-bold">Reports</h2>
              {data.reports.map((r) => (
                <details
                  key={r.id}
                  className="mb-4 rounded-xl border border-ggz-border p-4"
                >
                  <summary className="cursor-pointer text-sm font-semibold">
                    #{r.id} · {r.target_type} #{r.target_id} ·{" "}
                    {r.status || "Open"}
                  </summary>
                  <p className="my-3 text-sm text-ggz-text-secondary">
                    {r.reason} {r.details}
                  </p>
                  <EditorForm
                    fields={[
                      {
                        name: "decision",
                        label: "Resolution",
                        options: options(["resolve", "dismiss"]),
                      },
                      {
                        name: "reason",
                        label: "Reason / action taken",
                        type: "textarea",
                      },
                    ]}
                    submit="Close report"
                    save={(body) => save(`/api/admin/report/${r.id}`, body)}
                  />
                </details>
              ))}
              {!data.reports.length && (
                <p className="text-sm text-ggz-text-secondary">No reports.</p>
              )}
            </section>
            <section className="ggz-editor">
              <h2 className="mb-3 text-xl font-bold">Review content</h2>
              <p className="mb-5 text-sm text-ggz-text-secondary">
                Hide or restore content, verify a venue, or resolve a disputed
                match. Every action requires a reason and is recorded.
              </p>
              <EditorForm
                fields={[
                  {
                    name: "kind",
                    label: "Content type",
                    options: options([
                      "post",
                      "listing",
                      "organization",
                      "venue",
                      "challenge",
                      ...(data.role === "admin" ? ["profile"] : []),
                    ]),
                  },
                  { name: "id", label: "Content ID", type: "number", min: 1 },
                  {
                    name: "decision",
                    label: "Action",
                    options: options([
                      "hide",
                      "restore",
                      "verify",
                      "reject",
                      "resolve-match",
                      ...(data.role === "admin"
                        ? ["suspend", "reinstate"]
                        : []),
                    ]),
                  },
                  {
                    name: "winner",
                    label: "Winner gamer tag (disputed matches only)",
                    required: false,
                  },
                  { name: "reason", label: "Reason", type: "textarea" },
                ]}
                submit="Record moderation action"
                save={(body) => save("/api/admin/content", body)}
              />
              <h3 className="mb-3 mt-7 font-bold">Verification queue</h3>
              {[
                ...data.organizations.map((o) => ({
                  ...o,
                  kind: "organization",
                })),
                ...data.venues.map((v) => ({ ...v, kind: "venue" })),
              ].map((o) => (
                <p
                  className="mb-2 text-sm text-ggz-text-secondary"
                  key={o.kind + o.id}
                >
                  {o.kind} #{o.id} · {o.name} · {o.verification_status}
                </p>
              ))}
            </section>
          </div>
          <section className="ggz-editor mt-6">
            <h2 className="mb-5 text-xl font-bold">Event promotions</h2>
            {data.promotions.map((p) => (
              <details key={p.id} className="mb-4">
                <summary>
                  #{p.id} · {p.event_name || `Event #${p.event_id}`} ·{" "}
                  {p.status}
                </summary>
                <p className="my-3">{p.campaign_description}</p>
                <EditorForm
                  fields={[
                    {
                      name: "decision",
                      label: "Decision",
                      options: options(["approve", "reject", "under_review"]),
                    },
                    { name: "reason", label: "Review notes", type: "textarea" },
                  ]}
                  save={(body) => save(`/api/admin/promotion/${p.id}`, body)}
                  submit="Review promotion"
                />
              </details>
            ))}
            {!data.promotions.length && <p>No promotion requests.</p>}
          </section>
          <section className="ggz-editor mt-6">
            <h2 className="mb-5 text-xl font-bold">
              Matches awaiting resolution
            </h2>
            {data.challenges.map((c) => (
              <p key={c.id} className="mb-3">
                Challenge #{c.id} · {c.challenger.gamer_tag} vs{" "}
                {c.opponent.gamer_tag} · {c.status}
              </p>
            ))}
            <p className="text-sm text-ggz-text-secondary">
              Use Review content to record a winner and the evidence reviewed.
              Imported legacy results preserve existing profile totals.
            </p>
          </section>
          <section className="ggz-editor mt-6">
            <h2 className="mb-5 text-xl font-bold">Audit history</h2>
            <div className="max-h-80 overflow-auto">
              {data.audit.map((a) => (
                <p
                  key={a.id}
                  className="mb-3 border-b border-ggz-border pb-3 text-sm"
                >
                  <strong>{a.action}</strong> #{a.target_id} · {a.reason}
                  <span className="mt-1 block text-xs text-ggz-text-muted">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </p>
              ))}
            </div>
          </section>
        </>
      )}
    </PageShell>
  );
}
