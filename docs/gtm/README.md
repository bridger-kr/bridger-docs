# GTM offline evidence and manual operations

Status: **proposed protocols + synthetic tests only**. No customer was contacted,
interviewed, charged or contracted. No supplier was registered or approved. No
provider smoke was run. Zero observed interviews, pilots and buyer repeats in
the pending template; these are missing evidence, not failed market results.

Public bilingual workflow contracts: `workflows/business-check.mdx` and
`workflows/place-brief.mdx` (English mirrors under `en/`). Existing AI connection,
business-information and weather guides/widgets are reused, not replaced.

## Run locally (no network or credentials)

```sh
node scripts/check-workflow-fixtures.mjs
node --test scripts/workflow-contract.test.mjs scripts/gtm-decision.test.mjs
node scripts/gtm-decision.mjs docs/gtm/evidence-template.json
npm run check:content
npm run verify:examples
npm run lint
```

The 50 checked-in cases are **synthetic normalized envelopes**, 25 per bundle,
not raw upstream responses or production-ready connector fixtures. `rows.sample`
is an invented test ordinal, not a measurement or business record. The as-of
dates are synthetic. No numbers, addresses, coordinates, keys or real queries
are stored. The validator enforces exact keys, supported component sets,
source/asOf/unavailable, truthful outcomes and no failure adoption.

`workflow-sources.json` was checked against docs' existing `vendor/spec` pin
`6e3a0993f1bf61f24b07bd9998aedb1edc414150`, and API reference
`86017b0666c9e8578ec4a8c4260b007dea92219f`, on 2026-10-10. This is repository
metadata evidence, not a fresh upstream reachability or terms review. All rights
remain unreviewed. The charging preset covers Suwon and records an unavailable
official attachment; region normalization is not street-address validation.

## Operator sequence

1. Read `funnel-contract.md` before connecting any executor or analysis.
2. The founder follows `interview-protocol.md`, using approved lawful contacts
   only. Copy is proposed; do not send from this script/session.
3. Copy `evidence-template.json` into a restricted, **untracked** location; use
   `participant-template.json` for each lawfully selected anonymous team entry.
   Never commit interview answers, consent receipts, contracts or personal data.
4. Maintain the private evidence matrix using anonymous `team_XX`, `org_XX`,
   `tool_XX`, `owner_XX`, and `evidence_XX` references. Keep the reidentification
   map and sensitive source artifacts separate with approved access/retention.
5. Run `node scripts/gtm-decision.mjs <private-file.json>` after updating `asOf`.
   Invalid, unsupported, future or non-consented evidence fails closed. Output
   does not contain free-text responses or contact fields.
   Actual evidence cannot use an `asOf` later than the process clock to claim
   an observed retention window. Future synthetic scenarios remain test-only.
6. Record continue/narrow/revise-once/stop-or-pivot in the owner's next-30-day
   decision log. Do not infer channel winners from this small sample.
7. Follow `supplier-intake.md`. The script produces readiness **for manual
   approval**, not legal validation, registration, automatic approval or payment.

`evidence` must be `pending`, `synthetic` or `actual`. Pending and synthetic
evidence can never authorize expansion. Do not relabel a synthetic file actual.
Manual attestation still needs independent human source review; the script cannot
verify contracts or whether claimed interviews/adoptions occurred.

## Human acceptance criteria still open

- 12 actual consent interviews (8 product teams + 4 automation partners), reasons
  for dropout, lawful selection/contact of 30 independent qualified teams.
- First-14-day 6/30 interviews and 3/30 adopted tasks, or documented narrow/stop
  conclusion. Consent pilots >=4, adopted first success >=3/4, up to5 per bundle.
- Three actual price/support-qualified willingness statements (not payments).
- Three real supplier candidates with reviewed rights/license, schema/fixtures,
  PII, freshness, price, failure/support, legal/security/KYC/tax/PSP and contracts;
  at least2 manual approvals or documented rejection rationale.
- One same-supplier-tool candidate reused by two independent buyer organizations
  in both weeks with14 days of observation each before public/paid expansion.
- Approved real provider smoke, key/coverage/terms checks, rendered UI QA and
  eventual cross-surface executor/adoption instrumentation.

These gaps require people or approval; offline fixtures do not close them.
