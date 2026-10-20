import { ERROR_CODES } from '../../../../../../packages/shared/common/constants/error-codes.constant';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { HttpStatus } from '@nestjs/common';
import { LogType } from '@src/domain/constants/log-action.constant';

/**
 * Denetim izi yazılamadı.
 *
 * Çağıranın kararını görünür kılmak için vardır: `AuditLogService` artık hatayı
 * kendi adına yutmuyor, bu hatayı fırlatıyor. Dinleyiciler bugün onu yakalayıp
 * log'luyor (ana işlem geri alınmaz — iz kaybı para hareketini iptal etmez);
 * outbox'tan beslenen bir dinleyici ise yeniden denenebilir.
 *
 * HTTP'ye ulaşması beklenmez (tüm çağrı yerleri dinleyici) ama `DomainException`
 * olması gerekir: `AllExceptionsFilter` tipsiz hatayı 500 olarak yutar, tipli
 * hata ise `errorCode` ile ayırt edilebilir.
 */
export class AuditLogWriteFailedException extends DomainException<{
  action: string;
  type: LogType;
}> {
  public readonly errorCode = ERROR_CODES.AUDIT_LOG.WRITE_FAILED;
  public override readonly httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;

  constructor(action: string, type: LogType) {
    super(`Denetim izi yazılamadı: ${action}`, { action, type });
  }
}
