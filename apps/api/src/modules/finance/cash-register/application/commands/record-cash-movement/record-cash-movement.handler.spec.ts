import { Decimal } from 'decimal.js';
import { randomUUID } from 'crypto';
import { RecordCashMovementHandler } from './record-cash-movement.handler';
import { RecordCashMovementCommand } from './record-cash-movement.command';
import { CashSession } from '@modules/finance/cash-register/domain/entities/cash-session.entity';
import { CashMovement } from '@modules/finance/cash-register/domain/entities/cash-movement.entity';
import { ICashSessionCommandRepository } from '@modules/finance/cash-register/domain/repositories/cash-session/cash-session.command.repository';
import { ICashMovementCommandRepository } from '@modules/finance/cash-register/domain/repositories/cash-movement/cash-movement.command.repository';
import { InsufficientCashInDrawerException } from '@modules/finance/cash-register/domain/exceptions/cash-register.exceptions';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '@src/domain/constants/execution-source.constant';
import CashMovementTypeSchema from '@input-type-schemas/CashMovementTypeSchema';
import type { RecordCashMovement } from '@shared/modules/cash-register/types/commands';
import CurrencySchema from '@input-type-schemas/CurrencySchema';

/**
 * Kasadan çıkış, çekmecedeki nakitle sınırlıdır.
 *
 * Kapı yokken: 1.200 ₺ olan çekmeceden 50.000 ₺ "bankaya yatırma" kaydedilebiliyordu.
 * Sonuç iki uydurma kayıt: (1) hiç yatırılmamış para 102 Bankalar'a borç yazılıyor,
 * (2) kapanışta beklenen tutar negatif olduğu için fark pozitif çıkıyor ve köprü
 * onu 679 Diğer Olağandışı Gelir olarak fişliyor. İki fiş de kendi içinde dengeli
 * olduğu için Σborç = Σalacak kontrolü sessiz kalıyordu.
 */
describe('RecordCashMovementHandler — çekmece kapısı', () => {
  const SESSION_ID = randomUUID();
  const CLINIC_ID = randomUUID();
  const ORG_ID = randomUUID();
  const ACTOR_ID = 'aB3xY9zQ7wE1rT5yU8iO2pL4kJ6h';

  const ctx: IGetContext = {
    actor: {
      userId: ACTOR_ID,
      clinicId: CLINIC_ID,
      organizationId: ORG_ID,
      managedClinics: [{ id: CLINIC_ID }],
    } as IGetContext['actor'],
    source: ExecutionSources.USER_ACTION,
  };

  const build = (openingFloat: number, totals: { in: number; out: number }) => {
    let txDepth = 0;
    const depthAtCall: Record<string, number> = {};
    const callOrder: string[] = [];

    const session = CashSession.open({
      id: SESSION_ID,
      cashRegisterId: randomUUID(),
      clinicId: CLINIC_ID,
      organizationId: ORG_ID,
      currency: CurrencySchema.enum.TRY,
      openingFloat,
      openedById: ACTOR_ID,
    });

    const findByIdForUpdate = jest.fn(() => {
      depthAtCall.lock = txDepth;
      callOrder.push('lock');
      return Promise.resolve(session);
    });
    const sumMovements = jest.fn(() => {
      depthAtCall.sum = txDepth;
      callOrder.push('sum');
      return Promise.resolve({
        totalIn: new Decimal(totals.in),
        totalOut: new Decimal(totals.out),
      });
    });
    // Kilitsiz okuma yolları bilerek tanımsız: handler kullanırsa test patlar.
    const cashSessionRepo = {
      findByIdForUpdate,
      sumMovements,
    } as unknown as ICashSessionCommandRepository;

    const create = jest.fn((m: CashMovement) => {
      callOrder.push('create');
      return Promise.resolve(m);
    });
    const cashMovementRepo = {
      create,
    } as unknown as ICashMovementCommandRepository;

    const policyFactory = {
      finance: jest.fn().mockReturnValue({
        evaluator: {
          check: jest.fn().mockReturnValue({ orThrow: () => undefined }),
        },
      }),
    } as never;

    const txManager = {
      run: jest.fn(async (cb: () => Promise<unknown>) => {
        txDepth++;
        try {
          return await cb();
        } finally {
          txDepth--;
        }
      }),
    } as unknown as TransactionManager;

    return {
      handler: new RecordCashMovementHandler(
        cashSessionRepo,
        cashMovementRepo,
        policyFactory,
        txManager
      ),
      sumMovements,
      create,
      depthAtCall,
      callOrder,
    };
  };

  const command = (type: RecordCashMovement['type'], amount: number) =>
    new RecordCashMovementCommand({
      sessionId: SESSION_ID,
      data: { type, amount },
      ctx,
    });

  it('çekmecedeki nakdi aşan çıkış reddedilir ve hareket yazılmaz', async () => {
    const { handler, create } = build(1000, { in: 200, out: 0 });

    await expect(
      handler.execute(command(CashMovementTypeSchema.enum.BANK_DEPOSIT, 50_000))
    ).rejects.toBeInstanceOf(InsufficientCashInDrawerException);

    expect(create).not.toHaveBeenCalled();
  });

  it('hata çekmecedeki tutarı ve istenen tutarı taşır', async () => {
    const { handler } = build(1000, { in: 200, out: 0 });

    await expect(
      handler.execute(command(CashMovementTypeSchema.enum.EXPENSE, 1300))
    ).rejects.toMatchObject({
      meta: { available: '1200.00', requested: '1300.00', currency: 'TRY' },
    });
  });

  it('çekmecedeki kadar çıkış kaydedilir (sınır tutar geçer)', async () => {
    const { handler, create } = build(1000, { in: 200, out: 0 });

    await handler.execute(
      command(CashMovementTypeSchema.enum.REFUND_PAYOUT, 1200)
    );

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('önceki çıkışlar düşülür — aynı para iki kez harcanamaz', async () => {
    const { handler } = build(1000, { in: 0, out: 1000 });

    await expect(
      handler.execute(command(CashMovementTypeSchema.enum.CASH_OUT, 0.01))
    ).rejects.toBeInstanceOf(InsufficientCashInDrawerException);
  });

  it('giriş hareketinde toplam hiç okunmaz (kapı yalnız çıkışa aittir)', async () => {
    const { handler, sumMovements, create } = build(0, { in: 0, out: 0 });

    await handler.execute(
      command(CashMovementTypeSchema.enum.SALE_COLLECTION, 5000)
    );

    expect(sumMovements).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('toplam, oturum kilidi alındıktan SONRA ve aynı transaction içinde okunur', async () => {
    // Kilitsiz okunan toplam, eşzamanlı ikinci çıkışın aynı parayı ikinci kez
    // harcamasına izin verirdi: iki istek de "1.200 var" görür.
    const { handler, depthAtCall, callOrder } = build(1000, {
      in: 200,
      out: 0,
    });

    await handler.execute(command(CashMovementTypeSchema.enum.EXPENSE, 100));

    expect(callOrder).toEqual(['lock', 'sum', 'create']);
    expect(depthAtCall.lock).toBe(1);
    expect(depthAtCall.sum).toBe(1);
  });
});
