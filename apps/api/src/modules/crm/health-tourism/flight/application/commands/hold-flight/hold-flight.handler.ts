import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITenantScopeResolver } from '@shared';
import { DuffelFlightBookingModeSchema } from '@input-type-schemas/DuffelFlightBookingModeSchema';
import { JsonValueType } from '@input-type-schemas/JsonValueSchema';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { HoldFlightCommand } from './hold-flight.command';
import { HoldFlightResponse } from './hold-flight.response';
import { GetFlightOfferQuery } from '@modules/crm/health-tourism/flight/application/queries/get-flight-offer/get-flight-offer.query';
import {
  DUFFEL_API_SERVICE,
  IDuffelApiService,
} from '@modules/crm/health-tourism/flight/domain/interfaces/duffel-api.interface';
import {
  DUFFEL_FLIGHT_BOOKING_COMMAND_REPOSITORY,
  IDuffelFlightBookingCommandRepository,
} from '@modules/crm/health-tourism/flight/domain/repositories/duffel-flight-booking/duffel-flight-booking.command.repository';
import { DuffelFlightBooking } from '@modules/crm/health-tourism/flight/domain/entities/duffel-flight-booking.entity';
import { FlightOfferExpiredException } from '@modules/crm/health-tourism/flight/domain/exceptions/duffel-flight.exceptions';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { TENANT_SCOPE_RESOLVER } from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';

@CommandHandler(HoldFlightCommand)
export class HoldFlightHandler implements ICommandHandler<
  HoldFlightCommand,
  HoldFlightResponse
> {
  constructor(
    @Inject(DUFFEL_API_SERVICE)
    private readonly duffelApi: IDuffelApiService,
    @Inject(DUFFEL_FLIGHT_BOOKING_COMMAND_REPOSITORY)
    private readonly flightBookingRepo: IDuffelFlightBookingCommandRepository,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly queryBus: TSQueryBus,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: HoldFlightCommand): Promise<HoldFlightResponse> {
    const { data, ctx } = command;

    // `data.clinicId` istek gövdesinden geliyor: kontrol olmadan personel başka
    // kliniğin adına rezervasyon açabilirdi.
    this.policyFactory
      .clinic(ctx.actor, ctx.source)
      .evaluator.check((p) => p.actorCanAccessTargetClinic(data.clinicId))
      .orThrow('health-tourism.flight');

    const { data: offer } = await this.queryBus.execute(
      new GetFlightOfferQuery(data.optionId)
    );
    if (!offer) throw new FlightOfferExpiredException();

    const organizationId = await this.tenantScopeResolver.resolve(data);

    const order = await this.duffelApi.createHoldOrder({
      offerId: offer.offerId,
      passengers: data.passengers,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
    });

    const booking = DuffelFlightBooking.create({
      duffelOrderId: order.orderId,
      bookingReference: order.bookingReference,
      offerId: offer.offerId,
      mode: DuffelFlightBookingModeSchema.enum.HOLD,
      passengers: data.passengers as unknown as JsonValueType,
      slices: offer.slices as unknown as JsonValueType,
      totalAmount: offer.totalAmount,
      currency: offer.currency,
      holdExpiresAt: order.paymentRequiredBy
        ? new Date(order.paymentRequiredBy)
        : null,
      organizationId,
      clinicId: data.clinicId,
      patientId: data.patientId,
      leadId: data.leadId,
      actorId: ctx.actor.userId,
      logSource: ctx.actor.source,
    });

    const saved = await this.txManager.run(async () =>
      this.flightBookingRepo.create(booking)
    );

    return {
      bookingId: saved.id.value,
      duffelOrderId: saved.duffelOrderId,
      paymentRequiredBy: order.paymentRequiredBy,
    };
  }
}
