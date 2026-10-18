import { FinancialEvent } from './financial-event.entity';
import {
  FinancialEventFutureDateException,
  FinancialEventPayloadInvalidException,
} from '@modules/finance/accounting/financial-events/domain/exceptions';
import { FinancialEventTypeSchema } from '@shared';
import { FINANCIAL_EVENT_SOURCE_MODULES } from '@modules/finance/shared/domain/constants/financial-event-source-modules.constant';
import { FinancialEventRecordedEvent } from '@modules/finance/accounting/financial-events/domain/events/financial-event-recorded.event';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import { UUID } from '@src/domain/value-objects/uuid.vo';

const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
const ORG_ID = '22222222-2222-4222-8222-222222222222';
const PARTY_ID = '44444444-4444-4444-8444-444444444444';

const record = (overrides: Record<string, unknown> = {}) =>
  FinancialEvent.record({
    clinicId: CLINIC_ID,
    organizationId: ORG_ID,
    type: FinancialEventTypeSchema.enum.PAYMENT_RECEIVED,
    payload: { method: 'CASH', amount: '100.00', partyId: PARTY_ID },
    sourceModule: FINANCIAL_EVENT_SOURCE_MODULES.PAYMENT,
    ...overrides,
  });

describe('FinancialEvent — kayıt', () => {
  it('id verilmezse üretilir ve fiş üretimini tetikleyen event raise edilir', () => {
    const event = record();

    expect(UUID.create(event.id.value).instance).toBeDefined();
    expect(event.getDomainEvents()).toHaveLength(1);
    expect(event.getDomainEvents()[0]).toBeInstanceOf(
      FinancialEventRecordedEvent
    );
  });

  it('raise edilen event defter sahibi şubeyi taşır', () => {
    // Fiş üretilemediğinde tek görünür iz CRITICAL uyarıdır; uyarı `clinicId`
    // taşımazsa "bir yerde mizan eksik" diyen, kiracısı bilinmeyen alarma döner.
    const raised = record().getDomainEvents()[0] as FinancialEventRecordedEvent;

    expect(raised.clinicId).toBe(CLINIC_ID);
    expect(raised.organizationId).toBe(ORG_ID);
  });

  it('occurredAt verilmezse şimdi damgalanır', () => {
    const event = record();

    expect(event.occurredAt.getTime()).toBeCloseTo(Date.now(), -3);
  });

  it('toPersistence tüm alanları taşır', () => {
    const occurredAt = DateTimeManager.subtractDays(
      DateTimeManager.create(),
      3
    );
    const event = record({ occurredAt, dedupeKey: 'dk', sourceRefId: 'ref' });

    expect(event.toPersistence()).toMatchObject({
      clinicId: CLINIC_ID,
      organizationId: ORG_ID,
      occurredAt,
      dedupeKey: 'dk',
      sourceRefId: 'ref',
    });
  });
});

describe('FinancialEvent — gövde doğrulaması', () => {
  it('kuralın okuduğu alan eksikse kayıt oluşmaz', () => {
    // Append-only defterde yanlış gövde düzeltilemez: ya fiş hiç üretilemez ya
    // da yanlış üretilir. Doğrulama bu yüzden kalıcılaşmadan önce yapılır.
    expect(() =>
      record({ payload: { method: 'CASH', partyId: PARTY_ID } })
    ).toThrow(FinancialEventPayloadInvalidException);
  });

  it('sıfır tutarlı tahsilat reddedilir', () => {
    // Borç ve alacağı birlikte sıfır olan fiş satırı üretilemez; olay defterde
    // sonsuza dek fişsiz kalırdı.
    expect(() =>
      record({
        payload: { method: 'CASH', amount: '0.00', partyId: PARTY_ID },
      })
    ).toThrow(FinancialEventPayloadInvalidException);
  });

  it('hata mesajı hangi alanın bozuk olduğunu söyler', () => {
    expect(() =>
      record({
        payload: { method: 'CASH', amount: '100.00', partyId: 'party-1' },
      })
    ).toThrow(/partyId/);
  });

  it('posting kuralı olmayan tipte gövde serbesttir', () => {
    expect(() =>
      record({
        type: FinancialEventTypeSchema.enum.OPENING_BALANCE,
        payload: { whatever: true },
      })
    ).not.toThrow();
  });
});

describe('FinancialEvent — tarih', () => {
  it('gelecek aya tarihli olay yazılamaz', () => {
    expect(() =>
      record({
        occurredAt: DateTimeManager.addDays(DateTimeManager.create(), 32),
      })
    ).toThrow(FinancialEventFutureDateException);
  });

  it('günün sonuna kadar olan tarihler kabul edilir (saat dilimi payı)', () => {
    expect(() =>
      record({ occurredAt: DateTimeManager.endOfDay(DateTimeManager.create()) })
    ).not.toThrow();
  });

  it('geçmiş tarihli olay serbesttir (geç girilen belge)', () => {
    expect(() =>
      record({
        occurredAt: DateTimeManager.subtractDays(DateTimeManager.create(), 60),
      })
    ).not.toThrow();
  });
});
