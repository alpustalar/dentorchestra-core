/*
 * Jest mock'ları tiplenmemiş (`any`) nesneler taşır; kurallar yalnız bu
 * dosyada kapatılır.
 */
/* eslint-disable @typescript-eslint/require-await */
import { randomUUID } from 'crypto';
import { GetPayrollAccrualByIdHandler } from './get-payroll-accrual-by-id.handler';
import { GetPayrollAccrualByIdQuery } from './get-payroll-accrual-by-id.query';
import { GetFinancialEventByIdQuery } from '@modules/finance/accounting/financial-events/application/queries/get-financial-event-by-id/get-financial-event-by-id.query';
import { GetPartyByIdQuery } from '@modules/finance/party/application/queries/get-party-by-id/get-party-by-id.query';
import { FinancialEventTypeSchema } from '@shared';
import { FINANCIAL_EVENT_SOURCE_MODULES } from '@modules/finance/shared/domain/constants/financial-event-source-modules.constant';

describe('GetPayrollAccrualByIdHandler', () => {
  const clinicId = randomUUID();
  const partyId = randomUUID();
  const financialEventId = randomUUID();
  const ctx = { actor: {}, source: 'WEB' } as never;

  const payrollEvent = {
    id: financialEventId,
    clinicId,
    type: FinancialEventTypeSchema.enum.PAYROLL_ACCRUED,
    sourceModule: FINANCIAL_EVENT_SOURCE_MODULES.PAYROLL,
    occurredAt: new Date('2026-10-15'),
    createdAt: new Date('2026-10-15'),
    dedupeKey: 'payroll-accrual:uid-1:2026-10',
    payload: {
      partyId,
      grossSalary: '50000.00',
      employerSgk: '10000.00',
      netPayable: '35000.00',
      taxWithholding: '4000.00',
      employeeSgk: '1000.00',
    },
  };

  const make = (event: unknown = payrollEvent) => {
    const queryBus = {
      execute: jest.fn(async (query: unknown) => {
        if (query instanceof GetFinancialEventByIdQuery) {
          return { data: event, meta: {} };
        }
        if (query instanceof GetPartyByIdQuery) {
          return {
            data: { id: partyId, name: 'Ayşe Yılmaz', originId: 'uid-1' },
          };
        }
        throw new Error('beklenmeyen query');
      }),
    };

    return {
      handler: new GetPayrollAccrualByIdHandler(queryBus as never),
      queryBus,
    };
  };

  it('bordro tahakkukunu Party adıyla zenginleştirip döner', async () => {
    const { handler } = make();

    const result = await handler.execute(
      new GetPayrollAccrualByIdQuery(financialEventId, ctx)
    );

    expect(result.data).toEqual(
      expect.objectContaining({
        financialEventId,
        employeeUserId: 'uid-1',
        employeeName: 'Ayşe Yılmaz',
        grossSalary: '50000.00',
      })
    );
  });

  it('olay bulunamazsa null döner', async () => {
    const { handler, queryBus } = make(null);

    const result = await handler.execute(
      new GetPayrollAccrualByIdQuery(financialEventId, ctx)
    );

    expect(result.data).toBeNull();
    expect(queryBus.execute).toHaveBeenCalledTimes(1);
  });

  it("başka bir olay tipine ait id için null döner (Party'e hiç gitmez)", async () => {
    const { handler, queryBus } = make({
      ...payrollEvent,
      type: FinancialEventTypeSchema.enum.MANUAL_JOURNAL,
    });

    const result = await handler.execute(
      new GetPayrollAccrualByIdQuery(financialEventId, ctx)
    );

    expect(result.data).toBeNull();
    expect(queryBus.execute).toHaveBeenCalledTimes(1);
  });

  it('başka bir kaynak modülüne ait id için null döner', async () => {
    const { handler } = make({
      ...payrollEvent,
      sourceModule: FINANCIAL_EVENT_SOURCE_MODULES.SUPPLIER_PAYMENT,
    });

    const result = await handler.execute(
      new GetPayrollAccrualByIdQuery(financialEventId, ctx)
    );

    expect(result.data).toBeNull();
  });
});
