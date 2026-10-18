import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '@common/constants';
import { PostingSweepProducer } from './producers/posting-sweep.producer';
import { PostingSweepProcessor } from './processors/posting-sweep.processor';

/**
 * Posting kendi kuyruğunu taşır (muhasebe dönemi kuyruğuna binmez): BullMQ'da
 * aynı kuyruğa iki `@Processor` bağlanırsa işler ikisi arasında dağıtılır ve bir
 * iş, o adı tanımayan işleyiciye düşebilir.
 */
@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.POSTING })],
  providers: [PostingSweepProducer, PostingSweepProcessor],
})
export class PostingQueueModule {}
