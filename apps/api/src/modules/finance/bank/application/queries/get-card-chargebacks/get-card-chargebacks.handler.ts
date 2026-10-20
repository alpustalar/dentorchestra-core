import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetCardChargebacksQuery } from './get-card-chargebacks.query';
import { GetCardChargebacksResponse } from './get-card-chargebacks.response';
import {
  CARD_CHARGEBACK_QUERY_REPOSITORY,
  ICardChargebackQueryRepository,
} from '@modules/finance/bank/domain/repositories/card-chargeback/card-chargeback.repository';
import { buildPaginationMeta } from '@src/infrastructure/persistence/prisma/helpers';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

/**
 * Kart itirazı listesi — açık itirazlar (delil son günü yaklaşanlar dahil) bir
 * ekranın baktığı tek yer. Salt okuma; hiçbir mutasyona karar vermez.
 */
@QueryHandler(GetCardChargebacksQuery)
export class GetCardChargebacksHandler implements IQueryHandler<
  GetCardChargebacksQuery,
  GetCardChargebacksResponse
> {
  constructor(
    @Inject(CARD_CHARGEBACK_QUERY_REPOSITORY)
    private readonly chargebackQueryRepo: ICardChargebackQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetCardChargebacksQuery
  ): Promise<GetCardChargebacksResponse> {
    const { filter, pagination, ctx } = query.payload;

    // Verilmezse aktörün kendi kliniği; verilirse aktörün o kliniğin finansına
    // erişimi doğrulanır (istek gövdesinden gelen kimlik güvenilmez).
    const clinicId = filter.clinicId ?? ctx.actor.clinicId ?? '';

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check((p) => p.canAccessClinicFinances(clinicId))
      .orThrow('bank.card-chargeback.list');

    const result = await this.chargebackQueryRepo.findByClinic({
      clinicId,
      status: filter.status,
      pagination,
    });

    return {
      data: result.items,
      meta: {
        pagination: buildPaginationMeta(pagination, result.total),
        serializationOptions: policy.getSerializationOptions({ clinicId }),
      },
    };
  }
}
