import { RecordFinancialEventHandler } from './record-financial-event.handler';
import { RecordFinancialEventCommand } from './record-financial-event.command';
import { FinancialEvent } from '@modules/finance/accounting/financial-events/domain/entities/financial-event.entity';
import { IFinancialEventCommandRepository } from '@modules/finance/accounting/financial-events/domain/repositories/financial-event/financial-event.command.repository';
import {
  FinancialEventDedupeKeyCollisionException,
  FinancialEventPayloadInvalidException,
} from '@modules/finance/accounting/financial-events/domain/exceptions';
import { IPolicyFactory } from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { FinancialEventTypeSchema, ITenantScopeResolver } from '@shared';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '../../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { SYSTEM_ACTOR } from '@common/constants/system-actor.constant';
import { FINANCIAL_EVENT_SOURCE_MODULES } from '@modules/finance/shared/domain/constants/financial-event-source-modules.constant';

const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_CLINIC_ID = '33333333-3333-4333-8333-333333333333';
const ORG_ID = '22222222-2222-4222-8222-222222222222';
const PARTY_ID = '44444444-4444-4444-8444-444444444444';
const ACTOR_ID = '55555555-5555-4555-8555-555555555555';

const ctxOf = (actor: Partial<IGetContext['actor']> = {}): IGetContext => ({
  actor: {
    userId: ACTOR_ID,
    clinicId: CLINIC_ID,
    organizationId: ORG_ID,
    managedClinics: [{ id: CLINIC_ID }],
    source: LogSource.SYSTEM,
    ...actor,
  } as unknown as IGetContext['actor'],
  source: ExecutionSources.USER_ACTION,
});

const paymentMade = (overrides: Record<string, unknown> = {}) => ({
  method: 'BANK_TRANSFER',
  amount: '150.00',
  partyId: PARTY_ID,
  ...overrides,
});

interface BuildOptions {
  /** `appendIfAbsent` null dönerse yarış kaybedilmiş demektir. */
  appendWins?: boolean;
  existingByDedupeKey?: FinancialEvent | null;
  policyDenies?: boolean;
}

const existingEvent = (clinicId: string) =>
  FinancialEvent.record({
    id: UUID.generate().value,
    clinicId,
    organizationId: ORG_ID,
    type: FinancialEventTypeSchema.enum.PAYMENT_MADE,
    payload: paymentMade(),
    sourceModule: FINANCIAL_EVENT_SOURCE_MODULES.SUPPLIER_PAYMENT,
  });

const build = (options: BuildOptions = {}) => {
  const appended: FinancialEvent[] = [];

  const financialEventRepo = {
    appendIfAbsent: jest.fn(async (event: FinancialEvent) => {
      if (options.appendWins === false) return null;
      appended.push(event);
      return event;
    }),
    findByDedupeKey: jest.fn(async () => options.existingByDedupeKey ?? null),
  } as unknown as IFinancialEventCommandRepository;

  const tenantScopeResolver = {
    resolve: jest.fn(async () => ORG_ID),
  } as unknown as ITenantScopeResolver;

  const outboxRun = jest.fn(async (cb: () => Promise<unknown>) => cb());
  const txManager = {
    outboxRun,
    run: jest.fn(async (cb: () => Promise<unknown>) => cb()),
  } as unknown as TransactionManager;

  const policyFactory = {
    finance: jest.fn().mockReturnValue({
      evaluator: {
        check: jest.fn().mockReturnValue({
          orThrow: () => {
            if (options.policyDenies) throw new Error('forbidden');
          },
        }),
      },
    }),
  } as unknown as IPolicyFactory;

  return {
    handler: new RecordFinancialEventHandler(
      financialEventRepo,
      tenantScopeResolver,
      policyFactory,
      txManager
    ),
    financialEventRepo,
    outboxRun,
    appended,
  };
};

const commandOf = (
  data: Partial<RecordFinancialEventCommand['data']> = {},
  ctx: IGetContext = ctxOf()
) =>
  new RecordFinancialEventCommand(
    {
      clinicId: CLINIC_ID,
      type: FinancialEventTypeSchema.enum.PAYMENT_MADE,
      payload: paymentMade(),
      sourceModule: FINANCIAL_EVENT_SOURCE_MODULES.SUPPLIER_PAYMENT,
      ...data,
    } as RecordFinancialEventCommand['data'],
    ctx
  );

describe('RecordFinancialEventHandler — kapsam', () => {
  it('aktör kliniğe erişemiyorsa olay yazılmaz', async () => {
    const { handler, financialEventRepo } = build({ policyDenies: true });

    await expect(handler.execute(commandOf())).rejects.toThrow('forbidden');
    expect(financialEventRepo.appendIfAbsent).not.toHaveBeenCalled();
  });
});

describe('RecordFinancialEventHandler — teslim garantisi', () => {
  it('kayıt outbox transaction’ında yazılır (in-memory yayın DEĞİL)', async () => {
    // `run()` olsaydı süreç commit ile emit arasında ölünce RECORDED event'i
    // kaybolur, dedupe yüzünden yeniden de üretilmezdi: fişsiz ekonomik olay.
    const { handler, outboxRun } = build();

    await handler.execute(commandOf());

    expect(outboxRun).toHaveBeenCalledTimes(1);
  });
});

describe('RecordFinancialEventHandler — idempotentlik', () => {
  it('dedupeKey zaten varsa yeni kayıt yazılmaz, mevcut id döner', async () => {
    const existing = existingEvent(CLINIC_ID);
    const { handler, financialEventRepo } = build({
      existingByDedupeKey: existing,
    });

    const id = await handler.execute(commandOf({ dedupeKey: 'dk-1' }));

    expect(id).toBe(existing.id.value);
    expect(financialEventRepo.appendIfAbsent).not.toHaveBeenCalled();
  });

  it('yarış kaybedilirse kazananın id’si döner (hata fırlatılmaz)', async () => {
    const winner = existingEvent(CLINIC_ID);
    const { handler } = build({
      appendWins: false,
      existingByDedupeKey: winner,
    });

    // İlk okuma null, ikinci okuma kazanan: eşzamanlı isteği taklit eder.
    const repoCalls = { count: 0 };
    const handlerRepo = (
      handler as unknown as {
        financialEventRepo: IFinancialEventCommandRepository;
      }
    ).financialEventRepo;
    (handlerRepo.findByDedupeKey as jest.Mock).mockImplementation(async () =>
      repoCalls.count++ === 0 ? null : winner
    );

    await expect(
      handler.execute(commandOf({ dedupeKey: 'dk-2' }))
    ).resolves.toBe(winner.id.value);
  });

  it('dedupeKey başka kliniğin kaydına aitse sessizce “zaten var” denmez', async () => {
    // Sessiz kabul, bu kliniğin ekonomik olayının hiç yazılmadan başarı dönmesi
    // olurdu: para defterden düşerdi.
    const { handler } = build({
      existingByDedupeKey: existingEvent(OTHER_CLINIC_ID),
    });

    await expect(
      handler.execute(commandOf({ dedupeKey: 'dk-3' }))
    ).rejects.toBeInstanceOf(FinancialEventDedupeKeyCollisionException);
  });
});

describe('RecordFinancialEventHandler — yasal iz', () => {
  it('performedById istemciden değil context’ten damgalanır', async () => {
    const { handler, appended } = build();

    await handler.execute(commandOf({ performedById: 'baskasinin-idsi' }));

    expect(appended[0].performedById).toBe(ACTOR_ID);
  });

  it('sistem akışında çağıranın verdiği performedById korunur', async () => {
    const { handler, appended } = build();

    await handler.execute(
      commandOf(
        { performedById: ACTOR_ID },
        { ...ctxOf(), actor: SYSTEM_ACTOR }
      )
    );

    expect(appended[0].performedById).toBe(ACTOR_ID);
  });
});

describe('RecordFinancialEventHandler — gövde doğrulaması', () => {
  it('tutarı eksik olay defter’e hiç girmez', async () => {
    const { handler, financialEventRepo } = build();

    await expect(
      handler.execute(
        commandOf({ payload: { method: 'CASH', partyId: PARTY_ID } })
      )
    ).rejects.toBeInstanceOf(FinancialEventPayloadInvalidException);
    expect(financialEventRepo.appendIfAbsent).not.toHaveBeenCalled();
  });

  it('tutarı sayı olarak gelen olay reddedilir (Decimal hassasiyeti)', async () => {
    const { handler } = build();

    await expect(
      handler.execute(commandOf({ payload: paymentMade({ amount: 150.5 }) }))
    ).rejects.toBeInstanceOf(FinancialEventPayloadInvalidException);
  });

  it('Value Object sızmış para birimi reddedilir', async () => {
    // `currency: session.currency` gibi bir hata payload'a `{_value:'TRY'}`
    // yazar; posting bunu fonksiyonel para ile eşitleyemez ve hatalı bir döviz
    // çevrimine girerdi.
    const { handler } = build();

    await expect(
      handler.execute(
        commandOf({ payload: paymentMade({ currency: { _value: 'TRY' } }) })
      )
    ).rejects.toBeInstanceOf(FinancialEventPayloadInvalidException);
  });

  it('posting kuralı olmayan olay tipi serbesttir', async () => {
    const { handler, appended } = build();

    await handler.execute(
      commandOf({
        type: FinancialEventTypeSchema.enum.MANUAL_JOURNAL,
        payload: { note: 'serbest' },
      })
    );

    expect(appended).toHaveLength(1);
  });
});
