import { QueryResponse } from '@shared/common/response/response.interface';

/**
 * Askıda kalmış POS işlemi. `provider` kritik: PAX işlemleri 5 dakikada bir
 * cihaza sorulup sonuçlandırılır, **PAX dışı** sağlayıcılarda (iyzico Terminal)
 * durum sorgusu API'si olmadığı için tek çözüm elle doğrulamadır.
 */
export interface StalePosTransactionView {
  id: string;
  clinicId: string;
  posDeviceId: string;
  provider: string;
  kind: string;
  amount: string;
  currency: string;
  paymentId: string | null;
  initiatedAt: Date;
  ageMinutes: number;
  /** PAX dışı sağlayıcıda otomatik mutabakat YOK — elle doğrulama gerekir. */
  requiresManualVerification: boolean;
}

export type FindStalePosTransactionsResponse = QueryResponse<
  StalePosTransactionView[]
>;
