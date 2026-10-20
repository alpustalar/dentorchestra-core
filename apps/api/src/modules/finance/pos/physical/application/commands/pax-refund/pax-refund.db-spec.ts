import {
  allowAllPolicyFactory,
  createFinanceDbHarness,
  FinanceDbHarness,
  ledgerBalance,
  LedgerFixture,
  makeCtx,
  recordAndPost,
  seedLedger,
  seedPatient,
} from '@src/testing/finance-db/finance-db.harness';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { FinancialEventDedupeKeys } from '@modules/finance/shared/domain/constants/financial-event-dedupe-keys.constant';
import { PostFinancialEventCommand } from '@modules/finance/accounting/posting/application/commands/post-financial-event/post-financial-event.command';
import { PosDeviceCommandRepository } from '@modules/finance/pos/physical/infrastructure/persistence/prisma/repositories/pos-device/pos-device.command.repository';
import { PosTransactionCommandRepository } from '@modules/finance/pos/physical/infrastructure/persistence/prisma/repositories/pos-transaction/pos-transaction.command.repository';
import { PosTransactionQueryRepository } from '@modules/finance/pos/physical/infrastructure/persistence/prisma/repositories/pos-transaction/pos-transaction.query.repository';
import { PosCardCollectionService } from '@modules/finance/pos/physical/domain/services/pos-card-collection/pos-card-collection.service';
import { PosAccountingBridgeService } from '@modules/finance/pos/physical/application/services/pos-accounting-bridge.service';
import { PosPaymentSyncService } from '@modules/finance/pos/physical/application/services/pos-payment-sync.service';
import { GetPosTransactionByIdQuery } from '@modules/finance/pos/physical/application/queries/get-pos-transaction-by-id/get-pos-transaction-by-id.query';
import { CardChargebackCommandRepository } from '@modules/finance/bank/infrastructure/persistence/prisma/repositories/card-chargeback/card-chargeback.command.repository';
import { BankAccountCommandRepository } from '@modules/finance/bank/infrastructure/persistence/prisma/repositories/bank-account/bank-account.command.repository';
import { CardChargebackExposureGuard } from '@modules/finance/bank/domain/services/card-chargeback-exposure/card-chargeback-exposure.guard';
import { PeriodGateService } from '@modules/finance/accounting/periods/domain/services/period-gate/period-gate.service';
import { FundsInTransitGate } from '@modules/finance/accounting/posting/domain/services/funds-in-transit/funds-in-transit.gate';
import { FinancialEventPresenceGuard } from '@modules/finance/accounting/financial-events/domain/services/event-presence/event-presence.guard';
import { EnsurePartyForPatientCommand } from '@modules/finance/party/application/commands/ensure-party-for-patient/ensure-party-for-patient.command';
import { OpenCardChargebackHandler } from '@modules/finance/bank/application/commands/open-card-chargeback/open-card-chargeback.handler';
import { OpenCardChargebackCommand } from '@modules/finance/bank/application/commands/open-card-chargeback/open-card-chargeback.command';
import {
  ChargebackExceedsCollectionException,
  CollectionUnderChargebackException,
} from '@modules/finance/bank/domain/exceptions/bank.exceptions';
import { RefundAmountExceedsOriginalException } from '@modules/finance/pos/physical/domain/exceptions/pos.exceptions';
import {
  PaxConnectionError,
  PaxTimeoutError,
} from '@src/infrastructure/payment/pos/physical/providers/pax/pax.errors';
import { PaxRefundHandler } from './pax-refund.handler';
import { PaxRefundCommand } from './pax-refund.command';

/**
 * Gerçek-DB turu — fiziksel POS (PAX) iadesi ve `POS_TRANSACTION` kaynaklı itiraz.
 * Sanal POS'un aksine bu yolda PENDING iade kaydı TCP çağrısından ÖNCE, orijinal
 * satır kilitliyken yazılır: iade ↔ itiraz yarışı kapalı olmalı. Cihaz taklit.
 */
describe('Fiziksel POS iadesi — gerçek DB', () => {
  let harness: FinanceDbHarness;
  let ledger: LedgerFixture;
  let patientId: string;
  let deviceId: string;
  let handler: PaxRefundHandler;
  let openChargeback: OpenCardChargebackHandler;
  let pax: { refund: jest.Mock };
  const ctx = makeCtx(UUID.generate().value);

  const approved = {
    approved: true,
    externalRef: 'ref-ok',
    rawResponse: {},
    responseText: 'APPROVED',
    authorizationCode: '123456',
  };

  beforeAll(async () => {
    harness = await createFinanceDbHarness();
    ledger = await seedLedger(harness);
    patientId = await seedPatient(harness, ledger);

    deviceId = UUID.generate().value;
    await harness.prisma.posDevice.create({
      data: {
        id: deviceId,
        clinicId: ledger.clinicId,
        label: 'PAX-1',
        provider: 'PAX',
        host: '127.0.0.1',
        port: 10009,
        terminalId: 'T1',
        merchantId: 'M1',
      },
    });

    const prisma = harness.prisma;
    const posTxRepo = new PosTransactionCommandRepository(prisma);
    const posTxQueryRepo = new PosTransactionQueryRepository(prisma);
    const chargebackRepo = new CardChargebackCommandRepository(prisma);

    harness.commandBus.register(EnsurePartyForPatientCommand, {
      execute: async () => ({ partyId: ledger.partyId }),
    });
    const commandBus = harness.commandBus as never;
    const queryBus = {
      execute: async (query: unknown) => {
        if (query instanceof GetPosTransactionByIdQuery) {
          return { data: await posTxQueryRepo.findSummaryById(query.posTransactionId) };
        }
        throw new Error('Harness bu sorguyu bilmiyor');
      },
    } as never;
    const criticalFailure = { publish: jest.fn() } as never;

    pax = { refund: jest.fn().mockResolvedValue(approved) };

    handler = new PaxRefundHandler(
      new PosDeviceCommandRepository(prisma),
      posTxRepo,
      pax as never,
      harness.txManager,
      new PosPaymentSyncService(commandBus, queryBus, criticalFailure),
      new PosAccountingBridgeService(commandBus, criticalFailure),
      allowAllPolicyFactory,
      new CardChargebackExposureGuard(chargebackRepo)
    );

    openChargeback = new OpenCardChargebackHandler(
      chargebackRepo,
      new BankAccountCommandRepository(prisma),
      { resolve: async () => ledger.organizationId } as never,
      new PeriodGateService(harness.periodRepo),
      new FundsInTransitGate(harness.journalRepo, harness.accountRepo),
      new FinancialEventPresenceGuard(harness.eventRepo),
      new PosCardCollectionService(posTxRepo),
      {} as never,
      {} as never,
      {} as never,
      allowAllPolicyFactory,
      commandBus,
      queryBus,
      harness.txManager
    );
  });

  beforeEach(() => {
    pax.refund.mockReset();
    pax.refund.mockResolvedValue(approved);
  });

  afterAll(async () => {
    await harness.close();
  });

  /** Başarılı kart SATIŞI + defterde yazılı `PAYMENT_RECEIVED` (108 dolar). */
  async function seedSale(amount: string): Promise<string> {
    const id = UUID.generate().value;
    await harness.prisma.posTransaction.create({
      data: {
        id,
        posDeviceId: deviceId,
        clinicId: ledger.clinicId,
        patientId,
        amount,
        status: 'SUCCESS',
        kind: 'SALE',
        externalRef: `sale-${id}`,
        initiatedById: 'staff',
      },
    });
    await recordAndPost(harness, {
      ledger,
      type: 'PAYMENT_RECEIVED',
      payload: { method: 'POS_CARD', amount, partyId: ledger.partyId },
      dedupeKey: FinancialEventDedupeKeys.payment_received_pos(id),
    });
    return id;
  }

  const refund = (saleId: string, amount?: number) =>
    handler.execute(
      new PaxRefundCommand(
        { originalPosTransactionId: saleId, clinicId: ledger.clinicId, amount } as never,
        ctx
      )
    );
  const chargeback = (saleId: string, amount: number) =>
    openChargeback.execute(
      new OpenCardChargebackCommand(
        {
          clinicId: ledger.clinicId,
          sourceType: 'POS_TRANSACTION',
          sourceId: saleId,
          caseReference: `case-${UUID.generate().value}`,
          openedAt: new Date(),
          amount,
          feeAmount: 0,
          fundsChannel: 'BANK',
        } as never,
        ctx
      )
    );
  const balance = (code: string) =>
    ledgerBalance(harness, { clinicId: ledger.clinicId, code });

  it('kısmi iadeler kümülatif: 200 + 300 geçer, 1 kuruş fazlası reddedilir; köprü olayı fişlenir', async () => {
    const saleId = await seedSale('500.00');
    const before108 = await balance('108');

    const first = await refund(saleId, 200);
    expect(first.status).toBe('SUCCESS');
    await refund(saleId, 300);
    await expect(refund(saleId, 0.01)).rejects.toBeInstanceOf(
      RefundAmountExceedsOriginalException
    );

    const events = await harness.prisma.financialEvent.findMany({
      where: { type: 'PAYMENT_REFUNDED', sourceModule: 'pos' },
    });
    const own = events.filter((e) => JSON.stringify(e.payload).includes(saleId));
    expect(own).toHaveLength(2);
    for (const e of own) {
      await harness.postHandler.execute(new PostFinancialEventCommand(e.id, ctx));
    }
    expect(await balance('108')).toBe(before108 - 500);
  });

  it('cihaz reddederse iade FAILED, olay yok; sonra yeniden denenebilir', async () => {
    const saleId = await seedSale('100.00');
    pax.refund.mockResolvedValue({ ...approved, approved: false, responseText: 'DECLINED' });

    const declined = await refund(saleId, 100);
    expect(declined.status).toBe('FAILED');

    pax.refund.mockResolvedValue(approved);
    const retried = await refund(saleId, 100);
    expect(retried.status).toBe('SUCCESS');
  });

  it('zaman aşımında iade PENDING kalır ve tutarı tavandan düşer (çift iade yok)', async () => {
    const saleId = await seedSale('300.00');
    pax.refund.mockRejectedValue(new PaxTimeoutError(30000));

    const pending = await refund(saleId, 300);
    expect(pending.status).toBe('PENDING');

    pax.refund.mockResolvedValue(approved);
    await expect(refund(saleId, 1)).rejects.toBeInstanceOf(
      RefundAmountExceedsOriginalException
    );
  });

  it('bağlantı hatasında iade FAILED olur ve tavandan düşmez', async () => {
    const saleId = await seedSale('120.00');
    pax.refund.mockRejectedValue(new PaxConnectionError('down'));

    expect((await refund(saleId, 120)).status).toBe('FAILED');

    pax.refund.mockResolvedValue(approved);
    expect((await refund(saleId, 120)).status).toBe('SUCCESS');
  });

  it('açık itirazın kapsadığı tutar iade edilemez; cihaza hiç gidilmez (kural 17)', async () => {
    const saleId = await seedSale('500.00');
    await chargeback(saleId, 400);

    await expect(refund(saleId, 200)).rejects.toBeInstanceOf(
      CollectionUnderChargebackException
    );
    expect(pax.refund).not.toHaveBeenCalled();
    await expect(refund(saleId, 100)).resolves.toMatchObject({ status: 'SUCCESS' });
  });

  it('iade edilmiş tutar itiraz tavanından düşer (kural 17, ters yön)', async () => {
    const saleId = await seedSale('500.00');
    await refund(saleId, 400);

    await expect(chargeback(saleId, 200)).rejects.toBeInstanceOf(
      ChargebackExceedsCollectionException
    );
    await expect(chargeback(saleId, 100)).resolves.toEqual(expect.any(String));
  });

  it('cihaz çağrısı uçuştayken açılan itiraz iadeyle birlikte tavanı AŞAMAZ (PENDING kayıt kilidi)', async () => {
    const saleId = await seedSale('500.00');
    pax.refund.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(approved), 300))
    );

    const settled = await Promise.allSettled([
      refund(saleId, 300),
      new Promise((r) => setTimeout(r, 80)).then(() => chargeback(saleId, 300)),
    ]);

    // 300 + 300 > 500: sanal POS'taki (§96) açığın aksine bu yol yarışı kapatır.
    expect(settled.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = settled.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ChargebackExceedsCollectionException);
  });
});
