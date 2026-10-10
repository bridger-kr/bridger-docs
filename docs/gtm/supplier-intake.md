# Curated supplier evidence intake (manual, not executed)

Scope: three **unselected placeholder slots** `supplier_01..03`. They are not real
suppliers, approved tools or completed3/3 rights reviews. Owner must identify
lawful candidates after repeat buyer demand; no contact/registration/payment
was performed. MP-2 owns database/publication/admin implementation separately.

The existing [BYOAPI registration pipeline](../../concepts/byoapi.mdx) handles
private tool registration; it does not itself confer public redistribution,
resale rights, seller KYC/tax or legal approval. This material adds a pilot gate,
not an auto-approval or parallel supplier portal.

## Required private evidence for every candidate

| Checklist key | Evidence and owner review |
| --- | --- |
| rights_license | Signed authority/license, source URL/document date/version, attribution, permitted users/geography, redistribution/resale, expiration/revocation; no uncontracted resale |
| schema | Versioned API schema and response semantics; provider/component fields mapped and changed-schema owner |
| fixture | Redacted permissible wire fixtures plus separate synthetic cases, parser/contract results; upstream smoke only after cost/key/approval review |
| pii | Data classes, lawful purpose, collection limits, processing/storage jurisdictions, retention/deletion, subject rights, consent and incident boundary |
| freshness | Reference-time definition per field, maximum age and stale/missing-asof behavior; never call all data real-time |
| price_unit | Price, currency, billable unit, quotas, taxes, support scope, cancellation/refund and failure charging; not unspecified “per use” |
| failure_policy | Empty/partial/error, timeouts/retries, charge/refund behavior, documented unavailable reasons |
| support_owner | Named accountable supplier+platform contacts in private evidence, hours/escalation/SLA and incident process |
| contract | Executed distribution/processing/support/payment obligations; draft/marketing promise is not executed rights |
| security | SSRF/egress/auth/scope, secret handling, abuse controls, data isolation, incident review |
| legal | Legal/privacy and terms fit approval, not an automatic checkbox |
| kyc | Seller identification and authorized contracting party evidence |
| seller_tax | Seller tax/invoice and jurisdiction treatment reviewed by responsible owner |
| psp | Payment service provider permitted-business/settlement/refund/compliance fit reviewed before paid offering |

Each item is `pending`, `verified` or `rejected`; verified/rejected requires a
restricted `evidence_XX` ref and reviewer date. Rejection reason and responsible
reviewer live in the private source artifact. All fields are mandatory3/3 **only
after actual candidate review**, not because this template has three objects.
Commercial metadata in the script includes price unit, freshness hours, opaque
support-owner ref and failure policy; signed evidence must hold the full price,
currency, scope and exact terms. Missing metadata blocks readiness.

## Approval and expansion gate

1. Review rights and schema/PII first. Reject unsupported/uncontracted resale or
   forbidden processing rather than assume data being public grants rights.
2. Maintain three private evidence matrices; propose at least2 manual approvals
   **or explicit reasons for rejection/deferral**. Pending is not approved.
3. Obtain separate security/legal/KYC/tax/PSP and contract review. No automatic
   approval and no registration just because all script fields are filled.
4. For a transaction candidate, the **same external tool** must be repeatedly
   adopted by two independent buyer organizations, each with14 days observation
   and use in both week1 `(first,first+7d]` and week2 `(first+7d,first+14d]`.
   Review independence and adoption evidence; two accounts of one org count1.
5. Until that evidence and reviewed rights exist, public marketplace/paid
   expansion stays **blocked**. Interview interest, technical HTTP success,
   offline examples and intended repeats are insufficient.
6. `gtm-decision.mjs` returns `eligible_for_manual_review` only for actual input,
   >=2 fully reviewed candidates and one ready candidate with two-buyer reuse.
   This is a request for owner review, not registration/publication/settlement.

## Proposed request copy (not sent)

> 공급자 파일럿 검토를 위해 데이터 제공/재판매 권리와 계약 근거, 스키마 및
> 허용된 샘플, 개인정보 처리 범위, 기준 시각·최신성, 가격/통화/과금 단위,
> 빈·부분·오류 결과의 지원 및 과금 정책, 지원 담당자를 요청드립니다.
> 법무·보안·KYC·세금·결제 사업자 적합성 검토 후에만 다음 단계를 제안합니다.
> 자료 제출이 자동 승인·공개 입점·유료 판매를 의미하지 않습니다. 두 독립
> 구매자가 같은 도구를 각각2주 반복 사용했다는 근거 전에는 공개 확대하지
> 않습니다. 키나 개인정보는 이메일/공개 저장소에 보내지 말고 승인된 비공개
> 제출 경로를 담당자와 먼저 합의해 주세요.

## Freshness / PII / rights artifact cover sheet

Copy to approved private storage: candidate/tool/version, review date+owner,
document evidence refs and expiration, rights+resale scope/regions, data/PII
classes+purpose+retention+delete/access owners, schema/fixture hashes, source
as-of and maximum age, unavailable policy, exact price/currency/unit/quotas,
support/SLA/failure billing, security/legal/KYC/tax/PSP decisions, two buyer
organization evidence refs+consent+adoption windows, approve/reject/defer and
reason. The public repo contains no filled legal or customer artifact.
