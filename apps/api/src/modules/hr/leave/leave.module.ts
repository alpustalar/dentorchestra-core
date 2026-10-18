import { Module } from '@nestjs/common';
import { LeavePresentationModule } from './presentation/presentation.module';
import { LeaveCommandModule } from '@modules/hr/leave/application/commands/command.module';
import { LeaveQueryModule } from '@modules/hr/leave/application/queries/query.module';

@Module({
  imports: [LeavePresentationModule, LeaveCommandModule, LeaveQueryModule],
})
export class LeaveModule {}
