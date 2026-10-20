import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions';
import { ERROR_CODES } from '../../../../../../../../../packages/shared/common/constants/error-codes.constant';
import type {
  ClosingAccountsMissingMeta,
  GrniAccrualNotEligibleMeta,
  UnmappedCostAccountMeta,
} from '@shared/modules/accounting-period/interfaces';

/**
 * Bakiyesi olan 7. sınıf hesap yıl sonu yansıtma eşlemesinde yok.
 *
 * Bilerek hata: eşlemesiz hesabı sessizce doğrudan 690'a kapatmak kârı aynı bırakır ama kapanmış
 * yılın kesin mizanında maliyeti 6. sınıfta değil 7. sınıfta gösterir ve fiş dengeli olduğu için
 * hiçbir kontrol yakalamaz. Şablon her 7xx hesabını eşlemede tuttuğundan (spec zorlar) bu hata
 * normalde oluşmaz; oluştuysa şablon ile eşleme ayrışmıştır.
 */
export class UnmappedCostAccountException extends DomainException<UnmappedCostAccountMeta> {
  public readonly errorCode = ERROR_CODES.POSTING.UNMAPPED_COST_ACCOUNT;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: UnmappedCostAccountMeta) {
    super(
      `Bakiyesi olan 7. sınıf hesap(lar) yansıtma eşlemesinde yok: ${meta.codes.join(', ')}`,
      meta
    );
  }
}

/**
 * Kapanışın yazacağı hesaplardan bazıları klinik hesap planında yok.
 *
 * Şablon sonradan genişleyince (622/631/632 gibi) mevcut kliniklerde bu hesaplar bulunmaz.
 * Kapanış tek transaction'dır; ortada `AccountCodeNotFound` ile patlarsa her şey geri alınır ama
 * muhasebeci yalnız İLK eksik kodu görürdü. Eksiklerin tamamı baştan listelenir; çözüm hesap
 * planı kurulum komutunu yeniden çalıştırmaktır (idempotent, yalnız eksikleri ekler).
 */
export class ClosingAccountsMissingException extends DomainException<ClosingAccountsMissingMeta> {
  public readonly errorCode = ERROR_CODES.POSTING.CLOSING_ACCOUNTS_MISSING;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: ClosingAccountsMissingMeta) {
    super(
      `Yıl sonu kapanışı için hesap planında eksik hesap(lar): ${meta.missingCodes.join(', ')}. ` +
        'Hesap planı kurulumunu yeniden çalıştırın.',
      meta
    );
  }
}

/**
 * GRNI tahakkuku seçildi ama ters kaydın yazılacağı ertesi yılın başlangıcı verilmedi.
 * Çağıran (kapanış handler'ı) ertesi yıl dönemini baştan doğrular; bu savunma hattıdır.
 */
export class ClosingNextPeriodRequiredException extends DomainException<
  Record<string, never>
> {
  public readonly errorCode = ERROR_CODES.POSTING.CLOSING_NEXT_PERIOD_REQUIRED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor() {
    super(
      'GRNI tahakkukunun ters kaydı için ertesi yıl dönemi gereklidir.',
      undefined
    );
  }
}

/**
 * Seçilen sipariş 31 Aralık itibarıyla tahakkuk edilemez (aday değil ya da yabancı para).
 * Tutar istemciden alınmaz; aday listesi sunucuda hesaplanır, seçim yalnız o listeden yapılır.
 */
export class GrniAccrualNotEligibleException extends DomainException<GrniAccrualNotEligibleMeta> {
  public readonly errorCode = ERROR_CODES.POSTING.GRNI_ACCRUAL_NOT_ELIGIBLE;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(meta: GrniAccrualNotEligibleMeta) {
    super(
      meta.reason === 'FOREIGN_CURRENCY'
        ? `Yabancı para birimli sipariş tahakkuk edilemez (kur değerlemesi kapsam dışı): ${meta.orderId}`
        : `Sipariş dönem sonu itibarıyla tahakkuk adayı değil: ${meta.orderId}`,
      meta
    );
  }
}
