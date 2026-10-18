import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '@common/constants/error-codes.constant';

/**
 * Bordro dökümü dengesiz: brüt ≠ net + stopaj + işçi SGK.
 *
 * Çıplak `Error` fırlatılıyordu → 500 ve `errorCode` yok. Oysa bu bir girdi
 * hatasıdır: bordro programından gelen rakamlar tutmuyor demektir ve operatöre
 * hangi iki tutarın uyuşmadığı gösterilebilir. Dengesiz döküm fişe dönüşürse
 * yevmiye "Σborç = Σalacak" kontrolünde, sebebinden kopuk bir yerde patlar.
 */
export class UnbalancedPayrollBreakdownException extends DomainException<{
  grossSalary: string;
  decomposed: string;
}> {
  public readonly errorCode = ERROR_CODES.PAYROLL.UNBALANCED_BREAKDOWN;

  constructor(meta: { grossSalary: string; decomposed: string }) {
    super(
      `Bordro dengesiz: brüt (${meta.grossSalary}) = net + stopaj + işçi SGK (${meta.decomposed}) olmalı.`,
      meta
    );
  }
}
