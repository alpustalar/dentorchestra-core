import { Module } from '@nestjs/common';
import { AttendancePresentationModule } from './presentation/presentation.module';
import { AttendanceCommandModule } from '@modules/hr/attendance/application/commands/command.module';
import { AttendanceQueryModule } from '@modules/hr/attendance/application/queries/query.module';

@Module({
  imports: [
    AttendancePresentationModule,
    AttendanceCommandModule,
    AttendanceQueryModule,
  ],
})
export class AttendanceModule {}
