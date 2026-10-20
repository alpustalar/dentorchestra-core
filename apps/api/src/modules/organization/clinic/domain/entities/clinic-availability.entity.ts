import { DayMinuteRange } from '@src/domain/value-objects/day-minute-range.vo';
import { DayMinute } from '@src/domain/value-objects/day-minute.vo';
import { ClinicAvailability as IClinicAvailability } from '@shared/generated-zod';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { TimeZoneType } from '@input-type-schemas/TimeZoneSchema';
import { ClinicAvailabilityCreateProps } from '@modules/organization/clinic/domain/contracts/clinic-availability';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Guard } from '@common/domain/guards';

export class ClinicAvailability {
  constructor(data: IClinicAvailability) {
    const timeRangeVo = DayMinuteRange.fromNumbers(
      data.startMinute,
      data.endMinute
    );

    this._id = UUID.fromTrusted(data.id);
    this._clinicId = UUID.fromTrusted(data.clinicId);

    this._dayOfWeek = data.dayOfWeek;
    this._isClosed = data.isClosed;

    this._timeRange = timeRangeVo;
  }

  static get validate() {
    return {
      isDayOfWeek: (day: number) => {
        const isInValid = day < 0 || day > 6;
        return Guard.monitor(
          day,
          !isInValid,
          () =>
            new Error(
              'Geçersiz gün değeri. Hafta günleri 0 ile 6 arasında olmalıdır.'
            )
        );
      },
    };
  }

  private _id: UUID;

  get id(): UUID {
    return this._id;
  }

  private _clinicId: UUID;

  get clinicId(): UUID {
    return this._clinicId;
  }

  private _dayOfWeek: number;

  get dayOfWeek(): number {
    return this._dayOfWeek;
  }

  get startMinute(): number {
    return this.timeRange.start.toNumber();
  }

  get endMinute(): number {
    return this.timeRange.end.toNumber();
  }

  private _isClosed: boolean;

  get isClosed(): boolean {
    return this._isClosed;
  }

  private _timeRange: DayMinuteRange;

  get timeRange(): DayMinuteRange {
    return this._timeRange;
  }

  public get validate() {
    return {
      timeSlotAvailable: (checkTime: Date, tz?: TimeZoneType) =>
        this.isTimeSlotAvailable(checkTime, tz),
      overlapsWith: (other: ClinicAvailability) => this.overlapsWith(other),
    };
  }

  /**
   *  çalışma saati kuralı oluşturma
   */
  public static create(
    props: ClinicAvailabilityCreateProps
  ): ClinicAvailability {
    this.validate.isDayOfWeek(props.dayOfWeek).orThrow();

    const startMinute = DayMinute.fromNumber(props.startMinute);
    const endMinute = DayMinute.fromNumber(props.endMinute);

    const availabilityMinuteRange = DayMinuteRange.create(
      startMinute.orThrow(),
      endMinute.orThrow()
    );

    return new ClinicAvailability({
      id: UUID.createOrGenerate(props.id).value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      dayOfWeek: props.dayOfWeek,
      startMinute: availabilityMinuteRange.orThrow().start.toNumber(),
      endMinute: availabilityMinuteRange.orThrow().end.toNumber(),
      isClosed: props.isClosed ?? false,
    });
  }

  /**
   * Çalışma saatlerini yeni bir DayMinuteRange VO'su ile günceller
   */
  public updateHours(newRange: DayMinuteRange): void {
    if (this._isClosed) {
      throw new Error('Klinik o gün kapalıyken saat güncellemesi yapılamaz.');
    }
    this._timeRange = newRange;
  }

  /**
   * Kliniğin o günkü kapalılık durumunu değiştirir
   */
  public toggleClosedStatus(isClosed: boolean): void {
    this._isClosed = isClosed;
  }

  toPersistence(): IClinicAvailability {
    return {
      id: this.id.value,
      clinicId: this.clinicId.value,
      dayOfWeek: this.dayOfWeek,
      startMinute: this.startMinute,
      endMinute: this.endMinute,
      isClosed: this.isClosed,
    };
  }

  /**
   * 🎯 Verilen bir Date nesnesinin bu çalışma saatlerine uygunluğunu geometric olarak denetler
   */
  /**
   * 🎯 Verilen bir Date nesnesinin bu çalışma saatlerine uygunluğunu geometrik olarak denetler.
   */
  private isTimeSlotAvailable(
    checkTime: Date,
    tz?: TimeZoneType
  ): Guard<boolean> {
    // Erken Çıkış (Early Return): Klinik kapalıysa veya aralık yoksa zaman hesaplamalarına hiç girme
    if (this.isClosed || !this.timeRange) {
      return Guard.monitor(
        false,
        false,
        () => new Error('Klinik belirtilen günde hizmet vermemektedir.')
      );
    }

    // 2. Zaman Dilimi ve Dakika Hesaplamaları
    const targetDay = DateTimeManager.getDayOfWeek(checkTime, tz);
    const currentMinutes = DateTimeManager.getDayMinutes(checkTime, tz);
    const targetDayMinute = DayMinute.fromNumber(currentMinutes);

    // 3. Geometrik ve Günsel Matris Doğrulaması
    const isDayValid = targetDay === this.dayOfWeek;
    const isTimeValid = this.timeRange.validate.contains(
      targetDayMinute.orThrow()
    ).value;

    const isValid = isDayValid && isTimeValid;

    // 4. Guard Mühürlemesi (Eğer hata mesajı geçilmezse DayMinuteRange'den gelen dinamik hata da patlayabilir, ama burası en dış baraj)
    return Guard.monitor(
      isValid,
      isValid,
      () => new Error('Verilen saatler çalışma saatlerine uygun değil.')
    );
  }

  /**
   * Başka bir çalışma saati periyoduyla çakışma (overlap) analizi yapar
   */
  private overlapsWith(other: ClinicAvailability): Guard<boolean> {
    // 1. Geometrik olarak çakışmanın İMKANSIZ olduğu güvenli durumları (Safe Conditions) tanımlayalım:
    const isDifferentDay = this.dayOfWeek !== other.dayOfWeek;
    const isAnyClosedOrMissing =
      this.isClosed || other.isClosed || !this.timeRange || !other.timeRange;

    // 2. Eğer günler farklıysa VEYA günlerden biri kapalıysa -> ÇAKIŞMA İMKANSIZDIR (Sistem Güvenlidir)
    const isCollisionImpossible = isDifferentDay || isAnyClosedOrMissing;

    if (isCollisionImpossible) {
      // 🚀 Çakışma imkansız olduğu için bu durum bizim için GEÇERLİDİR (True, True)
      return Guard.monitor(true, true, () => new Error());
    }

    // 3. Yukarıdaki bariyerleri geçtiysek: Aynı gündeler, ikisi de açık ve zaman aralıkları var.
    // Şimdi DayMinuteRange matris geometrisini çalıştırıp gerçek çakışma testini yapabiliriz.
    return this.timeRange.validate.overlapsWith(
      other.timeRange,
      `[Vardiya Çakışması] ${this.dayOfWeek} günü için tanımlanan çalışma saatleri başka bir periyotla çakışıyor.`
    );
  }
}
