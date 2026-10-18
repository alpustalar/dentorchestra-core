import { Injectable } from '@nestjs/common';
import { FinancialEvent, FinancialEventTypeSchema } from '@shared';
import { StockMovementDirectionSchema } from '@shared';
import { DraftJournalEntry, PostingRule } from '../posting-rule.interface';
import { StockOutEventPayload } from '../event-payloads';
import {
  INVENTORY_STOCK_ACCOUNT_CODE,
  resolveStockCounterAccount,
} from '@modules/finance/shared/domain/constants/stock-movement-ledger.constant';
import { StockMovementTypeType as StockMovementType } from '@input-type-schemas/StockMovementTypeSchema';
import { UnmappedStockMovementTypeException } from '@modules/finance/accounting/posting/domain/exceptions/posting.exceptions';

/**
 * Stok Çıkışı — STOCK_OUT (satılan/tüketilen malın maliyeti)
 *   B 740.01 Sarf Malzeme Tüketimi (USAGE) | 689 Olağandışı Gider (WASTE / sayım açığı)
 *     A 150 İlk Madde ve Malzeme                                            amount
 *
 * Tutar partinin fiili maliyetidir. Stok varlık hesabı burada **alacaklanır**:
 * borç kaydı alış faturasından geldiği için ikisi birlikte 150'yi kapatır ve
 * envanter değeri ↔ 150 bakiyesi mutabakatı anlam kazanır.
 */
@Injectable()
export class StockOutRule implements PostingRule {
  readonly eventType = FinancialEventTypeSchema.enum.STOCK_OUT;

  build(event: FinancialEvent): DraftJournalEntry {
    const payload = event.payload as unknown as StockOutEventPayload;

    const counterAccount = resolveStockCounterAccount(
      payload.movementType as StockMovementType,
      StockMovementDirectionSchema.enum.OUT
    );

    // Eşlemesi olmayan tip sessizce bir hesaba yazılamaz: yanlış hesaba düşen
    // maliyet, mizanı dengeli bıraktığı için hiçbir kontrolde görünmez.
    if (!counterAccount) {
      throw new UnmappedStockMovementTypeException({
        movementType: payload.movementType,
        direction: StockMovementDirectionSchema.enum.OUT,
      });
    }

    return {
      date: event.occurredAt,
      description:
        payload.movementType === 'USAGE'
          ? 'Sarf malzeme tüketimi'
          : 'Stok çıkışı (zayi / sayım açığı)',
      currency: payload.currency,
      lines: [
        {
          accountCode: counterAccount,
          debit: payload.amount,
          desc: 'Stok maliyeti',
        },
        {
          accountCode: INVENTORY_STOCK_ACCOUNT_CODE,
          credit: payload.amount,
          desc: 'Stok çıkışı',
        },
      ],
    };
  }
}
