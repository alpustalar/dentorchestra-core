import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../packages/shared/common/constants/error-codes.constant';

/**
 * Optimistic concurrency çakışması — version-guard'lı bir `update()` sırasında kayıt
 * başka bir işlem tarafından güncellenmişse fırlatılır (etkilenen satır = 0). Frontend
 * 409 alır, en güncel veriyi yeniden çekip işlemi tekrar denemelidir.
 */
export class ConcurrencyConflictException extends DomainException {
  public readonly errorCode = ERROR_CODES.COMMON.CONCURRENCY_CONFLICT;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(aggregate: string, id: string) {
    super(
      `${aggregate} (${id}) bu sırada başka bir işlem tarafından güncellendi. ` +
        `Lütfen en güncel veriyi alıp tekrar deneyin.`
    );
  }
}
