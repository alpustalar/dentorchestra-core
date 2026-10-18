import { Injectable, Logger } from '@nestjs/common';
import { WORK_ORDER_EVENTS } from '@src/domain/constants/events';
import { WorkOrderOverdueEvent } from '@modules/supply/work-order/domain/events/work-order-overdue.event';
import { NotificationDispatcherService } from '@modules/platform/notification/application/services/notification-dispatcher.service';
import { OnDomainEvent } from '@common/decorators';

/**
 * Dış iş emri termini geçtiğinde personele panel-içi bildirim üretir. Cross-module
 * event aboneliği — `supply/work-order` tarama komutunun fırlattığı
 * {@link WorkOrderOverdueEvent}'i dinler. Hata ana akışı bozmaz, yalnız loglanır.
 */
@Injectable()
export class WorkOrderOverdueNotificationListener {
  private readonly logger = new Logger(
    WorkOrderOverdueNotificationListener.name
  );

  constructor(private readonly dispatcher: NotificationDispatcherService) {}

  @OnDomainEvent(WORK_ORDER_EVENTS.OVERDUE)
  async handle(event: WorkOrderOverdueEvent): Promise<void> {
    try {
      await this.dispatcher.notifyWorkOrderOverdue({
        workOrderId: event.workOrderId,
        clinicId: event.clinicId,
        dueDate: event.dueDate,
        daysOverdue: event.daysOverdue,
      });
    } catch (error) {
      this.logger.error(
        `İş emri gecikme bildirimi işlenemedi (workOrderId=${event.workOrderId}): ${error}`
      );
    }
  }
}
