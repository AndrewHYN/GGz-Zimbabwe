"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { apiFetch, apiErrorMessage } from "@/lib/api";
import { eventTime, type CompetitionDetail } from "@/lib/competition";
export default function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [event, setEvent] = useState<CompetitionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [missing, setMissing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  useEffect(() => {
    let alive = true;
    apiFetch<CompetitionDetail>(`/api/tournaments/${encodeURIComponent(slug)}/`)
      .then((data) => {
        if (alive) setEvent(data);
      })
      .catch((e) => {
        if (alive) {
          setMissing(e.status === 404);
          setError(
            apiErrorMessage(e, "Could not load this event. Please try again."),
          );
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [slug]);
  async function mutate(path: string, body?: unknown) {
    if (busy) return;
    setBusy(path);
    setNotice("");
    setError("");
    try {
      const response = await apiFetch<{ message?: string }>(path, {
        method: "POST",
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      setNotice(response.message || "Saved.");
      setEvent(
        await apiFetch<CompetitionDetail>(
          `/api/tournaments/${encodeURIComponent(slug)}/`,
        ),
      );
      setConfirmCancel(false);
    } catch (e) {
      setError(
        apiErrorMessage(e, "Could not complete that action. Please try again."),
      );
    } finally {
      setBusy("");
    }
  }
  if (loading)
    return (
      <div className="arena-container arena-section" role="status">
        Loading the competition…
      </div>
    );
  if (!event)
    return (
      <div className="arena-container arena-section">
        <section className="info-panel">
          <h1>{missing ? "Event not found" : "Taking a short timeout."}</h1>
          <p role="alert">
            {missing
              ? "This event is unavailable or still a private draft."
              : error}
          </p>
          <Link className="arena-button secondary" href="/tournaments/">
            All competitions ↗
          </Link>
          {!missing && (
            <a className="text-link" href="">
              {" "}
              Try again
            </a>
          )}
        </section>
      </div>
    );
  const joined = event.registration_status === "Registered";
  const registrationOpen = event.registration_open;
  const next = encodeURIComponent(`/tournaments/${slug}/`);
  const actionBase = `/api/competition/${encodeURIComponent(slug)}/actions/`;
  const rounds = Array.from(
    new Set(event.matches.map((match) => match.round)),
  ).sort((a, b) => a - b);
  return (
    <div className="arena-container arena-section">
      <Link className="text-link" href="/tournaments/">
        ← All competitions
      </Link>
      <div className="page-heading" style={{ marginTop: 25 }}>
        <p className="eyebrow">
          {event.game_name} / {event.status}
        </p>
        <h1>{event.name}</h1>
        <p>{event.description}</p>
      </div>
      {error && (
        <p className="form-notice error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="form-notice success" role="status">
          {notice}
        </p>
      )}
      <div className="detail-layout">
        <div>
          <section className="info-panel" style={{ marginTop: 0 }}>
            <h2>The game plan</h2>
            <dl className="detail-meta">
              <div>
                <dt>Start · Zimbabwe time</dt>
                <dd>{eventTime(event.start_date)} CAT</dd>
              </div>
              <div>
                <dt>Where</dt>
                <dd>
                  {event.mode === "online" ? "Online" : "In person"} ·{" "}
                  {event.location || "Read the organizer’s instructions"}
                </dd>
              </div>
              <div>
                <dt>Entry / format</dt>
                <dd>
                  {event.entry_type} · {event.format}
                </dd>
              </div>
              <div>
                <dt>Hosted by</dt>
                <dd>
                  <Link
                    className="text-link"
                    href={`/profiles/${encodeURIComponent(event.organizer.gamer_tag)}/`}
                  >
                    {event.organizer.gamer_tag}
                  </Link>
                </dd>
              </div>
              <div>
                <dt>Registration closes</dt>
                <dd>{eventTime(event.registration_deadline)} CAT</dd>
              </div>
              <div>
                <dt>Players</dt>
                <dd>
                  {event.participant_count} / {event.max_participants}
                </dd>
              </div>
            </dl>
            {event.prize_description && <p>Prize: {event.prize_description}</p>}
            <h2>Read before you join</h2>
            <p className="detail-rules">
              {event.rules ||
                "The organizer has not added instructions yet. Check with them before joining."}
            </p>
            <Link className="text-link" href="/help/">
              Fair play and safety guide ↗
            </Link>
          </section>
          {event.is_organizer && (
            <section className="info-panel">
              <p className="eyebrow">ORGANIZER CONTROLS</p>
              <h2>Run a good event.</h2>
              <p>
                Share this page with players. Close registration when everyone
                is ready, then generate the bracket. Registration locks once the
                bracket exists.
              </p>
              <div className="organizer-actions">
                {!event.matches.length &&
                  !["Completed", "Cancelled", "Live"].includes(
                    event.status,
                  ) && (
                    <>
                      <button
                        className="arena-button small"
                        disabled={!!busy}
                        onClick={() =>
                          mutate(
                            actionBase +
                              (event.status === "Registration Open"
                                ? "close"
                                : "open") +
                              "/",
                          )
                        }
                      >
                        {event.status === "Registration Open"
                          ? "Close registration"
                          : "Open registration"}
                      </button>
                      <button
                        className="arena-button secondary small"
                        disabled={
                          !!busy ||
                          event.participant_count < 2 ||
                          event.status === "Draft"
                        }
                        onClick={() => mutate(actionBase + "bracket/")}
                      >
                        Start bracket ↗
                      </button>
                    </>
                  )}
                {!["Completed", "Cancelled"].includes(event.status) && (
                  <button
                    className="arena-button secondary small"
                    disabled={!!busy}
                    onClick={() => setConfirmCancel(true)}
                  >
                    Cancel event
                  </button>
                )}
              </div>
              {confirmCancel && (
                <div className="form-notice">
                  <p>This stops the competition for all registered players.</p>
                  <div className="organizer-actions">
                    <button
                      className="arena-button small"
                      disabled={!!busy}
                      onClick={() => mutate(actionBase + "cancel/")}
                    >
                      Confirm cancellation
                    </button>
                    <button
                      className="arena-button secondary small"
                      onClick={() => setConfirmCancel(false)}
                    >
                      Keep event
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
          <section className="info-panel">
            <p className="eyebrow">MATCHUPS / RESULTS</p>
            <h2>The bracket</h2>
            {!event.matches.length ? (
              <p>Matchups appear when the organizer starts the bracket.</p>
            ) : (
              rounds.map((round) => (
                <div key={round}>
                  <h3 className="eyebrow" style={{ marginBlock: 25 }}>
                    ROUND {round}
                  </h3>
                  <div className="match-grid">
                    {event.matches
                      .filter((match) => match.round === round)
                      .map((match) => (
                        <article className="match-card" key={match.id}>
                          <p className="eyebrow">{match.status}</p>
                          <h3>
                            {match.player_one || "Awaiting player"}{" "}
                            <span className="muted">vs</span>{" "}
                            {match.player_two || "Awaiting player"}
                          </h3>
                          {match.winner && (
                            <p className="muted">
                              {match.winner} won · {match.score}
                            </p>
                          )}
                          {event.is_organizer &&
                            event.status === "Live" &&
                            match.status !== "Completed" &&
                            match.player_one_id &&
                            match.player_two_id && (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const form = new FormData(e.currentTarget);
                                  mutate(
                                    `/api/competition/${slug}/matches/${match.id}/result/`,
                                    Object.fromEntries(form.entries()),
                                  );
                                }}
                              >
                                <label>
                                  Winner
                                  <select
                                    name="winner"
                                    required
                                    defaultValue=""
                                  >
                                    <option value="" disabled>
                                      Select the winner
                                    </option>
                                    <option value={match.player_one_id}>
                                      {match.player_one}
                                    </option>
                                    <option value={match.player_two_id}>
                                      {match.player_two}
                                    </option>
                                  </select>
                                </label>
                                <label>
                                  Score
                                  <input
                                    name="score"
                                    required
                                    pattern="\d+\s*-\s*\d+"
                                    placeholder="2-0"
                                  />
                                </label>
                                <button
                                  className="arena-button small"
                                  disabled={!!busy}
                                >
                                  Save result
                                </button>
                              </form>
                            )}
                        </article>
                      ))}
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
        <aside className="info-panel detail-sidebar">
          <p className="eyebrow">YOUR PLACE IN THE BRACKET</p>
          <h2>{joined ? "You’re on the list." : "Ready to play?"}</h2>
          {joined ? (
            <>
              <p>Read the instructions above and be ready at check-in.</p>
              {!event.matches.length && (
                <button
                  className="arena-button secondary"
                  disabled={!!busy}
                  onClick={() => mutate(`/api/tournaments/${slug}/leave/`)}
                >
                  Withdraw registration
                </button>
              )}
            </>
          ) : !event.authenticated ? (
            <>
              <p>Sign in or create your profile to join.</p>
              <Link className="arena-button" href={`/auth/login/?next=${next}`}>
                Sign in to join ↗
              </Link>
              <p>
                <Link
                  className="text-link"
                  href={`/auth/register/?next=${next}`}
                >
                  Create an account
                </Link>
              </p>
            </>
          ) : !event.eligible ? (
            <>
              <p>Add {event.game_name} to your games before registering.</p>
              <button
                className="arena-button"
                disabled={!!busy}
                onClick={() =>
                  mutate("/api/competition/game/", { game: event.game_id })
                }
              >
                I play this game ↗
              </button>
            </>
          ) : registrationOpen ? (
            <>
              <p>
                {event.max_participants - event.participant_count} places
                available.
              </p>
              <button
                className="arena-button"
                disabled={!!busy}
                onClick={() => mutate(`/api/tournaments/${slug}/register/`)}
              >
                {busy ? "Working…" : "Join competition ↗"}
              </button>
            </>
          ) : (
            <p>
              {event.participant_count >= event.max_participants
                ? "This competition is full."
                : "Registration is currently closed."}
            </p>
          )}
          <p className="muted" style={{ marginTop: 24 }}>
            Have a question? Use the contact or referee instructions in the
            event rules.
          </p>
          <h3 className="eyebrow" style={{ marginTop: 30 }}>
            PLAYERS / {event.participant_count}
          </h3>
          <ul>
            {event.participants.map((p) => (
              <li key={p.gamer_tag}>
                <Link
                  className="text-link"
                  href={`/profiles/${encodeURIComponent(p.gamer_tag)}/`}
                >
                  {p.gamer_tag}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
