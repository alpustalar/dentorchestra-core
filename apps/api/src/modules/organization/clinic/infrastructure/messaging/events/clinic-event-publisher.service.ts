import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ClinicSoftDeleteByOrganizationIdEvent,
  ClinicSoftDeleteByOrganizationIdEventPayload,
} from '@modules/organization/clinic/domain/events/clinic-soft-delete-by-organization-id.event';
import {
  ClinicSoftDeletedEvent,
  ClinicSoftDeletedEventPayload,
} from '@modules/organization/clinic/domain/events/clinic-soft-deleted.event';
import {
  ClinicSoftDeleteRequestedEvent,
  ClinicSoftDeleteRequestedEventPayload,
} from '@modules/organization/clinic/domain/events/clinic-soft-delete-requested.event';
import { IClinicEventPublisher } from '@modules/organization/clinic/domain/interfaces/clinic.event-publisher.interface';
import {
  CONTEXT_SERVICE,
  IContextService,
} from '@src/infrastructure/context/context.service.interface';
import { emitDetached } from '@common/utils';

@Injectable()
export class ClinicEventPublisher implements IClinicEventPublisher {
  constructor(
    @Inject(CONTEXT_SERVICE)
    private readonly contextService: IContextService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  softDeleteClinic(payload: ClinicSoftDeletedEventPayload) {
    this.contextService.addEvent(new ClinicSoftDeletedEvent(payload));
  }

  requestClinicSoftDelete(payload: ClinicSoftDeleteRequestedEventPayload) {
    emitDetached(
      this.eventEmitter,
      ClinicSoftDeleteRequestedEvent.NAME,
      new ClinicSoftDeleteRequestedEvent(payload)
    );
  }

  softDeleteClinicByOrganizationId(
    payload: ClinicSoftDeleteByOrganizationIdEventPayload
  ) {
    this.contextService.addEvent(
      new ClinicSoftDeleteByOrganizationIdEvent(payload)
    );
  }
}
