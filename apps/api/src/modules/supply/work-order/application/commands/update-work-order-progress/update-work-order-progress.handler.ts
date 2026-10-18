import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateWorkOrderProgressCommand } from './update-work-order-progress.command';
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
import type { WorkOrderProgressStage } from '@shared/modules/work-order/schemas';

/**
 * Tedarikçideki ara ilerleme (üretimde / provada / hazır). Hangi geçişin geçerli
 * olduğunu entity doğrular; handler yalnız hedef adımı ilgili domain metoduna çevirir.
 */
@CommandHandler(UpdateWorkOrderProgressCommand)
export class UpdateWorkOrderProgressHandler implements ICommandHandler<
  UpdateWorkOrderProgressCommand,
  void
> {
  private readonly transitions: Record<
    WorkOrderProgressStage,
    (workOrder: ExternalWorkOrder) => void
  > = {
    IN_PROGRESS: (workOrder) => workOrder.markInProgress(),
    TRY_IN: (workOrder) => workOrder.markTryIn(),
    READY: (workOrder) => workOrder.markReady(),
  };

  constructor(
    @Inject(EXTERNAL_WORK_ORDER_COMMAND_REPOSITORY)
    private readonly workOrderRepo: IExternalWorkOrderCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: UpdateWorkOrderProgressCommand): Promise<void> {
    const { workOrderId, data, ctx } = command.payload;

    await this.txManager.run(async () => {
      const workOrder = await this.workOrderRepo.findByIdForUpdate(workOrderId);
      if (!workOrder) throw new WorkOrderNotFoundException(workOrderId);

      this.policyFactory
        .workOrder(ctx.actor, ctx.source)
        .evaluator.check((p) =>
          p.canAccessClinicWorkOrders(workOrder.clinicId.value)
        )
        .orThrow('work-order.progress');

      this.transitions[data.stage](workOrder);
      await this.workOrderRepo.update(workOrder);
    });
  }
}
