# Frontend API Endpoint Gaps

This file tracks API capabilities the web application needs that are not yet
available through the public HTTP API. It is a frontend planning record, not an
API contract. The backend OpenAPI document remains the source of truth after an
endpoint is implemented and exposed.

## Workflow rules

1. Record a missing endpoint here when frontend work needs it.
2. Search the API for an existing query or command handler (use case) before
   requesting backend implementation.
3. If the use case already exists and only lacks an HTTP route, it may be
   exposed through a controller, with the appropriate guard, capability,
   serialization, and DTO.
4. If no matching use case exists, do not add backend use case or persistence
   code as part of frontend work. Add a detailed request below for the API
   backlog instead.
5. Once the API endpoint is available, update its status and replace any
   temporary frontend transport with the generated Orval operation when the
   OpenAPI client has been regenerated.

## Request template

### `<Short UI feature name>` — `Proposed | In progress | Available | Deferred`

- **Frontend location:** Route and component that need the endpoint.
- **User action:** What the user does and what the UI needs to show or change.
- **Endpoint:** Proposed HTTP method and route, including path/query parameters.
- **Authorization:** Expected scope and capability; confirm with API ownership.
- **Request:** Required and optional fields, validation, and examples.
- **Response:** Required data shape, nullability, and pagination if relevant.
- **Existing API support:** Matching handler/use case and repository, or state
  explicitly that none was found.
- **Frontend behavior:** Loading, empty, validation, success, and error states.
- **Acceptance criteria:** Observable behavior that completes the request.

## Overview dashboard API audit — 2026-10-20

- **Screen:** `/{locale}/{clinic-slug}`, implemented by
  `app/[locale]/[clinic-slug]/(dashboard)/page.tsx`.
- **Verification scope:** Page components, shared schemas, API/messaging
  controllers, route registration, query handlers, repositories, and response
  serialization were inspected. Browser connection failed and the API on
  `localhost:8080` was unavailable, so the availability below describes source
  code support, not a successful live HTTP/OpenAPI check.
- **Current frontend:** The greeting uses `useCurrentUser()` and an API hook.
  The other panels still use mock arrays from `src/lib/data.ts` (the appointment
  panel imports a wrapper around `mockAppointments`). An existing endpoint
  therefore does not mean the overview already consumes live data.
- **Paths:** Existing API paths below include `/api/v1`. Messaging routes use
  the messaging service/base URL. Proposed paths in request records are design
  proposals until published in OpenAPI.

| Panel / data                                                       | Existing HTTP support                                                                                                            | Result                                                                                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Greeting / current user                                            | `GET /api/v1/users/details/{userIdOrEmail}`; self-profile also exists at `GET /api/v1/users/me`                                  | Available; the greeting already uses the first operation.                                                                                                      |
| Clinic names/slugs/timezones for chart series and clinic selection | `GET /api/v1/clinics?organizationId` (now authorized/exposed)                                                                    | Available; see the exposure record below. Frontend still needs to switch off mock clinic metadata and regenerate Orval.                                        |
| Monthly income KPI, comparison, today's collections                | `GET /api/v1/finance/finance-ledger/clinic/{clinicId}/summary?dateFrom&dateTo`                                                   | Available as completed ledger income, separated by currency; current/previous periods can use two requests. Billed/accrual revenue is a different metric.      |
| Monthly income by clinic                                           | The same finance summary, requested per authorized clinic/month                                                                  | Data available; no batched monthly series operation. See deferred optimization below.                                                                          |
| Active patient count                                               | `GET /api/v1/patients?clinicId&status=ACTIVE&page=1&limit=1`, using `meta.pagination.total`                                      | Current count available; historical growth / last-30-day comparison missing.                                                                                   |
| Today's appointments and completed count                           | `GET /api/v1/appointments/calendar?clinicId&startDate&endDate`; `GET /api/v1/appointments/daily-summary?clinicId&date`           | Available, including patient/provider labels in calendar events; comparison-day counts can use another summary request.                                        |
| New leads, funnel, conversion, channel spend/CPL                   | `GET /api/v1/leads/clinics/{clinicId}/leads`, `GET /api/v1/pipelines`, `GET /api/v1/meta-ads/clinics/{clinicId}/reports?from&to` | Partial; period-created lead counts, stage totals, and cross-channel analytics are missing. Meta report also has date/count defects described below.           |
| Payment method distribution                                        | Finance summary and provider-revenue reports exist                                                                               | No clinic/period/method aggregate.                                                                                                                             |
| Recent payments / transactions                                     | Clinic ledger list; POS `stale-pending` / `unbridged` reconciliation lists                                                       | No general recent-transaction projection covering all methods and pending/failed attempts.                                                                     |
| POS terminal list and live state                                   | `GET /api/v1/pos/devices/{clinicId}`                                                                                             | List available; bank/model and online/busy/offline telemetry absent.                                                                                           |
| POS transaction completion                                         | `GET /api/v1/pos/transactions/{id}` (now exposed)                                                                                | Available; see the exposure record below. Frontend still needs to replace the `setTimeout` simulation with real polling and regenerate Orval.                  |
| Omnichannel preview / unread badge                                 | `GET /api/v1/messaging/clinics/{clinicId}/conversations` and `/{conversationId}/messages`                                        | Conversations available; clinic-wide unread aggregate missing, previews require extra calls, country unsupported; Facebook/email are not implemented channels. |
| Health-tourism patient flow                                        | Separate hotel, transfer, and flight booking endpoints                                                                           | No patient journey read model combining country, treatment package, workflow stage, and sale value.                                                            |
| Active treatment processes across the clinic                       | `FindPatientPackagesQuery` exists for one patient; no HTTP exposure                                                              | No clinic-wide list/use case. The earlier single-patient request below does not cover this panel.                                                              |
| Critical stock                                                     | `GET /api/v1/inventory/clinics/{clinicId}/stock/low-alerts` plus `GET /api/v1/inventory/products?clinicId` for product units     | Available with product-ID mapping and the authorized serialization groups.                                                                                     |
| On-duty team / available, busy, on break                           | Employee list and per-employee attendance endpoints                                                                              | Partial raw data only; no clinic-wide current-duty/presence projection.                                                                                        |

### Integration notes for existing endpoints

- Finance summary is implemented by `GetClinicFinanceSummaryHandler` and
  checks `canAccessClinicFinances(clinicId)` under `financeledger.read`.
  `totalIncome` means completed ledger income, not invoice sales, and refunds
  or expenses must not silently change that definition. Keep TRY/EUR/etc.
  separate; never add currencies or treat a missing serialized amount as zero.
- Appointment data comes from `GetClinicCalendarHandler` and
  `GetClinicDailySummaryHandler`, exposed by `AppointmentQueryController`.
  Calendar events already contain `appointmentId`, provider name, start/end,
  status, patient name, and treatment label. Patient fields are group-filtered.
  The handlers currently obtain serialization options without an explicit
  clinic-access evaluator check; verify/fix tenant authorization before
  connecting a selectable clinic ID. A guard capability alone must not grant
  cross-clinic access. Define the comparison baseline before displaying a delta.
- Low-stock data comes from `GetLowStockAlertsQuery` in
  `StockQueryController`. Product name/quantity/critical threshold are already
  available; product lookup supplies the unit. Threshold fields are exposed
  only to management/financial/admin groups. A hidden threshold is not zero.
- The clinic selector and revenue series still use mock clinic metadata.
  `GET /api/v1/users/me/context` supplies authorized identifiers, not clinic
  names/slugs/timezones. `ClinicQueryController` now also exposes
  `GET /api/v1/clinics?organizationId` (see the exposure record below); the
  chart and selector still need to switch from the three hardcoded mock
  branch names to that operation once Orval is regenerated.

## Endpoint requests

### Active patient period comparison — `Proposed`

- **Frontend location:** Overview `KpiCards`, the active-patient KPI and its
  percentage / last-30-day subtitle.
- **User action:** Open the overview for the selected clinic and compare its
  current active-patient population with a defined previous period.
- **Endpoint:** Proposed `GET /api/v1/patients/statistics` with `clinicId`,
  `asOf`, and `comparisonAsOf` (or agreed current/previous period bounds).
- **Authorization:** Patient-read capability and explicit organization/clinic
  access policy; return counts only, without patient PII.
- **Request:** Validated clinic UUID and ISO dates. Define whether "active"
  means `Patient.status=ACTIVE` or activity during the last 30 days; these are
  different metrics and must not share an unexplained delta.
- **Response:** `{ data: { clinicId, activeDefinition, asOf,
currentActiveCount, comparisonAsOf, previousActiveCount, changePercent } }`.
  Previous count / delta must be nullable if historical state cannot be
  reconstructed; define the zero-denominator case.
- **Existing API support:** `GetPatientsQuery` / `GetPatientsHandler` expose
  current totals with `clinicId`, `status`, and `search` filters. There is no
  historical population / growth query. Filtering current patients by
  `createdAt` would not reproduce their historical active status.
- **Frontend behavior:** Render the available current count immediately;
  hide/unset the comparison if history is unavailable. Show loading, zero-count,
  access-denied, and retry states independently from the other KPIs.
- **Acceptance criteria:** Count matches the authorized current patient list;
  deleted patients are excluded; the metric and comparison dates are explicit;
  historical gaps never become fabricated 0% growth; clinic switching clears
  stale data; OpenAPI and a generated Orval operation document the contract.

### Lead period KPIs, stage funnel, and channel performance — `Proposed`

- **Frontend location:** Overview `KpiCards` new-lead card and `LeadsPanel`
  conversion badge, funnel stages, and channel lead/spend/CPL rows.
- **User action:** Inspect this month's newly created leads, period comparison,
  conversion progress, and acquisition-channel performance for a clinic.
- **Endpoint:** Proposed
  `GET /api/v1/leads/clinics/{clinicId}/analytics?from&to&comparisonFrom&comparisonTo`.
  An optional `pipelineId` can select a configured funnel.
- **Authorization:** Lead-read plus campaign-metric/financial access for spend;
  validate clinic ownership/scope. Omit restricted cost fields using the
  response groups instead of converting them to zero.
- **Request:** Clinic/pipeline UUIDs, validated current/comparison date ranges,
  and explicit currency handling. Define created-date attribution, conversion
  timestamps, source/channel mapping, and whether stage totals describe a
  cohort or a current-stage snapshot.
- **Response:** `{ data: { period, comparisonPeriod, newLeads,
previousNewLeads, changePercent, convertedLeads, conversionRate,
stages: [{ stageId, name, order, count }],
channels: [{ source, leadCount, convertedCount, spend, currency, cpl,
spendAvailable }] } }`; monetary values are decimal strings and unavailable
  spend/CPL are nullable.
- **Existing API support:** Lead list (`GetLeadsQuery`) has status/source/
  assignee filters and pagination totals, but no date range. `status=NEW` is not
  "created this month". Pipeline queries return stage definitions without
  counts. `GetMetaReportHandler` exposes a Meta-only report, not a cross-channel
  funnel: `countLeadsByAccounts` / `countConvertedLeadsByAccounts` ignore its
  date bounds, and campaign leads/conversions remain initialized to zero.
  `GetAgencyRoiReport` concerns attributed converted leads/patients rather than
  all newly created leads. No complete matching analytics use case was found.
- **Frontend behavior:** Stages follow server pipeline definitions; empty
  datasets render a valid empty funnel. Show unknown channel costs as
  unavailable. The existing Google Ads lead source does not provide ad spend;
  TikTok spend/source integration is also absent, so mock channel rows must not
  imply connected collectors.
- **Acceptance criteria:** Date bounds apply consistently to every numerator
  and denominator; stage/channel totals reconcile to the defined population;
  Meta campaign counts are real values; zero denominators and unsupported
  sources are explicit; tenant and cost visibility rules hold; OpenAPI and
  regenerated Orval types cover the final read model.

### Clinic-wide active treatment processes — `Proposed`

- **Frontend location:** Overview `PatientsPanel`, titled "Aktif Tedavi
  Süreçleri", currently populated by `recentPatients` mock records.
- **User action:** See ongoing patient treatment plans and their progress across
  the selected clinic; open a patient or the full active-process list.
- **Endpoint:** Proposed
  `GET /api/v1/patient-treatment-packages?clinicId&status=ACTIVE&page=1&limit=5`.
- **Authorization:** `patienttreatmentpackage.read`, patient/clinical response
  groups, and explicit organization/clinic scope. Do not accept a clinic UUID
  without checking the actor's access.
- **Request:** Required clinic UUID, package status, pagination, and a stable
  sort (for example `updatedAt DESC, id DESC`). Agree whether active requires
  both `status=ACTIVE` and a currently valid start/end date.
- **Response:** Paginated plain records containing `id`, `patientId`,
  `patientName`, `clinicId`, `sectorId`/sector label, package ID/name, status,
  validity dates, total/used examination and control counts, and nullable
  `progressPercent`. Initials and colors can be derived by the UI.
- **Existing API support:** `FindPatientPackagesQuery` and
  `PatientTreatmentPackageQueryRepository.findManyByPatient()` require a single
  patient for the actual lookup. Missing patient ID becomes an empty string,
  not an all-patient query. They do not implement clinic-wide selection, patient
  labels, or a progress read model. Package totals and usage counters exist,
  but their progress formula must be agreed. No clinic-wide use case or HTTP
  route exists. The separate "Patient active treatment packages" record below
  addresses only the patient profile.
- **Frontend behavior:** Show progress only when its denominator/definition is
  valid; handle no active treatments and inaccessible fields; use returned
  patient IDs for navigation. Keep one row per patient-package enrollment so
  multiple plans are not accidentally merged.
- **Acceptance criteria:** Only eligible active plans in the authorized clinic
  appear; names/labels/dates and progress are available without loading every
  patient individually; zero-session plans do not divide by zero; pagination
  counts enrollments consistently; cross-clinic reads are rejected; the final
  operation is available through OpenAPI/Orval.

### Health-tourism patient journey summary — `Proposed`

- **Frontend location:** Overview `TourismPanel` / `tourismPatients` mock data.
- **User action:** Inspect international patient flow, treatment/travel package,
  workflow stage, and package sale value in the selected clinic.
- **Endpoint:** Proposed
  `GET /api/v1/health-tourism/patient-journeys?clinicId&stage&page=1&limit=5`.
- **Authorization:** Clinic-scoped patient/booking access and appropriate
  clinical/financial serialization groups for package values; capability names
  for the composed report must be confirmed by the API owner.
- **Request:** Clinic UUID, optional agreed journey-stage filter, pagination,
  and stable ordering. A patient can have several travel bookings; define which
  patient/journey key determines one dashboard row.
- **Response:** `{ data: [{ journeyId, patientId, patientName,
countryCode: string | null, packageId: string | null,
packageName: string | null, stage, saleAmount: string | null,
currency: string | null, updatedAt }], meta: { pagination } }`.
- **Existing API support:** `GetHotelBookingsQuery`, `GetTransferBookingsQuery`,
  and `GetFlightBookingsQuery` list individual reservations, not the requested
  patient workflow. `HealthTourismQueryController` currently repeats the
  `health-tourism` segment already registered in `app.routes.ts`, so its
  composed list paths are `/api/v1/health-tourism/health-tourism/bookings`,
  `/api/v1/health-tourism/health-tourism/transfers/bookings`, and
  `/api/v1/health-tourism/health-tourism/flights/bookings`. Do not assume the
  shorter paths work. Supplier `totalNet` is a booking cost, not package sale
  value. The patient model has no country/nationality field, and no patient
  journey aggregation use case was found. Country provenance and stage
  ownership therefore require a backend data-contract decision.
- **Frontend behavior:** Show unknown country/package/value without fabricated
  flags or totals; use server stage codes and localized labels; render loading,
  empty, denied, and retry states per panel.
- **Acceptance criteria:** Stages such as consultation/offer/awaiting transfer/
  ongoing treatment have an explicit source and mapping; reservation status is
  not substituted for treatment progress; no duplicate rows from several
  bookings; no phone-based country inference; currencies remain separate;
  clinic scope is checked; routing and OpenAPI describe the final operation.

### Collection totals by payment method — `Proposed`

- **Frontend location:** Overview `PaymentsPanel`, "Yöntem Dağılımı".
- **User action:** Inspect collected amounts and percentage shares by payment
  method for a defined clinic/date range.
- **Endpoint:** Proposed
  `GET /api/v1/payment/reports/method-distribution?clinicId&dateFrom&dateTo&currency`.
- **Authorization:** Payment-read and clinic finance policy; financial response
  groups restrict amounts and percentages.
- **Request:** Clinic UUID, bounded date range, currency, and an agreed gross
  or net collection definition including refund/chargeback treatment.
- **Response:** `{ data: { period, currency, totalCollected,
methods: [{ method, collectedAmount, transactionCount, sharePercent }] } }`,
  with decimal-string money; shares are zero when the denominator is zero.
- **Existing API support:** Finance-ledger summary aggregates type/currency,
  and `GetProviderRevenueQuery` aggregates provider revenue. Neither groups by
  payment method; no matching method-distribution query was found.
- **Frontend behavior:** Render empty/zero collections correctly and distinguish
  unavailable amounts from zero. Map the real enum (`CASH`, `CREDIT_CARD`,
  `BANK_TRANSFER`, `EFT`, `MAIL_ORDER`, `CHEQUE`, `BOND`) explicitly. Installments
  are a payment-plan dimension, not another mutually exclusive method; a card
  installment must not be counted twice in the mock "Taksit / Senet" bucket.
- **Acceptance criteria:** Method amounts reconcile with the same period/
  currency collection total, reversal treatment is documented, category mapping
  is unambiguous, and authorization plus OpenAPI/Orval cover the report.

### Recent collection and payment-attempt activity — `Proposed`

- **Frontend location:** Overview `PaymentsPanel`, "Son İşlemler".
- **User action:** See the latest patient-linked collections and pending/failed
  payment attempts across supported payment methods.
- **Endpoint:** Proposed
  `GET /api/v1/payment/transactions?clinicId&dateFrom&dateTo&status&limit=5` with
  stable newest-first ordering and pagination/cursor support.
- **Authorization:** Payment-read plus clinic finance policy and field-level
  patient/financial serialization; keep provider raw payloads out of the DTO.
- **Request:** Clinic UUID, optional period/status/method filters, bounded limit,
  and stable pagination. Define event/attempt identity across ledger, payment,
  installment, and POS records.
- **Response:** `{ data: [{ id, source, clinicId, patientId: string | null,
patientName: string | null, description: string | null, method,
amount: string, currency, status, occurredAt, paymentId: string | null,
installmentId: string | null, posTransactionId: string | null }], meta }`.
- **Existing API support:** Clinic ledger listing
  (`GET /api/v1/finance/finance-ledger/clinic/{clinicId}`) exposes ledger records
  and pagination, not this date-filtered activity projection or unposted
  pending/failed attempts. POS `stale-pending` and `unbridged` endpoints are
  reconciliation worklists. `FindCollectedPaymentsQuery` exists without HTTP
  exposure, but is an invoice-discovery query and does not provide the required
  general history. No matching unified activity use case was found.
- **Frontend behavior:** Show source/status labels and the real currency;
  refresh after collections and POS completion. Patient-less attempts must not
  be assigned a fake patient. Failed attempts remain visible as failed.
- **Acceptance criteria:** History covers the agreed methods/statuses, ordering
  is stable, no duplicate collection appears from both POS and its linked
  installment/ledger record, and responses remain authorized and typed in
  OpenAPI/Orval.

### POS terminal metadata and live availability — `Proposed`

- **Frontend location:** Overview `PaymentsPanel`, "POS Cihazları" and the
  terminal selector in the collection form.
- **User action:** See device identity and real availability before selecting a
  terminal.
- **Endpoint:** Extend existing `GET /api/v1/pos/devices/{clinicId}` or add
  proposed `GET /api/v1/pos/devices/{clinicId}/status`; settle the final route in
  OpenAPI.
- **Authorization:** `posdevice.read` and the existing clinic finance-access
  policy. Merchant credentials and device integration secrets are unnecessary
  for this screen.
- **Request:** Authorized clinic UUID; an agreed observation/staleness policy
  for provider/device telemetry.
- **Response:** Existing identity plus optional `bankName`, `model`, and
  `availability: ONLINE | BUSY | OFFLINE | UNKNOWN`, with nullable `lastSeenAt`
  and an `observedAt`/staleness indication. Keep administrative `isActive`
  separate from availability.
- **Existing API support:** `FindPosDevicesQuery` exposes `id`, `clinicId`,
  `label`, provider/terminal identifiers, and `isActive`. `label` can supply the
  name. Bank/model and live availability are not present in its read model or
  persisted device model; a telemetry source/use case is still needed.
- **Frontend behavior:** Never translate `isActive=true` into "online". Show
  unknown/stale state honestly and use the agreed availability policy for
  terminal selection.
- **Acceptance criteria:** Existing device listing remains usable, telemetry
  has a real source/time, offline/busy/unknown are distinguishable, no secrets
  are exposed, and the final response is generated through OpenAPI/Orval.

### Clinic-wide on-duty team and presence — `Proposed`

- **Frontend location:** Overview `OperationsPanel`, "Görevdeki Ekip".
- **User action:** See currently on-duty staff, their roles, and whether they
  are available, busy, or on a break.
- **Endpoint:** Proposed
  `GET /api/v1/clinics/{clinicId}/team/on-duty?at={isoDateTime}`.
- **Authorization:** Employee/attendance/provider read policies as appropriate;
  require explicit clinic scope and restrict the response to operational staff
  details, not payroll or national-ID fields.
- **Request:** Clinic UUID and optional observation time (defaults to server
  time in the clinic timezone). Define the source and precedence of shift,
  attendance, break, active appointment, and manual presence information.
- **Response:** `{ data: { clinicId, asOf, members: [{ employeeId,
  userId: string | null,
providerId: string | null, displayName, roleLabel,
status: AVAILABLE | BUSY | BREAK | UNKNOWN }] } }`.
- **Existing API support:** `GET /api/v1/employees?clinicId&status=ACTIVE`
  lists employees; `GET /api/v1/attendance/employees/{employeeId}/attendance`
  lists per-employee check-in/out records. Active employment and an `OPEN`
  attendance record are not live presence states. `GetProviderScheduleQuery`
  exists without a controller route and supplies provider schedule/break windows
  only. No clinic-wide on-duty/general-staff presence query was found.
- **Frontend behavior:** Initials come from display names; unknown presence
  remains unknown. Refresh operational state independently and show an empty
  on-duty list separately from a load/access failure.
- **Acceptance criteria:** Off-duty employees are excluded according to the
  agreed rules; all relevant staff roles are supported; breaks/appointments do
  not imply invented live states; timezone and observation time are explicit;
  the endpoint is clinic-safe and documented in OpenAPI/Orval.

### Omnichannel inbox preview and clinic-wide unread summary — `Proposed`

- **Frontend location:** Overview `OmnichannelPanel`, conversation rows and the
  total "yeni" unread badge.
- **User action:** Read recent conversation previews and the unread total for
  the selected clinic, then open a conversation.
- **Endpoint:** Extend the existing messaging conversation list or add proposed
  `GET /api/v1/messaging/clinics/{clinicId}/inbox-summary?limit=5`.
- **Authorization:** Existing `TokenAuthGuard` authentication and handler
  `assertActorCanAccessClinic` check. The current controller does not declare a
  conversation-read capability; confirm/add that requirement for the summary.
  Define whether counts cover all clinic conversations or only those visible/
  assigned to the current actor; the badge and rows must agree.
- **Request:** Clinic UUID, bounded limit, and stable last-message ordering.
- **Response:** `{ data: { totalUnreadCount, supportedChannels,
conversations: [{ id, channel, contactName, lastMessageAt,
lastMessagePreview: string | null, unreadCount,
countryCode: string | null }] } }` plus explicit ordering/pagination if needed.
- **Existing API support:** Messaging `ConversationController` already exposes
  conversation and message lists. Conversation responses have contact name,
  channel, unread count, and `lastMessageAt`; a latest-message request per row
  can supply previews, so preview batching is an optimization rather than
  missing raw data. There is no total-unread aggregate over the full visible
  set, and pagination totals count conversations, not unread messages. Country
  data has no declared source in conversation/patient responses. Supported
  channel enums currently contain WhatsApp, Telegram, and Instagram, whereas
  the overview mock advertises Facebook and email. Those two channels need
  integrations beyond a new dashboard endpoint.
- **Frontend behavior:** Use only advertised supported channels, handle
  missing/deleted/non-text message previews, display unknown country without a
  flag, and refresh on read/new-message events. Never infer country from phone
  numbers or sum only one page as the clinic total.
- **Acceptance criteria:** Unread total reflects the full authorized population,
  recent rows and previews are correctly ordered, pagination cannot undercount
  the badge, country/channel availability is honest, and the messaging OpenAPI
  client covers the final response.

### Batched monthly clinic revenue series — `Deferred`

- **Frontend location:** Overview `RevenueChart`.
- **User action:** Compare the last eight months across authorized clinics.
- **Endpoint:** Optional proposed
  `GET /api/v1/payment/reports/clinic-monthly-income?clinicIds&fromMonth&toMonth`.
- **Authorization:** Finance-read policy for every clinic in the request; never
  treat organization membership as permission for all branches.
- **Request:** Bounded authorized clinic UUID set and month range. Define whether
  the chart uses ledger collections or accrual sales and keep currencies
  separate unless an explicit conversion contract is introduced.
- **Response:** `{ data: { metric, clinics: [{ id, name }],
series: [{ month, clinicId, currency, amount }] } }`, with decimal-string money
  and agreed zero filling for empty months.
- **Existing API support:** Existing clinic finance summary can already supply
  every plotted value with clinic-by-month requests. No batched series query
  exists, but a new endpoint is not required to obtain the data. This is a
  deferred request-count/performance improvement, not a blocking data gap.
- **Frontend behavior:** Series use authorized clinic IDs/names, chronological
  month keys, explicit currency, and a shared loading/error policy.
- **Acceptance criteria:** Optional batch results reconcile to individual
  period summaries, every clinic is authorized, month boundaries use the
  intended timezone, and the operation is published in OpenAPI before use.

## Existing use cases awaiting HTTP exposure

### Authorized clinic directory for overview context — `Available`

- **Frontend location:** Overview chart clinic legend, appointment clinic
  labels, and the shared `ClinicSelector` supplying the overview's scope.
- **User action:** Open/switch the selected clinic and compare authorized
  branches using their real names and slugs.
- **Endpoint:** `GET /api/v1/clinics?organizationId={uuid}`. `organizationId`
  is optional; when omitted it defaults to the actor's own
  `IGetContext.actor.organizationId`.
- **Authorization:** `CAPABILITIES.CLINIC.read` plus an explicit
  `OrganizationPolicy.actorCanAccessTargetOrganization` check in the handler
  (own organization or an owned organization). Neither the request nor the
  actor's context resolving to an organization throws
  `OrganizationScopeRequiredException` (400). A denied organization throws
  `ForbiddenException` (403) before any clinic row is read.
- **Request:** Optional `organizationId` (UUID) validated by
  `FindClinicsByOrganizationFilterDto` / `FindClinicsByOrganizationSchema`
  (`@shared/modules/clinic`).
- **Response:** `{ data: ClinicDirectoryItem[] }` with `id`, `organizationId`,
  `name`, `slug`, `timezone`, `status`. `isPlatform` clinics are filtered out
  in the handler — the platform's own ledger-owning branch never appears in
  this tenant-facing directory, so the field is intentionally absent rather
  than returned and ignored by the frontend.
- **Existing API support (implemented):** `FindManyByOrganizationIdQuery` /
  `FindManyByOrganizationIdHandler`
  (`apps/api/src/modules/organization/clinic/application/queries/find-many-by-organization-id/`)
  now take `ctx: IGetContext`, run the organization-access policy check, and
  map to the new `ClinicDirectoryItem` read model
  (`domain/contracts/clinic/clinic-queries.contracts.ts`). Exposed by
  `ClinicQueryController.findDirectory` (`GET /api/v1/clinics`) with
  `ClinicDirectoryResponseDto`. The one pre-existing internal caller
  (`SoftDeleteManyUsersByOrganizationIdHandler`, an `@InternalOnly()` cascade)
  was updated to pass a system `IGetContext`
  (`SYSTEM_ACTOR` + `ExecutionSources.INTERNAL_CASCADE`), which bypasses the
  policy check as intended for that system-initiated path. Unit-tested in
  `find-many-by-organization-id.handler.spec.ts`.
- **Still open:** OpenAPI/Orval regeneration and wiring the frontend
  `ClinicSelector`/overview chart to the generated operation instead of mock
  clinic metadata.
- **Frontend behavior:** Replace mock name/slug/timezone lookups; resolve the
  route/selected clinic against authorized records, clear stale cross-clinic
  caches, and show empty/denied/retry states without falling back to mock
  branch names.
- **Acceptance criteria:** Only authorized clinics appear; names, slugs, and
  timezones are supplied by the API; selected clinic navigation is consistent;
  the chart can resolve its permitted series; OpenAPI/Orval expose the final
  operation.

### POS transaction status read — `Available`

- **Frontend location:** Overview `PaymentsPanel`, pending POS collection state.
- **User action:** After initiating a POS transaction, inspect its actual state
  until completion, failure, or an unresolved pending timeout.
- **Endpoint:** `GET /api/v1/pos/transactions/{id}`.
- **Authorization:** `CAPABILITIES.POSTRANSACTION.read` plus the existing
  handler's `FinancePolicy.canAccessClinicFinances(summary.clinicId)` check,
  evaluated against the transaction's own clinic (not a client-supplied one).
- **Request:** `id` is the transaction UUID returned by the existing POS
  initiation commands; no request body.
- **Response:** `{ data: { id, clinicId, kind, status, provider,
patientId: string | null, paymentId: string | null, amount: string,
currency, completedAt: string | null } | null }`. `amount` is serialized as a
  decimal string (`@Type(() => String)` on the `Decimal` field, never `Number`).
  Not found resolves to `{ data: null }`. Raw provider request/response
  payloads are never included — the DTO only carries the sanitized
  `PosTransactionSummary` fields.
- **Existing API support (implemented):** `GetPosTransactionByIdQuery` /
  `GetPosTransactionByIdHandler` already existed with clinic authorization;
  the handler now also sets `meta.serializationOptions` via
  `FinancePolicy.getSerializationOptions({ clinicId })` so the response DTO's
  grouped fields (`kind`/`status`/`provider`/`paymentId`/`completedAt` behind
  `INTERNAL|FINANCIAL|MANAGEMENT|ADMIN`; `amount`/`currency` behind
  `FINANCIAL|MANAGEMENT|ADMIN`) actually apply instead of passing through
  unfiltered. Exposed by `PosTransactionQueryController.findById`
  (`GET /pos/transactions/:id`, registered after the `stale-pending` and
  `unbridged` static routes) with the new `PosTransactionStatusResponseDto`.
  Unit-tested in `get-pos-transaction-by-id.handler.spec.ts`.
- **Frontend behavior:** Poll with a bounded policy while pending, stop on final
  state, and show unresolved timeouts distinctly. The current `setTimeout`
  simulation must not display "Kart okutuldu, onaylandı" merely because time
  passed or the initiation command was accepted.
- **Still open:** OpenAPI/Orval regeneration and replacing the frontend's
  `setTimeout` simulation with real polling against this endpoint.

### Related collection action prerequisites

The overview audit above primarily concerns reads. The same mock collection
form also needs patient/payment/installment selection before recording a
patient collection. `CreatePaymentCommand`, `CreatePaymentPlanCommand`, and
`MarkInstallmentAsPaidCommand` exist without HTTP exposure; their authorization
and workflow contracts must be reviewed before public exposure. Creating a
pending payment or recording a cash-session movement is not equivalent to
settling the patient's installment. These write workflows are a related backend
integration task, not evidence that a read endpoint is missing.
The book-aware continuation of this same prerequisite backlog is
[OCB-09](#ocb-09-safe-manual-patient-collection-and-payment-prerequisites--proposed);
it is not a separate, duplicate collection API project.

### POS collection command contracts — `Proposed`

- **Frontend location:** Cari detail payment drawer and
  `/finance/pos/{physical,virtual}` settings pages.
- **User action:** Collect a card payment for a concrete appointment, invoice,
  installment, treatment charge, or general party balance and receive a typed
  result that can be reconciled without charging twice.
- **Endpoint:** Keep the existing Iyzico checkout and terminal-sale routes, but
  publish their real response DTOs in OpenAPI. Add the missing request body DTO
  to `POST /api/v1/pos/devices/{deviceId}/transactions`; reuse the transaction
  status read proposed above. Extend the collection contract with one validated
  allocation target instead of accepting an unpersisted free-text purpose.
- **Authorization:** Existing payment/POS-transaction create capabilities plus
  clinic finance access. The server resolves and validates every appointment,
  payment, invoice, installment, charge, and party against the same clinic/book.
- **Request:** Typed amount/currency plus a discriminated allocation such as
  `{ kind: APPOINTMENT|INSTALLMENT|INVOICE|TREATMENT_CHARGE|PARTY_BALANCE,
referenceId?, description? }`. Require `referenceId` for concrete kinds;
  allow a bounded description only for general party balance. Include an
  idempotency key and the selected patient/party. PAX initiation needs the same
  body fields currently present only in `InitiatePosTransactionCommand.input`.
- **Response:** Virtual checkout returns typed `{ paymentPageUrl,
conversationId }`. Physical commands return `{ posTransactionId, status,
approved, providerReference?, maskedCardNumber?, errorCode? }`; money remains
  decimal-string at the HTTP boundary. Never expose raw provider payloads.
- **Existing API support:** Iyzico virtual and terminal handlers already create
  payments and drive payment/ledger/accounting bridges. Their controller/OpenAPI
  metadata currently collapses results to `{}` or `void`. The generic device
  initiation operation loses its body in generated Orval code because the
  controller uses an inline `Omit<...>` type. No persisted purpose/allocation
  contract exists beyond optional appointment/payment links.
- **Frontend behavior:** The current drawer uses the supported patient and
  optional appointment links and never offers cash/bank as completed flows.
  Iyzico Terminal is selectable; PAX remains configuration-only until its body
  and status contracts are generated. Pending is never presented as success.
- **Acceptance criteria:** Generated clients contain request and response
  models without frontend casts; every successful collection has one explicit
  accounting purpose/allocation; retries are idempotent; pending transactions
  are queryable; provider failure does not create a successful collection;
  payment, cari ledger, and accounting references reconcile to one transaction.

### Patient active treatment packages — `Proposed`

- **Frontend location:**
  `/{locale}/{clinic-slug}/crm/patient/{patientId}`, patient profile overview
  and treatment/clinical tabs.
- **User action:** Open a patient profile and inspect the patient's active
  treatment processes, package validity period, responsible provider, and
  examination/control usage progress.
- **Endpoint:** Proposed
  `GET /api/v1/patients/{patientId}/treatment-packages?status=ACTIVE&page=1&limit=20`.
  The route should also accept the other `PatientPackageStatus` values when a
  future history view needs them.
- **Authorization:** Authenticated staff access guarded by
  `patienttreatmentpackage.read`. The API must verify that the requested
  patient belongs to the organization/clinic scope in `IGetContext`; knowing a
  patient UUID must not be sufficient to read the package. Confirm whether
  management, clinical staff, and data-owner response groups may see usage
  counts and notes.
- **Request:** `patientId` is a required UUID path parameter. Optional `status`
  is one of `ACTIVE`, `COMPLETED`, `CANCELLED`, or `SUSPENDED`. `page` and
  `limit` use the shared pagination contract. Although the existing query
  schema currently makes `patientId` optional, the HTTP route must require it
  and pass it to the query from the validated path parameter.
- **Response:** Paginated `{ data, meta.pagination }`. Each list item needs
  `id`, `patientId`, `status`, `startDate`, `endDate`, `notes`,
  `usedExaminationCount`, `usedControlCount`, package summary
  (`id`, `name`, `examinationCount`, `controlCount`), and responsible provider
  summary (`id`, user `displayName`). Payment details are not required by this
  screen. The response must use a plain read model and the existing
  serialization groups, not expose a domain entity.
- **Existing API support:** `FindPatientPackagesQuery` and
  `FindPatientPackagesHandler` already support `patientId`, `status`, and
  pagination. `PatientTreatmentPackageQueryRepository.findManyByPatient()`
  already filters by patient/status and loads package/provider data. The query
  is currently consumed only by `GetPatientPackagesTool`; no HTTP controller
  exposes it. Before exposing it, apply the injected policy/context check in
  the handler and align the response contract with the relation-rich read
  model returned by the repository. `status=ACTIVE` currently applies no
  validity-date filter, so excluding expired packages requires an explicit
  agreed rule rather than assuming status alone provides it.
- **Frontend behavior:** Show a loading skeleton while the profile query is in
  flight, render active treatment cards with validity and usage progress, show
  a dedicated empty state when no `ACTIVE` package exists, and keep the rest of
  the patient profile usable if this request fails. Refetch after package
  assignment or status updates.
- **Acceptance criteria:** Opening a patient profile requests only that
  patient's `ACTIVE` packages; expired/completed/cancelled/suspended records
  do not appear in the active list; package name, provider, dates, and usage
  progress are available without follow-up requests; pagination metadata is
  correct; cross-clinic/cross-organization access is rejected; the endpoint is
  present in OpenAPI and the frontend consumes the regenerated Orval hook.

## Available endpoint records

### Clinic appointment settings read — `Available`

- **Frontend location:** `/{locale}/{clinic-slug}/clinical/appointment`,
  `AppointmentSettingsSheet`.
- **User action:** Open appointment settings to inspect the selected clinic's
  current booking, cancellation, confirmation, slot, and reminder settings.
- **Endpoint:** `GET /api/v1/clinics/{id}/appointment-settings`.
- **Authorization:** Authenticated clinic access with the
  `clinicappointmentsettings.read` capability. The API applies the existing
  response serialization groups.
- **Request:** `id` is the clinic UUID in the path; no request body.
- **Response:** `{ data: ClinicAppointmentSettingsView }` with `clinicId`,
  `allowPatientBooking`, `rescheduleLimitHours`, `cancelLimitHours`,
  `allowPatientCancel`, `requireConfirmation`, `maxActivePatientBookings`,
  `maxFutureBookingDays`, `slotDurationMinutes`, `staffAllowOverbooking`,
  `sendSmsReminderHours`, and `requireReminderResponse`.
- **Existing API support:** `GetClinicAppointmentSettingsQuery` and its handler
  were already implemented. The HTTP route was added to expose that use case;
  no new query handler or persistence behavior was introduced.
- **Related update endpoint:**
  `PATCH /api/v1/clinics/{id}/appointment-settings`, using the existing
  `UpdateClinicAppointmentSettingsDto` and command handler.
- **Frontend behavior:** The sheet loads the current clinic values, lets the
  user edit them, submits the settings update, and refreshes the query after a
  successful save.
- **Acceptance criteria:** Opening the sheet shows the selected clinic's saved
  values; saving changes persists them for that clinic and a subsequent read
  returns the new values.

## Organization / Clinic AccountingBook planning — `Proposed`

This section is a planning backlog for company and clinic accounting, linked to
[the backend AccountingBook model proposal](../../api/documents/finans/13-organization-clinic-defter-plani.md).
It does not describe implemented endpoints or authorize runtime/backend changes
as part of the frontend work. All new fields, routes, capabilities, and response
models below remain **Proposed** until the backend model, authorization, OpenAPI,
and generated Orval operations are implemented together.

### Shared contract and scope rules

- `accountingBookId` is the canonical single-book field in requests, records,
  responses, and query keys. `accountingBookIds` is reserved for explicit
  multi-book reads. A company's own book and each clinic-owned book remain
  identifiable; a consolidated view is not a writable book.
- `sourceClinicId` preserves the originating operational clinic, even when
  posting belongs to an organization-owned book. `costCenterId` is a separate
  reporting dimension on relevant lines. Neither field changes legal book
  ownership or grants access to another book.
- Selected financial scope lives in the URL/Zustand separately from the
  operational clinic. There is no proposed server-side "switch active tenant"
  command or arbitrary header that overrides authorization. Each API validates
  the explicit scope against the actor and the referenced records.
- Reads return `QueryResponse<T>` with plain, serializable read models,
  `meta.pagination` for paginated lists, and the existing
  `serialization.groups` contract. Domain entities, Decimal objects, provider
  blobs, and unrestricted personal data do not cross the HTTP boundary.
- Proposed money fields use decimal strings, for example `"1250.00"`, with an
  explicit currency. Exchange rates are decimal strings with separately defined
  precision. Date/time fields use the agreed ISO/timezone contract. Existing
  number-valued APIs need an explicit compatibility migration, not a frontend
  cast that changes their meaning.
- Versioned mutations require `expectedVersion`; successful updates return only
  the new `{ version }` or the minimum workflow metadata. Creates normally
  return a string ID, simple actions `void`. A `409` keeps the form data and
  triggers a fresh read; it never silently overwrites a newer configuration or
  repeats a money movement. Idempotency is separate from optimistic versioning.
- Capability names introduced here are tentative and currently unseeded. An
  existing module capability remains necessary, but a selected book, shared
  organization, affiliation, franchise contract, or response group is not by
  itself permission to read or write finances.
- Existing controller/resource namespaces must be extended after the backend
  model change. Do not create a parallel `/accounting/books/{id}/invoices`,
  `/book-bank`, or `/company-accounting/reports` API alongside the current
  invoice, bank, cash, payment, and accounting resources.

### OCB-01 Authorized book directory and financial scope selection — `Proposed`

- **Frontend location:** Shared finance scope selector; company accounting
  workspace; clinic finance pages and report filters. Route names are finalized
  by the companion frontend plan, not by introducing a second clinic selector.
- **User action:** Choose an authorized organization-owned or clinic-owned book,
  inspect its owner/currency/status, or choose an explicitly permitted read-only
  consolidation while keeping the operational clinic context visible.
- **Endpoint:** Proposed `GET /api/v1/accounting/books` and
  `GET /api/v1/accounting/books/{accountingBookId}`. Optional directory filters
  are `ownerType`, validated `organizationId`, and `status`; they only narrow
  the actor's authorized result set. Selecting a result makes no API mutation.
- **Authorization:** Tentative `accountingbook.read` plus book access policy.
  Directory results contain only readable books and allowed report scopes.
  Independent/franchise books require explicit grants; organization management
  must not automatically expand the permitted set.
- **Request:** Bounded pagination/search where the directory can be large;
  UUID validation on every identifier. A detail request accepts a single book
  UUID. Never derive access by replacing the actor's clinic ID with that UUID.
- **Response:** Directory `QueryResponse<{ books: AccountingBookOption[],
consolidationOptions: AuthorizedConsolidationOption[] }>`; detail
  `QueryResponse<AccountingBookView | null>`. Plain book options contain `id`,
  `ownerType`, owner identifiers, a display label, `functionalCurrency`, `timezone`,
  `status`, `version`, and permitted action identifiers. Consolidation options
  explicitly list permitted `accountingBookIds` and supported report actions;
  they grant no mutations. Do not expose legal/tax/contact fields in a minimal
  selector DTO. Pagination, if used, must identify which collection it pages.
- **Existing API support:** No `AccountingBook` model, directory query, or book
  policy was found in the current implementation. The earlier
  [authorized clinic directory request](#authorized-clinic-directory-for-overview-context--proposed)
  remains the source for clinic names/slugs/timezones; `users/me/context`
  supplies operational IDs rather than a book directory. Reuse those clinic
  records when displaying provenance; do not request a duplicate directory.
- **Frontend behavior:** Store only the selected validated scope in URL/Zustand;
  namespace query keys by actor, book(s), filters, and response permissions.
  Cancel/reset stale reads and money forms on scope change. Missing/revoked
  scope shows a choose-scope or access-denied state, never an invented default
  book. Consolidation disables write actions.
- **Acceptance criteria:** Organization and clinic owners see only their granted
  books; a franchise affiliation alone reveals none; a removed grant invalidates
  cached selection; every subsequent read/write sends and authorizes explicit
  scope; unauthorized book UUIDs cannot be queried directly; OpenAPI/Orval
  expose the final plain contracts.

### OCB-02 Versioned clinic finance configuration — `Proposed`

- **Frontend location:** Clinic finance setup and the company's clinic finance
  configuration history.
- **User action:** Inspect the effective accounting mode/routing and schedule an
  authorized future configuration revision, with its reason and effective date.
- **Endpoint:** Proposed
  `GET /api/v1/clinics/{clinicId}/finance-configurations?effectiveAt={iso}` and
  `POST /api/v1/clinics/{clinicId}/finance-configurations/revisions`.
  Use a typed `ClinicFinanceConfiguration` resource; do not add routing fields
  to the existing general clinic settings PATCH.
- **Authorization:** Tentative `clinicfinanceconfiguration.read` / `.update`
  with clinic configuration-management policy and explicit authorization for
  every referenced target book. Reading operational clinic data is insufficient
  to alter accounting ownership or route money into another owner's book.
- **Request:** Revision body includes `expectedVersion`, `effectiveFrom`,
  `reason`, and the typed configuration fields defined by the backend proposal,
  including the effective `accountingBookId` where applicable. Validate that
  its mode/owner/affiliation combination is legal. Client-supplied organization
  IDs are verified, not trusted. No arbitrary JSON settings bag or reassignment
  of historic events, invoices, payments, or journal entries is allowed.
- **Response:** Read `QueryResponse<{ clinicId, version,
effective: ClinicFinanceConfigurationView | null,
revisions: ClinicFinanceConfigurationRevisionView[] }>` with effective dates,
  book reference, typed mode, status, and audit metadata according to response
  groups. Revision command returns minimum metadata `{ version,
configurationRevisionId }`; these are workflow/version outputs, not a full
  clinic or book entity.
- **Existing API support:** Clinic/organization finance settings entities and
  internal reads exist, but they do not implement a versioned AccountingBook
  routing model. General clinic `PATCH /clinics/{id}` is not this use case.
  New backend commands, temporal validation, persistence, and policy are needed
  before controller exposure.
- **Frontend behavior:** Show current, scheduled, and historic revisions
  distinctly. Preview effective ownership/provenance consequences before
  submission. A conflict retains the draft and reloads the latest version;
  server validation explains incompatible mode/book/effective-date choices.
  An `effectiveAt` historical read resolves the applicable stored routing
  version; source-document drilldown shows the version actually sealed on that
  document/event. Neither operation reassigns historic records to today's book.
- **Acceptance criteria:** Concurrent edits produce a conflict; overlapping
  incompatible effective revisions are rejected; backdating cannot reroute
  posted history; routing at an economic event's date is deterministic and
  persisted; switching configuration does not alter another owner's grants;
  subsequent reads return the accepted version.

### OCB-03 Effective-dated clinic / organization affiliation — `Proposed`

- **Frontend location:** Organization clinic relationships and clinic ownership/
  affiliation history, linked from finance setup.
- **User action:** Inspect the clinic's relationship to an organization, record
  an approved change, or end a relationship at an explicit effective date.
- **Endpoint:** Proposed
  `GET /api/v1/clinics/{clinicId}/organization-affiliations`,
  `POST /api/v1/clinics/{clinicId}/organization-affiliations`, and
  `POST /api/v1/clinics/{clinicId}/organization-affiliations/{affiliationId}/end`.
  These are additions to clinic controllers, not book-finance data aliases.
- **Authorization:** Tentative `clinicaffiliation.read` / `.manage`; mutation
  policy checks the clinic and related organization and the required ownership
  authority. A relationship read does not confer book-detail access.
- **Request:** Create carries the typed relationship from the backend model,
  target organization, `effectiveFrom`, optional `effectiveTo`, `reason`, and
  `expectedVersion` of the clinic affiliation aggregate. End carries
  `effectiveTo`, `reason`, and `expectedVersion`. Prohibit ambiguous overlaps;
  use an explicit approval/consent workflow if the final ownership model needs
  both parties. Configuration changes remain separate linked commands.
- **Response:** Read `QueryResponse<ClinicOrganizationAffiliationView[]>` with
  immutable relationship/revision IDs, clinic/organization references, effective
  interval, relationship type, status, and version. Create returns the new
  affiliation ID; end returns `{ version }`. Restricted legal/actor metadata is
  group-filtered. Plain references replace relation-rich domain entities.
- **Existing API support:** No `ClinicOrganizationAffiliation` temporal model or
  matching use case exists. Current scalar organization relationships do not
  provide revision history or independent franchise financial authorization.
- **Frontend behavior:** Show a timeline and the effective relationship for the
  selected date; distinguish a legal/operational relationship from access to
  financial records. Refresh the book directory after an authorized change but
  do not assume a new book has become readable.
- **Acceptance criteria:** Relationship changes preserve old provenance;
  ending an affiliation never moves historic book entries; affiliation-only
  actors cannot query another book; concurrency and date-overlap conflicts
  remain visible; all changes have effective dates and audit reasons.

### OCB-04 Franchise agreements and explicit financial access policy — `Proposed`

- **Frontend location:** Company franchise agreement list/detail, fee rules and
  sharing permissions; clinic agreement detail.
- **User action:** Create an agreement, publish a versioned amendment, terminate
  it, and explicitly grant/revoke the permitted financial reports or actions.
- **Endpoint:** Proposed
  `GET|POST /api/v1/organizations/{organizationId}/franchise-agreements`,
  `GET /api/v1/organizations/{organizationId}/franchise-agreements/{agreementId}`,
  `POST .../{agreementId}/revisions`, and `POST .../{agreementId}/terminate`.
  Explicit book access is proposed as
  `GET|POST /api/v1/accounting/books/{accountingBookId}/access-grants` and
  `POST .../access-grants/{grantId}/revoke`; keep an agreement reference on a
  grant when it is the basis for access.
- **Authorization:** Tentative `franchiseagreement.read` / `.manage` and
  `accountingbook.access.manage`, with authority from the actual book owner.
  Existing organization admin rights cannot silently grant full access to an
  independent franchisee's customer, payroll, cash, or journal data. An
  agreement's commercial relationship and its access grants are separate.
- **Request:** Agreement fields include parties, effective interval, currency,
  typed fee basis, decimal-string fixed fee/rate where applicable, reporting
  frequency, `reason`, and `expectedVersion` for revisions/termination. Grant
  fields include authorized principal, actions/report types, time/provenance
  restrictions, effective interval, optional agreement ID, and owner-approved
  delegation limits. Amendment/revoke requires the current `expectedVersion`.
  Fee calculation/posting and intercompany settlement are separate backend use
  cases; saving an agreement must not itself fabricate a payable or transfer.
- **Response:** Paginated lists and detail use `QueryResponse` plain
  agreement/grant views with version and effective intervals. Creates return
  IDs; amendments/termination/revocation return minimum `{ version }` metadata.
  Commercial amounts and identifiable principals follow explicit finance/
  management response groups; no hidden amount becomes zero.
- **Existing API support:** No franchise agreement, versioned fee-rule, or
  explicit book grant model/use case was found. Existing policies are clinic/
  organization based and require the backend model change; this is not a
  controller-only task or a new use for the ordinary settings PATCH.
- **Frontend behavior:** Show exactly which reports/actions an agreement
  permits and their validity; distinguish expired access from absent data.
  Explain fee basis/currency without presenting a saved rule as a posted fee.
  Permission changes invalidate directory/report caches and in-flight forms.
- **Acceptance criteria:** A franchisor cannot read an independent clinic's
  full book without a valid grant; grants cannot exceed the issuer's authority;
  revocation/expiry applies server-side even with cached IDs; an amendment
  preserves historic fee definitions; conflicts do not overwrite newer rules;
  any derived franchise charge is a separate traceable event in each owner's
  book, with no silent netting across books.

### OCB-05 Book-scoped operational lists and financial reports — `Proposed`

- **Frontend location:** Company/clinic finance overview, receivables/payables,
  parties, invoices, cash/bank, payroll, ledger, and accounting reports.
- **User action:** Filter existing financial resources by the selected book,
  source clinic, cost center, and reporting period; request an authorized
  multi-book management comparison where the report supports it.
- **Endpoint:** Extend the following existing resources after the backend model;
  these rows are scope extensions, not claims of new current functionality.

  | Existing resource                                                                                                        | Proposed scope/read extension                                                                                                                                                 |
  | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `GET /api/v1/accounting/periods`, `/chart-of-accounts`, `/chart-of-accounts/drift`, `/tax-parameters`                    | Explicit `accountingBookId`; book-owned periods/accounts/tax policy rather than mandatory actor clinic                                                                        |
  | `GET /api/v1/accounting/journal-entries`, `/financial-events`, `/financial-events/unposted`                              | `accountingBookId`, period/date/status/source filters; preserve immutable provenance                                                                                          |
  | `GET /api/v1/accounting/reports/{trial-balance,ledger,journal,income-statement,balance-sheet,cash-flow,vat-declaration}` | Single-book scope first; optional `sourceClinicId` / `costCenterId` only where the report can honor them; explicit multi-book management reports where semantically supported |
  | `GET /api/v1/invoices`, `/purchase-invoices`, `/parties`                                                                 | `accountingBookId`, validated business filters and pagination; return source clinic separately                                                                                |
  | `GET /api/v1/cash/registers`, `/cash/sessions`, `/bank/accounts`, `/bank/statements`, `/bank/card-chargebacks`           | `accountingBookId` with source-clinic/currency/status filters where applicable; validate all linked treasury records                                                          |
  | `GET /api/v1/payment/reports/ar-aging`, `/payment/reports/provider-revenue`                                              | Replace implicit actor-clinic-only scope with explicit authorized book and optional source clinic; preserve metric/currency definitions                                       |
  | `GET /api/v1/finance/finance-ledger/clinic/{clinicId}` and `/summary`; patient ledger routes                             | Retain as clinic/customer subledger projections with validated `accountingBookId`; an organization book total comes from accounting reports, not a fake clinic ID             |
  | `GET /api/v1/bank/provider-settlements` and `/{settlementId}`                                                            | New list/detail queries on the existing settlement resource; the current resource only has POST                                                                               |
  | `GET /api/v1/payroll/accruals` and `/{accrualId}`                                                                        | New book-scoped list/detail projection; the current accrual resource only has POST                                                                                            |

- **Authorization:** Existing resource read capabilities remain required
  (`journalentry.read`, `account.read`, `accountingperiod.read`,
  `financialevent.read`, `invoice.read`, `purchaseinvoice.read`, `party.read`,
  cash/bank/payment capabilities), plus book policy. Tentative settlement/payroll
  read capabilities need final seeding. Multi-book requests authorize each
  requested book; no silently partial result that looks like a full company
  total. An allowed aggregate grant does not imply entry-level access.
- **Request:** A single `accountingBookId` or, only on supported read operations,
  explicit bounded `accountingBookIds`; mutually exclusive scope inputs.
  Optional `sourceClinicId`, `costCenterId`, dates, currency, period/status,
  pagination, and stable sorting must be defined per resource. Reject
  incompatible old `clinicId`/organization inputs during the compatibility
  transition. Never interpret arbitrary org IDs as a readable book set.
- **Response:** `QueryResponse<PlainListItem[]>` with pagination or a plain
  report object. Include resolved scope, period/as-of basis, currency and
  provenance in report metadata. Consolidated totals explicitly enumerate
  included books, eliminations/conversion policy if any, and whether the result
  is a management aggregate. Do not sum currencies or claim that adding
  independent books produces a single statutory VAT/balance-sheet filing.
- **Existing API support:** The listed controllers and their clinic-oriented
  queries exist except the new settlement/payroll reads. No book-scoped query,
  cost-center line dimension, or authorized consolidation model currently
  exists. `GetPurchaseInvoicesHandler`, tax parameters, and payment reports
  still depend on the actor's clinic; adding a frontend header is insufficient.
- **Frontend behavior:** Reuse existing tables, filters, and generated hooks
  after their contracts change. Keep hidden amounts distinct from zero, label
  cash collections separately from accrual revenue, and preserve drilldown
  scope. A multi-book scope presents read actions only. Invalidated filters or
  a forbidden book show an explicit state rather than fallback data.
- **Acceptance criteria:** Single-book report totals reconcile to the same
  book's posted entries; source-clinic/cost-center subtotals reconcile to that
  scope; direct UUID and bulk access respect grants; every context-derived
  endpoint is migrated or explicitly unavailable for company scope; existing
  paths remain canonical; compatibility and new operations are documented in
  OpenAPI and regenerated Orval types.

### OCB-06 Book-authorized journal entry detail and source drilldown — `Proposed`

- **Frontend location:** Journal list/report row detail drawer, reversal trace,
  and an invoice/payment's accounting detail link.
- **User action:** Open an entry and inspect its debit/credit lines, book owner,
  operational source, cost centers, financial event, and reversal relationship.
- **Endpoint:** Proposed addition to the existing controller:
  `GET /api/v1/accounting/journal-entries/{entryId}?accountingBookId={uuid}`.
  Extend existing `POST /api/v1/accounting/journal-entries/{entryId}/reverse`
  with book authorization/version semantics after the model change; do not
  introduce a second reverse route under books.
- **Authorization:** `journalentry.read` plus entry book detail access;
  reversal remains `journalentry.delete` plus book write/reversal policy and
  period checks. An aggregate-only franchisor grant cannot open entry lines or
  the source patient's detail.
- **Request:** Validated entry/book UUIDs; reverse body carries `reason`,
  effective reversal date as allowed by the domain, and `expectedVersion` of
  the mutable reversal guard/state. Validate scope using the stored entry.
- **Response:** `QueryResponse<JournalEntryDetailView | null>` containing plain
  header, `accountingBookId`, `sourceClinicId`, period, entry number/date/status,
  currency, source event/document references, and lines with account references,
  `costCenterId`, decimal-string debit/credit amounts, and allowed party labels.
  Reverse returns only the created reversal ID/minimum existing workflow
  metadata. Restricted audit/party fields remain serialized by groups.
- **Existing API support:** `JournalQueryController` only exposes a list and
  `JournalEntryResponseDto` only supplies a header; current journal reports have
  lines but are not a single-entry detail operation. No matching book-authorized
  detail use case was found. The existing reversal command is reused and must
  retain immutable source events and posted entries.
- **Frontend behavior:** Render a balanced line table and accessible source
  links only when separately authorized. Posted rows have no edit/delete form;
  corrections navigate the explicit reversal workflow. Conflicts refresh state
  without automatically retrying reversal.
- **Acceptance criteria:** Direct entry access cannot cross books; line totals
  match the header/report; source links preserve scope; a reversal appears as a
  separate linked entry and cannot rewrite its source event; serializer output
  contains no domain entity or Decimal object.

### OCB-07 Purchase invoice detail, filters, and payable position — `Proposed`

- **Frontend location:** Purchase invoices / operating expenses list, supplier
  account, invoice detail drawer, and the supplier-payment allocation form.
- **User action:** Find a supplier bill by period/status/number, inspect its
  expense account and VAT, and see paid/outstanding amounts and linked payments.
- **Endpoint:** Extend existing `GET /api/v1/purchase-invoices` with a validated
  filter DTO; add `GET /api/v1/purchase-invoices/{invoiceId}`. Reuse existing
  POST, match/unmatch, and cancel routes with explicit book/source/cost-center
  contracts after backend migration.
- **Authorization:** `purchaseinvoice.read` and book/party access policy;
  record/match/cancel retain their distinct create/update/delete capabilities.
  No direct ID access through an otherwise authorized supplier in another book.
- **Request:** Required `accountingBookId`; optional `supplierId`,
  `sourceClinicId`, `costCenterId`, date interval, status, invoice-number search,
  currency, purchase-order matching filter, page/limit/sort. New bill dimensions
  such as due date, lines/mixed VAT, attachments, and allocated payments require
  their backend models first. Mutations on versioned invoice/payment position
  carry `expectedVersion`.
- **Response:** List/detail `QueryResponse` plain models with invoice and book
  IDs, source clinic, supplier summary, invoice/date/due date, status, currency,
  decimal-string net/VAT/gross/paid/outstanding totals, version, purchase-order
  reference, account/cost-center references, and cancellation trail. Detail
  includes immutable allocation/payment/reversal references after allocation is
  implemented; paginated history is defined if it can grow. Group-filtered
  amounts are absent rather than fabricated zeros.
- **Existing API support:** `GetPurchaseInvoicesQuery` only lists the actor's
  clinic with pagination; there is no detail/filter/allocation query. The
  record command already supports an optional purchase order and a single
  expense account + VAT total, so non-stock operating bills can use it. New
  records are immediately `RECORDED`; enum values `DRAFT`, `PAID`, and
  `PARTIALLY_PAID` do not prove that draft/payment workflows exist.
- **Frontend behavior:** Show recorded bills as immutable financial facts with
  explicit cancel/correct actions; derive payable badges only from the server's
  allocation position. Preserve filters when returning from a supplier detail.
  Do not offer draft editing, mixed-rate lines, or attachments until supported.
- **Acceptance criteria:** Filters/pagination work server-side within one book;
  detail opens after creation without scanning list pages; paid + outstanding
  reconciles to the server's invoice position; cancelled/reversed allocations
  remain traceable; balances do not rely on client-side event reconstruction.

### OCB-08 Supplier payment allocation and explicit correction — `Proposed`

- **Frontend location:** Supplier payment form, purchase invoice detail, and
  supplier account payment history.
- **User action:** Pay one or several recorded bills, allocate an existing
  eligible payment/advance where supported, or reverse an incorrectly recorded
  payment/allocation through a traceable correction.
- **Endpoint:** Extend the existing
  `POST /api/v1/accounting/financial-events/supplier-payments` for a recorded
  payment with allocations. Proposed allocation-only action on the same
  resource: `POST /api/v1/accounting/financial-events/supplier-payments/{paymentEventId}/allocations`.
  Proposed correction:
  `POST /api/v1/accounting/financial-events/supplier-payments/{paymentEventId}/reverse`.
  Supplier/invoice detail reads above should supply allocation history; avoid
  a duplicate `/purchase-invoices/{id}/pay` money-movement endpoint.
- **Authorization:** Existing `financialevent.create` plus explicit supplier
  payment/book write policy; tentative dedicated supplier-payment/allocation
  update/reverse capabilities require backend agreement. Treasury source and
  each invoice/party must belong to the authorized owner/book.
- **Request:** `accountingBookId`, `partyId`, decimal-string amount/currency,
  payment method/date/reference, idempotency key, concrete treasury source
  (`cashSessionId` for cash or `bankAccountId` for bank), source/cost-center
  dimensions where valid, and `allocations: [{ invoiceId, amount,
expectedVersion }]`. Allocation-only requests include the payment position's
  `expectedVersion`; reversal carries expected version, date, and reason.
  Validate total allocations against payment and outstanding amounts under
  locks. Advance/unallocated remainder is allowed only by an explicit contract.
- **Response:** Create returns the payment/financial-event ID. Allocation and
  correction return minimum `{ version }` or the created reversal ID, not an
  edited event body or a list of entities. Fresh invoice/supplier reads provide
  updated balances; any minimum workflow output follows the command response
  rules. A conflict or idempotent replay must be distinguishable in OpenAPI.
- **Existing API support:** `RecordSupplierPaymentCommand` records an immutable
  `PAYMENT_MADE` event for a party. It has no invoice allocations, treasury
  record linkage, payment-position version, or `PAID/PARTIALLY_PAID` transitions.
  Allocation and supplier-payment reversal use cases were not found; these
  need backend business/persistence work, not just new controller methods.
- **Frontend behavior:** Load eligible invoices and current balances from the
  server; show the allocation total/remainder before submit. On `409`, keep the
  form and refresh positions. Retry uncertain network results with the same
  idempotency key and re-read; never issue a second independent payment. A
  recorded event has a correction action, not edit/delete fields.
- **Acceptance criteria:** Concurrent allocations cannot overpay a bill or
  consume a payment twice; cross-book/party/currency allocations fail;
  duplicates return the original result; cash payment updates custody and
  accounting once; reversing reopens the relevant payable position with a new
  linked event and preserves the original; no duplicate expense is posted by
  both a bill payment and a cash `EXPENSE` movement.

### OCB-09 Safe manual patient collection and payment prerequisites — `Proposed`

- **Frontend location:** Patient account / payment plan, appointment collection
  form, and the overview payment panel's real patient/installment selection.
- **User action:** Read/create an authorized payment plan and record an actual
  cash or bank collection against the selected installment with a concrete
  custody/bank source and receipt reference.
- **Endpoint:** Proposed reads on the existing payment resource:
  `GET /api/v1/payment?accountingBookId&patientId&appointmentId&status&page&limit`,
  `GET /api/v1/payment/{paymentId}?accountingBookId`, and
  `GET /api/v1/payment/by-appointment/{appointmentId}?accountingBookId`.
  Proposed plan action: `POST /api/v1/payment/plans`.
  Proposed manual action: `POST /api/v1/payment/collections`. These names remain
  design proposals, not currently generated operations.
- **Authorization:** Existing `payment.read` / `.create` / `.update` as
  appropriate, explicit book/clinic/patient access, and the treasury-source
  permission. New collection policy validates the selected installment using
  its persisted owner/book; a client patient UUID or a permitted cash session
  alone cannot settle another clinic's patient account.
- **Request:** Reads carry validated identifiers and bounded filters. Plan
  input uses shared Zod-infer types, explicit book/source clinic, patient,
  optional appointment/provider, currency and decimal-string installments with
  due dates/methods. Manual collection carries `accountingBookId`, `paymentId`,
  `installmentId`, `expectedVersion`, amount/currency, accepted cash/bank
  method, `cashSessionId` or `bankAccountId`, collection date/reference, and an
  idempotency key. No gateway token, raw provider payload, or fake POS success
  flag is accepted. Partial collection requires an explicit collection/allocation
  model; until then the contract must reject partial amounts rather than mark
  an entire installment completed.
- **Response:** Reads use `QueryResponse<PaymentListItem[]>` / a plain payment
  detail with pagination, installments, current due/outstanding/collected
  amounts, version, source references, and decimal-string money. Plan create
  returns an ID. Collection returns only minimum workflow metadata, such as
  `{ collectionId, version }`; detail is refreshed via QueryResponse. Expose
  permitted financial fields through the established response groups.
- **Existing API support:** `GetPaymentByAppointmentIdQuery`,
  `GetPaymentWithInstallmentsQuery`, `CreatePaymentCommand`,
  `CreatePaymentPlanCommand`, and `MarkInstallmentAsPaidCommand` exist
  internally. The current presentation module exposes reports only. Internal
  reads/plan creation do not yet satisfy the full context/policy/versioned
  public contract; a general list and safe manual custody/accounting collection
  workflow are missing. `RecordCashMovementCommand` alone does not settle a
  patient installment. Do not expose internal mark-paid as an unrestricted
  endpoint. This extends the existing
  [related collection action prerequisites](#related-collection-action-prerequisites)
  record with book/version/custody requirements; it is the same backlog, not
  an additional independent payment API.
- **Frontend behavior:** Keep operational clinic/patient and selected book
  visible; disable invalid source/method choices; show a receipt/result only
  after persisted success. Use server balances; retain form data on conflict.
  On ambiguous network failure, resolve/retry the same idempotent operation
  before allowing another attempt. Refresh payment, patient subledger, custody,
  invoices, and reconciliation queries after confirmed collection.
- **Acceptance criteria:** One collection updates installment/payment position,
  cash custody or bank attribution, patient subledger, and financial-event
  bridge exactly once or rolls back as defined; concurrent requests cannot
  double-collect; sealed periods/closed sessions/currency mismatches fail at the
  write boundary; plan creation alone is never displayed as money received.
  Existing card actions continue through their provider workflows and reuse
  [the existing POS status-read request](#pos-transaction-status-read--proposed),
  not a duplicate collection polling/status API. Pending/timeout/failed POS
  states never become a manual success after elapsed time.

### OCB-10 Sales invoice accounting and e-document detail — `Proposed`

- **Frontend implementation note (2026-10-21):** The e-document workspace now
  uses the existing invoice list/detail queries and keeps internal invoice state
  separate from external delivery state. In live mode, unavailable document
  type/status/UUID/provider fields are explicitly marked as unpublished; send,
  download, and retry controls remain absent until the contract below exists.
  Nilvera integration settings are now connected separately: clinic and
  organization configuration, inheritance, masked credential state, connection
  test, credential rotation, and removal use the published e-document integration
  endpoints. Secrets are never rehydrated into the form.

- **Frontend location:** Sales invoice list/detail and accounting source links.
- **User action:** Inspect the actual internal invoice, its book/source and
  totals, payment/appointment links, e-document status, and cancellation trace.
- **Endpoint:** Extend existing `GET /api/v1/invoices`,
  `GET /api/v1/invoices/{id}`, and `GET /api/v1/invoices/by-payment/{paymentId}`
  with explicit `accountingBookId`, business filters, and enriched read models.
  Reuse existing backfill/cancel routes with book policy and version handling;
  do not introduce parallel company invoice operations.
- **Authorization:** Existing `invoice.read`, `.create` for backfill and
  `.delete` for cancellation, plus book and source-link access policy.
- **Request:** List filters include book, optional source clinic, patient,
  number, invoice/e-document status, date interval, currency, and pagination.
  Detail identifiers must resolve to the requested authorized book. A versioned
  cancellation includes `expectedVersion` and reason; it does not imply a cash
  refund or cancellation of a provider transaction.
- **Response:** `QueryResponse` plain list/detail models with book and source
  IDs, invoice number, currency and decimal-string totals, payment/appointment
  references, separate business/e-document states, document type, integration
  reference/UUID where permitted, version, and cancellation trail. Add a
  document download link only when a real authorized storage/provider endpoint
  exists. Hide raw integration payloads.
- **Existing API support:** Listing/detail/by-payment/backfill/cancel exist, but
  the actively used `InvoiceViewResponseDto` omits invoice number, payment/
  appointment links, and e-document fields. The broader unused
  `InvoiceResponseDto` is not evidence the API returns them. E-document routing
  now resolves clinic/organization credentials and includes a Nilvera send/status
  adapter. The invoice read models still omit the external document fields needed
  by this proposal; no authorized download or operator retry API was found.
- **Frontend behavior:** Show internal document and external submission states
  separately; no "sent"/"download official invoice" action is fabricated from
  an internal invoice. Financial correction, invoice cancellation, collection
  refund, and provider void remain separate traceable actions.
- **Acceptance criteria:** A detail opens with the same number/totals as its
  list; links preserve book authorization; internal documents are never marked
  as externally delivered; cancellation preserves accounting/reversal history;
  unsupported integration actions remain unavailable until published APIs exist.

### OCB-11 Party balance and statement projection — `Proposed`

- **Frontend location:**
  `/{locale}/{organization-slug}/{clinic-slug}/finance/party`, party detail
  drawer and future receivables/payables workspaces.
- **User action:** Open a customer, patient, supplier, or employee party card
  and inspect its server-calculated balance and traceable statement by date and
  currency.
- **Endpoint:** Proposed
  `GET /api/v1/parties/{partyId}/balance?dateTo&accountingBookId` and
  `GET /api/v1/parties/{partyId}/statement?dateFrom&dateTo&currency&page&limit&accountingBookId`.
  A single detail endpoint may embed the balance only if its as-of date,
  currency, and calculation basis remain explicit; the statement stays
  independently paginated.
- **Authorization:** `party.read` plus finance/book access to the resolved
  party. Amount fields use the established financial serialization group. The
  server resolves the party's clinic/book and rejects cross-tenant IDs rather
  than trusting a client clinic ID.
- **Request:** Validated party and book UUIDs, optional inclusive date range,
  one currency for statement filtering, stable ordering, and bounded
  pagination. Define whether unposted events are excluded; default to posted
  accounting facts and report the basis in metadata.
- **Response:** `QueryResponse` plain read models. Balance contains `asOf`,
  `currency`, decimal-string `debit`, `credit`, and signed `balance` with an
  explicit debtor/creditor semantic. Statement rows contain stable entry/line
  IDs, posting date, document/reference, description, debit, credit, running
  balance, currency, source type/reference, and reversal status. Currencies
  are returned separately and never summed.
- **Existing API support:** Party list/detail queries expose identity, roles,
  and receivable/payable account links. Patient finance-ledger reads cover only
  patient payment events, while the accounting ledger report is account-code
  based and does not filter by `partyId`. No party balance/statement query or
  repository projection was found; this requires backend read-model work, not
  a frontend reconstruction from unrelated lists.
- **Frontend behavior:** The current party screen shows identity and account
  linkage only and explicitly marks balance/statement unavailable. Once the
  generated operations exist, show per-currency balances, loading/empty/error
  states, paginated movements, and links to authorized source documents. An
  omitted financial field is restricted/unknown, never zero.
- **Acceptance criteria:** Balance reconciles to the same posted statement as
  of the requested date; running balances are stable across pages; reversals
  remain visible and net correctly; debtor/creditor sign is unambiguous;
  cross-book access is rejected; currencies are not combined; no client-side
  summation is required to determine the authoritative balance.

### Role catalog and role-capability management — `Proposed`

- **Frontend location:**
  `/{locale}/{organization-slug}/{clinic-slug}/identity/role`, implemented by
  `src/features/identity/role/components/roles-workspace.tsx`.
- **User action:** List the roles available in the current management scope,
  inspect their priority/scope/capabilities, and eventually create a custom
  role or update its capability assignments.
- **Endpoint:** Proposed `GET /api/v1/roles?page&limit&search&scope`,
  `GET /api/v1/roles/{roleId}`, `POST /api/v1/roles`,
  `PATCH /api/v1/roles/{roleId}`, and
  `PUT /api/v1/roles/{roleId}/capabilities`. System-role mutation may instead
  remain deployment-managed and reject write operations explicitly.
- **Authorization:** `role.read` for list/detail and `role.create` /
  `role.update` plus explicit platform or organization ownership policy for
  writes. A manager must never assign a role or capability above their own
  authority or outside their organization/clinic scope.
- **Request:** List accepts bounded pagination, normalized search, and an
  explicit scope filter. Create/update accepts a localized display name,
  unique slug, priority constrained below the actor, scope type, and optional
  optimistic-lock version. Capability replacement accepts validated canonical
  `module:action` keys and expected version; unknown or retired keys fail as a
  validation error.
- **Response:** `QueryResponse` plain role read models containing `id`, `name`,
  `slug`, `priority`, `isSystemRole`, scope metadata, `version`, and canonical
  capabilities grouped or groupable by module. List metadata is paginated;
  restricted roles are omitted rather than partially exposed.
- **Existing API support:** `GetRoleByIdQuery` and `GetRoleBySlugQuery` exist,
  backed by `IRoleQueryRepository`, but no role HTTP controller or generated
  frontend operation was found. There is no list query and no role create,
  update, delete, or role-capability mutation use case. User-specific
  capability grant/revoke endpoints do not replace role management. The
  current UI therefore reads the deployment-owned `rolesCreateManyInputs`
  catalog and is intentionally read-only.
- **Frontend behavior:** Until these operations exist, show the system catalog
  with search, scope, priority, and capability inspection but no fake save or
  delete controls. Once available, add independent loading/empty/error states,
  invalidate role and actor-context queries after writes, show concurrency and
  forbidden errors clearly, and prevent editing system roles when the API
  marks them immutable.
- **Acceptance criteria:** The list reflects only authorized roles; capability
  changes survive reload and affect newly resolved actor contexts; system-role
  immutability is enforced server-side; privilege escalation and cross-tenant
  assignment are rejected; concurrent edits return a conflict; OpenAPI and
  generated Orval hooks cover every supported operation.
