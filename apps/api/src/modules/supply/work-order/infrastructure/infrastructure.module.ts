import { Module } from '@nestjs/common';
import { WorkOrderRepositoriesModule } from '@modules/supply/work-order/infrastructure/persistence/prisma/repositories/repositories.module';
import { WorkOrderQueueModule } from '@modules/supply/work-order/infrastructure/messaging/queue/work-order-queue.module';

const WorkOrderInfrastructureModules = [
  WorkOrderRepositoriesModule,
  WorkOrderQueueModule,
];

@Module({
  imports: [...WorkOrderInfrastructureModules],
  exports: [...WorkOrderInfrastructureModules],
})
export class WorkOrderInfrastructureModule {}
