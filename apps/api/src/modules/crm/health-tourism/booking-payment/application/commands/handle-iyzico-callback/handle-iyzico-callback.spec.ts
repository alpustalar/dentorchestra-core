import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { CriticalFailurePayload } from '@common/observability/critical-failure.event';
import { IIyzicoProvider } from '@src/infrastructure/payment/pos/virtual/providers/iyzico/interfaces/iyzico.provider.interface';
import { RetrieveCheckoutFormResult } from '@src/infrastructure/payment/pos/virtual/providers/iyzico/types/retrieve-checkout-form.result';
import { IyzicoCallbackRejectedException } from '@src/infrastructure/payment/pos/virtual/providers/iyzico/rules/iyzico-callback-rejected.exception';
import { IBookingPaymentCommandRepository } from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.command.repository';
import { BookingPayment } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment.entity';
import {
  CreateBookingPaymentProps,
  HotelBookingIntent,
} from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';
import { ConfirmBookingPaymentCommand } from '../confirm-booking-payment/confirm-booking-payment.command';
import { HandleBookingPaymentIyzicoCallbackCommand } from './handle-iyzico-callback.command';
import { HandleBookingPaymentIyzicoCallbackHandler } from './handle-iyzico-callback.handler';

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

/** Satış 120 EUR, kur 35 → iyzico 4200 TRY çeker. */
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
  conversationId: null,
};

const retrieved = (
  overrides: Partial<RetrieveCheckoutFormResult> = {}
): RetrieveCheckoutFormResult => ({
  isSuccess: true,
  paymentId: 'pay-1',
  paymentTransactionId: 'tx-1',
  errorCode: undefined,
  errorMessage: undefined,
  conversationId: undefined,
  price: '4200.00',
  currency: 'TRY',
  rawResponse: {},
  ...overrides,
});

/**
 * Uç `@Public`: ödemenin **sonucu** iyzico'dan okunuyor ama güncellenecek
 * **kayıt** gövdeden geliyor. Bu suite ikisinin bağlanmasını kilitler — bağ
 * yoksa başka bir ödemenin geçerli token'ı, bedeli ödenmemiş bir rezervasyonu
 * tedarikçide açtırır.
 */
describe('HandleBookingPaymentIyzicoCallbackHandler', () => {
  const build = (
    bp: BookingPayment | null,
    result: RetrieveCheckoutFormResult = retrieved()
  ) => {
    const execute = jest.fn<Promise<void>, [unknown]>(() => Promise.resolve());
    const commandBus = { execute } as unknown as TSCommandBus;

    const iyzico = {
      retrieveCheckoutForm: jest.fn(() => Promise.resolve(result)),
    } as unknown as IIyzicoProvider;

    const bookingPaymentRepo = {
      findById: jest.fn(() => Promise.resolve(bp)),
    } as unknown as IBookingPaymentCommandRepository;

    const publish = jest.fn<void, [CriticalFailurePayload]>();
    const criticalFailure = {
      publish,
    } as unknown as CriticalFailurePublisher;

    return {
      handler: new HandleBookingPaymentIyzicoCallbackHandler(
        commandBus,
        iyzico,
        bookingPaymentRepo,
        criticalFailure
      ),
      execute,
      publish,
    };
  };

  /** Link üretilmiş (token saklanmış) ama henüz ödenmemiş kayıt. */
  const pending = (token: string | null = 'token-abc'): BookingPayment => {
    const bp = BookingPayment.create(props);
    bp.attachLinks({ iyzicoToken: token, iyzicoUrl: 'https://iyzi' });
    return bp;
  };

  const command = (conversationId: string) =>
    new HandleBookingPaymentIyzicoCallbackCommand('token-abc', conversationId);

  const confirmCalls = (execute: jest.Mock<Promise<void>, [unknown]>) =>
    execute.mock.calls.filter(
      ([c]) => c instanceof ConfirmBookingPaymentCommand
    );

  it('yerel token + yankı uyuşuyorsa rezervasyon onaylanır', () => {
    const bp = pending();
    const t = build(bp, retrieved({ conversationId: bp.id.value }));

    return t.handler.execute(command(bp.id.value)).then(() => {
      expect(confirmCalls(t.execute)).toHaveLength(1);
      expect(t.publish).not.toHaveBeenCalled();
    });
  });

  it('BAŞKA bir ödemenin token’ı ile rezervasyon onaylanamaz', async () => {
    // Saldırı: kendi 10 TL’lik ödemesinin token’ını alıp gövdeye pahalı
    // rezervasyonun kimliğini yazmak. Kayıt kendi token’ını sakladığı için
    // karşılaştırma yerel ve kesindir.
    const bp = pending('token-of-this-booking');
    const t = build(bp, retrieved({ conversationId: bp.id.value }));

    await expect(t.handler.execute(command(bp.id.value))).rejects.toThrow(
      IyzicoCallbackRejectedException
    );

    expect(confirmCalls(t.execute)).toHaveLength(0);
    expect(t.publish.mock.calls[0][0].errorMessage).toBe('TOKEN_MISMATCH');
  });

  it('sağlayıcı BAŞKA bir kaydı yankılıyorsa onaylanmaz', async () => {
    const bp = pending();
    const t = build(bp, retrieved({ conversationId: 'baska-kayit' }));

    await expect(t.handler.execute(command(bp.id.value))).rejects.toThrow(
      IyzicoCallbackRejectedException
    );
    expect(t.publish.mock.calls[0][0].errorMessage).toBe(
      'CONVERSATION_MISMATCH'
    );
  });

  it('kayıtta token yok ve yankı da yoksa fail-closed', async () => {
    const t = build(pending(null), retrieved({ conversationId: undefined }));

    await expect(
      t.handler.execute(command('11111111-1111-4111-8111-111111111112'))
    ).rejects.toThrow(IyzicoCallbackRejectedException);
  });

  it('gövdenin iddia ettiği kayıt yoksa sessiz geçilmez', async () => {
    const t = build(null);

    await expect(
      t.handler.execute(command('11111111-1111-4111-8111-111111111199'))
    ).rejects.toThrow(IyzicoCallbackRejectedException);
    expect(t.publish.mock.calls[0][0].errorMessage).toBe('RECORD_NOT_FOUND');
  });

  it('UUID olmayan kimlik sorguya HİÇ gitmez (cast hatası → 500 olmaz)', async () => {
    const t = build(pending());

    await expect(
      t.handler.execute(command('../../etc/passwd'))
    ).rejects.toThrow(IyzicoCallbackRejectedException);
    expect(t.publish.mock.calls[0][0].errorMessage).toBe('RECORD_NOT_FOUND');
  });

  it('sepet tutarı kaydın beklediğinden farklıysa rezervasyon açılmaz', async () => {
    // Bağ kanıtlandıktan sonra bu tutmak zorunda; tutmadığında neyin bozulduğunu
    // söyler (bayat tutarla açılmış form / link sonrası değişmiş kayıt).
    const bp = pending();
    const t = build(
      bp,
      retrieved({ conversationId: bp.id.value, price: '10.00' })
    );

    await expect(t.handler.execute(command(bp.id.value))).rejects.toThrow(
      IyzicoCallbackRejectedException
    );

    expect(confirmCalls(t.execute)).toHaveLength(0);
    const alarm = t.publish.mock.calls[0][0];
    expect(alarm.context.expected).toBe('4200.00');
    expect(alarm.context.reported).toBe('10.00');
  });

  it('para birimi farklıysa tutar eşit olsa bile onaylanmaz', async () => {
    const bp = pending();
    const t = build(
      bp,
      retrieved({ conversationId: bp.id.value, currency: 'EUR' })
    );

    await expect(t.handler.execute(command(bp.id.value))).rejects.toThrow(
      IyzicoCallbackRejectedException
    );
  });

  it('ölçek farkı (4200 vs 4200.00) tutar uyuşmazlığı DEĞİLDİR', async () => {
    // iyzico tutarı `number` da döndürebiliyor → string karşılaştırması
    // meşru ödemeleri reddederdi; karşılaştırma Decimal üzerinden.
    const bp = pending();
    const t = build(
      bp,
      retrieved({ conversationId: bp.id.value, price: '4200' })
    );

    await t.handler.execute(command(bp.id.value));
    expect(confirmCalls(t.execute)).toHaveLength(1);
  });

  it('başarısız ödeme bildirimi kaydı hiç dokunmadan geçer', async () => {
    const bp = pending();
    const t = build(
      bp,
      retrieved({ isSuccess: false, errorMessage: 'Yetersiz bakiye' })
    );

    await t.handler.execute(command(bp.id.value));
    expect(confirmCalls(t.execute)).toHaveLength(0);
  });

  it('tutar alanı gelmezse bağ kanıtlıyken ödeme durdurulmaz (uyarı)', async () => {
    // Reddetmek meşru tahsilatları durdurur; bağ zaten kanıtlandı.
    const bp = pending();
    const t = build(
      bp,
      retrieved({
        conversationId: bp.id.value,
        price: undefined,
        currency: undefined,
      })
    );

    await t.handler.execute(command(bp.id.value));
    expect(confirmCalls(t.execute)).toHaveLength(1);
  });
});
