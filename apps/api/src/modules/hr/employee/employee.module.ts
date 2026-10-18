import { Module } from '@nestjs/common';
import { EmployeePresentationModule } from './presentation/presentation.module';
import { EmployeeCommandModule } from '@modules/hr/employee/application/commands/command.module';
import { EmployeeQueryModule } from '@modules/hr/employee/application/queries/query.module';
import { EmployeeEventModule } from '@modules/hr/employee/infrastructure/messaging/events/employee-event.module';

@Module({
  imports: [
    EmployeePresentationModule,
    EmployeeCommandModule,
    EmployeeQueryModule,
    EmployeeEventModule,
  ],
})
export class EmployeeModule {}
