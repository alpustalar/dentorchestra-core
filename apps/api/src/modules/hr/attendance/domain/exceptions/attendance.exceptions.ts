import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { HttpStatus } from '@nestjs/common';

export class AttendanceNotFoundException extends DomainException<{
  attendanceId?: string;
}> {
  readonly errorCode = ERROR_CODES.ATTENDANCE.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(attendanceId?: string) {
    super('Devam/mesai kaydı bulunamadı.', { attendanceId });
  }
}

export class AttendanceAlreadyRecordedException extends DomainException<{
  employeeId: string;
  workDate: string;
}> {
  readonly errorCode = ERROR_CODES.ATTENDANCE.ALREADY_RECORDED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(employeeId: string, workDate: string) {
    super('Bu çalışan için bugüne ait bir devam/mesai kaydı zaten var.', {
      employeeId,
      workDate,
    });
  }
}

export class AttendanceNotCheckedInException extends DomainException<{
  employeeId: string;
}> {
  readonly errorCode = ERROR_CODES.ATTENDANCE.NOT_CHECKED_IN;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(employeeId: string) {
    super('Çalışanın açık bir giriş kaydı yok; önce giriş yapılmalı.', {
      employeeId,
    });
  }
}

export class AttendanceAlreadyClosedException extends DomainException<{
  attendanceId?: string;
}> {
  readonly errorCode = ERROR_CODES.ATTENDANCE.ALREADY_CLOSED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(attendanceId?: string) {
    super('Bu kayıt için çıkış zaten yapılmış.', { attendanceId });
  }
}

export class AttendanceInvalidTimeRangeException extends DomainException {
  readonly errorCode = ERROR_CODES.ATTENDANCE.INVALID_TIME_RANGE;

  constructor(message = 'Çıkış saati giriş saatinden önce olamaz.') {
    super(message);
  }
}
