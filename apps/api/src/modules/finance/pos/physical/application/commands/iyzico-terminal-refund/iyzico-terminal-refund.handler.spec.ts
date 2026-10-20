import { IyzicoTerminalRefundHandler } from './iyzico-terminal-refund.handler';
import {
  AssertReversalWithinCollectionParams,
  ICardChargebackExposureGuard,
} from '@modules/finance/bank/domain/services/card-chargeback-exposure/card-chargeback-exposure.guard.interface';
import { CollectionUnderChargebackException } from '@modules/finance/bank/domain/exceptions/bank.exceptions';
import { IyzicoTerminalRefundCommand } from './iyzico-terminal-refund.command';
import { PosTransaction } from '@modules/finance/pos/physical/domain/entities/pos-transaction.entity';
import { PosDevice } from '@modules/finance/pos/physical/domain/entities/pos-device.entity';
import { IPosTransactionCommandRepository } from '@modules/finance/pos/physical/domain/repositories/pos-transaction/pos-transaction.command.repository';
import { IPosDeviceCommandRepository } from '@modules/finance/pos/physical/domain/repositories/pos-device/pos-device.command.repository';
import { PosTransactionReversalSummary } from '@modules/finance/pos/physical/domain/contracts/pos-transaction';
import {
  PosTransactionAlreadyReversedException,
  RefundAmountExceedsOriginalException,
} from '@modules/finance/pos/physical/domain/exceptions/pos.exceptions';
import { ResolveIyzicoTerminalCredentialsService } from '@modules/finance/pos/physical/application/services/resolve-iyzico-terminal-credentials.service';
import { IyzicoTerminalService } from '@src/infrastructure/payment/pos/physical/providers/iyzico-terminal/iyzico-terminal.service';
import { PosPaymentSyncService } from '@modules/finance/pos/physical/application/services/pos-payment-sync.service';
import { PosAccountingBridgeService } from '@modules/finance/pos/physical/application/services/pos-accounting-bridge.service';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '../../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import PosTransactionKindSchema from '@input-type-schemas/PosTransactionKindSchema';
import CurrencySchema from '@input-type-schemas/CurrencySchema';
import { Decimal } from 'decimal.js';

describe('IyzicoTerminalRefundHandler — iade (kilit + kümülatif tutar)', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
  const DEVICE_ID = '22222222-2222-4222-8222-222222222222';
  const SALE_AMOUNT = 200;

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
    });
    sale.markSuccess('IYZ-PAYMENT-1', { paymentDate: '2026-08-13 10:00:00' });
    return sale;
  };

  const makeDevice = (): PosDevice =>
    PosDevice.create({
      id: DEVICE_ID,
      clinicId: CLINIC_ID,
      label: 'Terminal 1',
      provider: 'IYZICO_TERMINAL',
      deviceUniqueId: 'DEV-1',
    });

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

    // Kilitsiz `findById` bilerek tanımsız: handler kullanırsa test patlar.
    const posTransactionRepo = {
      findByIdForUpdate,
      findLiveReversalSummary,
      create,
      update: jest.fn((entity: PosTransaction) => Promise.resolve(entity)),
    } as unknown as IPosTransactionCommandRepository;

    const posDeviceRepo = {
      findById: jest.fn(() => Promise.resolve(makeDevice())),
    } as unknown as IPosDeviceCommandRepository;

    const refundPayment = jest.fn(() => {
      depthAtCall.device = txDepth;
      return Promise.resolve({
        status: 'SUCCESS',
        refundHostReference: 'IYZ-REFUND-1',
        paymentId: 'IYZ-PAYMENT-1',
      });
    });
    const iyzicoTerminalService = {
      refundPayment,
    } as unknown as IyzicoTerminalService;

    const credentialsResolver = {
      resolve: jest.fn(() => Promise.resolve({ clientId: 'c' })),
    } as unknown as ResolveIyzicoTerminalCredentialsService;

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
    const bridgeRecord = jest.fn(() => Promise.resolve());
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

    // Kart itirazı kapısı: varsayılan olarak geçirir. Çağrı, iade/iptal kararını
    // besleyen kilitli okumalarla AYNI transaction derinliğinde olmak zorundadır.
    const assertReversal = jest.fn<
      Promise<void>,
      [AssertReversalWithinCollectionParams]
    >(() => {
      depthAtCall.chargebackGuard = txDepth;
      return Promise.resolve();
    });
    const chargebackGuard = {
      assertReversalWithinCollection: assertReversal,
    } as unknown as ICardChargebackExposureGuard;

    return {
      handler: new IyzicoTerminalRefundHandler(
        posDeviceRepo,
        posTransactionRepo,
        credentialsResolver,
        iyzicoTerminalService,
        txManager,
        posPaymentSync,
        accountingBridge,
        policyFactory,
        chargebackGuard
      ),
      posTransactionRepo,
      findByIdForUpdate,
      findLiveReversalSummary,
      created,
      refundPayment,
      depthAtCall,
      assertReversal,
    };
  };

  const commandFor = (sale: PosTransaction, amount?: number) =>
    new IyzicoTerminalRefundCommand(
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

    await handler.execute(commandFor(sale, 80));

    expect(created[0].kind).toBe(PosTransactionKindSchema.enum.REFUND);
    expect(created[0].originalPosTransactionId).toBe(sale.id.value);
    expect(created[0].activeVoidOriginalId).toBeNull();
  });

  it('kalan tutar kadar ikinci kısmi iade yapılabilir', async () => {
    const sale = makeSuccessfulSale();
    const { handler, refundPayment } = build(sale, {
      hasActiveVoid: false,
      refundedAmount: new Decimal(150),
    });

    await handler.execute(commandFor(sale, 50));

    expect(refundPayment).toHaveBeenCalledWith(
      expect.objectContaining({ price: 50 })
    );
  });

  it('kümülatif iade satış tutarını aşamaz — ikinci tam iade reddedilir', async () => {
    const sale = makeSuccessfulSale();
    const { handler, refundPayment } = build(sale, {
      hasActiveVoid: false,
      refundedAmount: new Decimal(SALE_AMOUNT),
    });

    await expect(
      handler.execute(commandFor(sale, SALE_AMOUNT))
    ).rejects.toBeInstanceOf(RefundAmountExceedsOriginalException);

    expect(refundPayment).not.toHaveBeenCalled();
  });

  it('iptal edilmiş satış iade edilemez', async () => {
    const sale = makeSuccessfulSale();
    const { handler, refundPayment } = build(sale, {
      hasActiveVoid: true,
      refundedAmount: new Decimal(0),
    });

    await expect(handler.execute(commandFor(sale, 10))).rejects.toBeInstanceOf(
      PosTransactionAlreadyReversedException
    );

    expect(refundPayment).not.toHaveBeenCalled();
  });

  it('kararı besleyen okumalar kilitli, sağlayıcı çağrısı transaction dışında', async () => {
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

  it('kart itirazı kapısı kümülatif tutarlarla ve kilit altında çağrılır', async () => {
    // Para geri götüren her yol (iade, iptal, ters ibraz) aynı kümülatif tavana
    // bakar; biri diğerini bilmiyorsa kart sahibine para İKİ KEZ gider.
    const sale = makeSuccessfulSale();
    const { handler, assertReversal, depthAtCall } = build(sale, {
      hasActiveVoid: false,
      refundedAmount: new Decimal(30),
    });

    await handler.execute(commandFor(sale, 40));

    expect(assertReversal).toHaveBeenCalledTimes(1);
    const params = assertReversal.mock.calls[0][0];
    expect(params.sourceType).toBe('POS_TRANSACTION');
    expect(params.sourceId).toBe(sale.id.value);
    expect(params.collectedAmount.toFixed(2)).toBe(
      sale.amount.value.toFixed(2)
    );
    expect(params.alreadyReversedAmount.toFixed(2)).toBe('30.00');
    expect(params.requestedAmount.toFixed(2)).toBe('40.00');
    // Karar besleyen okumalarla aynı transaction'da (kilit kapsamında).
    expect(depthAtCall.chargebackGuard).toBe(1);
  });

  it('açık/kaybedilmiş kart itirazı varken iade reddedilir — cihaza gidilmez, kayıt açılmaz', async () => {
    const sale = makeSuccessfulSale();
    const { handler, assertReversal, created } = build(sale, {
      hasActiveVoid: false,
      refundedAmount: new Decimal(30),
    });
    assertReversal.mockRejectedValueOnce(
      new CollectionUnderChargebackException({
        collected: sale.amount.value.toFixed(2),
        alreadyReversed: '0.00',
        activeChargebacks: sale.amount.value.toFixed(2),
        requested: sale.amount.value.toFixed(2),
      })
    );

    await expect(handler.execute(commandFor(sale, 40))).rejects.toBeInstanceOf(
      CollectionUnderChargebackException
    );

    expect(created).toHaveLength(0);
  });
});
