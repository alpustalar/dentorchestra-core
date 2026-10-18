/*
 * Jest mock'ları tiplenmemiş nesneler taşır: bus/servis taklitleri gerçek
 * sözleşmeyi değil yalnız testin ihtiyaç duyduğu yüzeyi kurar. Kurallar YALNIZ
 * bu dosyada kapatılır; üretim kodunda açık kalır.
 */
/* eslint-disable @typescript-eslint/require-await */
import { RecordPayrollAccrualHandler } from './record-payroll-accrual.handler';
import { RecordPayrollAccrualCommand } from './record-payroll-accrual.command';
import { RecordFinancialEventCommand } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.command';
import { EnsurePartyForEmployeeCommand } from '@modules/finance/party/application/commands/ensure-party-for-employee/ensure-party-for-employee.command';
import { PeriodSealedForDateException } from '@modules/finance/accounting/periods/domain/exceptions/period.exceptions';
import { UnbalancedPayrollBreakdownException } from '@modules/finance/shared/domain/exceptions/payroll-breakdown.exceptions';
import { LogSource } from '@src/domain/constants/log-action.constant';
import type { RecordPayrollAccrual } from '@shared/modules/payroll/types/commands';

const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
const ORG_ID = '22222222-2222-4222-8222-222222222222';
const EMPLOYEE_UID = 'kZ9Xq2mLpR7tS4vW1yB3nC6dE8fG';

const ctx = {
  actor: { userId: 'uid-1', source: LogSource.WEB, clinicId: CLINIC_ID },
  source: 'USER_ACTION',
} as never;

const dataOf = (overrides: Partial<RecordPayrollAccrual> = {}) =>
  ({
    employeeUserId: EMPLOYEE_UID,
    clinicId: CLINIC_ID,
    accrualDate: new Date('2026-10-01'),
    grossSalary: 30000,
    employerSgk: 6150,
    netPayable: 24000,
    taxWithholding: 2000,
    employeeSgk: 4000,
    ...overrides,
  }) as RecordPayrollAccrual;

const make = (options: { periodSealed?: boolean } = {}) => {
  const commandBus = {
    execute: jest.fn(async (cmd: unknown) => {
      if (cmd instanceof EnsurePartyForEmployeeCommand) {
        return { partyId: 'party-1' };
      }
      return 'event-1';
    }),
  };
  const txManager = {
    outboxRun: jest.fn((cb: () => Promise<unknown>) => cb()),
  };
  const policyFactory = {
    clinic: () => ({
      evaluator: { check: () => ({ orThrow: () => undefined }) },
    }),
  };
  const tenantScopeResolver = { resolve: jest.fn(async () => ORG_ID) };
  const periodGate = {
    assertPeriodNotSealedAt: jest.fn(async () => {
      if (options.periodSealed) {
        throw new PeriodSealedForDateException({
          clinicId: CLINIC_ID,
          date: new Date('2026-10-01'),
          year: 2026,
          currentStatus: 'LOCKED',
        });
      }
    }),
  };

  const handler = new RecordPayrollAccrualHandler(
    txManager as never,
    commandBus as never,
    policyFactory as never,
    tenantScopeResolver as never,
    periodGate as never
  );

  return { handler, commandBus, txManager, periodGate };
};

describe('RecordPayrollAccrualHandler', () => {
  it('tahakkuku ekonomik olay olarak yazar; dedupe anahtarı personel + ay', async () => {
    const { handler, commandBus } = make();

    await handler.execute(new RecordPayrollAccrualCommand(dataOf(), ctx));

    const call = commandBus.execute.mock.calls.find(
      ([c]) => c instanceof RecordFinancialEventCommand
    );
    const cmd = call![0] as RecordFinancialEventCommand;

    expect(cmd.data.dedupeKey).toContain(EMPLOYEE_UID);
    expect(cmd.data.dedupeKey).toContain('2026-10');
    // Tutarlar gövdeye kuruş ölçeğinde string olarak geçer (payload kapısı).
    expect(cmd.data.payload).toMatchObject({
      grossSalary: '30000.00',
      netPayable: '24000.00',
    });
  });

  it('tahakkuk tarihi mühürlenmiş döneme düşüyorsa hiçbir şey yazılmaz', async () => {
    // Kabul edilse olay yazılır ama fişi hiç üretilemez: 335/360/361 borçları
    // defterde doğmaz ve append-only gövde sonradan düzeltilemez.
    const { handler, commandBus, txManager } = make({ periodSealed: true });

    await expect(
      handler.execute(new RecordPayrollAccrualCommand(dataOf(), ctx))
    ).rejects.toBeInstanceOf(PeriodSealedForDateException);

    expect(txManager.outboxRun).not.toHaveBeenCalled();
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('kapı, kullanıcının verdiği tahakkuk tarihine bakar (bugüne değil)', async () => {
    const { handler, periodGate } = make();
    const accrualDate = new Date('2026-09-30');

    await handler.execute(
      new RecordPayrollAccrualCommand(dataOf({ accrualDate }), ctx)
    );

    expect(periodGate.assertPeriodNotSealedAt).toHaveBeenCalledWith({
      clinicId: CLINIC_ID,
      date: accrualDate,
    });
  });

  it('denge özdeşliği tutmayan döküm reddedilir', async () => {
    const { handler } = make();

    await expect(
      handler.execute(
        new RecordPayrollAccrualCommand(dataOf({ netPayable: 1 }), ctx)
      )
    ).rejects.toBeInstanceOf(UnbalancedPayrollBreakdownException);
  });
});
