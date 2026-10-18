import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { FindLedgerMismatchesQuery } from './find-ledger-mismatches.query';
import { FindLedgerMismatchesResponse } from './find-ledger-mismatches.response';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { FindSettledInstallmentsQuery } from '@modules/finance/payment/application/queries/find-settled-installments/find-settled-installments.query';
import {
  FINANCE_LEDGER_QUERY_REPOSITORY,
  IFinanceLedgerQueryRepository,
} from '@modules/finance/finance-ledger/domain/repositories/finance-ledger/finance-ledger.query.repository';
import { ledgerStatusForInstallment } from '@modules/finance/finance-ledger/domain/rules/installment-ledger-status.rule';
import { LedgerMismatchRow } from '@modules/finance/finance-ledger/domain/contracts/finance-ledger';

/**
 * Tahsilat/iade listesi payment modülünden (QueryBus — bounded context), cari
 * kayıtların durumu kendi tablosundan okunur; fark ikisinin karşılaştırmasıdır.
 *
 * Yetki kontrolü payment tarafındaki sorguda yapılır (şube kapsamı); aynı
 * kararı iki yerde tutmak ikisinin ayrışmasına davettir.
 */
@QueryHandler(FindLedgerMismatchesQuery)
export class FindLedgerMismatchesHandler implements IQueryHandler<
  FindLedgerMismatchesQuery,
  FindLedgerMismatchesResponse
> {
  constructor(
    @Inject(FINANCE_LEDGER_QUERY_REPOSITORY)
    private readonly ledgerQueryRepo: IFinanceLedgerQueryRepository,
    private readonly queryBus: TSQueryBus
  ) {}

  async execute(
    query: FindLedgerMismatchesQuery
  ): Promise<FindLedgerMismatchesResponse> {
    const { filter, ctx } = query.payload;

    const { data: settled } = await this.queryBus.execute(
      new FindSettledInstallmentsQuery({ filter, ctx })
    );

    if (settled.length === 0) return { data: [] };

    const ledgerStatuses = new Map(
      (
        await this.ledgerQueryRepo.findEntryStatusesByInstallmentIds(
          settled.map((row) => row.installmentId)
        )
      ).map((row) => [row.installmentId, row.status])
    );

    const mismatches = settled.reduce<LedgerMismatchRow[]>((acc, row) => {
      const expectedStatus = ledgerStatusForInstallment(row.status);
      // Sonuçlanmış taksitin beklenen durumu daima vardır; tip güvenliği için
      // yine de süzülür (kaynak sorgu kümesi değişirse sessizce bozulmasın).
      if (!expectedStatus) return acc;

      const ledgerStatus = ledgerStatuses.get(row.installmentId) ?? null;
      if (ledgerStatus === expectedStatus) return acc;

      acc.push({
        installmentId: row.installmentId,
        paymentId: row.paymentId,
        clinicId: row.clinicId,
        patientId: row.patientId,
        amount: row.amount,
        currency: row.currency,
        expectedStatus,
        ledgerStatus,
        kind: ledgerStatus ? 'STATUS_DRIFT' : 'MISSING',
        settledAt: row.settledAt,
      });
      return acc;
    }, []);

    return { data: mismatches };
  }
}
