import { redactSensitive } from '@common/utils';
import { Invoice as IInvoice } from '@model-schema/InvoiceSchema';
import {
  InvoiceStatusSchema,
  InvoiceStatusType as InvoiceStatus,
} from '@input-type-schemas/InvoiceStatusSchema';
import { EDocumentTypeType as EDocumentType } from '@input-type-schemas/EDocumentTypeSchema';
import {
  EDocumentStatusSchema,
  EDocumentStatusType as EDocumentStatus,
} from '@input-type-schemas/EDocumentStatusSchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { InvoiceIssuedEvent } from '../events/invoice-issued.event';
import { InvoiceFailedEvent } from '../events/invoice-failed.event';
import { TaxSpecification } from '@modules/finance/shared/domain/value-objects/tax-specification.vo';
import { Money } from '@src/domain/value-objects/money.vo';
import { Currency } from '@src/domain/value-objects/currency.vo';
import { InvoiceNumber } from '@modules/finance/invoice/domain/value-objects/invoice-number.vo';
import { Decimal } from 'decimal.js';
import { JsonValueType as JsonValue } from '@input-type-schemas/JsonValueSchema';
import { LogAction, LogType } from '@src/domain/constants/log-action.constant';
import { VatRate } from '@src/domain/value-objects/vat-rate.vo';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import {
  ApplyEDocumentResultProps,
  CancelInvoiceProps,
  FailInvoiceEntityProps,
} from '@modules/finance/invoice/domain/contracts/invoice';
import {
  InvoiceAlreadyCancelledException,
  InvoiceEDocumentDispatchInFlightException,
  InvoiceNotFinalizableException,
  InvoiceNumberImmutableException,
} from '@modules/finance/invoice/domain/exceptions/invoice.exceptions';
import { InvoiceCancelledEvent } from '../events/invoice-cancelled.event';
import { EDOCUMENT_DISPATCH_IN_FLIGHT_STATUSES } from '@modules/finance/invoice/domain/constants/invoice-status.constant';

export class Invoice extends AggregateRoot {
  constructor(data: IInvoice) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._patientId = UUID.fromTrusted(data.patientId);
    this._appointmentId = UUID.create(data.appointmentId).instance ?? null;
    this._paymentId = UUID.create(data.paymentId).instance ?? null;
    this._currency = Currency.fromTrusted(data.currency);
    this._vatRate = VatRate.fromTrusted(data.vatRate);
    this._status = data.status;
    this._invoiceNumber = data.invoiceNumber
      ? InvoiceNumber.create(data.invoiceNumber)
      : null;
    this._issuedAt = data.issuedAt;
    this._providerRef = data.providerRef;
    this._documentType = data.documentType;
    this._einvoiceUuid = UUID.create(data.einvoiceUuid).instance ?? null;
    this._einvoiceStatus = data.einvoiceStatus;
    this._cancelledAt = data.cancelledAt;
    this._cancelledById = data.cancelledById;
    this._cancelReason = data.cancelReason;
    this._rawResponse = data.rawResponse;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
    this._isDeleted = data.isDeleted;
    // Rehidrasyon: saklanmış kırılım doğrulanmadan kurulur (bkz. `fromTrusted`).
    // Eskiden doğrulayan `create` çağrılıyordu: satır-başı KDV yuvarlaması toleransı
    // aştığında kesilmiş fatura kalıcı olarak okunamaz/iptal edilemez hâle geliyordu.
    this._taxSpecification = TaxSpecification.fromTrusted(
      Money.fromTrusted(data.netTotal, data.currency),
      data.vatRate,
      Money.fromTrusted(data.vatTotal, data.currency)
    );
  }

  private _id: UUID;

  get id(): UUID {
    return this._id;
  }

  private _organizationId: UUID;

  get organizationId(): UUID {
    return this._organizationId;
  }

  private _clinicId: UUID;

  get clinicId(): UUID {
    return this._clinicId;
  }

  private _patientId: UUID;

  get patientId(): UUID {
    return this._patientId;
  }

  private _appointmentId: UUID | null;

  get appointmentId(): UUID | null {
    return this._appointmentId;
  }

  get amount(): Decimal {
    return this._taxSpecification.grossAmount.value;
  }

  private _taxSpecification: TaxSpecification;

  get taxSpecification(): TaxSpecification {
    return this._taxSpecification;
  }

  private _paymentId: UUID | null;

  get paymentId(): UUID | null {
    return this._paymentId;
  }

  private _currency: Currency;

  get currency(): Currency {
    return this._currency;
  }

  private _vatRate: VatRate;

  get vatRate(): VatRate {
    return this._vatRate;
  }

  private _status: InvoiceStatus;
  get status(): InvoiceStatus {
    return this._status;
  }

  private _invoiceNumber: InvoiceNumber | null;
  get invoiceNumber(): InvoiceNumber | null {
    return this._invoiceNumber;
  }

  private _issuedAt: Date | null;
  get issuedAt(): Date | null {
    return this._issuedAt;
  }

  private _providerRef: string | null;
  get providerRef(): string | null {
    return this._providerRef;
  }

  private _documentType: EDocumentType | null;
  get documentType(): EDocumentType | null {
    return this._documentType;
  }

  private _einvoiceUuid: UUID | null;
  get einvoiceUuid(): UUID | null {
    return this._einvoiceUuid;
  }

  private _einvoiceStatus: EDocumentStatus;
  get einvoiceStatus(): EDocumentStatus {
    return this._einvoiceStatus;
  }

  public get totalDue(): Money {
    return this._taxSpecification.grossAmount;
  }

  private _cancelledAt: Date | null;
  get cancelledAt(): Date | null {
    return this._cancelledAt;
  }

  private _cancelledById: string | null;
  get cancelledById(): string | null {
    return this._cancelledById;
  }

  private _cancelReason: string | null;
  get cancelReason(): string | null {
    return this._cancelReason;
  }

  private _rawResponse: JsonValue | null;
  get rawResponse(): JsonValue | null {
    return this._rawResponse;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  private _isDeleted: boolean;
  get isDeleted(): boolean {
    return this._isDeleted;
  }

  public isPending(): boolean {
    return this._status === InvoiceStatusSchema.enum.PENDING;
  }

  public isIssued(): boolean {
    return this._status === InvoiceStatusSchema.enum.ISSUED;
  }

  public isCancelled(): boolean {
    return this._status === InvoiceStatusSchema.enum.CANCELLED;
  }

  /**
   * Entegratör (port) belge sonucunu uygular. e-belge gönderimi muhasebeden bağımsız
   * bir outbound durumdur (doc 07 §5): sonuç REJECTED olsa bile fatura ISSUED'a finalize
   * edilir; einvoiceStatus ayrı izlenir. Noop'ta documentType=INTERNAL, uuid=null gelir.
   *
   * İki guard belgeyi dondurur:
   * - İptal edilmiş fatura diriltilemez (`InvoiceNotFinalizableException`).
   * - Basılmış belge numarası değiştirilemez (`InvoiceNumberImmutableException`).
   *   Bu guard e-belge job'u yeniden denendiğinde devreye girer: entegratör ikinci
   *   bir numara döndürse bile sistemdeki numara donmuş kalır.
   *
   * PENDING → ISSUED geçişinde `InvoiceIssuedEvent` fırlatılır; faturanın ne zaman,
   * hangi belge türüyle kesildiği audit izine böyle düşer.
   */
  public applyEDocumentResult(props: ApplyEDocumentResultProps): void {
    if (this._status === InvoiceStatusSchema.enum.CANCELLED) {
      throw new InvoiceNotFinalizableException({
        invoiceId: this._id.value,
        currentStatus: this._status,
      });
    }

    if (props.invoiceNumber) {
      const incoming = InvoiceNumber.create(props.invoiceNumber);

      if (this._invoiceNumber && !this._invoiceNumber.equals(incoming)) {
        throw new InvoiceNumberImmutableException({
          invoiceId: this._id.value,
          currentInvoiceNumber: this._invoiceNumber.value,
          attemptedInvoiceNumber: incoming.value,
        });
      }

      this._invoiceNumber = incoming;
    }

    this._documentType = props.documentType;
    this._einvoiceUuid = UUID.create(props.uuid).instance ?? null;
    this._einvoiceStatus = props.status;
    if (props.providerRef !== undefined) {
      this._providerRef = props.providerRef;
    }
    if (props.rawResponse !== undefined) {
      // Entegratör yanıtı maskelenerek saklanır: bugünkü Noop adapter'ı
      // credential döndürmüyor ama gerçek entegratörün ne döndüreceği
      // (API anahtarı yankısı, imza) bilinmiyor ve gövde append-only değil
      // olsa bile blob'u sonradan temizlemek imkânsıza yakın.
      this._rawResponse = redactSensitive(props.rawResponse) as JsonValue;
    }

    const isFinalizing = this.isPending();

    if (isFinalizing) {
      this._status = InvoiceStatusSchema.enum.ISSUED;
      this._issuedAt = this._issuedAt ?? DateTimeManager.create();
      this._updatedAt = DateTimeManager.create();

      this.addDomainEvent(
        new InvoiceIssuedEvent({
          invoiceId: this._id.value,
          organizationId: this._organizationId.value,
          clinicId: this._clinicId.value,
          patientId: this._patientId.value,
          appointmentId: this._appointmentId?.value ?? null,
          paymentId: this._paymentId?.value ?? null,
          invoiceNumber: this._invoiceNumber?.value ?? '',
          action: LogAction.INVOICE_ISSUED,
          type: LogType.INFO,
          source: props.source,
          actorId: props.actorId,
        })
      );
    }
  }

  /**
   * e-Belge gönderimi kalıcı olarak başarısız oldu (kuyruk denemeleri tükendi).
   *
   * Faturanın **durumu değişmez**: hasılat ve KDV zaten muhasebeleşti (doc 07 §5 —
   * e-belge muhasebeden bağımsız bir outbound durumdur), dolayısıyla belgeyi
   * "FAILED" ilan etmek defteri yalanlardı. Değişen yalnız e-belge durumudur;
   * olay audit izine ve alarma düşer, belge elle yeniden kuyruğa alınabilir.
   */
  public markEDocumentFailed(props: FailInvoiceEntityProps): void {
    this._einvoiceStatus = EDocumentStatusSchema.enum.FAILED;
    this._updatedAt = DateTimeManager.create();

    this.addDomainEvent(
      new InvoiceFailedEvent({
        invoiceId: this._id.value,
        organizationId: this._organizationId.value,
        clinicId: this._clinicId.value,
        patientId: this._patientId.value,
        appointmentId: this._appointmentId?.value ?? null,
        paymentId: this._paymentId?.value ?? null,
        reason: props.reason,
        action: LogAction.INVOICE_FAILED,
        type: LogType.ERROR,
        source: props.source,
        actorId: props.actorId,
      })
    );
  }

  /**
   * Faturayı iptal eder (storno). Belge **yerinde kalır**, durumu CANCELLED olur ve
   * etkisini defterde ters kayıt götürür (CLAUDE.md finans kuralı 8) — satır
   * silinmez, numara serbest kalmaz.
   *
   * İki guard:
   * - **Zaten iptal edilmiş fatura** yeniden iptal edilemez: iptal defterde storno
   *   üretir, ikinci kez çalışırsa aynı belgenin etkisi iki kez götürülür ve hesap
   *   bakiyesi ters işarete kayar. Bu hata sessizdir (her iki fiş kendi içinde
   *   dengelidir, "Σborç = Σalacak" kontrolü yine tutar).
   * - **e-Belge gönderimi havadaysa** (`QUEUED`) iptal reddedilir: belgenin
   *   entegratörde oluşup oluşmadığı bilinmiyor, iptalden hemen sonra gönderim
   *   başarılı olursa elimizde "yerel iptal edilmiş ama vergi idaresinde geçerli"
   *   bir belge kalır.
   *
   * Tahsilatı olan fatura (`paymentId`) iptal **edilebilir**: iptal belgeyi
   * hükümsüz kılar, parayı geri vermez. Storno 120 (alıcı cari) alacağını
   * kapatır, tahsilatın kendi fişi (100/102 / 120) yerinde durur; hasta o anda
   * belgesiz bir alacaklıdır ve düzeltilmiş fatura kesildiğinde cari netleşir.
   * İade ayrı bir akıştır (POS/ödeme iadesi) ve bu metodun işi değildir.
   */
  public cancel(props: CancelInvoiceProps): void {
    if (this.isCancelled()) {
      throw new InvoiceAlreadyCancelledException({
        invoiceId: this._id.value,
        cancelledAt: this._cancelledAt?.toISOString() ?? null,
      });
    }

    if (EDOCUMENT_DISPATCH_IN_FLIGHT_STATUSES.includes(this._einvoiceStatus)) {
      throw new InvoiceEDocumentDispatchInFlightException({
        invoiceId: this._id.value,
        einvoiceStatus: this._einvoiceStatus,
      });
    }

    const now = DateTimeManager.create();

    this._status = InvoiceStatusSchema.enum.CANCELLED;
    this._cancelledAt = now;
    this._cancelledById = props.cancelledById;
    this._cancelReason = props.reason;
    this._updatedAt = now;

    this.addDomainEvent(
      new InvoiceCancelledEvent({
        invoiceId: this._id.value,
        organizationId: this._organizationId.value,
        clinicId: this._clinicId.value,
        patientId: this._patientId.value,
        appointmentId: this._appointmentId?.value ?? null,
        paymentId: this._paymentId?.value ?? null,
        invoiceNumber: this._invoiceNumber?.value ?? null,
        einvoiceUuid: this._einvoiceUuid?.value ?? null,
        reason: props.reason,
        grandTotal: this._taxSpecification.grossAmount.value.toFixed(2),
        currency: this._currency.value,
        action: LogAction.INVOICE_CANCELLED,
        type: LogType.SECURITY,
        source: props.source,
        actorId: props.cancelledById,
      })
    );
  }

  public toPersistence(): IInvoice {
    return {
      id: this._id.value,
      organizationId: this._organizationId.value,
      clinicId: this._clinicId.value,
      patientId: this._patientId.value,
      appointmentId: this._appointmentId?.value ?? null,
      paymentId: this._paymentId?.value ?? null,

      amount: this._taxSpecification.grossAmount.value,
      currency: this._taxSpecification.netAmount.currency,
      vatRate: this._taxSpecification.taxRate,
      netTotal: this._taxSpecification.netAmount.value,
      vatTotal: this._taxSpecification.taxAmount.value,

      status: this._status,
      invoiceNumber: this._invoiceNumber?.value || null,
      issuedAt: this._issuedAt,
      providerRef: this._providerRef,
      documentType: this._documentType,
      einvoiceUuid: this._einvoiceUuid?.value ?? null,
      einvoiceStatus: this._einvoiceStatus,
      cancelledAt: this._cancelledAt,
      cancelledById: this._cancelledById,
      cancelReason: this._cancelReason,
      rawResponse: this._rawResponse,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      isDeleted: this._isDeleted,
    };
  }
}
