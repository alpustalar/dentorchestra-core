import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { HttpStatus } from '@nestjs/common';

export class ConsentTemplateNotFoundException extends DomainException<{
  templateId?: string;
}> {
  readonly errorCode = ERROR_CODES.CONSENT_TEMPLATE.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(templateId?: string) {
    super('Onam formu şablonu bulunamadı.', { templateId });
  }
}

export class ConsentTemplateAlreadyArchivedException extends DomainException<{
  templateId?: string;
}> {
  readonly errorCode = ERROR_CODES.CONSENT_TEMPLATE.ALREADY_ARCHIVED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(templateId?: string) {
    super('Onam formu şablonu zaten arşivlenmiş.', { templateId });
  }
}

export class ConsentTemplateArchivedException extends DomainException<{
  templateId?: string;
}> {
  readonly errorCode = ERROR_CODES.CONSENT_TEMPLATE.ARCHIVED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(templateId?: string) {
    super('Arşivlenmiş bir onam formu şablonuna yeni imza atılamaz.', {
      templateId,
    });
  }
}

export class ConsentFormSubmissionNotFoundException extends DomainException<{
  submissionId?: string;
}> {
  readonly errorCode = ERROR_CODES.CONSENT_FORM.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(submissionId?: string) {
    super('İmzalanmış onam formu bulunamadı.', { submissionId });
  }
}
