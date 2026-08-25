import { IBaseCommandRepository } from '@common/domain/repositories/base-command-repository.interface';
import { DuffelFlightBooking } from '@modules/crm/health-tourism/flight/domain/entities/duffel-flight-booking.entity';

export const DUFFEL_FLIGHT_BOOKING_COMMAND_REPOSITORY = Symbol(
  'IDuffelFlightBookingCommandRepository'
);

export interface IDuffelFlightBookingCommandRepository extends IBaseCommandRepository<DuffelFlightBooking> {
  /**
   * Kilitli okuma (`SELECT … FOR UPDATE`). Ödeme onayı ve iptal aynı kaydı
   * yarıştırabilir: iki eşzamanlı istekten biri bekler, ikinci kez ödeme/iptal
   * Duffel'a gitmez.
   */
  findByIdForUpdate(id: string): Promise<DuffelFlightBooking | null>;
}
