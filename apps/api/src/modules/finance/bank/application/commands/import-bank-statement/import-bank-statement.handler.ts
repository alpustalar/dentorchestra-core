import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BankAccountStatusSchema } from '@input-type-schemas/BankAccountStatusSchema';
import { ImportBankStatementCommand } from './import-bank-statement.command';
import {
  BANK_STATEMENT_COMMAND_REPOSITORY,
  IBankStatementCommandRepository,
} from '@modules/finance/bank/domain/repositories/bank-statement/bank-statement.repository';
import { BankStatement } from '@modules/finance/bank/domain/entities/bank-statement.entity';
import {
  BankAccountArchivedException,
  BankAccountNotFoundException,
} from '@modules/finance/bank/domain/exceptions/bank.exceptions';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  BANK_ACCOUNT_COMMAND_REPOSITORY,
  IBankAccountCommandRepository,
} from '@modules/finance/bank/domain/repositories/bank-account/bank-account.command.repository';

@CommandHandler(ImportBankStatementCommand)
export class ImportBankStatementHandler implements ICommandHandler<
  ImportBankStatementCommand,
  string
> {
  constructor(
    // Hesabın varlığı/arşiv durumu ekstre yazılıp yazılmayacağını belirliyor →
    // Command Context.
    @Inject(BANK_ACCOUNT_COMMAND_REPOSITORY)
    private readonly bankAccountRepo: IBankAccountCommandRepository,
    @Inject(BANK_STATEMENT_COMMAND_REPOSITORY)
    private readonly bankStatementRepo: IBankStatementCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: ImportBankStatementCommand): Promise<string> {
    const { data, ctx } = command;

    const account = await this.bankAccountRepo.findById(data.bankAccountId);
    if (!account) {
      throw new BankAccountNotFoundException(data.bankAccountId);
    }

    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.canAccessClinicFinances(account.clinicId.value))
      .orThrow('bank-statement.import');

    if (account.status === BankAccountStatusSchema.enum.ARCHIVED) {
      throw new BankAccountArchivedException(account.id.value);
    }

    const statement = BankStatement.create({
      bankAccountId: account.id.value,
      clinicId: account.clinicId.value,
      organizationId: account.organizationId.value,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      openingBalance: data.openingBalance,
      closingBalance: data.closingBalance,
      fileName: data.fileName,
      importedById: ctx.actor.userId,
      lines: data.lines,
    });

    return this.txManager.run(async () => {
      const saved = await this.bankStatementRepo.create(statement);
      return saved.id.value;
    });
  }
}
