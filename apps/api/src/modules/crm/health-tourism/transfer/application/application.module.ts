import { Module } from '@nestjs/common';
import { TransferCommandModule } from '@modules/crm/health-tourism/transfer/application/commands/command.module';
import { TransferQueryModule } from '@modules/crm/health-tourism/transfer/application/queries/query.module';
import { TransferAiToolsModule } from '@modules/crm/health-tourism/transfer/application/ai-tools/transfer-ai-tools.module';

const ApplicationModules = [
  TransferCommandModule,
  TransferQueryModule,
  TransferAiToolsModule,
];

@Module({
  imports: [...ApplicationModules],
  exports: [...ApplicationModules],
})
export class TransferApplicationModule {}
