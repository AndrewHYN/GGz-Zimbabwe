"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, apiErrorMessage } from "@/lib/api";
export default function Page() {
  const router = useRouter();
  const [games, setGames] = useState<{ id: number; name: string }[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<
    "loading" | "ready" | "signed-out" | "error"
  >("loading");
  useEffect(() => {
    Promise.all([
      apiFetch("/api/me/"),
      apiFetch<{ id: number; name: string }[]>("/api/games/"),
    ])
      .then(([, g]) => {
        setGames(g);
        setState("ready");
      })
      .catch((e) => {
        setState(e.status === 401 ? "signed-out" : "error");
        setError(
          apiErrorMessage(
            e,
            "Could not load the event form. Please try again.",
          ),
        );
      });
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form.entries());
    // The form explicitly uses Zimbabwe time, independent of the browser timezone.
    for (const key of ["start_date", "registration_deadline"])
      data[key] = `${data[key]}:00+02:00`;
    try {
      const result = await apiFetch<{ slug: string }>(
        "/api/competition/create/",
        { method: "POST", body: JSON.stringify(data) },
      );
      router.push(`/tournaments/${result.slug}/`);
    } catch (e) {
      setError(apiErrorMessage(e, "Could not create this event."));
      setBusy(false);
    }
  }
  return (
    <div className="arena-container arena-section narrow">
      <div className="page-heading">
        <p className="eyebrow">HOST YOUR FIRST EVENT</p>
        <h1>
          One game.
          <br />
          <em>A proper competition.</em>
        </h1>
        <p>
          Free entry. 1v1. Up to 32 players. Start small and make it a good one.
        </p>
      </div>
      {state === "loading" ? (
        <p role="status">Loading your event setup…</p>
      ) : state === "signed-out" ? (
        <section className="info-panel">
          <h2>Sign in to host.</h2>
          <Link
            className="arena-button"
            href="/auth/login/?next=/tournaments/create/"
          >
            Sign in ↗
          </Link>
        </section>
      ) : state === "error" ? (
        <section className="info-panel">
          <p role="alert">{error}</p>
          <a className="text-link" href="">
            Try again
          </a>
        </section>
      ) : (
        <form className="arena-form info-panel" onSubmit={submit}>
          <label>
            Event name
            <input
              name="name"
              required
              maxLength={160}
              placeholder="Your club’s Friday cup"
            />
          </label>
          <div className="form-grid">
            <label>
              Game
              <select name="game" required defaultValue="">
                <option value="" disabled>
                  Choose a game
                </option>
                {games.map((g) => (
                  <option value={g.id} key={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Players
              <input
                name="max_participants"
                type="number"
                min={2}
                max={32}
                defaultValue={16}
                required
              />
            </label>
          </div>
          <div className="form-grid">
            <label>
              Start time · Zimbabwe (CAT)
              <input name="start_date" type="datetime-local" required />
            </label>
            <label>
              Registration closes · CAT
              <input
                name="registration_deadline"
                type="datetime-local"
                required
              />
            </label>
          </div>
          <div className="form-grid">
            <label>
              Where are you playing?
              <select name="mode">
                <option value="offline">At a public venue</option>
                <option value="online">Online</option>
              </select>
            </label>
            <label>
              Venue or online meeting point
              <input
                name="location"
                maxLength={120}
                placeholder="Venue name and area, or lobby instructions"
              />
            </label>
          </div>
          <label>
            About the event
            <textarea
              name="description"
              required
              maxLength={3000}
              placeholder="Who is this for? Which console, PC or mobile version are you using?"
            />
          </label>
          <label>
            Player instructions and rules
            <textarea
              name="rules"
              required
              maxLength={3000}
              placeholder="Game version/platform; check-in time; match format; what happens if someone is late; how players reach the referee; how disputed scores are handled."
            />
            <span className="form-hint">
              Include a referee/contact route. Use public venues; do not publish
              a home address.
            </span>
          </label>
          <label>
            Prize (optional)
            <input
              name="prize_description"
              maxLength={300}
              placeholder="Only promise a prize you have already secured"
            />
          </label>
          <p className="form-hint">
            This saves a private draft. You decide when registration opens.
            Don’t claim another organization’s endorsement without its
            permission.
          </p>
          {error && (
            <p className="form-notice error" role="alert">
              {error}
            </p>
          )}
          <button className="arena-button" disabled={busy || !games.length}>
            {busy ? "Saving your event…" : "Save event draft ↗"}
          </button>
        </form>
      )}
    </div>
  );
}
