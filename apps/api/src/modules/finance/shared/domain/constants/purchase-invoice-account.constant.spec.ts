import {
  DEFAULT_PURCHASE_INVOICE_LINE_ACCOUNT_CODE,
  PURCHASE_INVOICE_LINE_ACCOUNT_CODES,
  PURCHASE_INVOICE_STOCK_ACCOUNT_CODES,
  isPurchaseInvoiceLineAccountCode,
  isPurchaseInvoiceStockAccountCode,
} from '@shared/common/constants';
import { RecordPurchaseInvoiceSchema } from '@shared/modules/purchase-invoice/schemas/commands/record-purchase-invoice.schema';
import { CLINIC_CHART_OF_ACCOUNTS_TEMPLATE } from '@modules/finance/accounting/chart-of-accounts/domain/constants/clinic-chart-of-accounts.template';
import { validateFinancialEventPayload } from '@modules/finance/shared/domain/contracts/financial-event-payload.schemas';
import { FinancialEventTypeSchema } from '@shared';

/**
 * Alış faturası karşı hesabı kabul kümesinin **şablonla sözleşmesi** (kural 12).
 *
 * Kümeyi ve hesap planını iki ayrı yerde tutmak "yazılabilen ama fişlenemeyen" ya da
 * daha kötüsü "yazılabilen ve YANLIŞ hesabı hareket ettiren" bir kod üretir. Bu suite
 * kümenin her üyesinin şablonda **var, postlanabilir ve borç karakterli** olduğunu,
 * başka bir akışa ait hiçbir hesabın içinde bulunmadığını kilitler.
 */
describe('PURCHASE_INVOICE_LINE_ACCOUNT_CODES — şablon sözleşmesi', () => {
  const byCode = new Map(
    CLINIC_CHART_OF_ACCOUNTS_TEMPLATE.map((a) => [a.code, a])
  );

  it.each([...PURCHASE_INVOICE_LINE_ACCOUNT_CODES])(
    '%s şablonda var, postlanabilir, cari istemez ve borç karakterli',
    (code) => {
      const account = byCode.get(code);

      expect(account).toBeDefined();
      expect(account!.isPostable).toBe(true);
      // Fatura satırı carisiz üretilir; `requiresParty` hesap satırı reddettirirdi.
      expect(account!.requiresParty ?? false).toBe(false);
      expect(account!.normalSide).toBe('DEBIT');
      expect(['ASSET', 'EXPENSE']).toContain(account!.type);
    }
  );

  it('başka bir akışa ait hesaplar kümede YOK (329 dahil)', () => {
    const forbidden = [
      '100', // kasa
      '102', // banka — `B 102 / A 320` bankada olmayan para görünürdü
      '108', // kart alacağı
      '120', // alıcılar
      '127', // kart itirazı ara hesabı
      '191', // indirilecek KDV (satırın kendi KDV bacağı var)
      '320', // satıcılar
      '329', // GRNI tahakkuku — yalnız yıl sonu adımları yazar
      '336', // iade edilecek tahsilat
      '391', // hesaplanan KDV
      '590',
      '591',
      '690',
      '740', // başlık: postlanamaz, alt hesapları kabul edilir
      '741', // yansıtma hesapları yalnız yıl sonu kapanışı
      '761',
      '771',
      '622',
      '631',
      '632',
    ];

    for (const code of forbidden) {
      expect(isPurchaseInvoiceLineAccountCode(code)).toBe(false);
    }
  });

  it('varsayılan hesap kümenin üyesi (DTO default kapıdan geçebilmeli)', () => {
    expect(
      isPurchaseInvoiceLineAccountCode(
        DEFAULT_PURCHASE_INVOICE_LINE_ACCOUNT_CODE
      )
    ).toBe(true);
  });

  it('stok alt kümesi, ana kümenin içindedir ve yalnız stok hesaplarıdır', () => {
    for (const code of PURCHASE_INVOICE_STOCK_ACCOUNT_CODES) {
      expect(isPurchaseInvoiceLineAccountCode(code)).toBe(true);
      expect(isPurchaseInvoiceStockAccountCode(code)).toBe(true);
    }
    // Gider ve duran varlık "stok faturası" değildir: mal kabul kavramı yoktur.
    for (const code of ['770', '760', '740.01', '255']) {
      expect(isPurchaseInvoiceStockAccountCode(code)).toBe(false);
    }
  });

  it('küme tekrarsız', () => {
    expect(new Set(PURCHASE_INVOICE_LINE_ACCOUNT_CODES).size).toBe(
      PURCHASE_INVOICE_LINE_ACCOUNT_CODES.length
    );
  });
});

describe('alış faturası karşı hesabı — kapılar aynı sabitten besleniyor', () => {
  const dto = (lineAccountCode?: string) => ({
    supplierId: '11111111-1111-4111-8111-111111111111',
    supplierName: 'Tedarikçi A.Ş.',
    invoiceDate: new Date('2026-05-01'),
    vatRate: 20,
    netTotal: 1000,
    vatTotal: 200,
    clinicId: '22222222-2222-4222-8222-222222222222',
    ...(lineAccountCode === undefined ? {} : { lineAccountCode }),
  });

  it('DTO: verilmezse varsayılan 770 gelir', () => {
    const parsed = RecordPurchaseInvoiceSchema.parse(dto());
    expect(parsed.lineAccountCode).toBe('770');
  });

  it.each(['102', '329', '120', '320', '740', '', '999'])(
    'DTO: %j kabul edilmez',
    (code) => {
      expect(RecordPurchaseInvoiceSchema.safeParse(dto(code)).success).toBe(
        false
      );
    }
  );

  it.each([...PURCHASE_INVOICE_LINE_ACCOUNT_CODES])(
    'DTO: %s kabul edilir',
    (code) => {
      expect(RecordPurchaseInvoiceSchema.safeParse(dto(code)).success).toBe(
        true
      );
    }
  );

  const eventPayload = (lineAccountCode: string) => ({
    partyId: '33333333-3333-4333-8333-333333333333',
    netTotal: '1000.00',
    vatTotal: '200.00',
    grandTotal: '1200.00',
    lineAccountCode,
    currency: 'TRY',
  });

  it('olay gövdesi: kümede olmayan kod reddedilir, kümedeki kabul edilir', () => {
    const type = FinancialEventTypeSchema.enum.PURCHASE_INVOICE_RECEIVED;

    expect(
      validateFinancialEventPayload(type, eventPayload('102'))
    ).not.toEqual([]);
    expect(
      validateFinancialEventPayload(type, eventPayload('329'))
    ).not.toEqual([]);
    expect(validateFinancialEventPayload(type, eventPayload('150'))).toEqual(
      []
    );
  });
});
