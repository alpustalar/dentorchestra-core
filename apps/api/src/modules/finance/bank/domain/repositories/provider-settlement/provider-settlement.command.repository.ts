import { ProviderSettlement } from '@modules/finance/bank/domain/entities/provider-settlement.entity';
import { RecordProviderSettlementProps } from '@modules/finance/bank/domain/contracts';

export const PROVIDER_SETTLEMENT_COMMAND_REPOSITORY = Symbol(
  'IProviderSettlementCommandRepository'
);

export interface IProviderSettlementCommandRepository {
  /**
   * Kaydı yazar. Aynı `(clinicId, provider, reference)` üçlüsü ikinci kez
   * geldiğinde DB unique kısıtı patlar ve repo onu tipli
   * `ProviderSettlementAlreadyRecordedException`'a çevirir: uygulama kapısı tek
   * başına yarışı kapatmaz (iki eşzamanlı istek de "kayıt yok" görebilir).
   */
  create(settlement: ProviderSettlement): Promise<ProviderSettlement>;

  findById(id: string): Promise<ProviderSettlement | null>;

  update(settlement: ProviderSettlement): Promise<ProviderSettlement>;
}

/** Props tipi burada da dışa açılır — handler entity'yi bu tipten kurar. */
export type { RecordProviderSettlementProps };
