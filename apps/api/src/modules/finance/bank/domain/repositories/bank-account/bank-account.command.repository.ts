import { IBaseCommandRepository } from '@common/domain/repositories/base-command-repository.interface';
import { BankAccount } from '@modules/finance/bank/domain/entities/bank-account.entity';

export const BANK_ACCOUNT_COMMAND_REPOSITORY = Symbol(
  'IBankAccountCommandRepository'
);

export type IBankAccountCommandRepository = IBaseCommandRepository<BankAccount>;
