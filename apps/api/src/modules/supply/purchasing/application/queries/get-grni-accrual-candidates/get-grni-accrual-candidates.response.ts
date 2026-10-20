import { QueryResponse } from '@shared/common/response/response.interface';
import type {
  GrniAccrualCandidate,
  InvoicedNotReceivedWarning,
} from '@shared/modules/accounting-period/interfaces';

export interface GrniAccrualCandidatesReport {
  clinicId: string;
  asOf: Date;
  /** Teslim > fatura: tahakkuk adayları (en büyük tutar önce). */
  candidates: GrniAccrualCandidate[];
  /** Fatura > teslim (yalnız stok faturaları): bilgi amaçlı, otomatik fiş yok. */
  invoicedNotReceived: InvoicedNotReceivedWarning[];
}

export type GetGrniAccrualCandidatesResponse =
  QueryResponse<GrniAccrualCandidatesReport>;
