import { TaxParameterKeyType as TaxParameterKey } from '@input-type-schemas/TaxParameterKeySchema';
import { TaxParameter } from '../../entities/tax-parameter.entity';
import { IBaseCommandRepository } from '@common/domain/repositories/base-command-repository.interface';

export const TAX_PARAMETER_COMMAND_REPOSITORY = Symbol(
  'ITaxParameterCommandRepository'
);

export interface ITaxParameterCommandRepository extends IBaseCommandRepository<TaxParameter> {
  /** Varsayılan oran setini tek seferde açar (şube kurulumu). */
  createMany(taxParameters: TaxParameter[]): Promise<void>;

  /**
   * (clinicId, key) için açık (validTo=null) sürüm — kilitli okunur. Yeni oran
   * açılırken bu satır `close()` ile kapatılacağı için Command Context'e aittir;
   * kilit olmadan iki eşzamanlı istek aynı açık sürümü görüp iki açık satır
   * bırakabilirdi (tabloda buna engel olan unique kısıt yok).
   */
  findOpenForUpdate(
    clinicId: string,
    key: TaxParameterKey
  ): Promise<TaxParameter | null>;

  /**
   * Şubede hiç vergi parametresi var mı? Seed'in idempotentliğini (yazma kararını)
   * beslediği için okuma Command Repo'dan yapılır.
   */
  existsForClinic(clinicId: string): Promise<boolean>;
}
