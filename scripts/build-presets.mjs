#!/usr/bin/env node
/**
 * build-presets.mjs
 *
 * Parses presets/{category}/*.yaml at the repo root and writes one MDX page
 * per category to apps/docs/content/presets/{category}.mdx, plus a master
 * index at apps/docs/content/presets/index.mdx.
 *
 * Idempotent: rewrites every file from scratch on each run.
 *
 * NOTE: This is a DEV-TIME generator. Output MDX is committed to the repo
 * and consumed directly by `mint export` at container build time.
 *   - Run locally: `npm run build:content` (after editing presets/*.yaml)
 *   - The Docker build (`apps/docs/Dockerfile`) does NOT execute this script
 *     because the `presets/` source tree lives at repo root, outside the
 *     `apps/docs/` build context. Re-running it inside the container would
 *     also produce no diff (since output is already committed).
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const PRESETS_DIR = join(REPO_ROOT, "presets");
const OUT_DIR = join(REPO_ROOT, "apps", "docs", "content", "presets");

const CATEGORY_META = {
  civil:          { title: "행정 · 민원",   icon: "building-columns", desc: "행정 · 민원 · 인구 · 치안 · 재난 · 공공시설 데이터." },
  culture:        { title: "문화 · 관광",   icon: "masks-theater",     desc: "축제, 관광지, 도서관, 공연, 문화유산 데이터." },
  economy:        { title: "경제 · 금융",   icon: "chart-line",        desc: "환율, 금리, 지표, 소비, 수출입, 시장 통계." },
  education:      { title: "교육",          icon: "graduation-cap",    desc: "학교, 대학, 교육 통계, 학사 데이터." },
  environment:    { title: "환경",          icon: "leaf",              desc: "대기질, 수질, 소음, 진동, 폐기물, 라돈 데이터." },
  food:           { title: "식품 · 농축산", icon: "wheat-awn",         desc: "식품 안전, 농축산물 가격·생산, 수산물 데이터." },
  land:           { title: "국토 · 토지",   icon: "map",               desc: "지적, 건축 인허가, 도시계획, 국토 통계." },
  law:            { title: "법률 · 행정",   icon: "scale-balanced",    desc: "법령, 판례, 행정심판, 규제 정보." },
  realestate:     { title: "부동산",        icon: "house",             desc: "아파트·오피스텔 실거래, 전월세, 지적·건축 인허가." },
  safety:         { title: "안전 · 재난",   icon: "shield-halved",     desc: "재난 경보, 안전 지표, 응급 상황 데이터." },
  science:        { title: "과학 · 기술",   icon: "atom",              desc: "연구 통계, 특허, 과학 기술 지표." },
  transportation: { title: "교통",          icon: "bus",               desc: "버스, 지하철, 항공, 철도, 주차, 도로 교통 데이터." },
  weather:        { title: "기상",          icon: "cloud-sun-rain",    desc: "예보, 경보, 레이더, 자외선, 태풍 데이터." },
  welfare:        { title: "복지 · 의료",   icon: "hand-holding-medical", desc: "병원, 약국, 응급실, 돌봄, 백신, 복지시설 데이터." },
};

/** @typedef {{ title: string, description: string, provider?: string, displayName?: string, isPublicData: boolean, opCount: number, dataGoKrId?: string, file: string }} PresetInfo */

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
    const xpd = doc["x-publicdata"] ?? {};
    const isPublicData =
      xpd && typeof xpd === "object" && Object.keys(xpd).length > 0 ? true : false;
    const opCount = doc.paths
      ? Object.values(doc.paths).reduce((acc, methods) => {
          if (!methods || typeof methods !== "object") return acc;
          return acc + Object.keys(methods).filter((k) =>
            ["get", "post", "put", "delete", "patch", "head", "options"].includes(
              String(k).toLowerCase(),
            ),
          ).length;
        }, 0)
      : 0;

    out.push({
      title: typeof info.title === "string" ? info.title : fname,
      description:
        typeof info.description === "string"
          ? info.description.split("\n")[0].trim()
          : "",
      provider:
        typeof xpd.provider === "string" ? xpd.provider : undefined,
      displayName:
        typeof xpd.displayName === "string" ? xpd.displayName : undefined,
      dataGoKrId:
        typeof xpd.dataGoKrId === "string" ? xpd.dataGoKrId : undefined,
      isPublicData,
      opCount,
      file: fname,
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
 * @param {string} category
 * @param {PresetInfo[]} presets
 */
function renderCategoryMdx(category, presets) {
  const meta = CATEGORY_META[category];
  const total = presets.length;
  const totalOps = presets.reduce((acc, p) => acc + p.opCount, 0);

  const rows = presets
    .map((p) => {
      const name = escapeMdxCell(p.displayName || p.title);
      const provider = escapeMdxCell(p.provider || "—");
      const ops = p.opCount;
      const file = `presets/${category}/${p.file}`;
      const link = p.dataGoKrId
        ? `[${escapeMdxCell(p.dataGoKrId)}](https://www.data.go.kr/data/${p.dataGoKrId}/openapi.do)`
        : "—";
      return `| ${name} | ${provider} | ${ops} | ${link} | \`${file}\` |`;
    })
    .join("\n");

  return `---
title: "${meta.title}"
description: "${meta.desc} 총 ${total}개 프리셋 · ${totalOps}개 도구."
---

이 카테고리에는 **${total}개의 프리셋**이 등록되어 있으며, 합산 **${totalOps}개의 MCP 도구**가 노출됩니다.

<Tip>
  특정 도구만 사용하고 싶다면 \`mcp-gen install ${category}/<preset-name>\` 형식으로 개별 설치할 수 있습니다.
  아래 표의 **파일** 컬럼이 \`<preset-name>\` 입니다.
</Tip>

## 프리셋 목록

| 이름 | 제공기관 | 도구 수 | data.go.kr | 파일 |
| --- | --- | --- | --- | --- |
${rows}

## 사용 예시

<CodeGroup>
  \`\`\`bash mcp-gen
  # 카테고리 전체 설치
  mcp-gen install ${category}

  # 특정 프리셋만 설치
  mcp-gen install ${category}/<preset-name>
  \`\`\`

  \`\`\`bash 호스팅 Gateway
  curl -X POST https://mcp.datari.kr/mcp \\
    -H "x-api-key: $DATARI_API_KEY" \\
    -H "Content-Type: application/json" \\
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq '.result.tools[] | select(.name | startswith("@mcphub/${category}-"))'
  \`\`\`
</CodeGroup>

<Note>
  이 페이지는 \`apps/docs/scripts/build-presets.mjs\`가 \`presets/${category}/\*.yaml\`을
  스캔하여 자동 생성합니다. 직접 수정하지 마세요.
</Note>
`;
}

/**
 * @param {Array<{ category: string, total: number, totalOps: number }>} summary
 */
function renderIndexMdx(summary) {
  const grandTotal = summary.reduce((acc, s) => acc + s.total, 0);
  const grandOps = summary.reduce((acc, s) => acc + s.totalOps, 0);

  const cards = summary
    .map((s) => {
      const meta = CATEGORY_META[s.category];
      return `  <Card title="${meta.title}" icon="${meta.icon}" href="/content/presets/${s.category}">
    ${meta.desc}\\
    **${s.total}개 프리셋 · ${s.totalOps}개 도구**
  </Card>`;
    })
    .join("\n");

  const rows = summary
    .map((s) => {
      const meta = CATEGORY_META[s.category];
      return `| [${meta.title}](/content/presets/${s.category}) | ${s.total} | ${s.totalOps} |`;
    })
    .join("\n");

  return `---
title: "카탈로그 인덱스"
description: "datari가 제공하는 ${summary.length}개 카테고리 · ${grandTotal}개 프리셋 · ${grandOps}개 도구의 전체 인덱스."
---

datari는 공공·민간 OpenAPI를 카테고리별로 정리한 **${grandTotal}개의 프리셋**을 제공합니다.
한 번 설치하면 카테고리 안의 모든 도구를 \`mcp-gen\` CLI 또는 \`mcp.datari.kr\` 호스팅 Gateway에서 즉시 호출할 수 있습니다.

<CardGroup cols={2}>
${cards}
</CardGroup>

## 한눈에 보기

| 카테고리 | 프리셋 수 | 도구 수 |
| --- | --- | --- |
${rows}
| **합계** | **${grandTotal}** | **${grandOps}** |

## 빠른 사용

\`\`\`bash
# 전체 목록 확인
mcp-gen list

# 카테고리별 필터
mcp-gen list --category weather

# 키워드 검색
mcp-gen search 날씨

# 카테고리 단위 설치
mcp-gen install weather
\`\`\`

<Note>
  이 페이지는 \`apps/docs/scripts/build-presets.mjs\`가 \`presets/\*\*/\*.yaml\`을
  스캔하여 자동 생성합니다. 직접 수정하지 마세요.
</Note>
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

  const summary = [];
  for (const category of categories) {
    const presets = readCategory(join(PRESETS_DIR, category));
    const totalOps = presets.reduce((acc, p) => acc + p.opCount, 0);
    summary.push({ category, total: presets.length, totalOps });
    const mdx = renderCategoryMdx(category, presets);
    const out = join(OUT_DIR, `${category}.mdx`);
    writeFileSync(out, mdx, "utf8");
    console.log(
      `[build-presets] ${category.padEnd(15)} ${String(presets.length).padStart(3)} presets, ${String(totalOps).padStart(3)} ops -> ${out}`,
    );
  }

  const indexMdx = renderIndexMdx(summary);
  const indexOut = join(OUT_DIR, "index.mdx");
  writeFileSync(indexOut, indexMdx, "utf8");
  console.log(`[build-presets] index -> ${indexOut}`);

  const grandTotal = summary.reduce((acc, s) => acc + s.total, 0);
  const grandOps = summary.reduce((acc, s) => acc + s.totalOps, 0);
  console.log(
    `[build-presets] done: ${categories.length} categories, ${grandTotal} presets, ${grandOps} ops`,
  );
}

main();
