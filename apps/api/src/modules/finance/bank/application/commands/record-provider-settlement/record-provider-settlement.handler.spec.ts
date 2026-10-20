import { randomUUID } from 'crypto';
import { RecordProviderSettlementHandler } from './record-provider-settlement.handler';
import { RecordProviderSettlementCommand } from './record-provider-settlement.command';
import { ProviderSettlement } from '@modules/finance/bank/domain/entities/provider-settlement.entity';
import { IProviderSettlementCommandRepository } from '@modules/finance/bank/domain/repositories/provider-settlement/provider-settlement.command.repository';
import { IBankAccountCommandRepository } from '@modules/finance/bank/domain/repositories/bank-account/bank-account.command.repository';
import { BankAccount } from '@modules/finance/bank/domain/entities/bank-account.entity';
import {
  ProviderSettlementAlreadyRecordedException,
  SettlementBankAccountMismatchException,
} from '@modules/finance/bank/domain/exceptions/bank.exceptions';
import { InsufficientFundsInTransitException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';
import { PeriodSealedForDateException } from '@modules/finance/accounting/periods/domain/exceptions/period.exceptions';
import { ITenantScopeResolver } from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import { IPeriodGateService } from '@modules/finance/accounting/periods/domain/services/period-gate/period-gate.service.interface';
import { IFundsInTransitGate } from '@modules/finance/accounting/posting/domain/services/funds-in-transit/funds-in-transit.gate.interface';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { RecordFinancialEventCommand } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.command';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import type { RecordProviderSettlement } from '@shared/modules/bank/types/commands';

/**
 * 108'in kapanışı: kartla tahsil edilen paranın komisyon kesilerek bankaya
 * geçtiğini deftere yazar. Kapılar sırayla ve **tek transaction** içinde:
 * yetki → banka hesabının kiracısı → dönem → 108 bakiyesi → kayıt + olay.
 */
describe('RecordProviderSettlementHandler', () => {
  const CLINIC_ID = randomUUID();
  const ORG_ID = randomUUID();
  const OTHER_CLINIC_ID = randomUUID();
  const BANK_ACCOUNT_ID = randomUUID();
  const EVENT_ID = randomUUID();
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

  const data = (
    over: Partial<RecordProviderSettlement> = {}
  ): RecordProviderSettlement =>
    ({
      clinicId: CLINIC_ID,
      provider: 'IYZICO',
      reference: 'PAYOUT-1',
      payoutDate: new Date('2026-10-15T00:00:00.000Z'),
      grossAmount: 10000,
      commissionAmount: 185,
      netAmount: 9815,
      ...over,
    }) as RecordProviderSettlement;

  const build = (
    options: {
      bankAccountClinicId?: string;
      fundsGateThrows?: boolean;
      periodSealed?: boolean;
      createThrows?: boolean;
    } = {}
  ) => {
    const order: string[] = [];
    let txDepth = 0;
    const depthAtCall: Record<string, number> = {};

    const create = jest.fn((entity: ProviderSettlement) => {
      order.push('create');
      depthAtCall.create = txDepth;
      if (options.createThrows) {
        return Promise.reject(
          new ProviderSettlementAlreadyRecordedException({
            provider: 'IYZICO',
            reference: 'PAYOUT-1',
          })
        );
      }
      return Promise.resolve(entity);
    });
    const update = jest.fn((entity: ProviderSettlement) => {
      order.push('update');
      return Promise.resolve(entity);
    });
    const settlementRepo = {
      create,
      update,
    } as unknown as IProviderSettlementCommandRepository;

    const bankAccountRepo = {
      findById: jest.fn(() => {
        order.push('bankAccount');
        return Promise.resolve({
          id: { value: BANK_ACCOUNT_ID },
          clinicId: { value: options.bankAccountClinicId ?? CLINIC_ID },
          organizationId: { value: ORG_ID },
          status: 'ACTIVE',
        } as unknown as BankAccount);
      }),
    } as unknown as IBankAccountCommandRepository;

    const tenantScopeResolver = {
      resolve: jest.fn(() => Promise.resolve(ORG_ID)),
    } as unknown as ITenantScopeResolver;

    const periodGate = {
      assertPeriodNotSealedAt: jest.fn(() => {
        order.push('periodGate');
        depthAtCall.periodGate = txDepth;
        return options.periodSealed
          ? Promise.reject(
              new PeriodSealedForDateException({
                clinicId: CLINIC_ID,
                date: new Date(),
                year: 2026,
                currentStatus: 'CLOSED',
              })
            )
          : Promise.resolve();
      }),
    } as unknown as IPeriodGateService;

    const fundsInTransitGate = {
      assertCanSettle: jest.fn(() => {
        order.push('fundsGate');
        depthAtCall.fundsGate = txDepth;
        return options.fundsGateThrows
          ? Promise.reject(
              new InsufficientFundsInTransitException({
                available: '500.00',
                requested: '10000.00',
              })
            )
          : Promise.resolve();
      }),
    } as unknown as IFundsInTransitGate;

    const policyCheck = jest.fn().mockReturnValue({ orThrow: () => undefined });
    const policyFactory = {
      finance: jest.fn().mockReturnValue({
        evaluator: { check: policyCheck },
      }),
    } as never;

    const execute = jest.fn((command: RecordFinancialEventCommand) => {
      order.push('financialEvent');
      depthAtCall.financialEvent = txDepth;
      void command;
      return Promise.resolve(EVENT_ID);
    });
    const commandBus = { execute } as unknown as TSCommandBus;

    const outboxRun = jest.fn(async (cb: () => Promise<unknown>) => {
      txDepth++;
      try {
        return await cb();
      } finally {
        txDepth--;
      }
    });
    const txManager = {
      outboxRun,
      run: jest.fn(() => {
        throw new Error('run() kullanılmamalı — kritik işlem outboxRun ister');
      }),
    } as unknown as TransactionManager;

    return {
      handler: new RecordProviderSettlementHandler(
        settlementRepo,
        bankAccountRepo,
        tenantScopeResolver,
        periodGate,
        fundsInTransitGate,
        policyFactory,
        commandBus,
        txManager
      ),
      create,
      update,
      execute,
      outboxRun,
      order,
      depthAtCall,
      policyCheck,
    };
  };

  it('kaydı yazar, ekonomik olayı üretir ve damgalar', async () => {
    const { handler, create, execute, update } = build();

    const id = await handler.execute(
      new RecordProviderSettlementCommand(data(), ctx)
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);

    const stamped = update.mock.calls[0][0];
    expect(stamped.accountingEventId).toBe(EVENT_ID);
    expect(id).toBe(stamped.id.value);
  });

  it('olay gövdesi üç tutarı kuruş ölçeğinde ve referansıyla taşır', async () => {
    const { handler, execute } = build();

    await handler.execute(new RecordProviderSettlementCommand(data(), ctx));

    const command = execute.mock.calls[0][0];

    expect(command.data.type).toBe('PROVIDER_SETTLEMENT_RECEIVED');
    expect(command.data.payload).toMatchObject({
      grossAmount: '10000.00',
      netAmount: '9815.00',
      commissionAmount: '185.00',
      provider: 'IYZICO',
      reference: 'PAYOUT-1',
    });
    // Fişin tarihi payout günüdür — kaydın oluşturulma günü değil.
    expect(command.data.occurredAt).toEqual(
      new Date('2026-10-15T00:00:00.000Z')
    );
    expect(command.data.dedupeKey).toContain('provider-settlement:');
  });

  it('kritik işlem outboxRun ile yürür; kayıt ve olay aynı transaction içinde', async () => {
    // Kayıt yazılıp olay düşerse 108 defterde açık kalır ve operatör payout'u
    // "girilmiş" gördüğü için bir daha girmez — eksik hiç fark edilmez.
    const { handler, outboxRun, depthAtCall } = build();

    await handler.execute(new RecordProviderSettlementCommand(data(), ctx));

    expect(outboxRun).toHaveBeenCalledTimes(1);
    expect(depthAtCall.create).toBe(1);
    expect(depthAtCall.financialEvent).toBe(1);
  });

  it('kapı sırası: dönem → 108 bakiyesi → kayıt → olay', async () => {
    const { handler, order } = build();

    await handler.execute(new RecordProviderSettlementCommand(data(), ctx));

    expect(order).toEqual([
      'periodGate',
      'fundsGate',
      'create',
      'financialEvent',
      'update',
    ]);
  });

  it('108 bakiyesi yetersizse hiçbir şey yazılmaz', async () => {
    const { handler, create, execute } = build({ fundsGateThrows: true });

    await expect(
      handler.execute(new RecordProviderSettlementCommand(data(), ctx))
    ).rejects.toBeInstanceOf(InsufficientFundsInTransitException);

    expect(create).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('mühürlenmiş döneme düşen payout reddedilir', async () => {
    const { handler, create } = build({ periodSealed: true });

    await expect(
      handler.execute(new RecordProviderSettlementCommand(data(), ctx))
    ).rejects.toBeInstanceOf(PeriodSealedForDateException);

    expect(create).not.toHaveBeenCalled();
  });

  it('başka kliniğin banka hesabı seçilemez (kiracı sınırı)', async () => {
    const { handler, create } = build({
      bankAccountClinicId: OTHER_CLINIC_ID,
    });

    await expect(
      handler.execute(
        new RecordProviderSettlementCommand(
          data({ bankAccountId: BANK_ACCOUNT_ID }),
          ctx
        )
      )
    ).rejects.toBeInstanceOf(SettlementBankAccountMismatchException);

    expect(create).not.toHaveBeenCalled();
  });

  it('aynı payout ikinci kez girilirse tipli 409 döner', async () => {
    // İkinci kayıt 108'i iki kez kapatır: bakiye eksiye düşer, 102 fazla
    // yazılır ve mizan yine dengeli göründüğü için hata görünmez.
    const { handler, execute } = build({ createThrows: true });

    await expect(
      handler.execute(new RecordProviderSettlementCommand(data(), ctx))
    ).rejects.toBeInstanceOf(ProviderSettlementAlreadyRecordedException);

    expect(execute).not.toHaveBeenCalled();
  });

  it('yetki hedef klinik üzerinden kontrol edilir', async () => {
    const { handler, policyCheck } = build();

    await handler.execute(new RecordProviderSettlementCommand(data(), ctx));

    expect(policyCheck).toHaveBeenCalledTimes(1);
  });

  it('banka hesabı verilmezse hesap doğrulaması atlanır', async () => {
    const { handler, order } = build();

    await handler.execute(new RecordProviderSettlementCommand(data(), ctx));

    expect(order).not.toContain('bankAccount');
  });
});
