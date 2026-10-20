import { Decimal } from 'decimal.js';
import { IBaseCommandRepository } from '@common/domain/repositories/base-command-repository.interface';
import { CardChargeback } from '@modules/finance/bank/domain/entities/card-chargeback.entity';
import { CardChargeback as ICardChargeback } from '@model-schema/CardChargebackSchema';
import {
  FindCardChargebacksFilter,
  SumActiveChargebacksParams,
} from '@modules/finance/bank/domain/contracts';
import { Paginated } from '@common/interfaces/paginated.type';

export const CARD_CHARGEBACK_COMMAND_REPOSITORY = Symbol(
  'ICardChargebackCommandRepository'
);
export const CARD_CHARGEBACK_QUERY_REPOSITORY = Symbol(
  'ICardChargebackQueryRepository'
);

export interface ICardChargebackCommandRepository extends IBaseCommandRepository<CardChargeback> {
  /**
   * İtirazı `FOR UPDATE` kilitleyerek yükler — yalnız aktif transaction içinde.
   * Çözüm bir durum geçişidir (OPEN → WON|LOST) ve iki eşzamanlı istek aynı
   * itirazı farklı sonuçlarla kapatabilir; kilit olmadan ikisi de "hâlâ açık"
   * görür ve iki ayrı çözüm fişi (127 iki kez kapanır) yazılır.
   */
  findByIdForUpdate(id: string): Promise<CardChargeback | null>;

  /**
   * Bir kaynağın **aktif** (OPEN + LOST) itirazlarının toplamı. İade/iptal ve yeni
   * itiraz kararını besler (kümülatif tavan), bu yüzden Command Repo'dandır.
   */
  sumActiveBySource(params: SumActiveChargebacksParams): Promise<Decimal>;
}

/**
 * Salt okuma: itiraz listesi bir ekranı besler ve hiçbir mutasyona karar
 * vermez. Mutasyonu besleyen okumalar (`sumActiveBySource`,
 * `findByIdForUpdate`) Command Repo'da kalır.
 */
export interface ICardChargebackQueryRepository {
  findByClinic(
    filter: FindCardChargebacksFilter
  ): Promise<Paginated<ICardChargeback>>;
}
