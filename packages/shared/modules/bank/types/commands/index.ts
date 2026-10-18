import { z } from 'zod';
import {
  AutoMatchStatementLinesSchema,
  CreateBankAccountSchema,
  ImportBankStatementSchema,
  RecordProviderSettlementSchema,
  ReconcileStatementLineSchema,
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
