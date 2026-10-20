import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../shared/common/constants/error-codes.constant';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { MappedException } from './exception-mapping';

/**
 * Tüm servislerin ortak hata sözleşmesi.
 *
 * Burada yalnız her serviste aynı olan üç dal var: `DomainException` (kendi
 * `httpStatus`/`errorCode`/`meta`'sını taşır), NestJS `HttpException` ve
 * bilinmeyen hata (500). Veritabanına özgü dallar (ör. Prisma) çekirdeğe
 * girmez — çekirdek Faz 3.2'de bilinçli olarak Prisma'dan koparıldı ve
 * messaging'in Prisma'sı yok. Onlar `mapPlatformException` ile eklenir.
 */
@Catch()
export class BaseExceptionFilter implements ExceptionFilter {
  protected readonly logger = new Logger('HTTP_ERROR');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const mapped = this.mapException(exception);

    this.logger.error(
      `❌ [${mapped.errorCode}] ${request.method} ${request.url} | Status: ${mapped.status} | Message: ${JSON.stringify(mapped.message)} ${mapped.meta ? `| Meta: ${JSON.stringify(mapped.meta)}` : ''}`
    );

    response.status(mapped.status).json({
      success: false,
      statusCode: mapped.status,
      path: request.url,
      code: mapped.errorCode,
      error: mapped.message,
      meta: mapped.meta,
      timestamp: DateTimeManager.create().toISOString(),
    });
  }

  /**
   * Servise özgü hata ailelerini karşılamak için genişletme noktası.
   * Tanımadığı hatada `null` döner ve taban 500'e düşer.
   */
  protected mapPlatformException(_exception: unknown): MappedException | null {
    return null;
  }

  private mapException(exception: unknown): MappedException {
    if (exception instanceof DomainException) {
      return {
        status: exception.httpStatus,
        message: exception.message,
        errorCode: exception.errorCode,
        meta: exception.meta,
      };
    }

    if (exception instanceof HttpException) {
      return this.mapHttpException(exception);
    }

    return (
      this.mapPlatformException(exception) ?? {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal Server Error',
        errorCode: 'INTERNAL_SERVER_ERROR',
      }
    );
  }

  private mapHttpException(exception: HttpException): MappedException {
    const status = exception.getStatus();
    const httpResponse = exception.getResponse();

    if (typeof httpResponse !== 'object' || httpResponse === null) {
      return {
        status,
        message: httpResponse,
        errorCode: ERROR_CODES.HTTP.ERROR,
      };
    }

    const body = httpResponse as { message?: unknown };

    // Doğrulama hatalarında mesaj bir dizidir; frontend'in alan bazlı gösterebilmesi
    // için diziyi `meta.validationErrors`'a taşıyıp okunur bir metin koyuyoruz.
    if (status === HttpStatus.BAD_REQUEST && Array.isArray(body.message)) {
      return {
        status,
        message: 'İstek verileri doğrulamadan geçemedi.',
        errorCode: ERROR_CODES.VALIDATION.FAILED,
        meta: { validationErrors: body.message },
      };
    }

    return {
      status,
      message: body.message ?? httpResponse,
      errorCode: ERROR_CODES.HTTP.ERROR,
    };
  }
}
