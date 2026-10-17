"use client";
import { apiFetch } from "@/lib/api";
import { PageShell, EditorForm, useResource, options } from "./shared";
interface ManagedTeam {
  id: number;
  name: string;
  description: string;
  status: string;
  owner_id: number;
  players: { id: number; gamer_tag: string }[];
  roster: { id: number; gamer_tag: string; is_owner: boolean; role: string }[];
  invitations: {
    id: number;
    status: string;
    type: string;
    recipient: { gamer_tag: string };
  }[];
}
export function TeamManager({ slug }: { slug: string }) {
  const {
    data: t,
    error,
    refresh,
  } = useResource<ManagedTeam>(`/api/team-management/${slug}`);
  const save = async (action: string, body: Record<string, unknown>) => {
    await apiFetch(`/api/teams/${slug}/${action}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    refresh();
  };
  const members =
    t?.roster.filter((p) => !p.is_owner).map((p) => p.gamer_tag) ?? [];
  return (
    <PageShell title={t ? `Manage ${t.name}` : "Team management"} error={error}>
      {t && (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <section className="ggz-editor">
            <h2 className="mb-5 text-xl font-bold">Team settings</h2>
            <EditorForm
              fields={[
                {
                  name: "description",
                  label: "Description",
                  type: "textarea",
                  required: false,
                },
                {
                  name: "status",
                  label: "Recruitment",
                  options: options(["Recruiting", "Active", "Archived"]),
                },
              ]}
              values={{ description: t.description, status: t.status }}
              save={(body) => save("edit", body)}
            />
          </section>
          <section className="ggz-editor">
            <h2 className="mb-5 text-xl font-bold">Invite a player</h2>
            <EditorForm
              fields={[
                {
                  name: "gamer_tag",
                  label: "Player",
                  options: options(
                    t.players
                      .filter((p) => !t.roster.some((r) => r.id === p.id))
                      .map((p) => p.gamer_tag),
                  ),
                },
              ]}
              submit="Send invitation"
              save={(body) => save("invite", body)}
            />
            <p className="mt-4 text-xs text-ggz-text-secondary">
              The player receives the invitation in their inbox.
            </p>
          </section>
          <section className="ggz-editor">
            <h2 className="mb-4 text-xl font-bold">Roster</h2>
            {t.roster.map((p) => (
              <p className="mb-2 text-sm" key={p.id}>
                {p.gamer_tag} · {p.is_owner ? "Owner" : p.role}
              </p>
            ))}
            {members.length > 0 && (
              <>
                <details className="mt-5">
                  <summary className="cursor-pointer font-semibold">
                    Manage roles
                  </summary>
                  <div className="mt-4">
                    <EditorForm
                      fields={[
                        {
                          name: "gamer_tag",
                          label: "Member",
                          options: options(members),
                        },
                        {
                          name: "role",
                          label: "Role",
                          options: options(["Captain", "Member"]),
                        },
                      ]}
                      submit="Update role"
                      save={(body) => save("captain", body)}
                    />
                  </div>
                </details>
                <details className="mt-5">
                  <summary className="cursor-pointer font-semibold text-red-300">
                    Remove a member
                  </summary>
                  <div className="mt-4">
                    <EditorForm
                      fields={[
                        {
                          name: "gamer_tag",
                          label: "Member",
                          options: options(members),
                        },
                      ]}
                      submit="Remove member"
                      save={(body) => save("remove", body)}
                    />
                  </div>
                </details>
                <details className="mt-5">
                  <summary className="cursor-pointer font-semibold">
                    Transfer ownership
                  </summary>
                  <p className="my-4 text-sm text-ggz-text-secondary">
                    You remain the owner until the selected member accepts. They
                    will then control the team.
                  </p>
                  <EditorForm
                    fields={[
                      {
                        name: "gamer_tag",
                        label: "New owner",
                        options: options(members),
                      },
                    ]}
                    submit="Propose ownership transfer"
                    save={(body) => save("transfer", body)}
                  />
                </details>
              </>
            )}
          </section>
          <section className="ggz-editor">
            <h2 className="mb-4 text-xl font-bold">Invitations</h2>
            {t.invitations.map((i) => (
              <p className="mb-3 text-sm" key={i.id}>
                {i.recipient.gamer_tag} · {i.type} · {i.status}
              </p>
            ))}
            {!t.invitations.length && (
              <p className="text-sm text-ggz-text-secondary">
                No invitations sent yet.
              </p>
            )}
          </section>
        </div>
      )}
    </PageShell>
  );
}
