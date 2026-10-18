import { PosTransaction } from './pos-transaction.entity';
import {
  PosAmountInvalidPrecisionException,
  PosTransactionAlreadySettledException,
  PosTransactionClinicMismatchException,
  PosTransactionReversalRequiresOriginalException,
} from '@modules/finance/pos/physical/domain/exceptions/pos.exceptions';
import PosTransactionKindSchema from '@input-type-schemas/PosTransactionKindSchema';
import CurrencySchema from '@input-type-schemas/CurrencySchema';
import { PosTransactionReversedEvent } from '@modules/finance/pos/physical/domain/events/pos-transaction-reversed.event';
import { PosTransactionSucceededEvent } from '@modules/finance/pos/physical/domain/events/pos-transaction-succeeded.event';
import { LogAction } from '@src/domain/constants/log-action.constant';

/**
 * İptal kilidi (`activeVoidOriginalId`) DB'deki unique kısıtın domain tarafındaki
 * yüzüdür: canlı bir iptalde dolu, terminal başarısızlıkta boştur. Bu davranış
 * bozulursa ya çift iptal (kilit erken bırakılır) ya da bir daha hiç iptal
 * edilemeyen satış (kilit hiç bırakılmaz) ortaya çıkar.
 */
describe('PosTransaction — ters kayıt bağı ve iptal kilidi', () => {
  const DEVICE_ID = '11111111-1111-4111-8111-111111111111';
  const CLINIC_ID = '22222222-2222-4222-8222-222222222222';
  const ORIGINAL_ID = '33333333-3333-4333-8333-333333333333';

  const base = {
    posDeviceId: DEVICE_ID,
    clinicId: CLINIC_ID,
    amount: 123.45,
    currency: CurrencySchema.enum.TRY,
    initiatedById: 'firebase-staff-uid-1',
  };

  const makeVoid = () =>
    PosTransaction.create({
      ...base,
      kind: PosTransactionKindSchema.enum.VOID,
      originalPosTransactionId: ORIGINAL_ID,
    });

  it('satış kaydı ters kayıt alanlarını taşımaz', () => {
    const sale = PosTransaction.create(base);

    expect(sale.kind).toBe(PosTransactionKindSchema.enum.SALE);
    expect(sale.originalPosTransactionId).toBeNull();
    expect(sale.activeVoidOriginalId).toBeNull();
  });

  it('iptal kaydı orijinale bağlanır ve kilidi PENDING iken tutar', () => {
    const voidTx = makeVoid();

    expect(voidTx.kind).toBe(PosTransactionKindSchema.enum.VOID);
    expect(voidTx.originalPosTransactionId).toBe(ORIGINAL_ID);
    // Cihaz çağrısı sürerken gelen ikinci iptal DB kısıtına takılsın diye kilit
    // kayıt doğar doğmaz tutulur.
    expect(voidTx.activeVoidOriginalId).toBe(ORIGINAL_ID);
  });

  it('iade kaydı orijinale bağlanır ama iptal kilidini tutmaz (kısmi iadeler çoklu olabilir)', () => {
    const refundTx = PosTransaction.create({
      ...base,
      amount: 30,
      kind: PosTransactionKindSchema.enum.REFUND,
      originalPosTransactionId: ORIGINAL_ID,
    });

    expect(refundTx.originalPosTransactionId).toBe(ORIGINAL_ID);
    expect(refundTx.activeVoidOriginalId).toBeNull();
  });

  it('orijinal işlem verilmeden ters kayıt açılamaz', () => {
    expect(() =>
      PosTransaction.create({
        ...base,
        kind: PosTransactionKindSchema.enum.VOID,
      })
    ).toThrow(PosTransactionReversalRequiresOriginalException);
  });

  it('başarılı iptal kilidi bırakmaz — satış bir daha iptal edilemez', () => {
    const voidTx = makeVoid();

    voidTx.markSuccess('HOSTREF-1');

    expect(voidTx.activeVoidOriginalId).toBe(ORIGINAL_ID);
  });

  it.each([
    ['markFailed', (tx: PosTransaction) => tx.markFailed()],
    ['markCancelled', (tx: PosTransaction) => tx.markCancelled()],
    ['markTimeout', (tx: PosTransaction) => tx.markTimeout()],
  ])('%s kilidi bırakır — iptal yeniden denenebilir', (_name, apply) => {
    const voidTx = makeVoid();

    apply(voidTx);

    expect(voidTx.activeVoidOriginalId).toBeNull();
  });

  it('bırakılan kilit kalıcılığa da yansır (repo update alanı yazabilsin)', () => {
    const voidTx = makeVoid();

    voidTx.markFailed();

    const persisted = voidTx.toPersistence();
    expect(persisted.activeVoidOriginalId).toBeNull();
    expect(persisted.kind).toBe(PosTransactionKindSchema.enum.VOID);
    expect(persisted.originalPosTransactionId).toBe(ORIGINAL_ID);
  });

  describe('kiracı kapsamı — assertBelongsToClinic', () => {
    const OTHER_CLINIC = '44444444-4444-4444-8444-444444444444';

    it('kendi kliniği geçilirse sorun çıkarmaz', () => {
      const sale = PosTransaction.create(base);
      expect(() => sale.assertBelongsToClinic(CLINIC_ID)).not.toThrow();
    });

    it('başka klinik geçilirse reddeder', () => {
      // Regresyon: iptal/iade handler'ları yetkiyi `input.clinicId` ile veriyor,
      // ters kaydedilecek orijinal işlem ise ayrı bir alandan geliyordu. Kontrol
      // yokken A kliniği personeli B kliniğinin satışını iptal edebiliyordu —
      // para B'nin üye işyerinden geri döner, kayıt A'nın defterine düşerdi.
      const sale = PosTransaction.create(base);

      expect(() => sale.assertBelongsToClinic(OTHER_CLINIC)).toThrow(
        PosTransactionClinicMismatchException
      );
    });

    it('reddetme meta ile hangi kliniklerin çeliştiğini bildirir', () => {
      const sale = PosTransaction.create(base);
      try {
        sale.assertBelongsToClinic(OTHER_CLINIC);
        throw new Error('beklenen hata fırlatılmadı');
      } catch (caught) {
        const error = caught as PosTransactionClinicMismatchException;
        expect(error.meta).toEqual({
          transactionClinicId: CLINIC_ID,
          requestedClinicId: OTHER_CLINIC,
        });
      }
    });
  });

  describe("durum geçişi yalnız PENDING'den yapılabilir", () => {
    /**
     * Regresyon: `markSuccess` durum kontrolü yapmıyordu. Cihazın tekrar
     * gönderdiği bir callback işlemi ikinci kez sonuçlandırıyor, PosPaymentSync
     * de o an PENDING olan **bir sonraki taksiti** kapatıyordu → tek kart
     * çekimiyle iki taksit tahsil edilmiş görünüyordu.
     */
    it('sonuçlanmış işlem ikinci kez başarılı işaretlenemez', () => {
      const sale = PosTransaction.create(base);
      sale.markSuccess('HOSTREF-1');

      expect(() => sale.markSuccess('HOSTREF-1')).toThrow(
        PosTransactionAlreadySettledException
      );
    });

    it('başarısız işlem sonradan başarılıya çevrilemez', () => {
      const sale = PosTransaction.create(base);
      sale.markFailed();

      expect(() => sale.markSuccess('HOSTREF-1')).toThrow(
        PosTransactionAlreadySettledException
      );
    });

    it('zaman aşımına düşen işlem tekrar zaman aşımı olamaz', () => {
      const sale = PosTransaction.create(base);
      sale.markTimeout();

      expect(() => sale.markTimeout()).toThrow(
        PosTransactionAlreadySettledException
      );
    });

    it('PENDING işlem normal şekilde sonuçlanır', () => {
      const sale = PosTransaction.create(base);

      expect(() => sale.markSuccess('HOSTREF-1')).not.toThrow();
      expect(sale.status).toBe('SUCCESS');
    });
  });
});

/**
 * Hasta kimliği ve tutar hassasiyeti — ikisi de sessiz hata üretiyordu.
 */
describe('PosTransaction — hasta kimliği ve tutar hassasiyeti', () => {
  const DEVICE_ID = '11111111-1111-4111-8111-111111111111';
  const CLINIC_ID = '22222222-2222-4222-8222-222222222222';
  const PATIENT_ID = '44444444-4444-4444-8444-444444444444';

  const base = {
    posDeviceId: DEVICE_ID,
    clinicId: CLINIC_ID,
    amount: 100,
    currency: CurrencySchema.enum.TRY,
    initiatedById: 'firebase-staff-uid-1',
  };

  it('hasta kimliği UUID olarak taşınır ve yeniden hidrasyonda patlamaz', () => {
    // Regresyon: ctor `FirebaseUid` kullanıyordu (tam 28 alfanümerik). `Patient.id`
    // bir UUID olduğu için hasta taşıyan HER işlem kaydı okunurken
    // `InvalidFirebaseUidException` atıyordu — iptal/iade/mutabakat yolları o
    // kayıtlar için tamamen kapalıydı.
    const tx = PosTransaction.create({ ...base, patientId: PATIENT_ID });

    expect(tx.patientId?.value).toBe(PATIENT_ID);

    const rehydrated = new PosTransaction(tx.toPersistence());
    expect(rehydrated.patientId?.value).toBe(PATIENT_ID);
  });

  it('hasta verilmezse kimlik null kalır', () => {
    const tx = PosTransaction.create(base);
    expect(tx.patientId).toBeNull();
    expect(new PosTransaction(tx.toPersistence()).patientId).toBeNull();
  });

  it('kuruştan ince tutar reddedilir', () => {
    // DB kolonu Decimal(10,2) ve cihaza minor-unit gidiyor: fazla hane sessizce
    // yuvarlanır, çekilen tutar ile kayıt ayrışır.
    expect(() => PosTransaction.create({ ...base, amount: 10.005 })).toThrow(
      PosAmountInvalidPrecisionException
    );
  });
});

/**
 * Kart çekimi, iptali ve iadesi birer para hareketidir; "kim yaptı" damgası
 * chargeback/itiraz incelemesinin tek dayanağıdır. Damga mapping'den düşerse
 * hata vermez, log üretmez ve geriye dönük kurtarılamaz (CLAUDE.md kural 9) —
 * bu yüzden hem `create` hem `toPersistence` kilitlenir.
 */
describe('PosTransaction — işlemi başlatan personel damgası', () => {
  const DEVICE_ID = '44444444-4444-4444-8444-444444444444';
  const CLINIC_ID = '55555555-5555-4555-8555-555555555555';
  const ORIGINAL_ID = '66666666-6666-4666-8666-666666666666';
  const SELLER = 'firebase-uid-satisi-ceken';
  const REVERSER = 'firebase-uid-iptali-yapan';

  const base = {
    posDeviceId: DEVICE_ID,
    clinicId: CLINIC_ID,
    amount: 50,
    currency: CurrencySchema.enum.TRY,
    initiatedById: SELLER,
  };

  it('satış damgayı taşır ve personel kimliği ham string kalır', () => {
    const sale = PosTransaction.create(base);

    // Personel kimliği Firebase UID'dir; UUID VO'suna sarılırsa create patlar.
    expect(sale.initiatedById).toBe(SELLER);
  });

  it('damga persistence üzerinden kaybolmadan geri gelir', () => {
    const sale = PosTransaction.create(base);

    expect(sale.toPersistence().initiatedById).toBe(SELLER);
    expect(new PosTransaction(sale.toPersistence()).initiatedById).toBe(SELLER);
  });

  it('ters kayıt satışı çekeni değil, ters kaydı atanı damgalar', () => {
    // Her ters kayıt kendi satırıdır: tek kolon "satışı kim çekti" ve "iptali
    // kim yaptı" sorularını birlikte cevaplar. Orijinalin damgası devralınırsa
    // iptali yapan kişi izde hiç görünmez.
    const voidTx = PosTransaction.create({
      ...base,
      initiatedById: REVERSER,
      kind: PosTransactionKindSchema.enum.VOID,
      originalPosTransactionId: ORIGINAL_ID,
    });

    expect(voidTx.initiatedById).toBe(REVERSER);
    expect(voidTx.originalPosTransactionId).toBe(ORIGINAL_ID);
  });

  it('eski kayıtlar damgasız rehidrasyon edilebilir', () => {
    // Kolon mevcut satırlar için nullable: geçmişin aktörü bilinemez ve
    // uydurulamaz. Rehidrasyon bunu yeniden yargılamaz (saklanmış veri okuma
    // anında doğrulanmaz kuralı).
    const sale = PosTransaction.create(base);
    const legacy = new PosTransaction({
      ...sale.toPersistence(),
      initiatedById: null,
    });

    expect(legacy.initiatedById).toBeNull();
  });
});

/**
 * Kural 7'nin ikinci yarısı: damga yalnız kolonda durursa iz ADLİDİR (DB'den
 * elle sorgulanır); itiraz incelemesinin baktığı yer `audit_logs`. Bu yüzden
 * ters kayıt başarıya ulaştığında ayrı bir denetim olayı fırlatılır.
 */
describe('PosTransaction — ters kayıt denetim olayı', () => {
  const DEVICE_ID = '77777777-7777-4777-8777-777777777777';
  const CLINIC_ID = '88888888-8888-4888-8888-888888888888';
  const ORIGINAL_ID = '99999999-9999-4999-8999-999999999999';
  const REVERSER = 'firebase-uid-iptali-yapan';

  const base = {
    posDeviceId: DEVICE_ID,
    clinicId: CLINIC_ID,
    amount: 75.5,
    currency: CurrencySchema.enum.TRY,
    initiatedById: REVERSER,
  };

  const reversed = (tx: PosTransaction) =>
    tx
      .getDomainEvents()
      .filter(
        (e): e is PosTransactionReversedEvent =>
          e instanceof PosTransactionReversedEvent
      );

  it('başarılı iptal denetim olayı fırlatır ve aktörü taşır', () => {
    const voidTx = PosTransaction.create({
      ...base,
      kind: PosTransactionKindSchema.enum.VOID,
      originalPosTransactionId: ORIGINAL_ID,
    });

    voidTx.markSuccess('HOSTREF-1');

    const events = reversed(voidTx);
    expect(events).toHaveLength(1);
    expect(events[0].log?.actorId).toBe(REVERSER);
    expect(events[0].log?.action).toBe(LogAction.POS_TRANSACTION_REVERSED);
    expect(events[0].kind).toBe(PosTransactionKindSchema.enum.VOID);
    expect(events[0].originalPosTransactionId).toBe(ORIGINAL_ID);
    // Tutar string taşınır: Decimal serileştirmede hane kaybı olmasın.
    expect(events[0].amount).toBe('75.5');
  });

  it('iade de ters kayıt sayılır', () => {
    const refund = PosTransaction.create({
      ...base,
      kind: PosTransactionKindSchema.enum.REFUND,
      originalPosTransactionId: ORIGINAL_ID,
    });

    refund.markSuccess('HOSTREF-2');

    expect(reversed(refund)).toHaveLength(1);
  });

  it('satış ters kayıt olayı fırlatmaz, yalnız başarı olayı', () => {
    const sale = PosTransaction.create(base);

    sale.markSuccess('HOSTREF-3');

    expect(reversed(sale)).toHaveLength(0);
    expect(
      sale
        .getDomainEvents()
        .filter((e) => e instanceof PosTransactionSucceededEvent)
    ).toHaveLength(1);
  });

  it('başarısız iptal denemesi ters kayıt izi bırakmaz', () => {
    // Para geri gelmediyse "iptal edildi" demek yanlış iz olur.
    const voidTx = PosTransaction.create({
      ...base,
      kind: PosTransactionKindSchema.enum.VOID,
      originalPosTransactionId: ORIGINAL_ID,
    });

    voidTx.markFailed({ code: '51' });

    expect(reversed(voidTx)).toHaveLength(0);
  });
});

describe('PosTransaction — sağlayıcı ham yanıtı maskelenir', () => {
  const base = {
    posDeviceId: '11111111-1111-4111-8111-111111111111',
    clinicId: '22222222-2222-4222-8222-222222222222',
    amount: 100,
    currency: CurrencySchema.enum.TRY,
    initiatedById: 'firebase-staff-uid-1',
  };

  const providerResponse = {
    status: 'approved',
    maskedCardNumber: '552608******0006',
    lastFourDigits: '0006',
    // Gerçek sağlayıcı adapter'ının ne döndüreceği bilinmiyor; credential
    // dönerse blob'a ham girmemeli.
    cardToken: 'ctk-secret',
    paymentCard: { cardUserKey: 'cuk-secret' },
  };

  it('başarılı geçiş: credential maskelenir, tanı alanları KORUNUR', () => {
    const tx = PosTransaction.create(base);
    tx.markSuccess('ext-1', providerResponse);

    const raw = tx.rawResponse as Record<string, unknown>;
    expect(raw.cardToken).toBe('[REDACTED]');
    expect((raw.paymentCard as Record<string, unknown>).cardUserKey).toBe(
      '[REDACTED]'
    );
    // Maskeli kart bilgisi tanı için gerekli — maskelenmez.
    expect(raw.maskedCardNumber).toBe('552608******0006');
    expect(raw.status).toBe('approved');
  });

  it('başarısız ve iptal geçişleri de aynı kapıdan geçer', () => {
    // Üç geçiş aynı atamayı tekrarlıyordu; biri atlanırsa blob ham kalırdı.
    const failed = PosTransaction.create(base);
    failed.markFailed(providerResponse);
    expect((failed.rawResponse as Record<string, unknown>).cardToken).toBe(
      '[REDACTED]'
    );

    const cancelled = PosTransaction.create(base);
    cancelled.markCancelled(providerResponse);
    expect((cancelled.rawResponse as Record<string, unknown>).cardToken).toBe(
      '[REDACTED]'
    );
  });

  it('girdi nesnesi mutasyona uğramaz', () => {
    const tx = PosTransaction.create(base);
    tx.markSuccess('ext-1', providerResponse);

    expect(providerResponse.cardToken).toBe('ctk-secret');
  });
});
