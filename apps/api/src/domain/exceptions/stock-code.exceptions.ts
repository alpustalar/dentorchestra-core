import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';

export class InvalidStockCodeException extends DomainException {
  readonly errorCode = ERROR_CODES.STOCK_CODE.INVALID;
  public override readonly httpStatus = HttpStatus.UNPROCESSABLE_ENTITY;

  constructor(message = 'Geçersiz stok kodu sağlandı.') {
    super(message);
  }
}
