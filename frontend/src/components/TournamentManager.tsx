"use client";
import { EditorForm } from "@/components/management/shared";
import { useState } from "react";
import { apiFetch, apiErrorMessage } from "@/lib/api";
export function TournamentManager({
  slug,
  status,
  matches,
  refresh,
}: {
  slug: string;
  status: string;
  matches: {
    id: number;
    player_one?: string | null;
    player_two?: string | null;
    winner?: string | null;
  }[];
  refresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function update(action: string, data: Record<string, unknown> = {}) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/api/tournaments/${slug}/${action}`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      refresh();
    } catch (e) {
      setError(apiErrorMessage(e, "Update failed."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="ggz-editor mt-6">
      <p className="ggz-eyebrow">Organizer desk</p>
      <h2 className="my-2 text-xl font-bold">Run your tournament</h2>
      <div className="flex flex-wrap gap-3">
        {status === "Draft" && (
          <button
            className="ggz-primary"
            disabled={busy}
            onClick={() => update("publish")}
          >
            Open registration
          </button>
        )}
        {status === "Open" && (
          <button
            className="ggz-primary"
            disabled={busy}
            onClick={() => update("bracket")}
          >
            Close registration & build bracket
          </button>
        )}
        {!["Completed", "Cancelled"].includes(status) && (
          <button
            className="rounded-xl border border-red-500/40 px-4 py-2 text-red-400"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  "Cancel this tournament? Registered players will no longer be able to compete.",
                )
              )
                void update("cancel");
            }}
          >
            Cancel tournament
          </button>
        )}
      </div>
      {status === "Live" &&
        matches
          .filter((m) => !m.winner)
          .map((m) => (
            <form
              className="mt-4 flex flex-wrap items-end gap-3"
              key={m.id}
              onSubmit={(e) => {
                e.preventDefault();
                const data = Object.fromEntries(new FormData(e.currentTarget));
                void update("result", { ...data, match_id: m.id });
              }}
            >
              <label>
                Match {m.id} winner
                <select name="winner" required>
                  <option value="">Choose winner</option>
                  {[m.player_one, m.player_two].filter(Boolean).map((p) => (
                    <option key={p} value={p!}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Score
                <input name="score" required maxLength={50} placeholder="2–1" />
              </label>
              <button className="ggz-primary" disabled={busy}>
                Confirm result
              </button>
            </form>
          ))}
      {["Draft", "Open"].includes(status) && (
        <details className="mt-5">
          <summary className="cursor-pointer font-semibold">
            Invite a player
          </summary>
          <div className="mt-4">
            <EditorForm
              fields={[{ name: "gamer_tag", label: "Player gamer tag" }]}
              submit="Send tournament invitation"
              save={(body) =>
                apiFetch(`/api/tournaments/${slug}/invite`, {
                  method: "POST",
                  body: JSON.stringify(body),
                })
              }
            />
          </div>
        </details>
      )}
      {error && (
        <p role="alert" className="mt-3 text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
