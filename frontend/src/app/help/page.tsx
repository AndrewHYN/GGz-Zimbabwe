import Link from "next/link";
export const metadata = { title: "How it works" };
export default function Page() {
  return (
    <div className="arena-container arena-section narrow">
      <p className="eyebrow">PLAYER GUIDE</p>
      <div className="page-heading">
        <h1>
          Less setup.
          <br />
          <em>More play.</em>
        </h1>
      </div>
      <section className="info-panel">
        <h2>Joining an event</h2>
        <ol className="plain-list">
          <li>
            Open a competition and check the game, platform, time and location.
          </li>
          <li>Sign in or create an account. Add that game to your profile.</li>
          <li>
            Register, then follow the organizer’s rules and check-in
            instructions.
          </li>
          <li>
            Play on the agreed game setup. GGz does not host the game itself.
          </li>
          <li>
            The organizer records the result. Check the bracket for your next
            match.
          </li>
        </ol>
        <p>
          Times are shown in Zimbabwe time (CAT / UTC+2). Pilot events created
          through GGz are free to enter.
        </p>
      </section>
      <section className="info-panel">
        <h2>Play fair. Stay safe.</h2>
        <p>
          Use public venues. Don’t publish home addresses or share account
          passwords. Read age requirements and bring a parent or guardian where
          required. For a no-show, connection problem or disputed score, contact
          the organizer through their published event instructions before the
          next round.
        </p>
        <p>
          Respect other players. Report abusive messages using profile and
          account controls. Competition results come from recorded matches;
          community respect points are separate.
        </p>
      </section>
      <Link className="arena-button" href="/tournaments/">
        Find a competition ↗
      </Link>
    </div>
  );
}
