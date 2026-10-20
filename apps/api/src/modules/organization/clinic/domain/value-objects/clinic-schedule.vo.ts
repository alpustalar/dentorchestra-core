import { DayMinuteRange } from '@src/domain/value-objects/day-minute-range.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { ClinicAvailability } from '@modules/organization/clinic/domain/entities/clinic-availability.entity';
import { ClinicException } from '@modules/organization/clinic/domain/entities/clinic-exception.entity';
import {
  ClinicClosedOnDateException,
  ClinicNotWorkingDayException,
  ClinicOutsideWorkingHoursException,
} from '@modules/organization/clinic/domain/exceptions/clinic-schedule.exceptions';

export interface ClinicBookingCheckInput {
  /** Talep edilen randevunun düştüğü gün (haftanın günü ve istisna eşleşmesi bundan çözülür). */
  date: Date;
  /** Talep edilen gün-içi zaman aralığı (dakika bazlı). */
  requestedRange: DayMinuteRange;
}

/**
 * Kliniğin çalışma takvimini (haftalık çalışma saatleri + tarih bazlı istisnalar) tek bir
 * değer nesnesi olarak sarmalar. `ProviderSchedule` VO'sunun klinik tarafındaki ikizidir:
 * availability + exception verisiyle bir zaman aralığının rezervasyona uygunluğunu denetler.
 *
 * Domain'den izole tutulur: HTTP exception (NestJS) yerine `DomainException` fırlatır ve
 * `{ isValid, isInvalid, orThrow }` guard biçimini döner.
 */
export class ClinicSchedule {
  private constructor(
    private readonly availabilities: ClinicAvailability[],
    private readonly exceptions: ClinicException[]
  ) {}

  public get validate() {
    return {
      bookingAvailability: (input: ClinicBookingCheckInput) =>
        this.bookingAvailability(input),
    };
  }

  static create(
    availabilities: ClinicAvailability[],
    exceptions: ClinicException[]
  ): ClinicSchedule {
    return new ClinicSchedule(availabilities, exceptions);
  }

  private bookingAvailability({
    date,
    requestedRange,
  }: ClinicBookingCheckInput) {
    // 1. Tarih bazlı istisna (resmi tatil / özel kapatma) kliniği o gün kapatıyor mu?
    const closedException = this.exceptions.find(
      (exception) => exception.isClosed && exception.isMatch(date)
    );
    if (closedException) {
      return this.returnValue(
        new ClinicClosedOnDateException(closedException.reason)
      );
    }

    // 2. O gün için tanımlı ve açık bir çalışma saati var mı?
    const dayOfWeek = DateTimeManager.getDayOfWeek(date);
    const availability = this.availabilities.find(
      (item) => item.dayOfWeek === dayOfWeek
    );

    if (!availability || availability.isClosed) {
      return this.returnValue(new ClinicNotWorkingDayException());
    }

    const workingHours = availability.timeRange;

    // 3. Başlangıç saati açılıştan önce olamaz.
    if (requestedRange.start.validate.isBefore(workingHours.start).value) {
      return this.returnValue(
        new ClinicOutsideWorkingHoursException(
          `İşlem başlangıç saati (${requestedRange.start.toString()}) kliniğin açılış saatinden (${workingHours.start.toString()}) önce olamaz.`
        )
      );
    }

    // 4. Bitiş saati kapanışı aşamaz.
    if (requestedRange.end.validate.isAfter(workingHours.end).value) {
      return this.returnValue(
        new ClinicOutsideWorkingHoursException(
          `İşlem bitiş saati (${requestedRange.end.toString()}) kliniğin kapanış saatini (${workingHours.end.toString()}) aşamaz.`
        )
      );
    }

    return this.returnValue(new Error(), true);
  }

  private returnValue(error: Error, isValid: boolean = false) {
    return {
      isValid,
      isInvalid: !isValid,
      orThrow: () => {
        if (!isValid) {
          throw error;
        }
      },
    };
  }
}
