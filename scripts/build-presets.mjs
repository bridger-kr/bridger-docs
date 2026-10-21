#!/usr/bin/env node
/**
 * build-presets.mjs
 *
 * Parses vendor/spec/presets/{category}/*.yaml (the bridger-spec submodule,
 * the single source of truth) and writes one MDX page per category to
 * presets/{category}.mdx, plus a master index at presets/index.mdx.
 *
 * Idempotent: rewrites every file from scratch on each run.
 *
 * NOTE: This is a DEV-TIME generator. Output MDX is committed to the repo
 * and published directly by Mintlify hosting.
 *   - Run locally: `npm run build:content` (after the vendor/spec submodule
 *     is updated to a new SHA, or when editing the templates here).
 *   - Mintlify hosting publishes the already-committed MDX under presets/;
 *     this script is not part of the publish step.
 */

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const PRESETS_DIR = join(REPO_ROOT, "vendor", "spec", "presets");
const FAMILIES_DIR = join(REPO_ROOT, "vendor", "spec", "families");
const OUT_DIR = join(REPO_ROOT, "presets");
const PUBLIC_DATA_REGISTRY = "data.go.kr";
const DEFAULT_LOCALE = "ko";
const LOCALE_FALLBACKS = [DEFAULT_LOCALE, "en"];

const CATEGORY_META = {
  civil:          { title: "행정 · 민원",   icon: "building-columns", desc: "행정 · 민원 · 인구 · 치안 · 재난 · 공공시설 데이터.", titleEn: "Government & Civil", descEn: "Administration, civil services, population, public safety, disaster, and public-facility data." },
  culture:        { title: "문화 · 관광",   icon: "masks-theater",     desc: "축제, 관광지, 도서관, 공연, 문화유산 데이터.", titleEn: "Culture & Tourism", descEn: "Festival, attraction, library, performance, and cultural-heritage data." },
  economy:        { title: "경제 · 금융",   icon: "chart-line",        desc: "환율, 금리, 지표, 소비, 수출입, 시장 통계.", titleEn: "Economy & Finance", descEn: "Exchange rates, interest rates, indicators, consumption, trade, and market statistics." },
  education:      { title: "교육",          icon: "graduation-cap",    desc: "학교, 대학, 교육 통계, 학사 데이터.", titleEn: "Education", descEn: "School, university, education statistics, and academic data." },
  environment:    { title: "환경",          icon: "leaf",              desc: "대기질, 수질, 소음, 진동, 폐기물, 라돈 데이터.", titleEn: "Environment", descEn: "Air quality, water quality, noise, vibration, waste, and radon data." },
  food:           { title: "식품 · 농축산", icon: "wheat-awn",         desc: "식품 안전, 농축산물 가격·생산, 수산물 데이터.", titleEn: "Food & Agriculture", descEn: "Food safety, agricultural/livestock prices and production, and seafood data." },
  land:           { title: "국토 · 토지",   icon: "map",               desc: "지적, 건축 인허가, 도시계획, 국토 통계.", titleEn: "Land & Territory", descEn: "Cadastral, building permits, urban planning, and land statistics." },
  law:            { title: "법률 · 행정",   icon: "scale-balanced",    desc: "법령, 판례, 행정심판, 규제 정보.", titleEn: "Law & Administration", descEn: "Statutes, case law, administrative appeals, and regulatory information." },
  realestate:     { title: "부동산",        icon: "house",             desc: "아파트·오피스텔 실거래, 전월세, 지적·건축 인허가.", titleEn: "Real Estate", descEn: "Apartment/officetel transactions, rentals, cadastral, and building permits." },
  safety:         { title: "안전 · 재난",   icon: "shield-halved",     desc: "재난 경보, 안전 지표, 응급 상황 데이터.", titleEn: "Safety & Disaster", descEn: "Disaster alerts, safety indicators, and emergency data." },
  science:        { title: "과학 · 기술",   icon: "atom",              desc: "연구 통계, 특허, 과학 기술 지표.", titleEn: "Science & Technology", descEn: "Research statistics, patents, and science & technology indicators." },
  transportation: { title: "교통",          icon: "bus",               desc: "버스, 지하철, 항공, 철도, 주차, 도로 교통 데이터.", titleEn: "Transportation", descEn: "Bus, subway, aviation, rail, parking, and road-traffic data." },
  weather:        { title: "기상",          icon: "cloud-sun-rain",    desc: "예보, 경보, 레이더, 자외선, 태풍 데이터.", titleEn: "Weather", descEn: "Forecast, alert, radar, UV, and typhoon data." },
  welfare:        { title: "복지 · 의료",   icon: "hand-holding-medical", desc: "병원, 약국, 응급실, 돌봄, 백신, 복지시설 데이터.", titleEn: "Welfare & Healthcare", descEn: "Hospital, pharmacy, ER, care, vaccine, and welfare-facility data." },
};

// Per-locale UI strings + path config for the generated preset pages.
const LOCALES = {
  ko: {
    locale: "ko",
    outSubdir: "presets",
    linkPrefix: "/presets",
    metaTitle: (m) => m.title,
    metaDesc: (m) => m.desc,
    catTitle: (m) => m.title,
    catDesc: (m, total, ops) => `${m.desc} 총 ${total}종 프리셋 · ${ops}종 도구.`,
    catIntro: (total, ops) => `이 카테고리에는 **${total}**개의 프리셋이 등록되어 있으며, 합산 **${ops}**개의 MCP 도구가 노출됩니다.`,
    tip: "필요한 도구 이름은 `tools/list` 응답에서 확인한 뒤 `tools/call`로 바로 호출할 수 있습니다.",
    listHeading: "## 프리셋 목록",
    tableHeader: "| 이름 | 제공기관 | 도구 수 | data.go.kr |",
    usageHeading: "## 사용 예시",
    serverQueryLabel: "bash 카테고리 서버 조회",
    serverQueryComment: "# 이 카테고리의 프리셋 서버와 도구를 확인합니다. (공개 카탈로그 — 인증 불필요)",
    toolsListLabel: "bash 전체 도구 목록 (MCP)",
    indexTitle: "카탈로그 인덱스",
    indexDesc: (cats, total, ops) => `Bridger가 제공하는 ${cats}개 카테고리 · ${total}종 프리셋 · ${ops}종 도구의 전체 인덱스.`,
    indexIntro: (total) => `Bridger는 공공·민간 OpenAPI를 카테고리별로 정리한 **${total}**개의 프리셋을 제공합니다.\n카테고리별 도구는 Bridger 호스팅 Gateway에서 \`tools/list\`로 확인하고 즉시 호출할 수 있습니다.`,
    cardCount: (total, ops) => `**${total}**개 프리셋 · **${ops}**개 도구`,
    familiesHeading: "## 지역 통합 도구 (Families)",
    familiesIntro: "지역·제공기관별로 나뉜 공공데이터 API를 하나의 도구로 묶은 스펙입니다. `location` 입력만으로 라우팅되어 여러 제공기관을 한 번에 조회합니다.",
    familiesTableHeader: "| 도구 | 설명 | 제공기관 수 | 상태 |",
    statusLabel: { draft: "초안", beta: "베타", ga: "정식" },
    overviewHeading: "## 한눈에 보기",
    overviewTableHeader: "| 카테고리 | 프리셋 수 | 도구 수 |",
    totalRow: (total, ops) => `| **합계** | **${total}** | **${ops}** |`,
    quickHeading: "## 빠른 사용",
  },
  en: {
    locale: "en",
    outSubdir: "en/presets",
    linkPrefix: "/en/presets",
    metaTitle: (m) => m.titleEn,
    metaDesc: (m) => m.descEn,
    catTitle: (m) => m.titleEn,
    catDesc: (m, total, ops) => `${m.descEn} ${total} presets · ${ops} tools.`,
    catIntro: (total, ops) => `This category has **${total} presets** registered, exposing **${ops} MCP tools** in total.`,
    tip: "Find the tool name you need in the `tools/list` response, then call it directly with `tools/call`.",
    listHeading: "## Preset list",
    tableHeader: "| Name | Provider | Tools | data.go.kr |",
    usageHeading: "## Usage examples",
    serverQueryLabel: "bash Query category servers",
    serverQueryComment: "# List the preset servers and tools in this category. (public catalog — no auth required)",
    toolsListLabel: "bash Full tool list (MCP)",
    indexTitle: "Catalog index",
    indexDesc: (cats, total, ops) => `Full index of ${cats} categories · ${total} presets · ${ops} tools provided by Bridger.`,
    indexIntro: (total) => `Bridger provides **${total} presets** organizing public and private OpenAPIs by category.\nTools per category can be discovered via \`tools/list\` on the Bridger hosted Gateway and called immediately.`,
    cardCount: (total, ops) => `**${total} presets · ${ops} tools**`,
    familiesHeading: "## Region-unified tools (families)",
    familiesIntro: "Specs that merge region- or provider-split public APIs into a single tool. Pass a `location` input and the family routes to the right providers for you.",
    familiesTableHeader: "| Tool | Description | Providers | Status |",
    statusLabel: { draft: "draft", beta: "beta", ga: "ga" },
    overviewHeading: "## At a glance",
    overviewTableHeader: "| Category | Presets | Tools |",
    totalRow: (total, ops) => `| **Total** | **${total}** | **${ops}** |`,
    quickHeading: "## Quick start",
  },
};

/** @typedef {string | Record<string, string>} LocalizedString */
/** @typedef {{ id?: string, summary?: string }} OperationInfo */
/** @typedef {{ title: string, description: string, provider?: LocalizedString, displayName?: LocalizedString, isPublicData: boolean, opCount: number, operations: OperationInfo[], catalogId: string, dataGoKrId?: string, file: string }} PresetInfo */

/**
 * Presets whose YAML home directory under vendor/spec/presets/ does not match
 * the docs category they belong in, keyed by catalog.id. Each entry moves the
 * preset into the category it is listed under in the generated pages, so the
 * generated docs stay correct until the spec directory layout catches up.
 */
const PRESET_CATEGORY_OVERRIDES = new Map([
  // 대기질 측정소 조회(한국환경공단) is environment data but lives in
  // vendor/spec/presets/weather/; the docs list it under the environment category.
  ["air-quality-station", "environment"],
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

/**
 * @param {unknown} value
 * @param {string} locale
 */
function localizedString(value, locale) {
  if (typeof value === "string") return value;
  if (!isRecord(value)) return undefined;
  return firstString(
    value[locale],
    ...LOCALE_FALLBACKS.map((fallbackLocale) => value[fallbackLocale]),
    ...Object.values(value),
  );
}

function extractDataGoKrId(url) {
  if (typeof url !== "string") return undefined;
  const match = url.match(/data\.go\.kr\/data\/([0-9]+)\/openapi\.do/);
  return match?.[1];
}

/**
 * @param {string} categoryDir
 * @returns {PresetInfo[]}
 */
function readCategory(categoryDir) {
  /** @type {PresetInfo[]} */
  const out = [];
  for (const fname of readdirSync(categoryDir).sort()) {
    if (!fname.endsWith(".yaml") && !fname.endsWith(".yml")) continue;
    const fpath = join(categoryDir, fname);
    if (!statSync(fpath).isFile()) continue;
    let raw;
    try {
      raw = readFileSync(fpath, "utf8");
    } catch {
      continue;
    }
    let doc;
    try {
      doc = parseYaml(raw);
    } catch (err) {
      console.warn(`[build-presets] skip invalid yaml: ${fpath}: ${err.message}`);
      continue;
    }
    if (!doc || typeof doc !== "object") continue;
    const info = doc.info ?? {};
    const xpd = isRecord(doc["x-publicdata"]) ? doc["x-publicdata"] : {};
    const catalog = isRecord(doc.catalog) ? doc.catalog : {};
    const sources = isRecord(doc.sources) ? doc.sources : {};
    const registry = isRecord(sources.registry) ? sources.registry : {};
    const officialPage = isRecord(sources.officialPage) ? sources.officialPage : {};
    const catalogTitle = isRecord(catalog.title) || typeof catalog.title === "string"
      ? catalog.title
      : undefined;
    const catalogProvider = isRecord(catalog.provider) || typeof catalog.provider === "string"
      ? catalog.provider
      : undefined;
    const dataGoKrId = firstString(
      typeof xpd.dataGoKrId === "string" ? xpd.dataGoKrId : undefined,
      registry.provider === PUBLIC_DATA_REGISTRY && typeof registry.id === "string"
        ? registry.id
        : undefined,
      extractDataGoKrId(officialPage.url),
      extractDataGoKrId(info.contact?.url),
    );
    const isPublicData =
      Object.keys(xpd).length > 0 ||
      registry.provider === PUBLIC_DATA_REGISTRY ||
      Boolean(dataGoKrId);
    const operations = /** @type {OperationInfo[]} */ ([]);
    const opCount = doc.paths
      ? Object.values(doc.paths).reduce((acc, methods) => {
          if (!methods || typeof methods !== "object") return acc;
          for (const method of Object.keys(methods)) {
            if (!["get", "post", "put", "delete", "patch", "head", "options"].includes(
              String(method).toLowerCase(),
            )) continue;
            const operation = isRecord(methods[method]) ? methods[method] : undefined;
            operations.push({
              summary:
                typeof operation?.summary === "string"
                  ? operation.summary.split("\n")[0].trim()
                  : undefined,
              id: typeof operation?.operationId === "string" ? operation.operationId : undefined,
            });
            acc += 1;
          }
          return acc;
        }, 0)
      : 0;

    out.push({
      title: typeof info.title === "string" ? info.title : fname,
      description:
        typeof info.description === "string"
          ? info.description.split("\n")[0].trim()
          : "",
      provider:
        typeof xpd.provider === "string" ? xpd.provider : catalogProvider,
      displayName:
        typeof xpd.displayName === "string" ? xpd.displayName : catalogTitle,
      dataGoKrId,
      isPublicData,
      opCount,
      operations,
      catalogId: firstString(
        typeof catalog.id === "string" ? catalog.id : undefined,
        fname.replace(/\.ya?ml$/, ""),
      ),
      file: fname,
    });
  }
  return out;
}

/** @typedef {{ id: string, title?: LocalizedString, description?: LocalizedString, status: string, members: number }} FamilyInfo */

/**
 * Reads vendor/spec/families/*.yaml (region-unified API specs).
 * Missing directory (old submodule pins) returns an empty list.
 * @returns {FamilyInfo[]}
 */
function readFamilies() {
  /** @type {FamilyInfo[]} */
  const out = [];
  let names = [];
  try {
    names = readdirSync(FAMILIES_DIR).sort();
  } catch {
    return out;
  }
  for (const fname of names) {
    if (!fname.endsWith(".yaml") && !fname.endsWith(".yml")) continue;
    const fpath = join(FAMILIES_DIR, fname);
    if (!statSync(fpath).isFile()) continue;
    let doc;
    try {
      doc = parseYaml(readFileSync(fpath, "utf8"));
    } catch (err) {
      console.warn(`[build-presets] skip invalid family yaml: ${fpath}: ${err.message}`);
      continue;
    }
    if (!doc || typeof doc !== "object" || doc.apiVersion !== "bridger.family/v1") continue;
    const catalog = isRecord(doc.catalog) ? doc.catalog : {};
    out.push({
      id: typeof doc.id === "string" ? doc.id : fname.replace(/\.ya?ml$/, ""),
      title: catalog.title,
      description: catalog.description,
      status: typeof doc.status === "string" ? doc.status : "draft",
      members: Array.isArray(doc.members) ? doc.members.length : 0,
    });
  }
  return out;
}

function escapeMdxCell(s) {
  return String(s ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

/**
 * Operation summary used to distinguish duplicate table rows within a
 * category: operation summaries joined by "·", or operationIds when the
 * summaries are not distinctive, or the catalog id as a last resort.
 * @param {PresetInfo} preset
 * @param {boolean} useSummaries
 */
function operationSummaryText(preset, useSummaries) {
  const parts = useSummaries
    ? preset.operations
        .map((op) => op.summary || op.id)
        .map((text) => text?.trim())
        .filter(Boolean)
    : preset.operations.map((op) => op.id).filter(Boolean);
  return [...new Set(parts)].join(" · ") || preset.catalogId;
}

/**
 * Disambiguates rows that share a display name inside one category: the KO
 * tables may show several presets with the same data.go.kr title (cold/heat
 * impact forecasts, `-real` alias presets, ...). The locally curated
 * displayName keeps priority; duplicated rows get an operation summary
 * appended in parentheses.
 * @param {PresetInfo[]} presets
 * @param {string} locale
 */
function tableNames(presets, locale) {
  /** @type {{ preset: PresetInfo, name: string }[]} */
  const rows = presets.map((preset) => ({
    preset,
    name: localizedString(preset.displayName, locale) || preset.title,
  }));
  /** @type {Map<string, { preset: PresetInfo, name: string }[]>} */
  const groups = new Map();
  for (const row of rows) {
    const group = groups.get(row.name) ?? [];
    group.push(row);
    groups.set(row.name, group);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    let suffixes = group.map(({ preset }) => operationSummaryText(preset, true));
    if (new Set(suffixes).size !== group.length) {
      suffixes = group.map(({ preset }) => operationSummaryText(preset, false));
    }
    for (let i = 0; i < group.length; i += 1) {
      group[i].name = `${group[i].name} (${suffixes[i]})`;
    }
  }
  return rows;
}

/**
 * @param {string} category
 * @param {PresetInfo[]} presets
 * @param {typeof LOCALES.ko} L
 */
function renderCategoryMdx(category, presets, L) {
  const meta = CATEGORY_META[category];
  const total = presets.length;
  const totalOps = presets.reduce((acc, p) => acc + p.opCount, 0);

  const rows = tableNames(presets, L.locale)
    .map(({ preset, name }) => {
      const displayName = escapeMdxCell(name);
      const provider = escapeMdxCell(localizedString(preset.provider, L.locale) || "—");
      const ops = preset.opCount;
      const link = preset.dataGoKrId
        ? `[${escapeMdxCell(preset.dataGoKrId)}](https://www.data.go.kr/data/${preset.dataGoKrId}/openapi.do)`
        : "—";
      return `| ${displayName} | ${provider} | ${ops} | ${link} |`;
    })
    .join("\n");

  return `---
title: "${L.catTitle(meta)}"
description: "${L.catDesc(meta, total, totalOps)}"
---

${L.catIntro(total, totalOps)}

<Tip>
  ${L.tip}
</Tip>

${L.listHeading}

${L.tableHeader}
| --- | --- | --- | --- |
${rows}

${L.usageHeading}

<CodeGroup>
  \`\`\`${L.serverQueryLabel}
  ${L.serverQueryComment}
  curl https://api.bridger.kr/registry/servers \\
    | jq '.servers[] | select(.id | startswith("${category}/"))'
  \`\`\`

  \`\`\`${L.toolsListLabel}
  curl -X POST https://mcp.bridger.kr/mcp \\
    -H "x-api-key: $BRIDGER_API_KEY" \\
    -H "Content-Type: application/json" \\
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq '.result.tools[].name'
  \`\`\`
</CodeGroup>
`;
}

/**
 * @param {Array<{ category: string, total: number, totalOps: number }>} summary
 * @param {typeof LOCALES.ko} L
 * @param {FamilyInfo[]} families
 */
function renderIndexMdx(summary, L, families = []) {
  const grandTotal = summary.reduce((acc, s) => acc + s.total, 0);
  const grandOps = summary.reduce((acc, s) => acc + s.totalOps, 0);

  const familyRows = families
    .map((f) => {
      const name = escapeMdxCell(localizedString(f.title, L.locale) || f.id);
      const status = escapeMdxCell(L.statusLabel[f.status] ?? f.status);
      return `| \`${escapeMdxCell(f.id)}\` | ${name} | ${f.members} | ${status} |`;
    })
    .join("\n");
  const familiesSection = familyRows
    ? `\n${L.familiesHeading}\n\n${L.familiesIntro}\n\n${L.familiesTableHeader}\n| --- | --- | --- | --- |\n${familyRows}\n`
    : "";

  const cards = summary
    .map((s) => {
      const meta = CATEGORY_META[s.category];
      return `  <Card title="${L.catTitle(meta)}" href="${L.linkPrefix}/${s.category}">
    ${L.metaDesc(meta)}\\
    ${L.cardCount(s.total, s.totalOps)}
  </Card>`;
    })
    .join("\n");

  const rows = summary
    .map((s) => {
      const meta = CATEGORY_META[s.category];
      return `| [${L.catTitle(meta)}](${L.linkPrefix}/${s.category}) | ${s.total} | ${s.totalOps} |`;
    })
    .join("\n");

  return `---
title: "${L.indexTitle}"
description: "${L.indexDesc(summary.length, grandTotal, grandOps)}"
---

${L.indexIntro(grandTotal)}

<CardGroup cols={2}>
${cards}
</CardGroup>

${L.overviewHeading}

${L.overviewTableHeader}
| --- | --- | --- |
${rows}
${L.totalRow(grandTotal, grandOps)}
${familiesSection}
${L.quickHeading}

\`\`\`bash
curl -X POST https://mcp.bridger.kr/mcp \\
  -H "x-api-key: $BRIDGER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
\`\`\`
`;
}

function main() {
  let categories;
  try {
    categories = readdirSync(PRESETS_DIR)
      .filter((name) => {
        const p = join(PRESETS_DIR, name);
        return statSync(p).isDirectory() && CATEGORY_META[name];
      })
      .sort();
  } catch (err) {
    console.error(`[build-presets] cannot read ${PRESETS_DIR}: ${err.message}`);
    process.exit(1);
  }

  // Read each category once, reuse across locales.
  const byCategory = new Map();
  for (const category of categories) {
    byCategory.set(category, readCategory(join(PRESETS_DIR, category)));
  }

  // Apply preset category overrides after every category is read, so that
  // movement between sibling directories works regardless of order.
  /** @type {{ from: string, to: string, preset: PresetInfo }[]} */
  const moves = [];
  for (const [category, presets] of byCategory) {
    const kept = presets.filter((preset) => {
      const target = PRESET_CATEGORY_OVERRIDES.get(preset.catalogId);
      if (!target || target === category || !CATEGORY_META[target]) return true;
      moves.push({ from: category, to: target, preset });
      return false;
    });
    byCategory.set(category, kept);
  }
  for (const { from, to, preset } of moves) {
    const targetPresets = byCategory.get(to);
    (targetPresets ?? byCategory.get(from))?.push(preset);
  }
  for (const presets of byCategory.values()) {
    presets.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  }

  const summary = [];
  for (const category of categories) {
    const presets = byCategory.get(category);
    const totalOps = presets.reduce((acc, p) => acc + p.opCount, 0);
    summary.push({ category, total: presets.length, totalOps });
  }

  const families = readFamilies();
  if (families.length > 0) {
    console.log(`[build-presets] ${families.length} families loaded from ${FAMILIES_DIR}`);
  }

  for (const [locale, L] of Object.entries(LOCALES)) {
    const localeOutDir = join(REPO_ROOT, ...L.outSubdir.split("/"));
    mkdirSync(localeOutDir, { recursive: true });
    for (const category of categories) {
      const presets = byCategory.get(category);
      const mdx = renderCategoryMdx(category, presets, L);
      const out = join(localeOutDir, `${category}.mdx`);
      writeFileSync(out, mdx, "utf8");
      const totalOps = presets.reduce((acc, p) => acc + p.opCount, 0);
      console.log(
        `[build-presets] [${locale}] ${category.padEnd(15)} ${String(presets.length).padStart(3)} presets, ${String(totalOps).padStart(3)} ops -> ${out}`,
      );
    }
    const indexMdx = renderIndexMdx(summary, L, families);
    const indexOut = join(localeOutDir, "index.mdx");
    writeFileSync(indexOut, indexMdx, "utf8");
    console.log(`[build-presets] [${locale}] index -> ${indexOut}`);
  }

  const grandTotal = summary.reduce((acc, s) => acc + s.total, 0);
  const grandOps = summary.reduce((acc, s) => acc + s.totalOps, 0);
  console.log(
    `[build-presets] done: ${categories.length} categories, ${grandTotal} presets, ${grandOps} ops (ko + en)`,
  );
}

main();
