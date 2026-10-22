import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { DateTimeManager } from '@common/utils';
import { FinancialEventTypeSchema } from '@shared';
import { GetPayrollAccrualByIdQuery } from './get-payroll-accrual-by-id.query';
import { GetPayrollAccrualByIdResponse } from './get-payroll-accrual-by-id.response';
import { GetFinancialEventByIdQuery } from '@modules/finance/accounting/financial-events/application/queries/get-financial-event-by-id/get-financial-event-by-id.query';
import { GetPartyByIdQuery } from '@modules/finance/party/application/queries/get-party-by-id/get-party-by-id.query';
import { FINANCIAL_EVENT_SOURCE_MODULES } from '@modules/finance/shared/domain/constants/financial-event-source-modules.constant';
import { PayrollAccruedPayload } from '@modules/finance/payroll/domain/contracts/payroll.contracts';

/**
 * Yetki/klinik kontrolü `GetFinancialEventByIdQuery` içinde zaten yapılır —
 * burada tekrarlanmaz. Tip/kaynak modülü eşleşmezse (başka bir olaya ait id)
 * bu bir bordro tahakkuku DEĞİLDİR; 404 yerine `data: null` döner (bu
 * kod tabanındaki detay query konvansiyonu — bkz. GetFinancialEventByIdHandler).
 */
@QueryHandler(GetPayrollAccrualByIdQuery)
export class GetPayrollAccrualByIdHandler implements IQueryHandler<
  GetPayrollAccrualByIdQuery,
  GetPayrollAccrualByIdResponse
> {
  constructor(private readonly queryBus: TSQueryBus) {}

  async execute(
    query: GetPayrollAccrualByIdQuery
  ): Promise<GetPayrollAccrualByIdResponse> {
    const { financialEventId, ctx } = query;

    const { data: event, meta } = await this.queryBus.execute(
      new GetFinancialEventByIdQuery(financialEventId, ctx)
    );

    if (
      !event ||
      event.type !== FinancialEventTypeSchema.enum.PAYROLL_ACCRUED ||
      event.sourceModule !== FINANCIAL_EVENT_SOURCE_MODULES.PAYROLL
    ) {
      return { data: null, meta };
    }

    const payload = event.payload as unknown as PayrollAccruedPayload;

    const { data: party } = await this.queryBus.execute(
      new GetPartyByIdQuery(payload.partyId, ctx)
    );

    return {
      data: {
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
      },
      meta,
    };
  }
}
