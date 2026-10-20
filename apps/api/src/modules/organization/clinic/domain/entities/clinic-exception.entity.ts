import { ClinicException as IClinicException } from '@shared';
import { ClinicExceptionCreateProps } from '@modules/organization/clinic/domain/contracts/clinic-exception';
import { Guard } from '@common/domain/guards';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

export class ClinicException {
  // 🎯 Proje standardına uygun olarak PUBLIC constructor kalıyor
  constructor(data: IClinicException) {
    this._id = UUID.fromTrusted(data.id);
    this._clinicId = UUID.fromTrusted(data.clinicId);

    // Tarihi saat/dakika karmaşasından kurtarmak için saf güne (00:00:00) eşitliyoruz
    this._date = this.normalizeDate(data.date);

    this._isClosed = data.isClosed;
    this._reason = data.reason ?? null;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _date: Date;
  get date(): Date {
    return this._date;
  }

  private _isClosed: boolean;
  get isClosed(): boolean {
    return this._isClosed;
  }

  private _reason: string | null;
  get reason(): string | null {
    return this._reason;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 🚀 Akıllı Factory Metotları
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Bu istisna gününün geçmişte kalıp kalmadığını söyler
   */
  public get isPast() {
    const today = this.normalizeDate(DateTimeManager.create());
    const isPast = this._date.getTime() < today.getTime();
    return Guard.monitor(
      isPast,
      isPast,
      () => new Error('Gün geçmişte kalmamış')
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 🎯 İş Kuralları (Business Logic)
  // ────────────────────────────────────────────────────────────────────────────

  public get validate() {
    return {
      isMatch: (checkDate: Date) => this.isMatch(checkDate),
      isPast: this.isPast,
    };
  }

  /** `reason` gönderildiyse boş string olamaz (null/undefined serbest). */
  private static isValidReason(
    reason?: string | null
  ): Guard<string | null | undefined> {
    const isInvalid =
      reason !== undefined && reason !== null && reason.trim().length === 0;
    return Guard.monitor(
      reason,
      !isInvalid,
      () => new Error('İstisna gerekçesi boş bırakılamaz.')
    );
  }

  /**
   * 🎯 Yeni bir klinik istisnası (Resmi tatil, özel kapatma vs.) oluşturma kapısı
   */
  public static create(props: ClinicExceptionCreateProps): ClinicException {
    ClinicException.isValidReason(props.reason).orThrow();

    return new ClinicException({
      id: UUID.createOrGenerate(props.id).value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      date: props.date,
      isClosed: props.isClosed ?? true,
      reason: props.reason ?? null,
    });
  }

  /**
   * İstisnanın nedenini ve kapatılma durumunu günceller
   */

  public updateReason(reason: string | null, isClosed?: boolean): void {
    ClinicException.isValidReason(reason).orThrow();

    this._reason = reason;
    if (isClosed !== undefined) {
      this._isClosed = isClosed;
    }
  }

  /**
   * 🎯 Verilen bir randevu tarihinin bu istisna gününe denk gelip gelmediğini kontrol eder
   */

  public isMatch(checkDate: Date) {
    const target = this.normalizeDate(checkDate);
    const isMatch = this._date.getTime() === target.getTime();
    return Guard.monitor(
      isMatch,
      isMatch,
      () => new Error('Randevu tarihi istisna gününe denk gelmiyor.')
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Yardımcı Metotlar & Serileştirme
  // ────────────────────────────────────────────────────────────────────────────

  toPersistence(): IClinicException {
    return {
      id: this.id.value,
      clinicId: this.clinicId.value,
      date: this.date,
      isClosed: this.isClosed,
      reason: this.reason,
    };
  }

  /**
   * Tarihin saat, dakika, saniye ve milisaniyesini sıfırlayarak
   * sadece gün bazında (pure date) karşılaştırma yapılabilmesini sağlar.
   */
  private normalizeDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }
}
