import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { HttpStatus } from '@nestjs/common';

export class LeaveNotFoundException extends DomainException<{
  leaveId?: string;
}> {
  readonly errorCode = ERROR_CODES.LEAVE.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(leaveId?: string) {
    super('İzin talebi bulunamadı.', { leaveId });
  }
}

export class LeaveNotPendingException extends DomainException<{
  currentStatus?: string;
}> {
  readonly errorCode = ERROR_CODES.LEAVE.NOT_PENDING;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(currentStatus?: string) {
    super('Yalnızca bekleyen izin talepleri bu işleme uygundur.', {
      currentStatus,
    });
  }
}

export class LeaveInsufficientBalanceException extends DomainException<{
  requested: number;
  remaining: number;
}> {
  readonly errorCode = ERROR_CODES.LEAVE.INSUFFICIENT_BALANCE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(requested: number, remaining: number) {
    super(
      `Yıllık izin bakiyesi yetersiz. Talep edilen ${requested} gün, kalan ${remaining} gün.`,
      { requested, remaining }
    );
  }
}
