import { z } from 'zod';
import {
  GetBankAccountsSchema,
  GetBankStatementsSchema,
  GetCardChargebacksSchema,
} from '../../schemas/queries';

export type GetBankAccounts = z.infer<typeof GetBankAccountsSchema>;
export type GetBankStatements = z.infer<typeof GetBankStatementsSchema>;
export type GetCardChargebacks = z.infer<typeof GetCardChargebacksSchema>;
