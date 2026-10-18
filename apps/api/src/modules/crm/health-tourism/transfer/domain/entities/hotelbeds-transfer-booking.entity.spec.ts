import { HotelbedsTransferBooking } from './hotelbeds-transfer-booking.entity';
import { CreateTransferBookingProps } from '@modules/crm/health-tourism/transfer/domain/contracts/hotelbeds-transfer-booking';
import { UUID } from '@src/domain/value-objects/uuid.vo';

function buildProps(
  overrides: Partial<CreateTransferBookingProps> = {}
): CreateTransferBookingProps {
  return {
    reference: 'TR-1',
    clientReference: 'cli-1',
    status: 'CONFIRMED',
    holderName: 'Ada',
    holderSurname: 'Lovelace',
    holderEmail: 'ada@example.com',
    holderPhone: '+905550000000',
    transfers: [],
    totalAmount: 85.4,
    currency: 'EUR',
    organizationId: UUID.generate().value,
    clinicId: UUID.generate().value,
    patientId: null,
    leadId: null,
    ...overrides,
  };
}

describe('HotelbedsTransferBooking entity — tutar kapısı', () => {
  it('tutarı ve para birimini korur', () => {
    const booking = HotelbedsTransferBooking.create(buildProps());

    expect(booking.totalAmount.toApiFormat()).toBe('85.40');
    expect(booking.totalAmount.currency).toBe('EUR');
    expect(booking.toPersistence().totalAmount.toString()).toBe('85.4');
  });

  it.each([0, -1])('tutarı %p olan transfer kaydedilemez', (totalAmount) => {
    // Sağlayıcı yanıtında fiyat eksikse eskiden `?? 0` ile sıfır taşınıyordu
    // ve bu kapı yoktu: "bedava transfer" satırı deftere tedarikçi borcunu
    // sıfır olarak yazar, komisyonu satışın tamamı gibi gösterirdi. Aynı kapı
    // otel rezervasyonunda zaten vardı.
    expect(() =>
      HotelbedsTransferBooking.create(buildProps({ totalAmount }))
    ).toThrow();
  });
});
