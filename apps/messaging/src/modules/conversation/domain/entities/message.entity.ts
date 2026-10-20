import {
  Message as IMessage,
  MessageDirectionSchema,
  MessageDirectionType as MessageDirection,
  MessageStatusSchema,
  MessageStatusType as MessageStatus,
  MessageTypeSchema,
  MessageTypeType as MessageType,
} from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { MessageStatusChangedEvent } from '../events/message-status-changed.event';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import {
  CreateInboundMessageProps,
  CreateOutboundMessageProps,
  MessageTemplateComponents,
} from '@modules/conversation/domain/contracts/message.contracts';

/** Giden mesaj teslim akışındaki ileri-yön sıralaması (idempotent webhook için). */
const DELIVERY_RANK: Record<MessageStatus, number> = {
  RECEIVED: 0,
  QUEUED: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  FAILED: 0,
};

/**
 * Yazışma içindeki tek mesaj (gelen/giden). Durum geçişleri idempotenttir: webhook
 * mükerrer/sırasız status iletebildiği için yalnızca ileri-yön geçişler uygulanır ve
 * gerçek değişimde MessageStatusChangedEvent fırlatılır.
 */

export class Message extends AggregateRoot implements IMessage {
  constructor(data: IMessage) {
    super();
    this._id = data.id;
    this._conversationId = data.conversationId;
    this._direction = data.direction;
    this._type = data.type;
    this._body = data.body;
    this._mediaUrl = data.mediaUrl;
    this._status = data.status;
    this._externalId = data.externalId;
    this._errorReason = data.errorReason;
    this._errorCode = data.errorCode;
    this._sentByUserId = data.sentByUserId;
    this._mediaType = data.mediaType;
    this._pricingCategory = data.pricingCategory;
    this._billable = data.billable;
    this._payload = data.payload;
    this._replyToExternalId = data.replyToExternalId;
    this._templateName = data.templateName;
    this._templateLanguage = data.templateLanguage;
    this._templateParams = data.templateParams;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: string;
  get id(): string {
    return this._id;
  }

  private _conversationId: string;
  get conversationId(): string {
    return this._conversationId;
  }

  private _direction: MessageDirection;
  get direction(): MessageDirection {
    return this._direction;
  }

  private _type: MessageType;
  get type(): MessageType {
    return this._type;
  }

  private _body: string | null;
  get body(): string | null {
    return this._body;
  }

  private _mediaUrl: string | null;
  get mediaUrl(): string | null {
    return this._mediaUrl;
  }

  private _status: MessageStatus;
  get status(): MessageStatus {
    return this._status;
  }

  private _externalId: string | null;
  get externalId(): string | null {
    return this._externalId;
  }

  private _errorReason: string | null;
  get errorReason(): string | null {
    return this._errorReason;
  }

  private _errorCode: string | null;
  get errorCode(): string | null {
    return this._errorCode;
  }

  private _sentByUserId: string | null;
  get sentByUserId(): string | null {
    return this._sentByUserId;
  }

  private _mediaType: string | null;
  get mediaType(): string | null {
    return this._mediaType;
  }

  private _pricingCategory: string | null;
  get pricingCategory(): string | null {
    return this._pricingCategory;
  }

  private _billable: boolean | null;
  get billable(): boolean | null {
    return this._billable;
  }

  private _payload: IMessage['payload'];
  get payload(): IMessage['payload'] {
    return this._payload;
  }

  private _replyToExternalId: string | null;
  get replyToExternalId(): string | null {
    return this._replyToExternalId;
  }

  private _templateName: string | null;
  get templateName(): string | null {
    return this._templateName;
  }

  private _templateLanguage: string | null;
  get templateLanguage(): string | null {
    return this._templateLanguage;
  }

  private _templateParams: IMessage['templateParams'];
  get templateParams(): IMessage['templateParams'] {
    return this._templateParams;
  }

  /**
   * TEMPLATE mesajının yapısal bileşenleri (body/header/buton). Geriye uyum: eski
   * kayıtlarda templateParams düz string dizisi ise body değişkenleri kabul edilir.
   */
  get templateComponents(): MessageTemplateComponents {
    const p = this._templateParams;
    if (Array.isArray(p)) {
      return { bodyParams: (p as unknown[]).map((v) => String(v)) };
    }
    if (p && typeof p === 'object') {
      return p as MessageTemplateComponents;
    }
    return {};
  }

  /** TEMPLATE mesajlarda sıralı body değişkenleri (string listesi). */
  get templateVariables(): string[] {
    return this.templateComponents.bodyParams ?? [];
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** Gelen (inbound) mesaj — status RECEIVED. */
  public static createInbound(props: CreateInboundMessageProps): Message {
    const now = DateTimeManager.create();
    return new Message({
      id: UUID.createOrGenerate(props.id).value,
      conversationId: props.conversationId,
      direction: MessageDirectionSchema.enum.INBOUND,
      type: props.type ?? MessageTypeSchema.enum.TEXT,
      body: props.body ?? null,
      mediaUrl: props.mediaUrl ?? null,
      status: MessageStatusSchema.enum.RECEIVED,
      externalId: props.externalId ?? null,
      errorReason: null,
      errorCode: null,
      sentByUserId: null,
      mediaType: null,
      pricingCategory: null,
      billable: null,
      payload: (props.payload ?? null) as IMessage['payload'],
      replyToExternalId: props.replyToExternalId ?? null,
      templateName: null,
      templateLanguage: null,
      templateParams: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Giden (outbound) mesaj — başlangıç status QUEUED (kanal portuna verilmeden önce). */
  public static createOutbound(props: CreateOutboundMessageProps): Message {
    const now = DateTimeManager.create();
    return new Message({
      id: UUID.createOrGenerate(props.id).value,
      conversationId: props.conversationId,
      direction: MessageDirectionSchema.enum.OUTBOUND,
      type: props.type ?? MessageTypeSchema.enum.TEXT,
      body: props.body ?? null,
      mediaUrl: props.mediaUrl ?? null,
      status: MessageStatusSchema.enum.QUEUED,
      externalId: null,
      errorReason: null,
      errorCode: null,
      sentByUserId: props.sentByUserId ?? null,
      mediaType: props.mediaType ?? null,
      pricingCategory: null,
      billable: null,
      payload: null,
      replyToExternalId: null,
      templateName: props.template?.name ?? null,
      templateLanguage: props.template?.language ?? null,
      templateParams: (props.template?.components ??
        null) as IMessage['templateParams'],
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Kanal portu mesajı kabul etti — externalId atanır, QUEUED→SENT. */
  public markSent(externalId: string): void {
    this._externalId = externalId;
    this.transitionTo(MessageStatusSchema.enum.SENT);
  }

  /** Webhook status'tan gelen konuşma kategorisi/faturalanabilirlik bilgisini kaydeder. */
  public recordPricing(
    category?: string | null,
    billable?: boolean | null
  ): void {
    if (category != null) this._pricingCategory = category;
    if (billable != null) this._billable = billable;
  }

  public markDelivered(): void {
    this.transitionTo(MessageStatusSchema.enum.DELIVERED);
  }

  public markRead(): void {
    this.transitionTo(MessageStatusSchema.enum.READ);
  }

  public transitionStatus(
    status: MessageStatus,
    payload?: {
      errorReason?: string | null;
      errorCode?: string | null;
      externalId?: string | null;
    }
  ): void {
    // 1. Durum değişimi yoksa erken çık (Idempotency)
    if (this._status === status) return;

    // 2. Geçersiz durum geçişlerini engelle (State Machine Guards)
    this.validateStatusTransition(status);

    // 3. İlgili mutasyonu çalıştır
    switch (status) {
      case MessageStatusSchema.enum.SENT: {
        const externalId = payload?.externalId ?? this._externalId;
        if (!externalId) {
          throw new Error('SENT durumuna geçiş için externalId zorunludur.');
        }
        this.markSent(externalId);
        break;
      }

      case MessageStatusSchema.enum.DELIVERED:
        this.markDelivered();
        break;

      case MessageStatusSchema.enum.READ:
        this.markRead();
        break;

      case MessageStatusSchema.enum.FAILED:
        this.markFailed(
          payload?.errorReason ?? undefined,
          payload?.errorCode ?? undefined
        );
        break;

      case MessageStatusSchema.enum.QUEUED:
      case MessageStatusSchema.enum.RECEIVED:
        // Bu durumlara geçişte ekstra bir mutasyon gerekmiyorsa sadece status güncellenir
        this._status = status;
        break;

      default:
        // TypeScript exhaustive check
        const _exhaustiveCheck: never = status;
        throw new Error(`Desteklenmeyen status geçişi: ${_exhaustiveCheck}`);
    }

    this._updatedAt = DateTimeManager.create();
  }

  /**
   * Geçersiz durum geçişlerini kontrol eder.
   */
  private validateStatusTransition(nextStatus: MessageStatus): void {
    // Örn: FAILED veya READ olan bir mesaj tekrar QUEUED veya SENT olamaz
    if (this._status === MessageStatusSchema.enum.FAILED) {
      throw new Error('Başarısız olmuş bir mesajın durumu değiştirilemez.');
    }

    if (
      this._status === MessageStatusSchema.enum.READ &&
      nextStatus === MessageStatusSchema.enum.SENT
    ) {
      throw new Error('Okunmuş mesaj tekrar SENT durumuna çekilemez.');
    }
  }

  public markFailed(reason?: string, code?: string | null): void {
    // Teslim edilmiş/okunmuş mesaj geriye FAILED olamaz.
    if (
      DELIVERY_RANK[this._status] >=
      DELIVERY_RANK[MessageStatusSchema.enum.DELIVERED]
    ) {
      return;
    }
    if (this._status === MessageStatusSchema.enum.FAILED) return;
    const previousStatus = this._status;
    this._status = MessageStatusSchema.enum.FAILED;
    this._errorReason = reason ?? null;
    this._errorCode = code ?? null;
    this.addDomainEvent(
      new MessageStatusChangedEvent({
        messageId: this._id,
        conversationId: this._conversationId,
        externalId: this._externalId,
        previousStatus,
        status: MessageStatusSchema.enum.FAILED,
      })
    );
  }

  public toPersistence(): IMessage {
    return {
      id: this._id,
      conversationId: this._conversationId,
      direction: this._direction,
      type: this._type,
      body: this._body,
      mediaUrl: this._mediaUrl,
      status: this._status,
      externalId: this._externalId,
      errorReason: this._errorReason,
      errorCode: this._errorCode,
      sentByUserId: this._sentByUserId,
      mediaType: this._mediaType,
      pricingCategory: this._pricingCategory,
      billable: this._billable,
      payload: this._payload,
      replyToExternalId: this._replyToExternalId,
      templateName: this._templateName,
      templateLanguage: this._templateLanguage,
      templateParams: this._templateParams,
      createdAt: this._createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }

  /** Yalnızca ileri-yön teslim geçişlerini uygular; gerçek değişimde event fırlatır. */
  private transitionTo(next: MessageStatus): void {
    if (DELIVERY_RANK[next] <= DELIVERY_RANK[this._status]) return;
    const previousStatus = this._status;
    this._status = next;
    this.addDomainEvent(
      new MessageStatusChangedEvent({
        messageId: this._id,
        conversationId: this._conversationId,
        externalId: this._externalId,
        previousStatus,
        status: next,
      })
    );
  }
}
