import { Catch, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaErrorMap } from '@common/constants';
import { ERROR_CODES } from '../../../../../../packages/shared/common/constants/error-codes.constant';
import { BaseExceptionFilter, MappedException } from '@src/http';

/**
 * Çekirdek filtresinin api'ye özgü genişletmesi: Prisma hataları.
 * Ortak dallar (DomainException, HttpException, 500) tabandadır.
 */
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  protected override mapPlatformException(
    exception: unknown
  ): MappedException | null {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const errorConfig = PrismaErrorMap[exception.code];
      // Haritada yoksa tanımadığımız bir Prisma kodu — taban 500'e düşsün.
      if (!errorConfig) return null;

      return {
        status: errorConfig.status,
        message: errorConfig.userMessage,
        errorCode: `PRISMA.${exception.code}`,
        meta: { prismaTarget: exception.meta?.target },
      };
    }

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Veritabanı bağlantısı kurulamadı.',
        errorCode: ERROR_CODES.DATABASE.CONNECTION_ERROR,
      };
    }

    if (exception instanceof Prisma.PrismaClientUnknownRequestError) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Veritabanı servisine şu anda ulaşılamıyor.',
        errorCode: ERROR_CODES.DATABASE.CONNECTION_ERROR,
      };
    }

    // 4. Prisma Şema / Doğrulama Hataları (İstek parametre tiplerinin uyuşmaması)
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Geçersiz veritabanı sorgu parametresi.',
        errorCode: ERROR_CODES.DATABASE.VALIDATION_ERROR,
      };
    }

    return null;
  }
}
