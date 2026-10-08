import Link from "next/link";
export function Footer() {
  return (
    <footer className="arena-footer">
      <div className="arena-container footer-main">
        <div>
          <Link className="wordmark" href="/">
            GG<span>z</span>
            <i>ZW</i>
          </Link>
          <p>
            Local players. Real matches.
            <br />
            Your next game starts here.
          </p>
        </div>
        <div className="footer-links">
          <Link href="/tournaments/">Play</Link>
          <Link href="/gamers/">Players</Link>
          <Link href="/discover/">Venues</Link>
          <Link href="/organize/">For organizers</Link>
          <Link href="/help/">How it works</Link>
        </div>
        <div className="footer-links">
          <Link href="/terms/">Terms</Link>
          <Link href="/privacy/">Privacy</Link>
          <Link href="/cookies/">Cookies</Link>
          <Link href="/refund/">Refund policy</Link>
        </div>
      </div>
      <div className="arena-container footer-bottom">
        <span>© {new Date().getFullYear()} GGz Zimbabwe</span>
        <span>Independent community platform · Made for the local scene</span>
      </div>
    </footer>
  );
}
