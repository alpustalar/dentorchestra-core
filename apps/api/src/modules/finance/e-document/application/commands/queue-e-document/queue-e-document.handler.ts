import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { QueueEDocumentCommand } from './queue-e-document.command';
import { EDocumentProducer } from '@modules/finance/e-document/infrastructure/queue/producers/e-document.producer';

@CommandHandler(QueueEDocumentCommand)
export class QueueEDocumentHandler implements ICommandHandler<
  QueueEDocumentCommand,
  void
> {
  constructor(private readonly producer: EDocumentProducer) {}

  async execute(command: QueueEDocumentCommand): Promise<void> {
    await this.producer.enqueueSend(command.invoiceId);
  }
}
