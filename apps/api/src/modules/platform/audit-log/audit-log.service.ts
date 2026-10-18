import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog } from './schemas/audit-log.schema';
import { LogSource, LogType } from '@src/domain/constants/log-action.constant';
import { IAuditLog } from '@common/interfaces/audit-log.interface';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { AuditLogWriteFailedException } from '@modules/platform/audit-log/audit-log.exceptions';

export type AuditLogOptions = Omit<IAuditLog, 'type'>;

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLog>,
    private readonly criticalFailure: CriticalFailurePublisher
  ) {}

  /**
   * Ana Kayıt Metodu
   * Tüm yardımcı metotlar burayı besler.
   */
  async record(payload: IAuditLog): Promise<void> {
    try {
      await this.auditLogModel.create({
        action: payload.action,
        source: payload.source ?? LogSource.SYSTEM,
        details: payload.details,
        actorId: payload.actorId,
        type: payload.type,
      });
    } catch (error) {
      // Denetim izi, yüksek etkili işlemlerin **kalıcı damgasıdır** (CLAUDE.md
      // finans kuralı 7): storno kim attı, kilitli dönemi kim açtı, kart
      // iadesini kim başlattı. Yazılamadığında iki şey YAPILMAZ:
      //
      //  1. Sessiz kalınmaz — eskiden tek iz bir `logger.error` satırıydı;
      //     "attempt loglandı" ifadesi doğru değildi (güvenlik kayıtlarının
      //     yarısı bu yoldan geçiyor). Artık operasyonel uyarı çıkar.
      //  2. Hata yutulmaz — yutma kararı **çağırana** aittir (§77). Servis
      //     herkes adına yuttuğu için 20'den fazla dinleyicinin `catch` bloğu
      //     hiç tetiklenemiyordu: niyetleri koda yazılmış ama etkisizdi.
      //     Outbox'tan beslenen bir dinleyici artık yeniden denenebilir.
      this.alertWriteFailure(payload, error);

      throw new AuditLogWriteFailedException(payload.action, payload.type);
    }
  }

  /**
   * İz kaybını operasyonel kanala taşır.
   *
   * Güvenlik ve kritik kayıtların kaybı **CRITICAL**: yetkisiz erişim denemesi,
   * storno, dönem açma gibi olayların izi yoksa sonradan soruşturulamaz.
   * Bilgi kayıtları WARNING. `dedupeKey` eylem bazlı: depolama tamamen
   * düştüğünde her işlem için ayrı mesaj değil, eylem başına tek mesaj gider
   * (10 dk pencere) — uyarı fırtınası izlemeyi işe yaramaz hale getirir.
   */
  private alertWriteFailure(payload: IAuditLog, error: unknown): void {
    const isHighImpact =
      payload.type === LogType.SECURITY ||
      payload.type === LogType.CRITICAL ||
      payload.type === LogType.ERROR;

    this.criticalFailure.publish({
      operation: 'platform.audit-log.record',
      severity: isHighImpact ? 'CRITICAL' : 'WARNING',
      summary: `Denetim izi yazılamadı (${payload.action}); işlem yapıldı ama kaydı yok.`,
      errorMessage: error instanceof Error ? error.message : String(error),
      context: {
        action: payload.action,
        type: payload.type,
        source: payload.source ?? LogSource.SYSTEM,
        actorId: payload.actorId ?? null,
      },
      clinicId: null,
      dedupeKey: `audit-log-write-failed:${payload.type}:${payload.action}`,
    });

    this.logger.error(
      `Audit Log Failure: ${payload.action} could not be saved!`,
      error instanceof Error ? error.stack : error
    );
  }

  // --- Yardımcı Kısayollar ---

  async info({
    action,
    details,
    actorId,
    source,
    metadata,
  }: AuditLogOptions): Promise<void> {
    return this.record({
      action,
      details,
      actorId,
      type: LogType.INFO,
      source,
      metadata,
    });
  }

  async warn({
    action,
    details,
    actorId,
    source,
    metadata,
  }: AuditLogOptions): Promise<void> {
    return this.record({
      action,
      details,
      actorId,
      type: LogType.WARNING,
      source,
      metadata,
    });
  }

  async error({
    action,
    details,
    actorId,
    source,
    metadata,
  }: AuditLogOptions): Promise<void> {
    return this.record({
      action,
      details,
      actorId,
      type: LogType.ERROR,
      source,
      metadata,
    });
  }

  async critical({
    action,
    details,
    actorId,
    source,
    metadata,
  }: AuditLogOptions): Promise<void> {
    return this.record({
      action,
      details,
      actorId,
      type: LogType.CRITICAL,
      source,
      metadata,
    });
  }

  async security({
    action,
    details,
    actorId,
    source,
    metadata,
  }: AuditLogOptions): Promise<void> {
    return this.record({
      action,
      details,
      actorId,
      type: LogType.SECURITY,
      source,
      metadata,
    });
  }
}
