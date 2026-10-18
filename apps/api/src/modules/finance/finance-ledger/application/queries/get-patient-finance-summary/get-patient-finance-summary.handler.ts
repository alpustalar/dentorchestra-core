import { FINANCE_LEDGER_EVENTS } from '@src/domain/constants/events';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetPatientFinanceSummaryQuery } from './get-patient-finance-summary.query';
import { GetPatientFinanceSummaryQueryResponse } from './get-patient-finance-summary.response';
import { Inject } from '@nestjs/common';
import { ExecutionPolicy } from '@src/domain/common/execution/execution.policy';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { FindPatientByIdQuery } from '@modules/crm/patient/application/queries/find-patient-by-id/find-patient-by-id.query';
import {
  FINANCE_LEDGER_QUERY_REPOSITORY,
  IFinanceLedgerQueryRepository,
} from '@modules/finance/finance-ledger/domain/repositories/finance-ledger/finance-ledger.query.repository';
import { IGetContext } from '@common/decorators/get-context.decorator';

interface GetSummaryInput {
  patientId: string;
  clinicId: string;
  ctx: IGetContext;
}

@QueryHandler(GetPatientFinanceSummaryQuery)
export class GetPatientFinanceSummaryHandler implements IQueryHandler<
  GetPatientFinanceSummaryQuery,
  GetPatientFinanceSummaryQueryResponse
> {
  constructor(
    @Inject(FINANCE_LEDGER_QUERY_REPOSITORY)
    private readonly financeLedgerRepository: IFinanceLedgerQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly queryBus: TSQueryBus
  ) {}

  async execute(
    query: GetPatientFinanceSummaryQuery
  ): Promise<GetPatientFinanceSummaryQueryResponse> {
    const { patientId, ctx } = query;
    const { actor, source } = ctx;

    // system-initiated ise patient.clinicId ulaşıp policye sokmak gereksiz. direkt veriyi çekiyoruz.

    if (ExecutionPolicy.isSystemInitiated(source)) {
      return await this.getSummary({
        patientId,
        clinicId: actor.clinicId ?? '',
        ctx,
      });
    }

    const { data: patient } = await this.queryBus.execute(
      new FindPatientByIdQuery(patientId, ctx)
    );

    if (!patient) throw new Error('Hasta bilgisine ulaşılamadı');

    this.policyFactory
      .user(actor, source)
      .evaluator.check(
        (p) => p.isTargetInActorsSameClinic(patient.clinicId),
        'Görüntülemek için misafirinizle aynı klinikte olmalısınız'
      )
      .orThrow(FINANCE_LEDGER_EVENTS.PATIENT_SUMMARY);

    return this.getSummary({
      patientId,
      clinicId: patient.clinicId ?? '',
      ctx,
    });
  }

  private async getSummary({ patientId, clinicId, ctx }: GetSummaryInput) {
    const summary =
      await this.financeLedgerRepository.getPatientSummary(patientId);

    return {
      data: summary,
      meta: {
        serializationOptions: this.policyFactory
          .finance(ctx.actor, ctx.source)
          .policy.getSerializationOptions({ clinicId }),
      },
    };
  }
}
