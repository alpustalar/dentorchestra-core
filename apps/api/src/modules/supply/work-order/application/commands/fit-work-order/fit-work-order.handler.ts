import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { FitWorkOrderCommand } from './fit-work-order.command';
import {
  EXTERNAL_WORK_ORDER_COMMAND_REPOSITORY,
  IExternalWorkOrderCommandRepository,
} from '@modules/supply/work-order/domain/repositories/external-work/external-work-order.command.repository';
import { WorkOrderNotFoundException } from '@modules/supply/work-order/domain/exceptions/work-order.exceptions';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@CommandHandler(FitWorkOrderCommand)
export class FitWorkOrderHandler implements ICommandHandler<
  FitWorkOrderCommand,
  void
> {
  constructor(
    @Inject(EXTERNAL_WORK_ORDER_COMMAND_REPOSITORY)
    private readonly workOrderRepo: IExternalWorkOrderCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: FitWorkOrderCommand): Promise<void> {
    const { workOrderId, data, ctx } = command.payload;

    await this.txManager.run(async () => {
      const workOrder = await this.workOrderRepo.findByIdForUpdate(workOrderId);
      if (!workOrder) throw new WorkOrderNotFoundException(workOrderId);

      this.policyFactory
        .workOrder(ctx.actor, ctx.source)
        .evaluator.check((p) =>
          p.canAccessClinicWorkOrders(workOrder.clinicId.value)
        )
        .orThrow('work-order.fit');

      workOrder.fit(data.appointmentId);
      await this.workOrderRepo.update(workOrder);
    });
  }
}
