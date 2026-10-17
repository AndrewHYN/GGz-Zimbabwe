import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1"],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let output = "";
child.stdout.on("data", (b) => {
  output += b;
});
child.stderr.on("data", (b) => {
  output += b;
});
try {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch("http://127.0.0.1:3000/api/health");
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  for (const path of [
    "/",
    "/games",
    "/tournaments",
    "/events",
    "/teams",
    "/marketplace",
    "/auth/login",
    "/auth/register",
    "/api/games",
  ]) {
    const r = await fetch("http://127.0.0.1:3000" + path);
    assert.equal(r.status, 200, `${path}: ${r.status}`);
    console.log("PASS", path);
  }
} catch (e) {
  console.error(output);
  throw e;
} finally {
  child.kill("SIGTERM");
}
