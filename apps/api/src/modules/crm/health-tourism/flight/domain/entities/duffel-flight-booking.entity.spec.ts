import { DuffelFlightBooking } from './duffel-flight-booking.entity';
import { CreateFlightBookingProps } from '@modules/crm/health-tourism/flight/domain/contracts';
import { FlightBookingInvalidStateException } from '@modules/crm/health-tourism/flight/domain/exceptions/duffel-flight.exceptions';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import {
  FlightBookingCancelledEvent,
  FlightBookingConfirmedEvent,
  FlightBookingCreatedEvent,
} from '@modules/crm/health-tourism/flight/domain/events/flight-booking.events';

const ACTOR = {
  actorId: UUID.generate().value,
  logSource: LogSource.SYSTEM,
};

function buildProps(
  overrides: Partial<CreateFlightBookingProps> = {}
): CreateFlightBookingProps {
  return {
    duffelOrderId: 'ord_123',
    offerId: 'off_123',
    mode: 'HOLD',
    passengers: [{ givenName: 'Ada', familyName: 'Lovelace' }],
    slices: [],
    totalAmount: 450.5,
    currency: 'EUR',
    organizationId: UUID.generate().value,
    clinicId: UUID.generate().value,
    patientId: null,
    leadId: null,
    ...ACTOR,
    ...overrides,
  };
}

/** Entity içinde raise edilen event'ler (flushEvents repo'da çağrılır). */
function eventsOf(booking: DuffelFlightBooking) {
  return booking.getDomainEvents();
}

describe('DuffelFlightBooking — durum makinesi', () => {
  it('HOLD modunda kayıt HELD doğar ve created event fırlatır', () => {
    const booking = DuffelFlightBooking.create(buildProps({ mode: 'HOLD' }));

    expect(booking.status).toBe('HELD');
    expect(booking.mode).toBe('HOLD');
    expect(
      eventsOf(booking).some((e) => e instanceof FlightBookingCreatedEvent)
    ).toBe(true);
  });

  it('INSTANT modunda kayıt doğrudan CONFIRMED doğar — sipariş zaten ödenmiş açılır', () => {
    const booking = DuffelFlightBooking.create(buildProps({ mode: 'INSTANT' }));

    expect(booking.status).toBe('CONFIRMED');
  });

  it('confirm() HELD kaydı CONFIRMED yapar ve PNR yazar', () => {
    const booking = DuffelFlightBooking.create(buildProps({ mode: 'HOLD' }));

    booking.confirm({ bookingReference: 'ABC123', ...ACTOR });

    expect(booking.status).toBe('CONFIRMED');
    expect(booking.bookingReference).toBe('ABC123');
    // Hold penceresi kapandı: ödendi, artık son ödeme tarihi anlamsız.
    expect(booking.holdExpiresAt).toBeNull();
    expect(
      eventsOf(booking).some((e) => e instanceof FlightBookingConfirmedEvent)
    ).toBe(true);
  });

  it('HELD olmayan kayıt ikinci kez ödenemez — Duffel çift çekim önlenir', () => {
    const booking = DuffelFlightBooking.create(buildProps({ mode: 'INSTANT' }));

    expect(() => booking.confirm({ bookingReference: 'X', ...ACTOR })).toThrow(
      FlightBookingInvalidStateException
    );
  });

  it('cancel() idempotenttir: ikinci çağrı yeni event üretmez', () => {
    const booking = DuffelFlightBooking.create(buildProps({ mode: 'HOLD' }));

    booking.cancel({ ...ACTOR, reason: 'hasta vazgeçti' });
    const afterFirst = eventsOf(booking).filter(
      (e) => e instanceof FlightBookingCancelledEvent
    ).length;

    booking.cancel({ ...ACTOR, reason: 'tekrar' });
    const afterSecond = eventsOf(booking).filter(
      (e) => e instanceof FlightBookingCancelledEvent
    ).length;

    expect(booking.status).toBe('CANCELLED');
    expect(afterFirst).toBe(1);
    expect(afterSecond).toBe(1);
  });

  it('markFailed() gerekçeyi saklar — saga iade yoluna girer', () => {
    const booking = DuffelFlightBooking.create(buildProps());

    booking.markFailed('Duffel ödeme reddetti');

    expect(booking.status).toBe('FAILED');
    expect(booking.failureReason).toBe('Duffel ödeme reddetti');
  });
});

describe('DuffelFlightBooking — hold süresi', () => {
  it('son ödeme anı geçmişse isHoldExpired true döner', () => {
    const booking = DuffelFlightBooking.create(
      buildProps({
        mode: 'HOLD',
        holdExpiresAt: DateTimeManager.addMinutes(DateTimeManager.create(), -5),
      })
    );

    expect(booking.isHoldExpired).toBe(true);
  });

  it('son ödeme anı gelecekteyse isHoldExpired false döner', () => {
    const booking = DuffelFlightBooking.create(
      buildProps({
        mode: 'HOLD',
        holdExpiresAt: DateTimeManager.addMinutes(DateTimeManager.create(), 30),
      })
    );

    expect(booking.isHoldExpired).toBe(false);
  });

  it('CONFIRMED kayıt için hold süresi sorgulanmaz (false)', () => {
    const booking = DuffelFlightBooking.create(
      buildProps({
        mode: 'INSTANT',
        holdExpiresAt: DateTimeManager.addMinutes(
          DateTimeManager.create(),
          -60
        ),
      })
    );

    expect(booking.isHoldExpired).toBe(false);
  });
});

describe('DuffelFlightBooking — kalıcılık', () => {
  it('toPersistence tutarı ve para birimini korur', () => {
    const booking = DuffelFlightBooking.create(
      buildProps({ totalAmount: 1234.56, currency: 'USD' })
    );

    const row = booking.toPersistence();

    expect(row.totalAmount.toString()).toBe('1234.56');
    expect(row.currency).toBe('USD');
    expect(row.duffelOrderId).toBe('ord_123');
  });
});
