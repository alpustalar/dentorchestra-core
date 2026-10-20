import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';
import { AccountingPeriodStatusType } from '@input-type-schemas/AccountingPeriodStatusSchema';
import type {
  ClosingNextPeriodUnavailableMeta,
  ClosingPreviewStaleMeta,
  PreviousPeriodNotClosedMeta,
} from '@shared/modules/accounting-period/interfaces';

interface PeriodStatusMeta {
  periodId?: string;
  currentStatus?: AccountingPeriodStatusType;
}

export class PeriodNotFoundException extends DomainException {
  readonly errorCode = ERROR_CODES.PERIOD.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;
  constructor() {
    super('Dönem bulunamadı');
  }
}

export class PeriodAlreadyClosedException extends DomainException<{
  periodId?: string;
  year?: number;
}> {
  readonly errorCode = ERROR_CODES.PERIOD.ALREADY_CLOSED;
  public override readonly httpStatus = HttpStatus.CONFLICT;
  constructor(periodId?: string, year?: number) {
    super('Dönem zaten kapatılmış', {
      periodId,
      year,
    });
  }
}

export class PeriodAlreadyExistsException extends DomainException<{
  year: number;
}> {
  readonly errorCode = ERROR_CODES.PERIOD.ALREADY_EXISTS;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(year: number) {
    super(`${year} yılı için muhasebe dönemi zaten mevcut.`, { year });
  }
}

export class InvalidPeriodLockException extends DomainException<PeriodStatusMeta> {
  readonly errorCode = ERROR_CODES.PERIOD.INVALID_LOCK_STATUS;
  public override readonly httpStatus = HttpStatus.CONFLICT;
  constructor(currentStatus?: AccountingPeriodStatusType) {
    super('Yalnızca açık dönemler kilitlenebilir.', { currentStatus });
  }
}

export class InvalidPeriodReopenException extends DomainException<PeriodStatusMeta> {
  readonly errorCode = ERROR_CODES.PERIOD.INVALID_REOPEN_STATUS;
  public override readonly httpStatus = HttpStatus.CONFLICT;
  constructor(currentStatus?: AccountingPeriodStatusType) {
    super('Yalnızca kilitli dönemler yeniden açılabilir.', { currentStatus });
  }
}

export class InvalidPeriodYearException extends DomainException<{
  year: number;
}> {
  readonly errorCode = ERROR_CODES.PERIOD.INVALID_YEAR;
  constructor(year: number) {
    super('Muhasebe dönemi yılı 2000-2100 aralığında olmalıdır.', { year });
  }
}

/**
 * Yevmiye numarası tahsisi / fiş atma sırasında dönem açık değil. Fiş atmanın
 * otoriter kapısı budur: numara tahsisi `status = 'OPEN'` koşuluyla yapıldığı
 * için kapanışla yarışan posting burada reddedilir.
 */
export class PeriodNotOpenException extends DomainException<PeriodStatusMeta> {
  readonly errorCode = ERROR_CODES.PERIOD.NOT_OPEN;
  public override readonly httpStatus = HttpStatus.CONFLICT;
  constructor(periodId?: string, currentStatus?: AccountingPeriodStatusType) {
    super('Dönem açık değil; bu döneme yeni fiş atılamaz.', {
      periodId,
      currentStatus,
    });
  }
}

export class PeriodNotLockedException extends DomainException<PeriodStatusMeta> {
  readonly errorCode = ERROR_CODES.PERIOD.NOT_LOCKED;
  public override readonly httpStatus = HttpStatus.CONFLICT;
  constructor(periodId?: string, currentStatus?: AccountingPeriodStatusType) {
    super('Dönem kilitli değil.', { periodId, currentStatus });
  }
}

export class PeriodNotClosedException extends DomainException<PeriodStatusMeta> {
  readonly errorCode = ERROR_CODES.PERIOD.NOT_CLOSED;
  public override readonly httpStatus = HttpStatus.CONFLICT;
  constructor(periodId?: string, currentStatus?: AccountingPeriodStatusType) {
    super('Dönem kapalı değil.', { periodId, currentStatus });
  }
}

/**
 * Durum geçişi koşullu UPDATE'te 0 satır etkiledi: dönem, biz okuduktan sonra
 * başka bir istek tarafından başka bir duruma alınmış. Çağıran tekrar deneyebilir.
 */
export class PeriodConcurrentTransitionException extends DomainException<{
  periodId: string;
  expectedStatus: AccountingPeriodStatusType;
}> {
  readonly errorCode = ERROR_CODES.PERIOD.CONCURRENT_TRANSITION;
  public override readonly httpStatus = HttpStatus.CONFLICT;
  constructor(periodId: string, expectedStatus: AccountingPeriodStatusType) {
    super(
      'Dönem durumu bu istek sürerken değişti; işlem uygulanmadı. Tekrar deneyin.',
      { periodId, expectedStatus }
    );
  }
}

/**
 * Belge tarihi **mühürlenmiş** bir döneme düşüyor (LOCKED/CLOSED).
 *
 * Neden yazma kapısında durduruluyor: belge kabul edilse ekonomik olay yazılır
 * ama fişi hiç üretilemez (posting dönem kapısında reddeder). Olay defteri
 * append-only olduğu için tarih sonradan düzeltilemez; olay sonsuza dek fişsiz
 * kalır, her süpürme turunda aynı CRITICAL uyarıyı üretir ve tek çıkış yolu
 * dönemi yeniden açmaktır (yüksek etkili işlem). Ret, kullanıcının tarihi hâlâ
 * düzeltebildiği yerde verilir.
 */
export class PeriodSealedForDateException extends DomainException<{
  clinicId: string;
  date: string;
  year: number;
  currentStatus: AccountingPeriodStatusType;
}> {
  readonly errorCode = ERROR_CODES.PERIOD.SEALED_FOR_DATE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: {
    clinicId: string;
    date: Date;
    year: number;
    currentStatus: AccountingPeriodStatusType;
  }) {
    super(
      `${meta.year} muhasebe dönemi ${meta.currentStatus === 'CLOSED' ? 'kapatılmış' : 'kilitli'}; ` +
        'bu tarihe belge kaydedilemez.',
      {
        clinicId: meta.clinicId,
        date: meta.date.toISOString(),
        year: meta.year,
        currentStatus: meta.currentStatus,
      }
    );
  }
}

/**
 * Önceki yıl kapanmadan sonraki yıl kapatılamaz.
 *
 * Yıllar sırayla kapanır: kapanmamış bir yıl varken sonrakini kapatmak, o yıl hâlâ fiş
 * alabilirken kâr/zarar zincirinin (590/591) bir yıl atlanarak ilerlemesi demektir ve geri
 * alınamaz (CLOSED'dan dönüş yok). Ayrıca ertesi yıla yazılan GRNI ters kaydı kapalı bir
 * döneme düşemez; sıra bu yüzden zorunludur.
 */
export class PreviousPeriodNotClosedException extends DomainException<PreviousPeriodNotClosedMeta> {
  readonly errorCode = ERROR_CODES.PERIOD.PREVIOUS_NOT_CLOSED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: PreviousPeriodNotClosedMeta) {
    super(
      `${meta.year} yılı kapatılamaz: önce ${meta.blockingYear} yılı kapatılmalıdır.`,
      meta
    );
  }
}

/**
 * Önizleme ile kapanış arasında dönemin defterine fiş girdi (yevmiye sayacı ilerledi).
 *
 * Kapanış geri alınamaz; muhasebeci GÖRMEDİĞİ tutarlarla kapatmamalıdır. Önizleme sayacı
 * döndürür, kapanış onu geri ister — farklıysa kapanış reddedilir ve önizleme yenilenir.
 */
export class ClosingPreviewStaleException extends DomainException<ClosingPreviewStaleMeta> {
  readonly errorCode = ERROR_CODES.PERIOD.CLOSING_PREVIEW_STALE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: ClosingPreviewStaleMeta) {
    super(
      'Önizlemeden sonra dönemin defterine yeni fiş girdi; kapanış tutarları değişmiş olabilir. Önizlemeyi yenileyin.',
      meta
    );
  }
}

/**
 * GRNI ters kaydının yazılacağı ertesi yıl dönemi yok ya da açık değil. Ters kayıt ertesi
 * yılın 1 Ocak'ına yazılır; dönem yoksa/kapalıysa tahakkuk yazılsa bile geri alınamaz.
 */
export class ClosingNextPeriodUnavailableException extends DomainException<ClosingNextPeriodUnavailableMeta> {
  readonly errorCode = ERROR_CODES.PERIOD.CLOSING_NEXT_PERIOD_UNAVAILABLE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: ClosingNextPeriodUnavailableMeta) {
    super(
      meta.reason === 'MISSING'
        ? `${meta.nextYear} dönemi açılmamış; GRNI tahakkukunun ters kaydı yazılamaz.`
        : `${meta.nextYear} dönemi açık değil; GRNI tahakkukunun ters kaydı yazılamaz.`,
      meta
    );
  }
}
