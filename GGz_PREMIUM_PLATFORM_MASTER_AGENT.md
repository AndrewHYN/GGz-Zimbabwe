# GGz — PREMIUM PLATFORM MASTER AGENT BUILD SPEC

## ROLE
You are the principal/senior full-stack engineer responsible for taking the existing GGz-Zimbabwe repository from its current working state to a polished, production-minded gaming social platform.

Do NOT treat this as a greenfield project.
Do NOT rewrite the application merely because another framework seems fashionable.
Do NOT destroy or casually replace working GGz functionality.

Your job is to inspect the real repository first, understand what already exists, then execute the work below in dependency order.

The product goal is:

> Make GGz feel like a modern gaming platform people want to keep open: fast, alive, social, animated, realtime, useful, safe, and commercially extensible.

Reference quality bar:
- WhatsApp-level messaging responsiveness
- Discord-like presence/community feeling
- Instagram-like interaction feedback
- modern gaming-community visual language
- premium SaaS/admin polish
- mobile-first responsiveness
- zero unnecessary full-page refreshes

The visual identity should strongly combine AMBER + PURPLE in a tasteful gamer-oriented palette. Do not make the UI look like a generic Tailwind starter.

---

# 0. NON-NEGOTIABLE ENGINEERING RULES

1. Inspect before editing.
2. Preserve all existing working features unless a change below deliberately improves them.
3. Reuse existing models, routes, services, templates, components, utilities, and styles whenever practical.
4. Do not duplicate concepts that already exist in the repository.
5. Do not expose secrets in source code, logs, screenshots, tests, commits, or agent output.
6. Read existing `.env`, environment-loading code, deployment configuration, package manifests, requirements, settings, URL configuration, ASGI/WSGI configuration, and existing frontend asset structure before deciding architecture.
7. Never hard-code API keys, tokens, passwords, signing secrets, database credentials, webhook secrets, VAPID private keys, or AI provider credentials.
8. Existing data must be preserved. If schema changes are genuinely required, create proper forward-only Django migrations and test them. Never edit historical migration files merely to make a new change work.
9. Do not delete existing application files unless they are demonstrably obsolete and the replacement is verified.
10. No placeholder UI that looks unfinished. Every implemented screen should be coherent and usable.
11. No fake realtime. If realtime cannot be established, surface the connection state and use a reliable fallback strategy.
12. Every new interactive feature needs loading, success, failure, empty, offline/reconnecting, and permission-denied states where applicable.
13. Every important interaction should work with keyboard and mobile touch.
14. Respect CSRF, Django auth, permissions, object ownership, and existing security boundaries.
15. Add tests for behavior, not implementation trivia.
16. Run the complete test suite before declaring the build complete.
17. Keep commits logical and recoverable. Do not squash unrelated work into one enormous commit.
18. Never claim a deployment is successful without actually checking the deployment-facing result available to the agent.

---

# 1. FIRST ACTION — REPOSITORY REFRESH / AUDIT

Before changing code, perform a concise but deep repository audit.

Inspect at minimum:
- current Git branch and status
- recent commits
- Django project/app layout
- settings and environment loading
- requirements/package manifests
- ASGI and WSGI entry points
- Vercel configuration and deployment files
- static/media handling
- authentication and permissions
- current profiles/social graph
- feed/posts/comments/reactions
- notifications
- messaging/conversations/messages
- marketplace
- games
- tournaments/events/organizations
- existing admin setup
- tests and test count
- frontend CSS/JS architecture
- any existing AJAX/fetch/WebSocket/SSE/polling implementation
- any existing service worker / PWA functionality
- any existing AI integration

Create a short internal audit summary before editing. Do not wait for human approval; proceed using best engineering judgment.

Check whether the repository is actually on `main`, `phase-3-premium-social-ux`, or another branch. Do not blindly switch branches and risk losing work. If the current branch has the user's latest working state, continue from it and create an appropriately named feature branch only if doing so is safe and practical.

Also inspect whether `hello_world/media/` actually contains disposable generated media before deleting anything. Delete it only if the audit confirms it is the explicitly disposable directory; do not delete legitimate user-uploaded/application media.

---

# 2. PRODUCT ARCHITECTURE DIRECTION

Keep Django as the system of record for:
- users/authentication
- profiles
- social graph
- posts/feed
- comments/reactions
- notifications
- messages/conversations
- games
- marketplace
- tournaments/events/organizations
- administrative workflows
- persistence and permissions

Use modern frontend techniques only where they materially improve the product.

Do NOT migrate the entire application to React/Next.js/Tailwind/Node/C# merely because they were mentioned as options.

Instead:
- inspect the current stack;
- retain the existing stack where it is already strong;
- introduce narrowly scoped frontend technology only if it gives a clear benefit without creating unnecessary build complexity;
- prefer a coherent CSS architecture over framework soup.

For styling, prioritize premium CSS, reusable design tokens, responsive layout primitives, animation utilities, and component-level interaction states. Tailwind, Sass, React, Alpine, HTMX, jQuery, or other tools are allowed only when they integrate cleanly with the existing project and reduce rather than increase complexity.

---

# 3. PREMIUM GGz DESIGN SYSTEM

Create or evolve a unified GGz design system.

Core visual direction:
- dark gaming-first foundation
- amber + purple accent system
- subtle glass surfaces
- strong depth hierarchy
- clean typography
- restrained gradients
- soft glow used only for emphasis
- crisp borders
- high-quality icons
- compact but breathable spacing
- premium cards and panels
- responsive mobile layouts

Define CSS custom properties/design tokens for:
- background levels
- elevated surfaces
- text hierarchy
- muted text
- amber accent
- purple accent
- success
- warning
- danger
- info
- borders
- shadows
- radii
- spacing
- transitions
- animation durations

Use accessible contrast.

Use Inter or an equivalent high-quality UI font if the project can load it responsibly. Prefer a locally bundled/system-safe fallback chain if external Google Fonts would harm reliability or violate current project policy.

Create reusable animation utilities such as:
- page-enter
- fade-up
- fade-in
- scale-in
- pop
- shimmer
- pulse-soft
- glow-pulse
- slide-up
- slide-right
- toast-enter
- modal-enter
- list-item-enter
- message-enter
- typing-dots
- presence-pulse
- badge-pop
- reaction-pop
- skeleton shimmer

Honor `prefers-reduced-motion: reduce` and provide a reduced-motion mode.

---

# 4. GLOBAL ANIMATION PASS — THE WHOLE APP

Do a global UX motion audit, not just messaging.

Add purposeful motion anywhere it improves comprehension or delight:
- navigation state changes
- page transitions
- cards appearing
- feed items appearing
- modal/dialog opening
- dropdown menus
- notification badge changes
- reaction/like state changes
- button press feedback
- follow/unfollow states
- profile actions
- search results
- filters
- marketplace cards
- tournament cards
- event cards
- admin dashboard metrics
- toast messages
- tabs
- forms
- loading states
- empty states
- skeletons
- optimistic updates
- mobile navigation

Avoid excessive animation that slows usability.

Use animation to communicate state, not to decorate every pixel.

Prefer 120–350ms micro-interactions, with longer transitions only for major surfaces.

For long lists, use staggered entrance carefully and avoid rendering thousands of animated nodes simultaneously.

---

# 5. REALTIME MESSAGING — PREMIUM CHAT

Upgrade the current messaging experience to a genuinely live system.

Desired UX:
- no-refresh message sending
- near-instant incoming messages
- optimistic outgoing messages
- delivery state
- read state
- timestamps
- typing indicator
- online/offline/presence indicator where supported
- unread counts
- conversation preview updates
- automatic scroll to newest message when appropriate
- smart preservation of scroll position when older messages are loaded
- lazy loading/pagination for message history
- reconnect state
- retry failed messages
- duplicate-message protection
- graceful offline queue where practical
- animated message insertion
- message reaction foundation where it integrates naturally

Important UX rule:
When the user is reading older messages, do NOT forcibly yank them to the bottom when a new message arrives. Show a subtle “new messages” affordance instead.

### Realtime architecture decision

Do not blindly add Django Channels simply because an old brief mentioned it.

Inspect current deployment reality first.

The deployed application is on Vercel, and current Vercel infrastructure now supports WebSockets in public beta through Fluid compute. Current Vercel guidance also supports Django directly and provides a Services architecture for multi-service apps.

Therefore choose the smallest production-sensible realtime architecture that works with this repository, which may be:
A) Django ASGI + Channels if the current deployment/runtime can support it reliably;
B) a Vercel-compatible realtime service/service boundary if that is cleaner;
C) a separate Node WebSocket service behind the same product if needed;
D) a third-party realtime provider if that is materially more reliable/cost-effective;
E) a robust fallback using SSE/frequent incremental fetch if the chosen environment cannot safely maintain the desired channel.

Do not introduce both Channels and another realtime stack unless there is a clear architectural reason.

Document the selected architecture in the codebase.

The browser client must:
- connect authenticated
- reconnect with backoff
- resubscribe after reconnect
- resync unread/last-message state after reconnect
- handle connection states visibly but subtly
- never spin aggressively when offline

Server-side realtime events should have explicit event types and a versionable payload shape.

Example event categories:
- message.created
- message.updated
- message.read
- typing.started
- typing.stopped
- presence.updated
- notification.created
- notification.read
- reaction.created
- reaction.removed

Persist canonical data in Django/database first or in a transaction-safe design. Realtime events are a delivery mechanism, not the source of truth.

---

# 6. NOTIFICATIONS — LIVE, CORRECT, USEFUL

Fix the current notification UX so counts are truthful.

Required behavior:
- unread/seen state
- created timestamp
- appropriate notification type
- deep-link target where applicable
- live badge updates
- grouped/stacked UI when many notifications arrive
- dropdown/popover
- mark single notification read
- mark all read
- no-count state when nothing is unread
- reconnect/resync handling
- stale notification protection

Audit every existing notification trigger and expand coverage appropriately for GGz:
- new message
- follower/follow request if supported
- post reaction
- comment
- reply
- mention if supported
- marketplace interaction
- tournament/event changes
- team/organization invitation
- moderation/admin action when user-facing
- system notices

Do not create duplicate notifications for the same event.

Use idempotent client handling.

---

# 7. BROWSER NOTIFICATIONS / PUSH

Implement browser notification support in a privacy-conscious, user-controlled manner.

Distinguish:
1. in-app notifications;
2. browser permission notifications;
3. background Web Push where truly supported.

Do not request browser notification permission immediately on first page load.

Create a sensible opt-in UX such as:
“Stay updated on messages and GGz activity”
with Allow / Not now.

For actual Web Push, inspect whether the project can support VAPID keys and a service worker. Use environment variables for private keys.

Expected configuration concepts may include:
- VAPID_PUBLIC_KEY
- VAPID_PRIVATE_KEY
- VAPID_SUBJECT

Names may be adapted to existing conventions.

Generate documentation for any new environment variables. Never commit private values.

If only foreground browser notifications can be supported safely at this stage, implement them cleanly and state the limitation in the build report instead of faking background push.

---

# 8. NO-REFRESH / LIVE APP AUDIT

Search the whole project for patterns that cause unnecessary page reloads.

Inspect:
- form submissions
- like/reaction
- comments
- replies
- follow/unfollow
- message send
- notification actions
- search/filter controls
- marketplace interactions
- tournament actions
- event actions
- profile editing
- modal forms
- login/register interactions where appropriate

Replace reload-heavy interactions with asynchronous partial updates where it improves UX.

Preserve normal navigation for actual page transitions.

Every fetch/XHR mutation must:
- handle CSRF correctly
- handle HTTP errors
- handle timeouts
- update only the affected UI where possible
- avoid duplicated event listeners
- avoid stale DOM state
- provide visual feedback

Do not turn every URL into a SPA.

---

# 9. LIVE REFRESH / DATA FRESHNESS STRATEGY

The app should feel alive without hammering the backend.

Create sensible update policies by feature.

Examples:
- realtime channel for messages/presence/notifications when available
- lightweight polling fallback only where realtime is unavailable
- visibility-aware polling: reduce/stop when tab is hidden where appropriate
- immediate refresh on page focus after inactivity
- exponential backoff during failures
- cache recent data client-side where safe
- deduplicate requests
- avoid overlapping polling intervals
- pause expensive refreshes on mobile/background tabs

Do NOT blindly refresh whole pages on intervals.

Use document visibility and connection state.

Suggested polling intervals should be configurable and justified by feature, not hard-coded randomly.

---

# 10. PREMIUM CHAT UI

Design the chat experience as one of GGz's flagship surfaces.

Include where supported:
- conversation list
- active chat panel
- participant avatar/presence
- compact chat header
- message bubbles
- grouping consecutive messages
- delivery/read indicators
- date separators
- typing indicator
- composer with send affordance
- attachment foundation if existing media infrastructure supports it
- emoji/reaction foundation if practical
- new-message indicator
- empty conversation state
- offline/reconnecting state

Add tasteful glassmorphism, but do not make text low-contrast or reduce readability.

Mobile:
- conversation list and chat should transition naturally
- touch targets >= comfortable mobile size
- composer remains usable with soft keyboard
- avoid layout jumps

---

# 11. PREMIUM FEED / SOCIAL UX PASS

Extend the same alive feeling beyond chat.

Feed interactions should feel immediate:
- optimistic like/reaction
- animated counters when appropriate
- comment insertion without reload
- smooth comment expansion
- follow button morph/state feedback
- hover/touch affordances
- skeleton loading
- smart empty states
- share/copy feedback

Consider:
- lightweight double-tap reaction behavior only if accessible and non-conflicting
- reaction picker animation
- “new posts” banner instead of disruptive refresh
- feed freshness indicator

Do not build a fake algorithm. Keep ranking logic tied to existing project capabilities.

---

# 12. DISCOVERY / GAMER EXPERIENCE

Make player discovery feel like a gaming product, not a Django directory.

Enhance existing gamer/profile discovery with:
- presence/status styling
- competitive rank visuals
- platform badges
- game tags
- subtle card hover effects
- quick profile actions
- follow/message actions
- sensible filtering/search
- mobile-friendly cards
- pagination/infinite loading without reload where practical

Keep existing identity and reputation features intact.

---

# 13. ADMIN PLATFORM — NO DATABASE MANUAL WORK

Build a proper GGz admin experience so authorized staff can manage the platform through the app instead of manually editing the database.

Use Django Admin where it is the safest and fastest foundation, but do not stop there.

Create a polished GGz admin/dashboard experience if the current application architecture supports custom admin screens.

Admin needs to provide safe CRUD/search/filter/moderation workflows for at minimum:
- users
- profiles
- organizations
- events
- tournaments
- games
- posts/social feed
- comments
- reports/moderation items if they exist or are introduced
- marketplace listings
- marketplace categories/statuses where applicable
- notifications
- messages/conversations only where privacy and moderation policy permits
- platform configuration/content controls where appropriate

Admin dashboard should include useful high-level metrics such as:
- total users
- active/recent users
- posts/activity
- messages/activity
- marketplace listings
- tournaments/events
- pending moderation items
- unread/admin alerts

Provide:
- search
- filters
- pagination
- bulk actions
- status controls
- safe confirmation dialogs for destructive actions
- audit-friendly timestamps and actor information where practical
- object-level permission checks

Never give ordinary users admin capabilities.

Separate:
- superuser capabilities
- staff/admin capabilities
- moderation capabilities
- content management capabilities
where practical.

Do not expose private message contents to admins unnecessarily. Build the minimum privileged moderation tools required.

---

# 14. ADMIN UX DESIGN

The admin experience must match the GGz brand while remaining operationally dense.

Use:
- dashboard metric cards
- activity timeline
- tables with responsive mobile treatment
- drawers/modals for quick edits where practical
- inline status changes
- toast confirmations
- clear danger styling for destructive actions
- keyboard-friendly navigation
- empty/search/no-result states
- skeleton loading if admin data is async

Desktop can be information-dense.
Mobile must remain usable.

---

# 15. AI ASSISTANT — GGz COMPANION / PARTNER

Build an extensible AI assistant concept called the GGz Companion unless the codebase has a better established naming convention.

It should feel like an actual GGz product feature, not a plain “ask AI” textbox.

Product vision:

> A helpful gaming/social companion that understands GGz context, assists users, helps them discover the platform, and acts like a friendly Discord-bot-plus assistant without pretending to be human.

Core capabilities:
- answer GGz feature questions
- explain how to use the platform
- recommend games from available GGz game data
- help discover gamers/communities using permitted GGz data
- help users understand tournaments/events
- explain marketplace workflows
- draft social posts/comments/messages when explicitly requested
- help users navigate settings/profile
- summarize public GGz activity where appropriate
- suggest next actions
- provide contextual onboarding
- provide “what can I do here?” help

Potential future capabilities:
- personalized game recommendations
- tournament preparation
- gaming setup advice
- matchmaking assistance
- community discovery
- event reminders
- marketplace buying/selling guidance
- creator/content support
- achievement/goal coaching

Do not pretend to have performed an action that it did not perform.

Where the assistant can take actions, use explicit tools with permission checks, for example:
- search_games
- search_public_profiles
- search_events
- search_tournaments
- open_user_settings
- draft_post
- draft_message
- create_reminder if supported

Do not give the model unrestricted database access.

All AI actions should pass through server-controlled tools/services that enforce authorization and data minimization.

### AI personality

Tone:
- friendly
- gamer-native but not childish
- smart
- encouraging
- concise by default
- capable of deeper explanation when requested
- never manipulative
- never claim emotions or consciousness

The assistant should feel like a helpful GGz teammate.

### AI UI

Create a premium assistant surface:
- floating assistant button
- expandable panel/modal
- animated open/close
- streaming response where supported
- typing/thinking state
- suggested prompts
- contextual actions
- conversation history where appropriate
- clear reset/new chat action
- graceful API failure state
- mobile-friendly full-screen mode

Use streaming responses if supported by the chosen AI provider/runtime.

Keep AI provider implementation behind a service abstraction so provider choice can evolve later.

Inspect existing environment variables first and reuse existing AI configuration when present.

Never hard-code a provider key.

---

# 16. AI SAFETY / TRUST

The AI assistant must:
- respect user permissions
- never reveal private user information
- never expose database internals
- never expose secret environment variables
- never impersonate staff/admin
- clearly distinguish suggestions from completed actions
- refuse unsafe or unauthorized requests appropriately
- avoid inventing GGz data when the database/tool result is unavailable
- provide graceful fallback when AI API calls fail

Log only useful operational metadata, never full sensitive conversations unless the existing privacy policy explicitly allows it.

---

# 17. MONETIZATION-READY ARCHITECTURE

Do NOT implement arbitrary payments yet unless an existing monetization plan is already present in the repository.

Instead make the platform commercially extensible.

Design extension points for possible future revenue streams:
- premium subscriptions
- creator/organization premium tools
- tournament entry/management fees
- promoted listings
- premium marketplace features
- verified organizations
- advanced gamer analytics
- cosmetic profile customization
- premium discovery/promotions
- AI usage tiers
- sponsored gaming events
- platform advertising only if compatible with the product vision

Do not hard-code pricing.

Create configuration-driven feature gating concepts only where useful.

Avoid adding payment processors prematurely.

---

# 18. PERFORMANCE

Measure before optimizing.

Audit:
- N+1 queries
- repeated notification queries
- repeated feed queries
- message pagination
- static asset size
- JS bundle size
- unnecessary DOM work
- excessive animations
- duplicate event listeners
- chat reconnection loops
- polling storms
- image sizing/lazy loading

Use database indexes only when justified by actual query patterns.

Use `select_related` / `prefetch_related` where appropriate.

Do not optimize by making correctness worse.

---

# 19. ACCESSIBILITY

Audit the new and touched UI for:
- keyboard navigation
- focus states
- semantic controls
- aria labels where necessary
- readable text contrast
- reduced motion
- mobile tap targets
- screen-reader meaningful states for notifications and chat

Do not rely on color alone to communicate status.

---

# 20. SECURITY AUDIT

Before completion, check:
- auth boundaries
- CSRF
- XSS risks from rendered/social content
- safe HTML handling
- WebSocket auth
- origin/host validation
- rate limiting opportunities for messaging/AI if infrastructure permits
- notification permission handling
- object ownership
- admin permissions
- unsafe mass assignment
- secret leakage
- debug configuration
- production settings

Do not weaken security to make demos pass.

---

# 21. TESTING REQUIREMENTS

Run and maintain:

`python manage.py test`

Also run:

`python manage.py check`

and inspect:

`python manage.py showmigrations`

Add/extend tests for:
- message creation
- message permissions
- async/realtime delivery path
- reconnect/resync behavior where testable
- notification creation
- unread/seen transitions
- duplicate notification protection
- notification badge/count logic
- AJAX mutation behavior
- CSRF-sensitive endpoints
- browser notification subscription endpoint if introduced
- admin permission boundaries
- admin CRUD for key entities
- AI tool permissions and failure handling
- feed optimistic-action backend correctness

If WebSockets are selected:
- test authenticated connection
- unauthorized connection
- message broadcast
- recipient isolation
- malformed event handling
- reconnect/resync strategy

All existing tests must continue to pass.

Do not delete tests merely to get green.

---

# 22. DEPLOYMENT VALIDATION

The product is deployed on Vercel.

Verify deployment assumptions against the actual repository.

Check:
- Vercel configuration
- environment variable names
- build/runtime configuration
- ASGI/WSGI behavior
- static/media behavior
- realtime service/runtime
- service worker behavior
- allowed hosts/origins
- production security settings

If the current architecture needs a second realtime service or Vercel Service, implement it coherently rather than leaving the repository in a half-configured state.

Do not invent infrastructure credentials.

Where credentials are missing, create clear environment variable names and deployment documentation rather than hard-coding anything.

---

# 23. GIT / RECOVERY DISCIPLINE

Make logical commits.

Suggested commit grouping:
1. audit/baseline cleanup
2. design system/global animation pass
3. realtime messaging
4. notifications/push
5. no-refresh social UX
6. admin platform
7. AI Companion
8. performance/security/accessibility hardening
9. tests/deployment hardening

Do not create a huge one-shot commit if smaller safe commits are possible.

Before each major commit:
- run targeted tests
- inspect `git diff`
- ensure secrets are not included

At the end:
- run full tests
- run checks
- inspect git status
- commit all intended changes
- push the active feature branch if authenticated and safe to do so

Never force-push over shared history without explicit instruction.

---

# 24. IMPLEMENTATION ORDER

Execute in this order unless the real repository requires a dependency-driven variation:

PHASE A — DISCOVER
- repository audit
- architecture audit
- env/deployment audit
- test baseline

PHASE B — FOUNDATION
- design tokens
- reusable animation system
- loading/toast/modal primitives
- responsive interaction foundation

PHASE C — REALTIME CORE
- choose and implement realtime architecture
- authenticated connection
- event schema
- reconnect/resync
- messaging delivery

PHASE D — MESSAGING UX
- optimistic send
- read receipts
- typing
- presence
- unread handling
- premium chat UI

PHASE E — NOTIFICATIONS
- data model correctness
- live synchronization
- badge/dropdown
- read controls
- browser notification support

PHASE F — SOCIAL NO-REFRESH PASS
- feed actions
- comments/replies
- follow/reaction interactions
- search/filter/pagination interactions
- freshness policies

PHASE G — GLOBAL MOTION PASS
- migrate existing touched UI onto animation system
- polish navigation/cards/modals/admin/social surfaces

PHASE H — ADMIN PLATFORM
- Django admin audit
- custom branded admin UX where valuable
- permissions/search/filter/bulk actions
- organization/event/tournament/game/user/social/marketplace management

PHASE I — GGz COMPANION
- service abstraction
- safe GGz tools
- chat UI
- streaming if practical
- contextual prompts
- permission enforcement

PHASE J — HARDEN
- tests
- security
- accessibility
- performance
- deployment
- regression testing

---

# 25. DEFINITION OF DONE

This task is NOT complete just because code compiles.

GGz is complete for this pass only when:

[ ] Existing functionality remains intact.
[ ] All existing tests pass.
[ ] New tests for new functionality pass.
[ ] `manage.py check` passes.
[ ] migrations are consistent.
[ ] Messages no longer depend on manual page refresh.
[ ] Notifications update live or have a clearly implemented fallback.
[ ] Chat handles reconnects and stale state safely.
[ ] Unread counts are truthful.
[ ] Browser notification permission is user-controlled.
[ ] No-refresh interactions cover the main social actions.
[ ] The app visibly feels more alive through purposeful motion.
[ ] The animation system respects reduced motion.
[ ] The UI uses the GGz amber/purple identity consistently.
[ ] Mobile UX is usable.
[ ] Admins can manage core platform entities without direct DB edits.
[ ] Admin permissions are secure.
[ ] GGz Companion has a real provider integration or cleanly configured provider abstraction, with no hard-coded secrets.
[ ] AI actions are permission-checked and cannot directly mutate arbitrary DB rows.
[ ] Realtime architecture is deployment-aware and actually works in the selected environment.
[ ] No secrets were committed.
[ ] Git history is clean and recoverable.
[ ] Deployment configuration is coherent.

---

# 26. AGENT BEHAVIOR — MOST IMPORTANT

Do not stop after completing the first milestone.

Continue through the entire specification in this file.

Do not repeatedly ask the user for approval for ordinary engineering decisions that are already covered here.

When a design or implementation choice is uncertain:
1. inspect the existing code;
2. choose the least destructive production-sensible option;
3. implement it;
4. test it;
5. document the choice.

When something genuinely cannot be implemented because an external service/credential is missing:
- implement the maximum safe functionality possible;
- create the required environment variable/configuration contract;
- do not fabricate credentials;
- continue with the rest of the work;
- report the exact missing configuration at the end.

Do not leave TODO comments as a substitute for implementation when the task is reasonably solvable.

Do not use random libraries solely to appear modern.

Do not convert the project into a framework showcase.

The target is a real GGz product.

Think like a product engineer, principal engineer, UI designer, security reviewer, performance engineer, and investor simultaneously.

Every feature should answer:

“Does this make GGz more useful, more alive, more trustworthy, more scalable, or more monetizable?”

If yes, implement it with restraint and quality.

If no, do not add it merely because it is trendy.

---

# 27. FINAL DELIVERY REPORT

When all work is complete, output a concise engineering report containing:

1. starting branch/commit
2. final branch/commit
3. architecture selected for realtime and why
4. major files/modules changed
5. database migrations created
6. tests before vs after
7. admin capabilities added
8. AI capabilities added
9. browser notification status
10. deployment configuration changes
11. environment variables required/verified (names only, never values)
12. known limitations
13. exact commands used for verification
14. whether push/deployment verification succeeded

Do not output secrets.

# END OF MASTER SPEC
