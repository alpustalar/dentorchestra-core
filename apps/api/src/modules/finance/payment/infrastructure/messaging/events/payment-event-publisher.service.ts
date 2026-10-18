import { Inject, Injectable } from '@nestjs/common';
import {
  PaymentInitiatedEvent,
  PaymentInitiatedEventPayload,
} from '@modules/finance/payment/domain/events/payment-initiated.event';
import {
  PaymentCancelledEvent,
  PaymentCancelledEventPayload,
} from '@modules/finance/payment/domain/events/payment-cancelled.event';
import { IPaymentEventPublisher } from '@modules/finance/payment/domain/interfaces/payment-event-publisher.interface';
import {
  CONTEXT_SERVICE,
  IContextService,
} from '@src/infrastructure/context/context.service.interface';

@Injectable()
export class PaymentEventPublisher implements IPaymentEventPublisher {
  constructor(
    @Inject(CONTEXT_SERVICE)
    private readonly contextService: IContextService
  ) {}

  paymentInitiated(payload: PaymentInitiatedEventPayload) {
    this.contextService.addEvent(new PaymentInitiatedEvent(payload));
  }

  paymentCancelled(payload: PaymentCancelledEventPayload) {
    this.contextService.addEvent(new PaymentCancelledEvent(payload));
  }
}
