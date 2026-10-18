import { Module } from '@nestjs/common';
import { ActivityPresentationModule } from './presentation/activity.presentation.module';
import { ActivityCommandModule } from '@modules/crm/activity/application/commands/command.module';
import { ActivityQueryModule } from '@modules/crm/activity/application/queries/query.module';

@Module({
  imports: [
    ActivityPresentationModule,
    ActivityCommandModule,
    ActivityQueryModule,
  ],
})
export class ActivityModule {}
