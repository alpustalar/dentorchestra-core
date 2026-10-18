import { CashRegister } from '@modules/finance/cash-register/domain/entities/cash-register.entity';
import { IBaseCommandRepository } from '@common/domain/repositories/base-command-repository.interface';

export const CASH_REGISTER_COMMAND_REPOSITORY = Symbol(
  'ICashRegisterCommandRepository'
);

export interface ICashRegisterCommandRepository extends IBaseCommandRepository<CashRegister> {
  /**
   * Kasayı `FOR UPDATE` ile kilitleyerek yükler — aynı kasada eşzamanlı oturum
   * açılışını serialize eder (tek-açık-oturum kuralı: çift-açılış yarışını önler).
   * Yalnız aktif transaction içinde çağrılır.
   */
  findByIdForUpdate(id: string): Promise<CashRegister | null>;
}
