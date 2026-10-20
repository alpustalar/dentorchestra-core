import { z } from 'zod';
import {
  AutoMatchStatementLinesSchema,
  CreateBankAccountSchema,
  ImportBankStatementSchema,
  OpenCardChargebackSchema,
  RecordProviderSettlementSchema,
  ReconcileStatementLineSchema,
  ResolveCardChargebackSchema,
} from '../../schemas/commands';

export type CreateBankAccount = z.infer<typeof CreateBankAccountSchema>;
export type ImportBankStatement = z.infer<typeof ImportBankStatementSchema>;
export type ReconcileStatementLine = z.infer<
  typeof ReconcileStatementLineSchema
>;
export type AutoMatchStatementLines = z.infer<
  typeof AutoMatchStatementLinesSchema
>;
export type RecordProviderSettlement = z.infer<
  typeof RecordProviderSettlementSchema
>;
export type OpenCardChargeback = z.infer<typeof OpenCardChargebackSchema>;
export type ResolveCardChargeback = z.infer<typeof ResolveCardChargebackSchema>;
