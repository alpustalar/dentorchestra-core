import { SalesInvoiceIssuedRule } from './sales-invoice-issued.rule';
import { FinancialEvent } from '@modules/finance/accounting/financial-events/domain/entities/financial-event.entity';
import { FinancialEventTypeSchema } from '@shared';

describe('SalesInvoiceIssuedRule', () => {
  const rule = new SalesInvoiceIssuedRule();

  const makeEvent = (payload: Record<string, unknown>) =>
    new FinancialEvent({
      id: 'evt-1',
      organizationId: 'org-1',
      clinicId: 'clinic-1',
      type: FinancialEventTypeSchema.enum.SALES_INVOICE_ISSUED,
      occurredAt: new Date('2026-06-17'),
      payload: payload as never,
      sourceModule: 'invoice',
      sourceRefId: 'inv-1',
      dedupeKey: 'sales-invoice:inv-1',
      performedById: null,
      createdAt: new Date('2026-06-17'),
    }).toPersistence();

  const sumDebit = (lines: { debit?: string }[]) =>
    lines.reduce((s, l) => s + Number(l.debit ?? 0), 0);
  const sumCredit = (lines: { credit?: string }[]) =>
    lines.reduce((s, l) => s + Number(l.credit ?? 0), 0);

  it('KURUM / nihai tüketici (stopaj yok): B 120 / A 600 + 391', () => {
    const draft = rule.build(
      makeEvent({
        partyId: 'party-1',
        netTotal: '1000.00',
        vatTotal: '100.00',
        grandTotal: '1100.00',
      })
    );

    expect(draft.lines).toHaveLength(3);
    expect(draft.lines.find((l) => l.accountCode === '193')).toBeUndefined();
    expect(draft.lines[0]).toMatchObject({
      accountCode: '120',
      partyId: 'party-1',
      debit: '1100.00',
    });
    expect(draft.lines[1]).toMatchObject({
      accountCode: '600.01',
      credit: '1000.00',
    });
    expect(draft.lines[2]).toMatchObject({
      accountCode: '391',
      credit: '100.00',
    });
    expect(sumDebit(draft.lines)).toBe(sumCredit(draft.lines));
  });

  it('SMM / ödeyen vergi sorumlusu (stopaj): B 120 (grand−stopaj) + 193 / A 600 + 391', () => {
    // net 1000, KDV 100, grand 1100, stopaj %20 = 200 → 120 tahsil 900.
    const draft = rule.build(
      makeEvent({
        partyId: 'party-1',
        netTotal: '1000.00',
        vatTotal: '100.00',
        grandTotal: '1100.00',
        withholdingTotal: '200.00',
      })
    );

    expect(draft.lines).toHaveLength(4);
    expect(draft.lines[0]).toMatchObject({
      accountCode: '120',
      partyId: 'party-1',
      debit: '900.00',
    });
    expect(draft.lines[1]).toMatchObject({
      accountCode: '193',
      debit: '200.00',
    });
    expect(draft.lines[2]).toMatchObject({
      accountCode: '600.01',
      credit: '1000.00',
    });
    expect(draft.lines[3]).toMatchObject({
      accountCode: '391',
      credit: '100.00',
    });
    // Denge: (900 + 200) borç = (1000 + 100) alacak.
    expect(sumDebit(draft.lines)).toBe(1100);
    expect(sumDebit(draft.lines)).toBe(sumCredit(draft.lines));
  });
});
