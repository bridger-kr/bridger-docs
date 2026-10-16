#!/usr/bin/env node
// EDD-414: public examples must match the deployed MCP contract, not a
// generator's future naming convention. No tools are executed.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export async function listTools(endpoint, request = fetch) {
  const url = new URL(endpoint);
  url.searchParams.set('activation', 'all');
  const tools = new Map();
  const cursors = new Set();
  let cursor;
  do {
    const response = await request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: cursor ? { cursor } : {} }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`tools/list HTTP ${response.status}`);
    const body = await response.text();
    const payload = response.headers.get('content-type')?.includes('text/event-stream')
      ? body.split(/\r?\n\r?\n/).map(event => event.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')).filter(Boolean).map(data => JSON.parse(data)).find(message => message.id === 1)
      : JSON.parse(body);
    if (payload?.error || !Array.isArray(payload?.result?.tools)) throw new Error(`Invalid tools/list response: ${JSON.stringify(payload?.error)}`);
    for (const tool of payload.result.tools) tools.set(tool.name, tool);
    cursor = payload.result.nextCursor;
    if (cursor && cursors.has(cursor)) throw new Error('Repeated tools/list cursor');
    cursors.add(cursor);
  } while (cursor);
  if (!tools.size) throw new Error('Empty tools/list response');
  return tools;
}

export function checkExamples(source, tools) {
  // Landing mockups store each command line as a quoted array entry.
  source = source.replace(/^[ \t]*'((?:[^'\\]|\\.)*)',?[ \t]*$/gm, (_, line) => line.replace(/\\'/g, "'"));
  const errors = [];
  const report = (offset, message) => errors.push(`${source.slice(0, offset).split('\n').length}: ${message}`);
  // Provider-prefixed names anywhere, plus callable identifiers in code/prose.
  // Fictional BYOAPI examples (listpets/pingtool) are intentionally separate.
  const references = /\b(?:kma|molit|nts|keco)_[a-z0-9_]+\b|["'`](get[a-z0-9]{5,}|validatebusinessregistration|search_tools)["'`]/g;
  for (const match of source.matchAll(references)) {
    const name = match[1] ?? match[0];
    if (!tools.has(name)) report(match.index, `${name} is absent from live tools/list`);
  }
  const fictional = new Set(['listpets', 'getpetbyid', 'pingtool']);
  // Explicit tool fields and tools/list descriptors also cover operation names
  // outside the providers/get* examples above. Client names lack a schema or
  // arguments in their own object and are not MCP tool references.
  const fields = /["']?(name|tool|toolName)["']?\s*:\s*["']([a-z][a-z0-9_-]*)["']/g;
  for (const match of source.matchAll(fields)) {
    const [, field, name] = match;
    const rest = source.slice(match.index + match[0].length);
    const ownObject = rest.slice(0, rest.indexOf('}') < 0 ? 0 : rest.indexOf('}'));
    if (field === 'name' && !/\b(?:inputSchema|arguments)\b/.test(ownObject)) continue;
    if (!fictional.has(name) && !tools.has(name)) report(match.index, `${name} is absent from live tools/list`);
  }
  // Flat JSON/JS/Python argument objects used by the weather SDK examples.
  const calls = /["']?name["']?\s*:\s*["']([a-z0-9_]+)["']\s*,\s*["']?arguments["']?\s*:\s*\{([^{}]*)\}|call_tool\(\s*["']([a-z0-9_]+)["']\s*,\s*arguments\s*=\s*\{([^{}]*)\}/g;
  for (const match of source.matchAll(calls)) {
    const name = match[1] ?? match[3];
    const schema = tools.get(name)?.inputSchema;
    if (!schema) {
      if (!fictional.has(name)) report(match.index, `${name} is absent from live tools/list`);
      continue;
    }
    const keys = new Set([...(match[2] ?? match[4]).matchAll(/(?:["']([^"']+)["']|\b([A-Za-z_][\w]*))\s*:/g)].map(key => key[1] ?? key[2]));
    for (const key of schema.required ?? []) {
      if (!keys.has(key)) report(match.index, `${name} missing required argument ${key}`);
    }
    for (const key of keys) {
      if (!(key in (schema.properties ?? {}))) report(match.index, `${name} unknown argument ${key}`);
    }
  }
  return errors;
}

export async function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const tools = await listTools(process.env.MCP_EXAMPLES_ENDPOINT ?? 'https://mcp.bridger.kr/mcp');
  const files = execFileSync('git', ['ls-files', '*.mdx', 'landing/src/**/*.js', 'landing/src/**/*.jsx'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(file => file && !file.startsWith('vendor/'));
  const errors = files.flatMap(file => checkExamples(readFileSync(resolve(root, file), 'utf8'), tools).map(error => `${file}:${error}`));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`verify-live-tools: OK — ${files.length} files checked against ${tools.size} deployed tools`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
