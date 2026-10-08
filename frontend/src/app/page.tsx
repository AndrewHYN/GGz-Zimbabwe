import Link from "next/link";
import { ArenaArt } from "@/components/competition/ArenaArt";
import {
  CompetitionCard,
  ServiceNotice,
} from "@/components/competition/CompetitionCard";
import { serverList } from "@/lib/server-data";
import type { Competition } from "@/lib/competition";
export default async function Home() {
  const { items, unavailable } =
    await serverList<Competition>("/api/tournaments/");
  const events = items
    .filter((event) => ["Registration Open", "Live"].includes(event.status))
    .slice(0, 3);
  return (
    <div className="arena-home">
      <div className="arena-container">
        <section className="arena-hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="signal-dot" /> ZIMBABWE / PRESS START
            </p>
            <h1>
              YOUR PEOPLE.
              <br />
              YOUR GAME.
              <br />
              <em>YOUR MOVE.</em>
            </h1>
            <p className="hero-description">
              Find local players. Join a competition. Make the next match one to
              remember.
            </p>
            <div className="hero-actions">
              <Link className="arena-button" href="/tournaments/">
                Find a competition <span>↗</span>
              </Link>
              <Link className="arena-button secondary" href="/gamers/">
                Meet the players
              </Link>
            </div>
            <p className="hero-note">
              Play on your console, PC or phone. GGz brings the people together.
            </p>
          </div>
          <ArenaArt />
        </section>
      </div>
      <div className="arena-ticker" aria-hidden="true">
        <span>GOOD GAMES. GREAT PEOPLE.</span>
        <b>✳</b>
        <span>FROM THE LOCAL SCENE.</span>
        <b>✳</b>
        <span>MAKE YOUR MOVE.</span>
      </div>
      <section className="arena-container arena-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">01 / FIND YOUR NEXT MATCH</p>
            <h2>Step into the arena.</h2>
          </div>
          <Link className="text-link" href="/tournaments/">
            All competitions ↗
          </Link>
        </div>
        {unavailable ? (
          <ServiceNotice />
        ) : events.length ? (
          <div className="competition-grid">
            {events.map((event, index) => (
              <CompetitionCard key={event.id} event={event} index={index} />
            ))}
          </div>
        ) : (
          <div className="arena-empty">
            <span className="empty-number">READY?</span>
            <div>
              <h3>The next bracket starts with you.</h3>
              <p>
                No competitions are open right now. Find other players or plan a
                small event.
              </p>
              <Link className="text-link" href="/organize/">
                Host your first event ↗
              </Link>
            </div>
          </div>
        )}
      </section>
      <section className="arena-container arena-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">02 / NO COMPLICATED SETUP</p>
            <h2>Show up. Play. Repeat.</h2>
          </div>
        </div>
        <div className="steps-grid">
          {[
            [
              "01",
              "Pick your game",
              "Find a competition for the game and platform you play.",
            ],
            [
              "02",
              "Save your spot",
              "Create a profile, join the event and read the organizer’s instructions.",
            ],
            [
              "03",
              "Make it count",
              "Play your match. Follow the results. Come back for the next one.",
            ],
          ].map(([n, title, text]) => (
            <div className="step-card" key={n}>
              <span>{n}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="arena-container arena-section">
        <div className="community-banner">
          <div>
            <p className="eyebrow">BUILT WITH THE LOCAL SCENE IN MIND</p>
            <h2>
              Small events.
              <br />
              Big community energy.
            </h2>
            <p>
              For gaming cafés, clubs and community organizers: one place for
              registrations, brackets and results.
            </p>
            <Link className="arena-button" href="/organize/">
              Let’s build your next event ↗
            </Link>
          </div>
          <span className="community-symbol" aria-hidden="true">
            ↗
          </span>
        </div>
      </section>
    </div>
  );
}
