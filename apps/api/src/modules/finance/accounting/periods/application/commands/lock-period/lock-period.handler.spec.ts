import { AccountingPeriodStatusSchema } from '@shared';
import { LockPeriodHandler } from './lock-period.handler';
import { LockPeriodCommand } from './lock-period.command';
import { ReopenPeriodHandler } from '../reopen-period/reopen-period.handler';
import { ReopenPeriodCommand } from '../reopen-period/reopen-period.command';
import { AccountingPeriod } from '@modules/finance/accounting/periods/domain/entities/accounting-period.entity';
import { IAccountingPeriodCommandRepository } from '@modules/finance/accounting/periods/domain/repositories/accounting-period/accounting-period.command.repository';
import {
  PeriodConcurrentTransitionException,
  PeriodNotFoundException,
} from '@modules/finance/accounting/periods/domain/exceptions/period.exceptions';
import { UUID } from '@src/domain/value-objects/uuid.vo';

const { LOCKED, OPEN } = AccountingPeriodStatusSchema.enum;

/**
 * Kilitle/yeniden aç akışının kritik davranışı: yazma **koşullu** olmalı.
 * Koşulsuz `update(entity)` ile araya giren bir kapanış geri alınıyordu —
 * kapanış fişleri atılmış bir dönem yeniden yazılabilir hale geliyordu.
 */
describe('LockPeriodHandler / ReopenPeriodHandler (koşullu geçiş)', () => {
  const ctx = { actor: { userId: 'manager-1' }, source: undefined } as never;

  const policyFactory = {
    finance: jest.fn().mockReturnValue({
      evaluator: { check: () => ({ orThrow: () => undefined }) },
    }),
  } as never;

  const txManager = {
    run: jest.fn((cb: () => Promise<unknown>) => cb()),
  } as never;

  const openPeriod = () =>
    AccountingPeriod.create({
      clinicId: UUID.generate().value,
      organizationId: UUID.generate().value,
      year: 2026,
      actorId: 'user-1',
    });

  const buildRepo = (period: AccountingPeriod | null, claimed = true) => {
    const claimForLocking = jest.fn().mockResolvedValue(claimed);
    const claimForReopening = jest.fn().mockResolvedValue(claimed);
    const update = jest.fn();
    const repo = {
      findById: jest.fn().mockResolvedValue(period),
      claimForLocking,
      claimForReopening,
      update,
    } as unknown as IAccountingPeriodCommandRepository;
    return { repo, claimForLocking, claimForReopening, update };
  };

  it('kilitleme: entity geçişi uygulanır ve koşullu claim çağrılır (update DEĞİL)', async () => {
    const period = openPeriod();
    const { repo, claimForLocking, update } = buildRepo(period);
    const handler = new LockPeriodHandler(repo, txManager, policyFactory);

    await handler.execute(new LockPeriodCommand(period.id.value, ctx));

    expect(period.status).toBe(LOCKED);
    expect(period.lockedById).toBe('manager-1');
    expect(claimForLocking).toHaveBeenCalledWith(period);
    expect(update).not.toHaveBeenCalled();
  });

  it('kilitleme: claim 0 satır etkilerse eşzamanlılık hatası atar', async () => {
    const period = openPeriod();
    const { repo } = buildRepo(period, /* claimed */ false);
    const handler = new LockPeriodHandler(repo, txManager, policyFactory);

    await expect(
      handler.execute(new LockPeriodCommand(period.id.value, ctx))
    ).rejects.toBeInstanceOf(PeriodConcurrentTransitionException);
  });

  it('yeniden açma: kilitli dönemde çalışır, claim 0 satırda hata atar', async () => {
    const period = openPeriod();
    period.lock({ actorId: 'manager-1' });
    const { repo, claimForReopening } = buildRepo(period, /* claimed */ false);
    const handler = new ReopenPeriodHandler(repo, txManager, policyFactory);

    await expect(
      handler.execute(new ReopenPeriodCommand(period.id.value, ctx))
    ).rejects.toBeInstanceOf(PeriodConcurrentTransitionException);

    // Entity geçişi yapıldı ama DB'ye uygulanmadı → yeniden denenebilir.
    expect(period.status).toBe(OPEN);
    expect(claimForReopening).toHaveBeenCalled();
  });

  it('dönem yoksa 404', async () => {
    const { repo } = buildRepo(null);
    const handler = new LockPeriodHandler(repo, txManager, policyFactory);

    await expect(
      handler.execute(new LockPeriodCommand(UUID.generate().value, ctx))
    ).rejects.toBeInstanceOf(PeriodNotFoundException);
  });
});
