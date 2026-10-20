import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { DomainException } from '@src/domain/exceptions/domain.exception';

export class ProviderNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.PROVIDER.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor() {
    super('Uzman bulunamadı.');
  }
}

export class ProviderNotShiftModeException extends DomainException {
  public readonly errorCode = ERROR_CODES.PROVIDER.INVALID_OPERATION_MODE;
  public override readonly httpStatus = HttpStatus.BAD_REQUEST;

  constructor() {
    super('Vardiya yalnızca SHIFT modundaki uzmanlar için tanımlanabilir.');
  }
}

export class ProviderNotStaticModeException extends DomainException {
  public readonly errorCode = ERROR_CODES.PROVIDER.INVALID_OPERATION_MODE;
  public override readonly httpStatus = HttpStatus.BAD_REQUEST;

  constructor() {
    super(
      'Statik müsaitlik yalnızca STATIC modundaki uzmanlar için tanımlanabilir.'
    );
  }
}

export class ProviderAlreadyDeleted extends DomainException {
  public readonly errorCode = ERROR_CODES.PROVIDER.ALREADY_DELETED;
  public override readonly httpStatus = HttpStatus.BAD_REQUEST;

  constructor() {
    super('Uzman zaten silinmiş.');
  }
}

export class ProviderNotAcceptingExaminationException extends DomainException<{
  specialistId?: string;
}> {
  readonly errorCode = ERROR_CODES.PROVIDER.NOT_ACCEPTING_EXAMINATION;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(specialistId?: string) {
    super('Uzman şu anda muayene randevusu kabul etmiyor.', { specialistId });
  }
}
