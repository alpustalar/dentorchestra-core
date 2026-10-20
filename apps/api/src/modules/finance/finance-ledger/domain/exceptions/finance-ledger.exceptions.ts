import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import type { LedgerStatusType } from '@input-type-schemas/LedgerStatusSchema';

/**
 * Cari defter (FinanceLedger) hataları.
 *
 * Entity ve kuralları daha önce çıplak `Error` fırlatıyordu: hepsi 500'e
 * dönüşüyor, `errorCode` taşımıyor ve frontend "neden olmadı" bilgisini
 * alamıyordu.
 */

export class LedgerEntryNotFoundException extends DomainException<{
  installmentId: string;
}> {
  public readonly errorCode = ERROR_CODES.FINANCE_LEDGER.ENTRY_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(installmentId: string) {
    super(`Taksitin cari kaydı bulunamadı: ${installmentId}`, {
      installmentId,
    });
  }
}

/**
 * Taksitin cari kaydı zaten var (unique `installment_id`). Hata değil, "zaten
 * yapılmış" bilgisidir: olay tekrar teslim edildiğinde ya da telafi turunda
 * çağıran mevcut kaydı okuyup durumunu hizalar.
 */
export class LedgerEntryAlreadyExistsException extends DomainException<{
  installmentId: string;
}> {
  public readonly errorCode = ERROR_CODES.FINANCE_LEDGER.ENTRY_ALREADY_EXISTS;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(installmentId: string) {
    super(`Taksitin cari kaydı zaten mevcut: ${installmentId}`, {
      installmentId,
    });
  }
}

/**
 * Kuruş hassasiyeti aşıldı. DB kolonu `Decimal(10,2)`: üçüncü basamak
 * sessizce yuvarlanır ve defter ile kaynak (taksit) birbirinden kayar.
 */
export class LedgerInvalidPrecisionException extends DomainException<{
  amount: string;
}> {
  public readonly errorCode = ERROR_CODES.FINANCE_LEDGER.INVALID_PRECISION;

  constructor(amount: string) {
    super(`Cari tutarı en fazla iki ondalık basamak taşıyabilir: ${amount}`, {
      amount,
    });
  }
}

/**
 * Geçersiz durum geçişi. Özellikle REFUNDED → COMPLETED yasaktır: telafi
 * (backfill) turu iade edilmiş bir kaydı tekrar gelire çeviremez.
 */
export class LedgerInvalidStatusTransitionException extends DomainException<{
  from: LedgerStatusType;
  to: LedgerStatusType;
}> {
  public readonly errorCode =
    ERROR_CODES.FINANCE_LEDGER.INVALID_STATUS_TRANSITION;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(from: LedgerStatusType, to: LedgerStatusType, message?: string) {
    super(
      message ?? `Cari kaydı ${from} durumundan ${to} durumuna çevrilemez.`,
      { from, to }
    );
  }
}

/**
 * Cari kaydın kaynağı (taksit) bulunamadı. Kayıt yazılamaz ve bu sessizce
 * atlanmaz: iş kuyrukta başarısız olarak durur, operatör görür.
 */
export class LedgerSourceInstallmentNotFoundException extends DomainException<{
  installmentId: string;
}> {
  public readonly errorCode =
    ERROR_CODES.FINANCE_LEDGER.SOURCE_INSTALLMENT_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(installmentId: string) {
    super(`Cari kaydının kaynağı olan taksit bulunamadı: ${installmentId}`, {
      installmentId,
    });
  }
}

/**
 * Taksit henüz tahsil edilmemiş (ya da iptal/başarısız): karşılığı olmayan
 * bir gelir satırı yazılamaz.
 */
export class LedgerInstallmentNotSettledException extends DomainException<{
  installmentId: string;
  status: string;
}> {
  public readonly errorCode =
    ERROR_CODES.FINANCE_LEDGER.INSTALLMENT_NOT_SETTLED;

  constructor(installmentId: string, status: string) {
    super(
      `Taksit tahsil edilmediği için cari kaydı yazılamaz (${status}): ${installmentId}`,
      { installmentId, status }
    );
  }
}
