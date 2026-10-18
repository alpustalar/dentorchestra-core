import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetInstallmentForLedgerQuery } from './get-installment-for-ledger.query';
import { GetInstallmentForLedgerResponse } from './get-installment-for-ledger.response';
import {
  IPaymentQueryRepository,
  PAYMENT_QUERY_REPOSITORY,
} from '@modules/finance/payment/domain/repositories/payment/payment.query.repository';

/**
 * İç köprü sorgusu: HTTP yüzeyi yoktur, yalnız cari defter yazıcısı (kuyruk
 * işçisi) tarafından `installmentId` ile çağrılır. Bu yüzden klinik kapsamı
 * burada **kontrol edilmez**; çağıran bağlam zaten sistem aktörüdür ve kaydı
 * taksitin kendi kliniğine yazar (kapsam istekten değil kaynaktan gelir).
 */
@QueryHandler(GetInstallmentForLedgerQuery)
export class GetInstallmentForLedgerHandler implements IQueryHandler<
  GetInstallmentForLedgerQuery,
  GetInstallmentForLedgerResponse
> {
  constructor(
    @Inject(PAYMENT_QUERY_REPOSITORY)
    private readonly paymentQueryRepo: IPaymentQueryRepository
  ) {}

  async execute(
    query: GetInstallmentForLedgerQuery
  ): Promise<GetInstallmentForLedgerResponse> {
    return {
      data: await this.paymentQueryRepo.findInstallmentForLedger(
        query.installmentId
      ),
    };
  }
}
