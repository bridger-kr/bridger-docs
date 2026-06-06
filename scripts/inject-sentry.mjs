import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_ENVIRONMENT = 'production';
const DEFAULT_RELEASE = 'local';
const DEFAULT_SERVICE = 'datari-docs';
const DEFAULT_TRACES_SAMPLE_RATE = 0.02;
const DEFAULT_SDK_URL = 'https://browser.sentry-cdn.com/10.56.0/bundle.tracing.min.js';

export function injectSentryIntoHtml(html, config) {
  if (!config.enabled || html.includes('data-datari-sentry-loader')) {
    return html;
  }

  const snippet = buildSentrySnippet(config);
  if (html.includes('</head>')) {
    return html.replace('</head>', `${snippet}\n</head>`);
  }
  return `${snippet}\n${html}`;
}

function buildSentrySnippet(config) {
  const initConfig = {
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    sendDefaultPii: false,
    tracesSampleRate: config.tracesSampleRate,
    tracePropagationTargets: [
      /^https:\/\/api\.datari\.kr\/?/.source,
      /^https:\/\/mcp\.datari\.kr\/?/.source,
      /^https:\/\/api\.bridger\.kr\/?/.source,
      /^https:\/\/mcp\.bridger\.kr\/?/.source,
    ],
  };

  return [
    `<script data-datari-sentry-loader src="${escapeHtml(config.sdkUrl)}" crossorigin="anonymous"></script>`,
    '<script data-datari-sentry-loader>',
    '(function () {',
    '  if (!window.Sentry) return;',
    `  var config = ${JSON.stringify(initConfig)};`,
    '  config.integrations = [window.Sentry.browserTracingIntegration()];',
    '  config.tracePropagationTargets = config.tracePropagationTargets.map(function (pattern) { return new RegExp(pattern); });',
    '  config.beforeSend = function (event) {',
    `    event.tags = Object.assign({}, event.tags, { service: ${JSON.stringify(config.service)} });`,
    '    return event;',
    '  };',
    '  window.Sentry.init(config);',
    '}());',
    '</script>',
  ].join('\n');
}

export function resolveSentryConfig(env) {
  const dsn = trimEnv(env.SENTRY_DSN);
  if (dsn === '') {
    return { enabled: false };
  }

  return {
    enabled: true,
    dsn,
    environment: trimEnv(env.SENTRY_ENVIRONMENT) || DEFAULT_ENVIRONMENT,
    release: trimEnv(env.SENTRY_RELEASE) || trimEnv(env.BUILD_REVISION) || DEFAULT_RELEASE,
    service: trimEnv(env.SENTRY_SERVICE) || DEFAULT_SERVICE,
    sdkUrl: trimEnv(env.SENTRY_BROWSER_SDK_URL) || DEFAULT_SDK_URL,
    tracesSampleRate: parseTraceSampleRate(env.SENTRY_TRACES_SAMPLE_RATE),
  };
}

async function injectDirectory(rootDir, config) {
  const htmlFiles = await collectHtmlFiles(rootDir);
  let changed = 0;
  for (const filePath of htmlFiles) {
    const html = await readFile(filePath, 'utf8');
    const next = injectSentryIntoHtml(html, config);
    if (next !== html) {
      await writeFile(filePath, next);
      changed += 1;
    }
  }
  return changed;
}

async function collectHtmlFiles(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const childPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectHtmlFiles(childPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(childPath);
    }
  }
  return files;
}

function trimEnv(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseTraceSampleRate(rawValue) {
  const value = trimEnv(rawValue);
  if (value === '') {
    return DEFAULT_TRACES_SAMPLE_RATE;
  }
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return DEFAULT_TRACES_SAMPLE_RATE;
  }
  return parsed;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , siteDir] = process.argv;
  if (!siteDir) {
    console.error('Usage: node scripts/inject-sentry.mjs <site-dir>');
    process.exit(1);
  }

  const config = resolveSentryConfig(process.env);
  const changed = await injectDirectory(path.resolve(siteDir), config);
  console.log(`Sentry docs injection: enabled=${config.enabled} html_changed=${changed}`);
}
