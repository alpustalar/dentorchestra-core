import { FindLedgerMismatchesSchema } from '../queries/find-ledger-mismatches.schema';

/**
 * Telafi turunun gövdesi mutabakat raporunun filtresiyle **aynı** şemadır:
 * rapor neyi gösteriyorsa onarım da onu onarır (CLAUDE.md finans kuralı 12 —
 * kabul kümesi tek bir sabitte yaşar).
 */
export const BackfillLedgerEntriesSchema = FindLedgerMismatchesSchema;
