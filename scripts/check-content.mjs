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
 *   3. Slop gate (issue #40 / EDD-236) — descriptive `<Card>` components
 *      must not carry `icon=` (link cards keep theirs is the historical
 *      pattern, but the current house style is icon-free throughout, so
 *      icon= is banned outright), and the banned marketing-hyperbole
 *      phrases must not re-enter the docs.
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

// Legitimate `datari` mentions that are not legacy branding:
//   - `@datari/...` — the live preset tool-ID namespace still served by
//     the registry (internal/specbuilder in bridger-api)
//   - `datari-{api,web,gitops,docs}` — org self-hosted runner labels
//   - `datariauth` — the live Go auth package in bridger-api
//     (`internal/datariauth/`), cited by decision records
const DATARI_ALLOW = /@datari|datari-(?:api|web|gitops|docs)\b|datariauth/gi;

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
    const scrubbed = line.replace(DATARI_ALLOW, "");
    for (const { label, re } of FORBIDDEN) {
      if (re.test(scrubbed)) {
        console.error(`forbidden: ${file}:${i + 1} contains '${label}'`);
        failures++;
      }
    }
  });
}

// --- 3. Slop gate (issue #40) ----------------------------------------------
//
//   - MDX <Card> elements must not carry an icon= attribute — descriptive
//     icon-card grids read as template filler; the house style is a
//     definition table for descriptions and icon-free link cards for nav.
//   - Marketing hyperbole that overpromises ("any API", "done in seconds",
//     "어떤 API든", "수 초/몇 초") must stay out; claims are bounded to the
//     real contract (REST APIs with OpenAPI specs).

const SLOP_PHRASES = [
  { label: "any API", re: /\bany API\b/i },
  { label: "done in seconds", re: /done in seconds|in seconds\b/i },
  { label: "어떤 API든", re: /어떤 API든/ },
  { label: "수 초/몇 초", re: /[수몇]\s*초/ },
];

for (const file of tracked) {
  if (!file.endsWith(".mdx")) continue;
  if (VENDOR_RE.test(file) || file === SELF) continue;
  const text = readFileSync(file, "utf8");
  text.split("\n").forEach((line, i) => {
    if (/<Card[^>]*\bicon=/.test(line)) {
      console.error(`slop: ${file}:${i + 1} <Card> carries icon= — strip it`);
      failures++;
    }
    for (const { label, re } of SLOP_PHRASES) {
      if (re.test(line)) {
        console.error(`slop: ${file}:${i + 1} hyperbole '${label}'`);
        failures++;
      }
    }
  });
}

// --- 4. en/ locale gate (EDD-430) ------------------------------------------
//
//   Table HEADER rows in en/*.mdx must not contain Korean. The 28611b3
//   card→table migration left `| 이름 | 하는 일 |` headers in six English
//   pages; Korean data cells inside en tables (e.g. `서울특별시` examples)
//   stay legal. A header row is a table row immediately followed by the
//   `| --- |` separator line.

const HANGUL = /[\uAC00-\uD7AF]/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEPARATOR = /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/;

for (const file of tracked) {
  if (!file.startsWith("en/") || !file.endsWith(".mdx")) continue;
  if (VENDOR_RE.test(file) || file === SELF) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (
      TABLE_ROW.test(line) &&
      HANGUL.test(line) &&
      TABLE_SEPARATOR.test(lines[i + 1] ?? "")
    ) {
      console.error(`locale: ${file}:${i + 1} table header row contains Korean`);
      failures++;
    }
  });
}


// --- 5. Unpublished internal working docs (EDD-412) -------------------------
// docs/gtm and docs/decisions are repo-local working notes. Mintlify still
// serves files that are not in docs.json, so they must stay in .mintignore.
const mintignore = readFileSync(".mintignore", "utf8");
const DOCS_UNPUBLISHED = /(^|\n)\/?docs\/\*\*\s*($|\n)/;
if (!DOCS_UNPUBLISHED.test(mintignore)) {
  console.error(
    "mintignore: docs/** must stay in .mintignore so GTM/ADR working notes are not served on docs.bridger.kr (EDD-412)",
  );
  failures++;
}

if (failures > 0) {
  console.error(`\ncheck-content: ${failures} failure(s)`);
  process.exit(1);
}
console.log("check-content: ko/en pairs OK, no forbidden strings, no slop, en/ table headers Korean-free");

