import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators/get-context.decorator';
import { GetInventoryLedgerReconciliationResponse } from './get-inventory-ledger-reconciliation.response';

/**
 * Envanter ↔ defter (150) mutabakatı: eldeki stoğun maliyeti ile muhasebedeki
 * stok hesabının bakiyesini karşılaştırır.
 *
 * Neden gerekli: iki taraf **ayrı kaynaklardan** besleniyor — defterin 150
 * bakiyesi alış faturalarından (borç) ve stok çıkış fişlerinden (alacak),
 * envanter değeri ise partilerden. Aralarındaki farkı gösteren bir rapor
 * olmadığı sürece sapma hiçbir yerde görünmez (CLAUDE.md finans kuralı 11).
 */
export class GetInventoryLedgerReconciliationQuery implements IQuery {
  readonly __responseType!: GetInventoryLedgerReconciliationResponse;
  constructor(
    public readonly clinicId: string,
    public readonly ctx: IGetContext
  ) {}
}
