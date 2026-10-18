/*
 * Repo/servis taklitleri tiplenmemiş (`any`) nesneler taşır; kurallar yalnız bu
 * dosyada kapatılır (üretim kodunda açık kalır).
 */

import { Decimal } from 'decimal.js';
import { ReconcilePosTransactionsHandler } from './reconcile-pos-transactions.handler';

/**
 * Mutabakat taraması iki "sessiz kayıp" senaryosunu görünür kılmak zorundadır:
 * (1) cihaza sorulamadan yaş eşiğiyle TIMEOUT'a düşen PAX işlemi — kart
 * çekilmiş olabilir; (2) durum sorgusu API'si olmayan sağlayıcıda (iyzico
 * Terminal) sonsuza dek PENDING kalan işlem — bu grup taramaya hiç girmiyordu.
 */
describe('ReconcilePosTransactionsHandler — görünürlük', () => {
  const FIVE_HOURS_AGO = new Date(Date.now() - 5 * 60 * 60 * 1000);

  const make = (options: {
    pending?: unknown[];
    stale?: unknown[];
    entity?: unknown;
  }) => {
    const commandRepo = {
      findPendingForReconcile: jest
        .fn()
        .mockResolvedValue(options.pending ?? []),
      findByIdForUpdate: jest.fn().mockResolvedValue(options.entity ?? null),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const queryRepo = {
      findStalePendingAnyClinic: jest
        .fn()
        .mockResolvedValue(options.stale ?? []),
    };
    const paxService = { queryTransactionStatus: jest.fn() };
    const txManager = {
      outboxRun: jest
        .fn()
        .mockImplementation((cb: () => Promise<unknown>) => cb()),
    };
    const posPaymentSync = {
      markPaid: jest.fn(),
      markFailed: jest.fn(),
      markRefunded: jest.fn(),
    };
    const accountingBridge = { recordBestEffort: jest.fn() };
    const criticalFailure = { publish: jest.fn() };

    const handler = new ReconcilePosTransactionsHandler(
      commandRepo as never,
      queryRepo as never,
      paxService as never,
      txManager as never,
      posPaymentSync as never,
      accountingBridge as never,
      criticalFailure as never
    );

    return {
      handler,
      commandRepo,
      queryRepo,
      criticalFailure,
      paxService,
      posPaymentSync,
      accountingBridge,
    };
  };

  // Komut gövdesi boş (zamanlanmış iş tetikler) — handler parametre almaz.
  const run = (handler: ReconcilePosTransactionsHandler) => handler.execute();

  it('yaş eşiğini aşan PAX işlemi TIMEOUT edilir ve CRITICAL alarm üretir', async () => {
    const entity = {
      markTimeout: jest.fn(),
      validate: { status: { isPending: () => ({ value: true }) } },
    };
    const { handler, commandRepo, criticalFailure } = make({
      pending: [
        {
          id: 'tx-old',
          clinicId: 'clinic-1',
          initiatedAt: FIVE_HOURS_AGO,
          device: {},
        },
      ],
      entity,
    });

    await run(handler);

    expect(entity.markTimeout).toHaveBeenCalledTimes(1);
    expect(commandRepo.update).toHaveBeenCalledTimes(1);
    // Önceden yalnız logger.warn yazılıyordu: kimsenin görmediği yerde para
    // kayboluyordu.
    expect(criticalFailure.publish).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'finance.pos.blind-timeout' })
    );
  });

  it('cihaz sorgusu sürerken sonuçlanan işlem TIMEOUT edilmez (kilitli kontrol)', async () => {
    const entity = {
      markTimeout: jest.fn(),
      validate: { status: { isPending: () => ({ value: false }) } },
    };
    const { handler, commandRepo } = make({
      pending: [
        {
          id: 'tx-old',
          clinicId: 'clinic-1',
          initiatedAt: FIVE_HOURS_AGO,
          device: {},
        },
      ],
      entity,
    });

    await run(handler);

    expect(entity.markTimeout).not.toHaveBeenCalled();
    expect(commandRepo.update).not.toHaveBeenCalled();
  });

  describe('sonuçlanan işlemin TÜRÜ', () => {
    const RECENT = new Date(Date.now() - 60 * 1000);

    const settledEntity = (kind: 'SALE' | 'REFUND') => ({
      kind,
      paymentId: 'pay-1',
      patientId: { value: 'patient-1' },
      clinicId: { value: 'clinic-1' },
      amount: { value: new Decimal('300.00') },
      id: { value: 'tx-1' },
      originalPosTransactionId: kind === 'SALE' ? null : 'tx-sale',
      markSuccess: jest.fn(),
      markFailed: jest.fn(),
      markTimeout: jest.fn(),
      validate: { status: { isPending: () => ({ value: true }) } },
    });

    const runWith = async (kind: 'SALE' | 'REFUND') => {
      const entity = settledEntity(kind);
      const ctx = make({
        pending: [
          {
            id: 'tx-1',
            clinicId: 'clinic-1',
            initiatedAt: RECENT,
            device: {},
          },
        ],
        entity,
      });
      ctx.paxService.queryTransactionStatus.mockResolvedValue({
        approved: true,
        externalRef: 'HOSTREF',
        rawResponse: {},
      });

      await run(ctx.handler);
      return ctx;
    };

    it('onaylanan SATIŞ tahsilat olarak işlenir (108 / 120)', async () => {
      const { posPaymentSync, accountingBridge } = await runWith('SALE');

      expect(posPaymentSync.markPaid).toHaveBeenCalledTimes(1);
      expect(posPaymentSync.markRefunded).not.toHaveBeenCalled();
      expect(accountingBridge.recordBestEffort).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'SALE' })
      );
    });

    it('onaylanan İADE iade olarak işlenir — tahsilat YAZILMAZ', async () => {
      // P0 regresyonu: bu dal tür-kördü. Cihaza sorulamadığı için PENDING kalmış
      // bir iade sonradan onaylandığında taksit `markPaid` ile TAHSİL EDİLDİ
      // işaretleniyor ve deftere ikinci bir PAYMENT_RECEIVED yazılıyordu —
      // para üye işyerinden çıkmışken kayıtlar bir tahsilat daha gösteriyordu.
      const { posPaymentSync, accountingBridge } = await runWith('REFUND');

      expect(posPaymentSync.markPaid).not.toHaveBeenCalled();
      expect(posPaymentSync.markRefunded).toHaveBeenCalledTimes(1);
      expect(accountingBridge.recordBestEffort).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'REVERSAL',
          posTransactionId: 'tx-1',
          originalPosTransactionId: 'tx-sale',
        })
      );
    });
  });

  it('PAX dışı askıda işlemler PAX hariç taranır ve alarmla görünür kılınır', async () => {
    const { handler, queryRepo, criticalFailure, paxService } = make({
      stale: [
        {
          id: 'tx-iyzico',
          clinicId: 'clinic-2',
          posDeviceId: 'dev-1',
          provider: 'IYZICO_TERMINAL',
          amount: new Decimal('750.00'),
          currency: 'TRY',
          kind: 'SALE',
          paymentId: 'pay-9',
          initiatedAt: FIVE_HOURS_AGO,
        },
      ],
    });

    await run(handler);

    // Sağlayıcıda durum sorgusu yok: cihaza SORULMAZ, otomatik karar verilmez.
    expect(paxService.queryTransactionStatus).not.toHaveBeenCalled();
    expect(queryRepo.findStalePendingAnyClinic).toHaveBeenCalledWith(
      expect.objectContaining({ excludeProviders: ['PAX'] })
    );
    expect(criticalFailure.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'finance.pos.unverifiable-pending',
        clinicId: 'clinic-2',
      })
    );
  });

  it('askıda işlem yoksa alarm üretilmez', async () => {
    const { handler, criticalFailure } = make({});

    await run(handler);

    expect(criticalFailure.publish).not.toHaveBeenCalled();
  });
});
