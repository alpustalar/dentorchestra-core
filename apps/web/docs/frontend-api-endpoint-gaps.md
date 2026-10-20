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
| Clinic names/slugs/timezones for chart series and clinic selection | `GET /api/v1/users/me/context` supplies clinic IDs; internal `FindManyByOrganizationIdQuery` supplies clinic records             | No authorized clinic directory HTTP endpoint; see the exposure request below.                                                                                  |
| Monthly income KPI, comparison, today's collections                | `GET /api/v1/finance/finance-ledger/clinic/{clinicId}/summary?dateFrom&dateTo`                                                   | Available as completed ledger income, separated by currency; current/previous periods can use two requests. Billed/accrual revenue is a different metric.      |
| Monthly income by clinic                                           | The same finance summary, requested per authorized clinic/month                                                                  | Data available; no batched monthly series operation. See deferred optimization below.                                                                          |
| Active patient count                                               | `GET /api/v1/patients?clinicId&status=ACTIVE&page=1&limit=1`, using `meta.pagination.total`                                      | Current count available; historical growth / last-30-day comparison missing.                                                                                   |
| Today's appointments and completed count                           | `GET /api/v1/appointments/calendar?clinicId&startDate&endDate`; `GET /api/v1/appointments/daily-summary?clinicId&date`           | Available, including patient/provider labels in calendar events; comparison-day counts can use another summary request.                                        |
| New leads, funnel, conversion, channel spend/CPL                   | `GET /api/v1/leads/clinics/{clinicId}/leads`, `GET /api/v1/pipelines`, `GET /api/v1/meta-ads/clinics/{clinicId}/reports?from&to` | Partial; period-created lead counts, stage totals, and cross-channel analytics are missing. Meta report also has date/count defects described below.           |
| Payment method distribution                                        | Finance summary and provider-revenue reports exist                                                                               | No clinic/period/method aggregate.                                                                                                                             |
| Recent payments / transactions                                     | Clinic ledger list; POS `stale-pending` / `unbridged` reconciliation lists                                                       | No general recent-transaction projection covering all methods and pending/failed attempts.                                                                     |
| POS terminal list and live state                                   | `GET /api/v1/pos/devices/{clinicId}`                                                                                             | List available; bank/model and online/busy/offline telemetry absent.                                                                                           |
| POS transaction completion                                         | POS initiation routes exist; `GetPosTransactionByIdQuery` exists internally                                                      | Transaction status read is not exposed over HTTP.                                                                                                              |
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
  names/slugs/timezones, and `ClinicQueryController` currently exposes only
  appointment settings. An authorized directory HTTP operation is missing;
  see its request below. The chart must eventually build series from that
  operation instead of the three hardcoded mock branch names.

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

### Authorized clinic directory for overview context — `Proposed`

- **Frontend location:** Overview chart clinic legend, appointment clinic
  labels, and the shared `ClinicSelector` supplying the overview's scope.
- **User action:** Open/switch the selected clinic and compare authorized
  branches using their real names and slugs.
- **Endpoint:** Proposed `GET /api/v1/clinics?organizationId={uuid}` (or an
  actor-scoped clinic-options operation with no client organization selector).
- **Authorization:** Clinic-read capability plus explicit actor organization/
  clinic-access policy. Return only the permitted clinic subset, not every
  branch merely because it shares an organization.
- **Request:** Optional validated organization UUID within the actor's scope;
  define staff-with-one-clinic, multi-clinic manager, and organization-owner
  behavior. Administrative platform clinics need explicit visibility rules.
- **Response:** `{ data: [{ id, organizationId, name, slug, timezone, status,
isPlatform }] }` with a minimal plain DTO and stable ordering.
- **Existing API support:** Clinic module `FindManyByOrganizationIdQuery` /
  `FindManyByOrganizationIdHandler` and repository
  `findManyByOrganizationId()` already return clinics, but the query has no
  actor context/authorization and is not exposed by `ClinicQueryController`.
  The existing self-context endpoint returns IDs only; the user-detail query
  does not load the directory. A scoped wrapper/policy check and minimal
  response projection are required before exposure.
- **Frontend behavior:** Replace mock name/slug/timezone lookups; resolve the
  route/selected clinic against authorized records, clear stale cross-clinic
  caches, and show empty/denied/retry states without falling back to mock
  branch names.
- **Acceptance criteria:** Only authorized clinics appear; names, slugs, and
  timezones are supplied by the API; selected clinic navigation is consistent;
  the chart can resolve its permitted series; OpenAPI/Orval expose the final
  operation.

### POS transaction status read — `Proposed`

- **Frontend location:** Overview `PaymentsPanel`, pending POS collection state.
- **User action:** After initiating a POS transaction, inspect its actual state
  until completion, failure, or an unresolved pending timeout.
- **Endpoint:** Proposed `GET /api/v1/pos/transactions/{transactionId}`.
- **Authorization:** POS-transaction read capability and the existing handler's
  clinic finance-access policy; validate the transaction UUID.
- **Request:** Transaction UUID returned by
  `POST /api/v1/pos/devices/{deviceId}/transactions`; no request body.
- **Response:** `{ data: { id, clinicId, kind, status, provider,
patientId: string | null, paymentId: string | null, amount: string,
currency, completedAt: string | null } | null }` using the existing sanitized
  transaction summary and an explicit decimal-string serializer. Define the
  not-found response; add a sanitized failure reason or observation timestamp
  only if required. Never serialize raw provider request/response payloads.
- **Existing API support:** `GetPosTransactionByIdQuery` /
  `GetPosTransactionByIdHandler` and repository `findSummaryById` exist, with
  clinic authorization, but no HTTP controller dispatches the query. Initiation
  returns `PENDING`, not guaranteed successful collection.
- **Frontend behavior:** Poll with a bounded policy while pending, stop on final
  state, and show unresolved timeouts distinctly. The current `setTimeout`
  simulation must not display "Kart okutuldu, onaylandı" merely because time
  passed or the initiation command was accepted.
- **Acceptance criteria:** The initiated transaction is readable only within
  authorized scope; success/failure reflect persisted provider results;
  unresolved pending does not become success; OpenAPI/Orval expose the query.

### Related collection action prerequisites

The overview audit above primarily concerns reads. The same mock collection
form also needs patient/payment/installment selection before recording a
patient collection. `CreatePaymentCommand`, `CreatePaymentPlanCommand`, and
`MarkInstallmentAsPaidCommand` exist without HTTP exposure; their authorization
and workflow contracts must be reviewed before public exposure. Creating a
pending payment or recording a cash-session movement is not equivalent to
settling the patient's installment. These write workflows are a related backend
integration task, not evidence that a read endpoint is missing.

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
