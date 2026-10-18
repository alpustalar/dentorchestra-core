import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateCashRegisterCommand } from './create-cash-register.command';
import { CashRegister } from '@modules/finance/cash-register/domain/entities/cash-register.entity';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { CASH_REGISTER_EVENTS } from '@src/domain/constants/events/cash-register.constant';
import {
  CASH_REGISTER_COMMAND_REPOSITORY,
  ICashRegisterCommandRepository,
} from '@modules/finance/cash-register/domain/repositories/cash-register/cash-register.command.repository';
import { TENANT_SCOPE_RESOLVER } from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import { ITenantScopeResolver } from '@shared';

@CommandHandler(CreateCashRegisterCommand)
export class CreateCashRegisterHandler implements ICommandHandler<
  CreateCashRegisterCommand,
  string
> {
  constructor(
    @Inject(CASH_REGISTER_COMMAND_REPOSITORY)
    private readonly cashRegisterRepo: ICashRegisterCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: CreateCashRegisterCommand): Promise<string> {
    const { data, ctx } = command;
    const { actor } = ctx;

    const organizationId = await this.tenantScopeResolver.resolve(data);

    this.policyFactory
      .finance(actor, ctx.source)
      .evaluator.check((p) => p.canAccessClinicFinances(data.clinicId))
      .orThrow(CASH_REGISTER_EVENTS.CREATED);

    const register = CashRegister.create({
      clinicId: data.clinicId,
      organizationId,
      name: data.name,
      currency: data.currency,
    });

    return this.txManager.run(async () => {
      const saved = await this.cashRegisterRepo.create(register);
      return saved.id.value;
    });
  }
}
