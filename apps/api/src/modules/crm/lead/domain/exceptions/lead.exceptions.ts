import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { HttpStatus } from '@nestjs/common';

export class InvalidLeadStatusTransitionException extends DomainException<{
  requiredStatus: string;
  currentStatus?: string;
}> {
  readonly errorCode = ERROR_CODES.LEAD.INVALID_STATUS_TRANSITION;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(required: string, current?: string) {
    super(`Yalnızca ${required} statüsündeki leadler bu işleme uygun.`, {
      requiredStatus: required,
      currentStatus: current,
    });
  }
}

export class LeadAlreadyFinalizedException extends DomainException<{
  leadId?: string;
}> {
  readonly errorCode = ERROR_CODES.LEAD.ALREADY_FINALIZED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(leadId?: string) {
    super('Bu lead zaten dönüştürülmüş veya kaybedilmiş.', { leadId });
  }
}

export class LeadNotFoundException extends DomainException<{ leadId: string }> {
  readonly errorCode = ERROR_CODES.LEAD.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(leadId?: string) {
    super('Lead bulunamadı.', { leadId });
  }
}

/**
 * Convert'te bağlanacak hedef yok: patientId verilmedi, lead'de otomatik hasta
 * oluşturacak telefon/isim yok ve appointmentId da yok.
 */
export class LeadConvertMissingTargetException extends DomainException<{
  leadId?: string;
}> {
  readonly errorCode = ERROR_CODES.LEAD.CONVERT_MISSING_TARGET;

  constructor(leadId?: string) {
    super(
      'Dönüştürmek için mevcut bir hasta, otomatik hasta oluşturacak telefon+isim ya da randevu gerekli.',
      { leadId }
    );
  }
}
