import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { ScanOverdueWorkOrdersCommand } from './scan-overdue-work-orders.command';
import {
  EXTERNAL_WORK_ORDER_COMMAND_REPOSITORY,
  IExternalWorkOrderCommandRepository,
} from '@modules/supply/work-order/domain/repositories/external-work/external-work-order.command.repository';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';

/** Tek taramada işlenecek azami iş emri (parti boyutu). */
const OVERDUE_SCAN_BATCH_LIMIT = 500;

/**
 * Termini geçmiş, henüz teslim alınmamış ve daha önce bildirilmemiş iş emirlerini
 * tarar; her biri için `markOverdueNotified()` çağırıp kaydeder — bu hem `overdueNotifiedAt`
 * damgasını atar (aynı iş emri tekrar bildirilmez) hem gecikme event'ini fırlatır.
 * Sonuç mutasyona beslendiği için okuma Command repo'dan yapılır (CQRS).
 */
@CommandHandler(ScanOverdueWorkOrdersCommand)
export class ScanOverdueWorkOrdersHandler implements ICommandHandler<
  ScanOverdueWorkOrdersCommand,
  void
> {
  private readonly logger = new Logger(ScanOverdueWorkOrdersHandler.name);

  constructor(
    @Inject(EXTERNAL_WORK_ORDER_COMMAND_REPOSITORY)
    private readonly workOrderRepo: IExternalWorkOrderCommandRepository,
    private readonly txManager: TransactionManager
  ) {}

  async execute(): Promise<void> {
    const now = DateTimeManager.create();

    const overdue = await this.workOrderRepo.findOverdueForNotification(
      now,
      OVERDUE_SCAN_BATCH_LIMIT
    );

    if (overdue.length === 0) return;

    for (const workOrder of overdue) {
      // Her iş emri kendi transaction'ında işlenir: biri patlarsa diğerleri bildirilir.
      try {
        await this.txManager.run(async () => {
          workOrder.markOverdueNotified(now);
          await this.workOrderRepo.update(workOrder);
        });
      } catch (error) {
        this.logger.error(
          `Gecikme bildirimi işlenemedi (workOrderId=${workOrder.id.value}): ${error}`
        );
      }
    }

    this.logger.log(
      `${overdue.length} gecikmiş iş emri için bildirim üretildi`
    );
  }
}
