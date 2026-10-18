import { Module } from '@nestjs/common';
import { BankPresentationModule } from './presentation/presentation.module';
import { BankCommandModule } from '@modules/finance/bank/application/commands/command.module';
import { BankQueryModule } from '@modules/finance/bank/application/queries/query.module';

@Module({
  imports: [BankPresentationModule, BankCommandModule, BankQueryModule],
})
export class BankModule {}
