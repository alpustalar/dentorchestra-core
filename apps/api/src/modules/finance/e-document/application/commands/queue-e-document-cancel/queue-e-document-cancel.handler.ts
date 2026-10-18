import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { QueueEDocumentCancelCommand } from './queue-e-document-cancel.command';
import { EDocumentProducer } from '@modules/finance/e-document/infrastructure/queue/producers/e-document.producer';

@CommandHandler(QueueEDocumentCancelCommand)
export class QueueEDocumentCancelHandler implements ICommandHandler<
  QueueEDocumentCancelCommand,
  void
> {
  constructor(private readonly producer: EDocumentProducer) {}

  async execute(command: QueueEDocumentCancelCommand): Promise<void> {
    await this.producer.enqueueCancel(command.payload);
  }
}
