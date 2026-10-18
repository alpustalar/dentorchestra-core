import { QueryResponse } from '@shared/common/response/response.interface';
import { InstallmentLedgerRow } from '@modules/finance/payment/domain/contracts/payment';

export type GetInstallmentForLedgerResponse =
  QueryResponse<InstallmentLedgerRow | null>;
