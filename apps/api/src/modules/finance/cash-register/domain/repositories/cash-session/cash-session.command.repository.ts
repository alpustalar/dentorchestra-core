import { CashSession } from '@modules/finance/cash-register/domain/entities/cash-session.entity';
import { CashSession as ICashSession } from '@model-schema/CashSessionSchema';
import { IBaseCommandRepository } from '@common/domain/repositories/base-command-repository.interface';
import {
  CashBridgeTotals,
  CashMovementTotals,
} from '@modules/finance/cash-register/domain/contracts';

export const CASH_SESSION_COMMAND_REPOSITORY = Symbol(
  'ICashSessionCommandRepository'
);
export interface ICashSessionCommandRepository extends IBaseCommandRepository<CashSession> {
  /**
   * Oturumu `FOR UPDATE` ile kilitleyerek yükler — eşzamanlı kapanış/hareket
   * yarışını serialize eder. Yalnız aktif transaction içinde çağrılır.
   */
  findByIdForUpdate(id: string): Promise<CashSession | null>;

  /**
   * Bir kasada açık (OPEN) oturum varsa döner. Açılış handler'ında register kilidi
   * altında çağrılır — tek-açık-oturum kuralının atomik kontrolü için command repo'da.
   */
  findOpenByRegister(cashRegisterId: string): Promise<ICashSession | null>;

  /**
   * Oturumdaki hareketlerin yön bazlı toplamı (kapanış beklenen tutar hesabı).
   * Kapanış mutasyonunu beslediği için command repo'dadır (CQRS write-side).
   */
  sumMovements(cashSessionId: string): Promise<CashMovementTotals>;

  /**
   * Muhasebe köprüsü için tür-bazlı toplamlar (BANK_DEPOSIT + EXPENSE) — kapanış
   * fişini beslediği için command repo'dadır.
   */
  sumBridgeMovements(cashSessionId: string): Promise<CashBridgeTotals>;
}
