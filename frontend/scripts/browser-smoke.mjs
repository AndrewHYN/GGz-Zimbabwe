import { spawn } from "node:child_process";
import { chromium as playwright } from "@playwright/test";
import chromium from "@sparticuz/chromium";
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
        arg !== "--disable-web-security" &&
        arg !== "--allow-running-insecure-content",
    ),
    headless: true,
  });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("request", async (request) => {
    if (request.url().includes("/api/auth/register"))
      console.log(
        "Auth request origin:",
        (await request.allHeaders()).origin || "(missing)",
      );
  });
  page.on("pageerror", (error) =>
    console.error("Browser error:", error.message),
  );
  page.on("response", async (response) => {
    if (response.status() >= 400 && !response.url().endsWith("/api/me"))
      console.error("HTTP error", response.status(), response.url());
    if (
      response.url().includes("/api/auth/register") &&
      response.status() !== 308
    ) {
      const data = await response.json().catch(() => ({}));
      if (data.error) console.error("Registration error", data.error);
    }
  });
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
