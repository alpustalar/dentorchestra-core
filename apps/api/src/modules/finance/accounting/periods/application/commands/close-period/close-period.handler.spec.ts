/*
 * Handler bağımlılıkları jest mock'larıyla taklit edildiği için nesne metodları
 * `any` taşır ve bağlamsız (unbound) okunur; bu kurallar yalnız bu dosyada
 * kapatılır (üretim kodunda açık kalır).
 */
/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  PeriodAlreadyClosedException,
  PeriodNotFoundException,
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

  const build = (
    period: ReturnType<typeof makePeriod> | null,
    options: { claimed?: boolean; unpostedCount?: number } = {}
  ) => {
    const { claimed = true, unpostedCount = 0 } = options;

    const periodCommandRepo = {
      findById: jest.fn().mockResolvedValue(period),
      claimForClosing: jest.fn().mockResolvedValue(claimed),
      update: jest.fn().mockResolvedValue(period),
    } as unknown as IAccountingPeriodCommandRepository;
    const commandBus = {
      execute: jest.fn().mockResolvedValue(undefined),
    } as unknown as TSCommandBus;
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

  const run = (handler: ClosePeriodHandler) =>
    handler.execute(new ClosePeriodCommand('period-1', ctx));

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
});
