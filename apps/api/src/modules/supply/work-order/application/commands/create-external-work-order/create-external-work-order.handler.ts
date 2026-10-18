import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateExternalWorkOrderCommand } from './create-external-work-order.command';
import {
  EXTERNAL_WORK_ORDER_COMMAND_REPOSITORY,
  IExternalWorkOrderCommandRepository,
} from '@modules/supply/work-order/domain/repositories/external-work/external-work-order.command.repository';
import { ExternalWorkOrder } from '@modules/supply/work-order/domain/entities/external-work-order.entity';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { TENANT_SCOPE_RESOLVER } from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import { ITenantScopeResolver } from '@shared';

@CommandHandler(CreateExternalWorkOrderCommand)
export class CreateExternalWorkOrderHandler implements ICommandHandler<
  CreateExternalWorkOrderCommand,
  string
> {
  constructor(
    @Inject(EXTERNAL_WORK_ORDER_COMMAND_REPOSITORY)
    private readonly workOrderRepo: IExternalWorkOrderCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: CreateExternalWorkOrderCommand): Promise<string> {
    const { data, ctx } = command;
    const { actor } = ctx;

    const organizationId = await this.tenantScopeResolver.resolve(data);

    this.policyFactory
      .workOrder(actor, ctx.source)
      .evaluator.check((p) => p.canAccessClinicWorkOrders(data.clinicId))
      .orThrow('work-order.create');

    const workOrder = ExternalWorkOrder.create({
      clinicId: data.clinicId,
      organizationId,
      supplierId: data.supplierId,
      patientId: data.patientId,
      treatmentId: data.treatmentId,
      providerId: data.providerId,
      referenceNo: data.referenceNo,
      dueDate: data.dueDate,
      agreedCost: data.agreedCost,
      currency: data.currency,
      note: data.note,
      createdById: actor.userId,
      items: data.items,
    });

    return this.txManager.run(async () => {
      const saved = await this.workOrderRepo.create(workOrder);
      return saved.id.value;
    });
  }
}
