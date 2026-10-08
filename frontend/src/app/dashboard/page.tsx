"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, apiErrorMessage } from "@/lib/api";
import { eventTime, type Competition } from "@/lib/competition";
interface Data {
  profile: { gamer_tag: string; games: { id: number; name: string }[] };
  organized: Competition[];
  joined: Competition[];
}
export default function Page() {
  const [data, setData] = useState<Data | null>(null);
  const [games, setGames] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    Promise.all([
      apiFetch<Data>("/api/competition/me/"),
      apiFetch<{ id: number; name: string }[]>("/api/games/"),
    ])
      .then(([d, g]) => {
        setData(d);
        setGames(g);
      })
      .catch((e) => {
        setSignedOut(e.status === 401);
        setError(
          apiErrorMessage(e, "Could not load your events. Please try again."),
        );
      })
      .finally(() => setLoading(false));
  }, []);
  async function choose(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const game = new FormData(e.currentTarget).get("game");
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/competition/game/", {
        method: "POST",
        body: JSON.stringify({ game }),
      });
      setData(await apiFetch<Data>("/api/competition/me/"));
    } catch (e) {
      setError(apiErrorMessage(e, "Could not save your game."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="arena-container arena-section">
      <div className="page-heading">
        <p className="eyebrow">YOUR PLAYER HOME</p>
        <h1>
          {data ? `Hey, ${data.profile.gamer_tag}.` : "Your next game."}
          <br />
          <em>Make it happen.</em>
        </h1>
      </div>
      {loading ? (
        <p role="status">Loading your events…</p>
      ) : signedOut ? (
        <Link className="arena-button" href="/auth/login/?next=/dashboard/">
          Sign in ↗
        </Link>
      ) : !data ? (
        <section className="service-notice">
          <p role="alert">{error}</p>
          <a href="">Try again</a>
        </section>
      ) : (
        <>
          {error && (
            <p className="form-notice error" role="alert">
              {error}
            </p>
          )}
          <div className="filter-row">
            <Link className="arena-button" href="/tournaments/">
              Find a competition ↗
            </Link>
            <Link
              className="arena-button secondary"
              href="/tournaments/create/"
            >
              Host an event
            </Link>
            <Link className="text-link" href="/messages/">
              Messages ↗
            </Link>
            <Link className="text-link" href="/notifications/">
              Notifications ↗
            </Link>
          </div>
          <section className="info-panel">
            <p className="eyebrow">FIRST / PICK WHAT YOU PLAY</p>
            <h2>
              {data.profile.games.length
                ? "Your games"
                : "Start with your game."}
            </h2>
            <p>
              {data.profile.games.map((g) => g.name).join(" · ") ||
                "Add your game so you can join its competitions."}
            </p>
            <form className="arena-form" onSubmit={choose}>
              <label>
                Add a game
                <select name="game" required defaultValue="">
                  <option value="" disabled>
                    Choose a game
                  </option>
                  {games
                    .filter(
                      (g) => !data.profile.games.some((pg) => pg.id === g.id),
                    )
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>
              </label>
              <button className="arena-button small" disabled={busy}>
                {busy ? "Saving…" : "Add game"}
              </button>
            </form>
          </section>
          {(
            [
              ["Your registrations", data.joined],
              ["Events you’re hosting", data.organized],
            ] as const
          ).map(([title, events]) => (
            <section className="arena-section" key={title}>
              <div className="section-heading">
                <h2>{title}</h2>
              </div>
              {events.length ? (
                <div className="event-list">
                  {events.map((event) => (
                    <Link
                      className="event-row"
                      key={event.id}
                      href={`/tournaments/${event.slug}/`}
                    >
                      <div>
                        <h3>{event.name}</h3>
                        <p>
                          {event.game_name} · {eventTime(event.start_date)} CAT
                        </p>
                      </div>
                      <span className="text-link">{event.status} ↗</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="arena-empty">
                  <p>
                    No events here yet. Find a competition or plan one with your
                    community.
                  </p>
                </div>
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
