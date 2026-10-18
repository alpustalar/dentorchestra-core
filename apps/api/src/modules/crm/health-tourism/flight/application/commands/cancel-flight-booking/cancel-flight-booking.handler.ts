import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { Money } from '@src/domain/value-objects/money.vo';
import { CancelFlightBookingCommand } from './cancel-flight-booking.command';
import type { CancelFlightBookingResponse } from './cancel-flight-booking.response';
import { SupplierRetainedCost } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';
import { toSupplierRetainedCost } from '@modules/crm/health-tourism/booking-payment/domain/rules/supplier-retained-cost.rule';
import { DuffelFlightBooking } from '@modules/crm/health-tourism/flight/domain/entities/duffel-flight-booking.entity';
import { FlightCancellationResult } from '@modules/crm/health-tourism/flight/domain/interfaces/duffel-api.interface';
import {
  DUFFEL_API_SERVICE,
  IDuffelApiService,
} from '@modules/crm/health-tourism/flight/domain/interfaces/duffel-api.interface';
import {
  DUFFEL_FLIGHT_BOOKING_COMMAND_REPOSITORY,
  IDuffelFlightBookingCommandRepository,
} from '@modules/crm/health-tourism/flight/domain/repositories/duffel-flight-booking/duffel-flight-booking.command.repository';
import { FlightBookingNotFoundException } from '@modules/crm/health-tourism/flight/domain/exceptions/duffel-flight.exceptions';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@CommandHandler(CancelFlightBookingCommand)
export class CancelFlightBookingHandler implements ICommandHandler<
  CancelFlightBookingCommand,
  CancelFlightBookingResponse
> {
  private readonly logger = new Logger(CancelFlightBookingHandler.name);

  constructor(
    @Inject(DUFFEL_API_SERVICE)
    private readonly duffelApi: IDuffelApiService,
    @Inject(DUFFEL_FLIGHT_BOOKING_COMMAND_REPOSITORY)
    private readonly flightBookingRepo: IDuffelFlightBookingCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly txManager: TransactionManager
  ) {}

  async execute(
    command: CancelFlightBookingCommand
  ): Promise<CancelFlightBookingResponse> {
    const { data, ctx } = command;

    // Önce kilitli claim, sonra dış çağrı: sıralama otel/transferdeki ile aynı
    // gerekçeye dayanır — iki eşzamanlı iptal isteğinden ikincisi kaydı zaten
    // CANCELLED görür ve Duffel'a ikinci iptal (ve ikinci iade) gitmez.
    const claimed = await this.txManager.run(async () => {
      const booking = await this.flightBookingRepo.findByIdForUpdate(
        data.bookingId
      );
      if (!booking) throw new FlightBookingNotFoundException(data.bookingId);

      this.policyFactory
        .clinic(ctx.actor, ctx.source)
        .evaluator.check((p) =>
          p.actorCanAccessTargetClinic(booking.clinicId.value)
        )
        .orThrow('health-tourism.flight');

      if (booking.validate.status.isCancelled.value) return null;

      booking.cancel({
        actorId: ctx.actor.userId,
        logSource: ctx.actor.source,
        reason: data.reason,
      });
      await this.flightBookingRepo.update(booking);

      return booking;
    });

    if (!claimed) {
      this.logger.log(
        `Uçuş rezervasyonu zaten iptal edilmiş, Duffel'a tekrar gidilmedi: ${data.bookingId}`
      );
      // Sağlayıcıya gidilmedi → iptal ekonomisi öğrenilemez.
      return { orderId: null, retained: null };
    }

    const result = await this.duffelApi.cancelOrder(claimed.duffelOrderId);

    return {
      orderId: claimed.duffelOrderId,
      retained: this.resolveRetained(claimed, result),
    };
  }

  /**
   * Duffel **iade edilecek** tutarı bildirir (`refund_amount`), alıkoyduğunu
   * değil. Alıkoyulan = sipariş tutarı − iade edilecek tutar.
   *
   * `refundAmount` yoksa sonuç **null** (bilinmiyor): 0 kabul etmek "havayolu
   * hiçbir şey iade etmiyor, tamamı ceza" demek olurdu ve bu, tedarikçi
   * maliyetinin tamamını zarara yazardı. Para birimi siparişten farklıysa
   * çıkarma yapılamaz → yine bilinmiyor.
   */
  private resolveRetained(
    booking: DuffelFlightBooking,
    result: FlightCancellationResult
  ): SupplierRetainedCost | null {
    const total = booking.totalAmount;
    if (result.refundAmount === null) return null;
    if (result.refundCurrency !== total.currency) return null;

    const refunded = toSupplierRetainedCost(
      result.refundAmount,
      result.refundCurrency
    );
    if (!refunded) return null;

    const refundedMoney = Money.create(
      refunded.amount,
      refunded.currency
    ).instance;
    // İade, sipariş tutarını aşıyorsa sayılar tutarsız: çıkarma negatif ceza
    // üretirdi → bilinmiyor olarak taşınır, defter cezasız ters kayıt yazar.
    if (!refundedMoney || refundedMoney.isGreaterThan(total)) return null;

    return toSupplierRetainedCost(
      total.subtract(refundedMoney).toApiFormat(),
      total.currency
    );
  }
}
