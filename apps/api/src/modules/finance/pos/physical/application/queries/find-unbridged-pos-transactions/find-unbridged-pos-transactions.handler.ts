import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { FindUnbridgedPosTransactionsQuery } from './find-unbridged-pos-transactions.query';
import { FindUnbridgedPosTransactionsResponse } from './find-unbridged-pos-transactions.response';
import {
  IPosTransactionQueryRepository,
  POS_TRANSACTION_QUERY_REPOSITORY,
} from '@modules/finance/pos/physical/domain/repositories/pos-transaction/pos-transaction.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { FindExistingFinancialEventRefsQuery } from '@modules/finance/accounting/financial-events/application/queries/find-existing-financial-event-refs/find-existing-financial-event-refs.query';
import { FINANCIAL_EVENT_SOURCE_MODULES } from '@modules/finance/shared/domain/constants/financial-event-source-modules.constant';

/**
 * Köprüsü kurulmamış POS hareketlerini bulur — satış **ve ters kayıt**.
 *
 * Adaylar bu modülden (başarılı + hastaya bağlı hareketler), "olayı var mı"
 * bilgisi `financial-events` modülünden QueryBus ile gelir: POS modülü
 * `financial_events` tablosunu okumaz (bounded context).
 *
 * Ters kayıtlar listeye sonradan katıldı: iade köprüsü de best-effort yazılıyor
 * ve eksik kalan bir iade, eksik kalan bir tahsilattan **daha tehlikelidir** —
 * geliri fazla gösterir.
 */
@QueryHandler(FindUnbridgedPosTransactionsQuery)
export class FindUnbridgedPosTransactionsHandler implements IQueryHandler<
  FindUnbridgedPosTransactionsQuery,
  FindUnbridgedPosTransactionsResponse
> {
  constructor(
    @Inject(POS_TRANSACTION_QUERY_REPOSITORY)
    private readonly posTransactionQueryRepo: IPosTransactionQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly queryBus: TSQueryBus
  ) {}

  async execute(
    query: FindUnbridgedPosTransactionsQuery
  ): Promise<FindUnbridgedPosTransactionsResponse> {
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
      .orThrow('pos.unbridged');

    const movements =
      await this.posTransactionQueryRepo.findSuccessfulBridgeable({
        clinicId: filter.clinicId,
        from: filter.from,
        to: filter.to,
      });

    const serializationOptions = policy.getSerializationOptions({
      clinicId: filter.clinicId,
    });

    if (movements.length === 0) {
      return { data: [], meta: { serializationOptions } };
    }

    const { data: existingRefs } = await this.queryBus.execute(
      new FindExistingFinancialEventRefsQuery({
        filter: {
          clinicId: filter.clinicId,
          sourceModule: FINANCIAL_EVENT_SOURCE_MODULES.POS,
          sourceRefIds: movements.map((movement) => movement.id),
        },
        ctx,
      })
    );

    const bridged = new Set(existingRefs);

    return {
      data: movements
        .filter((movement) => !bridged.has(movement.id))
        .map((movement) => ({
          posTransactionId: movement.id,
          clinicId: movement.clinicId,
          patientId: movement.patientId,
          amount: movement.amount.toString(),
          currency: movement.currency,
          completedAt: movement.completedAt,
          kind: movement.kind,
          originalPosTransactionId: movement.originalPosTransactionId,
        })),
      meta: { serializationOptions },
    };
  }
}
