import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import { ResolveCardChargebackHandler } from './resolve-card-chargeback.handler';
import { ResolveCardChargebackCommand } from './resolve-card-chargeback.command';
import { CardChargeback } from '@modules/finance/bank/domain/entities/card-chargeback.entity';
import { ICardChargebackCommandRepository } from '@modules/finance/bank/domain/repositories/card-chargeback/card-chargeback.repository';
import { IBankAccountCommandRepository } from '@modules/finance/bank/domain/repositories/bank-account/bank-account.command.repository';
import { BankAccount } from '@modules/finance/bank/domain/entities/bank-account.entity';
import {
  CardChargebackNotFoundException,
  ChargebackAlreadyResolvedException,
  ChargebackBankAccountMismatchException,
  ChargebackInvalidDateException,
  ChargebackReturnChannelRequiredException,
} from '@modules/finance/bank/domain/exceptions/bank.exceptions';
import { PeriodSealedForDateException } from '@modules/finance/accounting/periods/domain/exceptions/period.exceptions';
import { IPeriodGateService } from '@modules/finance/accounting/periods/domain/services/period-gate/period-gate.service.interface';
import { RecordFinancialEventCommand } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.command';
import { ChargeBackInstallmentCommand } from '@modules/finance/payment/application/commands/charge-back-installment/charge-back-installment.command';
import { ChargeBackInstallmentResponse } from '@modules/finance/payment/application/commands/charge-back-installment/charge-back-installment.response';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { CriticalFailurePayload } from '@common/observability/critical-failure.event';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '@shared/common/constants/execution-source.constant';
import type { ResolveCardChargeback } from '@shared/modules/bank/types/commands';

/**
 * Kart itirazının sonuçlandırılması: kazanıldı (para geri geldi) ya da
 * kaybedildi (kesinleşti). Çözüm tek seferlik bir durum geçişidir; bu yüzden
 * itiraz satırı `FOR UPDATE` kilitlenir ve durum geçişi yan etkilerden ÖNCE gelir.
 */
describe('ResolveCardChargebackHandler', () => {
  const CLINIC_ID = randomUUID();
  const OTHER_CLINIC_ID = randomUUID();
  const ORG_ID = randomUUID();
  const PATIENT_ID = randomUUID();
  const PARTY_ID = randomUUID();
  const PAYMENT_ID = randomUUID();
  const POS_TX_ID = randomUUID();
  const BOOKING_PAYMENT_ID = randomUUID();
  const INSTALLMENT_ID = randomUUID();
  const RECOVERY_ID = randomUUID();
  const BANK_ACCOUNT_ID = randomUUID();
  const EVENT_ID = randomUUID();
  const ACTOR_ID = 'aB3xY9zQ7wE1rT5yU8iO2pL4kJ6h';
  const OPENED_AT = new Date('2026-10-10T00:00:00.000Z');
  const RESOLVED_AT = new Date('2026-10-30T00:00:00.000Z');

  const ctx: IGetContext = {
    actor: {
      userId: ACTOR_ID,
      clinicId: CLINIC_ID,
      organizationId: ORG_ID,
      managedClinics: [{ id: CLINIC_ID }],
    } as IGetContext['actor'],
    source: ExecutionSources.USER_ACTION,
  };

  const openChargeback = (
    over: {
      sourceType?: 'POS_TRANSACTION' | 'ONLINE_PAYMENT' | 'BOOKING_PAYMENT';
      paymentId?: string | null;
    } = {}
  ): CardChargeback => {
    const sourceType = over.sourceType ?? 'POS_TRANSACTION';
    const isBooking = sourceType === 'BOOKING_PAYMENT';
    const sourceIds = {
      POS_TRANSACTION: POS_TX_ID,
      ONLINE_PAYMENT: INSTALLMENT_ID,
      BOOKING_PAYMENT: BOOKING_PAYMENT_ID,
    } as const;
    return CardChargeback.open({
      clinicId: CLINIC_ID,
      organizationId: ORG_ID,
      provider: isBooking ? 'IYZICO' : 'PAX_BANK',
      caseReference: 'CB-1001',
      sourceType,
      sourceId: sourceIds[sourceType],
      paymentId: isBooking
        ? null
        : over.paymentId === undefined
          ? PAYMENT_ID
          : over.paymentId,
      // Platform rezervasyon itirazında hasta/cari yoktur.
      patientId: isBooking ? null : PATIENT_ID,
      partyId: isBooking ? null : PARTY_ID,
      amount: new Decimal('1000.00'),
      feeAmount: new Decimal('25.00'),
      currency: 'TRY',
      openedAt: OPENED_AT,
      openedFundsChannel: 'FUNDS_IN_TRANSIT',
      recordedById: ACTOR_ID,
    });
  };

  const won = (
    over: Partial<ResolveCardChargeback> = {}
  ): ResolveCardChargeback =>
    ({
      outcome: 'WON',
      resolvedAt: RESOLVED_AT,
      fundsChannel: 'BANK',
      ...over,
    }) as ResolveCardChargeback;

  const lost = (
    over: Partial<ResolveCardChargeback> = {}
  ): ResolveCardChargeback =>
    ({
      outcome: 'LOST',
      resolvedAt: RESOLVED_AT,
      ...over,
    }) as ResolveCardChargeback;

  interface BuildOptions {
    chargeback?: CardChargeback | null;
    planOutcome?: ChargeBackInstallmentResponse;
    periodSealed?: boolean;
    bankAccountClinicId?: string;
    eventThrows?: boolean;
  }

  const build = (options: BuildOptions = {}) => {
    const order: string[] = [];
    let txDepth = 0;
    const depthAtCall: Record<string, number> = {};
    const chargeback =
      options.chargeback === undefined ? openChargeback() : options.chargeback;

    // Kilitsiz `findById` bilerek tanımsız: handler kullanırsa test patlar.
    const findByIdForUpdate = jest.fn(() => {
      order.push('lock');
      depthAtCall.lock = txDepth;
      return Promise.resolve(chargeback);
    });
    const update = jest.fn((entity: CardChargeback) => {
      order.push('update');
      return Promise.resolve(entity);
    });
    const chargebackRepo = {
      findByIdForUpdate,
      update,
    } as unknown as ICardChargebackCommandRepository;

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

    // Parametre tipi generic ile verilir (kullanılmayan bir parametre adı yazmadan):
    // çağrı argümanları testlerde `mock.calls` üzerinden doğrulanıyor.
    const assertPeriod = jest.fn<
      Promise<void>,
      [{ clinicId: string; date: Date }]
    >(() => {
      order.push('periodGate');
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
    });
    const periodGate = {
      assertPeriodNotSealedAt: assertPeriod,
    } as unknown as IPeriodGateService;

    const checkedClinics: string[] = [];
    const policyCheck = jest.fn(
      (
        fn: (p: { actorCanManageTargetClinic: (id: string) => boolean }) => void
      ) => {
        fn({
          actorCanManageTargetClinic: (id: string) => {
            checkedClinics.push(id);
            return true;
          },
        });
        return { orThrow: () => undefined };
      }
    );
    const policyFactory = {
      finance: jest.fn().mockReturnValue({
        evaluator: { check: policyCheck },
      }),
    } as never;

    const commandExecute = jest.fn((command: unknown) => {
      if (command instanceof ChargeBackInstallmentCommand) {
        order.push('planSync');
        depthAtCall.planSync = txDepth;
        return Promise.resolve(
          options.planOutcome ?? {
            outcome: 'CHARGED_BACK' as const,
            installmentId: INSTALLMENT_ID,
            recoveryInstallmentId: RECOVERY_ID,
          }
        );
      }
      if (command instanceof RecordFinancialEventCommand) {
        order.push('financialEvent');
        depthAtCall.financialEvent = txDepth;
        return options.eventThrows
          ? Promise.reject(new Error('olay yazılamadı'))
          : Promise.resolve(EVENT_ID);
      }
      return Promise.reject(new Error('beklenmeyen komut'));
    });
    const commandBus = { execute: commandExecute } as unknown as TSCommandBus;

    const publish = jest.fn<void, [CriticalFailurePayload]>();
    const criticalFailure = { publish } as unknown as CriticalFailurePublisher;

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
      handler: new ResolveCardChargebackHandler(
        chargebackRepo,
        bankAccountRepo,
        periodGate,
        policyFactory,
        commandBus,
        criticalFailure,
        txManager
      ),
      chargeback,
      update,
      findByIdForUpdate,
      assertPeriod,
      commandExecute,
      publish,
      outboxRun,
      order,
      depthAtCall,
      checkedClinics,
    };
  };

  const eventCommand = (
    execute: ReturnType<typeof build>['commandExecute']
  ): RecordFinancialEventCommand =>
    execute.mock.calls.find(
      ([command]) => command instanceof RecordFinancialEventCommand
    )?.[0] as RecordFinancialEventCommand;

  const planCommand = (
    execute: ReturnType<typeof build>['commandExecute']
  ): ChargeBackInstallmentCommand =>
    execute.mock.calls.find(
      ([command]) => command instanceof ChargeBackInstallmentCommand
    )?.[0] as ChargeBackInstallmentCommand;

  const command = (data: ResolveCardChargeback, id = 'cb-id') =>
    new ResolveCardChargebackCommand({ chargebackId: id, data, ctx });

  describe('KAZANILDI (para geri geldi)', () => {
    it('WON olur, olay yazılır, köprü izi damgalanır; ödeme planına dokunulmaz', async () => {
      const { handler, update, commandExecute, chargeback } = build();

      await handler.execute(command(won()));

      expect(chargeback!.status).toBe('WON');
      const stamped = update.mock.calls[0][0];
      expect(stamped.resolvedEventId).toBe(EVENT_ID);
      expect(stamped.resolvedById).toBe(ACTOR_ID);
      // Kazanılan itirazda plan değişmez: taksit COMPLETED kalır.
      expect(planCommand(commandExecute)).toBeUndefined();
    });

    it('olay gövdesi paranın döndüğü kanalı taşır (açılıştaki kanala bağlı değil)', async () => {
      const { handler, commandExecute } = build();

      await handler.execute(command(won({ fundsChannel: 'BANK' })));

      const event = eventCommand(commandExecute);
      expect(event.data.type).toBe('CARD_CHARGEBACK_WON');
      // Açılış FUNDS_IN_TRANSIT (108) idi; sağlayıcı iadeyi doğrudan bankaya yatırdı.
      expect(event.data.payload).toEqual({
        amount: '1000.00',
        currency: 'TRY',
        provider: 'PAX_BANK',
        caseReference: 'CB-1001',
        fundsChannel: 'BANK',
      });
      expect(event.data.occurredAt).toEqual(RESOLVED_AT);
      expect(event.data.dedupeKey).toContain('card-chargeback-won:');
    });

    it('kanal verilmezse (şemayı atlayan çağrı) çalışma zamanında reddedilir', async () => {
      const { handler, update, commandExecute } = build();

      await expect(
        handler.execute(command(won({ fundsChannel: undefined })))
      ).rejects.toBeInstanceOf(ChargebackReturnChannelRequiredException);

      expect(update).not.toHaveBeenCalled();
      expect(eventCommand(commandExecute)).toBeUndefined();
    });

    it('banka hesabı verilirse aynı kliniğin olmak zorunda', async () => {
      const { handler, update } = build({
        bankAccountClinicId: OTHER_CLINIC_ID,
      });

      await expect(
        handler.execute(command(won({ bankAccountId: BANK_ACCOUNT_ID })))
      ).rejects.toBeInstanceOf(ChargebackBankAccountMismatchException);

      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('KAYBEDİLDİ (kesinleşti)', () => {
    it('POS kaynağı: plana tutar eşleşmesiyle yansır, telafi taksidi kayda yazılır', async () => {
      const { handler, commandExecute, chargeback, update } = build();

      await handler.execute(command(lost()));

      expect(chargeback!.status).toBe('LOST');
      const plan = planCommand(commandExecute).payload;
      expect(plan.paymentId).toBe(PAYMENT_ID);
      // Fiziksel POS'ta hangi taksidin ödendiği bilinmez → tutar eşleşmesi aranır.
      expect(plan.installmentId).toBeUndefined();
      expect(plan.clinicId).toBe(CLINIC_ID);
      expect(plan.amount.toFixed(2)).toBe('1000.00');
      expect(plan.caseReference).toBe('CB-1001');
      // Telafi taksidinin vadesi itirazın kesinleştiği gündür.
      expect(plan.dueDate).toEqual(RESOLVED_AT);

      const stamped = update.mock.calls[0][0];
      expect(stamped.planSyncStatus).toBe('SYNCED');
      expect(stamped.installmentId).toBe(INSTALLMENT_ID);
      expect(stamped.recoveryInstallmentId).toBe(RECOVERY_ID);
    });

    it('sanal POS kaynağı: geri alınacak taksit kimliğiyle doğrudan hedeflenir', async () => {
      const { handler, commandExecute } = build({
        chargeback: openChargeback({ sourceType: 'ONLINE_PAYMENT' }),
      });

      await handler.execute(command(lost()));

      expect(planCommand(commandExecute).payload.installmentId).toBe(
        INSTALLMENT_ID
      );
    });

    it('olay gövdesi hasta carisini taşır (B 120 requiresParty)', async () => {
      const { handler, commandExecute } = build();

      await handler.execute(command(lost()));

      const event = eventCommand(commandExecute);
      expect(event.data.type).toBe('CARD_CHARGEBACK_LOST');
      expect(event.data.payload).toEqual({
        amount: '1000.00',
        currency: 'TRY',
        provider: 'PAX_BANK',
        caseReference: 'CB-1001',
        partyId: PARTY_ID,
      });
      expect(event.data.dedupeKey).toContain('card-chargeback-lost:');
    });

    it('platform rezervasyon itirazı: gövde carisiz ve AÇIK platformLoss işaretli; plana dokunulmaz', async () => {
      const { handler, commandExecute, update, publish } = build({
        chargeback: openChargeback({ sourceType: 'BOOKING_PAYMENT' }),
      });

      await handler.execute(command(lost()));

      const event = eventCommand(commandExecute);
      expect(event.data.type).toBe('CARD_CHARGEBACK_LOST');
      expect(event.data.payload).toEqual({
        amount: '1000.00',
        currency: 'TRY',
        provider: 'IYZICO',
        caseReference: 'CB-1001',
        platformLoss: true,
      });
      expect(event.data.payload).not.toHaveProperty('partyId');
      // Platformun plan/taksit kaydı yok: ödeme planı komutu çağrılmaz, uyarı çıkmaz.
      expect(planCommand(commandExecute)).toBeUndefined();
      expect(update.mock.calls[0][0].planSyncStatus).toBe('NOT_LINKED');
      expect(publish).not.toHaveBeenCalled();
    });

    it('platform rezervasyon itirazı KAZANILINCA da carisiz çözülür (127 kapanır, para geri döner)', async () => {
      const { handler, commandExecute } = build({
        chargeback: openChargeback({ sourceType: 'BOOKING_PAYMENT' }),
      });

      await handler.execute(command(won()));

      const event = eventCommand(commandExecute);
      expect(event.data.type).toBe('CARD_CHARGEBACK_WON');
      expect(event.data.payload).toEqual(
        expect.objectContaining({ fundsChannel: 'BANK' })
      );
    });

    it('plansız kart çekimi (paymentId yok): komut çağrılmaz, NOT_LINKED yazılır', async () => {
      const { handler, commandExecute, update, publish } = build({
        chargeback: openChargeback({ paymentId: null }),
      });

      await handler.execute(command(lost()));

      expect(planCommand(commandExecute)).toBeUndefined();
      expect(update.mock.calls[0][0].planSyncStatus).toBe('NOT_LINKED');
      // Para POS kaydında duruyor; elle eşleştirme gerektiren bir durum değil.
      expect(publish).not.toHaveBeenCalled();
    });

    it('plan bulunamazsa NOT_LINKED, uyarı yok', async () => {
      const { handler, update, publish } = build({
        planOutcome: { outcome: 'NOT_LINKED' },
      });

      await handler.execute(command(lost()));

      expect(update.mock.calls[0][0].planSyncStatus).toBe('NOT_LINKED');
      expect(publish).not.toHaveBeenCalled();
    });

    it('tutara eşit taksit yoksa kayıt yine kapanır (defter geri sarılamaz) ve CRITICAL uyarı çıkar', async () => {
      // Sağlayıcı parayı çoktan geri aldı: plan eşleşmediği için işlemi geri
      // sarmak para ile kaydı ayrıştırırdı. Yanlış taksidi kapatmaktansa plana
      // dokunulmaz; elle eşleştirme CRITICAL uyarıyla istenir.
      const { handler, update, publish, commandExecute } = build({
        planOutcome: { outcome: 'NO_MATCHING_INSTALLMENT' },
      });

      await handler.execute(command(lost()));

      expect(update.mock.calls[0][0].planSyncStatus).toBe(
        'NO_MATCHING_INSTALLMENT'
      );
      expect(eventCommand(commandExecute)).toBeDefined();
      expect(publish).toHaveBeenCalledTimes(1);
      expect(publish.mock.calls[0][0]).toMatchObject({
        severity: 'CRITICAL',
        operation: 'finance.card-chargeback.plan-sync',
        clinicId: CLINIC_ID,
      });
    });

    it('uyarı transaction GERİ SARILIRSA çıkmaz (yayıncı transaction’a katılmaz)', async () => {
      // Olay yazılamazsa çözüm hiç olmamıştır; "plan eşleşmedi" alarmı var
      // olmayan bir çözüm için çalardı.
      const { handler, publish, update } = build({
        planOutcome: { outcome: 'NO_MATCHING_INSTALLMENT' },
        eventThrows: true,
      });

      await expect(handler.execute(command(lost()))).rejects.toThrow(
        'olay yazılamadı'
      );

      expect(publish).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('kapılar ve sıra', () => {
    it('itiraz satırı KİLİTLİ okunur ve her yan etki aynı transaction içindedir', async () => {
      const { handler, outboxRun, depthAtCall } = build();

      await handler.execute(command(lost()));

      expect(outboxRun).toHaveBeenCalledTimes(1);
      expect(depthAtCall.lock).toBe(1);
      expect(depthAtCall.planSync).toBe(1);
      expect(depthAtCall.financialEvent).toBe(1);
    });

    it('sıra: kilit → dönem kapısı → plan yansıması → olay → damga', async () => {
      const { handler, order } = build();

      await handler.execute(command(lost()));

      expect(order).toEqual([
        'lock',
        'periodGate',
        'planSync',
        'financialEvent',
        'update',
      ]);
    });

    it('dönem kapısına çözüm günü sorulur', async () => {
      const { handler, assertPeriod } = build();

      await handler.execute(command(lost()));

      expect(assertPeriod).toHaveBeenCalledWith({
        clinicId: CLINIC_ID,
        date: RESOLVED_AT,
      });
    });

    it('mühürlenmiş döneme düşen çözüm reddedilir — olay yazılmaz, plana dokunulmaz', async () => {
      const { handler, update, commandExecute } = build({ periodSealed: true });

      await expect(handler.execute(command(lost()))).rejects.toBeInstanceOf(
        PeriodSealedForDateException
      );

      expect(update).not.toHaveBeenCalled();
      expect(eventCommand(commandExecute)).toBeUndefined();
      expect(planCommand(commandExecute)).toBeUndefined();
    });

    it('yetki İSTEKTEN değil KAYDIN kendi kliniğinden doğrulanır', async () => {
      const { handler, checkedClinics } = build();

      await handler.execute(command(lost()));

      expect(checkedClinics).toEqual([CLINIC_ID]);
    });

    it('olmayan itiraz', async () => {
      const { handler } = build({ chargeback: null });

      await expect(handler.execute(command(lost()))).rejects.toBeInstanceOf(
        CardChargebackNotFoundException
      );
    });

    it('çözülmüş itiraz tekrar çözülemez — hiçbir yan etki yazılmaz', async () => {
      const resolved = openChargeback();
      resolved.resolveLost({ resolvedAt: RESOLVED_AT, resolvedById: 'u' });
      const { handler, update, commandExecute, assertPeriod } = build({
        chargeback: resolved,
      });

      await expect(handler.execute(command(won()))).rejects.toBeInstanceOf(
        ChargebackAlreadyResolvedException
      );

      // Durum geçişi yan etkilerden ÖNCE: ikinci çözüm fiş de yazmaz.
      expect(assertPeriod).not.toHaveBeenCalled();
      expect(commandExecute).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });

    it('çözüm tarihi açılıştan önceyse reddedilir', async () => {
      const { handler, update } = build();

      await expect(
        handler.execute(
          command(lost({ resolvedAt: new Date('2026-10-01T00:00:00Z') }))
        )
      ).rejects.toBeInstanceOf(ChargebackInvalidDateException);

      expect(update).not.toHaveBeenCalled();
    });
  });
});
