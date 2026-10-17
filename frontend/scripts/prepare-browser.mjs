import { mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { brotliDecompressSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
// Local test support for restricted hosts where tar cannot restore original ownership.
const root = resolve(".browser-cache");
mkdirSync(root, { recursive: true });
mkdirSync(root + "/fonts", { recursive: true });
for (const name of ["chromium", "fonts.tar", "swiftshader.tar"])
  writeFileSync(
    root + "/" + name,
    brotliDecompressSync(
      readFileSync("node_modules/@sparticuz/chromium/bin/" + name + ".br"),
    ),
  );
chmodSync(root + "/chromium", 0o700);
for (const [name, dest] of [
  ["fonts.tar", root + "/fonts"],
  ["swiftshader.tar", root],
]) {
  const r = spawnSync("tar", [
    "--no-same-owner",
    "-xf",
    root + "/" + name,
    "-C",
    dest,
  ]);
  if (r.status !== 0) throw Error("Could not extract browser support files.");
}
mkdirSync(root + "/font-cache", { recursive: true });
writeFileSync(
  root + "/fonts.conf",
  `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${root}/fonts/fonts</dir><cachedir>${root}/font-cache</cachedir><config></config></fontconfig>`,
);
console.log("Local test browser prepared.");
