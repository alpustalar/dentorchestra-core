import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateBankAccountCommand } from './create-bank-account.command';
import { BankAccount } from '@modules/finance/bank/domain/entities/bank-account.entity';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  BANK_ACCOUNT_COMMAND_REPOSITORY,
  IBankAccountCommandRepository,
} from '@modules/finance/bank/domain/repositories/bank-account/bank-account.command.repository';
import {
  ITenantScopeResolver,
  TENANT_SCOPE_RESOLVER,
} from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';

@CommandHandler(CreateBankAccountCommand)
export class CreateBankAccountHandler implements ICommandHandler<
  CreateBankAccountCommand,
  string
> {
  constructor(
    @Inject(BANK_ACCOUNT_COMMAND_REPOSITORY)
    private readonly bankAccountRepo: IBankAccountCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: CreateBankAccountCommand): Promise<string> {
    const { data, ctx } = command;
    const { actor } = ctx;

    const organizationId = await this.tenantScopeResolver.resolve(data);

    this.policyFactory
      .finance(actor, ctx.source)
      .evaluator.check((p) => p.canAccessClinicFinances(data.clinicId))
      .orThrow('bank-account.create');

    const account = BankAccount.create({
      clinicId: data.clinicId,
      organizationId,
      name: data.name,
      bankName: data.bankName,
      iban: data.iban,
      accountNo: data.accountNo,
      currency: data.currency,
      openingBalance: data.openingBalance,
    });

    return this.txManager.run(async () => {
      const saved = await this.bankAccountRepo.create(account);
      return saved.id.value;
    });
  }
}
