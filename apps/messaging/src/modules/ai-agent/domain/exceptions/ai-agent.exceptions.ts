import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../../packages/shared/common/constants/error-codes.constant';

/**
 * Klinik için AI asistan yapılandırması hiç oluşturulmamış. Aç/kapa yapabilmek
 * için önce yapılandırma kaydı gerekir.
 */
export class AiAgentConfigNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.MESSAGING.AI_AGENT_CONFIG_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(
    message = 'AI asistan yapılandırması bulunamadı; önce yapılandırın.'
  ) {
    super(message);
  }
}
