import { defineEndpoint } from '@shared/common/contracts/endpoint';
import { BackfillLedgerEntriesSchema } from '../schemas/commands';
import {
  FindLedgerMismatchesSchema,
  GetLedgerSummarySchema,
} from '../schemas/queries';
import type {
  BackfillLedgerEntriesResultView,
  ClinicLedgerEntry,
  LedgerMismatchView,
  LedgerSummaryView,
  PatientFinanceSummaryView,
  PatientLedgerEntry,
} from '../interfaces';

/**
 * `apps/api` → `FinanceLedgerQueryController`. Modül `app.routes.ts`'te
 * `finance` altına takılı, controller'ın kendi öneki `finance-ledger` — yollar
 * bu yüzden `/finance/finance-ledger/...` biçiminde.
 *
 * Cari hareketler event-driven üretiliyor; elle kayıt açan bir uç **yok**. Tek
 * yazma ucu `backfill`: olayı hiç yazılamamış ya da durumu kaynaktan kaymış
 * kayıtları onarır (CLAUDE.md finans kuralı 4 — yutulan kritik iş için
 * backfill + eksikler sorgusu). Sayfalama istemcinin birinci sınıf
 * `pagination` seçeneğiyle gider.
 */
export const financeLedgerEndpoints = {
  clinicLedger: defineEndpoint<ClinicLedgerEntry[]>()({
    method: 'GET',
    path: (p: { clinicId: string }) =>
      `/finance/finance-ledger/clinic/${p.clinicId}`,
  }),

  clinicSummary: defineEndpoint<LedgerSummaryView>()({
    method: 'GET',
    path: (p: { clinicId: string }) =>
      `/finance/finance-ledger/clinic/${p.clinicId}/summary`,
    query: GetLedgerSummarySchema,
  }),

  patientSummary: defineEndpoint<PatientFinanceSummaryView>()({
    method: 'GET',
    path: (p: { patientId: string }) =>
      `/finance/finance-ledger/patient/${p.patientId}/summary`,
  }),

  patientLedger: defineEndpoint<PatientLedgerEntry[]>()({
    method: 'GET',
    path: (p: { patientId: string }) =>
      `/finance/finance-ledger/patient/${p.patientId}`,
  }),

  mismatches: defineEndpoint<LedgerMismatchView[]>()({
    method: 'GET',
    path: '/finance/finance-ledger/reconciliation/mismatches',
    query: FindLedgerMismatchesSchema,
  }),

  backfill: defineEndpoint<BackfillLedgerEntriesResultView>()({
    method: 'POST',
    path: '/finance/finance-ledger/reconciliation/backfill',
    body: BackfillLedgerEntriesSchema,
  }),
};
