import {
  INVENTORY_CONSUMPTION_ACCOUNT_CODE,
  INVENTORY_LOSS_ACCOUNT_CODE,
  INVENTORY_SURPLUS_ACCOUNT_CODE,
  LEDGER_BRIDGED_STOCK_MOVEMENT_TYPES,
  isLedgerBridgedStockMovement,
  resolveStockCounterAccount,
} from './stock-movement-ledger.constant';

/**
 * Üretici (envanter köprüsü) ve kural (posting) aynı haritadan besleniyor.
 * Harita ikiye bölünürse: üretilen ama hesabı olmayan olay sonsuza dek fişsiz
 * kalır (dönem kapanışını bloke eder), hesabı olup üretilmeyen tip defteri
 * sessizce eksik bırakır.
 */
describe('Stok hareketi defter eşlemesi', () => {
  it('tüketim → 740.01, zayi → 689, sayım açığı → 689', () => {
    expect(resolveStockCounterAccount('USAGE', 'OUT')).toBe(
      INVENTORY_CONSUMPTION_ACCOUNT_CODE
    );
    expect(resolveStockCounterAccount('WASTE', 'OUT')).toBe(
      INVENTORY_LOSS_ACCOUNT_CODE
    );
    expect(resolveStockCounterAccount('ADJUSTMENT', 'OUT')).toBe(
      INVENTORY_LOSS_ACCOUNT_CODE
    );
  });

  it('girişte köprülenen tek durum sayım fazlasıdır → 679', () => {
    expect(resolveStockCounterAccount('ADJUSTMENT', 'IN')).toBe(
      INVENTORY_SURPLUS_ACCOUNT_CODE
    );
    // Tüketim/zayi girişte anlamsız: eşleme yok.
    expect(resolveStockCounterAccount('USAGE', 'IN')).toBeNull();
    expect(resolveStockCounterAccount('WASTE', 'IN')).toBeNull();
  });

  it('satın alma, transfer ve iade köprülenmez', () => {
    // Satın almanın borç kaydı alış faturasından gelir (mükerrer olurdu);
    // transfer iki defter arası yer değiştirmedir; iade belgeyle ters kayıtla
    // yürür (cari + KDV birlikte düzelmeli).
    for (const type of [
      'PURCHASE',
      'TRANSFER_IN',
      'TRANSFER_OUT',
      'RETURN_TO_SUPPLIER',
      'RETURN_FROM_PATIENT',
    ] as const) {
      expect(isLedgerBridgedStockMovement(type)).toBe(false);
      expect(resolveStockCounterAccount(type, 'OUT')).toBeNull();
      expect(resolveStockCounterAccount(type, 'IN')).toBeNull();
    }
  });

  it('köprülenen tip listesi eşleme ile aynı kümedir', () => {
    expect([...LEDGER_BRIDGED_STOCK_MOVEMENT_TYPES].sort()).toEqual(
      ['ADJUSTMENT', 'USAGE', 'WASTE'].sort()
    );
    for (const type of LEDGER_BRIDGED_STOCK_MOVEMENT_TYPES) {
      expect(isLedgerBridgedStockMovement(type)).toBe(true);
    }
  });
});
