import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { QuoteOptionOwnershipService } from './quote-option-ownership.service';
import { QuoteOptionRejectedException } from './quote-option-rejected.exception';
import { QuoteOptionOwner } from './quote-option.contracts';

type AlarmInput = Parameters<CriticalFailurePublisher['publish']>[0];

const stored: QuoteOptionOwner = {
  clinicId: 'clinic-1',
  conversationId: 'conv-1',
};

describe('QuoteOptionOwnershipService', () => {
  let publish: jest.Mock;
  let service: QuoteOptionOwnershipService;

  const alarm = (): AlarmInput => {
    const [input] = publish.mock.calls[0] as [AlarmInput];
    return input;
  };

  beforeEach(() => {
    publish = jest.fn();
    service = new QuoteOptionOwnershipService({
      publish,
    } as unknown as CriticalFailurePublisher);
  });

  it('sahip uyuşuyorsa ne fırlatır ne uyarır', () => {
    service.assertOwned({
      kind: 'HOTEL',
      optionId: 'ht_1',
      stored,
      claimed: { ...stored },
    });

    expect(publish).not.toHaveBeenCalled();
  });

  it('başka kiracının teklifinde CRITICAL uyarır ve reddeder', () => {
    expect(() =>
      service.assertOwned({
        kind: 'HOTEL',
        optionId: 'ht_1',
        stored,
        claimed: { clinicId: 'clinic-2', conversationId: 'conv-9' },
      })
    ).toThrow(QuoteOptionRejectedException);

    expect(alarm()).toMatchObject({
      operation: 'health-tourism.quote-option.ownership',
      severity: 'CRITICAL',
      clinicId: 'clinic-2',
      dedupeKey: 'quote-option-rejected:ht_1',
      context: {
        kind: 'HOTEL',
        reason: 'CLINIC_MISMATCH',
        storedClinicId: 'clinic-1',
      },
    });
  });

  it('aynı kiracıda görüşme uyuşmazlığı WARNING üretir', () => {
    expect(() =>
      service.assertOwned({
        kind: 'TRANSFER',
        optionId: 'tr_1',
        stored,
        claimed: { clinicId: 'clinic-1', conversationId: 'conv-2' },
      })
    ).toThrow(QuoteOptionRejectedException);

    expect(alarm()).toMatchObject({
      severity: 'WARNING',
      context: { reason: 'CONVERSATION_MISMATCH' },
    });
  });

  /** Mesaj hastaya ulaşıyor: kiracı/görüşme kimliği taşımamalı. */
  it('ret mesajı hasta için güvenli (kimlik sızdırmaz)', () => {
    try {
      service.assertOwned({
        kind: 'FLIGHT',
        optionId: 'fl_1',
        stored,
        claimed: { clinicId: 'clinic-2', conversationId: 'conv-2' },
      });
      fail('fırlatmalıydı');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain('clinic-1');
      expect(message).not.toContain('conv-1');
      expect(message).not.toContain('fl_1');
      expect(message).toContain('tekrar arama');
      expect((error as QuoteOptionRejectedException).meta).toEqual({
        kind: 'FLIGHT',
        reason: 'CLINIC_MISMATCH',
      });
    }
  });
});
