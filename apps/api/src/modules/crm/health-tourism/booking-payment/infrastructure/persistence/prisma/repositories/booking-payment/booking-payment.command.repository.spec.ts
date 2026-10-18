import { BookingPaymentCommandRepository } from './booking-payment.command.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import { BookingPayment } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment.entity';
import {
  CreateBookingPaymentProps,
  HotelBookingIntent,
} from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';

const hotelIntent: HotelBookingIntent = {
  type: 'HOTEL',
  hotelCode: 'H1',
  hotelName: 'Otel Bir',
  checkIn: '2026-07-01',
  checkOut: '2026-07-05',
  holderName: 'Ali',
  holderSurname: 'Veli',
  rooms: [{ rateKey: 'RK-1', paxes: [] }],
};

const props: CreateBookingPaymentProps = {
  bookingType: 'HOTEL',
  saleCurrency: 'EUR',
  saleAmount: 120,
  tryAmount: 4200,
  netAmount: 100,
  fxRate: 35,
  intent: hotelIntent,
  clinicId: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  patientId: null,
  leadId: null,
  conversationId: 'conv-1',
};

/**
 * Yalnız `create` sırasında yazılan, sonradan DEĞİŞMEYEN kolonlar. `update`
 * mapping'i bunlara dokunmaz; geri kalan her kolonun mapping'de bulunması
 * zorunludur (aşağıdaki kilit testi bunu derleyici yerine çalıştırma zamanında
 * zorlar).
 */
const CREATE_ONLY_COLUMNS = new Set([
  'id',
  'bookingType',
  'saleCurrency',
  'saleAmount',
  'tryAmount',
  'netAmount',
  'fxRate',
  'intent',
  'clinicId',
  'organizationId',
  'patientId',
  'leadId',
  'conversationId',
  'createdAt',
]);

describe('BookingPaymentCommandRepository — update mapping kilidi', () => {
  const build = () => {
    // `async` değil `Promise.resolve`: mock'ta beklenecek bir şey yok, `async`
    // yazmak lint borcu üretiyor (dosya yeni, borçla doğmasın).
    const update = jest.fn((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...bookedEntity().toPersistence(), ...args.data })
    );
    const prisma = {
      bookingPayment: { update },
    } as unknown as PrismaService;

    return { repo: new BookingPaymentCommandRepository(prisma), update };
  };

  const bookedEntity = (): BookingPayment => {
    const bp = BookingPayment.create(props);
    bp.markPaid('STRIPE', 'pi_1');
    bp.markBooked('BK-1', 'BK-1');
    return bp;
  };

  it('fiilî tedarikçi maliyeti DB’ye yazılır', async () => {
    // Regresyon: kolon şemaya ve entity'ye eklendi, `toPersistence` taşıdı ama
    // `update` mapping'i alan listesini tek tek yazdığı için DÜŞTÜ. Hata vermez,
    // log üretmez: defter her rezervasyonda "fiilî maliyet bilinmiyor" alarmı
    // verir ve tedarikçi borcunu teklif tutarından yazar (CLAUDE.md kural 9).
    const { repo, update } = build();
    const bp = bookedEntity();
    bp.recordSupplierCost({ amount: '105.00', currency: 'EUR' });

    await repo.update(bp);

    const data = update.mock.calls[0][0].data;
    expect(String(data.supplierAmount)).toBe('105');
    expect(data.supplierCurrency).toBe('EUR');
  });

  it('entity’nin taşıdığı her değişken kolon mapping’de bulunur', async () => {
    // Mapping kilidi: şemaya yeni bir değişken kolon eklenip `update`'e
    // eklenmezse bu test düşer. Yeni kolon bilinçli olarak create-only ise
    // CREATE_ONLY_COLUMNS'a yazılır — yani karar görünür hâle gelir.
    const { repo, update } = build();
    const bp = bookedEntity();
    bp.recordSupplierCost({ amount: '105.00', currency: 'EUR' });

    await repo.update(bp);

    const mapped = new Set(Object.keys(update.mock.calls[0][0].data));
    const missing = Object.keys(bp.toPersistence()).filter(
      (key) => !CREATE_ONLY_COLUMNS.has(key) && !mapped.has(key)
    );

    expect(missing).toEqual([]);
  });

  it('create alanlarına dokunmaz (tutarlar ve kiracı değişmez)', async () => {
    const { repo, update } = build();

    await repo.update(bookedEntity());

    const mapped = Object.keys(update.mock.calls[0][0].data);
    expect(mapped).not.toContain('saleAmount');
    expect(mapped).not.toContain('netAmount');
    expect(mapped).not.toContain('clinicId');
    expect(mapped).not.toContain('intent');
  });
});
