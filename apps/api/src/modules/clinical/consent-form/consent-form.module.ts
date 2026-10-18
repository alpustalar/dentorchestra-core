import { Module } from '@nestjs/common';
import { ConsentFormPresentationModule } from './presentation/presentation.module';
import { ConsentFormCommandModule } from '@modules/clinical/consent-form/application/commands/command.module';
import { ConsentFormQueryModule } from '@modules/clinical/consent-form/application/queries/query.module';
import { ConsentFormEventModule } from '@modules/clinical/consent-form/infrastructure/messaging/events/consent-form-event.module';

@Module({
  imports: [
    ConsentFormPresentationModule,
    ConsentFormCommandModule,
    ConsentFormQueryModule,
    ConsentFormEventModule,
  ],
})
export class ConsentFormModule {}
