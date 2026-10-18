import { Injectable } from '@nestjs/common';
import { FinancialEvent, FinancialEventTypeSchema } from '@shared';
import { StockMovementDirectionSchema } from '@shared';
import { DraftJournalEntry, PostingRule } from '../posting-rule.interface';
import { StockInEventPayload } from '../event-payloads';
import {
  INVENTORY_STOCK_ACCOUNT_CODE,
  resolveStockCounterAccount,
} from '@modules/finance/shared/domain/constants/stock-movement-ledger.constant';
import { StockMovementTypeType as StockMovementType } from '@input-type-schemas/StockMovementTypeSchema';
import { UnmappedStockMovementTypeException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';

/**
 * Stok Girişi — STOCK_IN (**yalnız sayım fazlası**)
 *   B 150 İlk Madde ve Malzeme   amount
 *     A 679 Diğer Olağandışı Gelir ve Karlar   amount
 *
 * Satın alma girişi buraya **düşmez**: onun borç kaydı alış faturasından gelir
 * (`lineAccountCode: '150'`). İkisi birlikte yazılsaydı stok iki kez borçlanır,
 * envanter değeri defterin yarısı kadar görünürdü.
 */
@Injectable()
export class StockInRule implements PostingRule {
  readonly eventType = FinancialEventTypeSchema.enum.STOCK_IN;

  build(event: FinancialEvent): DraftJournalEntry {
    const payload = event.payload as unknown as StockInEventPayload;

    const counterAccount = resolveStockCounterAccount(
      payload.movementType as StockMovementType,
      StockMovementDirectionSchema.enum.IN
    );

    if (!counterAccount) {
      throw new UnmappedStockMovementTypeException({
        movementType: payload.movementType,
        direction: StockMovementDirectionSchema.enum.IN,
      });
    }

    return {
      date: event.occurredAt,
      description: 'Stok girişi (sayım fazlası)',
      currency: payload.currency,
      lines: [
        {
          accountCode: INVENTORY_STOCK_ACCOUNT_CODE,
          debit: payload.amount,
          desc: 'Stok girişi',
        },
        {
          accountCode: counterAccount,
          credit: payload.amount,
          desc: 'Sayım fazlası',
        },
      ],
    };
  }
}
