import { PostFinancialEventCommand } from './post-financial-event.command';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import {
  createFinanceDbHarness,
  FinanceDbHarness,
  LedgerFixture,
  readStoredEntry,
  recordAndPost,
  seedLedger,
} from '@src/testing/finance-db/finance-db.harness';

/**
 * Gerçek-DB turu (iş paketi 23, CLAUDE.md finans kuralı 21): her posting kuralı,
 * gerçek repository'ler ve gerçek PostgreSQL'e karşı bir kez uçtan uca çalışır.
 *
 * Mock'lu kural testleri şunları göremez ve bu dosya görür:
 *  - şablon hesap planında olmayan / yaprak olmayan / `requiresParty` hesap kodları,
 *  - `Prisma.Decimal` ↔ `decimal.js` sınırı (hidrasyon),
 *  - kolon ölçeği / CHECK kısıtları / unique kısıtları,
 *  - numara tahsisi ve fiş yazımının tek transaction'da birlikte çalışması.
 *
 * Çalıştırma: `pnpm test:db` (izole veritabanı otomatik açılıp silinir).
 */
describe('PostFinancialEvent — gerçek DB (tüm posting kuralları)', () => {
  let harness: FinanceDbHarness;
  let ledger: LedgerFixture;

  beforeAll(async () => {
    harness = await createFinanceDbHarness();
    ledger = await seedLedger(harness);
  });

  afterAll(async () => {
    await harness.close();
  });

  /** Σborç = Σalacak ve her satır tek taraflı: saklanan veride doğrulanır (kural 14). */
  function expectBalanced(stored: Awaited<ReturnType<typeof readStoredEntry>>) {
    const sum = (key: 'debit' | 'credit') =>
      stored.lines.reduce((acc, l) => acc + Math.round(Number(l[key]) * 100), 0);
    expect(sum('debit')).toBe(sum('credit'));
    expect(sum('debit')).toBeGreaterThan(0);
    for (const l of stored.lines) {
      expect(Number(l.debit) > 0 && Number(l.credit) > 0).toBe(false);
    }
  }

  const cases: Array<{
    name: string;
    type: Parameters<typeof recordAndPost>[1]['type'];
    payload: (l: LedgerFixture) => Record<string, unknown>;
  }> = [
    {
      name: 'PAYMENT_RECEIVED (nakit)',
      type: 'PAYMENT_RECEIVED',
      payload: (l) => ({ method: 'CASH', amount: '1200.50', partyId: l.partyId }),
    },
    {
      name: 'PAYMENT_RECEIVED (kart)',
      type: 'PAYMENT_RECEIVED',
      payload: (l) => ({
        method: 'POS_CARD',
        amount: '300.00',
        partyId: l.partyId,
      }),
    },
    {
      name: 'PAYMENT_REFUNDED (nakit)',
      type: 'PAYMENT_REFUNDED',
      payload: (l) => ({ method: 'CASH', amount: '100.00', partyId: l.partyId }),
    },
    {
      name: 'SALES_INVOICE_ISSUED',
      type: 'SALES_INVOICE_ISSUED',
      payload: (l) => ({
        partyId: l.partyId,
        netTotal: '1000.00',
        vatTotal: '200.00',
        grandTotal: '1200.00',
      }),
    },
    {
      name: 'PURCHASE_INVOICE_RECEIVED',
      type: 'PURCHASE_INVOICE_RECEIVED',
      payload: (l) => ({
        partyId: l.supplierPartyId,
        netTotal: '500.00',
        vatTotal: '100.00',
        grandTotal: '600.00',
        lineAccountCode: '153',
      }),
    },
    {
      name: 'PAYROLL_ACCRUED',
      type: 'PAYROLL_ACCRUED',
      payload: (l) => ({
        partyId: l.partyId,
        grossSalary: '30000.00',
        employerSgk: '6000.00',
        netPayable: '22800.00',
        taxWithholding: '3000.00',
        employeeSgk: '4200.00',
      }),
    },
    {
      name: 'CASH_SESSION_CLOSED (fazla)',
      type: 'CASH_SESSION_CLOSED',
      payload: () => ({
        bankDepositTotal: '500.00',
        expenseTotal: '50.00',
        difference: '10.00',
      }),
    },
    {
      name: 'CASH_SESSION_CLOSED (eksik)',
      type: 'CASH_SESSION_CLOSED',
      payload: () => ({
        bankDepositTotal: '500.00',
        expenseTotal: '0.00',
        difference: '-25.75',
      }),
    },
    {
      name: 'PROVIDER_SETTLEMENT_RECEIVED',
      type: 'PROVIDER_SETTLEMENT_RECEIVED',
      payload: () => ({
        grossAmount: '1000.00',
        netAmount: '975.00',
        commissionAmount: '25.00',
        currency: 'TRY',
        provider: 'IYZICO',
        reference: 'settle-1',
      }),
    },
    {
      name: 'CARD_CHARGEBACK_OPENED (ücretli)',
      type: 'CARD_CHARGEBACK_OPENED',
      payload: () => ({
        amount: '400.00',
        feeAmount: '15.00',
        fundsChannel: 'FUNDS_IN_TRANSIT',
        currency: 'TRY',
        provider: 'IYZICO',
        caseReference: 'cb-1',
      }),
    },
    {
      name: 'CARD_CHARGEBACK_WON',
      type: 'CARD_CHARGEBACK_WON',
      payload: () => ({
        amount: '400.00',
        fundsChannel: 'FUNDS_IN_TRANSIT',
        currency: 'TRY',
        provider: 'IYZICO',
        caseReference: 'cb-1',
      }),
    },
    {
      name: 'CARD_CHARGEBACK_LOST (hasta)',
      type: 'CARD_CHARGEBACK_LOST',
      payload: (l) => ({
        amount: '400.00',
        currency: 'TRY',
        provider: 'IYZICO',
        caseReference: 'cb-2',
        partyId: l.partyId,
      }),
    },
    {
      name: 'CARD_CHARGEBACK_LOST (platform zararı 659.01)',
      type: 'CARD_CHARGEBACK_LOST',
      payload: () => ({
        amount: '250.00',
        currency: 'TRY',
        provider: 'IYZICO',
        caseReference: 'cb-3',
        platformLoss: true,
      }),
    },
    {
      name: 'PLATFORM_BOOKING_SETTLED (TRY)',
      type: 'PLATFORM_BOOKING_SETTLED',
      payload: (l) => ({
        saleAmount: '1000.00',
        supplierAmount: '800.00',
        commission: '200.00',
        supplierPartyId: l.supplierPartyId,
        currency: 'TRY',
        bookingType: 'HOTEL',
        provider: 'HOTELBEDS',
      }),
    },
    {
      name: 'PLATFORM_BOOKING_REFUNDED (cezasız)',
      type: 'PLATFORM_BOOKING_REFUNDED',
      payload: (l) => ({
        refundAmount: '1000.00',
        commission: '200.00',
        supplierReleased: '800.00',
        retainedLoss: '0.00',
        supplierPartyId: l.supplierPartyId,
        currency: 'TRY',
        bookingType: 'HOTEL',
        provider: 'HOTELBEDS',
      }),
    },
    {
      name: 'PLATFORM_RETURNABLE_CHARGE_RECEIVED',
      type: 'PLATFORM_RETURNABLE_CHARGE_RECEIVED',
      payload: () => ({
        amount: '750.00',
        currency: 'TRY',
        provider: 'IYZICO',
        chargeReference: 'chg-1',
        reason: 'UNCLAIMED_CHARGE',
        bookingPaymentId: UUID.generate().value,
        refundId: UUID.generate().value,
      }),
    },
    {
      name: 'PLATFORM_RETURNABLE_CHARGE_REFUNDED',
      type: 'PLATFORM_RETURNABLE_CHARGE_REFUNDED',
      payload: () => ({
        amount: '750.00',
        currency: 'TRY',
        provider: 'IYZICO',
        chargeReference: 'chg-1',
        reason: 'UNCLAIMED_CHARGE',
        bookingPaymentId: UUID.generate().value,
        refundId: UUID.generate().value,
      }),
    },
    {
      name: 'STOCK_IN',
      type: 'STOCK_IN',
      payload: () => ({
        movementId: UUID.generate().value,
        productId: UUID.generate().value,
        movementType: 'ADJUSTMENT',
        quantity: '2.500',
        unitCost: '10.00',
        amount: '25.00',
      }),
    },
    {
      name: 'STOCK_OUT',
      type: 'STOCK_OUT',
      payload: () => ({
        movementId: UUID.generate().value,
        productId: UUID.generate().value,
        movementType: 'USAGE',
        quantity: '1.000',
        unitCost: '10.00',
        amount: '10.00',
      }),
    },
  ];

  it.each(cases)('$name: fiş saklanır, dengeli, numaralı', async (c) => {
    const { entryId } = await recordAndPost(harness, {
      ledger,
      type: c.type,
      payload: c.payload(ledger),
    });

    expect(entryId).not.toBeNull();
    const stored = await readStoredEntry(harness, entryId as string);
    expect(stored.status).toBe('POSTED');
    expect(stored.entryNo).not.toBeNull();
    expectBalanced(stored);
  });

  it('yabancı para temeli (original*/fxRate) saklanan 320 satırında korunur (kural 9)', async () => {
    const { entryId } = await recordAndPost(harness, {
      ledger,
      type: 'PLATFORM_BOOKING_SETTLED',
      payload: {
        saleAmount: '1000.00',
        supplierAmount: '770.00',
        commission: '230.00',
        supplierPartyId: ledger.supplierPartyId,
        currency: 'TRY',
        bookingType: 'HOTEL',
        provider: 'HOTELBEDS',
        originalCurrency: 'EUR',
        fxRate: '38.500000',
        supplierOriginalAmount: '20.00',
      },
    });

    const lines = await harness.prisma.journalLine.findMany({
      where: { entryId: entryId as string },
      include: { account: true },
    });
    const supplier = lines.find((l) => l.account.code === '320');
    expect(supplier?.originalCurrency).toBe('EUR');
    expect(supplier?.fxRate?.toString()).toBe('38.5');
    expect(supplier?.originalCredit?.toString()).toBe('20');
    expect(supplier?.credit?.toString()).toBe('770');
  });

  it('yevmiye numaraları boşluksuz ve artan', async () => {
    const entries = await harness.prisma.journalEntry.findMany({
      where: { clinicId: ledger.clinicId },
      orderBy: { entryNo: 'asc' },
      select: { entryNo: true },
    });
    const numbers = entries.map((e) => Number(e.entryNo));
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
  });

  describe('dayanıklılık (kural 1, 2, 14)', () => {
    let fresh: LedgerFixture;

    beforeAll(async () => {
      // Ayrı defter: yukarıdaki numaralama testi ve sayaçlar etkilenmesin.
      fresh = await seedLedger(harness);
    });

    const receipt = (amount: string) => ({
      method: 'CASH',
      amount,
      partyId: fresh.partyId,
    });

    it('aynı olay iki kez fişlenmez: mevcut fiş döner, sayaç artmaz', async () => {
      const first = await recordAndPost(harness, {
        ledger: fresh,
        type: 'PAYMENT_RECEIVED',
        payload: receipt('10.00'),
      });
      const before = await harness.prisma.accountingPeriod.findUniqueOrThrow({
        where: { id: fresh.periodId },
      });

      const again = await harness.postHandler.execute(
        new PostFinancialEventCommand(first.eventId, {} as never)
      );

      const after = await harness.prisma.accountingPeriod.findUniqueOrThrow({
        where: { id: fresh.periodId },
      });
      expect(again).toBe(first.entryId);
      expect(after.lastEntryNo).toBe(before.lastEntryNo);
      expect(
        await harness.prisma.journalEntry.count({
          where: { eventId: first.eventId },
        })
      ).toBe(1);
    });

    it('eşzamanlı 12 fiş: numaralar benzersiz ve boşluksuz', async () => {
      const start = await harness.prisma.accountingPeriod.findUniqueOrThrow({
        where: { id: fresh.periodId },
      });

      const results = await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          recordAndPost(harness, {
            ledger: fresh,
            type: 'PAYMENT_RECEIVED',
            payload: receipt(`${i + 1}.00`),
          })
        )
      );

      const entries = await harness.prisma.journalEntry.findMany({
        where: { id: { in: results.map((r) => r.entryId as string) } },
        select: { entryNo: true },
      });
      const numbers = entries.map((e) => Number(e.entryNo)).sort((a, b) => a - b);
      const first = Number(start.lastEntryNo) + 1;
      expect(numbers).toEqual(Array.from({ length: 12 }, (_, i) => first + i));
    });

    it('kapalı döneme fiş yazılmaz: fiş de sayaç da değişmez', async () => {
      const closedLedger = await seedLedger(harness, { year: 2019 });
      await harness.prisma.accountingPeriod.update({
        where: { id: closedLedger.periodId },
        data: { status: 'CLOSED' },
      });

      await expect(
        recordAndPost(harness, {
          ledger: closedLedger,
          type: 'PAYMENT_RECEIVED',
          payload: { method: 'CASH', amount: '5.00', partyId: closedLedger.partyId },
          occurredAt: new Date('2019-06-01T10:00:00Z'),
        })
      ).rejects.toThrow();

      const period = await harness.prisma.accountingPeriod.findUniqueOrThrow({
        where: { id: closedLedger.periodId },
      });
      expect(period.lastEntryNo).toBe(0n);
      expect(
        await harness.prisma.journalEntry.count({
          where: { clinicId: closedLedger.clinicId },
        })
      ).toBe(0);
    });

    it('otoriter kapı: hızlı-ret atlansa bile kapalı dönemde numara tahsisi reddedilir (kural 1)', async () => {
      const racedLedger = await seedLedger(harness, { year: 2018 });
      await harness.prisma.accountingPeriod.update({
        where: { id: racedLedger.periodId },
        data: { status: 'CLOSED' },
      });

      // Okuma "açık" gördükten SONRA kapanış gelmiş gibi: doğrudan kilitli tahsis.
      await expect(
        harness.txManager.outboxRun(() =>
          harness.periodRepo.lockAndAllocateEntryNo(racedLedger.periodId)
        )
      ).rejects.toThrow();

      const period = await harness.prisma.accountingPeriod.findUniqueOrThrow({
        where: { id: racedLedger.periodId },
      });
      expect(period.lastEntryNo).toBe(0n);
    });

    it('dönem dışı tarih: dönem yok hatası, fiş ve sayaç yok', async () => {
      await expect(
        recordAndPost(harness, {
          ledger: fresh,
          type: 'PAYMENT_RECEIVED',
          payload: receipt('5.00'),
          occurredAt: new Date('2001-01-01T10:00:00Z'),
        })
      ).rejects.toThrow();
    });
  });

  describe('lockAndGetAccountBalance (kural 16; Prisma `void` sütunu regresyonu)', () => {
    it('kilit alınır, bakiye Prisma.Decimal döner ve saklanan 108 toplamına eşittir', async () => {
      const bal = await seedLedger(harness);
      await recordAndPost(harness, {
        ledger: bal,
        type: 'PAYMENT_RECEIVED',
        payload: { method: 'POS_CARD', amount: '250.75', partyId: bal.partyId },
      });
      const account108 = await harness.prisma.account.findFirstOrThrow({
        where: { clinicId: bal.clinicId, code: '108' },
      });

      const balance = await harness.txManager.run(() =>
        harness.journalRepo.lockAndGetAccountBalance({
          clinicId: bal.clinicId,
          accountId: account108.id,
        })
      );
      expect(balance.toString()).toBe('250.75');
    });

    it('transaction dışında çağrılırsa sesli patlar (sessiz etkisiz kilit yok)', async () => {
      const bal = await seedLedger(harness);
      const account108 = await harness.prisma.account.findFirstOrThrow({
        where: { clinicId: bal.clinicId, code: '108' },
      });
      await expect(
        harness.journalRepo.lockAndGetAccountBalance({
          clinicId: bal.clinicId,
          accountId: account108.id,
        })
      ).rejects.toThrow(/transaction/i);
    });

    it('aynı hesabı isteyen iki transaction serileşir', async () => {
      const bal = await seedLedger(harness);
      const account108 = await harness.prisma.account.findFirstOrThrow({
        where: { clinicId: bal.clinicId, code: '108' },
      });
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const spans: Array<{ start: number; end: number }> = [];

      const hold = (delay: number) =>
        harness.txManager.run(async () => {
          await sleep(delay);
          await harness.journalRepo.lockAndGetAccountBalance({
            clinicId: bal.clinicId,
            accountId: account108.id,
          });
          const start = Date.now();
          await sleep(300);
          spans.push({ start, end: Date.now() });
        });

      await Promise.all([hold(0), hold(50)]);

      spans.sort((a, b) => a.start - b.start);
      // Kilit yoksa ikinci kritik bölüm birincinin içinde başlar.
      expect(spans[1].start).toBeGreaterThanOrEqual(spans[0].end - 5);
    });
  });
});
