import { Module } from '@nestjs/common';
import { PostingPresentationModule } from './presentation/presentation.module';
import { PostingEventModule } from '@modules/finance/accounting/posting/infrastructure/messaging/events/posting-event.module';
import { PostingQueryModule } from '@modules/finance/accounting/posting/application/queries/query.module';
import { PostingQueueModule } from '@modules/finance/accounting/posting/infrastructure/messaging/queue/posting-queue.module';

@Module({
  imports: [
    PostingPresentationModule,
    PostingQueryModule,
    PostingEventModule,
    PostingQueueModule,
  ],
})
export class PostingModule {}
