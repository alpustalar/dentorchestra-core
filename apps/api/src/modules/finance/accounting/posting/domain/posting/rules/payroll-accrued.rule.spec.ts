import { PayrollAccruedRule } from './payroll-accrued.rule';
import { FinancialEvent } from '@modules/finance/accounting/financial-events/domain/entities/financial-event.entity';
import { FinancialEventTypeSchema } from '@shared';

describe('PayrollAccruedRule', () => {
  const rule = new PayrollAccruedRule();

  const makeEvent = (payload: Record<string, unknown>) =>
    new FinancialEvent({
      id: 'evt-1',
      organizationId: 'org-1',
      clinicId: 'clinic-1',
      type: FinancialEventTypeSchema.enum.PAYROLL_ACCRUED,
      occurredAt: new Date('2026-06-30'),
      payload: payload as never,
      sourceModule: 'payroll',
      sourceRefId: 'usr-1',
      dedupeKey: 'payroll-accrual:usr-1:2026-06',
      performedById: null,
      createdAt: new Date('2026-06-30'),
    }).toPersistence();

  it('B 770×2 / A 335 + 360 + 361 (dengeli; 361 = işçi + işveren SGK)', () => {
    // Brüt 10000 = net 7000 + stopaj 1500 + işçi SGK 1500; işveren SGK 2000.
    const draft = rule.build(
      makeEvent({
        partyId: 'party-1',
        grossSalary: '10000.00',
        employerSgk: '2000.00',
        netPayable: '7000.00',
        taxWithholding: '1500.00',
        employeeSgk: '1500.00',
      })
    );

    expect(draft.lines).toHaveLength(5);
    expect(draft.lines[0]).toMatchObject({
      accountCode: '770',
      debit: '10000.00',
    });
    expect(draft.lines[1]).toMatchObject({
      accountCode: '770',
      debit: '2000.00',
    });
    expect(draft.lines[2]).toMatchObject({
      accountCode: '335',
      partyId: 'party-1',
      credit: '7000.00',
    });
    expect(draft.lines[3]).toMatchObject({
      accountCode: '360',
      credit: '1500.00',
    });
    // 361 = işçi SGK 1500 + işveren SGK 2000 = 3500
    expect(draft.lines[4]).toMatchObject({
      accountCode: '361',
      credit: '3500.00',
    });

    const debit = draft.lines.reduce((s, l) => s + Number(l.debit ?? 0), 0);
    const credit = draft.lines.reduce((s, l) => s + Number(l.credit ?? 0), 0);
    expect(debit).toBe(12000);
    expect(debit).toBe(credit);
  });
});
