import { PaxRefundHandler } from './pax-refund.handler';
import { PaxRefundCommand } from './pax-refund.command';
import { PosTransaction } from '@modules/finance/pos/physical/domain/entities/pos-transaction.entity';
import { PosDevice } from '@modules/finance/pos/physical/domain/entities/pos-device.entity';
import { IPosTransactionCommandRepository } from '@modules/finance/pos/physical/domain/repositories/pos-transaction/pos-transaction.command.repository';
import { IPosDeviceCommandRepository } from '@modules/finance/pos/physical/domain/repositories/pos-device/pos-device.command.repository';
import { PosTransactionReversalSummary } from '@modules/finance/pos/physical/domain/contracts/pos-transaction';
import {
  PosTransactionAlreadyReversedException,
  RefundAmountExceedsOriginalException,
} from '@modules/finance/pos/physical/domain/exceptions/pos.exceptions';
import { PaxService } from '@src/infrastructure/payment/pos/physical/providers/pax/pax.service';
import { PosPaymentSyncService } from '@modules/finance/pos/physical/application/services/pos-payment-sync.service';
import {
  PosAccountingBridgeInput,
  PosAccountingBridgeService,
} from '@modules/finance/pos/physical/application/services/pos-accounting-bridge.service';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '@src/domain/constants/execution-source.constant';
import PosTransactionKindSchema from '@input-type-schemas/PosTransactionKindSchema';
import CurrencySchema from '@input-type-schemas/CurrencySchema';
import { Decimal } from 'decimal.js';

describe('PaxRefundHandler — iade (kilit + kümülatif tutar)', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
  const DEVICE_ID = '22222222-2222-4222-8222-222222222222';
  const SALE_AMOUNT = 100;

  const ctx: IGetContext = {
    actor: { userId: 'user-1', clinicId: CLINIC_ID } as IGetContext['actor'],
    source: ExecutionSources.USER_ACTION,
  };

  const makeSuccessfulSale = (): PosTransaction => {
    const sale = PosTransaction.create({
      posDeviceId: DEVICE_ID,
      clinicId: CLINIC_ID,
      amount: SALE_AMOUNT,
      currency: CurrencySchema.enum.TRY,
      initiatedById: 'firebase-staff-uid-1',
      // Cari sahibi: iade köprüsü hastayı ORİJİNAL satıştan çözer (istek
      // gövdesinden değil — başka bir hastanın carisine yazılamaz).
      patientId: PATIENT_ID,
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

  const PATIENT_ID = '44444444-4444-4444-8444-444444444444';

  const noReversal: PosTransactionReversalSummary = {
    hasActiveVoid: false,
    refundedAmount: new Decimal(0),
  };

  const build = (
    sale: PosTransaction,
    reversal: PosTransactionReversalSummary = noReversal
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

    const refundCall = jest.fn(() => {
      depthAtCall.device = txDepth;
      return Promise.resolve({
        approved: true,
        responseCode: '00',
        responseText: 'APPROVED',
        externalRef: 'HOSTREF-REFUND',
        rawResponse: {},
      });
    });
    const paxService = { refund: refundCall } as unknown as PaxService;

    const runInTx = async (cb: () => Promise<unknown>) => {
      txDepth++;
      try {
        return await cb();
      } finally {
        txDepth--;
      }
    };
    const txManager = {
      outboxRun: jest.fn(runInTx),
      run: jest.fn(runInTx),
    } as unknown as TransactionManager;

    const posPaymentSync = {
      markRefunded: jest.fn(() => Promise.resolve()),
    } as unknown as PosPaymentSyncService;

    // Muhasebe köprüsü: ters kayıt artık PAYMENT_REFUNDED olayını da yazar
    // (120 / 108). Çağrıldığı testlerde girdisi doğrulanıyor.
    // Argümansız `jest.fn()` çağrı tuple'ını `[]` olarak tipler ve
    // `mock.calls[0][0]` TS2493 verir — mock'u girdi tipiyle tiple.
    const bridgeRecord = jest.fn<Promise<void>, [PosAccountingBridgeInput]>(
      () => Promise.resolve()
    );
    const accountingBridge = {
      recordBestEffort: bridgeRecord,
    } as unknown as PosAccountingBridgeService;

    // Kiracı kapsamı kontrolü: aktör bu kliniğe erişebiliyor kabul edilir.
    // Reddedilme yolu ayrı testte doğrulanıyor.
    const policyFactory = {
      finance: jest.fn().mockReturnValue({
        evaluator: {
          check: jest.fn().mockReturnValue({ orThrow: () => undefined }),
        },
      }),
    } as never;

    return {
      handler: new PaxRefundHandler(
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
      created,
      refundCall,
      bridgeRecord,
      depthAtCall,
    };
  };

  const commandFor = (sale: PosTransaction, amount?: number) =>
    new PaxRefundCommand(
      {
        originalPosTransactionId: sale.id.value,
        clinicId: CLINIC_ID,
        amount,
      },
      ctx
    );

  it('iade kaydı REFUND türünde, orijinale bağlı ama iptal kilidi tutmadan açılır', async () => {
    const sale = makeSuccessfulSale();
    const { handler, created } = build(sale);

    await handler.execute(commandFor(sale, 40));

    expect(created[0].kind).toBe(PosTransactionKindSchema.enum.REFUND);
    expect(created[0].originalPosTransactionId).toBe(sale.id.value);
    // Kısmi iadeler çoklu olabilir; iade DB kilidini tutmaz.
    expect(created[0].activeVoidOriginalId).toBeNull();
  });

  it('kalan tutar kadar ikinci kısmi iade yapılabilir', async () => {
    const sale = makeSuccessfulSale();
    const { handler, created, refundCall } = build(sale, {
      hasActiveVoid: false,
      refundedAmount: new Decimal(60),
    });

    await handler.execute(commandFor(sale, 40));

    expect(refundCall).toHaveBeenCalled();
    expect(created[0].amount.value.toNumber()).toBe(40);
  });

  it('kümülatif iade satış tutarını aşamaz — ikinci tam iade reddedilir', async () => {
    const sale = makeSuccessfulSale();
    const { handler, refundCall } = build(sale, {
      hasActiveVoid: false,
      refundedAmount: new Decimal(SALE_AMOUNT),
    });

    // Tek tek bakan eski kontrol bunu geçirirdi: 100 <= 100.
    await expect(
      handler.execute(commandFor(sale, SALE_AMOUNT))
    ).rejects.toBeInstanceOf(RefundAmountExceedsOriginalException);

    expect(refundCall).not.toHaveBeenCalled();
  });

  it('kısmi iadelerin toplamı satışı aşarsa reddedilir', async () => {
    const sale = makeSuccessfulSale();
    const { handler, refundCall } = build(sale, {
      hasActiveVoid: false,
      refundedAmount: new Decimal(70),
    });

    await expect(handler.execute(commandFor(sale, 40))).rejects.toBeInstanceOf(
      RefundAmountExceedsOriginalException
    );

    expect(refundCall).not.toHaveBeenCalled();
  });

  it('iptal edilmiş satış iade edilemez', async () => {
    const sale = makeSuccessfulSale();
    const { handler, refundCall } = build(sale, {
      hasActiveVoid: true,
      refundedAmount: new Decimal(0),
    });

    await expect(handler.execute(commandFor(sale, 10))).rejects.toBeInstanceOf(
      PosTransactionAlreadyReversedException
    );

    expect(refundCall).not.toHaveBeenCalled();
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
    expect(depthAtCall.device).toBe(0);
  });

  it('cihaza gönderilen tutar kuruş cinsinden doğrudur (Money → NaN değil)', async () => {
    const sale = makeSuccessfulSale();
    const { handler, refundCall } = build(sale);

    await handler.execute(commandFor(sale, 12.34));

    expect(refundCall).toHaveBeenCalledWith(
      expect.objectContaining({ amountInMinorUnits: 1234 })
    );
  });

  it('iade muhasebe köprüsünü TERS KAYIT olarak çağırır (120 / 108)', async () => {
    // P0 regresyonu: iade yevmiyeye hiç ulaşmıyordu. Taksit REFUNDED oluyor,
    // cari defter düzeliyor, POS satırı damgalanıyordu — ama tahsilat fişi
    // olduğu gibi kalıyordu: 108'de hiç gelmeyecek para, 120'de kapanmış
    // görünen borç.
    const sale = makeSuccessfulSale();
    const { handler, bridgeRecord } = build(sale);

    await handler.execute(
      new PaxRefundCommand(
        {
          clinicId: CLINIC_ID,
          originalPosTransactionId: sale.id.value,
          amount: 40,
        } as never,
        ctx
      )
    );

    expect(bridgeRecord).toHaveBeenCalledTimes(1);
    const bridged = bridgeRecord.mock.calls[0][0];
    expect(bridged.kind).toBe('REVERSAL');
    // Hasta ORİJİNAL satıştan gelir; tutar fiilen iade edilen tutardır.
    expect(bridged.patientId).toBe(PATIENT_ID);
    expect(bridged.amount.toFixed(2)).toBe('40.00');
    expect(bridged.originalPosTransactionId).toBe(sale.id.value);
  });

  it('iade kaydı hasta bağını orijinal satıştan devralır', async () => {
    const sale = makeSuccessfulSale();
    const { handler, created } = build(sale);

    await handler.execute(
      new PaxRefundCommand(
        {
          clinicId: CLINIC_ID,
          originalPosTransactionId: sale.id.value,
        } as never,
        ctx
      )
    );

    expect(created[0].patientId?.value).toBe(PATIENT_ID);
  });
});
