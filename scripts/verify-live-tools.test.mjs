import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkExamples, listTools } from './verify-live-tools.mjs';

const tool = { name: 'getvillageforecast', inputSchema: { required: ['base_date', 'nx'], properties: { base_date: { type: 'string' }, nx: { type: 'integer' } } } };
const tools = new Map([[tool.name, tool]]);
test('rejects undeployed prefixed names in prose and bare unknown names in payloads', () => {
  assert.match(checkExamples('`kma_get_village_forecast`', tools).join(), /absent/);
  assert.match(checkExamples('name: "getunknownforecast"', tools).join(), /absent/);
  assert.match(checkExamples('{name: "unknownoperation", inputSchema: {}}', tools).join(), /absent/);
  assert.match(checkExamples('{toolName: "unknownoperation"}', tools).join(), /absent/);
  assert.deepEqual(checkExamples('new Client({name: "my-app", version: "1.0"})', tools), []);
});
test('checks JSON, JS and Python call arguments against live required/properties', () => {
  for (const source of [
    '"name": "getvillageforecast", "arguments": {"city": "Seoul", "nx": 60}',
    'name: "getvillageforecast", arguments: { city: "Seoul", nx: 60 }',
    'session.call_tool("getvillageforecast", arguments={"city": "Seoul", "nx": 60})',
  ]) {
    const errors = checkExamples(source, tools).join();
    assert.match(errors, /missing required argument base_date/);
    assert.match(errors, /unknown argument city/);
  }
  assert.deepEqual(checkExamples('name: "getvillageforecast", arguments: {base_date: "20261016", nx: 60}', tools), []);
  assert.deepEqual(checkExamples('name: "listpets", arguments: {}', tools), []);
  assert.deepEqual(checkExamples('name: "getpetbyid", arguments: {}', tools), []);
  assert.match(checkExamples(`'  "name": "getvillageforecast",',\n'  "arguments": {"city": "Seoul"}',`, tools).join(), /missing required argument/);
});
test('fetches activation=all and follows pagination for JSON and SSE', async () => {
  let calls = 0;
  const result = await listTools('https://example.test/mcp?other=1', async (url, options) => {
    assert.equal(url.searchParams.get('activation'), 'all');
    assert.equal(url.searchParams.get('other'), '1');
    const body = JSON.parse(options.body);
    assert.equal(body.method, 'tools/list');
    calls++;
    if (calls === 1) return new Response(JSON.stringify({ result: { tools: [tool], nextCursor: 'next' } }));
    assert.equal(body.params.cursor, 'next');
    return new Response('event: message\r\ndata: {"id":1,"result":{"tools":[{"name":"search_tools"}]}}\r\n\r\n', { headers: { 'content-type': 'text/event-stream' } });
  });
  assert.equal(calls, 2);
  assert.equal(result.size, 2);
});
test('fails closed on unavailable, erroneous or empty catalogs', async () => {
  for (const response of [new Response('', { status: 503 }), new Response('{"error":{"message":"denied"}}'), new Response('{"result":{"tools":[]}}')]) {
    await assert.rejects(listTools('https://example.test/mcp', async () => response));
  }
});
