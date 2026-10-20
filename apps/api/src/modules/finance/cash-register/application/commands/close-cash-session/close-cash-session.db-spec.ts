import {
  allowAllPolicyFactory,
  createFinanceDbHarness,
  FinanceDbHarness,
  LedgerFixture,
  makeCtx,
  readStoredEntry,
  seedLedger,
} from '@src/testing/finance-db/finance-db.harness';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { PostFinancialEventCommand } from '@modules/finance/accounting/posting/application/commands/post-financial-event/post-financial-event.command';
import { CashRegisterCommandRepository } from '@modules/finance/cash-register/infrastructure/persistence/prisma/repositories/cash-register/cash-register.command.repository';
import { CashSessionCommandRepository } from '@modules/finance/cash-register/infrastructure/persistence/prisma/repositories/cash-session/cash-session.command.repository';
import { CashMovementCommandRepository } from '@modules/finance/cash-register/infrastructure/persistence/prisma/repositories/cash-movement/cash-movement.command.repository';
import { CreateCashRegisterHandler } from './../create-cash-register/create-cash-register.handler';
import { CreateCashRegisterCommand } from './../create-cash-register/create-cash-register.command';
import { OpenCashSessionHandler } from './../open-cash-session/open-cash-session.handler';
import { OpenCashSessionCommand } from './../open-cash-session/open-cash-session.command';
import { RecordCashMovementHandler } from './../record-cash-movement/record-cash-movement.handler';
import { RecordCashMovementCommand } from './../record-cash-movement/record-cash-movement.command';
import { CloseCashSessionHandler } from './close-cash-session.handler';
import { CloseCashSessionCommand } from './close-cash-session.command';

/**
 * Gerçek-DB turu — kasa akışı (iş paketi 23, kural 21): kasa aç → oturum aç →
 * hareket → kapat → köprü olayı → fiş. `sumMovements` gibi toplama sorguları
 * `Prisma.Decimal` döndürür; domain'e giren her değer burada gerçek sınırdan geçer.
 */
describe('Kasa akışı — gerçek DB', () => {
  let harness: FinanceDbHarness;
  let ledger: LedgerFixture;
  let createRegister: CreateCashRegisterHandler;
  let openSession: OpenCashSessionHandler;
  let recordMovement: RecordCashMovementHandler;
  let closeSession: CloseCashSessionHandler;
  const ctx = makeCtx(UUID.generate().value);
  const criticalFailure = { publish: jest.fn() };

  beforeAll(async () => {
    harness = await createFinanceDbHarness();
    ledger = await seedLedger(harness);

    const registerRepo = new CashRegisterCommandRepository(harness.prisma);
    const sessionRepo = new CashSessionCommandRepository(harness.prisma);
    const movementRepo = new CashMovementCommandRepository(harness.prisma);

    createRegister = new CreateCashRegisterHandler(
      registerRepo,
      allowAllPolicyFactory,
      { resolve: async () => ledger.organizationId } as never,
      harness.txManager
    );
    openSession = new OpenCashSessionHandler(
      registerRepo,
      sessionRepo,
      allowAllPolicyFactory,
      harness.txManager
    );
    recordMovement = new RecordCashMovementHandler(
      sessionRepo,
      movementRepo,
      allowAllPolicyFactory,
      harness.txManager
    );
    closeSession = new CloseCashSessionHandler(
      sessionRepo,
      allowAllPolicyFactory,
      harness.commandBus as never,
      criticalFailure as never,
      harness.txManager
    );
  });

  afterAll(async () => {
    await harness.close();
  });

  async function newOpenSession(openingFloat: number) {
    const registerId = await createRegister.execute(
      new CreateCashRegisterCommand(
        { clinicId: ledger.clinicId, name: `Kasa ${UUID.generate().value.slice(0, 6)}`, currency: 'TRY' },
        ctx
      )
    );
    const sessionId = await openSession.execute(
      new OpenCashSessionCommand({ cashRegisterId: registerId, openingFloat }, ctx)
    );
    return { registerId, sessionId };
  }

  const move = (
    sessionId: string,
    type: 'SALE_COLLECTION' | 'EXPENSE' | 'BANK_DEPOSIT' | 'CASH_IN' | 'CASH_OUT' | 'REFUND_PAYOUT',
    amount: number
  ) =>
    recordMovement.execute(
      new RecordCashMovementCommand({ sessionId, data: { type, amount }, ctx })
    );

  it('tam akış: beklenen tutar, fark, köprü olayı ve fişin saklanan hâli', async () => {
    const { sessionId } = await newOpenSession(100);
    await move(sessionId, 'SALE_COLLECTION', 50.25);
    await move(sessionId, 'EXPENSE', 20);
    await move(sessionId, 'BANK_DEPOSIT', 30);

    // beklenen = 100 + 50.25 − 20 − 30 = 100.25; sayılan 110.25 → fark +10.00
    const result = await closeSession.execute(
      new CloseCashSessionCommand({ sessionId, data: { countedAmount: 110.25 }, ctx })
    );
    expect(result).toMatchObject({
      status: 'CLOSED',
      expectedAmount: '100.25',
      countedAmount: '110.25',
      difference: '10.00',
    });

    const stored = await harness.prisma.cashSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    expect(stored.status).toBe('CLOSED');
    expect(stored.expectedAmount?.toString()).toBe('100.25');
    expect(stored.difference?.toString()).toBe('10');
    expect(stored.accountingEventId).not.toBeNull();

    // Köprü olayı kapanışla AYNI transaction'da yazıldı ve outbox'a mühürlendi.
    const event = await harness.prisma.financialEvent.findUniqueOrThrow({
      where: { id: stored.accountingEventId as string },
    });
    expect(event.type).toBe('CASH_SESSION_CLOSED');
    expect(event.payload).toMatchObject({
      bankDepositTotal: '30.00',
      expenseTotal: '20.00',
      difference: '10.00',
    });
    const outbox = await harness.prisma.outbox.findMany({
      where: { type: 'financial-event.recorded' },
      select: { payload: true },
    });
    expect(
      outbox.some((row) => JSON.stringify(row.payload).includes(event.id))
    ).toBe(true);

    // Olay fişlenir ve fiş dengelidir; sayım fazlası 679'a gelir olarak yazılır.
    const entryId = await harness.postHandler.execute(
      new PostFinancialEventCommand(event.id, ctx)
    );
    const entry = await readStoredEntry(harness, entryId as string);
    expect(entry.status).toBe('POSTED');
    const total = (k: 'debit' | 'credit') =>
      entry.lines.reduce((a, l) => a + Math.round(Number(l[k]) * 100), 0);
    expect(total('debit')).toBe(total('credit'));
    expect(entry.lines.find((l) => l.code === '679')?.credit).toBe('10');
    expect(entry.lines.find((l) => l.code === '102')?.debit).toBe('30');
  });

  it('çekmecedeki nakdi aşan çıkış kayda girmez (kural 14b)', async () => {
    const { sessionId } = await newOpenSession(50);
    await expect(move(sessionId, 'CASH_OUT', 50.01)).rejects.toThrow();
    expect(
      await harness.prisma.cashMovement.count({ where: { cashSessionId: sessionId } })
    ).toBe(0);
    await expect(move(sessionId, 'CASH_OUT', 50)).resolves.toBeUndefined();
  });

  it('ikinci kapanış reddedilir: tek olay, tek fiş', async () => {
    const { sessionId } = await newOpenSession(10);
    await move(sessionId, 'BANK_DEPOSIT', 5);
    const close = () =>
      closeSession.execute(
        new CloseCashSessionCommand({ sessionId, data: { countedAmount: 5 }, ctx })
      );
    await close();
    await expect(close()).rejects.toThrow();

    const events = await harness.prisma.financialEvent.count({
      where: { sourceRefId: sessionId, type: 'CASH_SESSION_CLOSED' },
    });
    expect(events).toBe(1);
  });

  it('eşzamanlı iki kapanış: biri kazanır, tek olay yazılır', async () => {
    const { sessionId } = await newOpenSession(40);
    await move(sessionId, 'EXPENSE', 15);
    const close = () =>
      closeSession.execute(
        new CloseCashSessionCommand({ sessionId, data: { countedAmount: 25 }, ctx })
      );
    const settled = await Promise.allSettled([close(), close()]);

    expect(settled.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(
      await harness.prisma.financialEvent.count({
        where: { sourceRefId: sessionId, type: 'CASH_SESSION_CLOSED' },
      })
    ).toBe(1);
  });

  it('köprü hata verirse kapanış geri sarılır: oturum açık kalır, olay yok', async () => {
    const { sessionId } = await newOpenSession(10);
    await move(sessionId, 'EXPENSE', 4);

    // Kapalı bir yıla düşen olay yerine: bus'u bozan bir kapanış (olay gövdesi geçersiz).
    const failingBus = {
      execute: async () => {
        throw new Error('köprü patladı');
      },
    };
    const failing = new CloseCashSessionHandler(
      new CashSessionCommandRepository(harness.prisma),
      allowAllPolicyFactory,
      failingBus as never,
      criticalFailure as never,
      harness.txManager
    );

    await expect(
      failing.execute(
        new CloseCashSessionCommand({ sessionId, data: { countedAmount: 6 }, ctx })
      )
    ).rejects.toThrow('köprü patladı');

    const stored = await harness.prisma.cashSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    expect(stored.status).toBe('OPEN');
    expect(stored.accountingEventId).toBeNull();
  });
});
