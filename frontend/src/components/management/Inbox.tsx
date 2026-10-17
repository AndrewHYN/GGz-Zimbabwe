"use client";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { InvitationData, ChallengeData } from "@/lib/management-types";
import {
  ActionButton,
  EditorForm,
  PageShell,
  useResource,
  options,
} from "./shared";
export function Invitations() {
  const { data, error, refresh } =
    useResource<InvitationData[]>("/api/invitations");
  return (
    <PageShell title="Your invitations" error={error}>
      <p className="mb-6 text-ggz-text-secondary">
        Team membership and ownership changes only happen after the recipient
        accepts.
      </p>
      <MessageRequests />
      <div className="grid gap-5 md:grid-cols-2">
        {data?.map((i) => (
          <article key={i.id} className="ggz-editor">
            <p className="ggz-eyebrow">
              {i.type === "ownership"
                ? "Ownership transfer"
                : i.type === "tournament" ? "Tournament invitation" : "Team invitation"}{" "}
              · {i.status}
            </p>
            <Link
              className="my-3 block text-xl font-bold"
              href={i.target_url || `/teams/${i.team_slug}`}
            >
              {i.team_name}
            </Link>
            <p className="mb-5 text-sm text-ggz-text-secondary">
              {i.actor.gamer_tag} → {i.recipient.gamer_tag}
            </p>
            {i.status === "Pending" && (
              <div className="flex flex-wrap gap-3">
                {i.is_recipient ? (
                  <>
                    <ActionButton
                      path={`/api/invitations/${i.id}/accept`}
                      refresh={refresh}
                    >
                      Accept
                    </ActionButton>
                    <ActionButton
                      path={`/api/invitations/${i.id}/decline`}
                      refresh={refresh}
                      destructive
                    >
                      Decline
                    </ActionButton>
                  </>
                ) : (
                  <ActionButton
                    path={`/api/invitations/${i.id}/cancel`}
                    refresh={refresh}
                    destructive
                  >
                    Cancel invitation
                  </ActionButton>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
      {data?.length === 0 && (
        <p className="ggz-editor text-ggz-text-secondary">
          No invitations yet. Find a team and meet your next squad.
        </p>
      )}
    </PageShell>
  );
}
export function Challenges() {
  const { data, error, refresh } =
    useResource<ChallengeData[]>("/api/challenges");
  return (
    <PageShell
      title="Settle it in game"
      eyebrow="Your challenges"
      error={error}
    >
      <p className="mb-6 max-w-2xl text-ggz-text-secondary">
        Challenge someone from a game page, agree on a time, then confirm the
        result together. Disputed results go to moderation and do not affect
        rankings until resolved.
      </p>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        {data?.map((c) => (
          <article key={c.id} className="ggz-editor">
            <p className="ggz-eyebrow">
              {c.game_name} · {c.status}
            </p>
            <h2 className="my-3 text-xl font-bold">
              {c.challenger.gamer_tag}{" "}
              <span className="font-normal text-ggz-text-muted">vs</span>{" "}
              {c.opponent.gamer_tag}
            </h2>
            {c.scheduled_at && (
              <p className="mb-4 text-sm text-ggz-text-secondary">
                {new Date(c.scheduled_at).toLocaleString()}
              </p>
            )}
            {c.result && (
              <p className="my-4 rounded-xl border border-ggz-border p-3 text-sm">
                Proposed winner: {c.result.winner} · {c.result.score}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {c.status === "Pending" && c.is_recipient && (
                <>
                  <ActionButton
                    path={`/api/challenges/${c.id}/accept`}
                    refresh={refresh}
                  >
                    Accept challenge
                  </ActionButton>
                  <ActionButton
                    path={`/api/challenges/${c.id}/decline`}
                    refresh={refresh}
                    destructive
                  >
                    Decline
                  </ActionButton>
                </>
              )}
              {c.is_challenger &&
                ["Pending", "Accepted", "Scheduled"].includes(c.status) && (
                  <ActionButton
                    path={`/api/challenges/${c.id}/cancel`}
                    refresh={refresh}
                    destructive
                  >
                    Cancel challenge
                  </ActionButton>
                )}
              {c.status === "Awaiting Confirmation" && c.can_confirm && (
                <>
                  <ActionButton
                    path={`/api/challenges/${c.id}/confirm`}
                    refresh={refresh}
                  >
                    Confirm result
                  </ActionButton>
                  <ActionButton
                    path={`/api/challenges/${c.id}/dispute`}
                    body={{
                      reason: "The players disagree on the submitted result.",
                    }}
                    refresh={refresh}
                    destructive
                  >
                    Dispute result
                  </ActionButton>
                </>
              )}
            </div>
            {["Accepted", "Scheduled"].includes(c.status) && (
              <>
                <details className="mt-5">
                  <summary className="cursor-pointer text-sm font-semibold text-ggz-amber">
                    Agree on a time
                  </summary>
                  <div className="mt-4">
                    <EditorForm
                      fields={[
                        {
                          name: "scheduled_at",
                          label: "Date and time",
                          type: "datetime-local",
                        },
                      ]}
                      submit="Schedule match"
                      save={async (body) => {
                        await apiFetch(`/api/challenges/${c.id}/schedule`, {
                          method: "POST",
                          body: JSON.stringify(body),
                        });
                        refresh();
                      }}
                    />
                  </div>
                </details>
                <details className="mt-5">
                  <summary className="cursor-pointer text-sm font-semibold text-ggz-amber">
                    Submit a result
                  </summary>
                  <div className="mt-4">
                    <EditorForm
                      fields={[
                        {
                          name: "winner",
                          label: "Winner",
                          options: options([
                            c.challenger.gamer_tag,
                            c.opponent.gamer_tag,
                          ]),
                        },
                        { name: "score", label: "Score" },
                      ]}
                      submit="Ask opponent to confirm"
                      save={async (body) => {
                        await apiFetch(`/api/challenges/${c.id}/result`, {
                          method: "POST",
                          body: JSON.stringify(body),
                        });
                        refresh();
                      }}
                    />
                  </div>
                </details>
              </>
            )}
          </article>
        ))}
      </div>
      {data?.length === 0 && (
        <Link href="/games" className="ggz-primary">
          Find a game to challenge someone
        </Link>
      )}
    </PageShell>
  );
}

function MessageRequests() {
  const { data, error, refresh } = useResource<
    {
      id: number;
      sender: { gamer_tag: string };
      recipient: { gamer_tag: string };
      is_recipient: boolean;
      status: string;
    }[]
  >("/api/message-requests");
  return (
    <section className="ggz-editor mb-6">
      <h2 className="mb-4 text-xl font-bold">Message requests</h2>
      {error && <p role="alert">{error}</p>}
      {data?.map((r) => (
        <div
          key={r.id}
          className="mb-4 flex flex-wrap items-center gap-3 border-b border-ggz-border pb-4"
        >
          <p className="mr-auto text-sm">
            {r.sender.gamer_tag} → {r.recipient.gamer_tag} · {r.status}
          </p>
          {r.status === "Pending" && r.is_recipient && (
            <>
              <ActionButton
                path={`/api/message-requests/${r.id}/accept`}
                refresh={refresh}
              >
                Accept messages
              </ActionButton>
              <ActionButton
                path={`/api/message-requests/${r.id}/decline`}
                refresh={refresh}
                destructive
              >
                Decline
              </ActionButton>
            </>
          )}
        </div>
      ))}
      {data?.length === 0 && (
        <p className="text-sm text-ggz-text-secondary">No message requests.</p>
      )}
      <Link className="text-sm text-ggz-amber underline" href="/messages">
        Open messages →
      </Link>
    </section>
  );
}
