import { randomUUID } from 'crypto';
import { FinanceLedgerEntity } from './finance-ledger.entity';
import { Money } from '@src/domain/value-objects/money.vo';
import {
  LedgerCategorySchema,
  LedgerSourceSchema,
  LedgerStatusSchema,
  LedgerTypeSchema,
} from '@shared';
import {
  LedgerInvalidPrecisionException,
  LedgerInvalidStatusTransitionException,
} from '@modules/finance/finance-ledger/domain/exceptions/finance-ledger.exceptions';

/**
 * Cari kaydın değişmez kuralları: kuruş hassasiyeti, durum geçişleri ve
 * "iadeyi geri alma" yasağı. Üçü de defteri sessizce bozabilecek yerler.
 */
describe('FinanceLedgerEntity', () => {
  const base = () => ({
    organizationId: randomUUID(),
    clinicId: randomUUID(),
    patientId: randomUUID(),
    paymentId: randomUUID(),
    installmentId: randomUUID(),
    type: LedgerTypeSchema.enum.INCOME,
    source: LedgerSourceSchema.enum.PAYMENT_MODULE,
    category: LedgerCategorySchema.enum.TREATMENT_PAYMENT,
  });

  it('kuruş hassasiyetini aşan tutarı reddeder', () => {
    expect(() =>
      FinanceLedgerEntity.create({
        ...base(),
        money: Money.create('100.555', 'TRY').orThrow(),
      })
    ).toThrow(LedgerInvalidPrecisionException);
  });

  it('durum verilmezse COMPLETED yazar', () => {
    const entry = FinanceLedgerEntity.create({
      ...base(),
      money: Money.create('100.00', 'TRY').orThrow(),
    });

    expect(entry.status).toBe(LedgerStatusSchema.enum.COMPLETED);
  });

  it('durum dışarıdan verilebilir (sırasız teslim edilen iade)', () => {
    const entry = FinanceLedgerEntity.create({
      ...base(),
      money: Money.create('100.00', 'TRY').orThrow(),
      status: LedgerStatusSchema.enum.REFUNDED,
    });

    expect(entry.status).toBe(LedgerStatusSchema.enum.REFUNDED);
  });

  it('aynı duruma hizalama no-op döner (gereksiz UPDATE yok)', () => {
    const entry = FinanceLedgerEntity.create({
      ...base(),
      money: Money.create('100.00', 'TRY').orThrow(),
    });

    expect(entry.syncStatus(LedgerStatusSchema.enum.COMPLETED)).toBe(false);
  });

  it('COMPLETED → REFUNDED geçişine izin verir', () => {
    const entry = FinanceLedgerEntity.create({
      ...base(),
      money: Money.create('100.00', 'TRY').orThrow(),
    });

    expect(entry.syncStatus(LedgerStatusSchema.enum.REFUNDED)).toBe(true);
    expect(entry.status).toBe(LedgerStatusSchema.enum.REFUNDED);
  });

  it('iade edilmiş kaydı tekrar gelire çevirmez (telafi turu iadeyi geri almaz)', () => {
    const entry = FinanceLedgerEntity.create({
      ...base(),
      money: Money.create('100.00', 'TRY').orThrow(),
      status: LedgerStatusSchema.enum.REFUNDED,
    });

    expect(() => entry.syncStatus(LedgerStatusSchema.enum.COMPLETED)).toThrow(
      LedgerInvalidStatusTransitionException
    );
    expect(entry.status).toBe(LedgerStatusSchema.enum.REFUNDED);
  });

  it('COMPLETED → CHARGED_BACK geçişine izin verir (kaybedilen kart itirazı)', () => {
    const entry = FinanceLedgerEntity.create({
      ...base(),
      money: Money.create('100.00', 'TRY').orThrow(),
    });

    expect(entry.syncStatus(LedgerStatusSchema.enum.CHARGED_BACK)).toBe(true);
    expect(entry.status).toBe(LedgerStatusSchema.enum.CHARGED_BACK);
  });

  it('ters ibraz edilmiş kaydı tekrar gelire çevirmez — yeniden tahsil telafi taksidinin kendi kaydına yazılır', () => {
    const entry = FinanceLedgerEntity.create({
      ...base(),
      money: Money.create('100.00', 'TRY').orThrow(),
      status: LedgerStatusSchema.enum.CHARGED_BACK,
    });

    expect(() => entry.syncStatus(LedgerStatusSchema.enum.COMPLETED)).toThrow(
      LedgerInvalidStatusTransitionException
    );
    expect(() => entry.syncStatus(LedgerStatusSchema.enum.REFUNDED)).toThrow(
      LedgerInvalidStatusTransitionException
    );
    expect(entry.status).toBe(LedgerStatusSchema.enum.CHARGED_BACK);
  });

  it('iptal edilmiş kaydı tekrar gelire çevirmez', () => {
    const entry = FinanceLedgerEntity.create({
      ...base(),
      money: Money.create('100.00', 'TRY').orThrow(),
      status: LedgerStatusSchema.enum.CANCELLED,
    });

    expect(() => entry.syncStatus(LedgerStatusSchema.enum.COMPLETED)).toThrow(
      LedgerInvalidStatusTransitionException
    );
  });

  it('entryDate dışarıdan verilen tahsilat tarihidir', () => {
    const paidAt = new Date('2026-09-30T21:30:00.000Z');
    const entry = FinanceLedgerEntity.create({
      ...base(),
      money: Money.create('100.00', 'TRY').orThrow(),
      entryDate: paidAt,
    });

    expect(entry.entryDate).toEqual(paidAt);
    expect(entry.toPersistence().entryDate).toEqual(paidAt);
  });

  it('toPersistence saftır: hiçbir şey değişmediyse updatedAt sabit kalır', () => {
    const entry = FinanceLedgerEntity.create({
      ...base(),
      money: Money.create('100.00', 'TRY').orThrow(),
    });

    const first = entry.toPersistence().updatedAt;
    const second = entry.toPersistence().updatedAt;

    expect(second).toEqual(first);
  });

  it('personel kimliği ham string kalır (Firebase UID, UUID değil)', () => {
    const entry = FinanceLedgerEntity.create({
      ...base(),
      money: Money.create('100.00', 'TRY').orThrow(),
      performedById: 'kZ9Xq2mLpR7tS4vW1yB3nC6dE8fG',
    });

    expect(entry.performedById).toBe('kZ9Xq2mLpR7tS4vW1yB3nC6dE8fG');
  });
});
