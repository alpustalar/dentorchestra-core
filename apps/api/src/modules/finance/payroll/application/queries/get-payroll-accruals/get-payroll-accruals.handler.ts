import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { DateTimeManager } from '@common/utils';
import { FinancialEventTypeSchema } from '@shared';
import { GetPayrollAccrualsQuery } from './get-payroll-accruals.query';
import { GetPayrollAccrualsResponse } from './get-payroll-accruals.response';
import { GetFinancialEventsQuery } from '@modules/finance/accounting/financial-events/application/queries/get-financial-events/get-financial-events.query';
import { FindPartiesByIdsQuery } from '@modules/finance/party/application/queries/find-parties-by-ids/find-parties-by-ids.query';
import { FINANCIAL_EVENT_SOURCE_MODULES } from '@modules/finance/shared/domain/constants/financial-event-source-modules.constant';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  PayrollAccrual,
  PayrollAccruedPayload,
} from '@modules/finance/payroll/domain/contracts/payroll.contracts';

/**
 * Bordro tahakkuku geçmişi — kalıcı tablo yok (doc 05 §2.9): finansal olay
 * defterinden (`PAYROLL_ACCRUED`) okunur, isim için `partyId` Party modülünden
 * (bounded-context, QueryBus) çözülür.
 */
@QueryHandler(GetPayrollAccrualsQuery)
export class GetPayrollAccrualsHandler implements IQueryHandler<
  GetPayrollAccrualsQuery,
  GetPayrollAccrualsResponse
> {
  constructor(
    private readonly queryBus: TSQueryBus,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetPayrollAccrualsQuery
  ): Promise<GetPayrollAccrualsResponse> {
    const { clinicId, employeeUserId, monthKey, pagination, ctx } =
      query.payload;

    // Serileştirme grupları aynı policy+clinicId'den geldiği için aşağıdaki
    // GetFinancialEventsQuery çağrısının meta.serializationOptions'ı yeniden
    // kullanılır (policy burada yalnız yetki kontrolü için gerekir).
    const { evaluator } = this.policyFactory.finance(ctx.actor, ctx.source);
    evaluator
      .check((p) => p.canAccessClinicFinances(clinicId))
      .orThrow('payroll.accruals');

    // Altyapı yalnız sourceRefId EŞİTLİĞİNİ bilir — kısmi filtre yoktur; HTTP
    // sınırındaki şema employeeUserId/monthKey'i birlikte ya da hiç zorlar.
    const sourceRefId =
      employeeUserId && monthKey
        ? FinancialEventDedupeKeys.payroll_accrual(employeeUserId, monthKey)
        : undefined;

    const { data: events, meta } = await this.queryBus.execute(
      new GetFinancialEventsQuery({
        clinicId,
        pagination,
        ctx,
        type: FinancialEventTypeSchema.enum.PAYROLL_ACCRUED,
        sourceModule: FINANCIAL_EVENT_SOURCE_MODULES.PAYROLL,
        sourceRefId,
      })
    );

    const partyIds = [
      ...new Set(
        events.map(
          (event) => (event.payload as unknown as PayrollAccruedPayload).partyId
        )
      ),
    ];

    const { data: parties } = partyIds.length
      ? await this.queryBus.execute(
          new FindPartiesByIdsQuery({ clinicId, ids: partyIds, ctx })
        )
      : { data: [] };

    const partyById = new Map(parties.map((party) => [party.id, party]));

    const items: PayrollAccrual[] = events.map((event) => {
      const payload = event.payload as unknown as PayrollAccruedPayload;
      const party = partyById.get(payload.partyId) ?? null;

      return {
        financialEventId: event.id,
        clinicId: event.clinicId,
        partyId: payload.partyId,
        employeeUserId: party?.originId ?? null,
        employeeName: party?.name ?? null,
        monthKey: DateTimeManager.toMonthKey(event.occurredAt),
        accrualDate: event.occurredAt,
        grossSalary: payload.grossSalary,
        employerSgk: payload.employerSgk,
        netPayable: payload.netPayable,
        taxWithholding: payload.taxWithholding,
        employeeSgk: payload.employeeSgk,
        dedupeKey: event.dedupeKey,
        createdAt: event.createdAt,
      };
    });

    return { data: items, meta };
  }
}
