import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import { OpenCardChargebackHandler } from './open-card-chargeback.handler';
import { OpenCardChargebackCommand } from './open-card-chargeback.command';
import { CardChargeback } from '@modules/finance/bank/domain/entities/card-chargeback.entity';
import { ICardChargebackCommandRepository } from '@modules/finance/bank/domain/repositories/card-chargeback/card-chargeback.repository';
import { IBankAccountCommandRepository } from '@modules/finance/bank/domain/repositories/bank-account/bank-account.command.repository';
import { BankAccount } from '@modules/finance/bank/domain/entities/bank-account.entity';
import {
  ChargebackAlreadyRecordedException,
  ChargebackBankAccountMismatchException,
  ChargebackCurrencyNotSupportedException,
  ChargebackExceedsCollectionException,
  ChargebackSourceClinicMismatchException,
  ChargebackSourceNotChargeableException,
  ChargebackSourceNotFoundException,
  ChargebackSourceNotInLedgerException,
  ChargebackSourcePatientRequiredException,
} from '@modules/finance/bank/domain/exceptions/bank.exceptions';
import { InsufficientFundsInTransitException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';
import { PeriodSealedForDateException } from '@modules/finance/accounting/periods/domain/exceptions/period.exceptions';
import { OriginalPosTransactionNotFoundException } from '@modules/finance/pos/physical/domain/exceptions/pos.exceptions';
import { ITenantScopeResolver } from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import { IPeriodGateService } from '@modules/finance/accounting/periods/domain/services/period-gate/period-gate.service.interface';
import { IFundsInTransitGate } from '@modules/finance/accounting/posting/domain/services/funds-in-transit/funds-in-transit.gate.interface';
import { IFinancialEventPresenceGuard } from '@modules/finance/accounting/financial-events/domain/services/event-presence/event-presence.guard.interface';
import { IPosCardCollectionService } from '@modules/finance/pos/physical/domain/services/pos-card-collection/pos-card-collection.service.interface';
import { IBookingPaymentCollectionService } from '@modules/crm/health-tourism/booking-payment/domain/services/booking-payment-collection/booking-payment-collection.service.interface';
import { BookingPaymentNotChargeableException } from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment.exceptions';
import { IPlatformTenantProvider } from '@modules/finance/accounting/posting/domain/interfaces/platform-tenant.provider.interface';
import { IPaymentCollectionService } from '@modules/finance/payment/domain/services/payment-collection/payment-collection.service.interface';
import { EnsurePartyForPatientCommand } from '@modules/finance/party/application/commands/ensure-party-for-patient/ensure-party-for-patient.command';
import { RecordFinancialEventCommand } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.command';
import { GetPosTransactionByIdQuery } from '@modules/finance/pos/physical/application/queries/get-pos-transaction-by-id/get-pos-transaction-by-id.query';
import { GetInstallmentForLedgerQuery } from '@modules/finance/payment/application/queries/get-installment-for-ledger/get-installment-for-ledger.query';
import { InstallmentLedgerRow } from '@modules/finance/payment/domain/contracts/payment';
import { PosTransactionSummary } from '@modules/finance/pos/physical/domain/contracts/pos-transaction';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '@shared/common/constants/execution-source.constant';
import type { OpenCardChargeback } from '@shared/modules/bank/types/commands';

/**
 * Kart itirazı açılışı: sağlayıcı kart sahibinin itirazı üzerine parayı kesti.
 *
 * Kapılar sırayla ve **tek transaction** içinde; kullanıcı hatasıyla
 * reddedilecek istekler kilitten ÖNCE elenir:
 *   kaynak olguları (kilitsiz) → [tx: kaynak kilidi → defterde var mı → tavan →
 *   banka hesabı → dönem → 108 → cari → kayıt → olay → damga].
 */
describe('OpenCardChargebackHandler', () => {
  const CLINIC_ID = randomUUID();
  const OTHER_CLINIC_ID = randomUUID();
  const ORG_ID = randomUUID();
  const PATIENT_ID = randomUUID();
  const PARTY_ID = randomUUID();
  const PAYMENT_ID = randomUUID();
  const POS_TX_ID = randomUUID();
  const INSTALLMENT_ID = randomUUID();
  const BOOKING_PAYMENT_ID = randomUUID();
  const BANK_ACCOUNT_ID = randomUUID();
  const EVENT_ID = randomUUID();
  const ACTOR_ID = 'aB3xY9zQ7wE1rT5yU8iO2pL4kJ6h';
  const OPENED_AT = new Date('2026-10-15T00:00:00.000Z');

  const ctx: IGetContext = {
    actor: {
      userId: ACTOR_ID,
      clinicId: CLINIC_ID,
      organizationId: ORG_ID,
      managedClinics: [{ id: CLINIC_ID }],
    } as IGetContext['actor'],
    source: ExecutionSources.USER_ACTION,
  };

  const posData = (
    over: Partial<OpenCardChargeback> = {}
  ): OpenCardChargeback =>
    ({
      clinicId: CLINIC_ID,
      sourceType: 'POS_TRANSACTION',
      sourceId: POS_TX_ID,
      caseReference: 'CB-1001',
      openedAt: OPENED_AT,
      amount: 1000,
      feeAmount: 25,
      fundsChannel: 'FUNDS_IN_TRANSIT',
      ...over,
    }) as OpenCardChargeback;

  const onlineData = (
    over: Partial<OpenCardChargeback> = {}
  ): OpenCardChargeback =>
    posData({
      sourceType: 'ONLINE_PAYMENT',
      sourceId: INSTALLMENT_ID,
      ...over,
    });

  const bookingData = (
    over: Partial<OpenCardChargeback> = {}
  ): OpenCardChargeback =>
    posData({
      sourceType: 'BOOKING_PAYMENT',
      sourceId: BOOKING_PAYMENT_ID,
      ...over,
    });

  const posSummary = (
    over: Partial<PosTransactionSummary> = {}
  ): PosTransactionSummary => ({
    id: POS_TX_ID,
    clinicId: CLINIC_ID,
    kind: 'SALE',
    status: 'SUCCESS',
    provider: 'PAX',
    patientId: PATIENT_ID,
    paymentId: PAYMENT_ID,
    amount: new Decimal(1000),
    currency: 'TRY',
    completedAt: new Date('2026-10-01T10:00:00Z'),
    ...over,
  });

  const installmentRow = (
    over: Partial<InstallmentLedgerRow> = {}
  ): InstallmentLedgerRow => ({
    installmentId: INSTALLMENT_ID,
    paymentId: PAYMENT_ID,
    clinicId: CLINIC_ID,
    patientId: PATIENT_ID,
    amount: new Decimal(1000),
    currency: 'TRY',
    status: 'COMPLETED',
    paidAt: new Date('2026-10-01T10:00:00Z'),
    ...over,
  });

  interface BuildOptions {
    pos?: PosTransactionSummary | null;
    installment?: InstallmentLedgerRow | null;
    reversible?: Decimal;
    activeChargebacks?: Decimal;
    notInLedger?: boolean;
    fundsGateThrows?: boolean;
    periodSealed?: boolean;
    createThrows?: boolean;
    bankAccountClinicId?: string;
    posLockError?: Error;
    /** Platform kliniği (varsayılan: istekteki klinik). */
    platformClinicId?: string;
    bookingReversible?: Decimal;
    bookingLockError?: Error;
  }

  const build = (options: BuildOptions = {}) => {
    const order: string[] = [];
    let txDepth = 0;
    const depthAtCall: Record<string, number> = {};

    const create = jest.fn((entity: CardChargeback) => {
      order.push('create');
      depthAtCall.create = txDepth;
      if (options.createThrows) {
        return Promise.reject(
          new ChargebackAlreadyRecordedException({
            provider: 'PAX_BANK',
            caseReference: 'CB-1001',
          })
        );
      }
      return Promise.resolve(entity);
    });
    const update = jest.fn((entity: CardChargeback) => {
      order.push('update');
      return Promise.resolve(entity);
    });
    const sumActiveBySource = jest.fn(() => {
      order.push('cap');
      return Promise.resolve(options.activeChargebacks ?? new Decimal(0));
    });
    const chargebackRepo = {
      create,
      update,
      sumActiveBySource,
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

    const tenantScopeResolver = {
      resolve: jest.fn(() => Promise.resolve(ORG_ID)),
    } as unknown as ITenantScopeResolver;

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

    const assertCanSettle = jest.fn(() => {
      order.push('fundsGate');
      return options.fundsGateThrows
        ? Promise.reject(
            new InsufficientFundsInTransitException({
              available: '10.00',
              requested: '1025.00',
            })
          )
        : Promise.resolve();
    });
    const fundsInTransitGate = {
      assertCanSettle,
    } as unknown as IFundsInTransitGate;

    const assertRecorded = jest.fn(
      (_params: { clinicId: string; dedupeKey: string }, error?: Error) => {
        order.push('presence');
        return options.notInLedger && error
          ? Promise.reject(error)
          : Promise.resolve();
      }
    );
    const presenceGuard = {
      assertRecorded,
    } as unknown as IFinancialEventPresenceGuard;

    const lockPos = jest.fn(() => {
      order.push('sourceLock');
      depthAtCall.sourceLock = txDepth;
      return options.posLockError
        ? Promise.reject(options.posLockError)
        : Promise.resolve(options.reversible ?? new Decimal(1000));
    });
    const posCollection = {
      lockAndGetReversibleAmount: lockPos,
    } as unknown as IPosCardCollectionService;

    const lockOnline = jest.fn(() => {
      order.push('sourceLock');
      depthAtCall.sourceLock = txDepth;
      return Promise.resolve(options.reversible ?? new Decimal(1000));
    });
    const paymentCollection = {
      lockAndGetCollectedAmount: lockOnline,
    } as unknown as IPaymentCollectionService;

    const lockBooking = jest.fn(() => {
      order.push('sourceLock');
      depthAtCall.sourceLock = txDepth;
      return options.bookingLockError
        ? Promise.reject(options.bookingLockError)
        : Promise.resolve(options.bookingReversible ?? new Decimal(1000));
    });
    const bookingCollection = {
      lockAndGetReversibleAmount: lockBooking,
    } as unknown as IBookingPaymentCollectionService;

    const platformTenant = {
      resolve: jest.fn(() =>
        Promise.resolve({
          clinicId: options.platformClinicId ?? CLINIC_ID,
          organizationId: ORG_ID,
        })
      ),
    } as unknown as IPlatformTenantProvider;

    const policyCheck = jest.fn().mockReturnValue({ orThrow: () => undefined });
    const policyFactory = {
      finance: jest.fn().mockReturnValue({
        evaluator: { check: policyCheck },
      }),
    } as never;

    const commandExecute = jest.fn((command: unknown) => {
      if (command instanceof EnsurePartyForPatientCommand) {
        order.push('party');
        return Promise.resolve({ partyId: PARTY_ID });
      }
      if (command instanceof RecordFinancialEventCommand) {
        order.push('financialEvent');
        depthAtCall.financialEvent = txDepth;
        return Promise.resolve(EVENT_ID);
      }
      return Promise.reject(new Error('beklenmeyen komut'));
    });
    const commandBus = { execute: commandExecute } as unknown as TSCommandBus;

    const queryExecute = jest.fn((query: unknown) => {
      order.push('facts');
      depthAtCall.facts = txDepth;
      if (query instanceof GetPosTransactionByIdQuery) {
        return Promise.resolve({
          data: options.pos === undefined ? posSummary() : options.pos,
        });
      }
      if (query instanceof GetInstallmentForLedgerQuery) {
        return Promise.resolve({
          data:
            options.installment === undefined
              ? installmentRow()
              : options.installment,
        });
      }
      return Promise.reject(new Error('beklenmeyen sorgu'));
    });
    const queryBus = { execute: queryExecute } as unknown as TSQueryBus;

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
      handler: new OpenCardChargebackHandler(
        chargebackRepo,
        bankAccountRepo,
        tenantScopeResolver,
        periodGate,
        fundsInTransitGate,
        presenceGuard,
        posCollection,
        paymentCollection,
        bookingCollection,
        platformTenant,
        policyFactory,
        commandBus,
        queryBus,
        txManager
      ),
      create,
      update,
      sumActiveBySource,
      assertCanSettle,
      assertRecorded,
      assertPeriod,
      lockPos,
      lockOnline,
      lockBooking,
      queryExecute,
      commandExecute,
      outboxRun,
      order,
      depthAtCall,
      policyCheck,
    };
  };

  const eventCommand = (
    execute: ReturnType<typeof build>['commandExecute']
  ): RecordFinancialEventCommand => {
    const call = execute.mock.calls.find(
      ([command]) => command instanceof RecordFinancialEventCommand
    );
    return call?.[0] as RecordFinancialEventCommand;
  };

  describe('fiziksel POS satışı', () => {
    it('kaydı yazar, açılış olayını üretir ve köprü izini damgalar', async () => {
      const { handler, create, update, commandExecute } = build();

      const id = await handler.execute(
        new OpenCardChargebackCommand(posData(), ctx)
      );

      expect(create).toHaveBeenCalledTimes(1);
      const stamped = update.mock.calls[0][0];
      expect(stamped.openedEventId).toBe(EVENT_ID);
      expect(id).toBe(stamped.id.value);
      expect(stamped.status).toBe('OPEN');
      expect(stamped.partyId?.value).toBe(PARTY_ID);
      expect(stamped.patientId?.value).toBe(PATIENT_ID);
      expect(stamped.paymentId).toBe(PAYMENT_ID);
      expect(stamped.recordedById).toBe(ACTOR_ID);
      expect(eventCommand(commandExecute)).toBeDefined();
    });

    it('olay gövdesi tutar, ücret, kanal ve vakayı kuruş ölçeğinde taşır', async () => {
      const { handler, commandExecute } = build();

      await handler.execute(new OpenCardChargebackCommand(posData(), ctx));

      const event = eventCommand(commandExecute);
      expect(event.data.type).toBe('CARD_CHARGEBACK_OPENED');
      expect(event.data.payload).toMatchObject({
        amount: '1000.00',
        feeAmount: '25.00',
        fundsChannel: 'FUNDS_IN_TRANSIT',
        currency: 'TRY',
        provider: 'PAX_BANK',
        caseReference: 'CB-1001',
      });
      // Fişin tarihi paranın kesildiği gündür — kaydın oluşturulma günü değil.
      expect(event.data.occurredAt).toEqual(OPENED_AT);
      expect(event.data.dedupeKey).toContain('card-chargeback-opened:');
      expect(event.data.sourceModule).toBe('bank');
    });

    it('sağlayıcı cihazdan türer: PAX → PAX_BANK, iyzico terminal → IYZICO_TERMINAL', async () => {
      const pax = build({ pos: posSummary({ provider: 'PAX' }) });
      await pax.handler.execute(new OpenCardChargebackCommand(posData(), ctx));
      expect(pax.update.mock.calls[0][0].provider).toBe('PAX_BANK');

      const terminal = build({
        pos: posSummary({ provider: 'IYZICO_TERMINAL' }),
      });
      await terminal.handler.execute(
        new OpenCardChargebackCommand(posData({ caseReference: 'CB-2' }), ctx)
      );
      expect(terminal.update.mock.calls[0][0].provider).toBe('IYZICO_TERMINAL');
    });

    it('kritik işlem outboxRun ile yürür; kilit, kayıt ve olay aynı transaction içinde', async () => {
      const { handler, outboxRun, depthAtCall } = build();

      await handler.execute(new OpenCardChargebackCommand(posData(), ctx));

      expect(outboxRun).toHaveBeenCalledTimes(1);
      expect(depthAtCall.sourceLock).toBe(1);
      expect(depthAtCall.create).toBe(1);
      expect(depthAtCall.financialEvent).toBe(1);
      // Kaynağın değişmeyen olguları transaction DIŞINDA (kilit kısa tutulur).
      expect(depthAtCall.facts).toBe(0);
    });

    it('kapı sırası: olgular → kaynak kilidi → defterde var mı → tavan → dönem → 108 → cari → kayıt → olay → damga', async () => {
      const { handler, order } = build();

      await handler.execute(new OpenCardChargebackCommand(posData(), ctx));

      expect(order).toEqual([
        'facts',
        'sourceLock',
        'presence',
        'cap',
        'periodGate',
        'fundsGate',
        'party',
        'create',
        'financialEvent',
        'update',
      ]);
    });

    it('defter kanıtı POS tahsilatının dedupe anahtarıyla aranır', async () => {
      const { handler, assertRecorded } = build();

      await handler.execute(new OpenCardChargebackCommand(posData(), ctx));

      expect(assertRecorded.mock.calls[0][0]).toEqual({
        clinicId: CLINIC_ID,
        dedupeKey: `payment-received:pos:${POS_TX_ID}`,
      });
    });

    it('108 kapısına tutar + ücret (brüt kesinti) sorulur', async () => {
      const { handler, assertCanSettle } = build();

      await handler.execute(new OpenCardChargebackCommand(posData(), ctx));

      expect(assertCanSettle).toHaveBeenCalledTimes(1);
      const params = (
        assertCanSettle.mock.calls as unknown as [
          { clinicId: string; grossAmount: Decimal },
        ][]
      )[0][0];
      expect(params.clinicId).toBe(CLINIC_ID);
      expect(params.grossAmount.toFixed(2)).toBe('1025.00');
    });

    it('banka kanalında 108 kapısına dokunulmaz (para doğrudan bankadan çekildi)', async () => {
      const { handler, assertCanSettle } = build();

      await handler.execute(
        new OpenCardChargebackCommand(posData({ fundsChannel: 'BANK' }), ctx)
      );

      expect(assertCanSettle).not.toHaveBeenCalled();
    });

    it('108 bakiyesi yetersizse hiçbir şey yazılmaz', async () => {
      const { handler, create, commandExecute } = build({
        fundsGateThrows: true,
      });

      await expect(
        handler.execute(new OpenCardChargebackCommand(posData(), ctx))
      ).rejects.toBeInstanceOf(InsufficientFundsInTransitException);

      expect(create).not.toHaveBeenCalled();
      expect(eventCommand(commandExecute)).toBeUndefined();
    });
  });

  describe('kümülatif tavan', () => {
    it('aktif itiraz + yeni itiraz geri götürülebilir tutarı aşarsa reddedilir', async () => {
      // 1000 TL'lik satışa 400 TL iade yapılmış → geri götürülebilir 600; 300 TL
      // itiraz zaten açık → en fazla 300 daha. 400 istenince para üç kez düşerdi.
      const { handler, create } = build({
        reversible: new Decimal(600),
        activeChargebacks: new Decimal(300),
      });

      const error = await handler
        .execute(new OpenCardChargebackCommand(posData({ amount: 400 }), ctx))
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ChargebackExceedsCollectionException);
      expect((error as ChargebackExceedsCollectionException).meta).toEqual({
        reversible: '600.00',
        activeChargebacks: '300.00',
        requested: '400.00',
        available: '300.00',
      });
      expect(create).not.toHaveBeenCalled();
    });

    it('tam sınırdaki itiraz kabul edilir', async () => {
      const { handler, create } = build({
        reversible: new Decimal(600),
        activeChargebacks: new Decimal(300),
      });

      await handler.execute(
        new OpenCardChargebackCommand(posData({ amount: 300 }), ctx)
      );

      expect(create).toHaveBeenCalledTimes(1);
    });
  });

  describe('kaynak olguları (kilitten önce elenir)', () => {
    const rejectsBeforeTransaction = async (
      options: BuildOptions,
      error: new (...args: never[]) => Error,
      data: OpenCardChargeback = posData()
    ) => {
      const { handler, outboxRun, create } = build(options);

      await expect(
        handler.execute(new OpenCardChargebackCommand(data, ctx))
      ).rejects.toBeInstanceOf(error);

      // Kullanıcı hatası kilit ALMADAN elenir.
      expect(outboxRun).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    };

    it('olmayan POS işlemi', () =>
      rejectsBeforeTransaction(
        { pos: null },
        ChargebackSourceNotFoundException
      ));

    it('başka kliniğin POS işlemi', () =>
      rejectsBeforeTransaction(
        { pos: posSummary({ clinicId: OTHER_CLINIC_ID }) },
        ChargebackSourceClinicMismatchException
      ));

    it('iade/iptal kaydı itiraz edilemez (yalnız SATIŞ)', () =>
      rejectsBeforeTransaction(
        { pos: posSummary({ kind: 'REFUND' }) },
        ChargebackSourceNotChargeableException
      ));

    it('başarısız / askıdaki işlem itiraz edilemez', () =>
      rejectsBeforeTransaction(
        { pos: posSummary({ status: 'PENDING' }) },
        ChargebackSourceNotChargeableException
      ));

    it('hastasız kart çekimi deftere hiç yazılmadığı için itiraz edilemez', () =>
      rejectsBeforeTransaction(
        { pos: posSummary({ patientId: null }) },
        ChargebackSourcePatientRequiredException
      ));

    it('yabancı para tahsilatı v1’de desteklenmez', () =>
      rejectsBeforeTransaction(
        { pos: posSummary({ currency: 'EUR' }) },
        ChargebackCurrencyNotSupportedException
      ));
  });

  describe('defter ve dönem kapıları', () => {
    it('tahsilat defterde yazılı değilse reddedilir — olmayan para düşülmez', async () => {
      const { handler, create, commandExecute } = build({ notInLedger: true });

      await expect(
        handler.execute(new OpenCardChargebackCommand(posData(), ctx))
      ).rejects.toBeInstanceOf(ChargebackSourceNotInLedgerException);

      expect(create).not.toHaveBeenCalled();
      expect(eventCommand(commandExecute)).toBeUndefined();
    });

    it('mühürlenmiş döneme düşen itiraz reddedilir', async () => {
      const { handler, create } = build({ periodSealed: true });

      await expect(
        handler.execute(new OpenCardChargebackCommand(posData(), ctx))
      ).rejects.toBeInstanceOf(PeriodSealedForDateException);

      expect(create).not.toHaveBeenCalled();
    });

    it('dönem kapısına paranın kesildiği gün sorulur (kayıt günü değil)', async () => {
      // Tarih belgenin kendi tarihidir: mühürlenmiş döneme düşen kayıt hiç
      // fişlenemez (CLAUDE.md finans kuralı 1).
      const { handler, assertPeriod } = build();

      await handler.execute(new OpenCardChargebackCommand(posData(), ctx));

      expect(assertPeriod).toHaveBeenCalledWith({
        clinicId: CLINIC_ID,
        date: OPENED_AT,
      });
    });

    it('başka kliniğin banka hesabı seçilemez (kiracı sınırı)', async () => {
      const { handler, create } = build({
        bankAccountClinicId: OTHER_CLINIC_ID,
      });

      await expect(
        handler.execute(
          new OpenCardChargebackCommand(
            posData({ bankAccountId: BANK_ACCOUNT_ID }),
            ctx
          )
        )
      ).rejects.toBeInstanceOf(ChargebackBankAccountMismatchException);

      expect(create).not.toHaveBeenCalled();
    });

    it('banka hesabı verilmezse hesap doğrulaması atlanır', async () => {
      const { handler, order } = build();

      await handler.execute(new OpenCardChargebackCommand(posData(), ctx));

      expect(order).not.toContain('bankAccount');
    });

    it('aynı vaka ikinci kez girilirse tipli 409 döner ve olay yazılmaz', async () => {
      // İkinci kayıt 127'yi iki kez doldurur ve 108'i iki kez düşer; mizan yine
      // dengeli göründüğü için hata görünmez.
      const { handler, commandExecute } = build({ createThrows: true });

      await expect(
        handler.execute(new OpenCardChargebackCommand(posData(), ctx))
      ).rejects.toBeInstanceOf(ChargebackAlreadyRecordedException);

      expect(eventCommand(commandExecute)).toBeUndefined();
    });

    it('yetki hedef klinik üzerinden kontrol edilir', async () => {
      const { handler, policyCheck } = build();

      await handler.execute(new OpenCardChargebackCommand(posData(), ctx));

      expect(policyCheck).toHaveBeenCalledTimes(1);
    });
  });

  describe('sanal POS taksidi', () => {
    it('kaynak taksittir: kilit ödeme satırında, kanıt taksit tahsilat olayında', async () => {
      const { handler, lockPos, lockOnline, assertRecorded, update } = build();

      await handler.execute(new OpenCardChargebackCommand(onlineData(), ctx));

      expect(lockPos).not.toHaveBeenCalled();
      expect(lockOnline).toHaveBeenCalledWith({
        installmentId: INSTALLMENT_ID,
      });
      expect(assertRecorded.mock.calls[0][0].dedupeKey).toBe(
        `payment-received:${INSTALLMENT_ID}`
      );

      const stamped = update.mock.calls[0][0];
      expect(stamped.provider).toBe('IYZICO');
      // Sanal POS'ta taksit kimliği kaynaktan türer (DB CHECK ile aynı kural).
      expect(stamped.installmentId).toBe(INSTALLMENT_ID);
      expect(stamped.paymentId).toBe(PAYMENT_ID);
    });

    it('tahsil edilmemiş taksit itiraz edilemez', async () => {
      const { handler, outboxRun } = build({
        installment: installmentRow({ status: 'PENDING' }),
      });

      await expect(
        handler.execute(new OpenCardChargebackCommand(onlineData(), ctx))
      ).rejects.toBeInstanceOf(ChargebackSourceNotChargeableException);

      expect(outboxRun).not.toHaveBeenCalled();
    });

    it('olmayan / başka kliniğin taksidi reddedilir', async () => {
      const missing = build({ installment: null });
      await expect(
        missing.handler.execute(
          new OpenCardChargebackCommand(onlineData(), ctx)
        )
      ).rejects.toBeInstanceOf(ChargebackSourceNotFoundException);

      const foreign = build({
        installment: installmentRow({ clinicId: OTHER_CLINIC_ID }),
      });
      await expect(
        foreign.handler.execute(
          new OpenCardChargebackCommand(onlineData(), ctx)
        )
      ).rejects.toBeInstanceOf(ChargebackSourceClinicMismatchException);
    });
  });

  it('POS kilit servisi satışı bulamazsa kendi tipli hatası yükselir (kayıt açılmaz)', async () => {
    const { handler, create } = build({
      posLockError: new OriginalPosTransactionNotFoundException(),
    });

    await expect(
      handler.execute(new OpenCardChargebackCommand(posData(), ctx))
    ).rejects.toBeInstanceOf(OriginalPosTransactionNotFoundException);

    expect(create).not.toHaveBeenCalled();
  });

  describe('platform rezervasyon tahsilatı (BOOKING_PAYMENT)', () => {
    it('hasta ve cari OLMADAN kaydedilir; cari garantisi (EnsureParty) çağrılmaz', async () => {
      const { handler, update, commandExecute, lockBooking } = build();

      await handler.execute(new OpenCardChargebackCommand(bookingData(), ctx));

      const stamped = update.mock.calls[0][0];
      expect(stamped.sourceType).toBe('BOOKING_PAYMENT');
      expect(stamped.sourceId).toBe(BOOKING_PAYMENT_ID);
      expect(stamped.patientId).toBeNull();
      expect(stamped.partyId).toBeNull();
      expect(stamped.paymentId).toBeNull();
      expect(stamped.installmentId).toBeNull();
      expect(stamped.provider).toBe('IYZICO');
      expect(stamped.currency).toBe('TRY');
      expect(lockBooking).toHaveBeenCalledWith({
        bookingPaymentId: BOOKING_PAYMENT_ID,
      });
      expect(
        commandExecute.mock.calls.some(
          ([c]) => c instanceof EnsurePartyForPatientCommand
        )
      ).toBe(false);
      expect(eventCommand(commandExecute)).toBeDefined();
    });

    it('kanıt, platform rezervasyon FİŞİNİN dedupe anahtarıyla aranır; hasta/POS sorgusu yapılmaz', async () => {
      const { handler, assertRecorded, queryExecute } = build();

      await handler.execute(new OpenCardChargebackCommand(bookingData(), ctx));

      expect(assertRecorded.mock.calls[0][0]).toEqual({
        clinicId: CLINIC_ID,
        dedupeKey: `platform-booking-settled:${BOOKING_PAYMENT_ID}`,
      });
      expect(queryExecute).not.toHaveBeenCalled();
    });

    it('klinik PLATFORM değilse reddedilir: başka kiracının defterine itiraz yazılamaz', async () => {
      const { handler, create, lockBooking } = build({
        platformClinicId: OTHER_CLINIC_ID,
      });

      await expect(
        handler.execute(new OpenCardChargebackCommand(bookingData(), ctx))
      ).rejects.toBeInstanceOf(ChargebackSourceClinicMismatchException);

      expect(lockBooking).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    });

    it('tavan: aktif itiraz + yeni itiraz geri götürülebilir tutarı aşarsa reddedilir', async () => {
      const { handler, create, sumActiveBySource } = build({
        bookingReversible: new Decimal(1000),
        activeChargebacks: new Decimal(600),
      });

      await expect(
        handler.execute(
          new OpenCardChargebackCommand(bookingData({ amount: 500 }), ctx)
        )
      ).rejects.toBeInstanceOf(ChargebackExceedsCollectionException);

      expect(sumActiveBySource).toHaveBeenCalledWith({
        sourceType: 'BOOKING_PAYMENT',
        sourceId: BOOKING_PAYMENT_ID,
      });
      expect(create).not.toHaveBeenCalled();
    });

    it('iade satırı tutarı zaten geri götürdüyse (kilitli okuma 0 döner) itiraz reddedilir', async () => {
      const { handler, create } = build({ bookingReversible: new Decimal(0) });

      await expect(
        handler.execute(
          new OpenCardChargebackCommand(bookingData({ amount: 100 }), ctx)
        )
      ).rejects.toBeInstanceOf(ChargebackExceedsCollectionException);

      expect(create).not.toHaveBeenCalled();
    });

    it('tahsil edilmemiş / iyzico dışı ödeme servisinin reddiyle durur; kayıt yazılmaz', async () => {
      const { handler, create } = build({
        bookingLockError: new BookingPaymentNotChargeableException({
          bookingPaymentId: BOOKING_PAYMENT_ID,
          reason: 'yalnız iyzico tahsilatı desteklenir',
        }),
      });

      await expect(
        handler.execute(new OpenCardChargebackCommand(bookingData(), ctx))
      ).rejects.toBeInstanceOf(BookingPaymentNotChargeableException);

      expect(create).not.toHaveBeenCalled();
    });

    it('platform fişi yazılmamışsa (ileri fiş yok) 108’de olmayan paranın itirazı reddedilir', async () => {
      const { handler, create } = build({ notInLedger: true });

      await expect(
        handler.execute(new OpenCardChargebackCommand(bookingData(), ctx))
      ).rejects.toBeInstanceOf(ChargebackSourceNotInLedgerException);

      expect(create).not.toHaveBeenCalled();
    });

    it('kapı sırası POS ile aynı: kilit → defterde var mı → tavan → dönem → 108 → kayıt → olay', async () => {
      const { handler, order } = build();

      await handler.execute(new OpenCardChargebackCommand(bookingData(), ctx));

      expect(order).toEqual([
        'sourceLock',
        'presence',
        'cap',
        'periodGate',
        'fundsGate',
        'create',
        'financialEvent',
        'update',
      ]);
    });
  });
});
