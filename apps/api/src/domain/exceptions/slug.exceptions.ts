import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';

export class EmptySlugSourceException extends DomainException {
  readonly errorCode = ERROR_CODES.SLUG.EMPTY;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(message = 'Slug üretilecek metin boş olamaz.') {
    super(message);
  }
}
