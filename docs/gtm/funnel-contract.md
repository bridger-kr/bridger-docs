# Optional workflow funnel v1

Event: `workflow_funnel_v1`; property `funnel_version=1`. Implemented in the
landing's consent-gated Mixpanel transport. No separate consent store, OAuth
funnel, audit pipeline or persistent analytics identity is introduced.

## Meaning and wire fields

| Stage | Meaning | Denominator |
| --- | --- | --- |
| exposure | Consented session sees the relevant landing/catalog/bundle surface; dedupe per bundle/channel/cohort per instance | Distinct consented session identities exposed per segment |
| discovery | Search initiated (outcome absent) or catalog response received (allowlisted outcome) | Exposed sessions; response totals counted separately, not summed with initiations |
| selected | Catalog result or workflow link explicitly selected | Exposed/discovered sessions, report which base was used |
| attempt | Authorized actual workflow execution started | Selected sessions; actual work teams kept separate from sessions |
| result | One terminal normalized success/empty/partial/error for that attempt | Attempt count, not pageviews; describe failures and retries |
| adopted | Operator explicitly confirms using a successful result in the task | Successful results and distinct consented eligible teams, both reported |

Only bundle (`catalog`, `business_check`, `place_brief`), channel (`landing`,
`workflow_page`, `ai_guide`, `unknown`), cohort (`organic`, `pilot`, `synthetic`),
stage and version are common fields. Result/discovery may add an allowlisted
outcome; adopted adds `first_success`/`repeat_success` and `under_1m`/`1_to_5m`/
`over_5m` duration buckets. Context is projected onto allowlisted fields: raw
query, address, coordinates, key, business number and arbitrary input cannot
become funnel properties. Do not use unrelated analytics super-properties to
attach these values. Existing consented pseudonymous transport identity is not a
customer contact record.

No optional emission before grant or after deny/revocation. Revocation invalidates
in-flight handles and clears local first/exposure dedupe; regrant does not replay
missed events. Delivery acceptance means locally queued, not a server receipt.
Consent is necessary for analytics but does not establish provider/legal rights.

## Success and maturity

- `success`: all requested components have usable nonempty results with known
  source/reference time and use-case freshness validation. Closed-business status
  may be a successful lookup, not business approval.
- `partial`: at least one usable component but some requested parts empty or
  unavailable. `empty`: no usable rows, at least one valid empty response; retain
  other failure reasons. `error`: all requested parts unavailable.
- A private in-memory attempt handle can receive only one terminal result and
  one adoption. Adoption requires success; catalog results cannot begin an
  attempt. Never infer adoption from HTTP200, a row count or a tool selection.
- `first_success` means first **adopted success per bundle/cohort in this funnel
  instance**. It is deduped across channel values but not page reloads/devices.
  Analysts must independently dedupe consented participant histories before
  reporting cohort first success. Instance-local repeats do not prove7/14-day use.
- Duration is execution start to explicit adoption (not initial exposure to
  value). Treat it as an attempt-to-adoption TTFV proxy; no actual timings measured.
- Operational repeat7 window: `(first adopted, first adopted+7d]`; repeat14:
  `(first adopted+7d, first adopted+14d]`. Denominators include only consented
  first adopters observed at least7 or14 full days. Younger teams are censored,
  not failures. A task must actually be re-adopted, not merely viewed or refreshed.
- Supplier demand additionally requires the **same tool** for two distinct
  organizations, independence reviewed, both week windows used and14 days
  observation. Two accounts from one organization count as one buyer.

Report bundle and channel numerator/denominator/window together, never mix
organic/pilot/synthetic or sessions/teams. Unknown attribution stays unknown.
No raw UTM values, referring URLs or user input are accepted. Small segments
and missing consent prevent population-wide conversion claims.

## Existing backend boundary and remaining hookup

At API base `86017b0666c9e8578ec4a8c4260b007dea92219f`, runtime proxy
`ExecuteTool` already enqueues technical call counts and `WriteExecutionAudit`
with success=true on its successful path; cache-hit paths and early errors have
different behavior. Those operational/security records do not prove workflow
completeness or user adoption and are **not** optional product analytics.
This work does not duplicate them or EDD-357 OAuth funnel/notifications.

Landing wires exposure/discovery/selection only. Bilingual docs describe
execution; they do not emit analytics. The executor must explicitly call
`workflowFunnel.begin(context)`, `result(handle, outcome)` and `adopt(handle)`
after consent and successful review when a future approved cross-surface hookup
is implemented. Never transmit raw backend logs into this event. No live bundle
execution or production 7/14-day measurement is claimed here.

Verification: pure-state and actual transport synthetic tests exercise20 granted
and20 denied/undecided sessions, zero sensitive-field leakage, first-success
dedupe and revoke. These are offline expected events, not measured customer use.
