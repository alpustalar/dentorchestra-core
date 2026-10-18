import { RecordFinancialEventSchema } from '@shared/modules/financial-event/schemas/commands';
import { FinancialEventTypeSchema } from '@shared';

/**
 * Olay defterinin yazma sözleşmesi.
 *
 * `performedById` **UUID DEĞİL**: `User.id` bir Firebase UID'dir ve kolon ham
 * string tutar. `z.uuid()` yazıldığında `ctx.actor.userId` damgalayan bütün
 * çağıranlar (kasa kapanışı, satıcı ödemesi, dönem kapanışı) sözleşmeye aykırı
 * değer geçiyor oluyordu — kapı HTTP'ye açıldığı gün hepsi 400'e düşerdi.
 */
describe('RecordFinancialEventSchema', () => {
  const base = {
    clinicId: '22222222-2222-4222-8222-222222222222',
    type: FinancialEventTypeSchema.enum.PAYMENT_RECEIVED,
    payload: { method: 'CASH', amount: '100.00' },
    sourceModule: 'payment',
  };

  it('Firebase UID taşıyan aktör kimliğini kabul eder', () => {
    const result = RecordFinancialEventSchema.safeParse({
      ...base,
      performedById: 'kZ9Xq2mLpR7tS4vW1yB3nC6dE8fG',
    });

    expect(result.success).toBe(true);
  });

  it('aktör kimliği boş bırakılabilir (sistem akışları)', () => {
    expect(RecordFinancialEventSchema.safeParse(base).success).toBe(true);
    expect(
      RecordFinancialEventSchema.safeParse({ ...base, performedById: null })
        .success
    ).toBe(true);
  });

  it('kaynak modül boş geçilemez — olayın nereden geldiği izlenebilir olmalı', () => {
    const result = RecordFinancialEventSchema.safeParse({
      ...base,
      sourceModule: '',
    });

    expect(result.success).toBe(false);
  });

  it('defter sahibi şube UUID olmak zorunda', () => {
    const result = RecordFinancialEventSchema.safeParse({
      ...base,
      clinicId: 'kZ9Xq2mLpR7tS4vW1yB3nC6dE8fG',
    });

    expect(result.success).toBe(false);
  });
});
