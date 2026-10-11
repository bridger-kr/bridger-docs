import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validateWorkflowFixture, OUTCOME} from './workflow-contract.mjs';

export function checkFixtures(fixtures, sources) {
  if (!Array.isArray(fixtures)) return {evidence: 'synthetic_only', total: 0, schemaValid: 0,
    failures: [{reason: 'fixture_list'}], liveProviderCalls: 0};
  const validations = fixtures.map((fixture) => validateWorkflowFixture(fixture, sources));
  const failures = validations.flatMap((errors, index) => errors.map((reason) => ({
    id: typeof fixtures[index]?.id === 'string' && /^synthetic-\d{2}$/.test(fixtures[index].id) ? fixtures[index].id : null,
    reason,
  })));
  if (fixtures.length !== 50 || new Set(fixtures.map((f) => f?.id)).size !== 50) failures.push({reason: 'count_or_duplicates'});
  for (const bundle of ['business_check', 'place_brief']) {
    if (fixtures.filter((f) => f?.bundle === bundle).length !== 25) failures.push({reason: 'bundle_count'});
    for (const outcome of Object.values(OUTCOME)) {
      if (!fixtures.some((f) => f?.bundle === bundle && f.outcome === outcome)) failures.push({reason: 'outcome_coverage'});
    }
  }
  return {evidence: 'synthetic_only', total: fixtures.length,
    schemaValid: validations.filter((errors) => errors.length === 0).length,
    failures, liveProviderCalls: 0};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fixtures = JSON.parse(readFileSync(new URL('../docs/gtm/workflow-fixtures.json', import.meta.url)));
  const sources = JSON.parse(readFileSync(new URL('../docs/gtm/workflow-sources.json', import.meta.url)));
  const report = checkFixtures(fixtures, sources);
  console.log(JSON.stringify(report, null, 2));
  if (report.failures.length) process.exitCode = 1;
}
