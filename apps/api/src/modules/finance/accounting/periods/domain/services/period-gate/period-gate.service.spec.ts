/*
 * Jest taklitleri senkron gövde taşır ve mock metodları `this` bağlamından ayrı
 * okunur (`jest.mocked(x.y).mock.calls`). İki kural YALNIZ bu dosyada kapatılır;
 * üretim kodunda açık kalır.
 */
/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { PeriodGateService } from './period-gate.service';
import { AccountingPeriod } from '@modules/finance/accounting/periods/domain/entities/accounting-period.entity';
import { PeriodSealedForDateException } from '@modules/finance/accounting/periods/domain/exceptions/period.exceptions';
import { AccountingPeriodStatusType } from '@input-type-schemas/AccountingPeriodStatusSchema';
import { IAccountingPeriodCommandRepository } from '@modules/finance/accounting/periods/domain/repositories/accounting-period/accounting-period.command.repository';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

const CLINIC_ID = '11111111-1111-4111-8111-111111111111';

const periodOf = (status: AccountingPeriodStatusType) =>
  new AccountingPeriod({
    id: '22222222-2222-4222-8222-222222222222',
    clinicId: CLINIC_ID,
    organizationId: '33333333-3333-4333-8333-333333333333',
    year: 2025,
    startsAt: DateTimeManager.startOfYear(2025),
    endsAt: DateTimeManager.endOfYear(2025),
    status,
    lastEntryNo: BigInt(0),
    closedAt: null,
    closedById: null,
    lockedAt: null,
    lockedById: null,
    reopenedAt: null,
    reopenedById: null,
    createdAt: DateTimeManager.create(),
    updatedAt: DateTimeManager.create(),
  } as never);

const build = (period: AccountingPeriod | null) => {
  const periodCommandRepo = {
    findByDate: jest.fn(async () => period),
  } as unknown as IAccountingPeriodCommandRepository;

  return {
    service: new PeriodGateService(periodCommandRepo),
    periodCommandRepo,
  };
};

const date = new Date('2025-06-15T10:00:00.000Z');

describe('PeriodGateService', () => {
  it('dönem OPEN ise belge kabul edilir', async () => {
    const { service } = build(periodOf('OPEN'));

    await expect(
      service.assertPeriodNotSealedAt({ clinicId: CLINIC_ID, date })
    ).resolves.toBeUndefined();
  });

  it.each(['LOCKED', 'CLOSED'] as const)(
    '%s dönem mühürlüdür: belge kapıda reddedilir',
    async (status) => {
      // Kabul edilse ekonomik olay yazılır ama fişi hiç üretilemez; olay
      // append-only olduğu için tarih sonradan düzeltilemez.
      const { service } = build(periodOf(status));

      await expect(
        service.assertPeriodNotSealedAt({ clinicId: CLINIC_ID, date })
      ).rejects.toBeInstanceOf(PeriodSealedForDateException);
    }
  );

  it('hata, kullanıcıya hangi yılın hangi durumda olduğunu söyler', async () => {
    const { service } = build(periodOf('CLOSED'));

    await service
      .assertPeriodNotSealedAt({ clinicId: CLINIC_ID, date })
      .catch((error: PeriodSealedForDateException) => {
        expect(error.meta).toEqual({
          clinicId: CLINIC_ID,
          date: date.toISOString(),
          year: 2025,
          currentStatus: 'CLOSED',
        });
      });
  });

  it('dönem hiç yoksa kapı geçirir — muhasebesi kurulmamış şube bloke edilmez', async () => {
    // Bilinçli: bu kapının işi kullanıcının düzeltebileceği tek hatayı (tarihi
    // mühürlenmiş döneme düşürmek) söylemek. Dönemi olmayan klinikte fiş
    // üretilemeyişi `sweep-unposted-financial-events` uyarısıyla görünür.
    const { service } = build(null);

    await expect(
      service.assertPeriodNotSealedAt({ clinicId: CLINIC_ID, date })
    ).resolves.toBeUndefined();
  });

  it('okuma Command Repo’dan ve belgenin kendi tarihiyle yapılır', async () => {
    const { service, periodCommandRepo } = build(periodOf('OPEN'));

    await service.assertPeriodNotSealedAt({ clinicId: CLINIC_ID, date });

    expect(periodCommandRepo.findByDate).toHaveBeenCalledWith(CLINIC_ID, date);
  });
});
