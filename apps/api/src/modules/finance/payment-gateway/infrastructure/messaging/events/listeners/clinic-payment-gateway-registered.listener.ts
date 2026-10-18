import { Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '@modules/platform/audit-log/audit-log.service';
import { ClinicPaymentGatewayRegisteredEvent } from '@modules/finance/payment-gateway/domain/events';
import { OnDomainEvent } from '@common/decorators';

/**
 * Ödeme altyapısı değişikliğinin denetim izi.
 *
 * Yüksek etkili finansal işlem (CLAUDE.md finans kuralı 7): hak edişlerin
 * yatacağı hesabı değiştirir ve kayıtta IBAN tutulmadığı için başka hiçbir
 * yerde izi kalmaz.
 */
@Injectable()
export class ClinicPaymentGatewayRegisteredListener {
  private readonly logger = new Logger(
    ClinicPaymentGatewayRegisteredListener.name
  );

  constructor(private readonly auditLogService: AuditLogService) {}

  @OnDomainEvent(ClinicPaymentGatewayRegisteredEvent.NAME)
  async handle(event: ClinicPaymentGatewayRegisteredEvent): Promise<void> {
    const { log, metadata } = event;

    try {
      if (!log) return;

      await this.auditLogService.info({
        action: log.action,
        source: log.source,
        actorId: log.actorId,
        details: {
          clinicId: event.clinicId,
          subMerchantKey: event.subMerchantKey,
          isNew: event.isNew,
          maskedIban: event.maskedIban,
        },
        metadata: {
          eventId: metadata.eventId,
          correlationId: metadata.correlationId,
        },
      });
    } catch (err) {
      this.logger.error('Ödeme altyapısı audit log hatası', err);
    }
  }
}
