import { StaffNotification as IStaffNotification } from '@model-schema/StaffNotificationSchema';
import { NotificationTypeType as NotificationType } from '@input-type-schemas/NotificationTypeSchema';
import {
  NotificationPrioritySchema,
  NotificationPriorityType as NotificationPriority,
} from '@input-type-schemas/NotificationPrioritySchema';
import {
  NotificationDeliveryStatusSchema,
  NotificationDeliveryStatusType as NotificationDeliveryStatus,
} from '@input-type-schemas/NotificationDeliveryStatusSchema';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { CreateStaffNotificationProps } from '@modules/platform/notification/domain/contracts/staff-notification';

/**
 * Personel (staff) panel-içi bildirim kaydı. Domain event üretmez — kendisi bir
 * yan etkinin sonucudur. Davranışı: okundu (`markAsRead`) ve gerçek-zamanlı push
 * teslimat durumu (`markAsDelivered`/`markAsFailed`).
 */
export class StaffNotification {
  constructor(data: IStaffNotification) {
    this._id = UUID.fromTrusted(data.id);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._staffId = UUID.fromTrusted(data.staffId);
    this._type = data.type;
    this._title = data.title;
    this._body = data.body;
    this._paramsJson =
      (data.paramsJson as Record<string, unknown> | null) ?? null;
    this._deepLink = (data.deepLink as Record<string, unknown> | null) ?? null;
    this._priority = data.priority;
    this._isRead = data.isRead;
    this._readAt = data.readAt;
    this._deliveryStatus = data.deliveryStatus;
    this._deliveredAt = data.deliveredAt;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;

  get id(): UUID {
    return this._id;
  }

  private _clinicId: UUID;

  get clinicId(): UUID {
    return this._clinicId;
  }

  private _staffId: UUID;

  get staffId(): UUID {
    return this._staffId;
  }

  private _type: NotificationType;

  get type(): NotificationType {
    return this._type;
  }

  private _title: string;

  get title(): string {
    return this._title;
  }

  private _body: string;

  get body(): string {
    return this._body;
  }

  private _paramsJson: Record<string, unknown> | null;

  get paramsJson(): Record<string, unknown> | null {
    return this._paramsJson;
  }

  private _deepLink: Record<string, unknown> | null;

  get deepLink(): Record<string, unknown> | null {
    return this._deepLink;
  }

  private _priority: NotificationPriority;

  get priority(): NotificationPriority {
    return this._priority;
  }

  private _isRead: boolean;

  get isRead(): boolean {
    return this._isRead;
  }

  private _readAt: Date | null;

  get readAt(): Date | null {
    return this._readAt;
  }

  private _deliveryStatus: NotificationDeliveryStatus;

  get deliveryStatus(): NotificationDeliveryStatus {
    return this._deliveryStatus;
  }

  private _deliveredAt: Date | null;

  get deliveredAt(): Date | null {
    return this._deliveredAt;
  }

  private _createdAt: Date;

  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;

  get updatedAt(): Date {
    return this._updatedAt;
  }

  public static create(props: CreateStaffNotificationProps): StaffNotification {
    const now = DateTimeManager.create();
    return new StaffNotification({
      id: UUID.createOrGenerate(props.id).value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      staffId: UUID.create(props.staffId).orThrow().value,
      type: props.type,
      title: props.title,
      body: props.body,
      paramsJson: (props.paramsJson ??
        null) as IStaffNotification['paramsJson'],
      deepLink: (props.deepLink ?? null) as IStaffNotification['deepLink'],
      priority: props.priority ?? NotificationPrioritySchema.enum.MEDIUM,
      isRead: false,
      readAt: null,
      deliveryStatus: NotificationDeliveryStatusSchema.enum.PENDING,
      deliveredAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Bildirimi okundu işaretler (idempotent). */
  public markAsRead(): void {
    if (this._isRead) return;
    this._isRead = true;
    this._readAt = DateTimeManager.create();
    this._updatedAt = DateTimeManager.create();
  }

  /** Gerçek-zamanlı push başarıyla gönderildi. */
  public markAsDelivered(): void {
    this._deliveryStatus = NotificationDeliveryStatusSchema.enum.SENT;
    this._deliveredAt = DateTimeManager.create();
    this._updatedAt = DateTimeManager.create();
  }

  /** Gerçek-zamanlı push denendi ama başarısız (kullanıcı offline vb.). */
  public markAsFailed(): void {
    this._deliveryStatus = NotificationDeliveryStatusSchema.enum.FAILED;
    this._updatedAt = DateTimeManager.create();
  }

  public toPersistence(): IStaffNotification {
    return {
      id: this._id.value,
      clinicId: this._clinicId.value,
      staffId: this._staffId.value,
      type: this._type,
      title: this._title,
      body: this._body,
      paramsJson: this._paramsJson as IStaffNotification['paramsJson'],
      deepLink: this._deepLink as IStaffNotification['deepLink'],
      priority: this._priority,
      isRead: this._isRead,
      readAt: this._readAt,
      deliveryStatus: this._deliveryStatus,
      deliveredAt: this._deliveredAt,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
