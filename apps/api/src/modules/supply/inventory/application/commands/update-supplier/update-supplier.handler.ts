import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateSupplierCommand } from './update-supplier.command';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { SupplierNotFoundException } from '@modules/supply/inventory/domain/exceptions/inventory.exceptions';
import {
  ISupplierCommandRepository,
  SUPPLIER_COMMAND_REPOSITORY,
} from '@modules/supply/inventory/domain/repositories/supplier/supplier.command.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@CommandHandler(UpdateSupplierCommand)
export class UpdateSupplierHandler implements ICommandHandler<
  UpdateSupplierCommand,
  void
> {
  constructor(
    @Inject(SUPPLIER_COMMAND_REPOSITORY)
    private readonly supplierRepo: ISupplierCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: UpdateSupplierCommand): Promise<void> {
    const { supplierId, dto, ctx } = command;

    if (!supplierId) throw new SupplierNotFoundException(supplierId);

    const supplier = await this.supplierRepo.findById(supplierId);

    if (!supplier) throw new SupplierNotFoundException(supplierId);

    this.policyFactory
      .clinic(ctx.actor, ctx.source)
      .evaluator.check((p) =>
        p.actorCanAccessTargetClinic(supplier.clinicId.value)
      )
      .orThrow();

    supplier.update(dto);

    await this.txManager.run(async () => {
      await this.supplierRepo.update(supplier);
    });
  }
}
