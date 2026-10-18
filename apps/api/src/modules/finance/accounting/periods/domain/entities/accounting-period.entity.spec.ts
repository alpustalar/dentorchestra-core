import { AccountingPeriodStatusSchema } from '@shared';
import { AccountingPeriod } from './accounting-period.entity';
import {
  InvalidPeriodLockException,
  InvalidPeriodReopenException,
  InvalidPeriodYearException,
  PeriodAlreadyClosedException,
} from '@modules/finance/accounting/periods/domain/exceptions/period.exceptions';
import {
  AccountingPeriodClosedEvent,
  AccountingPeriodLockedEvent,
  AccountingPeriodOpenedEvent,
  AccountingPeriodReopenedEvent,
} from '@modules/finance/accounting/periods/domain/events';
import { UUID } from '@src/domain/value-objects/uuid.vo';

const { OPEN, LOCKED, CLOSED } = AccountingPeriodStatusSchema.enum;

describe('AccountingPeriod (dönem durum makinesi + denetim damgası)', () => {
  const clinicId = UUID.generate().value;
  const organizationId = UUID.generate().value;
  const actorId = 'user-1';

  const open = () =>
    AccountingPeriod.create({ clinicId, organizationId, year: 2026, actorId });

  const eventNames = (period: AccountingPeriod) =>
    period.getDomainEvents().map((e) => e.constructor.name);

  it('açılışta OPEN olur, sayaç sıfırdan başlar ve olay raise edilir', () => {
    const period = open();

    expect(period.status).toBe(OPEN);
    expect(period.lastEntryNo).toBe(0n);
    expect(period.closedAt).toBeNull();
    expect(period.closedById).toBeNull();
    expect(eventNames(period)).toEqual([AccountingPeriodOpenedEvent.name]);
  });

  it('yıl 2000-2100 dışındaysa dönem açılmaz', () => {
    expect(() =>
      AccountingPeriod.create({
        clinicId,
        organizationId,
        year: 1999,
        actorId,
      })
    ).toThrow(InvalidPeriodYearException);

    expect(() =>
      AccountingPeriod.create({
        clinicId,
        organizationId,
        year: 2026.5,
        actorId,
      })
    ).toThrow(InvalidPeriodYearException);
  });

  it('kilitleme damgayı yazar ve olay raise eder; yalnız OPEN döneme uygulanır', () => {
    const period = open();
    period.clearDomainEvents();

    period.lock({ actorId: 'manager-1' });

    expect(period.status).toBe(LOCKED);
    expect(period.lockedById).toBe('manager-1');
    expect(period.lockedAt).toBeInstanceOf(Date);
    expect(eventNames(period)).toEqual([AccountingPeriodLockedEvent.name]);

    // İkinci kez kilitlenemez (artık OPEN değil).
    expect(() => period.lock({ actorId: 'manager-1' })).toThrow(
      InvalidPeriodLockException
    );
  });

  it('yeniden açma yalnız LOCKED dönemde çalışır ve damgalanır', () => {
    const period = open();

    // OPEN dönem yeniden açılamaz.
    expect(() => period.reopen({ actorId })).toThrow(
      InvalidPeriodReopenException
    );

    period.lock({ actorId });
    period.clearDomainEvents();
    period.reopen({ actorId: 'manager-2' });

    expect(period.status).toBe(OPEN);
    expect(period.reopenedById).toBe('manager-2');
    expect(eventNames(period)).toEqual([AccountingPeriodReopenedEvent.name]);
  });

  it('kapatma damgalar; kapatılmış dönem tekrar kapatılamaz ve yeniden açılamaz', () => {
    const period = open();
    period.clearDomainEvents();

    period.close({ actorId: 'manager-3' });

    expect(period.status).toBe(CLOSED);
    expect(period.closedById).toBe('manager-3');
    expect(period.closedAt).toBeInstanceOf(Date);
    expect(eventNames(period)).toEqual([AccountingPeriodClosedEvent.name]);

    expect(() => period.close({ actorId })).toThrow(
      PeriodAlreadyClosedException
    );
    // Kapanmış dönem "dirilmez": domain reopen'ı reddeder (DB tarafında da
    // claimForReopening koşulu LOCKED olduğu için 0 satır etkilenir).
    expect(() => period.reopen({ actorId })).toThrow(
      InvalidPeriodReopenException
    );
  });

  it('toPersistence saf: aynı entity iki kez yazıldığında updatedAt değişmez', () => {
    const period = open();

    const first = period.toPersistence();
    const second = period.toPersistence();

    expect(second.updatedAt).toEqual(first.updatedAt);
    // Sayaç entity tarafından taşınır ama ilerletilmez (kilit altında DB ilerletir).
    expect(first.lastEntryNo).toBe(0n);
  });
});
