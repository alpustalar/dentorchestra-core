import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '@common/constants/error-codes.constant';
import type { DiscountLimitMeta } from '@shared/modules/treatment-charge/interfaces';

export class TreatmentChargeNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.TREATMENT_CHARGE.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(chargeId?: string) {
    super(
      chargeId
        ? `İşlem satırı bulunamadı: ${chargeId}`
        : 'İşlem satırı bulunamadı.'
    );
  }
}

/**
 * Tedavinin liste fiyatı tanımlı değilken satır açılmaya çalışıldı. İndirim
 * ölçülebilir olsun diye satır her zaman bir referans fiyatla doğar.
 */
export class TreatmentListPriceMissingException extends DomainException {
  public readonly errorCode = ERROR_CODES.TREATMENT_CHARGE.LIST_PRICE_MISSING;

  constructor(treatmentId: string) {
    super(
      `Tedavinin liste fiyatı tanımlı değil, ücretlendirilemez: ${treatmentId}`
    );
  }
}

/**
 * İndirim klinik tavanını aştı. Frontend'in "onay iste" akışını kurabilmesi için
 * istenen ve izin verilen oranları `meta` ile taşır.
 */
export class DiscountLimitExceededException extends DomainException<DiscountLimitMeta> {
  public readonly errorCode =
    ERROR_CODES.TREATMENT_CHARGE.DISCOUNT_LIMIT_EXCEEDED;
  public override readonly httpStatus = HttpStatus.FORBIDDEN;

  constructor(meta: DiscountLimitMeta) {
    super(
      `İndirim oranı klinik sınırını aşıyor (istenen %${meta.requestedRate}, izin verilen %${meta.maxAllowedRate}). Bu indirimi yalnız klinik yöneticisi onaylayabilir.`,
      meta
    );
  }
}

export class TreatmentChargeAlreadyVoidedException extends DomainException {
  public readonly errorCode = ERROR_CODES.TREATMENT_CHARGE.ALREADY_VOIDED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(chargeId: string) {
    super(`İşlem satırı zaten iptal edilmiş: ${chargeId}`);
  }
}

/**
 * Faturası kesilmiş randevunun satırı değiştirilemez — ticari belge dondu.
 */
export class TreatmentChargeAlreadyInvoicedException extends DomainException {
  public readonly errorCode = ERROR_CODES.TREATMENT_CHARGE.ALREADY_INVOICED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(appointmentId: string) {
    super(
      `Faturası kesilmiş randevunun işlem satırları değiştirilemez: ${appointmentId}`
    );
  }
}

/**
 * Fatura başlığı tek KDV oranı taşır (`Invoice.vatRate`); bu yüzden bir
 * randevunun satırları farklı oran taşıyamaz.
 */
export class MixedVatRateException extends DomainException {
  public readonly errorCode = ERROR_CODES.TREATMENT_CHARGE.MIXED_VAT_RATE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(appointmentId: string) {
    super(
      `Randevunun işlem satırları farklı KDV oranları taşıyor, tek faturada birleştirilemez: ${appointmentId}`
    );
  }
}

export class ChargeCurrencyMismatchException extends DomainException {
  public readonly errorCode = ERROR_CODES.TREATMENT_CHARGE.CURRENCY_MISMATCH;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(appointmentId: string) {
    super(
      `Randevunun işlem satırları farklı para birimleri taşıyor: ${appointmentId}`
    );
  }
}

export class NoChargesForAppointmentException extends DomainException {
  public readonly errorCode = ERROR_CODES.TREATMENT_CHARGE.NO_CHARGES;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(appointmentId: string) {
    super(`Randevunun ücretlendirilmiş işlem satırı yok: ${appointmentId}`);
  }
}

/**
 * Adet pozitif ve en çok 3 ondalık basamaklı olmalı.
 *
 * Kapı (zod şeması) bunu zorluyordu ama **varlığın kendi kuralı** entity'de
 * yoktu: sıfır adet bedelsiz bir satır, negatif adet ise negatif bir fatura
 * satırı üretiyordu (CLAUDE.md finans kuralı 10 — değişmez kural varlığın
 * çözümlendiği yerde zorlanır, tek bir çağrı yolunda değil).
 */
export class InvalidChargeQuantityException extends DomainException<{
  quantity: string;
}> {
  public readonly errorCode = ERROR_CODES.TREATMENT_CHARGE.INVALID_QUANTITY;

  constructor(quantity: string) {
    super(
      `İşlem adedi pozitif ve en fazla 3 ondalık basamaklı olmalı: ${quantity}`,
      { quantity }
    );
  }
}

/**
 * İndirim oranı 0–100 aralığında olmalı.
 *
 * Tavan kontrolü **politika**dır (yönetici aşabilir); bu ise **invariant**:
 * negatif indirim sessizce zamma dönüşüyor (matrah liste tutarının üstüne
 * çıkıyor), %100'ü aşan indirim ise `Money.subtract` üzerinden
 * "yetersiz bakiye" diyen, sebebinden kopuk bir hata üretiyordu.
 */
export class InvalidDiscountRateException extends DomainException<{
  discountRate: string;
}> {
  public readonly errorCode =
    ERROR_CODES.TREATMENT_CHARGE.INVALID_DISCOUNT_RATE;

  constructor(discountRate: string) {
    super(`İndirim oranı 0–100 arasında olmalı: ${discountRate}`, {
      discountRate,
    });
  }
}

/**
 * Liste fiyatı kuruş hassasiyetini aşıyor. DB kolonu `Decimal(10,2)`: üçüncü
 * basamak sessizce yuvarlanır ve satırın dondurulmuş fiyatı kaynağından kayar.
 */
export class ChargeInvalidPrecisionException extends DomainException<{
  amount: string;
}> {
  public readonly errorCode = ERROR_CODES.TREATMENT_CHARGE.INVALID_PRECISION;

  constructor(amount: string) {
    super(`Liste fiyatı en fazla iki ondalık basamak taşıyabilir: ${amount}`, {
      amount,
    });
  }
}
