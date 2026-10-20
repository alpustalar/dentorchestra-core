import { Decimal } from 'decimal.js';
import { randomUUID } from 'crypto';
import { CloseCashSessionHandler } from './close-cash-session.handler';
import { CloseCashSessionCommand } from './close-cash-session.command';
import { CashSession } from '@modules/finance/cash-register/domain/entities/cash-session.entity';
import { ICashSessionCommandRepository } from '@modules/finance/cash-register/domain/repositories/cash-session/cash-session.command.repository';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import type { CriticalFailurePayload } from '@common/observability/critical-failure.event';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import CurrencySchema from '@input-type-schemas/CurrencySchema';

/**
 * Eksi kasayla kapanış sessiz geçmez.
 *
 * Çıkış kapısı (`assertCanWithdraw`) negatif çekmeceyi artık kaydın önünde
 * durduruyor; geriye kapı yokken yazılmış **eski** hareketler kalıyor. O
 * oturumlarda `fark = sayım − beklenen` pozitif çıkar ve köprü onu "sayım
 * fazlası" → 679 Diğer Olağandışı Gelir olarak fişler: hiç kazanılmamış gelir.
 * Kapanış bloke edilmez (kasanın kapanabilmesi gerekir) ama uyarı çıkar.
 */
describe('CloseCashSessionHandler — eksi kasa uyarısı', () => {
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

    const cashSessionRepo = {
      findByIdForUpdate: jest.fn(() => Promise.resolve(session)),
      sumMovements: jest.fn(() =>
        Promise.resolve({
          totalIn: new Decimal(totals.in),
          totalOut: new Decimal(totals.out),
        })
      ),
      sumBridgeMovements: jest.fn(() =>
        Promise.resolve({
          bankDepositTotal: new Decimal(totals.out),
          expenseTotal: new Decimal(0),
        })
      ),
      update: jest.fn((s: CashSession) => Promise.resolve(s)),
    } as unknown as ICashSessionCommandRepository;

    const policyFactory = {
      finance: jest.fn().mockReturnValue({
        evaluator: {
          check: jest.fn().mockReturnValue({ orThrow: () => undefined }),
        },
      }),
    } as never;

    const execute = jest.fn(() => {
      callOrder.push('post');
      return Promise.resolve(randomUUID());
    });
    const commandBus = { execute } as unknown as TSCommandBus;

    const publish = jest.fn((payload: CriticalFailurePayload) => {
      callOrder.push(`alarm:${payload.severity}`);
    });
    const criticalFailure = { publish } as unknown as CriticalFailurePublisher;

    const txManager = {
      outboxRun: jest.fn((cb: () => Promise<unknown>) => cb()),
    } as unknown as TransactionManager;

    return {
      handler: new CloseCashSessionHandler(
        cashSessionRepo,
        policyFactory,
        commandBus,
        criticalFailure,
        txManager
      ),
      session,
      publish,
      callOrder,
    };
  };

  const command = (countedAmount: number) =>
    new CloseCashSessionCommand({
      sessionId: SESSION_ID,
      data: { countedAmount },
      ctx,
    });

  it('beklenen tutar negatifse CRITICAL uyarı çıkar ve kapanış tamamlanır', async () => {
    const { handler, publish, callOrder } = build(1000, {
      in: 0,
      out: 50_000,
    });

    const result = await handler.execute(command(0));

    // Kapanış bloke edilmedi.
    expect(result.expectedAmount).toBe('-49000.00');
    expect(result.difference).toBe('49000.00');

    expect(publish).toHaveBeenCalledTimes(1);
    const payload = publish.mock.calls[0][0];
    expect(payload.severity).toBe('CRITICAL');
    expect(payload.clinicId).toBe(CLINIC_ID);
    expect(payload.dedupeKey).toBe(
      `cash-session-negative-drawer:${SESSION_ID}`
    );
    expect(payload.context.expectedAmount).toBe('-49000.00');
    expect(payload.context.difference).toBe('49000.00');

    // Uyarı, uydurma "fazla"yı fişleyecek köprüden ÖNCE çıkar.
    expect(callOrder).toEqual(['alarm:CRITICAL', 'post']);
  });

  it('normal kapanışta uyarı çıkmaz', async () => {
    const { handler, publish } = build(1000, { in: 500, out: 300 });

    const result = await handler.execute(command(1200));

    expect(result.expectedAmount).toBe('1200.00');
    expect(publish).not.toHaveBeenCalled();
  });
});
