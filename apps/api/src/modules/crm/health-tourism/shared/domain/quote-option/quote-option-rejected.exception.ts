import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import {
  QuoteOptionKind,
  QuoteOptionRejection,
} from '@modules/crm/health-tourism/shared/domain/quote-option/quote-option.contracts';

interface QuoteOptionRejectedMeta extends Record<string, unknown> {
  kind: QuoteOptionKind;
  reason: QuoteOptionRejection;
}

/**
 * Teklif bu görüşmeye ait değil.
 *
 * Mesaj **hastaya ulaşır** (`AiToolExecutor` domain hatasının mesajını araç
 * sonucuna koyar), bu yüzden kimlik/kiracı bilgisi taşımaz: ayrıntı uyarı
 * kanalına gider. Tek yapılması gereken yeniden arama olduğu için mesaj da onu
 * söyler.
 */
export class QuoteOptionRejectedException extends DomainException<QuoteOptionRejectedMeta> {
  public readonly errorCode = ERROR_CODES.QUOTE_OPTION.REJECTED;
  public override readonly httpStatus = HttpStatus.FORBIDDEN;

  constructor(kind: QuoteOptionKind, reason: QuoteOptionRejection) {
    super(
      'Bu fiyat seçeneği bu görüşmeye ait değil. Lütfen tekrar arama yapın.',
      { kind, reason }
    );
  }
}
