import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export const EVIDENCE = Object.freeze({Pending: 'pending', Synthetic: 'synthetic', Actual: 'actual'});
export const CHECK_STATUS = Object.freeze({Pending: 'pending', Verified: 'verified', Rejected: 'rejected'});
export const SUPPLIER_CHECKS = Object.freeze([
  'rights_license', 'schema', 'fixture', 'pii', 'freshness', 'price_unit',
  'failure_policy', 'support_owner', 'contract', 'security', 'legal', 'kyc', 'seller_tax', 'psp',
]);
const DAY = 86400000;
const BUNDLES = ['business_check', 'place_brief'];
const CHANNELS = ['workflow_page', 'ai_guide'];
const time = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().replace('.000', '') === value;
const ref = (value) => typeof value === 'string' && /^evidence_\d{2,4}$/.test(value);
const keys = (value, names) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === [...names].sort().join(',');
const dateInWindow = (date, start, end) => time(date) && time(start) && time(end)
  && Date.parse(date) >= Date.parse(start) && Date.parse(date) <= Date.parse(end);
const repeatAt = (participant, day, asOf) => participant.adoptions.some((date) => dateInWindow(date, participant.firstAdoptedAt, asOf)
  && Date.parse(date) > Date.parse(participant.firstAdoptedAt) + (day - 7) * DAY
  && Date.parse(date) <= Date.parse(participant.firstAdoptedAt) + day * DAY);
const mature = (participant, day, asOf) => participant.consented && time(participant.firstAdoptedAt)
  && Date.parse(asOf) >= Date.parse(participant.firstAdoptedAt) + day * DAY;

export function validateEvidence(input, {now = Date.now()} = {}) {
  const failures = [];
  if (!keys(input, ['version', 'evidence', 'experiment', 'suppliers'])) return ['envelope'];
  if (input.version !== 1 || !Object.values(EVIDENCE).includes(input.evidence)) failures.push('version_or_evidence');
  const experiment = input.experiment;
  if (!keys(experiment, ['windowStart', 'asOf', 'revision', 'participants'])
    || ![0, 1].includes(experiment.revision) || !Array.isArray(experiment.participants)) return [...failures, 'experiment'];
  if ((experiment.windowStart !== null && !time(experiment.windowStart))
    || (experiment.asOf !== null && !time(experiment.asOf))
    || ((experiment.windowStart === null) !== (experiment.asOf === null))
    || (experiment.asOf && Date.parse(experiment.asOf) < Date.parse(experiment.windowStart))) failures.push('window');
  if (input.evidence === EVIDENCE.Actual && time(experiment.asOf)
    && (!Number.isFinite(now) || Date.parse(experiment.asOf) > now)) failures.push('future_actual_window');
  if (experiment.participants.length > 30
    || new Set(experiment.participants.map((p) => p?.id)).size !== experiment.participants.length) failures.push('cohort_size_or_duplicate');
  for (const p of experiment.participants) {
    if (!keys(p, ['id', 'organization', 'segment', 'bundle', 'channel', 'consented', 'interviewAt', 'pilot', 'firstAdoptedAt',
      'adoptions', 'priceEvidence', 'dropout', 'evidenceRef', 'tool', 'independenceReviewed'])
      || !/^team_\d{2,4}$/.test(p.id) || !/^org_\d{2,4}$/.test(p.organization)
      || !BUNDLES.includes(p.bundle) || !CHANNELS.includes(p.channel)
      || !['product_team', 'automation_partner'].includes(p.segment)
      || ![p.consented, p.pilot, p.independenceReviewed].every((flag) => typeof flag === 'boolean')
      || !['none', 'no_need', 'no_permission', 'key_cost', 'support', 'declined', 'other'].includes(p.dropout)
      || !Array.isArray(p.adoptions) || new Set(p.adoptions).size !== p.adoptions.length
      || (p.tool !== null && !/^tool_\d{2,4}$/.test(p.tool))
      || (p.priceEvidence !== null && !ref(p.priceEvidence)) || (p.evidenceRef !== null && !ref(p.evidenceRef))) {
      failures.push('participant_schema'); continue;
    }
    if (p.interviewAt !== null && !dateInWindow(p.interviewAt, experiment.windowStart, experiment.asOf)) failures.push('interview_time');
    if (p.firstAdoptedAt !== null && !dateInWindow(p.firstAdoptedAt, experiment.windowStart, experiment.asOf)) failures.push('adoption_time');
    if (p.adoptions.some((date) => !dateInWindow(date, p.firstAdoptedAt, experiment.asOf)
      || date === p.firstAdoptedAt)) failures.push('repeat_time');
    if (!p.consented && (p.interviewAt !== null || p.pilot || p.firstAdoptedAt !== null
      || p.adoptions.length || p.priceEvidence !== null)) failures.push('unconsented_evidence');
    if ((p.firstAdoptedAt !== null && !p.pilot) || (p.pilot && (!p.consented || p.interviewAt === null))) failures.push('pilot_adoption_order');
    if ((p.interviewAt !== null || p.firstAdoptedAt !== null || p.priceEvidence !== null) && !p.evidenceRef) failures.push('missing_evidence');
    if (p.firstAdoptedAt !== null && p.interviewAt !== null && Date.parse(p.firstAdoptedAt) < Date.parse(p.interviewAt)) failures.push('interview_adoption_order');
  }
  if (BUNDLES.some((bundle) => experiment.participants.filter((p) => p?.pilot && p?.bundle === bundle).length > 5)) failures.push('pilot_bundle_cap');
  if (!Array.isArray(input.suppliers) || input.suppliers.length !== 3) return [...failures, 'supplier_count'];
  if (new Set(input.suppliers.map((s) => s?.id)).size !== 3 || new Set(input.suppliers.map((s) => s?.tool)).size !== 3) failures.push('supplier_duplicate');
  for (const supplier of input.suppliers) {
    if (!keys(supplier, ['id', 'tool', 'terms', 'checks']) || !/^supplier_\d{2,4}$/.test(supplier.id)
      || !/^tool_\d{2,4}$/.test(supplier.tool) || !keys(supplier.checks, SUPPLIER_CHECKS)
      || !keys(supplier.terms, ['priceUnit', 'freshnessMaxAgeHours', 'supportOwnerRef', 'failurePolicy'])) {failures.push('supplier_schema'); continue;}
    const terms = supplier.terms;
    if (![null, 'request', 'month', 'usage'].includes(terms.priceUnit)
      || (terms.freshnessMaxAgeHours !== null && (!Number.isFinite(terms.freshnessMaxAgeHours) || terms.freshnessMaxAgeHours <= 0))
      || (terms.supportOwnerRef !== null && !/^owner_\d{2,4}$/.test(terms.supportOwnerRef))
      || ![null, 'not_charged_on_error', 'documented_manual_review'].includes(terms.failurePolicy)) failures.push('supplier_terms');
    for (const check of Object.values(supplier.checks)) {
      if (!keys(check, ['status', 'evidenceRef', 'reviewedAt']) || !Object.values(CHECK_STATUS).includes(check.status)
        || (check.evidenceRef !== null && !ref(check.evidenceRef)) || (check.reviewedAt !== null && !time(check.reviewedAt))) {failures.push('check_schema'); continue;}
      if (check.status !== CHECK_STATUS.Pending && (!check.evidenceRef
        || !time(check.reviewedAt) || !time(experiment.asOf)
        || Date.parse(check.reviewedAt) > Date.parse(experiment.asOf))) failures.push('check_evidence');
    }
  }
  return failures;
}

export function evaluateGtm(input, options) {
  const failures = validateEvidence(input, options);
  if (failures.length) return {evidence: Object.values(EVIDENCE).includes(input?.evidence) ? input.evidence : EVIDENCE.Pending, failures, publicExpansion: 'blocked'};
  const {participants, windowStart, asOf, revision} = input.experiment;
  const day14 = time(windowStart) ? Date.parse(windowStart) + 14 * DAY : Infinity;
  const observed = time(asOf) && Date.parse(asOf) >= day14;
  const inFirst14 = (date) => time(date) && Date.parse(date) < day14;
  const interviews14 = participants.filter((p) => inFirst14(p.interviewAt)).length;
  const tasks14 = participants.filter((p) => inFirst14(p.firstAdoptedAt)).length;
  let nextBatch = 'awaiting_30_team_selection';
  if (participants.length === 30) {
    nextBatch = !observed ? 'awaiting_day14' : interviews14 >= 6 && tasks14 >= 3 ? 'continue'
      : interviews14 < 3 ? revision === 0 ? 'revise_once' : 'stop_or_pivot' : 'narrow_before_next_batch';
  }
  const segment = (pool) => ({selected: pool.length, interviews: pool.filter((p) => p.interviewAt !== null).length,
    pilots: pool.filter((p) => p.pilot).length, firstSuccess: pool.filter((p) => p.firstAdoptedAt !== null).length,
    paidIntentEvidence: pool.filter((p) => p.priceEvidence !== null).length,
    repeat7: {eligible: pool.filter((p) => mature(p, 7, asOf)).length,
      repeated: pool.filter((p) => mature(p, 7, asOf) && repeatAt(p, 7, asOf)).length},
    repeat14: {eligible: pool.filter((p) => mature(p, 14, asOf)).length,
      repeated: pool.filter((p) => mature(p, 14, asOf) && repeatAt(p, 14, asOf)).length}});
  const totals = segment(participants);
  const pilotDecision = totals.pilots >= 4 && totals.firstSuccess >= 3 && totals.firstSuccess / totals.pilots >= 0.75
    ? 'target_met' : 'target_not_met';
  const suppliers = input.suppliers.map((supplier) => {
    const unmet = SUPPLIER_CHECKS.filter((key) => supplier.checks[key].status !== CHECK_STATUS.Verified);
    if (Object.values(supplier.terms).some((value) => value === null)) unmet.push('terms_incomplete');
    const qualifying = participants.filter((p) => p.tool === supplier.tool && p.independenceReviewed
      && p.evidenceRef && mature(p, 14, asOf) && repeatAt(p, 7, asOf) && repeatAt(p, 14, asOf));
    const buyerOrganizations = new Set(qualifying.map((p) => p.organization)).size;
    return {id: supplier.id, unmet, readiness: unmet.length ? 'blocked' : 'ready_for_manual_approval',
      independentRepeatBuyers: buyerOrganizations, twoWeekReuse: buyerOrganizations >= 2};
  });
  const enoughReviewed = suppliers.filter((s) => s.unmet.length === 0).length >= 2;
  const repeatDemand = suppliers.some((s) => s.unmet.length === 0 && s.twoWeekReuse);
  return {evidence: input.evidence, failures: [], observedDay14: observed,
    first14: {selected: participants.length, interviews: interviews14, adoptedTasks: tasks14}, nextBatch,
    totals, interviewTarget: participants.filter((p) => p.segment === 'product_team' && p.interviewAt !== null).length >= 8
      && participants.filter((p) => p.segment === 'automation_partner' && p.interviewAt !== null).length >= 4 ? 'target_met' : 'target_not_met', pilotDecision,
    paidIntentTarget: totals.paidIntentEvidence >= 3 ? 'target_met' : 'target_not_met',
    bundle: Object.fromEntries(BUNDLES.map((id) => [id, segment(participants.filter((p) => p.bundle === id))])),
    channel: Object.fromEntries(CHANNELS.map((id) => [id, segment(participants.filter((p) => p.channel === id))])),
    suppliers, publicExpansion: input.evidence === EVIDENCE.Actual && enoughReviewed && repeatDemand
      ? 'eligible_for_manual_review' : 'blocked',
    limitations: ['Manual evidence attestation is not independently verified by this script.',
      'No registration, outreach, payment or publication is performed. Synthetic evidence cannot authorize expansion.']};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) {console.error('Usage: node scripts/gtm-decision.mjs <private-evidence.json>'); process.exitCode = 1;}
  else {
    try {
      const report = evaluateGtm(JSON.parse(readFileSync(process.argv[2], 'utf8')));
      console.log(JSON.stringify(report, null, 2));
      if (report.failures.length) process.exitCode = 1;
    } catch {console.error('Invalid or unreadable evidence; no decision authorized.'); process.exitCode = 1;}
  }
}
