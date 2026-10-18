import { Module } from '@nestjs/common';
import { AppointmentPresentationModule } from '@modules/clinical/appointment/presentation/presentation.module';
import { AppointmentAiToolsModule } from '@modules/clinical/appointment/application/ai-tools/appointment-ai-tools.module';
import { AppointmentCommandModule } from '@modules/clinical/appointment/application/commands/command.module';
import { AppointmentQueryModule } from '@modules/clinical/appointment/application/queries/query.module';
import { AppointmentEventListenersModule } from '@modules/clinical/appointment/infrastructure/messaging/events/appointment-event-listeners.module';

@Module({
  imports: [
    AppointmentPresentationModule,
    AppointmentAiToolsModule,
    AppointmentCommandModule,
    AppointmentQueryModule,
    AppointmentEventListenersModule,
  ],
})
export class AppointmentModule {}
