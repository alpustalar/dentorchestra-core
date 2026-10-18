import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '@common/constants/error-codes.constant';
import { assertNever } from '@common/utils';

export class BookingPaymentNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.BOOKING_PAYMENT.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(message = 'Ödeme kaydı bulunamadı.') {
    super(message);
  }
}

export class BookingPaymentLinkGenerationException extends DomainException {
  public readonly errorCode =
    ERROR_CODES.BOOKING_PAYMENT.LINK_GENERATION_FAILED;

  constructor(
    message = 'Ödeme linki üretilemedi. Lütfen daha sonra tekrar deneyin.'
  ) {
    super(message);
  }
}

/**
 * Rezervasyon varsayılan olarak ödeme-önce (payment-first) saga üzerinden açılır:
 * müşteri ödemeden HotelBeds'e rezervasyon (dolayısıyla acente maliyeti/borcu) oluşmaz.
 * Direkt booking endpoint'i yalnızca ödemenin kanal dışı tahsil edildiği MANUEL override
 * ile kullanılabilir (personel bilinçli tercihi). Bunun için `manualOverride: true` gönderilir.
 */
export class ManualBookingOverrideRequiredException extends DomainException {
  public readonly errorCode =
    ERROR_CODES.BOOKING_PAYMENT.MANUAL_OVERRIDE_REQUIRED;
  public override readonly httpStatus = HttpStatus.PAYMENT_REQUIRED;

  constructor(
    message = 'Rezervasyon için önce ödeme alınmalıdır. Ödemesi kanal dışı tahsil edildiyse manuel booking için manualOverride=true gönderin.'
  ) {
    super(message);
  }
}

/**
 * Geçersiz durum geçişi.
 *
 * Geçişler önceden **koşulsuzdu**: yorumlar "PENDING → PAID" diyordu ama zorlayan
 * yoktu ve koşulları taşıyan `BookingPaymentRules` sınıfının **hiç çağıranı
 * yoktu** (kural 10 — zorlanmayan guard süs). Pratik bedeli: ödenmiş bir kaydı
 * `markExpired` ile "link doldu, ödeme yapılmadı" hâline çekmek ya da ikinci bir
 * ödeme bildirimiyle `paidProviderRef`'i ezip **ilk çekimin iade referansını
 * kaybetmek** mümkündü. Kural artık varlığın kendisinde.
 */
export class BookingPaymentInvalidTransitionException extends DomainException {
  public readonly errorCode = ERROR_CODES.BOOKING_PAYMENT.INVALID_TRANSITION;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(transition: string, currentStatus: string) {
    super(
      `Ödeme kaydında geçersiz durum geçişi: ${transition} (mevcut durum: ${currentStatus}).`
    );
  }
}

/**
 * Satış fiyatının türetileceği tedarikçi fiyatı yok ya da pozitif değil.
 *
 * Satış fiyatı `net × (1 + komisyon/100)` ile türetilir; net sıfır/negatif/NaN
 * ise türetilen fiyat da öyle olur ve hastaya **bedava** (ya da sağlayıcının
 * reddettiği) bir link gider. Fiyat sağlayıcı yanıtından geliyor ve o yanıtta
 * fiyat alanı eksik olabiliyor — eksik fiyatın varsayılanı yoktur (kural: oran
 * da tutar da bir BEYANDIR), bu yüzden kapı burada kapanır: satış fiyatının
 * türetildiği tek nokta.
 */
export class BookingPaymentInvalidNetAmountException extends DomainException {
  public readonly errorCode = ERROR_CODES.BOOKING_PAYMENT.INVALID_NET_AMOUNT;

  constructor(netAmount: number, currency: string) {
    super(
      `Rezervasyon fiyatı geçersiz (${netAmount} ${currency}); satış fiyatı türetilemez.`
    );
  }
}

export interface BookingLedgerNotPostableMeta extends Record<string, unknown> {
  bookingPaymentId: string;
  /**
   * `BELOW_COST` → tahsilat fişi de hiç yazılmamıştı; `RETAINED_EXCEEDS_SUPPLIER`
   * → 320 negatife düşerdi; `FX_RATE_MISSING` → fişin para birimi temeli yok.
   */
  reason: 'BELOW_COST' | 'RETAINED_EXCEEDS_SUPPLIER' | 'FX_RATE_MISSING';
  /** İade matematiğine bağlı nedenlerde dolu; `FX_RATE_MISSING`'te yok. */
  refundAmount?: string;
  supplierPosted?: string;
  retainedLoss?: string;
  /** `FX_RATE_MISSING`: paranın hangi cinste hareket ettiği çözülemedi. */
  paidProvider?: string | null;
  saleCurrency?: string;
}

/**
 * Rezervasyon hareketinin fişi **matematiksel olarak imkânsız**.
 *
 * Gövde üretilmez: olay defteri append-only olduğu için yazılan gövde
 * düzeltilemez — postlanamayacak bir olay yazmak her süpürmede aynı hatayla
 * patlayan ölümsüz bir kayıt bırakır. Yeniden deneme bunu çözmez; iki hâlin de
 * çözümü bir **muhasebe kararıdır** (kural 11):
 *   - `BELOW_COST`: maliyetin altında satış → tahsilat fişi de yazılmamıştı,
 *     olmayan bir fişi ters kaydetmek 108'i eksiye düşürür.
 *   - `RETAINED_EXCEEDS_SUPPLIER`: sağlayıcının alıkoyduğu ceza tedarikçi
 *     maliyetini aşıyor → 320 negatife düşer.
 *   - `FX_RATE_MISSING`: tahsilat kanalı ya da kilitli kur yok → fişin hangi
 *     para biriminde yazılacağı bilinmiyor. "Kur yoksa 1 kabul et" sessiz bir
 *     yanlıştır: dengeyi bozmadığı için hiçbir kontrol yakalamaz.
 */
export class BookingLedgerNotPostableException extends DomainException<BookingLedgerNotPostableMeta> {
  public readonly errorCode = ERROR_CODES.BOOKING_PAYMENT.LEDGER_NOT_POSTABLE;

  constructor(meta: BookingLedgerNotPostableMeta) {
    super(BookingLedgerNotPostableException.messageFor(meta.reason), meta);
  }

  private static messageFor(
    reason: BookingLedgerNotPostableMeta['reason']
  ): string {
    switch (reason) {
      case 'BELOW_COST':
        return 'Rezervasyon iadesinin ters kaydı yazılamaz: tahsilat fişi de yazılmamıştı (maliyetin altında satış).';
      case 'RETAINED_EXCEEDS_SUPPLIER':
        return 'Rezervasyon iadesinin ters kaydı yazılamaz: sağlayıcının alıkoyduğu ceza tedarikçi maliyetini aşıyor.';
      case 'FX_RATE_MISSING':
        return 'Rezervasyon fişi yazılamaz: paranın hangi para biriminde hareket ettiği çözülemedi (tahsilat kanalı veya kilitli kur eksik).';
      default:
        return assertNever(reason);
    }
  }
}
