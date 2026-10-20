import { randomUUID } from 'crypto';
import { Decimal } from 'decimal.js';
import { CardChargeback } from './card-chargeback.entity';
import { CardChargebackSchema } from '@shared/generated-zod/modelSchema/CardChargebackSchema';
import { OpenCardChargebackProps } from '@modules/finance/bank/domain/contracts';
import {
  ChargebackAlreadyResolvedException,
  ChargebackInvalidAmountException,
  ChargebackInvalidDateException,
  ChargebackInvalidPrecisionException,
  ChargebackPlanSyncNotApplicableException,
  ChargebackReferenceRequiredException,
  ChargebackReturnChannelRequiredException,
  ChargebackSourceActorsInvalidException,
} from '@modules/finance/bank/domain/exceptions/bank.exceptions';

const CLINIC_ID = randomUUID();
const ORG_ID = randomUUID();
const PATIENT_ID = randomUUID();
const PARTY_ID = randomUUID();
const SOURCE_ID = randomUUID();
const PAYMENT_ID = randomUUID();

const OPENED_AT = new Date('2026-10-10T00:00:00Z');
const RESOLVED_AT = new Date('2026-10-30T00:00:00Z');

const props = (
  over: Partial<OpenCardChargebackProps> = {}
): OpenCardChargebackProps => ({
  clinicId: CLINIC_ID,
  organizationId: ORG_ID,
  provider: 'IYZICO',
  caseReference: 'CB-1001',
  sourceType: 'POS_TRANSACTION',
  sourceId: SOURCE_ID,
  paymentId: PAYMENT_ID,
  patientId: PATIENT_ID,
  partyId: PARTY_ID,
  amount: new Decimal('1000.00'),
  feeAmount: new Decimal('25.00'),
  currency: 'TRY',
  openedAt: OPENED_AT,
  openedFundsChannel: 'FUNDS_IN_TRANSIT',
  recordedById: 'firebase-uid-1',
  ...over,
});

/**
 * Kart itirazı bir durum makinesidir: OPEN → WON | LOST, çözüm tek seferlik.
 * Sayısal değişmezler yazma anında zorlanır — olay gövdesi append-only olduğu
 * için sonradan düzeltilemez (§53 gerekçesi).
 */
describe('CardChargeback (entity)', () => {
  describe('open() — platform rezervasyon tahsilatı (BOOKING_PAYMENT)', () => {
    const bookingProps = (over: Partial<OpenCardChargebackProps> = {}) =>
      props({
        sourceType: 'BOOKING_PAYMENT',
        paymentId: null,
        patientId: null,
        partyId: null,
        ...over,
      });

    it('hasta, cari, ödeme planı ve taksit OLMADAN açılır; kaynak kimliği korunur', () => {
      const cb = CardChargeback.open(bookingProps());

      expect(cb.sourceType).toBe('BOOKING_PAYMENT');
      expect(cb.sourceId).toBe(SOURCE_ID);
      expect(cb.patientId).toBeNull();
      expect(cb.partyId).toBeNull();
      expect(cb.paymentId).toBeNull();
      // Taksit yalnız ONLINE_PAYMENT’ta kaynakla aynıdır; rezervasyon taksit değildir.
      expect(cb.installmentId).toBeNull();
      const row = cb.toPersistence();
      expect(row.patientId).toBeNull();
      expect(row.partyId).toBeNull();
    });

    it('hasta ya da cari verilirse reddedilir (kayıp 120’ye gitmez; yanlış cariye yazılmasın)', () => {
      expect(() =>
        CardChargeback.open(bookingProps({ patientId: PATIENT_ID }))
      ).toThrow(ChargebackSourceActorsInvalidException);
      expect(() =>
        CardChargeback.open(bookingProps({ partyId: PARTY_ID }))
      ).toThrow(ChargebackSourceActorsInvalidException);
    });

    it('yalnız iyzico / TRY: Stripe ya da yabancı para platform itirazı olamaz', () => {
      expect(() =>
        CardChargeback.open(bookingProps({ provider: 'STRIPE' }))
      ).toThrow(ChargebackSourceActorsInvalidException);
      expect(() =>
        CardChargeback.open(bookingProps({ currency: 'EUR' }))
      ).toThrow(ChargebackSourceActorsInvalidException);
    });

    it('ödeme planına bağlanamaz (platformun plan/taksit kaydı yok)', () => {
      expect(() =>
        CardChargeback.open(bookingProps({ paymentId: PAYMENT_ID }))
      ).toThrow(ChargebackSourceActorsInvalidException);
    });

    it('diğer kaynaklarda hasta VE cari hâlâ zorunludur', () => {
      expect(() => CardChargeback.open(props({ patientId: null }))).toThrow(
        ChargebackSourceActorsInvalidException
      );
      expect(() => CardChargeback.open(props({ partyId: null }))).toThrow(
        ChargebackSourceActorsInvalidException
      );
      expect(() =>
        CardChargeback.open(
          props({
            sourceType: 'ONLINE_PAYMENT',
            patientId: null,
            partyId: null,
          })
        )
      ).toThrow(ChargebackSourceActorsInvalidException);
    });

    it('kayıp çözümü de carisiz yürür (durum makinesi aynı)', () => {
      const cb = CardChargeback.open(bookingProps());

      cb.resolveLost({
        resolvedAt: RESOLVED_AT,
        note: null,
        resolvedById: 'admin-1',
      });

      expect(cb.status).toBe('LOST');
    });
  });

  describe('open()', () => {
    it('OPEN doğar; çözüm alanları boş, köprü izi yok', () => {
      const cb = CardChargeback.open(props());

      expect(cb.status).toBe('OPEN');
      expect(cb.isOpen()).toBe(true);
      expect(cb.resolvedAt).toBeNull();
      expect(cb.resolvedFundsChannel).toBeNull();
      expect(cb.planSyncStatus).toBeNull();
      expect(cb.openedEventId).toBeNull();
      expect(cb.resolvedEventId).toBeNull();
      expect(cb.recordedById).toBe('firebase-uid-1');
      expect(cb.resolvedById).toBeNull();
    });

    it('vaka numarası kırpılır; boş vaka numarası reddedilir', () => {
      expect(
        CardChargeback.open(props({ caseReference: '  CB-9  ' })).caseReference
      ).toBe('CB-9');
      // Boş numara idempotency anahtarının yarısını yok eder: aynı itiraz iki
      // kez girilince DB kısıtı ayırt edemez ve 127 iki kez dolar.
      expect(() =>
        CardChargeback.open(props({ caseReference: '   ' }))
      ).toThrow(ChargebackReferenceRequiredException);
    });

    it('tutar pozitif olmak zorunda; ücret sıfır olabilir ama negatif olamaz', () => {
      expect(() =>
        CardChargeback.open(props({ amount: new Decimal(0) }))
      ).toThrow(ChargebackInvalidAmountException);
      expect(() =>
        CardChargeback.open(props({ amount: new Decimal(-5) }))
      ).toThrow(ChargebackInvalidAmountException);
      expect(() =>
        CardChargeback.open(props({ feeAmount: new Decimal(-1) }))
      ).toThrow(ChargebackInvalidAmountException);

      expect(() =>
        CardChargeback.open(props({ feeAmount: new Decimal(0) }))
      ).not.toThrow();
    });

    it('sonsuz / NaN tutar reddedilir', () => {
      expect(() =>
        CardChargeback.open(props({ amount: new Decimal(NaN) }))
      ).toThrow(ChargebackInvalidAmountException);
      expect(() =>
        CardChargeback.open(props({ feeAmount: new Decimal(Infinity) }))
      ).toThrow(ChargebackInvalidAmountException);
    });

    it('kuruştan ince tutar reddedilir (DB Decimal(14,2) sessizce yuvarlardı)', () => {
      expect(() =>
        CardChargeback.open(props({ amount: new Decimal('10.005') }))
      ).toThrow(ChargebackInvalidPrecisionException);
      expect(() =>
        CardChargeback.open(props({ feeAmount: new Decimal('0.001') }))
      ).toThrow(ChargebackInvalidPrecisionException);
    });

    it('sanal POS kaynağında taksit kimliği kaynaktan türer (DB CHECK ile aynı kural)', () => {
      const online = CardChargeback.open(
        props({ sourceType: 'ONLINE_PAYMENT', sourceId: SOURCE_ID })
      );
      expect(online.installmentId).toBe(SOURCE_ID);

      // POS'ta hangi taksidin ödendiği kaybedilince tutar eşleşmesiyle bulunur.
      const pos = CardChargeback.open(props({ sourceType: 'POS_TRANSACTION' }));
      expect(pos.installmentId).toBeNull();
    });
  });

  describe('çözüm (tek seferlik durum makinesi)', () => {
    it('resolveWon: WON olur, para dönüş kanalını ve damgayı taşır', () => {
      const cb = CardChargeback.open(props());

      cb.resolveWon({
        resolvedAt: RESOLVED_AT,
        fundsChannel: 'BANK',
        bankAccountId: randomUUID(),
        note: 'Delil kabul edildi',
        resolvedById: 'firebase-uid-2',
      });

      expect(cb.status).toBe('WON');
      expect(cb.isOpen()).toBe(false);
      expect(cb.resolvedAt).toEqual(RESOLVED_AT);
      expect(cb.resolvedFundsChannel).toBe('BANK');
      expect(cb.resolutionNote).toBe('Delil kabul edildi');
      expect(cb.resolvedById).toBe('firebase-uid-2');
    });

    it('resolveWon: dönüş kanalı olmadan reddedilir', () => {
      const cb = CardChargeback.open(props());

      expect(() =>
        cb.resolveWon({
          resolvedAt: RESOLVED_AT,
          fundsChannel: undefined as never,
          resolvedById: 'firebase-uid-2',
        })
      ).toThrow(ChargebackReturnChannelRequiredException);
      expect(cb.status).toBe('OPEN');
    });

    it('resolveLost: LOST olur, para dönmediği için kanal yazılmaz', () => {
      const cb = CardChargeback.open(props());

      cb.resolveLost({
        resolvedAt: RESOLVED_AT,
        resolvedById: 'firebase-uid-2',
      });

      expect(cb.status).toBe('LOST');
      expect(cb.resolvedFundsChannel).toBeNull();
      expect(cb.resolvedBankAccountId).toBeNull();
    });

    it('çözülmüş itiraz tekrar çözülemez — kazanılan kaybedilene çevrilemez (ve tersi)', () => {
      const won = CardChargeback.open(props());
      won.resolveWon({
        resolvedAt: RESOLVED_AT,
        fundsChannel: 'FUNDS_IN_TRANSIT',
        resolvedById: 'u',
      });

      expect(() =>
        won.resolveLost({ resolvedAt: RESOLVED_AT, resolvedById: 'u' })
      ).toThrow(ChargebackAlreadyResolvedException);
      expect(won.status).toBe('WON');

      const lost = CardChargeback.open(props());
      lost.resolveLost({ resolvedAt: RESOLVED_AT, resolvedById: 'u' });

      expect(() =>
        lost.resolveWon({
          resolvedAt: RESOLVED_AT,
          fundsChannel: 'BANK',
          resolvedById: 'u',
        })
      ).toThrow(ChargebackAlreadyResolvedException);
      expect(lost.status).toBe('LOST');
    });

    it('çözüm tarihi açılış tarihinden önce olamaz; reddedilince durum değişmez', () => {
      const cb = CardChargeback.open(props());

      expect(() =>
        cb.resolveLost({
          resolvedAt: new Date('2026-10-09T00:00:00Z'),
          resolvedById: 'u',
        })
      ).toThrow(ChargebackInvalidDateException);

      expect(cb.status).toBe('OPEN');
      expect(cb.resolvedAt).toBeNull();
    });

    it('çözüm tarihi açılışla aynı gün olabilir', () => {
      const cb = CardChargeback.open(props());

      expect(() =>
        cb.resolveLost({ resolvedAt: OPENED_AT, resolvedById: 'u' })
      ).not.toThrow();
    });
  });

  describe('plan yansıması ve köprü izi', () => {
    it('recordPlanSync yalnız LOST’ta kaydedilir', () => {
      const open = CardChargeback.open(props());
      expect(() => open.recordPlanSync({ status: 'SYNCED' })).toThrow(
        ChargebackPlanSyncNotApplicableException
      );

      const won = CardChargeback.open(props());
      won.resolveWon({
        resolvedAt: RESOLVED_AT,
        fundsChannel: 'BANK',
        resolvedById: 'u',
      });
      expect(() => won.recordPlanSync({ status: 'SYNCED' })).toThrow(
        ChargebackPlanSyncNotApplicableException
      );
    });

    it('LOST’ta yansıma sonucu, geri alınan taksit ve telafi taksidi saklanır', () => {
      const cb = CardChargeback.open(props());
      cb.resolveLost({ resolvedAt: RESOLVED_AT, resolvedById: 'u' });
      const installmentId = randomUUID();
      const recoveryId = randomUUID();

      cb.recordPlanSync({
        status: 'SYNCED',
        installmentId,
        recoveryInstallmentId: recoveryId,
      });

      expect(cb.planSyncStatus).toBe('SYNCED');
      expect(cb.installmentId).toBe(installmentId);
      expect(cb.recoveryInstallmentId).toBe(recoveryId);
    });

    it('sanal POS’ta taksit kimliği yansıma sonucunda ezilmez', () => {
      const cb = CardChargeback.open(
        props({ sourceType: 'ONLINE_PAYMENT', sourceId: SOURCE_ID })
      );
      cb.resolveLost({ resolvedAt: RESOLVED_AT, resolvedById: 'u' });

      cb.recordPlanSync({ status: 'NO_MATCHING_INSTALLMENT' });

      expect(cb.installmentId).toBe(SOURCE_ID);
      expect(cb.recoveryInstallmentId).toBeNull();
    });

    it('açılış ve çözüm fişinin köprü izleri ayrı ayrı damgalanır', () => {
      const cb = CardChargeback.open(props());

      cb.markOpenedPosted({ accountingEventId: 'evt-open' });
      cb.resolveLost({ resolvedAt: RESOLVED_AT, resolvedById: 'u' });
      cb.markResolvedPosted({ accountingEventId: 'evt-resolve' });

      expect(cb.openedEventId).toBe('evt-open');
      expect(cb.resolvedEventId).toBe('evt-resolve');
    });
  });

  describe('toPersistence() — mapping kilidi (CLAUDE.md kural 9)', () => {
    it('şemadaki her kolonu taşır', () => {
      const cb = CardChargeback.open(props());
      const persisted = cb.toPersistence();

      // Şemaya eklenen yeni kolon entity'ye/`toPersistence`'a eklenmezse repo
      // INSERT'te sessizce NULL yazar. Beklenen küme elle değil, ÜRETİLEN şemadan
      // okunur: yeni kolon eklendiği an bu test kendiliğinden kırmızıya düşer.
      expect(Object.keys(persisted).sort()).toEqual(
        Object.keys(CardChargebackSchema.shape).sort()
      );
    });

    it('toPersistence → constructor gidiş-dönüşü kaybetmez', () => {
      const cb = CardChargeback.open(props());
      cb.resolveLost({ resolvedAt: RESOLVED_AT, resolvedById: 'u' });
      cb.recordPlanSync({
        status: 'SYNCED',
        installmentId: randomUUID(),
        recoveryInstallmentId: randomUUID(),
      });

      const restored = new CardChargeback(cb.toPersistence());

      expect(restored.toPersistence()).toEqual(cb.toPersistence());
    });
  });
});
