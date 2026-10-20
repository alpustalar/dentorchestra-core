import { BaseRules } from '@common/domain/rules/base.rules';
import { ValidateOptionsType } from '@shared/common/validate-options/validate-options.type';
import { ProviderShift } from '@modules/clinical/provider/domain/entities/provider-shift.entity';
import { UpdateHoursAndDateProps } from '@modules/clinical/provider/domain/contracts';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { isDefined } from '@common/utils';
import { DayMinute } from '@src/domain/value-objects/day-minute.vo';
import { DayMinuteRange } from '@src/domain/value-objects/day-minute-range.vo';
import { DefaultValidateOptions } from '@common/domain/constants/default-options.constant';

export class ProviderShiftRules extends BaseRules {
  constructor(
    private readonly providerShift: ProviderShift,
    private readonly validateOptions: ValidateOptionsType = DefaultValidateOptions
  ) {
    super();
  }

  /**
   * Mola ve Vardiya Yapılandırma Kontrolü
   */
  updateHoursAndDate(props: UpdateHoursAndDateProps) {
    let isValid = true;
    let error: Error | null = null;

    // Tarih Validasyonu
    if (props.date) {
      const date = DateTimeManager.create(props.date);
      const now = DateTimeManager.create();
      if (DateTimeManager.isBefore(date, now, 'day')) {
        isValid = false;
        error = new Error(
          'Uzman takviminde değişiklik yaparken geçmiş bir tarih seçemezsiniz.'
        );
      }
    }

    const start = props.startMinute ?? this.providerShift.startMinute;
    const end = props.endMinute ?? this.providerShift.endMinute;

    const breakStart =
      props.breakStartMinute ?? this.providerShift.breakStartMinute;
    const breakEnd = props.breakEndMinute ?? this.providerShift.breakEndMinute;

    let shiftRange: DayMinuteRange | null = null;
    let breakRange: DayMinuteRange | null = null;

    if (isDefined(start) && isDefined(end)) {
      const startDayMinute =
        typeof start === 'number'
          ? DayMinute.fromNumber(start)
          : DayMinute.fromString(start);

      const endDayMinute =
        typeof end === 'number'
          ? DayMinute.fromNumber(end)
          : DayMinute.fromString(end);

      shiftRange = DayMinuteRange.create(
        startDayMinute.orThrow(),
        endDayMinute.orThrow()
      ).orThrow();
    }

    if (isDefined(breakStart) && isDefined(breakEnd)) {
      const breakStartDayMinute =
        typeof breakStart === 'number'
          ? DayMinute.fromNumber(breakStart)
          : DayMinute.fromString(breakStart);

      const breakEndDayMinute =
        typeof breakEnd === 'number'
          ? DayMinute.fromNumber(breakEnd)
          : DayMinute.fromString(breakEnd);

      breakRange = DayMinuteRange.create(
        breakStartDayMinute.orThrow(),
        breakEndDayMinute.orThrow()
      ).orThrow();
    }

    if (isValid && shiftRange && breakRange) {
      const isBreakWithinShift =
        breakRange.validate.isCompletelyWithIn(shiftRange).value;
      if (!isBreakWithinShift) {
        isValid = false;
        error = new Error('Mola saatleri, mesai saatlerinin dışına taşamaz.');
      }
    }

    return this.evaluate(
      isValid,
      () => error ?? new Error('Geçersiz işlem.'),
      this.validateOptions
    );
  }
}
