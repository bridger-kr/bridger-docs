#!/usr/bin/env node
/**
 * check-content.mjs
 *
 * Repo-content gates for the docs site (EDD-304):
 *
 *   1. ko/en file pairs — every published .mdx has a mirror in the other
 *      locale. ko pages live at the repo root, en mirrors them under en/.
 *      `internal/` is ko-only working notes and is exempt.
 *
 *   2. Forbidden legacy strings — `datari`, `data-bridge`, `DATA_BRIDGE`,
 *      `/mcp/sse` must not re-enter the docs. `@datari/...` is the live
 *      preset tool-ID namespace still served by the registry, so bare
 *      `@datari` tokens are allowlisted.
 *
 * Scope: files tracked by git (`git ls-files`), excluding vendor/ (the
 * pinned spec submodule is upstream-owned) and this script.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((f) => {
    try {
      return statSync(f).isFile();
    } catch {
      return false;
    }
  });

const VENDOR_RE = /^vendor\//;
const SELF = "scripts/check-content.mjs";

let failures = 0;

// --- 1. ko/en file pairs ---------------------------------------------------

const KO_ONLY = /^internal\//;

const koPages = new Set(
  tracked.filter(
    (f) =>
      f.endsWith(".mdx") &&
      !f.startsWith("en/") &&
      !VENDOR_RE.test(f) &&
      !KO_ONLY.test(f),
  ),
);
const enPages = new Set(
  tracked.filter((f) => f.endsWith(".mdx") && f.startsWith("en/")),
);

for (const ko of koPages) {
  const mirror = `en/${ko}`;
  if (!enPages.has(mirror)) {
    console.error(`pair: ${ko} is missing its en mirror (${mirror})`);
    failures++;
  }
}
for (const en of enPages) {
  const mirror = en.slice("en/".length);
  if (!koPages.has(mirror)) {
    console.error(`pair: ${en} is missing its ko mirror (${mirror})`);
    failures++;
  }
}

// --- 2. Forbidden legacy strings -------------------------------------------

const FORBIDDEN = [
  { label: "datari", re: /datari/i },
  { label: "data-bridge", re: /data-bridge/i },
  { label: "DATA_BRIDGE", re: /data_bridge/i },
  { label: "/mcp/sse", re: /\/mcp\/sse/ },
];

for (const file of tracked) {
  if (VENDOR_RE.test(file) || file === SELF) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    const scrubbed = line.replace(/@datari/gi, "");
    for (const { label, re } of FORBIDDEN) {
      if (re.test(scrubbed)) {
        console.error(`forbidden: ${file}:${i + 1} contains '${label}'`);
        failures++;
      }
    }
  });
}

if (failures > 0) {
  console.error(`\ncheck-content: ${failures} failure(s)`);
  process.exit(1);
}
console.log("check-content: ko/en pairs OK, no forbidden strings");
