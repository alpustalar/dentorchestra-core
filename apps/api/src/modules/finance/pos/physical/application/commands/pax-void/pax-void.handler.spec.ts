import { ForbiddenException } from '@nestjs/common';
import { PaxVoidHandler } from './pax-void.handler';
import { PaxVoidCommand } from './pax-void.command';
import { PosTransaction } from '@modules/finance/pos/physical/domain/entities/pos-transaction.entity';
import { PosDevice } from '@modules/finance/pos/physical/domain/entities/pos-device.entity';
import { IPosTransactionCommandRepository } from '@modules/finance/pos/physical/domain/repositories/pos-transaction/pos-transaction.command.repository';
import { IPosDeviceCommandRepository } from '@modules/finance/pos/physical/domain/repositories/pos-device/pos-device.command.repository';
import { PosTransactionReversalSummary } from '@modules/finance/pos/physical/domain/contracts/pos-transaction';
import {
  PosTransactionAlreadyReversedException,
  PosTransactionClinicMismatchException,
} from '@modules/finance/pos/physical/domain/exceptions/pos.exceptions';
import { PaxService } from '@src/infrastructure/payment/pos/physical/providers/pax/pax.service';
import { PaxConnectionError } from '@src/infrastructure/payment/pos/physical/providers/pax/pax.errors';
import { PosPaymentSyncService } from '@modules/finance/pos/physical/application/services/pos-payment-sync.service';
import { PosAccountingBridgeService } from '@modules/finance/pos/physical/application/services/pos-accounting-bridge.service';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '@src/domain/constants/execution-source.constant';
import PosTransactionKindSchema from '@input-type-schemas/PosTransactionKindSchema';
import CurrencySchema from '@input-type-schemas/CurrencySchema';
import { Decimal } from 'decimal.js';

describe('PaxVoidHandler — iptal (kilit + ters kayıt bağı)', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
  const DEVICE_ID = '22222222-2222-4222-8222-222222222222';

  const ctx: IGetContext = {
    actor: { userId: 'user-1', clinicId: CLINIC_ID } as IGetContext['actor'],
    source: ExecutionSources.USER_ACTION,
  };

  /** Cihazdan onay dönmüş, iptal edilebilir bir satış. */
  const makeSuccessfulSale = (): PosTransaction => {
    const sale = PosTransaction.create({
      posDeviceId: DEVICE_ID,
      clinicId: CLINIC_ID,
      amount: 123.45,
      currency: CurrencySchema.enum.TRY,
      initiatedById: 'firebase-staff-uid-1',
    });
    sale.markSuccess('HOSTREF-ORIGINAL');
    return sale;
  };

  const makeDevice = (): PosDevice =>
    PosDevice.create({
      id: DEVICE_ID,
      clinicId: CLINIC_ID,
      label: 'Kasa 1',
      provider: 'PAX',
      terminalId: 'T1',
      merchantId: 'M1',
      host: '127.0.0.1',
      port: 10009,
    });

  const noReversal: PosTransactionReversalSummary = {
    hasActiveVoid: false,
    refundedAmount: new Decimal(0),
  };

  const build = (
    sale: PosTransaction | null,
    reversal: PosTransactionReversalSummary = noReversal,
    voidResult: (() => Promise<unknown>) | null = null,
    denyPolicy = false
  ) => {
    let txDepth = 0;
    const depthAtCall: Record<string, number> = {};

    const findByIdForUpdate = jest.fn(() => {
      depthAtCall.loadOriginal = txDepth;
      return Promise.resolve(sale);
    });
    const findLiveReversalSummary = jest.fn(() => {
      depthAtCall.reversalCheck = txDepth;
      return Promise.resolve(reversal);
    });
    const created: PosTransaction[] = [];
    const create = jest.fn((entity: PosTransaction) => {
      created.push(entity);
      return Promise.resolve(entity);
    });
    const update = jest.fn((entity: PosTransaction) => Promise.resolve(entity));

    // Kilitsiz `findById` bilerek tanımsız: handler kullanırsa test patlar.
    const posTransactionRepo = {
      findByIdForUpdate,
      findLiveReversalSummary,
      create,
      update,
    } as unknown as IPosTransactionCommandRepository;

    const posDeviceRepo = {
      findById: jest.fn(() => Promise.resolve(makeDevice())),
    } as unknown as IPosDeviceCommandRepository;

    const voidCall = jest.fn((input: { amountInMinorUnits: number }) => {
      depthAtCall.device = txDepth;
      if (voidResult) return voidResult();
      return Promise.resolve({
        approved: true,
        responseCode: '00',
        responseText: 'APPROVED',
        externalRef: 'HOSTREF-VOID',
        rawResponse: { amount: String(input.amountInMinorUnits) },
      });
    });
    const paxService = { void: voidCall } as unknown as PaxService;

    const runInTx = async (cb: () => Promise<unknown>) => {
      txDepth++;
      try {
        return await cb();
      } finally {
        txDepth--;
      }
    };
    const outboxRun = jest.fn(runInTx);
    const run = jest.fn(runInTx);
    const txManager = { outboxRun, run } as unknown as TransactionManager;

    const posPaymentSync = {
      markRefunded: jest.fn(() => Promise.resolve()),
    } as unknown as PosPaymentSyncService;

    // Muhasebe köprüsü: ters kayıt artık PAYMENT_REFUNDED olayını da yazar
    // (120 / 108). Çağrıldığı testlerde girdisi doğrulanıyor.
    const bridgeRecord = jest.fn(() => Promise.resolve());
    const accountingBridge = {
      recordBestEffort: bridgeRecord,
    } as unknown as PosAccountingBridgeService;

    // Kiracı kapsamı kontrolü: aktör bu kliniğe erişebiliyor kabul edilir.
    // Reddedilme yolu ayrı testte doğrulanıyor.
    const policyFactory = {
      finance: jest.fn().mockReturnValue({
        evaluator: {
          check: jest.fn().mockReturnValue({
            orThrow: () => {
              if (denyPolicy) throw new ForbiddenException('yetkisiz');
            },
          }),
        },
      }),
    } as never;

    return {
      handler: new PaxVoidHandler(
        posDeviceRepo,
        posTransactionRepo,
        paxService,
        txManager,
        posPaymentSync,
        accountingBridge,
        policyFactory
      ),
      posTransactionRepo,
      findByIdForUpdate,
      findLiveReversalSummary,
      create,
      created,
      voidCall,
      bridgeRecord,
      depthAtCall,
    };
  };

  const commandFor = (sale: PosTransaction) =>
    new PaxVoidCommand(
      { originalPosTransactionId: sale.id.value, clinicId: CLINIC_ID },
      ctx
    );

  it('iptal kaydı VOID türünde, orijinale bağlı ve kilidi tutar şekilde açılır', async () => {
    const sale = makeSuccessfulSale();
    const { handler, created } = build(sale);

    await handler.execute(commandFor(sale));

    expect(created).toHaveLength(1);
    expect(created[0].kind).toBe(PosTransactionKindSchema.enum.VOID);
    expect(created[0].originalPosTransactionId).toBe(sale.id.value);
    expect(created[0].activeVoidOriginalId).toBe(sale.id.value);
  });

  it('zaten iptal edilmiş satış için cihaza İKİNCİ kez gidilmez', async () => {
    const sale = makeSuccessfulSale();
    const { handler, voidCall, create } = build(sale, {
      hasActiveVoid: true,
      refundedAmount: new Decimal(0),
    });

    await expect(handler.execute(commandFor(sale))).rejects.toBeInstanceOf(
      PosTransactionAlreadyReversedException
    );

    expect(voidCall).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('kısmen iade edilmiş satış iptal edilemez', async () => {
    const sale = makeSuccessfulSale();
    const { handler, voidCall } = build(sale, {
      hasActiveVoid: false,
      refundedAmount: new Decimal(30),
    });

    await expect(handler.execute(commandFor(sale))).rejects.toBeInstanceOf(
      PosTransactionAlreadyReversedException
    );

    expect(voidCall).not.toHaveBeenCalled();
  });

  it('kararı besleyen okumalar kilitli, cihaz çağrısı transaction dışında', async () => {
    const sale = makeSuccessfulSale();
    const {
      handler,
      posTransactionRepo,
      findByIdForUpdate,
      findLiveReversalSummary,
      depthAtCall,
    } = build(sale);

    await handler.execute(commandFor(sale));

    expect(findByIdForUpdate).toHaveBeenCalledWith(sale.id.value);
    expect(findLiveReversalSummary).toHaveBeenCalledWith(sale.id.value);
    expect(
      (posTransactionRepo as { findById?: unknown }).findById
    ).toBeUndefined();
    expect(depthAtCall.loadOriginal).toBe(1);
    expect(depthAtCall.reversalCheck).toBe(1);
    // TCP çağrısı kilidi tutmaz — cihaz yavaşlarsa satır kilitli beklemez.
    expect(depthAtCall.device).toBe(0);
  });

  it('cihaza gönderilen tutar kuruş cinsinden doğrudur (Money → NaN değil)', async () => {
    const sale = makeSuccessfulSale();
    const { handler, voidCall } = build(sale);

    await handler.execute(commandFor(sale));

    expect(voidCall).toHaveBeenCalledWith(
      expect.objectContaining({ amountInMinorUnits: 12345 })
    );
  });

  it('cihaz bağlantı hatasında kayıt FAILED olur ve iptal kilidi bırakılır', async () => {
    const sale = makeSuccessfulSale();
    const { handler, created } = build(sale, noReversal, () =>
      Promise.reject(new PaxConnectionError('bağlantı yok'))
    );

    const result = await handler.execute(commandFor(sale));

    expect(result.status).toBe('FAILED');
    // Kilit bırakılmazsa bu satış bir daha hiç iptal edilemezdi.
    expect(created[0].activeVoidOriginalId).toBeNull();
  });

  it('aktör kliniğine ait olmayan işlemde cihaza HİÇ gidilmez', async () => {
    // `clinicId` istek gövdesinden geliyor; kapsam kontrolü olmadan POS yetkisi
    // olan personel başka kliniğin terminalinde iptal yürütebilirdi. Kontrol
    // cihaz çağrısından ÖNCE olmalı — sonra olsaydı para çoktan hareket etmişti.
    const sale = makeSuccessfulSale();
    const { handler, voidCall, create } = build(sale, noReversal, null, true);

    await expect(handler.execute(commandFor(sale))).rejects.toThrow(
      ForbiddenException
    );

    expect(voidCall).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('orijinal satış BAŞKA kliniğe aitse cihaza hiç gidilmez', () => {
    // Regresyon: yetki `input.clinicId` ile veriliyor, iptal edilecek satış ise
    // `originalPosTransactionId` ile. İkisi bağlanmadığında A kliniği personeli
    // kendi id'siyle B kliniğinin satışını iptal ettirebiliyordu — para B'nin
    // üye işyerinden çıkar, iptal kaydı A'nın defterine düşerdi.
    const foreignSale = PosTransaction.create({
      posDeviceId: DEVICE_ID,
      clinicId: '99999999-9999-4999-8999-999999999999',
      amount: 123.45,
      currency: CurrencySchema.enum.TRY,
      initiatedById: 'firebase-staff-uid-1',
    });
    foreignSale.markSuccess('HOSTREF-FOREIGN');

    const { handler, voidCall, create } = build(foreignSale);

    return expect(handler.execute(commandFor(foreignSale)))
      .rejects.toBeInstanceOf(PosTransactionClinicMismatchException)
      .then(() => {
        expect(voidCall).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
      });
  });
  it('iptal kaydı satışı çekeni değil, iptali yapan aktörü damgalar', async () => {
    // Handler `ctx.actor`'ü bugüne kadar yalnız yetki kontrolünde okuyup atıyordu:
    // bir kart satışını kimin iptal ettiği ne kolonda ne audit log'da duruyordu.
    // Damga ters kaydın KENDİ satırına basılır — orijinalin damgası devralınsaydı
    // iptali yapan kişi izde hiç görünmezdi.
    const sale = makeSuccessfulSale();
    const { handler, created } = build(sale);

    await handler.execute(commandFor(sale));

    expect(created).toHaveLength(1);
    expect(created[0].initiatedById).toBe(ctx.actor.userId);
    expect(created[0].initiatedById).not.toBe(sale.initiatedById);
  });
});
