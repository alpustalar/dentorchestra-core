import { Injectable } from '@nestjs/common';
import { DomainEventMetadata } from '@common/interfaces';
import { txStorage } from '@src/infrastructure/transaction/als-storage';
import { IContextService } from '@src/infrastructure/context/context.service.interface';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

type WithMetadata = {
  metadata?: Partial<DomainEventMetadata>;
};

@Injectable()
export class ContextService implements IContextService {
  addEvent(eventInstance: object): void {
    const store = txStorage.getStore();
    if (!store) return;

    const ctor = (eventInstance as any)?.constructor;
    const name: string = ctor?.NAME ?? ctor?.name ?? 'UnknownEvent';

    const existingMeta =
      'metadata' in eventInstance
        ? (eventInstance as WithMetadata).metadata
        : undefined;

    store.events.push({
      name,
      payload: eventInstance,
      metadata: {
        correlationId: existingMeta?.correlationId ?? store.correlationId,
        eventId: existingMeta?.eventId ?? crypto.randomUUID(),
        occurredAt: existingMeta?.occurredAt ?? DateTimeManager.create(),
        version: existingMeta?.version ?? 1,
      },
    });
  }

  getCorrelationId(): string {
    const store = txStorage.getStore();
    if (!store?.correlationId) {
      return crypto.randomUUID();
    }
    return store.correlationId;
  }
}
