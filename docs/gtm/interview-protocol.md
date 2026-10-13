# Interview, cohort and channel protocol (not executed)

Owner: founder for contacts/ICP and decisions; product owner for adoption evidence;
security/privacy owner for consent/retention. Every step below is a proposed
operator action. This session sends no copy and collects no customer data.

## Selection and consent

- Manually select30 qualified teams through approved existing relationships or
  permitted inbound channels. No bulk scraping, bought contacts or unsolicited
  automated campaigns. Select8 product-team and4 automation-partner interview
  slots (12 total), and up to5 consented design partners per bundle.
- Record anonymous team/organization IDs, assigned bundle/channel, qualification
  reason and excluded/dropout reason privately. Do not publish contact lists.
- Ask permission before an interview and separately for notes, recording,
  follow-up and optional analytics. Decline/withdrawal cannot block essential
  service. No audio/video recording by default; no identifiable notes in repos.
- Proposed retention: delete contact/linkage/raw notes30 days after the decision;
  aggregate anonymized evidence for90 days. Privacy owner must approve legal
  basis, notice and this schedule **before** collecting. Honor earlier withdrawal
  and required legal exceptions through the approved owner process.

## 25-minute interview and evidence matrix

1. Ask for the most recent repeated real task (date/frequency), not a hypothetical
   product endorsement. What outcome was used and where did it fail?
2. Record current alternative, manual effort, owner and constraints. Do not ask
   for raw customer numbers, addresses or API keys; a redacted example suffices.
3. Which provider rights/keys/quota/cost and geographic/time coverage are needed?
4. What result would be acceptable, what partial/empty/error must remain visible,
   and who makes final adoption decisions? Do not substitute HTTP success.
5. What support, freshness and response-time expectations matter?
6. Ask about willingness only with an explicit proposed **price and unit, scope,
   quota and support/failure policy**. Record an evidence reference for at least3
   qualified statements; this is not payment, revenue or a signed contract.
7. Offer an opt-in pilot only if keys/rights/use are lawful, safe and approved.
   Collect explicit evidence of a real result used, then later separate week1/
   week2 reuses. Record dropout reasons, including no need/no permission/key
   cost/support/declined/other. No success anecdote without adoption evidence.

Private matrix columns: team/org/segment/bundle/channel, selectedAt, consent
receiptRef, interview date, repeated-task evidenceRef, alternative/constraint
evidenceRef, pilot consent, first adoption, repeated adoption dates/tool,
price+support evidenceRef, dropout, owner, next action. Free-text private evidence
is **not** copied into `evidence-template.json`; the script uses bounded codes
and opaque refs only. Source artifacts contain the actual approved details.

## Channel experiment and decisions

Randomly assign qualified teams to workflow-page vs existing AI-guide links,
balanced within bundle when possible. Keep the initial assignment stable and
report actual assignment/overlap. Founder uses approved manual outreach only.
The landing's `landing` organic events are not equivalent to this30-team cohort.
No causality, channel winner, market-size or conversion claim from small samples.

- After14 full days for a30-team batch, interview>=6/30 **and** real adopted
  task>=3/30 permits the next batch. Both thresholds are proposed targets.
- Interview below3/30: revise ICP/copy once; repeat the same observation rules. If
  second batch remains below3/30, stop/pivot. Do not iterate indefinitely.
- Middle band or adoption shortfall: narrow and investigate before another
  batch; do not label success. Document the unmet numerator and denominator.
- Final12 interviews need8 product teams+4 partners or an explicit shortfall/
  stop decision. Pilot target>=4 consented, >=3 first adoptions and>=75% pilot
  conversion (3/4). Maximum5 partners per bundle. Larger pilots retain their
  actual denominator; never report3/10 as3/4.
- Record7/14-day repeat eligible and repeated separately by bundle/channel.
  Immature first adopters are censored. Collect3 qualified pricing statements
  as feasibility evidence only. Supplier/paid expansion remains independently
  blocked even when interview targets pass.

After review, write a next30-day continue/narrow/stop decision with owner, date,
observed window, exclusions, unresolved rights/cost/support risks and next action.
`gtm-decision.mjs` is deterministic checking, not proof of manual claims. Template
participant fields are provided in `participant-template.json` (append to the
private evidence file's `experiment.participants` after lawful selection):
IDs/ref fields only; times are UTC ISO strings; `pilot` needs consent+interview;
`firstAdoptedAt` needs pilot; `adoptions` excludes duplicate/first/future dates.
Use a separate private evidence file and new observation window for each30-team
batch. A second batch sets `revision=1`; do not combine batches into a larger
denominator or reuse the first batch's successes as new evidence.

## Proposed copy — owner review required, not sent

**Interview invitation**

> 안녕하세요. 반복해서 처리하는 거래처 상태 확인 또는 장소 정보 확인 업무를
> 이해하기 위한25분 인터뷰를 제안드립니다. 최근 업무와 기존 대안을 여쭙고,
> API 키·사업자번호·개인 주소는 요청하지 않습니다. 참여·기록·후속 연락은
> 선택이며 언제든 중단할 수 있습니다. 제품/판매 약속이나 신용·사기 검증은
> 아닙니다. 담당자의 승인된 연락 경로에서 관심 여부를 알려주실 수 있을까요?

**Workflow page / guide comparison**

> 확인하려는 작업의 입력·지원 지역·기준 시각·누락 처리 범위를 먼저 확인해
> 주세요. 거래처 기초 확인과 장소 브리핑은 실제 실행 결과가 아닌 작업 예시입니다.
> [거래처 예시](https://docs.bridger.kr/workflows/business-check) /
> [장소 예시](https://docs.bridger.kr/workflows/place-brief) /
> [AI 연결 가이드](https://docs.bridger.kr/guides/claude).
> 키·권한·비용 확인 전 실행을 요청하지 않습니다.

**Design-partner offer**

> 승인된 입력·키·이용조건과 지원 범위를 먼저 확인한 뒤, 원하시는 경우 한
> 작업 번들의2주 파일럿을 제안드립니다. 부분/빈/오류 결과는 숨기지 않으며
> 결과의 실제 업무 채택을 별도로 확인합니다. 가격·과금 단위·쿼터·지원·실패
> 정책은 참여 전에 담당자와 명시적으로 합의해야 합니다. 실제 결제나 계약을
> 이 메시지로 진행하지 않으며 참여하지 않아도 서비스 이용에 불이익이 없습니다.
