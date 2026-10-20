import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';

/**
 * Klinik, seçilen tarihte (resmi tatil / özel kapatma istisnası) hizmet vermiyor.
 */
export class ClinicClosedOnDateException extends DomainException {
  public readonly errorCode = ERROR_CODES.CLINIC.CLOSED_ON_DATE;

  constructor(reason?: string | null) {
    super(
      reason
        ? `Klinik bu tarihte hizmet vermiyor: ${reason}`
        : 'Klinik bu tarihte kapalı veya çalışma saati tanımlı değil.'
    );
  }
}

/**
 * Kliniğin o gün için tanımlı bir çalışma saati yok ya da gün kapalı işaretli.
 */
export class ClinicNotWorkingDayException extends DomainException {
  public readonly errorCode = ERROR_CODES.CLINIC.NOT_WORKING_DAY;

  constructor(
    message = 'Klinik bu tarihte kapalı veya çalışma saati tanımlı değil.'
  ) {
    super(message);
  }
}

/**
 * İstenen zaman aralığı kliniğin açılış/kapanış saatlerinin dışında kalıyor.
 */
export class ClinicOutsideWorkingHoursException extends DomainException {
  public readonly errorCode = ERROR_CODES.CLINIC.OUTSIDE_WORKING_HOURS;

  constructor(message: string) {
    super(message);
  }
}
