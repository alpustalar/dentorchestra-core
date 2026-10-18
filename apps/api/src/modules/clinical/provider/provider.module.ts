import { Module } from '@nestjs/common';
import { ProviderPresentationModule } from '@modules/clinical/provider/presentation/provider-presentation.module';
import { ProviderAiToolsModule } from '@modules/clinical/provider/application/ai-tools/provider-ai-tools.module';
import { ProviderCommandsModule } from '@modules/clinical/provider/application/commands/commands.module';
import { ProviderQueriesModule } from '@modules/clinical/provider/application/queries/queries.module';

@Module({
  imports: [
    ProviderPresentationModule,
    ProviderAiToolsModule,
    ProviderCommandsModule,
    ProviderQueriesModule,
  ],
})
export class ProviderModule {}
