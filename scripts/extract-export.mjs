import path from "node:path";
import { mkdir } from "node:fs/promises";
import extract from "extract-zip";

const [, , zipPath, outputPath] = process.argv;

if (!zipPath || !outputPath) {
  console.error("Usage: node scripts/extract-export.mjs <zip> <output-dir>");
  process.exit(1);
}

const outputDir = path.resolve(outputPath);

await mkdir(outputDir, { recursive: true });
await extract(path.resolve(zipPath), { dir: outputDir });
