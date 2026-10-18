import { Module } from '@nestjs/common';
import { OrganizationPresentationModule } from '@modules/organization/organization/presentation/presentation.module';
import { OrganizationCommandModule } from '@modules/organization/organization/application/commands/command.module';
import { OrganizationQueryModule } from '@modules/organization/organization/application/queries/query.module';
import { OrganizationEventModule } from '@modules/organization/organization/infrastructure/messaging/events/organization-event.module';

@Module({
  imports: [
    OrganizationPresentationModule,
    OrganizationCommandModule,
    OrganizationQueryModule,
    OrganizationEventModule,
  ],
})
export class OrganizationModule {}
