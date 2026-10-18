import { Module } from '@nestjs/common';
import { UserPresentationModule } from '@modules/identity/user/presentation/presentation.module';
import { UserCommandModule } from '@modules/identity/user/application/commands/command.module';
import { UserQueryModule } from '@modules/identity/user/application/queries/query.module';
import { UserEventModule } from '@modules/identity/user/infrastructure/messaging/events/user-event.module';

@Module({
  imports: [
    UserPresentationModule,
    UserCommandModule,
    UserQueryModule,
    UserEventModule,
  ],
})
export class UserModule {}
