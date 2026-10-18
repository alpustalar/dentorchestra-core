import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { HotelbedsBookingNotFoundException } from '@modules/crm/health-tourism/hotel/domain/exceptions/hotelbeds-booking.exceptions';
import { CancelHotelBookingCommand } from './cancel-hotel-booking.command';
import type { CancelHotelBookingResponse } from './cancel-hotel-booking.response';
import { toSupplierRetainedCost } from '@modules/crm/health-tourism/booking-payment/domain/rules/supplier-retained-cost.rule';
import {
  HOTELBEDS_API_SERVICE,
  IHotelbedsApiService,
} from '@modules/crm/health-tourism/hotel/domain/interfaces/hotelbeds-api.interface';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import {
  HOTELBEDS_BOOKING_COMMAND_REPOSITORY,
  IHotelbedsBookingCommandRepository,
} from '@modules/crm/health-tourism/hotel/domain/repositories/hotelbeds-booking/hotelbeds-booking.command.repository';

@CommandHandler(CancelHotelBookingCommand)
export class CancelHotelBookingHandler implements ICommandHandler<
  CancelHotelBookingCommand,
  CancelHotelBookingResponse
> {
  constructor(
    @Inject(HOTELBEDS_API_SERVICE)
    private readonly hotelbedsApi: IHotelbedsApiService,
    @Inject(HOTELBEDS_BOOKING_COMMAND_REPOSITORY)
    private readonly hotelbedsBookingRepo: IHotelbedsBookingCommandRepository,
    private readonly txManager: TransactionManager
  ) {}

  /**
   * Önce **kilitli claim** (durum kontrolü + CANCELLED yazımı), sonra HotelBeds
   * iptal çağrısı.
   *
   * Sıra bilinçli: durum kontrolü dış çağrının arkasında kalsaydı iki eşzamanlı
   * iptal isteği de rezervasyonu "aktif" görüp HotelBeds'e iki kez iptal (ve
   * arkasındaki iade akışını iki kez) tetiklerdi. Zaten iptalliyse sessizce çıkar.
   */
  async execute(
    command: CancelHotelBookingCommand
  ): Promise<CancelHotelBookingResponse> {
    const { dto, ctx } = command;

    // TODO: saga/outbox kullanıcaz. nest cqrs'in sagasını kullan. kullanıcıya direkt talebiniz alındı dön. kuyruğa al

    const reference = await this.txManager.run(async () => {
      const booking = await this.hotelbedsBookingRepo.findByIdForUpdate(
        dto.bookingId
      );
      if (!booking) throw new HotelbedsBookingNotFoundException();

      if (booking.validate.status.isCancelled.value) return null;

      // İptal event'i entity içinde raise edilir; `update()` flush eder.
      booking.cancel({
        actorId: ctx.actor.userId,
        logSource: ctx.actor.source,
      });
      await this.hotelbedsBookingRepo.update(booking);

      return booking.reference;
    });

    // Zaten iptalliydi: sağlayıcıya gitmedik, dolayısıyla iptal ekonomisi de
    // öğrenilemez. İade akışı bunu "bilinmiyor" olarak görür.
    if (!reference) return { reference: null, retained: null };

    const result = await this.hotelbedsApi.cancelBooking(reference);

    return {
      reference: result.reference,
      retained: toSupplierRetainedCost(result.retainedAmount, result.currency),
    };
  }
}
