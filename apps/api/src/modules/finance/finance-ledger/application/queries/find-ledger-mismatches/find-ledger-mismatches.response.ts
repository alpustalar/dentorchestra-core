import { QueryResponse } from '@shared/common/response/response.interface';
import { LedgerMismatchRow } from '@modules/finance/finance-ledger/domain/contracts/finance-ledger';

export type FindLedgerMismatchesResponse = QueryResponse<LedgerMismatchRow[]>;
