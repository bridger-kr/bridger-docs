#!/usr/bin/env node
/**
 * verify-examples.mjs
 *
 * EDD-271 / EDD-304: every API identifier an example uses must exist in the
 * preset catalog — `vendor/spec/presets/{category}/*.yaml`, the same source
 * the registry serves. Catches doc drift such as an example prompt that
 * targets a tool the catalog no longer ships.
 *
 * Checked identifier forms:
 *   - `@datari/{category}-{catalogId}`   preset tool_id
 *   - `{category}/{catalogId}`           registry server id
 * Deployed tool names and arguments are checked by verify-live-tools.mjs.
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import { parse as parseYaml } from "yaml";

const REPO_ROOT = new URL("..", import.meta.url).pathname;
const PRESETS_DIR = join(REPO_ROOT, "vendor", "spec", "presets");

if (!existsSync(PRESETS_DIR)) {
  console.error(
    "verify-examples: vendor/spec/presets missing — run " +
      "`git submodule update --init vendor/spec` first",
  );
  process.exit(1);
}

// --- Build the catalog identifier set --------------------------------------

const categories = readdirSync(PRESETS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const serverIds = new Set(); // {category}/{catalogId}
const toolIds = new Set(); // {category}-{catalogId}

for (const cat of categories) {
  const dir = join(PRESETS_DIR, cat);
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
    const doc = parseYaml(readFileSync(join(dir, file), "utf8"));
    const catalogId = doc?.catalog?.id ?? basename(file).replace(/\.ya?ml$/, "");
    serverIds.add(`${cat}/${catalogId}`);
    toolIds.add(`${cat}-${catalogId}`);

  }
}

// --- Scan docs for identifier references -----------------------------------

const mdxFiles = execFileSync("git", ["ls-files", "*.mdx"], {
  cwd: REPO_ROOT,
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean)
  .filter((f) => !f.startsWith("vendor/"));

let failures = 0;
const report = (file, line, msg) => {
  console.error(`verify-examples: ${file}:${line} ${msg}`);
  failures++;
};

const CAT_RE = categories.join("|");
const serverIdRe = new RegExp(
  `(?<![\\w@/.-])(${CAT_RE})/([a-z0-9][a-z0-9-]*)`,
  "g",
);
const toolIdRe = /@datari\/([a-z0-9][a-z0-9-]*)/g;

for (const file of mdxFiles) {
  const lines = readFileSync(join(REPO_ROOT, file), "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(toolIdRe)) {
      if (!toolIds.has(m[1])) {
        report(file, i + 1, `@datari/${m[1]} is not a catalog tool_id`);
      }
    }
    for (const m of line.matchAll(serverIdRe)) {
      if (!serverIds.has(`${m[1]}/${m[2]}`)) {
        report(file, i + 1, `${m[1]}/${m[2]} is not a catalog server id`);
      }
    }
  });
}

if (failures > 0) {
  console.error(`\nverify-examples: ${failures} failure(s)`);
  process.exit(1);
}
console.log(
  `verify-examples: OK — ${serverIds.size} preset identifiers checked`,
);
