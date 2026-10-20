import { InstallmentStatusSchema } from '@shared/generated-zod';
import { ledgerStatusForInstallment } from './installment-ledger-status.rule';

/**
 * Taksit durumu → cari kaydın olması gereken durumu. Yazma yolu ve mutabakat
 * raporu aynı sabitten türer (CLAUDE.md finans kuralı 12); eşleme tam kaplamalı
 * bir `Record` olduğu için yeni bir taksit durumu derleme hatasıdır.
 */
describe('ledgerStatusForInstallment', () => {
  it('parası hareket etmiş taksitler cari kaydın karşılık durumunu alır', () => {
    expect(ledgerStatusForInstallment('COMPLETED')).toBe('COMPLETED');
    expect(ledgerStatusForInstallment('REFUNDED')).toBe('REFUNDED');
  });

  it('ters ibraz iade ile KARIŞMAZ: kendi durumunu taşır', () => {
    expect(ledgerStatusForInstallment('CHARGED_BACK')).toBe('CHARGED_BACK');
    expect(ledgerStatusForInstallment('CHARGED_BACK')).not.toBe(
      ledgerStatusForInstallment('REFUNDED')
    );
  });

  it('parası hareket etmemiş taksidin defterde karşılığı olmamalı (null)', () => {
    expect(ledgerStatusForInstallment('PENDING')).toBeNull();
    expect(ledgerStatusForInstallment('OVERDUE')).toBeNull();
    expect(ledgerStatusForInstallment('CANCELLED')).toBeNull();
  });

  it('her taksit durumu için bir karar vardır (tam kaplama)', () => {
    for (const status of InstallmentStatusSchema.options) {
      expect(ledgerStatusForInstallment(status)).not.toBeUndefined();
    }
  });
});
