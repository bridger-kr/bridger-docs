#!/usr/bin/env node
// verify-examples.mjs
//
// Verifies every example prompt in the docs targets an API that actually
// exists in the preset catalog. Example prompts are marked in MDX with a
// JSX comment carrying the preset id:
//
//   {/* example-api: {category}/{name} */}
//   - "서울 중구 미세먼지 상태 알려줘" — ...
//
// For each marker the script checks that
// vendor/spec/presets/{category}/{name}.yaml exists and, when the spec
// declares catalog.id, that it equals {name}.
//
// Exits non-zero if any referenced preset is missing or mismatched, so
// this can gate CI like `npm run lint` does for links.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const PRESETS_DIR = join(REPO_ROOT, "vendor", "spec", "presets");
const SKIP_DIRS = new Set(["node_modules", "vendor", ".git", ".mintlify", "dist", "build"]);
const MARKER_RE = /\{\/\*\s*example-api:\s*([a-z0-9_-]+\/[a-z0-9_-]+)\s*\*\/\}/g;

/** Recursively collect *.mdx files under dir, skipping SKIP_DIRS. */
function collectMdx(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectMdx(p));
    else if (entry.isFile() && entry.name.endsWith(".mdx")) out.push(p);
  }
  return out;
}

function presetPath(id) {
  const [category, name] = id.split("/");
  return join(PRESETS_DIR, category, `${name}.yaml`);
}

let checked = 0;
let failed = 0;

for (const file of collectMdx(REPO_ROOT)) {
  const rel = relative(REPO_ROOT, file);
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(MARKER_RE)) {
    const id = match[1];
    const line = text.slice(0, match.index).split("\n").length;
    checked += 1;
    const path = presetPath(id);
    if (!existsSync(path)) {
      console.error(`FAIL ${rel}:${line} — example targets '${id}', no preset at ${relative(REPO_ROOT, path)}`);
      failed += 1;
      continue;
    }
    try {
      const doc = parseYaml(readFileSync(path, "utf8"));
      const catalogId = doc?.catalog?.id;
      if (catalogId && catalogId !== id.split("/")[1]) {
        console.error(`FAIL ${rel}:${line} — '${id}' resolves to ${relative(REPO_ROOT, path)} but catalog.id is '${catalogId}'`);
        failed += 1;
        continue;
      }
    } catch (err) {
      console.error(`FAIL ${rel}:${line} — cannot parse ${relative(REPO_ROOT, path)}: ${err.message}`);
      failed += 1;
      continue;
    }
    console.log(`ok   ${rel}:${line} — ${id}`);
  }
}

if (checked === 0) {
  console.error("FAIL no `{/* example-api: ... */}` markers found in docs");
  process.exit(1);
}
if (failed > 0) {
  console.error(`\n${failed}/${checked} example prompts point at APIs missing from the preset catalog`);
  process.exit(1);
}
console.log(`\nAll ${checked} example prompts verified against vendor/spec presets.`);
