/*
 * Handler bağımlılıkları jest mock'larıyla taklit edildiği için nesne metodları
 * `any` taşır ve bağlamsız (unbound) okunur; bu kurallar yalnız bu dosyada
 * kapatılır (üretim kodunda açık kalır).
 */
/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  ClosingNextPeriodUnavailableException,
  ClosingPreviewStaleException,
  PeriodAlreadyClosedException,
  PeriodNotFoundException,
  PreviousPeriodNotClosedException,
} from '@modules/finance/accounting/periods/domain/exceptions/period.exceptions';
import { UnpostedFinancialEventsException } from '@modules/finance/accounting/financial-events/domain/exceptions';
import { ClosePeriodHandler } from './close-period.handler';
import { ClosePeriodCommand } from './close-period.command';
import { GenerateYearEndClosingCommand } from '@modules/finance/accounting/posting/application/commands/generate-year-end-closing/generate-year-end-closing.command';
import { IAccountingPeriodCommandRepository } from '@modules/finance/accounting/periods/domain/repositories/accounting-period/accounting-period.command.repository';
import { IFinancialEventPostingCompletenessService } from '@modules/finance/accounting/financial-events/domain/services/posting-completeness/posting-completeness.service.interface';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { POSTABLE_FINANCIAL_EVENT_TYPES } from '@modules/finance/accounting/posting/domain/posting/postable-event-types.constant';

describe('ClosePeriodHandler (dönem kapanışı, doc 04/08)', () => {
  const ctx = { actor: { userId: 'u-1' } } as never;

  const makePeriod = (isClosed = false) => ({
    id: { value: 'period-1' },
    clinicId: { value: 'clinic-1' },
    organizationId: { value: 'org-1' },
    year: 2026,
    status: 'OPEN',
    // Önizlemenin döndürdüğü sayaç (kilit altında yeniden okunur).
    lastEntryNo: 5n,
    startsAt: new Date('2026-01-01'),
    endsAt: new Date('2026-12-31'),
    validate: {
      isOpenOrLocked: {
        orThrow: jest.fn(() => {
          if (isClosed)
            throw new PeriodAlreadyClosedException('period-1', 2026);
        }),
      },
    },
    // Durum geçişi + denetim damgası domain'de; handler yalnız çağırır.
    close: jest.fn(),
  });

  const makeNextPeriod = (status = 'OPEN') => ({
    id: { value: 'period-2' },
    year: 2027,
    status,
    startsAt: new Date('2027-01-01'),
  });

  const build = (
    period: ReturnType<typeof makePeriod> | null,
    options: {
      claimed?: boolean;
      unpostedCount?: number;
      notClosedBefore?: { year: number }[];
      nextPeriod?: ReturnType<typeof makeNextPeriod> | null;
      businessType?: 'COMPANY' | 'SOLE_PROPRIETOR' | null;
    } = {}
  ) => {
    const {
      claimed = true,
      unpostedCount = 0,
      notClosedBefore = [],
      nextPeriod = null,
      businessType = null,
    } = options;

    const periodCommandRepo = {
      findById: jest.fn().mockResolvedValue(period),
      claimForClosing: jest.fn().mockResolvedValue(claimed),
      update: jest.fn().mockResolvedValue(period),
      findNotClosedBefore: jest.fn().mockResolvedValue(notClosedBefore),
      findByYear: jest.fn().mockResolvedValue(nextPeriod),
    } as unknown as IAccountingPeriodCommandRepository;
    const commandBus = {
      execute: jest.fn().mockResolvedValue(undefined),
    } as unknown as TSCommandBus;
    const queryBus = {
      execute: jest.fn().mockResolvedValue({ data: { businessType } }),
    } as never;
    const txManager = {
      outboxRun: jest.fn((cb: () => Promise<unknown>) => cb()),
    } as never;

    // Yetki kapıda: kapsam kaydın kendi kliniğinden doğrulanıyor.
    const policyFactory = {
      finance: jest.fn().mockReturnValue({
        evaluator: { check: () => ({ orThrow: () => undefined }) },
      }),
    } as never;

    const postingCompleteness = {
      assertAllPostedInRange: jest.fn(() => {
        if (unpostedCount > 0) {
          return Promise.reject(
            new UnpostedFinancialEventsException({
              clinicId: 'clinic-1',
              unpostedCount,
              from: '2026-01-01',
              to: '2026-12-31',
            })
          );
        }
        return Promise.resolve();
      }),
    } as unknown as IFinancialEventPostingCompletenessService;

    return {
      handler: new ClosePeriodHandler(
        periodCommandRepo,
        commandBus,
        queryBus,
        txManager,
        policyFactory,
        postingCompleteness
      ),
      periodCommandRepo,
      commandBus,
      postingCompleteness,
      period,
    };
  };

  const run = (
    handler: ClosePeriodHandler,
    data: Partial<ClosePeriodCommand['payload']['data']> = {}
  ) =>
    handler.execute(
      new ClosePeriodCommand({
        periodId: 'period-1',
        data: { expectedLastEntryNo: '5', grniAccruals: [], ...data },
        ctx,
      })
    );

  it('dönemi atomik sahiplenir (claimForClosing) ve kapanış fişini üretir', async () => {
    const period = makePeriod();
    const { handler, periodCommandRepo, commandBus } = build(period);

    await run(handler);

    expect(period.close).toHaveBeenCalledWith({
      actorId: 'u-1',
      source: undefined,
    });
    expect(periodCommandRepo.claimForClosing).toHaveBeenCalledWith(period);

    const closingCall = (commandBus.execute as jest.Mock).mock.calls.find(
      ([c]) => c instanceof GenerateYearEndClosingCommand
    );
    expect(closingCall).toBeDefined();
    const closingCmd = closingCall![0] as GenerateYearEndClosingCommand;
    expect(closingCmd.input).toMatchObject({
      clinicId: 'clinic-1',
      periodId: 'period-1',
      dateFrom: period.startsAt,
      dateTo: period.endsAt,
    });
  });

  it('dönem yoksa 404 atar', async () => {
    const { handler } = build(null);
    await expect(run(handler)).rejects.toBeInstanceOf(PeriodNotFoundException);
  });

  it('zaten kapatılmış dönem (hızlı-ret) fiş üretmez, claim denemez', async () => {
    const period = makePeriod(true);
    const { handler, periodCommandRepo, commandBus } = build(period);

    await expect(run(handler)).rejects.toBeInstanceOf(
      PeriodAlreadyClosedException
    );
    expect(periodCommandRepo.claimForClosing).not.toHaveBeenCalled();
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('eşzamanlı yarış: claim başarısızsa (false) fiş üretmez, hata atar', async () => {
    const period = makePeriod();
    const { handler, commandBus } = build(period, { claimed: false });

    await expect(run(handler)).rejects.toBeInstanceOf(
      PeriodAlreadyClosedException
    );
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('fişlenmemiş ekonomik olay varsa dönem kapanmaz (doc 04 §5 adım 1)', async () => {
    const period = makePeriod();
    const { handler, commandBus, postingCompleteness } = build(period, {
      unpostedCount: 3,
    });

    await expect(run(handler)).rejects.toBeInstanceOf(
      UnpostedFinancialEventsException
    );
    // Kapanış fişi üretilmez; claim aynı transaction içinde geri sarılır.
    expect(commandBus.execute).not.toHaveBeenCalled();
    expect(postingCompleteness.assertAllPostedInRange).toHaveBeenCalledWith({
      clinicId: 'clinic-1',
      from: period.startsAt,
      to: period.endsAt,
      types: POSTABLE_FINANCIAL_EVENT_TYPES,
    });
  });
  // ───────────────────────────── yıl sonu kapısı (tur 33) ─────────────────────────────

  describe('sıra kapısı: önceki yıl kapanmadan sonraki yıl kapatılamaz', () => {
    it('kapanmamış önceki yıl varsa reddedilir; claim denenmez', async () => {
      const period = makePeriod();
      const { handler, periodCommandRepo, commandBus } = build(period, {
        notClosedBefore: [{ year: 2025 }],
      });

      const error = await run(handler).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(PreviousPeriodNotClosedException);
      expect((error as PreviousPeriodNotClosedException).meta).toEqual({
        periodId: 'period-1',
        year: 2026,
        blockingYear: 2025,
      });
      expect(periodCommandRepo.claimForClosing).not.toHaveBeenCalled();
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('sıra, Command Repo’dan (karar besleyen okuma) sorulur', async () => {
      const period = makePeriod();
      const { handler, periodCommandRepo } = build(period);

      await run(handler);

      expect(periodCommandRepo.findNotClosedBefore).toHaveBeenCalledWith(
        'clinic-1',
        2026
      );
    });
  });

  describe('önizleme tazeliği (expectedLastEntryNo)', () => {
    it('sayaç önizlemedekiyle farklıysa kapanış reddedilir ve fiş üretilmez', async () => {
      const period = makePeriod(); // kilit altında okunan sayaç: 5
      const { handler, commandBus } = build(period);

      const error = await run(handler, { expectedLastEntryNo: '4' }).catch(
        (e: unknown) => e
      );

      expect(error).toBeInstanceOf(ClosingPreviewStaleException);
      expect((error as ClosingPreviewStaleException).meta).toEqual({
        periodId: 'period-1',
        expectedLastEntryNo: '4',
        actualLastEntryNo: '5',
      });
      // Claim aynı transaction içinde geri sarılır; kapanış fişi hiç üretilmez.
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('sayaç claim’DEN SONRA okunur (kilit altında): önizleme ile claim arasına fiş giremez', async () => {
      const period = makePeriod();
      const { handler, periodCommandRepo } = build(period);

      await run(handler);

      const claimOrder = (periodCommandRepo.claimForClosing as jest.Mock).mock
        .invocationCallOrder[0];
      const rereadOrders = (periodCommandRepo.findById as jest.Mock).mock
        .invocationCallOrder;
      // findById iki kez: ilki ön okuma (claim'den önce), ikincisi sayaç doğrulaması (claim'den sonra).
      expect(rereadOrders).toHaveLength(2);
      expect(rereadOrders[0]).toBeLessThan(claimOrder);
      expect(rereadOrders[1]).toBeGreaterThan(claimOrder);
    });

    it('stale kontrolü fişlenmemiş olay kontrolünden ÖNCE çalışır (ucuz ve belirleyici olan önce)', async () => {
      const period = makePeriod();
      const { handler, postingCompleteness } = build(period, {
        unpostedCount: 3,
      });

      await expect(
        run(handler, { expectedLastEntryNo: '4' })
      ).rejects.toBeInstanceOf(ClosingPreviewStaleException);
      expect(postingCompleteness.assertAllPostedInRange).not.toHaveBeenCalled();
    });
  });

  describe('GRNI tahakkuku seçimi ve ertesi yıl dönemi', () => {
    const accruals = [{ orderId: 'o1', debitAccountCode: '150' as const }];

    it('tahakkuk seçilmediyse ertesi yıl dönemi aranmaz ve kapanış komutuna null geçer', async () => {
      const period = makePeriod();
      const { handler, periodCommandRepo, commandBus } = build(period);

      await run(handler);

      expect(periodCommandRepo.findByYear).not.toHaveBeenCalled();
      const cmd = (commandBus.execute as jest.Mock).mock
        .calls[0][0] as GenerateYearEndClosingCommand;
      expect(cmd.input.nextPeriod).toBeNull();
      expect(cmd.input.grniAccruals).toEqual([]);
    });

    it('tahakkuk seçildiyse ertesi yıl dönemi komuta taşınır', async () => {
      const period = makePeriod();
      const next = makeNextPeriod();
      const { handler, periodCommandRepo, commandBus } = build(period, {
        nextPeriod: next,
      });

      await run(handler, { grniAccruals: accruals });

      expect(periodCommandRepo.findByYear).toHaveBeenCalledWith(
        'clinic-1',
        2027
      );
      const cmd = (commandBus.execute as jest.Mock).mock
        .calls[0][0] as GenerateYearEndClosingCommand;
      expect(cmd.input.nextPeriod).toEqual({
        id: 'period-2',
        startsAt: next.startsAt,
      });
      expect(cmd.input.grniAccruals).toEqual(accruals);
    });

    it('ertesi yıl dönemi yoksa reddedilir: tahakkuk yazılsa ters kaydı atılamazdı', async () => {
      const period = makePeriod();
      const { handler, periodCommandRepo, commandBus } = build(period, {
        nextPeriod: null,
      });

      const error = await run(handler, { grniAccruals: accruals }).catch(
        (e: unknown) => e
      );

      expect(error).toBeInstanceOf(ClosingNextPeriodUnavailableException);
      expect(
        (error as ClosingNextPeriodUnavailableException).meta
      ).toMatchObject({
        nextYear: 2027,
        reason: 'MISSING',
      });
      expect(periodCommandRepo.claimForClosing).not.toHaveBeenCalled();
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('ertesi yıl dönemi OPEN değilse reddedilir', async () => {
      const period = makePeriod();
      const { handler } = build(period, {
        nextPeriod: makeNextPeriod('CLOSED'),
      });

      const error = await run(handler, { grniAccruals: accruals }).catch(
        (e: unknown) => e
      );

      expect(
        (error as ClosingNextPeriodUnavailableException).meta
      ).toMatchObject({
        reason: 'NOT_OPEN',
      });
    });
  });

  describe('işletme biçimi ve öz kaynak devri', () => {
    it('biçim seçiliyse tahakkuk olmasa da ertesi yıl dönemi zorunlu: yoksa reddedilir, claim denenmez', async () => {
      const period = makePeriod();
      const { handler, periodCommandRepo, commandBus } = build(period, {
        businessType: 'COMPANY',
        nextPeriod: null,
      });

      const error = await run(handler).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ClosingNextPeriodUnavailableException);
      expect(periodCommandRepo.claimForClosing).not.toHaveBeenCalled();
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('biçim seçiliyse biçim ve ertesi yıl dönemi kapanış komutuna taşınır', async () => {
      const period = makePeriod();
      const next = makeNextPeriod();
      const { handler, commandBus } = build(period, {
        businessType: 'SOLE_PROPRIETOR',
        nextPeriod: next,
      });

      await run(handler);

      const cmd = (commandBus.execute as jest.Mock).mock
        .calls[0][0] as GenerateYearEndClosingCommand;
      expect(cmd.input.businessType).toBe('SOLE_PROPRIETOR');
      expect(cmd.input.nextPeriod).toEqual({
        id: 'period-2',
        startsAt: next.startsAt,
      });
    });

    it('biçim seçilmemişse (eski klinik) eskisi gibi çalışır: ertesi yıl aranmaz, biçim null', async () => {
      const period = makePeriod();
      const { handler, periodCommandRepo, commandBus } = build(period);

      await run(handler);

      expect(periodCommandRepo.findByYear).not.toHaveBeenCalled();
      const cmd = (commandBus.execute as jest.Mock).mock
        .calls[0][0] as GenerateYearEndClosingCommand;
      expect(cmd.input.businessType).toBeNull();
    });
  });
});
