import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {checkFixtures} from './check-workflow-fixtures.mjs';
import {validateWorkflowFixture} from './workflow-contract.mjs';

const fixtures = JSON.parse(readFileSync(new URL('../docs/gtm/workflow-fixtures.json', import.meta.url)));
const sources = JSON.parse(readFileSync(new URL('../docs/gtm/workflow-sources.json', import.meta.url)));

test('50 independent normalized scenarios, 25 per bundle, all valid and offline', () => {
  const report = checkFixtures(fixtures, sources);
  assert.equal(report.schemaValid, 50);
  assert.deepEqual(report.failures, []);
  assert.equal(new Set(fixtures.map((f) => `${f.bundle}:${f.scenario}`)).size, 50);
  assert.equal(report.liveProviderCalls, 0);
  assert.ok(fixtures.every((f) => f.evidence === 'synthetic' && !f.adopted));
});

for (const mutation of ['missing_source', 'missing_asof', 'missing_unavailable', 'false_success', 'false_adoption', 'raw_input',
  'wrong_source', 'duplicate_component', 'invalid_date', 'missing_component', 'invalid_rows', 'missing_rows', 'missing_requested']) {
  test(`reject ${mutation} instead of accepting invalid evidence`, () => {
    const f = structuredClone(fixtures[5]);
    const c = f.components[1];
    switch (mutation) {
      case 'missing_source': delete c.source; break;
      case 'missing_asof': delete c.asOf; break;
      case 'missing_unavailable': delete c.unavailable; break;
      case 'false_success': f.outcome = 'success'; break;
      case 'false_adoption': f.adopted = true; break;
      case 'raw_input': f.rawQuery = 'not allowed'; break;
      case 'wrong_source': c.source = 'air_korea'; break;
      case 'duplicate_component': f.components.push(c); break;
      case 'invalid_date': f.components[0].asOf = '2026-02-30T00:00:00Z'; break;
      case 'missing_component': f.components.pop(); break;
      case 'invalid_rows': c.rows = {sample: 1}; break;
      case 'missing_rows': c.rows = null; break;
      case 'missing_requested': f.requested = null; break;
    }
    assert.ok(validateWorkflowFixture(f, sources).length > 0);
  });
}

test('the corpus gate rejects duplicates/count loss and lost outcome coverage', () => {
  assert.ok(checkFixtures(fixtures.slice(1), sources).failures.length);
  assert.ok(checkFixtures(fixtures.map((f) => ({...f, id: 'synthetic-01'})), sources).failures.length);
  assert.ok(checkFixtures(fixtures.filter((f) => f.outcome !== 'error'), sources).failures.length);
});

for (const mutation of ['array_id', 'array_bundle', 'array_source', 'inherited_bundle', 'null_sources']) {
  test(`malformed ${mutation} produces a diagnostic instead of accepting or throwing`, () => {
    const f = structuredClone(fixtures[0]);
    let registry = sources;
    switch (mutation) {
      case 'array_id': f.id = [f.id]; break;
      case 'array_bundle': f.bundle = [f.bundle]; break;
      case 'array_source': f.components[0].source = [f.components[0].source]; break;
      case 'inherited_bundle': f.bundle = 'constructor'; break;
      case 'null_sources': registry = null; break;
    }
    assert.ok(validateWorkflowFixture(f, registry).length > 0);
  });
}

test('invalid corpus entries are diagnosed without echoing unvalidated identities', () => {
  for (const input of [null, {}, [null], [{id: 'private-customer-value'}]]) {
    const report = checkFixtures(input, sources);
    assert.ok(report.failures.length > 0);
    assert.equal(report.schemaValid, 0);
    assert.doesNotMatch(JSON.stringify(report), /private-customer-value/);
  }
});
