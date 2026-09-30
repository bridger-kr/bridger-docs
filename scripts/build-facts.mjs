#!/usr/bin/env node
// Sync docs.json `variables` from vendor/spec/facts/product-facts.json.
//
// Single source of truth: bridger-kr/bridger-spec -> vendor/spec submodule.
// Pages reference values as {mcpUrl}, {catalogTotal}, ... (Mintlify variables)
// instead of restating them, so web/docs/api cannot drift apart.
//
// catalogTotal is never written from the spec file: it is fetched live from the
// public catalog endpoint at build time (catalogCountSource === "api"). If the
// fetch fails but a previously fetched value exists in docs.json, it is kept.
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const FACTS_FILE = join(ROOT, 'vendor/spec/facts/product-facts.json');
const DOCS_JSON = join(ROOT, 'docs.json');
const FETCH_TIMEOUT_MS = 15_000;

const facts = JSON.parse(await readFile(FACTS_FILE, 'utf8'));
if (facts.catalogCountSource !== 'api') {
  console.error(`product-facts.json: unexpected catalogCountSource "${facts.catalogCountSource}" (expected "api").`);
  process.exit(2);
}

const catalogUrl = `${facts.catalog.governmentApisEndpoint}?limit=1`;
let catalogTotal = null;
try {
  const res = await fetch(catalogUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (typeof body.total === 'number') catalogTotal = String(body.total);
} catch (err) {
  console.warn(`[build-facts] catalog fetch failed (${err.message}) — keeping existing catalogTotal if present.`);
}

const docsJson = JSON.parse(await readFile(DOCS_JSON, 'utf8'));
const variables = { ...(docsJson.variables ?? {}) };
if (catalogTotal !== null) {
  variables.catalogTotal = catalogTotal;
} else if (typeof variables.catalogTotal !== 'string') {
  console.error(`[build-facts] no catalog total available and docs.json has none — cannot continue.`);
  process.exit(2);
}

Object.assign(variables, {
  apiBaseUrl: facts.domains.api,
  docsUrl: facts.domains.docs,
  landingUrl: facts.domains.landing,
  portalUrl: facts.domains.portal,
  supportEmail: facts.supportEmail,
  mcpUrl: facts.mcpUrl,
  mcpOpenaiUrl: facts.mcpProfiles.openai,
  mcpGeminiUrl: facts.mcpProfiles.gemini,
  mcpLegacySseUrl: facts.transports.legacySseAlias,
  oauthIssuer: facts.oauth.issuer,
  oauthDiscoveryUrl: facts.oauth.discovery,
  oauthRegistrationUrl: facts.oauth.registrationEndpoint,
  oauthPrmUrl: facts.oauth.protectedResourceMetadata,
  oauthScopes: facts.oauth.scopes.join(', '),
  apiKeyPrefix: facts.apiKey.prefix,
  oauthTokenPrefix: facts.oauthAccessTokenPrefix,
  loginProviders: facts.loginProviders.map((p) => (p === 'google' ? 'Google' : p === 'github' ? 'GitHub' : p)).join(' / '),
  metaTools: facts.toolNaming.metaTools.join(', '),
  activationAllParam: facts.toolNaming.activationAllParam,
  byoapiStatus: facts.byoapiStatus,
  byoapiRegisterUrl: facts.byoapi.registerEndpoint,
  byoapiStatusUrl: facts.byoapi.statusEndpoint,
});

docsJson.variables = variables;
await writeFile(DOCS_JSON, `${JSON.stringify(docsJson, null, 2)}\n`);
console.log(`[build-facts] docs.json variables synced (catalogTotal=${variables.catalogTotal}).`);
