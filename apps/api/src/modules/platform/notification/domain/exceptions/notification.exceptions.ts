import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { HttpStatus } from '@nestjs/common';

/**
 * Bildirim bulunamadığında veya bildirim istekte bulunan kullanıcıya ait
 * olmadığında fırlatılır (sızıntıyı önlemek için ikisi de NOT_FOUND).
 */
export class NotificationNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.NOTIFICATION.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(message = 'Bildirim bulunamadı.') {
    super(message);
  }
}
