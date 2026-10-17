import { spawn, spawnSync } from "node:child_process";
import { chromium as playwright } from "@playwright/test";
import chromium from "@sparticuz/chromium";
const fixture = spawnSync(
  process.execPath,
  ["--env-file=.env.local", "--import", "tsx", "scripts/browser-fixture.mts"],
  { encoding: "utf8" },
);
if (fixture.status !== 0)
  throw Error("Browser fixture setup failed: " + fixture.stderr);
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1"],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let output = "";
child.stdout.on("data", (b) => (output += b));
child.stderr.on("data", (b) => (output += b));
let browser;
let page;
chromium.setGraphicsMode = false;
try {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch("http://127.0.0.1:3000/api/health");
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await playwright.launch({
    executablePath:
      process.env.CHROMIUM_EXECUTABLE || (await chromium.executablePath()),
    args: chromium.args.filter(
      (arg) =>
        arg !== "--single-process" &&
        arg !== "--disable-web-security" &&
        arg !== "--allow-running-insecure-content",
    ),
    headless: true,
  });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const failures = [];
  const observe = p => {
    p.on("pageerror", error => failures.push(error.message));
    p.on("response", response => {
      const pathname = new URL(response.url()).pathname.replace(/\/$/, "");
      const expectedAnonymous = response.status() === 401 && ["/api/me", "/api/challenges", "/api/invitations", "/api/message-requests"].includes(pathname);
      if (response.url().startsWith("http://127.0.0.1:3000/") && response.status() >= 400 && !expectedAnonymous) failures.push(`${response.status()} ${pathname}`);
    });
  };
  observe(page);
  for (const path of process.env.AUTH_ONLY
    ? []
    : [
        "/",
        "/games",
        "/tournaments",
        "/events",
        "/teams",
        "/marketplace",
        "/auth/login",
        "/auth/register",
        "/tournaments/create",
        "/events/create",
        "/marketplace/create",
        "/organizations",
        "/challenges",
        "/invitations",
      ]) {
    await page.goto("http://127.0.0.1:3000" + path);
    await page.waitForLoadState("networkidle");
    if ((await page.locator("h1").count()) !== 1)
      throw new Error(`Expected one page heading: ${path}`);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    if (overflow) throw new Error(`Horizontal overflow: ${path}`);
    console.log("PASS desktop", path);
  }

  const tag = "Browser" + Date.now();
  await page.goto("http://127.0.0.1:3000/auth/register");
  await page.locator("#username").fill(tag.toLowerCase());
  await page.locator("#email").fill(tag + "@test.invalid");
  await page.locator("#gamerTag").fill(tag);
  await page.locator("#password1").fill("Strong-password-123");
  await page.locator("#password2").fill("Strong-password-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.waitForURL("**/dashboard");
  await page.getByRole("heading", { name: "Welcome back, " + tag }).waitFor();
  console.log("PASS browser registration and authenticated dashboard");
  await page.goto("http://127.0.0.1:3000/tournaments/create");
  await page.locator('[name="name"]').fill("Browser Cup " + Date.now());
  await page
    .locator('textarea[name="description"]')
    .fill("A browser-tested community tournament.");
  await page.locator('[name="game"]').selectOption({ index: 1 });
  const start = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
  const deadline = new Date(Date.now() + 3600000).toISOString().slice(0, 16);
  await page.locator('[name="start_date"]').fill(start);
  await page.locator('[name="registration_deadline"]').fill(deadline);
  await page.locator('[name="location"]').fill("Online");
  await page.getByRole("button", { name: "Save event", exact: true }).click();
  await page.waitForURL(/\/tournaments\/(?!create)[^/]+/);
  await page
    .getByRole("button", { name: "Open registration", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Close registration & build bracket",
      exact: true,
    })
    .waitFor();
  console.log("PASS browser tournament draft creation and publishing");

  const base = "http://127.0.0.1:3000";
  const post = async (context, path, body) => {
    const response = await context.request.post(base + path, {
      headers: { origin: base },
      data: body,
    });
    if (!response.ok())
      throw Error(`${path}: ${response.status()} ${await response.text()}`);
    return response.json();
  };
  const orgName = "Browser Club " + Date.now();
  await page.goto(base + "/organizations");
  await page.getByText("Register an organization", { exact: true }).click();
  const orgForm = page.locator("details form").first();
  await orgForm.locator('[name="name"]').fill(orgName);
  await orgForm
    .locator('textarea[name="description"]')
    .fill("A browser-tested gaming community.");
  await orgForm.locator('[name="city"]').fill("Harare");
  await orgForm
    .getByRole("button", { name: "Submit for verification" })
    .click();
  await page.getByRole("heading", { name: orgName, exact: true }).click();
  await page.waitForURL(/\/organizations\/[^/]+/);
  await page.getByText("Add a venue", { exact: true }).click();
  const venueForm = page
    .locator("details")
    .filter({ has: page.getByText("Add a venue", { exact: true }) })
    .locator("form");
  const venueName = "Browser Lounge " + Date.now();
  for (const [field, value] of Object.entries({
    name: venueName,
    description: "A public test venue",
    city: "Harare",
    address: "Test Street",
    latitude: "-17.8252",
    longitude: "31.0335",
  }))
    await venueForm
      .locator(
        (field === "description" ? "textarea" : "input") + `[name="${field}"]`,
      )
      .fill(value);
  await venueForm.locator('[name="public_visible"]').check();
  await venueForm
    .getByRole("button", { name: "Save venue", exact: true })
    .click();
  await page.getByRole("heading", { name: venueName, exact: true }).click();
  await page.waitForURL(/\/venues\/\d+/);
  await page.getByRole("heading", { name: venueName, exact: true }).waitFor();
  console.log("PASS browser organization and public venue creation");
  const peerContext = await browser.newContext();
  const peer = "Peer" + Date.now();
  await post(peerContext, "/api/auth/register", {
    username: peer.toLowerCase(),
    gamer_tag: peer,
    email: peer + "@test.invalid",
    password1: "Strong-password-123",
    password2: "Strong-password-123",
  });
  const peerPage = await peerContext.newPage(); observe(peerPage);
  const games = await (await page.request.get(base + "/api/games")).json();
  const teamName = "Browser Squad " + Date.now();
  const team = await post(page.context(), "/api/teams/create", {
    name: teamName,
    tag: "BS",
    description: "Browser-tested squad",
    game: games[0].id,
  });
  await page.goto(base + `/teams/${team.slug}/manage`);
  const inviteForm = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", { name: "Invite a player", exact: true }),
    })
    .locator("form");
  await inviteForm.locator('[name="gamer_tag"]').selectOption(peer);
  await inviteForm
    .getByRole("button", { name: "Send invitation", exact: true })
    .click();
  await inviteForm.getByText("Saved successfully.", { exact: true }).waitFor();
  await peerPage.goto(base + "/invitations");
  await peerPage.waitForLoadState("networkidle");
  const teamInvitation = peerPage
    .locator("article")
    .filter({ hasText: teamName });
  await teamInvitation
    .getByRole("button", { name: "Accept", exact: true })
    .click();
  await teamInvitation.getByText(/Accepted/).waitFor();
  await page.reload();
  await page.getByText("Transfer ownership", { exact: true }).click();
  const transfer = page
    .locator("details")
    .filter({ has: page.getByText("Transfer ownership", { exact: true }) })
    .locator("form");
  await transfer.locator('[name="gamer_tag"]').selectOption(peer);
  await transfer
    .getByRole("button", { name: "Propose ownership transfer" })
    .click();
  await transfer.getByText("Saved successfully.", { exact: true }).waitFor();
  await peerPage.reload();
  const ownership = peerPage
    .locator("article")
    .filter({ hasText: teamName })
    .filter({ hasText: "Ownership transfer" });
  await ownership.getByRole("button", { name: "Accept", exact: true }).click();
  await ownership.getByText(/Accepted/).waitFor();
  console.log("PASS browser team invitation and accepted ownership transfer");
  await post(page.context(), `/api/games/${games[0].id}/challenge`, {
    opponent: peer,
  });
  await peerPage.goto(base + "/challenges");
  await peerPage
    .getByRole("button", { name: "Accept challenge", exact: true })
    .click();
  await peerPage.getByText("Submit a result", { exact: true }).waitFor();
  await page.goto(base + "/challenges");
  await page.getByText("Submit a result", { exact: true }).click();
  const resultForm = page
    .locator("details")
    .filter({ has: page.getByText("Submit a result", { exact: true }) })
    .locator("form");
  await resultForm.locator('[name="winner"]').selectOption(tag);
  await resultForm.locator('[name="score"]').fill("2-1");
  await resultForm
    .getByRole("button", { name: "Ask opponent to confirm" })
    .click();
  await page.getByText(/Awaiting Confirmation/).waitFor();
  await peerPage.reload();
  await peerPage
    .getByRole("button", { name: "Confirm result", exact: true })
    .click();
  await peerPage.getByText(/Completed/).waitFor();
  await page.goto(base + `/leaderboards?game=${games[0].id}`);
  await page.getByText(tag, { exact: true }).waitFor();
  console.log("PASS browser two-player result confirmation and game rankings");
  const staffContext = await browser.newContext();
  await post(staffContext, "/api/auth/login", {
    username: "browser_staff",
    password: "Browser-fixture-password-123",
  });
  const staffPage = await staffContext.newPage(); observe(staffPage);
  await staffPage.goto(base + "/admin");
  await staffPage
    .getByRole("heading", { name: "Review content", exact: true })
    .waitFor();
  const organizations = await (
    await staffPage.request.get(base + "/api/organizations")
  ).json();
  const organization = organizations.find((o) => o.name === orgName);
  const moderationForm = staffPage
    .locator("section")
    .filter({
      has: staffPage.getByRole("heading", {
        name: "Review content",
        exact: true,
      }),
    })
    .locator("form");
  await moderationForm.locator('[name="kind"]').selectOption("organization");
  await moderationForm.locator('[name="id"]').fill(String(organization.id));
  await moderationForm.locator('[name="decision"]').selectOption("verify");
  await moderationForm
    .locator('[name="reason"]')
    .fill("Browser test: ownership reviewed.");
  await moderationForm
    .getByRole("button", { name: "Record moderation action" })
    .click();
  await moderationForm.getByText("Saved successfully.", {exact:true}).waitFor();
  const reviewed = await (await staffPage.request.get(base+"/api/admin")).json();
  if (!reviewed.audit.some(a=>a.action==="organization.verify" && a.target_id===organization.id)) throw Error("Missing audit entry for the reviewed organization");
  await staffPage.getByText(`organization #${organization.id} · ${orgName} · Verified`, {exact:true}).waitFor();
  console.log("PASS browser staff verification and audit history");
  await staffPage.evaluate(() => {document.activeElement?.blur(); window.scrollTo(0,0);});
  await staffPage.screenshot({path:"/tmp/ggz-moderation.png",fullPage:true});
  await peerPage.screenshot({path:"/tmp/ggz-challenges.png",fullPage:true});
  await peerContext.close();
  await staffContext.close();
  await page.goto("http://127.0.0.1:3000");
  await page.screenshot({ path: "/tmp/ggz-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    "/",
    "/games",
    "/auth/login",
    "/tournaments/create",
    "/marketplace/create",
  ]) {
    await page.goto("http://127.0.0.1:3000" + path);
    await page.waitForLoadState("networkidle");
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw new Error(`Mobile overflow ${path}`);
    console.log("PASS mobile", path);
  }
  await page.goto("http://127.0.0.1:3000");
  await page.screenshot({ path: "/tmp/ggz-mobile.png", fullPage: true });
  if (failures.length) throw Error("Browser errors: " + failures.join("; "));
} catch (e) {
  if (page && !page.isClosed()) {
    console.error((await page.locator("body").innerText()).slice(-3000));
    await page
      .screenshot({ path: "/tmp/ggz-browser-failure.png", fullPage: true })
      .catch(() => {});
  }
  console.error(output);
  throw e;
} finally {
  await browser?.close();
  child.kill("SIGTERM");
}
