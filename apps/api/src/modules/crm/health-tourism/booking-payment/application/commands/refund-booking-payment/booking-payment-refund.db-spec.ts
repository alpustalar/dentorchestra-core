import {
  allowAllPolicyFactory,
  createFinanceDbHarness,
  FinanceDbHarness,
  LedgerFixture,
  makeCtx,
  recordAndPost,
  seedLedger,
} from '@src/testing/finance-db/finance-db.harness';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';
import { BookingPaymentCommandRepository } from '@modules/crm/health-tourism/booking-payment/infrastructure/persistence/prisma/repositories/booking-payment/booking-payment.command.repository';
import { BookingPaymentRefundCommandRepository } from '@modules/crm/health-tourism/booking-payment/infrastructure/persistence/prisma/repositories/booking-payment-refund/booking-payment-refund.command.repository';
import { BookingPaymentCollectionService } from '@modules/crm/health-tourism/booking-payment/domain/services/booking-payment-collection/booking-payment-collection.service';
import { CardChargebackCommandRepository } from '@modules/finance/bank/infrastructure/persistence/prisma/repositories/card-chargeback/card-chargeback.command.repository';
import { BankAccountCommandRepository } from '@modules/finance/bank/infrastructure/persistence/prisma/repositories/bank-account/bank-account.command.repository';
import { CardChargebackExposureGuard } from '@modules/finance/bank/domain/services/card-chargeback-exposure/card-chargeback-exposure.guard';
import { PeriodGateService } from '@modules/finance/accounting/periods/domain/services/period-gate/period-gate.service';
import { FundsInTransitGate } from '@modules/finance/accounting/posting/domain/services/funds-in-transit/funds-in-transit.gate';
import { FinancialEventPresenceGuard } from '@modules/finance/accounting/financial-events/domain/services/event-presence/event-presence.guard';
import { OpenCardChargebackHandler } from '@modules/finance/bank/application/commands/open-card-chargeback/open-card-chargeback.handler';
import { OpenCardChargebackCommand } from '@modules/finance/bank/application/commands/open-card-chargeback/open-card-chargeback.command';
import {
  ChargebackExceedsCollectionException,
  CollectionUnderChargebackException,
} from '@modules/finance/bank/domain/exceptions/bank.exceptions';
import { RefundBookingPaymentHandler } from './refund-booking-payment.handler';
import { RefundBookingPaymentCommand } from './refund-booking-payment.command';

/**
 * Gerçek-DB turu — platform rezervasyon iadesi ↔ `BOOKING_PAYMENT` kaynaklı itiraz
 * (kural 17, §91): iki yol da `booking_payments` satırını kilitler ve aynı kümülatif
 * tavana bakar. Sağlayıcı çağrısını yapan executor taklit (kapsam: claim + tavan +
 * kilit sırası); executor kendi birim testlerinde sınanıyor.
 */
describe('Rezervasyon iadesi ↔ itiraz — gerçek DB (platform)', () => {
  let harness: FinanceDbHarness;
  let ledger: LedgerFixture;
  let refundHandler: RefundBookingPaymentHandler;
  let openChargeback: OpenCardChargebackHandler;
  let executor: { execute: jest.Mock };
  const ctx = makeCtx(UUID.generate().value);

  beforeAll(async () => {
    harness = await createFinanceDbHarness();
    ledger = await seedLedger(harness);

    const prisma = harness.prisma;
    const bpRepo = new BookingPaymentCommandRepository(prisma);
    const refundRepo = new BookingPaymentRefundCommandRepository(prisma);
    const chargebackRepo = new CardChargebackCommandRepository(prisma);

    executor = {
      execute: jest.fn(async (refund: { id: { value: string } }) => ({
        refundId: refund.id.value,
        status: 'SUCCEEDED',
      })),
    };

    refundHandler = new RefundBookingPaymentHandler(
      bpRepo,
      refundRepo,
      new CardChargebackExposureGuard(chargebackRepo),
      executor as never,
      harness.txManager
    );

    openChargeback = new OpenCardChargebackHandler(
      chargebackRepo,
      new BankAccountCommandRepository(prisma),
      { resolve: async () => ledger.organizationId } as never,
      new PeriodGateService(harness.periodRepo),
      new FundsInTransitGate(harness.journalRepo, harness.accountRepo),
      new FinancialEventPresenceGuard(harness.eventRepo),
      {} as never,
      {} as never,
      new BookingPaymentCollectionService(bpRepo, refundRepo),
      // Bu defter "platform" sayılır: kaynak kapısı clinicId == platform ister.
      { resolve: async () => ({ clinicId: ledger.clinicId, organizationId: ledger.organizationId }) } as never,
      allowAllPolicyFactory,
      harness.commandBus as never,
      {} as never,
      harness.txManager
    );
  });

  beforeEach(() => executor.execute.mockClear());

  afterAll(async () => {
    await harness.close();
  });

  /** BOOKED rezervasyon ödemesi + defterde yazılı tahsilat (108 dolar). */
  async function seedBookedPayment(tryAmount = '1000.00') {
    const id = UUID.generate().value;
    const bookingId = UUID.generate().value;
    await harness.prisma.bookingPayment.create({
      data: {
        id,
        bookingType: 'HOTEL',
        status: 'BOOKED',
        saleCurrency: 'TRY',
        saleAmount: tryAmount,
        tryAmount,
        netAmount: '800.00',
        intent: {},
        paidProvider: 'IYZICO',
        paidProviderRef: `pt-${id}`,
        paidAt: new Date(),
        bookingId,
        clinicId: ledger.clinicId,
        organizationId: ledger.organizationId,
      },
    });
    await recordAndPost(harness, {
      ledger,
      type: 'PLATFORM_BOOKING_SETTLED',
      payload: {
        saleAmount: tryAmount,
        supplierAmount: '800.00',
        commission: (Number(tryAmount) - 800).toFixed(2),
        supplierPartyId: ledger.supplierPartyId,
        currency: 'TRY',
        bookingType: 'HOTEL',
        provider: 'HOTELBEDS',
      },
      dedupeKey: FinancialEventDedupeKeys.platform_booking_settled(id),
    });
    return { id, bookingId };
  }

  const refund = (bookingId: string) =>
    refundHandler.execute(
      new RefundBookingPaymentCommand({ bookingId, retained: null })
    );
  const chargeback = (bookingPaymentId: string, amount: number) =>
    openChargeback.execute(
      new OpenCardChargebackCommand(
        {
          clinicId: ledger.clinicId,
          sourceType: 'BOOKING_PAYMENT',
          sourceId: bookingPaymentId,
          caseReference: `case-${UUID.generate().value}`,
          openedAt: new Date(),
          amount,
          feeAmount: 0,
          fundsChannel: 'BANK',
        } as never,
        ctx
      )
    );

  it('iptal claim\'i: bp REFUNDED, tek PENDING iade satırı, executor bir kez çağrılır', async () => {
    const { id, bookingId } = await seedBookedPayment();

    const result = await refund(bookingId);

    expect(result.status).toBe('SUCCEEDED');
    expect(executor.execute).toHaveBeenCalledTimes(1);
    const bp = await harness.prisma.bookingPayment.findUniqueOrThrow({ where: { id } });
    expect(bp.status).toBe('REFUNDED');
    const rows = await harness.prisma.bookingPaymentRefund.findMany({
      where: { bookingPaymentId: id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].amount.toString()).toBe('1000');
  });

  it('ikinci iade isteği atlanır, sağlayıcıya ikinci çağrı gitmez', async () => {
    const { bookingId } = await seedBookedPayment();
    await refund(bookingId);
    executor.execute.mockClear();

    expect(await refund(bookingId)).toEqual({ refundId: null, status: 'SKIPPED' });
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('eşzamanlı iki iade: biri yürür, diğeri SKIPPED (kilitli claim)', async () => {
    const { bookingId } = await seedBookedPayment();

    const results = await Promise.all([refund(bookingId), refund(bookingId)]);

    expect(results.filter((r) => r.status === 'SKIPPED')).toHaveLength(1);
    expect(executor.execute).toHaveBeenCalledTimes(1);
  });

  it('aktif itiraz varken iade claim\'i reddedilir: bp BOOKED kalır, iade satırı açılmaz (kural 17)', async () => {
    const { id, bookingId } = await seedBookedPayment();
    await chargeback(id, 600);

    await expect(refund(bookingId)).rejects.toBeInstanceOf(
      CollectionUnderChargebackException
    );

    const bp = await harness.prisma.bookingPayment.findUniqueOrThrow({ where: { id } });
    expect(bp.status).toBe('BOOKED');
    expect(
      await harness.prisma.bookingPaymentRefund.count({ where: { bookingPaymentId: id } })
    ).toBe(0);
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('iade talep edilmiş tahsilata itiraz açılamaz (kalan tutar 0)', async () => {
    const { id, bookingId } = await seedBookedPayment();
    await refund(bookingId);

    await expect(chargeback(id, 100)).rejects.toBeInstanceOf(
      ChargebackExceedsCollectionException
    );
  });

  it('sağlayıcı iadeyi reddetti (FAILED): para bizde, itiraz yeniden açılabilir', async () => {
    const { id, bookingId } = await seedBookedPayment();
    await refund(bookingId);
    await harness.prisma.bookingPaymentRefund.updateMany({
      where: { bookingPaymentId: id },
      data: { status: 'FAILED', failureReason: 'provider rejected' },
    });

    await expect(chargeback(id, 400)).resolves.toEqual(expect.any(String));
  });

  it('eşzamanlı iade + itiraz: bp satır kilidi ikisini sıraya sokar, toplam tahsilatı aşmaz', async () => {
    const { id, bookingId } = await seedBookedPayment();

    const settled = await Promise.allSettled([refund(bookingId), chargeback(id, 600)]);

    // İade tam tutar (1000), itiraz 600: ikisi birlikte 1000'i aşar → tam biri geçer.
    const ok = settled.filter((r) => r.status === 'fulfilled');
    expect(ok).toHaveLength(1);
    const bad = settled.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect([
      CollectionUnderChargebackException,
      ChargebackExceedsCollectionException,
    ].some((E) => bad.reason instanceof E)).toBe(true);
  });
});
