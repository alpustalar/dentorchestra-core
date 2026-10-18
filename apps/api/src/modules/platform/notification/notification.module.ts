import { Module } from '@nestjs/common';
import { NotificationPresentationModule } from './presentation/presentation.module';
import { NotificationCommandModule } from '@modules/platform/notification/application/commands/command.module';
import { NotificationQueryModule } from '@modules/platform/notification/application/queries/query.module';

@Module({
  imports: [
    NotificationPresentationModule,
    NotificationCommandModule,
    NotificationQueryModule,
  ],
})
export class NotificationModule {}
