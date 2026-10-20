import { redactSensitive } from '@common/utils';
import { IyzicoTransaction as IIyzicoTransaction } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import IyzicoTransactionStatusSchema, {
  IyzicoTransactionStatusType as IyzicoTransactionStatus,
} from '@input-type-schemas/IyzicoTransactionStatusSchema';
import {
  CreateIyzicoTransactionProps,
  MarkIyzicoFailedInput,
  MarkIyzicoRefundedInput,
  MarkIyzicoSuccessInput,
} from '../contracts/iyzico-transaction';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { Guard } from '@common/domain/guards';
import { UUID } from '@src/domain/value-objects/uuid.vo';

/**
 * iyzico sanal POS işlemini temsil eden domain entity. Durum geçişleri yalnızca `markAs*`
 * metodları üzerinden yapılır; her geçiş idempotenttir (callback/webhook yarışlarına karşı
 * güvenli): INITIALIZE → SUCCESS/FAILURE, SUCCESS → REFUNDED. Repository yalnızca `save`
 * (upsert) ile entity'nin o anki halini yazar.
 */
export class IyzicoTransaction extends AggregateRoot {
  constructor(data: IIyzicoTransaction) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._installmentId = data.installmentId;
    this._conversationId = data.conversationId;
    this._token = data.token;
    this._iyzicoPaymentId = data.iyzicoPaymentId;
    this._iyzicoPaymentTransactionId = data.iyzicoPaymentTransactionId;
    this._rawResponse = data.rawResponse;
    this._status = data.status;
    this._errorCode = data.errorCode;
    this._errorMessage = data.errorMessage;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _installmentId: string;
  get installmentId(): string {
    return this._installmentId;
  }

  private _conversationId: string;
  get conversationId(): string {
    return this._conversationId;
  }

  private _token: string | null;
  get token(): string | null {
    return this._token;
  }

  private _iyzicoPaymentId: string | null;
  get iyzicoPaymentId(): string | null {
    return this._iyzicoPaymentId;
  }

  private _iyzicoPaymentTransactionId: string | null;
  get iyzicoPaymentTransactionId(): string | null {
    return this._iyzicoPaymentTransactionId;
  }

  private _rawResponse: IIyzicoTransaction['rawResponse'];
  get rawResponse(): IIyzicoTransaction['rawResponse'] {
    return this._rawResponse;
  }

  private _status: IyzicoTransactionStatus;
  get status(): IyzicoTransactionStatus {
    return this._status;
  }

  private _errorCode: string | null;
  get errorCode(): string | null {
    return this._errorCode;
  }

  private _errorMessage: string | null;
  get errorMessage(): string | null {
    return this._errorMessage;
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
        isInitialize: this.isInitialize,
        isSuccess: this.isSuccess,
      },
    };
  }

  private get isInitialize() {
    const is = this._status === IyzicoTransactionStatusSchema.enum.INITIALIZE;
    return Guard.monitor(
      is,
      is,
      () => new Error('Iyzico durumu "başlatıldı" değil')
    );
  }

  private get isSuccess() {
    const isSuccess =
      this._status === IyzicoTransactionStatusSchema.enum.SUCCESS;
    return Guard.monitor(
      isSuccess,
      isSuccess,
      () => new Error('Iyzico durumu "başarılı" değil')
    );
  }

  /** Yeni iyzico işlemi (ödeme formu başlatıldığında) — status INITIALIZE. */
  public static create(props: CreateIyzicoTransactionProps): IyzicoTransaction {
    const now = DateTimeManager.create();
    return new IyzicoTransaction({
      id: UUID.createOrGenerate(props.id).value,
      installmentId: props.installmentId,
      conversationId: props.conversationId,
      token: props.token ?? null,
      iyzicoPaymentId: null,
      iyzicoPaymentTransactionId: null,
      rawResponse: null,
      status: IyzicoTransactionStatusSchema.enum.INITIALIZE,
      errorCode: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Ödeme başarıyla tamamlandı — yalnız INITIALIZE'dan (idempotent: tekrar çağrı yok sayılır). */
  public markAsSuccess(input: MarkIyzicoSuccessInput): void {
    if (!this.isInitialize.value) return;
    this._status = IyzicoTransactionStatusSchema.enum.SUCCESS;
    this._iyzicoPaymentId = input.iyzicoPaymentId;
    this._iyzicoPaymentTransactionId = input.iyzicoPaymentTransactionId ?? null;
    this._applyRawResponse(input.rawResponse);
  }

  /** Ödeme başarısız — yalnız INITIALIZE'dan (idempotent). */
  public markAsFailed(input: MarkIyzicoFailedInput): void {
    if (!this.isInitialize.value) return;
    this._status = IyzicoTransactionStatusSchema.enum.FAILURE;
    this._errorCode = input.errorCode ?? null;
    this._errorMessage = input.errorMessage ?? null;
    this._applyRawResponse(input.rawResponse);
  }

  /** İade — yalnız başarılı (SUCCESS) işlemden (idempotent: tekrar çağrı yok sayılır). */
  public markAsRefunded(input: MarkIyzicoRefundedInput): void {
    if (!this.isSuccess.value) return;
    this._status = IyzicoTransactionStatusSchema.enum.REFUNDED;
    this._applyRawResponse(input.rawResponse);
  }

  public toPersistence(): IIyzicoTransaction {
    return {
      id: this.id.value,
      installmentId: this.installmentId,
      conversationId: this.conversationId,
      token: this.token,
      iyzicoPaymentId: this.iyzicoPaymentId,
      iyzicoPaymentTransactionId: this.iyzicoPaymentTransactionId,
      rawResponse: this.rawResponse,
      status: this.status,
      errorCode: this.errorCode,
      errorMessage: this.errorMessage,
      createdAt: this.createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }

  /**
   * Sağlayıcı yanıtı tanı amacıyla saklanır — ama **maskelenerek**.
   *
   * iyzico checkout yanıtı `cardToken` + `cardUserKey` taşıyor ve bu ikisi
   * non-3DS çekim yapmaya yeten bir kimlik bilgisidir (abonelik yenilemesi tam
   * olarak bunu kullanıyor). Ham saklamak, kontrollü kart saklama tablosunun
   * yanında **ikinci, denetlenmeyen** bir kopya üretir: kimse döndürmez, kimse
   * arayıp bulamaz, saklama süresi olmaz. Maskeleme yazma sınırında yapılır ki
   * DB'ye bakan her okuyucu (operatör, yedek, ileride eklenecek rapor) korunsun.
   */
  private _applyRawResponse(rawResponse?: unknown): void {
    if (rawResponse !== undefined) {
      this._rawResponse = redactSensitive(
        rawResponse
      ) as IIyzicoTransaction['rawResponse'];
    }
  }
}
