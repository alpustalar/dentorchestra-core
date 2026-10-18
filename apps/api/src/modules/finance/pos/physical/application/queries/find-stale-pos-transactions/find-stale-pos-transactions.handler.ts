import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { FindStalePosTransactionsQuery } from './find-stale-pos-transactions.query';
import {
  FindStalePosTransactionsResponse,
  StalePosTransactionView,
} from './find-stale-pos-transactions.response';
import {
  IPosTransactionQueryRepository,
  POS_TRANSACTION_QUERY_REPOSITORY,
} from '@modules/finance/pos/physical/domain/repositories/pos-transaction/pos-transaction.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { PosProvider } from '@prisma/client';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';

@QueryHandler(FindStalePosTransactionsQuery)
export class FindStalePosTransactionsHandler implements IQueryHandler<
  FindStalePosTransactionsQuery,
  FindStalePosTransactionsResponse
> {
  constructor(
    @Inject(POS_TRANSACTION_QUERY_REPOSITORY)
    private readonly posTransactionQueryRepo: IPosTransactionQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: FindStalePosTransactionsQuery
  ): Promise<FindStalePosTransactionsResponse> {
    const { filter, ctx } = query.payload;

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check(
        (p) => p.canAccessClinicFinances(filter.clinicId),
        'Bu kliniğin POS işlemlerine erişim yetkiniz yok.'
      )
      .orThrow('pos.stale-pending');

    const rows = await this.posTransactionQueryRepo.findStalePending({
      clinicId: filter.clinicId,
      olderThanMinutes: filter.olderThanMinutes,
    });

    const now = DateTimeManager.create();

    const data: StalePosTransactionView[] = rows.map((row) => ({
      id: row.id,
      clinicId: row.clinicId,
      posDeviceId: row.posDeviceId,
      provider: row.provider,
      kind: row.kind,
      amount: row.amount.toString(),
      currency: row.currency,
      paymentId: row.paymentId,
      initiatedAt: row.initiatedAt,
      ageMinutes: DateTimeManager.diffInMinutes(now, row.initiatedAt),
      requiresManualVerification: row.provider !== PosProvider.PAX,
    }));

    return {
      data,
      meta: {
        serializationOptions: policy.getSerializationOptions({
          clinicId: filter.clinicId,
        }),
      },
    };
  }
}
