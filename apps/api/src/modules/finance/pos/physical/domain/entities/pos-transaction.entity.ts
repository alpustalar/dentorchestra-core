import { PosTransaction as IPosTransaction } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { PosTransactionSucceededEvent } from '../events/pos-transaction-succeeded.event';
import { PosTransactionReversedEvent } from '../events/pos-transaction-reversed.event';
import { LogAction, LogType } from '@src/domain/constants/log-action.constant';
import { PosTransactionFailedEvent } from '../events/pos-transaction-failed.event';
import { PosTransactionCancelledEvent } from '../events/pos-transaction-cancelled.event';
import { PosTransactionTimeoutEvent } from '../events/pos-transaction-timeout.event';
import PosTransactionStatusSchema, {
  PosTransactionStatusType as PosTransactionStatus,
} from '@input-type-schemas/PosTransactionStatusSchema';
import PosTransactionKindSchema, {
  PosTransactionKindType as PosTransactionKind,
} from '@input-type-schemas/PosTransactionKindSchema';
import { JsonValueType } from '@input-type-schemas/JsonValueSchema';
import { Money } from '@src/domain/value-objects/money.vo';
import { CreatePosTransactionProps } from '@modules/finance/pos/physical/domain/contracts/pos-transaction';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { Guard } from '@common/domain/guards';
import { JsonValue } from '@common/interfaces';
import {
  PosAmountInvalidPrecisionException,
  PosTransactionAlreadySettledException,
  PosTransactionClinicMismatchException,
  PosTransactionMissingExternalRefException,
} from '@modules/finance/pos/physical/domain/exceptions/pos.exceptions';
import { isNotUndefined } from '@common/utils/is-not-undefined';
import { redactSensitive } from '@common/utils';
import { PosTransactionReversalRequiresOriginalException } from '@modules/finance/pos/physical/domain/exceptions/pos.exceptions';

/**
 * Fiziksel POS işlemini temsil eden domain entity.
 *
 * Durum geçişleri yalnızca `mark*` metodları üzerinden yapılır ve her geçiş
 * PENDING → terminal durum invariant'ını korur.
 *
 * ⚠️ Geçişler **sessizce yok saymaz**: terminal bir işlem tekrar işaretlenmeye
 * çalışılırsa `PosTransactionAlreadySettledException` fırlatılır. Tekrarlanan
 * callback/mutabakat yarışında sessiz davranmak isteyen çağıran, önce
 * `validate.status.isPending().value` ile kontrol eder (bkz. handle-pos-callback,
 * reconcile). Yorumun tersini söylediği bu fark, "zaten idempotent" sanılan
 * yeni bir çağıranın 500 üretmesine yol açardı.
 *
 */
export class PosTransaction extends AggregateRoot {
  constructor(data: IPosTransaction) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._posDeviceId = data.posDeviceId;
    this._clinicId = UUID.fromTrusted(data.clinicId);
    // `FirebaseUid` ile okunuyordu: `Patient.id` bir UUID olduğu için
    // (firebaseUid ayrı/nullable bir kolon) hasta taşıyan HER işlem kaydı
    // hidrasyonda `InvalidFirebaseUidException` ile patlıyordu — iptal/iade ve
    // mutabakat yolları o kayıtlar için tamamen kapalıydı.
    this._patientId = UUID.create(data.patientId).instance ?? null;
    this._appointmentId = UUID.create(data.appointmentId).instance ?? null;
    this._paymentId = data.paymentId;
    this._amount = Money.fromTrusted(data.amount, data.currency);
    this._status = data.status;
    this._kind = data.kind;
    this._originalPosTransactionId = data.originalPosTransactionId;
    this._activeVoidOriginalId = data.activeVoidOriginalId;
    this._externalRef = data.externalRef;
    this._rawRequest = data.rawRequest;
    this._rawResponse = data.rawResponse;
    this._initiatedById = data.initiatedById;
    this._initiatedAt = data.initiatedAt;
    this._completedAt = data.completedAt;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;

  get id(): UUID {
    return this._id;
  }

  private _posDeviceId: string;

  get posDeviceId(): string {
    return this._posDeviceId;
  }

  /**
   * İşlemin hedef kliniğe ait olduğunu doğrular.
   *
   * İptal/iade akışlarında yetki `input.clinicId` üzerinden veriliyor ama ters
   * kaydedilecek ORİJİNAL işlem ayrı bir alandan (`originalPosTransactionId`)
   * geliyordu: kendi kliniğinin id'siyle başka kliniğin satışını iptal etmek
   * mümkündü — para o kliniğin üye işyerinden geri döner, kayıt çağıranın
   * defterine düşerdi.
   */
  public assertBelongsToClinic(clinicId: string): void {
    if (this._clinicId.value !== clinicId) {
      throw new PosTransactionClinicMismatchException(
        this._clinicId.value,
        clinicId
      );
    }
  }

  private _clinicId: UUID;

  get clinicId(): UUID {
    return this._clinicId;
  }

  private _patientId: UUID | null;

  get patientId(): UUID | null {
    return this._patientId;
  }

  private _appointmentId: UUID | null;

  get appointmentId(): UUID | null {
    return this._appointmentId;
  }

  private _paymentId: string | null;

  get paymentId(): string | null {
    return this._paymentId;
  }

  private _amount: Money;

  get amount(): Money {
    return this._amount;
  }

  private _status: PosTransactionStatus;

  get status(): PosTransactionStatus {
    return this._status;
  }

  private _kind: PosTransactionKind;

  get kind(): PosTransactionKind {
    return this._kind;
  }

  private _originalPosTransactionId: string | null;

  get originalPosTransactionId(): string | null {
    return this._originalPosTransactionId;
  }

  /**
   * İptal kilidi: yalnız canlı (PENDING/SUCCESS) bir VOID kaydında doludur. DB'deki
   * unique kısıt bu alan üzerinden "bir satışın en fazla bir canlı iptali" kuralını
   * uygular; iptal başarısız olduğunda alan null'a çekilir ve yeniden denenebilir.
   */

  private _activeVoidOriginalId: string | null;

  get activeVoidOriginalId(): string | null {
    return this._activeVoidOriginalId;
  }

  private _externalRef: string | null;

  get externalRef(): string | null {
    return this._externalRef;
  }

  private _rawRequest: JsonValueType | null;

  get rawRequest(): JsonValueType | null {
    return this._rawRequest;
  }

  private _rawResponse: JsonValueType | null;

  get rawResponse(): JsonValueType | null {
    return this._rawResponse;
  }

  /** Personel kimliği ham string (Firebase UID) — UUID VO'suna sarılmaz. */
  private _initiatedById: string | null;

  get initiatedById(): string | null {
    return this._initiatedById;
  }

  private _initiatedAt: Date;

  get initiatedAt(): Date {
    return this._initiatedAt;
  }

  private _completedAt: Date | null;

  get completedAt(): Date | null {
    return this._completedAt;
  }

  private _createdAt: Date;

  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;

  get updatedAt(): Date {
    return this._updatedAt;
  }

  public get validate() {
    return {
      status: {
        isPending: (error?: Error) => this.isPending(error),
        isSuccess: (error?: Error) => this.isSuccess(error),
      },
      has: {
        externalRef: (error?: Error) => {
          const exRef = this._externalRef;
          return Guard.monitor(
            exRef,
            !!exRef,
            () => error ?? new PosTransactionMissingExternalRefException()
          );
        },
      },
    };
  }

  public static create(props: CreatePosTransactionProps): PosTransaction {
    const now = DateTimeManager.create();

    const money = Money.create(props.amount, props.currency).orThrow();

    // Kuruştan ince tutar hem DB kolonunda (`Decimal(10,2)`) hem cihaza giden
    // minor-unit çevriminde sessizce yuvarlanır: çekilen tutar ile kayda geçen
    // tutar ayrışır ve mutabakat sonradan çözülemez.
    if (money.value.decimalPlaces() > Money.PRECISION) {
      throw new PosAmountInvalidPrecisionException(money.value.toString());
    }

    const kind = props.kind ?? PosTransactionKindSchema.enum.SALE;
    const isSale = kind === PosTransactionKindSchema.enum.SALE;

    // Ters kayıt (iptal/iade) daima bir satışa bağlanır — denetim izi ve iptal
    // kilidi bu bağa dayanır; bağsız bir ters kayıt sessizce korumasız kalırdı.
    if (!isSale && !props.originalPosTransactionId) {
      throw new PosTransactionReversalRequiresOriginalException();
    }

    const originalPosTransactionId = isSale
      ? null
      : (props.originalPosTransactionId ?? null);

    return new PosTransaction({
      id: UUID.createOrGenerate(props.id).value,
      posDeviceId: props.posDeviceId,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      patientId: UUID.create(props.patientId)?.instance?.value ?? null,
      appointmentId: UUID.create(props.appointmentId)?.instance?.value ?? null,
      paymentId: props.paymentId ?? null,
      amount: money.value,
      currency: money.currency,
      status: PosTransactionStatusSchema.enum.PENDING,
      kind,
      originalPosTransactionId,
      // Kayıt PENDING doğduğu için iptal kilidi ilk andan itibaren tutulur:
      // cihaz çağrısı sürerken gelen ikinci iptal isteği DB kısıtına takılır.
      activeVoidOriginalId:
        kind === PosTransactionKindSchema.enum.VOID
          ? originalPosTransactionId
          : null,
      externalRef: props.externalRef ?? null,
      rawRequest: props.rawRequest as JsonValue,
      rawResponse: null,
      initiatedById: props.initiatedById,
      initiatedAt: now,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Terminalin döndürdüğü referansı/ham isteği işler (durum değiştirmez). */
  public setExternalRef(externalRef: string, rawRequest?: unknown): void {
    this._externalRef = externalRef;
    if (isNotUndefined(rawRequest)) {
      this._rawRequest = rawRequest as JsonValue;
    }
  }

  public markSuccess(externalRef?: string, rawResponse?: unknown): void {
    this.assertPending();

    this._status = PosTransactionStatusSchema.enum.SUCCESS;

    if (externalRef) this._externalRef = externalRef;

    this._applyRawResponse(rawResponse);
    this._completedAt = DateTimeManager.create();

    this.addDomainEvent(
      new PosTransactionSucceededEvent({
        posTransactionId: this.id.value,
        clinicId: this.clinicId.value,
        paymentId: this.paymentId,
        externalRef: this.externalRef,
        amount: this.amount.value,
        currency: this.amount.currency,
      })
    );

    // İptal/iade yüksek etkili bir para hareketidir: "kim geri aldı" izi kolonun
    // yanında audit log'da da durmalı (CLAUDE.md kural 7 — event + kolon).
    // Satışta fırlatılmaz: her başarılı çekim için ters-kayıt izi üretmek
    // asıl olayları gürültüye boğar.
    if (this.kind !== PosTransactionKindSchema.enum.SALE) {
      this.addDomainEvent(
        new PosTransactionReversedEvent({
          posTransactionId: this.id.value,
          originalPosTransactionId: this.originalPosTransactionId,
          clinicId: this.clinicId.value,
          kind: this.kind,
          paymentId: this.paymentId,
          externalRef: this.externalRef,
          amount: this.amount.value.toString(),
          currency: this.amount.currency,
          action: LogAction.POS_TRANSACTION_REVERSED,
          type: LogType.INFO,
          // Aktör KALICI kolondan okunur: olay rehidrasyon sonrası (callback
          // yolu) fırlatılsa bile damga eksilmez.
          actorId: this.initiatedById ?? undefined,
        })
      );
    }
  }

  public markFailed(rawResponse?: unknown): void {
    this.assertPending();

    this._status = PosTransactionStatusSchema.enum.FAILED;
    this.releaseVoidGuard();
    this._applyRawResponse(rawResponse);
    this._completedAt = DateTimeManager.create();
    this.addDomainEvent(
      new PosTransactionFailedEvent({
        posTransactionId: this.id.value,
        clinicId: this.clinicId.value,
        paymentId: this.paymentId,
      })
    );
  }

  public markCancelled(rawResponse?: unknown): void {
    this.assertPending();
    this._status = PosTransactionStatusSchema.enum.CANCELLED;
    this.releaseVoidGuard();
    this._applyRawResponse(rawResponse);
    this._completedAt = DateTimeManager.create();
    this.addDomainEvent(
      new PosTransactionCancelledEvent({
        posTransactionId: this.id.value,
        clinicId: this.clinicId.value,
        paymentId: this.paymentId,
      })
    );
  }

  public markTimeout(): void {
    this.assertPending();
    this._status = PosTransactionStatusSchema.enum.TIMEOUT;
    // Zaman aşımı da kilidi bırakır ki aynı satış için yeni bir iptal denenebilsin.
    // DİKKAT: mutabakat taraması bir işlemi cihaza sormadan, yalnız YAŞINA bakarak
    // da TIMEOUT'a düşürebilir (bkz. reconcile STALE_THRESHOLD). Bu durumda kart
    // çekilmiş olabilir; o yüzden tarama bu geçişi CRITICAL alarmla birlikte yapar.
    this.releaseVoidGuard();
    this._completedAt = DateTimeManager.create();
    this.addDomainEvent(
      new PosTransactionTimeoutEvent({
        posTransactionId: this.id.value,
        clinicId: this.clinicId.value,
      })
    );
  }

  public toPersistence(): IPosTransaction {
    return {
      id: this.id.value,
      posDeviceId: this.posDeviceId,
      clinicId: this.clinicId.value,
      patientId: this.patientId?.value ?? null,
      appointmentId: this.appointmentId?.value ?? null,
      paymentId: this.paymentId,
      amount: this.amount.value,
      currency: this.amount.currency,
      status: this.status,
      kind: this.kind,
      originalPosTransactionId: this.originalPosTransactionId,
      activeVoidOriginalId: this.activeVoidOriginalId,
      externalRef: this.externalRef,
      rawRequest: this.rawRequest,
      rawResponse: this.rawResponse,
      initiatedById: this.initiatedById,
      initiatedAt: this.initiatedAt,
      completedAt: this.completedAt,
      createdAt: this.createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }

  /**
   * İptal kilidini bırakır: kayıt terminal bir başarısızlığa (FAILED/CANCELLED/TIMEOUT)
   * düştüğünde aynı satış için yeni bir iptal denemesine izin verilmelidir. Kilit
   * yalnız canlı kayıtlarda tutulduğu için DB'deki unique kısıt otomatik serbest kalır.
   */
  private releaseVoidGuard(): void {
    this._activeVoidOriginalId = null;
  }

  private isSuccess(error?: Error): Guard<boolean> {
    const is = this._status === PosTransactionStatusSchema.enum.SUCCESS;
    return Guard.monitor(
      is,
      is,
      () =>
        error ??
        new PosTransactionAlreadySettledException(this._id.value, this._status)
    );
  }

  /**
   * Durum geçişi yalnız PENDING'den yapılabilir. Cihaz callback'i tekrar
   * gönderilebilir; ikinci kez sonuçlandırmak ödeme tarafında bir sonraki
   * bekleyen taksiti kapatıyordu (tek çekim → iki taksit).
   */
  /**
   * Sağlayıcı yanıtı tanı amacıyla saklanır — **maskelenerek**.
   *
   * Üç geçiş (başarılı/başarısız/iptal) aynı atamayı tekrarlıyordu; maskeleme
   * tek bir yere konuyor ki yeni bir geçiş eklenirken atlanamasın. Bugünkü
   * fiziksel POS yanıtları yalnız maskeli kart bilgisi taşıyor (`maskedCardNumber`,
   * `lastFourDigits`), ama gerçek sağlayıcı adapter'ı yazıldığında ne döneceği
   * bilinmiyor — kapı o yüzden şimdiden burada.
   */
  private _applyRawResponse(rawResponse?: unknown): void {
    if (isNotUndefined(rawResponse)) {
      this._rawResponse = redactSensitive(rawResponse) as JsonValue;
    }
  }

  private assertPending(): void {
    if (this._status !== PosTransactionStatusSchema.enum.PENDING) {
      throw new PosTransactionAlreadySettledException(
        this._id.value,
        this._status
      );
    }
  }

  private isPending(error?: Error): Guard<boolean> {
    const is = this._status === PosTransactionStatusSchema.enum.PENDING;
    return Guard.monitor(
      is,
      is,
      () =>
        error ??
        new PosTransactionAlreadySettledException(this._id.value, this._status)
    );
  }
}
