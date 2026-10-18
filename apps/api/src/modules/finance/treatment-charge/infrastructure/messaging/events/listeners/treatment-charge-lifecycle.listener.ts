import { Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '@modules/platform/audit-log/audit-log.service';
import { LogType } from '@src/domain/constants/log-action.constant';
import {
  TreatmentChargeAddedEvent,
  TreatmentChargeDiscountUpdatedEvent,
  TreatmentChargeVoidedEvent,
} from '@modules/finance/treatment-charge/domain/events/treatment-charge.events';
import { OnDomainEvent } from '@common/decorators';

/**
 * İşlem satırının denetim izi: ekleme, indirim değişikliği ve iptal.
 *
 * Satır faturanın ticari dayanağıdır; indirim geçmişi (%40 → %0 → %45) kayıtta
 * tutulmuyor (yalnız güncel oran) ve iptalin gerekçesi `voidReason`'da dururken
 * "kim" bilgisi hiç yoktu. Bu dinleyici indirim ve iptal kararlarının kim/ne
 * zaman izini kalıcı hâle getirir.
 */
@Injectable()
export class TreatmentChargeLifecycleListener {
  private readonly logger = new Logger(TreatmentChargeLifecycleListener.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  @OnDomainEvent(TreatmentChargeAddedEvent.NAME)
  async handleAdded(event: TreatmentChargeAddedEvent): Promise<void> {
    await this.write(event, {
      chargeId: event.chargeId,
      clinicId: event.clinicId,
      appointmentId: event.appointmentId,
      patientId: event.patientId,
      treatmentId: event.treatmentId,
      grossAmount: event.grossAmount,
      currency: event.currency,
      discountRate: event.discountRate,
    });
  }

  @OnDomainEvent(TreatmentChargeDiscountUpdatedEvent.NAME)
  async handleDiscountUpdated(
    event: TreatmentChargeDiscountUpdatedEvent
  ): Promise<void> {
    await this.write(event, {
      chargeId: event.chargeId,
      clinicId: event.clinicId,
      appointmentId: event.appointmentId,
      patientId: event.patientId,
      previousDiscountRate: event.previousDiscountRate,
      discountRate: event.discountRate,
      grossAmount: event.grossAmount,
      currency: event.currency,
      // Tavanı aşan indirim yönetici onayıyla geçmiştir; izi burada da durur.
      exceededLimit: event.exceededLimit,
    });
  }

  @OnDomainEvent(TreatmentChargeVoidedEvent.NAME)
  async handleVoided(event: TreatmentChargeVoidedEvent): Promise<void> {
    await this.write(event, {
      chargeId: event.chargeId,
      clinicId: event.clinicId,
      appointmentId: event.appointmentId,
      patientId: event.patientId,
      reason: event.reason,
      grossAmount: event.grossAmount,
      currency: event.currency,
    });
  }

  private async write(
    event:
      | TreatmentChargeAddedEvent
      | TreatmentChargeDiscountUpdatedEvent
      | TreatmentChargeVoidedEvent,
    details: Record<string, unknown>
  ): Promise<void> {
    const { log, metadata } = event;

    try {
      if (!log) return;
      const { action, source, actorId, type, details: note } = log;

      const logInput = {
        action,
        source,
        actorId,
        details: { ...details, note },
        metadata: {
          eventId: metadata.eventId,
          correlationId: metadata.correlationId,
        },
      };

      if (type === LogType.ERROR) {
        await this.auditLogService.error(logInput);
        return;
      }
      await this.auditLogService.info(logInput);
    } catch (err) {
      // Audit yazımı satırı geri almaz; yalnız iz kaybını raporlar.
      this.logger.error('İşlem satırı audit log hatası', err);
    }
  }
}
