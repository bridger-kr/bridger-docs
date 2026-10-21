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
 *   - `{prefix}_{snakeCase operationId}` MCP tool name, taken from
 *     "name" / "tool" / "toolName" value positions in example payloads
 *
 * Tool names carry a provider prefix (`kma_`, `molit_`, …) sourced from
 * catalog.toolPrefix upstream of the pinned spec, so this verifies the
 * operation part of each name against every preset operationId. Bare
 * single-word names (`pingtool`, BYOAPI `listpets`) are not resolvable
 * against the preset catalog and are out of scope.
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

// snakeCase — parity with bridger-api specbuilder.SnakeCaseIdentifier:
// camelCase -> snake_case, `-`/`.`/space -> `_`, drop chars outside
// [a-z0-9_], collapse repeats, trim edge underscores.
function snakeCase(value) {
  let out = "";
  let prevUnderscore = false;
  let prev = "";
  [...value].forEach((r, i) => {
    if (/[A-Z]/.test(r)) {
      if (i > 0 && /[a-z0-9]/.test(prev) && !prevUnderscore) out += "_";
      out += r.toLowerCase();
      prevUnderscore = false;
      prev = r;
      return;
    }
    if (r === "-" || r === "." || /\s/.test(r)) {
      if (!prevUnderscore && i > 0) {
        out += "_";
        prevUnderscore = true;
        prev = r;
      }
      return;
    }
    if (!/[a-z0-9_]/.test(r)) {
      prev = r;
      return;
    }
    if (r !== "_") prevUnderscore = false;
    out += r;
    prev = r;
  });
  return out.replace(/^_+|_+$/g, "");
}

// --- Build the catalog identifier set --------------------------------------

const categories = readdirSync(PRESETS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const serverIds = new Set(); // {category}/{catalogId}
const toolIds = new Set(); // {category}-{catalogId}
const operations = new Set(); // snake_case operationId

for (const cat of categories) {
  const dir = join(PRESETS_DIR, cat);
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
    const doc = parseYaml(readFileSync(join(dir, file), "utf8"));
    const catalogId = doc?.catalog?.id ?? basename(file).replace(/\.ya?ml$/, "");
    serverIds.add(`${cat}/${catalogId}`);
    toolIds.add(`${cat}-${catalogId}`);
    for (const methods of Object.values(doc?.paths ?? {})) {
      for (const op of Object.values(methods ?? {})) {
        if (op && typeof op === "object" && typeof op.operationId === "string") {
          const snake = snakeCase(op.operationId);
          if (snake) operations.add(snake);
        }
      }
    }
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
// "name"/"tool"/"toolName": "<token>" in JSON and JS-literal examples.
// The lookbehind stops substring keys like "username"/"filename" matching.
const nameRe =
  /(?<![\w])["']?(?:name|tool|toolName)["']?\s*:\s*"([a-z][a-z0-9_]*)"/g;

// System tools served by the registry itself are not preset operations.
// search_tools is bridger-api's semantic tool finder
// (internal/toolsearch SystemToolName) and carries no provider prefix.
const systemToolNames = new Set(["search_tools"]);

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
    for (const m of line.matchAll(nameRe)) {
      const token = m[1];
      if (!token.includes("_")) continue; // single-word names out of scope
      if (systemToolNames.has(token)) continue; // registry system tools
      const opPart = token.slice(token.indexOf("_") + 1);
      if (!operations.has(opPart)) {
        report(
          file,
          i + 1,
          `"${token}" — no preset operation '${opPart}' exists`,
        );
      }
    }
  });
}

if (failures > 0) {
  console.error(`\nverify-examples: ${failures} failure(s)`);
  process.exit(1);
}
console.log(
  `verify-examples: OK — ${serverIds.size} presets, ${operations.size} operations checked`,
);
