/*
 * Jest mock'ları tiplenmemiş (`any`) nesneler taşır; kurallar yalnız bu
 * dosyada kapatılır.
 */
/* eslint-disable @typescript-eslint/require-await */
import { randomUUID } from 'crypto';
import { GetPayrollAccrualsHandler } from './get-payroll-accruals.handler';
import { GetPayrollAccrualsQuery } from './get-payroll-accruals.query';
import { GetFinancialEventsQuery } from '@modules/finance/accounting/financial-events/application/queries/get-financial-events/get-financial-events.query';
import { FindPartiesByIdsQuery } from '@modules/finance/party/application/queries/find-parties-by-ids/find-parties-by-ids.query';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';

describe('GetPayrollAccrualsHandler', () => {
  const clinicId = randomUUID();
  const partyId = randomUUID();
  const employeeUserId = 'firebase-uid-1';
  const monthKey = '2026-10';
  const pagination = { page: 1, limit: 20 } as never;
  const ctx = { actor: {}, source: 'WEB' } as never;

  const financialEvent = {
    id: randomUUID(),
    clinicId,
    occurredAt: new Date('2026-10-15'),
    createdAt: new Date('2026-10-15'),
    dedupeKey: FinancialEventDedupeKeys.payroll_accrual(
      employeeUserId,
      monthKey
    ),
    payload: {
      partyId,
      grossSalary: '50000.00',
      employerSgk: '10000.00',
      netPayable: '35000.00',
      taxWithholding: '4000.00',
      employeeSgk: '1000.00',
    },
  };

  const make = (canAccess = true) => {
    const queryBus = {
      execute: jest.fn(async (query: unknown) => {
        if (query instanceof GetFinancialEventsQuery) {
          return { data: [financialEvent], meta: { pagination: {} } };
        }
        if (query instanceof FindPartiesByIdsQuery) {
          return {
            data: [
              { id: partyId, name: 'Ayşe Yılmaz', originId: employeeUserId },
            ],
          };
        }
        throw new Error('beklenmeyen query');
      }),
    };
    const policyFactory = {
      finance: () => ({
        evaluator: {
          check: (predicate: (p: unknown) => boolean, message?: string) => ({
            orThrow: () => {
              if (!predicate({ canAccessClinicFinances: () => canAccess })) {
                throw new Error(message ?? 'yetkisiz');
              }
            },
          }),
        },
        policy: {
          getSerializationOptions: jest.fn(() => ({
            groups: [],
            isGroupActive: true,
          })),
        },
      }),
    };

    return {
      handler: new GetPayrollAccrualsHandler(
        queryBus as never,
        policyFactory as never
      ),
      queryBus,
    };
  };

  it('finansal olayı Party adıyla zenginleştirir', async () => {
    const { handler } = make();

    const result = await handler.execute(
      new GetPayrollAccrualsQuery({ clinicId, pagination, ctx })
    );

    expect(result.data).toEqual([
      expect.objectContaining({
        financialEventId: financialEvent.id,
        employeeUserId,
        employeeName: 'Ayşe Yılmaz',
        monthKey: '2026-10',
        grossSalary: '50000.00',
      }),
    ]);
  });

  it('employeeUserId+monthKey verildiğinde sourceRefId eşitliğiyle filtreler', async () => {
    const { handler, queryBus } = make();

    await handler.execute(
      new GetPayrollAccrualsQuery({
        clinicId,
        employeeUserId,
        monthKey,
        pagination,
        ctx,
      })
    );

    const [financialEventsCall] = queryBus.execute.mock.calls;
    const dispatchedQuery = financialEventsCall[0] as GetFinancialEventsQuery;
    expect(dispatchedQuery.payload.sourceRefId).toBe(
      FinancialEventDedupeKeys.payroll_accrual(employeeUserId, monthKey)
    );
  });

  it('çözülemeyen Party için employeeUserId/employeeName null döner', async () => {
    const { handler, queryBus } = make();
    queryBus.execute.mockImplementation(async (query: unknown) => {
      if (query instanceof GetFinancialEventsQuery) {
        return { data: [financialEvent], meta: { pagination: {} } };
      }
      if (query instanceof FindPartiesByIdsQuery) {
        return { data: [] };
      }
      throw new Error('beklenmeyen query');
    });

    const result = await handler.execute(
      new GetPayrollAccrualsQuery({ clinicId, pagination, ctx })
    );

    expect(result.data[0].employeeUserId).toBeNull();
    expect(result.data[0].employeeName).toBeNull();
  });

  it("şubeye erişimi olmayan aktör için queryBus'a hiç gitmez", async () => {
    const { handler, queryBus } = make(false);

    await expect(
      handler.execute(
        new GetPayrollAccrualsQuery({ clinicId, pagination, ctx })
      )
    ).rejects.toThrow();
    expect(queryBus.execute).not.toHaveBeenCalled();
  });
});
