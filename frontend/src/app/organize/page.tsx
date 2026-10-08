import Link from "next/link";
export const metadata = {
  title: "For organizers",
  description:
    "Run a small local gaming competition with GGz registration, brackets and results.",
};
export default function Page() {
  return (
    <div className="arena-container arena-section">
      <div className="organizer-hero">
        <p className="eyebrow">FOR CAFÉS / CLUBS / COMMUNITY ORGANIZERS</p>
        <h1>
          You bring the players.
          <br />
          <em>We keep the event together.</em>
        </h1>
        <p>
          Start with one game, up to 32 players and a free 1v1 bracket. Keep
          signups, matchups and results in one place.
        </p>
        <Link className="arena-button" href="/tournaments/create/">
          Plan a free event ↗
        </Link>
      </div>
      <div className="steps-grid">
        {[
          [
            "01",
            "Make a clear invitation",
            "Set the game, platform, public venue or online meeting point, start time and rules.",
          ],
          [
            "02",
            "Fill the bracket",
            "Share your event link. Players register themselves. Close registration when you’re ready.",
          ],
          [
            "03",
            "Run the matches",
            "Generate the bracket, record each result and publish the winner.",
          ],
        ].map(([n, t, d]) => (
          <section className="step-card" key={n}>
            <span>{n}</span>
            <h2>{t}</h2>
            <p>{d}</p>
          </section>
        ))}
      </div>
      <section className="info-panel">
        <p className="eyebrow">A PRACTICAL FIRST COLLABORATION</p>
        <h2>One community. One successful event.</h2>
        <p>
          GGz is designed to support the kind of local gaming activity
          championed by Otaku Konnect and ZEGA. A first collaboration could be a
          free 16-player competition: a community organizer provides the game
          setup, venue and referee; GGz supports registration, the bracket and
          results.
        </p>
        <p className="muted">
          This is a proposed collaboration model. GGz is independent and has no
          announced affiliation or endorsement from either organization.
        </p>
        <ul className="plain-list">
          <li>
            Organizer: equipment, venue permission, rules and participant
            support.
          </li>
          <li>
            GGz: registration page, player list, bracket and published results.
          </li>
          <li>
            Success: players attend, matches finish and the next event is
            agreed.
          </li>
        </ul>
      </section>
    </div>
  );
}
