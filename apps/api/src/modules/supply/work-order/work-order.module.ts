import { Module } from '@nestjs/common';
import { WorkOrderPresentationModule } from './presentation/presentation.module';
import { WorkOrderCommandModule } from '@modules/supply/work-order/application/commands/command.module';
import { WorkOrderQueryModule } from '@modules/supply/work-order/application/queries/query.module';

@Module({
  imports: [
    WorkOrderPresentationModule,
    WorkOrderCommandModule,
    WorkOrderQueryModule,
  ],
})
export class WorkOrderModule {}
