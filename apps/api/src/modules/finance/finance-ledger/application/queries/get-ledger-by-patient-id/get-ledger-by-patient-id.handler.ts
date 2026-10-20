import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetLedgerByPatientIdQuery } from './get-ledger-by-patient-id.query';
import { GetLedgerByPatientIdQueryResponse } from './get-ledger-by-patient-id.response';
import { Inject } from '@nestjs/common';
import { buildPaginationMeta } from '@src/infrastructure/persistence/prisma/helpers';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import {
  FINANCE_LEDGER_QUERY_REPOSITORY,
  IFinanceLedgerQueryRepository,
} from '@modules/finance/finance-ledger/domain/repositories/finance-ledger/finance-ledger.query.repository';
import { FINANCE_LEDGER_EVENTS } from '@src/domain/constants/events';
import { GetPatientByIdQuery } from '@modules/crm/patient/application/queries/get-patient-by-id/get-patient-by-id.query';

@QueryHandler(GetLedgerByPatientIdQuery)
export class GetLedgerByPatientIdHandler
  implements
    IQueryHandler<GetLedgerByPatientIdQuery, GetLedgerByPatientIdQueryResponse>
{
  constructor(
    @Inject(FINANCE_LEDGER_QUERY_REPOSITORY)
    private readonly financeLedgerRepository: IFinanceLedgerQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly queryBus: TSQueryBus
  ) {}

  async execute(
    query: GetLedgerByPatientIdQuery
  ): Promise<GetLedgerByPatientIdQueryResponse> {
    const { patientId, pagination, ctx } = query.payload;

    const { data: patient } = await this.queryBus.execute(
      new GetPatientByIdQuery(patientId, ctx)
    );

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    // Hastanın kliniği cari hareketlerin sahibi — erişim oradan doğrulanır.
    evaluator
      .check(
        (p) => p.canAccessClinicFinances(patient?.clinicId ?? undefined),
        'Bu hastanın cari hareketlerine erişim yetkiniz yok.'
      )
      .orThrow(FINANCE_LEDGER_EVENTS.PATIENT_LEDGER);

    const { items, total } =
      await this.financeLedgerRepository.findManyByPatientIdWithDetails(
        patientId,
        pagination
      );

    return {
      data: items,
      meta: {
        pagination: buildPaginationMeta(pagination, total),
        serializationOptions: policy.getSerializationOptions({
          clinicId: patient?.clinicId ?? '',
        }),
      },
    };
  }
}
