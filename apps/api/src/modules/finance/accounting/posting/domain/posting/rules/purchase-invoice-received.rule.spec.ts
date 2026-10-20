import { PurchaseInvoiceReceivedRule } from './purchase-invoice-received.rule';
import { FinancialEvent } from '@modules/finance/accounting/financial-events/domain/entities/financial-event.entity';
import { FinancialEventTypeSchema } from '@shared';
import { UnmappedPurchaseInvoiceAccountException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';

describe('PurchaseInvoiceReceivedRule', () => {
  const rule = new PurchaseInvoiceReceivedRule();

  const makeEvent = (payload: Record<string, unknown>) =>
    new FinancialEvent({
      id: 'evt-1',
      organizationId: 'org-1',
      clinicId: 'clinic-1',
      type: FinancialEventTypeSchema.enum.PURCHASE_INVOICE_RECEIVED,
      occurredAt: new Date('2026-06-17'),
      payload: payload as never,
      sourceModule: 'purchase-invoice',
      sourceRefId: 'pi-1',
      dedupeKey: 'purchase-invoice:pi-1',
      performedById: null,
      createdAt: new Date('2026-06-17'),
    }).toPersistence();

  const sumDebit = (lines: { debit?: string }[]) =>
    lines.reduce((s, l) => s + Number(l.debit ?? 0), 0);
  const sumCredit = (lines: { credit?: string }[]) =>
    lines.reduce((s, l) => s + Number(l.credit ?? 0), 0);

  it('stoklu alış: B 150 + B 191 / A 320 (dengeli, 320 alt defter party)', () => {
    const draft = rule.build(
      makeEvent({
        partyId: 'party-1',
        netTotal: '1000.00',
        vatTotal: '100.00',
        grandTotal: '1100.00',
        lineAccountCode: '150',
      })
    );

    expect(draft.lines).toHaveLength(3);
    expect(draft.lines[0]).toMatchObject({
      accountCode: '150',
      debit: '1000.00',
    });
    expect(draft.lines[1]).toMatchObject({
      accountCode: '191',
      debit: '100.00',
    });
    expect(draft.lines[2]).toMatchObject({
      accountCode: '320',
      partyId: 'party-1',
      credit: '1100.00',
    });
    expect(sumDebit(draft.lines)).toBe(sumCredit(draft.lines));
  });

  it('giderli alış, KDV yok: B 770 / A 320 (191 satırı eklenmez)', () => {
    const draft = rule.build(
      makeEvent({
        partyId: 'party-1',
        netTotal: '500.00',
        vatTotal: '0.00',
        grandTotal: '500.00',
        lineAccountCode: '770',
      })
    );

    expect(draft.lines).toHaveLength(2);
    expect(draft.lines.find((l) => l.accountCode === '191')).toBeUndefined();
    expect(draft.lines[0]).toMatchObject({
      accountCode: '770',
      debit: '500.00',
    });
    expect(draft.lines[1]).toMatchObject({
      accountCode: '320',
      credit: '500.00',
    });
    expect(sumDebit(draft.lines)).toBe(sumCredit(draft.lines));
  });
  // --- Üçüncü kapı: kuralın kendisi (kural 12) ---

  it.each(['102', '329', '120', '740', ''])(
    'kabul kümesinde olmayan karşı hesap (%j) sessizce borca yazılmaz',
    (lineAccountCode) => {
      // Gövde kapı yokken yazılmış olabilir (append-only). Eski kural kodu olduğu
      // gibi borca yazardı: `B 102 / B 191 / A 320` — dengeli, bankada olmayan para.
      expect(() =>
        rule.build(
          makeEvent({
            partyId: 'party-1',
            netTotal: '1000.00',
            vatTotal: '100.00',
            grandTotal: '1100.00',
            lineAccountCode,
          })
        )
      ).toThrow(UnmappedPurchaseInvoiceAccountException);
    }
  );

  it('duran varlık (255) ve gider alt hesabı (740.01) kabul edilir', () => {
    for (const code of ['255', '740.01']) {
      const draft = rule.build(
        makeEvent({
          partyId: 'party-1',
          netTotal: '100.00',
          vatTotal: '0.00',
          grandTotal: '100.00',
          lineAccountCode: code,
        })
      );
      expect(draft.lines[0]).toMatchObject({
        accountCode: code,
        debit: '100.00',
      });
    }
  });
});
