import { Decimal } from 'decimal.js';
import { GetArAgingHandler } from './get-ar-aging.handler';
import { GetArAgingQuery } from './get-ar-aging.query';
import { LogSource } from '@src/domain/constants/log-action.constant';

/**
 * Para birimi karışımı regresyonu (§16 P1-4): rapor TRY ve EUR tutarlarını aynı
 * toplama ekliyordu — sağlık turizmi kliniklerinde 1.000 EUR + 1.000 TRY
 * yönetime "2.000" olarak görünüyordu.
 */
describe('GetArAgingHandler', () => {
  const clinicId = 'clinic-1';
  const ctx = {
    actor: { userId: 'u1', source: LogSource.WEB },
    source: 'API',
  } as never;

  const make = (data: {
    openInstallments: unknown[];
    collectedTotals: unknown[];
  }) => {
    const paymentRepo = { arAging: jest.fn().mockResolvedValue(data) };
    const policyFactory = {
      finance: () => ({
        evaluator: { check: () => ({ orThrow: jest.fn() }) },
        policy: { getSerializationOptions: () => ({}) },
      }),
    };
    return new GetArAgingHandler(paymentRepo as never, policyFactory as never);
  };

  it('özet ve kovalar para birimi başına üretilir (toplamlar karışmaz)', async () => {
    const handler = make({
      openInstallments: [
        {
          patientId: 'p1',
          amount: new Decimal('1000'),
          currency: 'TRY',
          dueDate: null,
        },
        {
          patientId: 'p2',
          amount: new Decimal('500'),
          currency: 'EUR',
          dueDate: null,
        },
      ],
      collectedTotals: [
        { currency: 'TRY', amount: new Decimal('3000') },
        { currency: 'EUR', amount: new Decimal('500') },
      ],
    });

    const { data } = await handler.execute(new GetArAgingQuery(clinicId, ctx));

    const summaries = Object.fromEntries(
      data.summaries.map((s) => [s.currency, s])
    );
    expect(summaries.TRY.totalOutstanding).toBe('1000.00');
    expect(summaries.TRY.totalCollected).toBe('3000.00');
    expect(summaries.TRY.collectionRate).toBe('0.7500');
    expect(summaries.EUR.totalOutstanding).toBe('500.00');
    expect(summaries.EUR.totalCollected).toBe('500.00');
    expect(summaries.EUR.collectionRate).toBe('0.5000');

    // Kovalar da para birimi taşır; TRY'nin NOT_DUE kovası EUR tutarını içermez.
    const notDue = data.buckets.filter((b) => b.label === 'NOT_DUE');
    expect(notDue).toHaveLength(2);
    expect(notDue.find((b) => b.currency === 'TRY')?.amount).toBe('1000.00');
    expect(notDue.find((b) => b.currency === 'EUR')?.amount).toBe('500.00');
  });

  it('hasta riski hasta + para birimi kırılımında döner', async () => {
    const handler = make({
      openInstallments: [
        {
          patientId: 'p1',
          amount: new Decimal('100'),
          currency: 'TRY',
          dueDate: null,
        },
        {
          patientId: 'p1',
          amount: new Decimal('200'),
          currency: 'TRY',
          dueDate: null,
        },
        {
          patientId: 'p1',
          amount: new Decimal('50'),
          currency: 'USD',
          dueDate: null,
        },
      ],
      collectedTotals: [],
    });

    const { data } = await handler.execute(new GetArAgingQuery(clinicId, ctx));

    expect(data.patients).toHaveLength(2);
    expect(data.patients.find((p) => p.currency === 'TRY')?.outstanding).toBe(
      '300.00'
    );
    expect(data.patients.find((p) => p.currency === 'USD')?.outstanding).toBe(
      '50.00'
    );
  });

  it('vadesi geçmiş tutar yalnız ilgili para biriminde raporlanır', async () => {
    const handler = make({
      openInstallments: [
        {
          patientId: 'p1',
          amount: new Decimal('700'),
          currency: 'TRY',
          dueDate: new Date('2026-01-01'),
        },
        {
          patientId: 'p2',
          amount: new Decimal('900'),
          currency: 'EUR',
          dueDate: null,
        },
      ],
      collectedTotals: [],
    });

    const { data } = await handler.execute(
      new GetArAgingQuery(clinicId, ctx, new Date('2026-06-01'))
    );

    const summaries = Object.fromEntries(
      data.summaries.map((s) => [s.currency, s])
    );
    expect(summaries.TRY.totalOverdue).toBe('700.00');
    expect(summaries.EUR.totalOverdue).toBe('0.00');
    expect(
      data.buckets.find((b) => b.currency === 'TRY' && b.label === 'D90_PLUS')
        ?.amount
    ).toBe('700.00');
  });
});
