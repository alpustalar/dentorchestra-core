import { Inject, Injectable, Logger } from '@nestjs/common';
import { CriticalFailureEvent } from '@common/observability/critical-failure.event';
import {
  OPS_ALERT_PORT,
  OpsAlertPort,
} from '@common/observability/ops-alert.port';
import { OnDomainEvent } from '@common/decorators';

/**
 * Kritik hatayı operasyonel uyarı kanalına iletir (Slack bağlanacak).
 *
 * Dinleyici de yutar: uyarı kanalı erişilemezse bu, uyarıya sebep olan hatayı
 * büyütmemeli. Kanal hatası yalnız loglanır.
 */
@Injectable()
export class CriticalFailureListener {
  private readonly logger = new Logger(CriticalFailureListener.name);

  constructor(
    @Inject(OPS_ALERT_PORT) private readonly opsAlert: OpsAlertPort
  ) {}

  @OnDomainEvent(CriticalFailureEvent.NAME)
  async handle(event: CriticalFailureEvent): Promise<void> {
    try {
      await this.opsAlert.alert(event.toAlertInput());
    } catch (error) {
      this.logger.error(
        `Operasyonel uyarı gönderilemedi: ${event.operation}`,
        error
      );
    }
  }
}
