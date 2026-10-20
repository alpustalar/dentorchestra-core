import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Decimal } from 'decimal.js';
import { CurrencySchema } from '@shared';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetInventoryLedgerReconciliationQuery } from './get-inventory-ledger-reconciliation.query';
import { GetInventoryLedgerReconciliationResponse } from './get-inventory-ledger-reconciliation.response';
import { GetInventoryValuationQuery } from '@modules/supply/inventory/application/queries/get-inventory-valuation/get-inventory-valuation.query';
import { GetTrialBalanceQuery } from '@modules/finance/accounting/posting/application/queries/get-trial-balance/get-trial-balance.query';
import { INVENTORY_STOCK_ACCOUNT_CODE } from '@modules/finance/shared/domain/constants/stock-movement-ledger.constant';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

const FUNCTIONAL_CURRENCY = CurrencySchema.enum.TRY;

/**
 * Envanter değeri ile 150 bakiyesini karşılaştırır.
 *
 * İki taraf da **bus üzerinden** okunuyor: envanter kendi değerleme sorgusundan,
 * defter muhasebenin mizanından. Bounded context korunur — bu handler
 * `journal_lines`'a bakmaz.
 *
 * Fark kendiliğinden hata değildir; rapor otomatik düzeltme yapmaz. Bilinen
 * meşru kalemler: mal gelmiş faturası gelmemiş (stok fazla), fatura stok yerine
 * gidere (770/740) kaydedilmiş (defter eksik), yabancı para partisi
 * (çevrilmediği için karşılaştırmaya girmez) ve silinmiş ürün üzerindeki stok.
 */
@QueryHandler(GetInventoryLedgerReconciliationQuery)
export class GetInventoryLedgerReconciliationHandler
  implements
    IQueryHandler<
      GetInventoryLedgerReconciliationQuery,
      GetInventoryLedgerReconciliationResponse
    >
{
  constructor(private readonly queryBus: TSQueryBus) {}

  async execute(
    query: GetInventoryLedgerReconciliationQuery
  ): Promise<GetInventoryLedgerReconciliationResponse> {
    const { clinicId, ctx } = query;

    // Yetki iki alt sorgunun kendi kapılarında zorlanıyor (envanter: klinik
    // erişimi, mizan: finans erişimi). Burada tekrar edilmez; mutabakat ikisinin
    // kesişiminden daha geniş bir yetki açmaz.
    const [valuation, trialBalance] = await Promise.all([
      this.queryBus.execute(new GetInventoryValuationQuery(clinicId, ctx)),
      this.queryBus.execute(new GetTrialBalanceQuery({ clinicId, ctx })),
    ]);

    const inventoryValue = new Decimal(valuation.data.functionalTotal);

    // Mizan satırı yoksa (hiç stok fişi yok) bakiye sıfırdır — eksik satır ile
    // sıfır bakiye aynı sonucu verir, ama fark raporda görünür kalır.
    const stockLine = trialBalance.data.lines.find(
      (line) => line.code === INVENTORY_STOCK_ACCOUNT_CODE
    );
    const ledgerStockBalance = new Decimal(
      stockLine?.debitBalance ?? '0'
    ).minus(new Decimal(stockLine?.creditBalance ?? '0'));

    const difference = inventoryValue.minus(ledgerStockBalance);

    const deletedProductValue = valuation.data.lines
      .filter(
        (line) => line.isProductDeleted && line.currency === FUNCTIONAL_CURRENCY
      )
      .reduce((sum, line) => sum.plus(line.value), new Decimal(0));

    return {
      data: {
        clinicId,
        asOf: DateTimeManager.create(),
        inventoryValue: inventoryValue.toFixed(2),
        ledgerStockBalance: ledgerStockBalance.toFixed(2),
        difference: difference.toFixed(2),
        // Yabancı para stoğu varsa karşılaştırma **kısmidir**: "mutabık" demek
        // yanıltıcı olurdu.
        isReconciled:
          difference.isZero() && !valuation.data.hasForeignCurrencyStock,
        foreignCurrencyTotals: valuation.data.totals.filter(
          (total) => total.currency !== FUNCTIONAL_CURRENCY
        ),
        deletedProductValue: deletedProductValue.toFixed(2),
      },
    };
  }
}
