import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OpenRemakeWorkOrderCommand } from './open-remake-work-order.command';
import {
  EXTERNAL_WORK_ORDER_COMMAND_REPOSITORY,
  IExternalWorkOrderCommandRepository,
} from '@modules/supply/work-order/domain/repositories/external-work/external-work-order.command.repository';
import { ExternalWorkOrder } from '@modules/supply/work-order/domain/entities/external-work-order.entity';
import { WorkOrderNotFoundException } from '@modules/supply/work-order/domain/exceptions/work-order.exceptions';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { WORK_ORDER_EVENTS } from '@src/domain/constants/events';

/**
 * Yeniden yapım — kaynak iş emri değişmez; satırları kopyalanmış, `remakeOfId` ile
 * ona bağlı yeni bir DRAFT açılır. Yeni iş emrinin id'si döner.
 */
@CommandHandler(OpenRemakeWorkOrderCommand)
export class OpenRemakeWorkOrderHandler implements ICommandHandler<
  OpenRemakeWorkOrderCommand,
  string
> {
  constructor(
    @Inject(EXTERNAL_WORK_ORDER_COMMAND_REPOSITORY)
    private readonly workOrderRepo: IExternalWorkOrderCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: OpenRemakeWorkOrderCommand): Promise<string> {
    const { workOrderId, data, ctx } = command.payload;

    return this.txManager.run(async () => {
      const source = await this.workOrderRepo.findByIdForUpdate(workOrderId);
      if (!source) throw new WorkOrderNotFoundException(workOrderId);

      this.policyFactory
        .workOrder(ctx.actor, ctx.source)
        .evaluator.check((p) =>
          p.canAccessClinicWorkOrders(source.clinicId.value)
        )
        .orThrow(WORK_ORDER_EVENTS.REMAKE);

      const remake = ExternalWorkOrder.openRemake(source, {
        reason: data.reason,
        dueDate: data.dueDate,
        createdById: ctx.actor.userId,
      });

      const saved = await this.workOrderRepo.create(remake);
      return saved.id.value;
    });
  }
}
