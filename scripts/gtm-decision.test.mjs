import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {evaluateGtm, SUPPLIER_CHECKS} from './gtm-decision.mjs';

const blank = JSON.parse(readFileSync(new URL('../docs/gtm/evidence-template.json', import.meta.url)));
const at = (day) => `2026-10-${String(day).padStart(2, '0')}T09:00:00Z`;
function evidence() {
  const input = structuredClone(blank);
  input.evidence = 'synthetic';
  input.experiment.windowStart = at(1);
  input.experiment.asOf = at(30);
  input.experiment.participants = Array.from({length: 30}, (_, i) => ({
    id: `team_${String(i + 1).padStart(2, '0')}`, organization: `org_${String(i + 1).padStart(2, '0')}`,
    segment: i < 8 ? 'product_team' : 'automation_partner', bundle: i % 2 ? 'place_brief' : 'business_check',
    channel: i % 2 ? 'workflow_page' : 'ai_guide', consented: true, interviewAt: i < 12 ? at(2) : null,
    pilot: i < 4, firstAdoptedAt: i < 3 ? at(3) : null, adoptions: i < 2 ? [at(9), at(17)] : [],
    priceEvidence: i < 3 ? `evidence_${String(i + 1).padStart(2, '0')}` : null, dropout: 'none',
    evidenceRef: i < 12 ? 'evidence_01' : null, tool: i < 3 ? 'tool_01' : null, independenceReviewed: true,
  }));
  for (const supplier of input.suppliers.slice(0, 2)) {
    supplier.terms = {priceUnit: 'request', freshnessMaxAgeHours: 24,
      supportOwnerRef: 'owner_01', failurePolicy: 'not_charged_on_error'};
    for (const check of Object.values(supplier.checks)) Object.assign(check,
      {status: 'verified', evidenceRef: 'evidence_01', reviewedAt: at(4)});
  }
  return input;
}

test('pending template has no observations and cannot authorize any action', () => {
  const report = evaluateGtm(blank);
  assert.deepEqual(report.failures, []);
  assert.equal(report.totals.interviews, 0);
  assert.equal(report.publicExpansion, 'blocked');
  assert.equal(report.nextBatch, 'awaiting_30_team_selection');
  assert.ok(report.suppliers.every((s) => s.readiness === 'blocked'));
});

test('synthetic targets are separated from actual evidence and manual approval', () => {
  const report = evaluateGtm(evidence());
  assert.deepEqual(report.failures, []);
  assert.equal(report.nextBatch, 'continue');
  assert.equal(report.interviewTarget, 'target_met');
  assert.equal(report.pilotDecision, 'target_met');
  assert.equal(report.paidIntentTarget, 'target_met');
  assert.deepEqual(report.totals.repeat7, {eligible: 3, repeated: 2});
  assert.deepEqual(report.totals.repeat14, {eligible: 3, repeated: 2});
  assert.equal(report.suppliers[0].independentRepeatBuyers, 2);
  assert.equal(report.publicExpansion, 'blocked');
  const actual = evidence(); actual.evidence = 'actual';
  assert.equal(evaluateGtm(actual).publicExpansion, 'eligible_for_manual_review');
});

test('a 14-day cohort is required; young first success is excluded from repeat denominators', () => {
  const input = evidence();
  input.experiment.asOf = at(14);
  input.experiment.participants.forEach((p) => {p.adoptions = [];});
  const report = evaluateGtm(input);
  assert.equal(report.nextBatch, 'awaiting_day14');
  assert.deepEqual(report.totals.repeat14, {eligible: 0, repeated: 0});
  input.experiment.participants[0].firstAdoptedAt = at(13);
  assert.equal(evaluateGtm(input).totals.repeat7.eligible, 2);
});

test('first batch under 3 interviews gets exactly one revision then stop/pivot', () => {
  const input = evidence();
  input.experiment.participants.slice(2).forEach((p) => Object.assign(p,
    {interviewAt: null, pilot: false, firstAdoptedAt: null, adoptions: [], priceEvidence: null}));
  assert.equal(evaluateGtm(input).nextBatch, 'revise_once');
  input.experiment.revision = 1;
  assert.equal(evaluateGtm(input).nextBatch, 'stop_or_pivot');
});

test('middle-band evidence narrows rather than declaring success; recent tasks do not inflate day14', () => {
  const input = evidence();
  input.experiment.participants.slice(5).forEach((p) => {p.interviewAt = null;});
  assert.equal(evaluateGtm(input).nextBatch, 'narrow_before_next_batch');
  input.experiment.participants[2].firstAdoptedAt = at(20);
  input.experiment.participants.slice(5, 12).forEach((p) => {p.interviewAt = at(20);});
  assert.equal(evaluateGtm(input).first14.interviews, 5);
  assert.equal(evaluateGtm(input).first14.adoptedTasks, 2);
});

test('two accounts in one organization or absent independence evidence do not meet two buyers', () => {
  const input = evidence(); input.evidence = 'actual';
  input.experiment.participants[1].organization = 'org_01';
  assert.equal(evaluateGtm(input).suppliers[0].independentRepeatBuyers, 1);
  assert.equal(evaluateGtm(input).publicExpansion, 'blocked');
  input.experiment.participants[1].organization = 'org_02';
  input.experiment.participants[1].independenceReviewed = false;
  assert.equal(evaluateGtm(input).publicExpansion, 'blocked');
});

test('no second-week reuse or using a different tool cannot unlock expansion', () => {
  const input = evidence(); input.evidence = 'actual';
  input.experiment.participants[1].adoptions = [at(9)];
  assert.equal(evaluateGtm(input).publicExpansion, 'blocked');
  input.experiment.participants[1].adoptions = [at(9), at(17)];
  input.experiment.participants[1].tool = 'tool_02';
  assert.equal(evaluateGtm(input).publicExpansion, 'blocked');
});

for (const key of SUPPLIER_CHECKS) {
  test(`missing ${key} evidence blocks the reused supplier`, () => {
    const input = evidence(); input.evidence = 'actual';
    input.suppliers[0].checks[key] = {status: 'pending', evidenceRef: null, reviewedAt: null};
    assert.equal(evaluateGtm(input).publicExpansion, 'blocked');
    input.suppliers[0].checks[key].status = 'rejected';
    assert.ok(evaluateGtm(input).failures.length > 0);
  });
}

test('missing commercial/support metadata or reviewer evidence blocks readiness', () => {
  const input = evidence(); input.evidence = 'actual';
  input.suppliers[0].terms.priceUnit = null;
  assert.equal(evaluateGtm(input).publicExpansion, 'blocked');
  input.suppliers[0].checks.rights_license.evidenceRef = null;
  assert.ok(evaluateGtm(input).failures.includes('check_evidence'));
  const undated = evidence();
  undated.suppliers[0].checks.rights_license.reviewedAt = null;
  assert.ok(evaluateGtm(undated).failures.includes('check_evidence'));
  const unknown = evidence();
  unknown.suppliers[0].checks.rights_license.evidenceRef = 'team_01';
  assert.ok(evaluateGtm(unknown).failures.includes('check_schema'));
});

test('raw fields, nonconsent observations, future repeats, duplicates and overlarge pilots fail closed', () => {
  const input = evidence(); input.experiment.participants[0].address = 'not allowed';
  assert.ok(evaluateGtm(input).failures.includes('participant_schema'));
  const denied = evidence(); denied.experiment.participants[0].consented = false;
  assert.ok(evaluateGtm(denied).failures.includes('unconsented_evidence'));
  const future = evidence(); future.experiment.participants[0].adoptions.push('2027-01-01T09:00:00Z');
  assert.ok(evaluateGtm(future).failures.includes('repeat_time'));
  const duplicate = evidence(); duplicate.experiment.participants[1].id = 'team_01';
  assert.ok(evaluateGtm(duplicate).failures.includes('cohort_size_or_duplicate'));
  const over = evidence(); over.experiment.participants.slice(0, 12).forEach((p) => {p.pilot = true;});
  assert.ok(evaluateGtm(over).failures.includes('pilot_bundle_cap'));
  assert.equal(evaluateGtm({evidence: 'raw-secret'}).evidence, 'pending');
});
