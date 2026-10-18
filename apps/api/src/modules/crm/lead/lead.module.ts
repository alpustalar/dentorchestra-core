import { Module } from '@nestjs/common';
import { LeadPresentationModule } from './presentation/presentation.module';
import { LeadAiToolsModule } from '@modules/crm/lead/application/ai-tools/lead-ai-tools.module';
import { LeadCommandModule } from '@modules/crm/lead/application/commands/command.module';
import { LeadQueryModule } from '@modules/crm/lead/application/queries/query.module';
import { LeadEventModule } from '@modules/crm/lead/infrastructure/messaging/events/lead-event.module';

@Module({
  imports: [
    LeadPresentationModule,
    LeadAiToolsModule,
    LeadCommandModule,
    LeadQueryModule,
    LeadEventModule,
  ],
})
export class LeadModule {}
