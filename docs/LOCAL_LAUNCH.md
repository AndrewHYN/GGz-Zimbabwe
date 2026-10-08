# GGz: a small, dependable local launch

## The decision
Keep Next.js 16 / React / TypeScript / Tailwind for the public site and Django 5.2 for authentication, competition rules and data. Production uses persistent PostgreSQL and durable upload storage. SQLite is for development only. One authentication authority, one public website. Do not rebuild this in another framework before validating the pilot.

The first release is Play, Players and Venues. Free 1v1 events, 2–32 players. The organizer creates a private draft, opens registration, starts a bracket and records results. Players select a game, register, read instructions and follow results. Existing social, teams, marketplace, Twitch and catalogue routes remain compatible but are not primary navigation. No user records or migrations are removed.

## A first partnership conversation
Otaku Konnect and ZEGA are prospective collaborators, not confirmed partners. Do not use their logos or describe GGz as affiliated without agreement. Offer one free 16-player event, one game and one referee. The organizer supplies equipment, a permitted public venue, clear player rules and participant support. GGz provides registration, brackets and results. Start with the game the organizer can actually support.

Success means players attend, matches finish, results are published and the organizer wants another event. Recruitment and partnership outreach require Andrew or an explicitly authorized person; this implementation does not send messages or book a venue.

## Seven practical days
1. Repair the live database-backed API failures using the real Django traceback. Confirm database access and applied migrations. Recruit a possible organizer.
2. Test real signup, login, logout and password-reset delivery. Confirm game, equipment, date and venue.
3. Publish one genuine event with complete rules and check-in/contact instructions.
4. Recruit 16 players from existing groups using the event link.
5. Rehearse an eight-player bracket, including a withdrawal before bracket creation and an organizer-handled no-show.
6. Have five unfamiliar users try mobile registration. Fix failures and confirm attendance.
7. Run the pilot, publish results and announce the next event.

Use a smaller private pilot if fewer than eight players commit. Do not invent attendance, testimonials, sponsors or prizes.

## Business validation
Keep player entry free for the pilot. Test a managed-event service for organizers after a successful event. A $15–$30 fee is a pricing experiment, not a revenue forecast. Track support hours and costs before offering subscriptions. First-month targets: three organizer conversations, four completed events, 50 real player registrations and one organizer willing to pay.

Measure: registrations, attendance, completed matches, repeat registrations and organizer willingness to pay. Results matter more than homepage visits.

## Release checks
- Published events are visible; private drafts remain private in both public UIs.
- Real users can choose a game and register without redirect/session/CSRF failures.
- An organizer can complete a bracket; another user cannot manage it.
- Results and uploads survive a deployment/restart.
- `/health/` is process liveness; `/ready/` verifies migrations and representative database reads. Monitor readiness plus real public data endpoints.
- Check game/platform, CAT times, public venue, no-show rules and referee/contact instructions for every event.
- Prove password-reset email delivery on the target environment.
- No payment, betting, escrow or prize-disbursement automation is part of this pilot.

## Current external blocker
The audit on 8 October 2026 observed HTTP 500 from live games, tournaments, events, teams, marketplace and Radar APIs, including direct Django requests. CSRF/provider endpoints and process liveness worked. Production logs were denied (403), so the cause is unconfirmed. Local successful tests do not establish that the live database is repaired.

No schema migration is added by this change. First inspect the real runtime traceback, configuration and migration history. Apply reviewed pending migrations with a backup and verify `/ready/` and the core APIs before releasing.

## Implementation verification (8 October 2026)
- Django: 509 tests passed (15 new pilot tests), with cloud metadata access explicitly disabled.
- Next.js production build and TypeScript passed. ESLint: no errors; one pre-existing messaging dependency warning.
- No model changes or new schema migrations.
- Browser visual and full deployed-flow verification remain pending: local browser launch was blocked by environment socket restrictions.
- Remote branch publication was blocked by automatic approval review pending explicit authorization to push to AndrewHYN/GGz-Zimbabwe. No production release was made.
