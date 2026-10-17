import { readFile, writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { database } from "../src/lib/server/db";
import {
  exportLegacy,
  importLegacy,
  rollbackLegacy,
  type LegacySnapshot,
} from "../src/lib/server/legacy";
const [action, file, ...flags] = process.argv.slice(2);
if (action === "export") {
  if (!process.env.LEGACY_DATABASE_URL || !file)
    throw Error(
      "Usage: migrate-legacy export <private-snapshot-path>; LEGACY_DATABASE_URL is required.",
    );
  const pool = new Pool({
    connectionString: process.env.LEGACY_DATABASE_URL,
    max: 1,
  });
  const client = await pool.connect();
  try {
    const snapshot = await exportLegacy(client);
    await writeFile(file, JSON.stringify(snapshot, null, 2), {
      mode: 0o600,
      flag: "wx",
    });
    console.log(
      "Private snapshot exported. Keep it outside Git; it contains account data and password hashes.",
    );
  } finally {
    client.release();
    await pool.end();
  }
} else if (action === "inspect" || action === "import") {
  if (!file) throw Error("Supply the private legacy snapshot path.");
  const overridesFile = flags
    .find((f) => f.startsWith("--overrides="))
    ?.slice(12);
  const overrides = overridesFile
    ? JSON.parse(await readFile(overridesFile, "utf8"))
    : undefined;
  const snapshot = JSON.parse(await readFile(file, "utf8")) as LegacySnapshot;
  const report = await importLegacy(snapshot, {
    apply: action === "import",
    overrides,
    expectedFingerprint: flags
      .find((f) => f.startsWith("--fingerprint="))
      ?.split("=")[1],
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.ready) process.exitCode = 1;
  if (action === "import") await (await database()).destroy();
} else if (action === "rollback") {
  if (!file) throw Error("Supply the exact imported snapshot fingerprint.");
  console.log(await rollbackLegacy(file));
  await (await database()).destroy();
} else {
  throw Error(
    "Commands: export <file>, inspect <file>, import <file> --fingerprint=<reviewed-sha256>, rollback <sha256>. Export is read-only; inspect never writes application records.",
  );
}
