import { Model } from 'mongoose';
import { AuditLogService } from './audit-log.service';
import { AuditLogWriteFailedException } from './audit-log.exceptions';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import type { CriticalFailurePayload } from '@common/observability/critical-failure.event';
import { AuditLog } from './schemas/audit-log.schema';
import {
  LogAction,
  LogSource,
  LogType,
} from '@src/domain/constants/log-action.constant';

/**
 * Denetim izinin yazma yolunun **kendi** güvencesi.
 *
 * Eskiden `record()` her depolama hatasını yutuyordu: tek iz bir `logger.error`
 * satırıydı, uyarı yoktu ve hata çağırana hiç ulaşmıyordu. İki sonucu vardı —
 * (1) "deneme loglandı" ifadesi doğru değildi (güvenlik kayıtlarının yarısı bu
 * yoldan geçiyor), (2) 20'den fazla dinleyicinin `catch` bloğu hiç
 * tetiklenemiyordu: yutma kararını servis herkes adına veriyordu (§77 — hatayı
 * kimin yutacağına çağıran karar verir).
 */
describe('AuditLogService — iz kaybı sessiz değildir', () => {
  const build = (createImpl: jest.Mock) => {
    const published: CriticalFailurePayload[] = [];
    const criticalFailure = {
      publish: (payload: CriticalFailurePayload) => {
        published.push(payload);
      },
    } as unknown as CriticalFailurePublisher;

    const model = { create: createImpl } as unknown as Model<AuditLog>;

    return {
      service: new AuditLogService(model, criticalFailure),
      published,
      create: createImpl,
    };
  };

  const payload = (type: LogType = LogType.INFO) => ({
    action: LogAction.POS_TRANSACTION_REVERSED,
    details: { posTransactionId: 'tx-1' },
    actorId: 'aB3xY9zQ7wE1rT5yU8iO2pL4kJ6h',
    source: LogSource.WEB,
    type,
  });

  it('yazma başarılıysa uyarı çıkmaz, hata fırlatılmaz', async () => {
    const { service, published, create } = build(
      jest.fn().mockResolvedValue({})
    );

    await service.record(payload());

    expect(create).toHaveBeenCalledTimes(1);
    expect(published).toEqual([]);
  });

  it('yazma başarısızsa çağırana tipli hata ulaşır', async () => {
    const { service } = build(
      jest.fn().mockRejectedValue(new Error('connection timed out'))
    );

    await expect(service.record(payload())).rejects.toBeInstanceOf(
      AuditLogWriteFailedException
    );
  });

  it('bilgi kaydının kaybı WARNING, eylem bazlı dedupe anahtarı taşır', async () => {
    const { service, published } = build(
      jest.fn().mockRejectedValue(new Error('connection timed out'))
    );

    await expect(service.info(payload())).rejects.toBeInstanceOf(
      AuditLogWriteFailedException
    );

    expect(published).toHaveLength(1);
    expect(published[0].severity).toBe('WARNING');
    expect(published[0].operation).toBe('platform.audit-log.record');
    expect(published[0].dedupeKey).toBe(
      'audit-log-write-failed:INFO:POS_TRANSACTION_REVERSED'
    );
    expect(published[0].errorMessage).toBe('connection timed out');
    expect(published[0].context.actorId).toBe('aB3xY9zQ7wE1rT5yU8iO2pL4kJ6h');
  });

  it('güvenlik kaydının kaybı CRITICAL', async () => {
    // Yetkisiz erişim denemesinin izi yoksa olay sonradan soruşturulamaz.
    const { service, published } = build(
      jest.fn().mockRejectedValue(new Error('mongo down'))
    );

    await expect(service.security(payload())).rejects.toBeInstanceOf(
      AuditLogWriteFailedException
    );

    expect(published[0].severity).toBe('CRITICAL');
    expect(published[0].dedupeKey).toBe(
      'audit-log-write-failed:SECURITY:POS_TRANSACTION_REVERSED'
    );
  });

  it('hata ve kritik kayıtların kaybı da CRITICAL', async () => {
    for (const type of [LogType.ERROR, LogType.CRITICAL]) {
      const { service, published } = build(
        jest.fn().mockRejectedValue(new Error('mongo down'))
      );

      await expect(service.record(payload(type))).rejects.toBeInstanceOf(
        AuditLogWriteFailedException
      );

      expect(published[0].severity).toBe('CRITICAL');
    }
  });
});
