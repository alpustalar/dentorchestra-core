import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import { CashSession } from './cash-session.entity';
import { CashMovement } from './cash-movement.entity';
import {
  CashInvalidPrecisionException,
  CashOpeningFloatNotAMovementException,
  CashSessionNotOpenException,
  InsufficientCashInDrawerException,
} from '@modules/finance/cash-register/domain/exceptions/cash-register.exceptions';
import CashMovementTypeSchema, {
  CashMovementTypeType,
} from '@input-type-schemas/CashMovementTypeSchema';
import CurrencySchema from '@input-type-schemas/CurrencySchema';

/**
 * Kasa oturumu/hareketi: aktör kimliği, kuruş hassasiyeti ve açık-oturum kilidi.
 * Üçü de sessiz hata üretiyordu.
 */
describe('CashSession', () => {
  const CASH_REGISTER_ID = randomUUID();
  const CLINIC_ID = randomUUID();
  const ORGANIZATION_ID = randomUUID();
  /** Personel kimliği Firebase UID'dir (`User.id = firebaseUid`) — UUID DEĞİL. */
  const ACTOR_ID = 'aB3xY9zQ7wE1rT5yU8iO2pL4kJ6h';

  const open = (openingFloat = 100) =>
    CashSession.open({
      cashRegisterId: CASH_REGISTER_ID,
      clinicId: CLINIC_ID,
      organizationId: ORGANIZATION_ID,
      currency: CurrencySchema.enum.TRY,
      openingFloat,
      openedById: ACTOR_ID,
    });

  it('personel kimliği (Firebase UID) ile oturum açılabilir', () => {
    // Regresyon: `openedById` UUID VO'sundan geçiriliyordu; gerçek personel
    // kimliği 28 karakterli Firebase UID olduğu için kasa oturumu HİÇ
    // açılamıyordu (InvalidUuidException).
    const session = open();

    expect(session.openedById).toBe(ACTOR_ID);
    expect(session.isOpen()).toBe(true);
  });

  it('açık oturum kilidi kasaya bağlanır, kapanışta bırakılır', () => {
    // Kilit DB'de `@unique`: "bir kasada en fazla bir açık oturum" kuralının
    // son savunması. Kapanışta bırakılmazsa kasa bir daha hiç açılamazdı.
    const session = open();
    expect(session.activeRegisterId).toBe(CASH_REGISTER_ID);

    session.close({
      totalIn: new Decimal(0),
      totalOut: new Decimal(0),
      countedAmount: new Decimal(100),
      closedById: ACTOR_ID,
    });

    expect(session.activeRegisterId).toBeNull();
  });

  it('beklenen tutar ve fark hesaplanır (fazla pozitif, açık negatif)', () => {
    const session = open(100);

    session.close({
      totalIn: new Decimal('250.50'),
      totalOut: new Decimal('50.50'),
      countedAmount: new Decimal('290.00'),
      closedById: ACTOR_ID,
    });

    expect(session.expectedAmount?.toFixed(2)).toBe('300.00');
    expect(session.difference?.toFixed(2)).toBe('-10.00');
  });

  it('kapanmış oturum yeniden kapatılamaz', () => {
    const session = open();
    const input = {
      totalIn: new Decimal(0),
      totalOut: new Decimal(0),
      countedAmount: new Decimal(100),
      closedById: ACTOR_ID,
    };
    session.close(input);

    expect(() => session.close(input)).toThrow(CashSessionNotOpenException);
  });

  it('kuruştan ince açılış nakdi ve sayım reddedilir', () => {
    expect(() => open(100.005)).toThrow(CashInvalidPrecisionException);

    const session = open();
    expect(() =>
      session.close({
        totalIn: new Decimal(0),
        totalOut: new Decimal(0),
        countedAmount: new Decimal('100.005'),
        closedById: ACTOR_ID,
      })
    ).toThrow(CashInvalidPrecisionException);
  });

  it('muhasebe köprüsü izi idempotenttir', () => {
    const session = open();
    session.markAsPostedToAccounting({ accountingEventId: 'event-1' });
    session.markAsPostedToAccounting({ accountingEventId: 'event-2' });

    expect(session.accountingEventId).toBe('event-1');
    expect(session.isPostedToAccounting()).toBe(true);
  });
  /**
   * Eksi kasa: fiziken imkânsız olan durumun kayda girmesi.
   *
   * Kapı yokken çıkış hareketi çekmeceyi eksiye düşürüyordu ve bu, kapanışta
   * **gerçek olmayan bir "sayım fazlası"na** dönüşüyordu (beklenen negatif →
   * fark pozitif → köprü 679 Diğer Olağandışı Gelir yazıyor). Fiş kendi içinde
   * dengeli olduğu için hiçbir denge kontrolü uyarmıyordu.
   */
  describe('çekmece kapısı (assertCanWithdraw)', () => {
    it('çekmecedeki nakit = açılış + girişler − çıkışlar', () => {
      const session = open(100);

      expect(
        session
          .availableCash({
            totalIn: new Decimal(250),
            totalOut: new Decimal(90),
          })
          .toFixed(2)
      ).toBe('260.00');
    });

    it('çekmecedeki kadar çıkışa izin verir (tam tutar sınırda geçer)', () => {
      const session = open(100);

      expect(() =>
        session.assertCanWithdraw({
          totalIn: new Decimal(400),
          totalOut: new Decimal(0),
          requested: new Decimal(500),
        })
      ).not.toThrow();
    });

    it('bir kuruş fazlası reddedilir; hata çekmecedeki tutarı taşır', () => {
      const session = open(100);

      try {
        session.assertCanWithdraw({
          totalIn: new Decimal(400),
          totalOut: new Decimal(0),
          requested: new Decimal('500.01'),
        });
        throw new Error('beklenen hata fırlatılmadı');
      } catch (error) {
        expect(error).toBeInstanceOf(InsufficientCashInDrawerException);
        const meta = (error as InsufficientCashInDrawerException).meta;
        expect(meta).toEqual({
          available: '500.00',
          requested: '500.01',
          currency: CurrencySchema.enum.TRY,
        });
      }
    });

    it('önceki çıkışlar da düşülür — aynı para iki kez harcanamaz', () => {
      const session = open(0);

      expect(() =>
        session.assertCanWithdraw({
          totalIn: new Decimal(1000),
          totalOut: new Decimal(1000),
          requested: new Decimal('0.01'),
        })
      ).toThrow(InsufficientCashInDrawerException);
    });

    it('kapanıştaki beklenen tutar ile aynı formülü kullanır', () => {
      // İki ayrı formül yazılsaydı biri düzeltildiğinde kapı ile kapanış
      // beklentisi ayrışır ve kasa yine eksiye düşebilirdi.
      const session = open(100);
      const totals = { totalIn: new Decimal(250), totalOut: new Decimal(90) };
      const available = session.availableCash(totals);

      session.close({
        ...totals,
        countedAmount: new Decimal(260),
        closedById: ACTOR_ID,
      });

      expect(session.expectedAmount?.toFixed(2)).toBe(available.toFixed(2));
      expect(session.difference?.toFixed(2)).toBe('0.00');
    });
  });
});

describe('CashMovement', () => {
  const ACTOR_ID = 'aB3xY9zQ7wE1rT5yU8iO2pL4kJ6h';

  const record = (
    type: CashMovementTypeType = CashMovementTypeSchema.enum.CASH_IN,
    amount = 50
  ) =>
    CashMovement.record({
      cashSessionId: randomUUID(),
      clinicId: randomUUID(),
      organizationId: randomUUID(),
      type,
      amount,
      currency: CurrencySchema.enum.TRY,
      performedById: ACTOR_ID,
    });

  it('personel kimliği (Firebase UID) ile hareket kaydedilebilir', () => {
    const movement = record();

    expect(movement.performedById).toBe(ACTOR_ID);
    expect(movement.direction).toBe('IN');
  });

  it('açılış nakdi HAREKET olarak kaydedilemez', () => {
    // Açılış nakdi oturum kolonunda yaşıyor ve kapanış formülüne dahil; bir de
    // hareket olarak girilirse beklenen tutar iki kez şişer ve gerçek bir kasa
    // açığı "denk" görünür.
    expect(() => record(CashMovementTypeSchema.enum.OPENING_FLOAT)).toThrow(
      CashOpeningFloatNotAMovementException
    );
  });

  it('kuruştan ince hareket tutarı reddedilir', () => {
    expect(() => record(CashMovementTypeSchema.enum.CASH_IN, 50.005)).toThrow(
      CashInvalidPrecisionException
    );
  });

  it('çıkış türleri OUT yönüne düşer', () => {
    expect(record(CashMovementTypeSchema.enum.EXPENSE).direction).toBe('OUT');
    expect(record(CashMovementTypeSchema.enum.BANK_DEPOSIT).direction).toBe(
      'OUT'
    );
  });
});
