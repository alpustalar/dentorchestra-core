import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '@common/constants/error-codes.constant';

/**
 * Randevunun faturası kesilmiş; ticari belge donduğu için dayanağını oluşturan
 * kayıtlar (işlem satırları) artık değiştirilemez.
 *
 * NOT: `errorCode` bilinçli olarak `TREATMENT_CHARGE.ALREADY_INVOICED` — kural
 * invoice modülünde yaşar ama hatayı gören uçlar (satır ekle/indirim/iptal)
 * treatment-charge uçlarıdır ve frontend bu kodu zaten tanıyor. Kod değişirse
 * istemci sözleşmesi bozulurdu.
 */
/**
 * Aynı randevu/ödeme için ikinci bir fatura yazılmaya çalışıldı ve DB'deki unique
 * kısıt (`invoices_appointment_id_key` / `invoices_payment_id_key`) bunu reddetti.
 *
 * Bu yarışı kaybeden taraftır: "önce sorgula, yoksa oluştur" kontrolü ile yazma
 * arasındaki pencerede başka bir istek faturayı kesmiştir. Çağıran bunu yakalayıp
 * kazananın faturasını okur ve idempotent şekilde onu döner.
 */
export class InvoiceDuplicateException extends DomainException {
  public readonly errorCode = ERROR_CODES.INVOICE.DUPLICATE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(message = 'Bu kayıt için fatura zaten kesilmiş.') {
    super(message);
  }
}

export class AppointmentAlreadyInvoicedException extends DomainException {
  public readonly errorCode = ERROR_CODES.TREATMENT_CHARGE.ALREADY_INVOICED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(appointmentId: string) {
    super(
      `Faturası kesilmiş randevunun işlem satırları değiştirilemez: ${appointmentId}`
    );
  }
}

export class InvoiceNotFoundException extends DomainException<{
  invoiceId?: string;
}> {
  public readonly errorCode = ERROR_CODES.INVOICE.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(invoiceId?: string) {
    super('Fatura bulunamadı.', { invoiceId });
  }
}

/**
 * Fatura numarası GİB biçimine uymuyor (3 seri + 4 yıl + 9 sıra = 16 karakter).
 *
 * Domain katmanı HTTP'den habersiz kalmalı: numara doğrulaması bir iş kuralıdır ve
 * entegratör sonucu işlenirken de (kuyruk işleyicisi, HTTP yok) tetiklenebilir.
 */
export class InvoiceNumberInvalidException extends DomainException<{
  value: string;
  reason: string;
}> {
  public readonly errorCode = ERROR_CODES.INVOICE.INVALID_NUMBER;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(meta: { value: string; reason: string }) {
    super(meta.reason, meta);
  }
}

/**
 * Kesilmiş (numarası basılmış) faturanın belge numarası değiştirilemez.
 *
 * Bu guard e-belge job'u yeniden denendiğinde devreye girer: entegratör ikinci bir
 * belge numarası döndürse bile sistemdeki numara donmuş kalır — aksi halde ilk
 * beyan edilen belge ile defterdeki numara ayrışırdı.
 */
export class InvoiceNumberImmutableException extends DomainException<{
  invoiceId: string;
  currentInvoiceNumber: string;
  attemptedInvoiceNumber: string;
}> {
  public readonly errorCode = ERROR_CODES.INVOICE.NUMBER_IMMUTABLE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: {
    invoiceId: string;
    currentInvoiceNumber: string;
    attemptedInvoiceNumber: string;
  }) {
    super('Kesilmiş faturanın belge numarası değiştirilemez.', meta);
  }
}

/** İptal edilmiş fatura e-belge sonucuyla yeniden kesilemez (diriltilemez). */
export class InvoiceNotFinalizableException extends DomainException<{
  invoiceId: string;
  currentStatus: string;
}> {
  public readonly errorCode = ERROR_CODES.INVOICE.NOT_FINALIZABLE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { invoiceId: string; currentStatus: string }) {
    super('Bu durumdaki fatura e-belge sonucuyla finalize edilemez.', meta);
  }
}

/**
 * İşlem satırlarının para birimi ile tahsilatın para birimi ayrışıyor.
 *
 * Sessizce birini seçmek faturayı yanlış para biriminde keser ve defterde yanlış
 * tutara dönüşür (posting para birimi verilmezse fonksiyonel parayı varsayar).
 */
export class InvoiceCurrencyMismatchException extends DomainException<{
  chargesCurrency: string;
  paymentCurrency: string;
}> {
  public readonly errorCode = ERROR_CODES.INVOICE.CURRENCY_MISMATCH;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { chargesCurrency: string; paymentCurrency: string }) {
    super(
      `İşlem satırlarının para birimi (${meta.chargesCurrency}) tahsilatın para birimiyle (${meta.paymentCurrency}) uyuşmuyor.`,
      meta
    );
  }
}

/**
 * Fatura zaten iptal edilmiş. İkinci iptal denemesi reddedilir: iptal defterde
 * **storno fişi** üretir; sessizce geçilirse aynı belgenin etkisi iki kez
 * götürülür ve hesap bakiyesi ters işarete kayar.
 */
export class InvoiceAlreadyCancelledException extends DomainException<{
  invoiceId: string;
  cancelledAt: string | null;
}> {
  public readonly errorCode = ERROR_CODES.INVOICE.ALREADY_CANCELLED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { invoiceId: string; cancelledAt: string | null }) {
    super('Fatura zaten iptal edilmiş.', meta);
  }
}

/**
 * e-Belge gönderimi havada (`einvoiceStatus = QUEUED`): belgenin entegratörde
 * oluşup oluşmadığı henüz bilinmiyor, bu yüzden iptal reddedilir.
 *
 * İptal edilse ve hemen ardından gönderim başarılı olsa, elimizde "yerel olarak
 * iptal edilmiş ama vergi idaresinde geçerli" bir belge kalırdı — ve bunu
 * gösteren bir mutabakat yoktu. Gönderim sonuçlandığında iptal yeniden denenir.
 */
export class InvoiceEDocumentDispatchInFlightException extends DomainException<{
  invoiceId: string;
  einvoiceStatus: string;
}> {
  public readonly errorCode = ERROR_CODES.INVOICE.EDOCUMENT_DISPATCH_IN_FLIGHT;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: { invoiceId: string; einvoiceStatus: string }) {
    super(
      'e-Belge gönderimi sürüyor; sonucu belirlenmeden fatura iptal edilemez. Gönderim tamamlandığında tekrar deneyin.',
      meta
    );
  }
}
