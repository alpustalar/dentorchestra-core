import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DateTimeManager } from '@common/utils';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { EnsurePartyForEmployeeCommand } from '@modules/finance/party/application/commands/ensure-party-for-employee/ensure-party-for-employee.command';
import { RecordFinancialEventCommand } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.command';
import { FinancialEventTypeSchema, ITenantScopeResolver } from '@shared';
import { RecordPayrollAccrualCommand } from './record-payroll-accrual.command';
import { ExecutionContextFactory } from '@src/domain/common/execution/execution-context.factory';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { PayrollBreakdown } from '@modules/finance/shared/domain/value-objects/payroll-breakdown.vo';
import { FINANCIAL_EVENT_SOURCE_MODULES } from '@modules/finance/shared/domain/constants/financial-event-source-modules.constant';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';
import { TENANT_SCOPE_RESOLVER } from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import {
  IPeriodGateService,
  PERIOD_GATE_SERVICE,
} from '@modules/finance/accounting/periods/domain/services/period-gate/period-gate.service.interface';

@CommandHandler(RecordPayrollAccrualCommand)
export class RecordPayrollAccrualHandler implements ICommandHandler<
  RecordPayrollAccrualCommand,
  string
> {
  constructor(
    private readonly txManager: TransactionManager,
    private readonly commandBus: TSCommandBus,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    @Inject(PERIOD_GATE_SERVICE)
    private readonly periodGate: IPeriodGateService
  ) {}

  async execute(command: RecordPayrollAccrualCommand): Promise<string> {
    const { data, ctx } = command;

    const organizationId = await this.tenantScopeResolver.resolve(data);

    this.policyFactory
      .clinic(ctx.actor, ctx.source)
      .evaluator.check((p) =>
        p.actorCanAccessClinicOrOwnsOrganization(data.clinicId, organizationId)
      )
      .orThrow();

    // Tahakkuk tarihi kullanıcıdan geliyor ve dönemi belirliyor: kapanmış bir
    // döneme tahakkuk kabul edilse olay yazılır, fişi hiç üretilemez (335/360/361
    // borçları defterde hiç doğmaz) ve append-only gövde düzeltilemez.
    await this.periodGate.assertPeriodNotSealedAt({
      clinicId: data.clinicId,
      date: data.accrualDate,
    });

    const payrollBreakDown = PayrollBreakdown.create({
      grossSalary: data.grossSalary,
      netPayable: data.netPayable,
      taxWithholding: data.taxWithholding,
      employeeSgk: data.employeeSgk,
      employerSgk: data.employerSgk,
    }).orThrow();

    const internalCtx = ExecutionContextFactory.createInternal();

    // Köprü kritik (finansal kayıt) → outboxRun ile atomik. Persist edilen başka kayıt
    // yok; köprü hatası komutu hataya düşürür (kısmi durum oluşmaz).
    return this.txManager.outboxRun(async () => {
      const { partyId } = await this.commandBus.execute(
        new EnsurePartyForEmployeeCommand({
          clinicId: data.clinicId,
          organizationId,
          userId: data.employeeUserId,
          ctx: internalCtx,
        })
      );

      const monthKey = DateTimeManager.toMonthKey(data.accrualDate);

      return this.commandBus.execute(
        new RecordFinancialEventCommand(
          {
            clinicId: data.clinicId,
            type: FinancialEventTypeSchema.enum.PAYROLL_ACCRUED,
            occurredAt: data.accrualDate,
            payload: {
              partyId,
              grossSalary: payrollBreakDown.grossSalary,
              employerSgk: payrollBreakDown.employerSgk,
              netPayable: payrollBreakDown.netPayable,
              taxWithholding: payrollBreakDown.taxWithholding,
              employeeSgk: payrollBreakDown.employeeSgk,
            },
            sourceModule: FINANCIAL_EVENT_SOURCE_MODULES.PAYROLL,
            // Tahakkuk kaydı için ayrı bir persist edilmiş belge yok; doğal anahtar
            // (personel + ay) olduğundan sourceRefId de aya özgü olmalı — aksi halde
            // personelin tüm bordro geçmişi tek ID'ye çöker ve aya inilemez.
            sourceRefId: FinancialEventDedupeKeys.payroll_accrual(
              data.employeeUserId,
              monthKey
            ),
            dedupeKey: FinancialEventDedupeKeys.payroll_accrual(
              data.employeeUserId,
              monthKey
            ),
          },
          internalCtx
        )
      );
    });
  }
}
