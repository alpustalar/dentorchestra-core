import { Decimal } from 'decimal.js';
import { randomUUID } from 'crypto';
import { ExternalWorkOrder as IExternalWorkOrder } from '@model-schema/ExternalWorkOrderSchema';
import {
  ExternalWorkOrderStatusSchema,
  ExternalWorkOrderStatusType as ExternalWorkOrderStatus,
} from '@input-type-schemas/ExternalWorkOrderStatusSchema';
import {
  CurrencySchema,
  CurrencyType as Currency,
} from '@input-type-schemas/CurrencySchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import type { WorkOrderItemSpecs } from '@shared/modules/work-order/schemas';
import { CreateExternalWorkOrderProps } from '@modules/supply/work-order/domain/contracts';
import {
  WorkOrderDueDateRequiredException,
  WorkOrderEmptyItemsException,
  WorkOrderInvalidStateException,
} from '@modules/supply/work-order/domain/exceptions/work-order.exceptions';
import { WorkOrderSentEvent } from '@modules/supply/work-order/domain/events/work-order-sent.event';
import { WorkOrderReceivedEvent } from '@modules/supply/work-order/domain/events/work-order-received.event';
import { WorkOrderFittedEvent } from '@modules/supply/work-order/domain/events/work-order-fitted.event';
import { WorkOrderOverdueEvent } from '@modules/supply/work-order/domain/events/work-order-overdue.event';

export interface WorkOrderLine {
  id: string;
  description: string;
  quantity: Decimal;
  unitCost: Decimal | null;
  specs: WorkOrderItemSpecs | null;
}

/** Teslim alınmamış, yani terminin hâlâ anlamlı olduğu durumlar. */
const OPEN_STATUSES: ExternalWorkOrderStatus[] = [
  ExternalWorkOrderStatusSchema.enum.SENT,
  ExternalWorkOrderStatusSchema.enum.IN_PROGRESS,
  ExternalWorkOrderStatusSchema.enum.TRY_IN,
  ExternalWorkOrderStatusSchema.enum.READY,
];

/**
 * Dış İş Emri (aggregate root) — klinik dışı bir tedarikçiye (diş laboratuvarı, saç
 * protezi üreticisi, medikal protez tedarikçisi) verilen iş. Durum akışı:
 * DRAFT → SENT → IN_PROGRESS ⇄ TRY_IN → READY → DELIVERED → FITTED.
 * İptal terminal olmayan her durumdan mümkündür; yeniden yapım (remake) bu iş emrini
 * değiştirmez, `openRemake` ile bağlı yeni bir iş emri açar.
 */
export class ExternalWorkOrder extends AggregateRoot {
  constructor(data: IExternalWorkOrder, lines: WorkOrderLine[]) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._supplierId = UUID.fromTrusted(data.supplierId);
    this._patientId = data.patientId;
    this._treatmentId = data.treatmentId;
    this._providerId = data.providerId;
    this._referenceNo = data.referenceNo;
    this._status = data.status;
    this._sentAt = data.sentAt;
    this._dueDate = data.dueDate;
    this._receivedAt = data.receivedAt;
    this._fittedAt = data.fittedAt;
    this._cancelledAt = data.cancelledAt;
    this._cancelReason = data.cancelReason;
    this._agreedCost = data.agreedCost
      ? new Decimal(data.agreedCost.toString())
      : null;
    this._actualCost = data.actualCost
      ? new Decimal(data.actualCost.toString())
      : null;
    this._currency = data.currency;
    this._remakeOfId = data.remakeOfId;
    this._remakeReason = data.remakeReason;
    this._overdueNotifiedAt = data.overdueNotifiedAt;
    this._note = data.note;
    this._createdById = data.createdById;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
    this._lines = lines;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _supplierId: UUID;
  get supplierId(): UUID {
    return this._supplierId;
  }

  private _patientId: string | null;
  get patientId(): string | null {
    return this._patientId;
  }

  private _treatmentId: string | null;
  get treatmentId(): string | null {
    return this._treatmentId;
  }

  private _providerId: string | null;
  get providerId(): string | null {
    return this._providerId;
  }

  private _referenceNo: string | null;
  get referenceNo(): string | null {
    return this._referenceNo;
  }

  private _status: ExternalWorkOrderStatus;
  get status(): ExternalWorkOrderStatus {
    return this._status;
  }

  private _sentAt: Date | null;
  get sentAt(): Date | null {
    return this._sentAt;
  }

  private _dueDate: Date | null;
  get dueDate(): Date | null {
    return this._dueDate;
  }

  private _receivedAt: Date | null;
  get receivedAt(): Date | null {
    return this._receivedAt;
  }

  private _fittedAt: Date | null;
  get fittedAt(): Date | null {
    return this._fittedAt;
  }

  private _cancelledAt: Date | null;
  get cancelledAt(): Date | null {
    return this._cancelledAt;
  }

  private _cancelReason: string | null;
  get cancelReason(): string | null {
    return this._cancelReason;
  }

  private _agreedCost: Decimal | null;
  get agreedCost(): Decimal | null {
    return this._agreedCost;
  }

  private _actualCost: Decimal | null;
  get actualCost(): Decimal | null {
    return this._actualCost;
  }

  private _currency: Currency;
  get currency(): Currency {
    return this._currency;
  }

  private _remakeOfId: string | null;
  get remakeOfId(): string | null {
    return this._remakeOfId;
  }

  private _remakeReason: string | null;
  get remakeReason(): string | null {
    return this._remakeReason;
  }

  private _overdueNotifiedAt: Date | null;
  get overdueNotifiedAt(): Date | null {
    return this._overdueNotifiedAt;
  }

  private _note: string | null;
  get note(): string | null {
    return this._note;
  }

  private _createdById: string | null;
  get createdById(): string | null {
    return this._createdById;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  private _lines: WorkOrderLine[];
  get lines(): WorkOrderLine[] {
    return this._lines;
  }

  public static create(props: CreateExternalWorkOrderProps): ExternalWorkOrder {
    if (!props.items || props.items.length === 0) {
      throw new WorkOrderEmptyItemsException();
    }

    const now = DateTimeManager.create();

    const lines: WorkOrderLine[] = props.items.map((item) => ({
      id: randomUUID(),
      description: item.description,
      quantity: new Decimal(item.quantity),
      unitCost:
        item.unitCost === null || item.unitCost === undefined
          ? null
          : new Decimal(item.unitCost),
      specs: item.specs ?? null,
    }));

    return new ExternalWorkOrder(
      {
        id: UUID.createOrGenerate(props.id).value,
        clinicId: UUID.create(props.clinicId).orThrow().value,
        organizationId: UUID.create(props.organizationId).orThrow().value,
        supplierId: UUID.create(props.supplierId).orThrow().value,
        patientId: props.patientId ?? null,
        treatmentId: props.treatmentId ?? null,
        providerId: props.providerId ?? null,
        referenceNo: props.referenceNo ?? null,
        status: ExternalWorkOrderStatusSchema.enum.DRAFT,
        sentAt: null,
        dueDate: props.dueDate ?? null,
        receivedAt: null,
        fittedAt: null,
        cancelledAt: null,
        cancelReason: null,
        agreedCost:
          props.agreedCost === null || props.agreedCost === undefined
            ? null
            : new Decimal(props.agreedCost),
        actualCost: null,
        currency: props.currency ?? CurrencySchema.enum.TRY,
        remakeOfId: null,
        remakeReason: null,
        overdueNotifiedAt: null,
        note: props.note ?? null,
        createdById: props.createdById ?? null,
        createdAt: now,
        updatedAt: now,
      } as IExternalWorkOrder,
      lines
    );
  }

  /**
   * Yeniden yapım — kaynak iş emrinin satırlarını kopyalayarak bağlı yeni bir DRAFT
   * üretir. Kaynak iş emri değişmez (kendi geçmişi korunur, istatistikte remake oranı
   * bu bağdan hesaplanır).
   */
  public static openRemake(
    source: ExternalWorkOrder,
    props: {
      id?: string;
      reason: string;
      dueDate?: Date | null;
      createdById?: string | null;
    }
  ): ExternalWorkOrder {
    const remake = ExternalWorkOrder.create({
      id: props.id,
      clinicId: source.clinicId.value,
      organizationId: source.organizationId.value,
      supplierId: source.supplierId.value,
      patientId: source.patientId,
      treatmentId: source.treatmentId,
      providerId: source.providerId,
      dueDate: props.dueDate ?? null,
      agreedCost: source.agreedCost ? source.agreedCost.toNumber() : null,
      currency: source.currency,
      note: source.note,
      createdById: props.createdById ?? null,
      items: source.lines.map((line) => ({
        description: line.description,
        quantity: line.quantity.toNumber(),
        unitCost: line.unitCost ? line.unitCost.toNumber() : null,
        specs: line.specs,
      })),
    });

    remake._remakeOfId = source.id.value;
    remake._remakeReason = props.reason;
    return remake;
  }

  /** Tedarikçiye gönderim — termin bu adımda zorunludur. */
  public send(dueDate: Date, referenceNo?: string | null): void {
    this.assertStatus(
      [ExternalWorkOrderStatusSchema.enum.DRAFT],
      'send',
      'Yalnızca taslak (DRAFT) iş emirleri tedarikçiye gönderilebilir.'
    );

    if (!dueDate) throw new WorkOrderDueDateRequiredException();

    const now = DateTimeManager.create();
    this._status = ExternalWorkOrderStatusSchema.enum.SENT;
    this._sentAt = now;
    this._dueDate = dueDate;
    if (referenceNo !== undefined && referenceNo !== null) {
      this._referenceNo = referenceNo;
    }
    this._updatedAt = now;

    this.addDomainEvent(
      new WorkOrderSentEvent({
        workOrderId: this._id.value,
        clinicId: this._clinicId.value,
        supplierId: this._supplierId.value,
        patientId: this._patientId,
        dueDate,
      })
    );
  }

  /** Tedarikçi üretime başladı (provadan sonra revizyona dönüş de buraya düşer). */
  public markInProgress(): void {
    this.assertStatus(
      [
        ExternalWorkOrderStatusSchema.enum.SENT,
        ExternalWorkOrderStatusSchema.enum.TRY_IN,
      ],
      'markInProgress',
      'Yalnızca gönderilmiş veya provada olan iş emri üretime alınabilir.'
    );
    this._status = ExternalWorkOrderStatusSchema.enum.IN_PROGRESS;
    this._updatedAt = DateTimeManager.create();
  }

  /** Prova için klinikte. Provadan sonra ya revizyona (IN_PROGRESS) ya da READY'ye gider. */
  public markTryIn(): void {
    this.assertStatus(
      [ExternalWorkOrderStatusSchema.enum.IN_PROGRESS],
      'markTryIn',
      'Yalnızca üretimdeki iş emri provaya alınabilir.'
    );
    this._status = ExternalWorkOrderStatusSchema.enum.TRY_IN;
    this._updatedAt = DateTimeManager.create();
  }

  /** Tedarikçide hazır, teslim bekliyor. */
  public markReady(): void {
    this.assertStatus(
      [
        ExternalWorkOrderStatusSchema.enum.IN_PROGRESS,
        ExternalWorkOrderStatusSchema.enum.TRY_IN,
      ],
      'markReady',
      'Yalnızca üretimdeki veya provadaki iş emri hazır olarak işaretlenebilir.'
    );
    this._status = ExternalWorkOrderStatusSchema.enum.READY;
    this._updatedAt = DateTimeManager.create();
  }

  /** Klinik teslim aldı. Kesinleşen ücret farklıysa burada güncellenir. */
  public receive(actualCost?: number | null): void {
    this.assertStatus(
      [ExternalWorkOrderStatusSchema.enum.READY],
      'receive',
      'Yalnızca hazır (READY) iş emri teslim alınabilir.'
    );

    const now = DateTimeManager.create();
    this._status = ExternalWorkOrderStatusSchema.enum.DELIVERED;
    this._receivedAt = now;
    if (actualCost !== undefined && actualCost !== null) {
      this._actualCost = new Decimal(actualCost);
    }
    this._updatedAt = now;

    const cost = this._actualCost ?? this._agreedCost;
    const delayInDays = this._dueDate
      ? Math.max(0, DateTimeManager.diffInDays(now, this._dueDate))
      : 0;

    this.addDomainEvent(
      new WorkOrderReceivedEvent({
        workOrderId: this._id.value,
        clinicId: this._clinicId.value,
        supplierId: this._supplierId.value,
        patientId: this._patientId,
        cost: cost ? cost.toString() : null,
        currency: this._currency,
        delayInDays,
      })
    );
  }

  /** Hastaya uygulandı (terminal). */
  public fit(appointmentId?: string | null): void {
    this.assertStatus(
      [ExternalWorkOrderStatusSchema.enum.DELIVERED],
      'fit',
      'Yalnızca teslim alınmış iş emri hastaya uygulanabilir.'
    );

    const now = DateTimeManager.create();
    this._status = ExternalWorkOrderStatusSchema.enum.FITTED;
    this._fittedAt = now;
    this._updatedAt = now;

    this.addDomainEvent(
      new WorkOrderFittedEvent({
        workOrderId: this._id.value,
        clinicId: this._clinicId.value,
        patientId: this._patientId,
        treatmentId: this._treatmentId,
        appointmentId: appointmentId ?? null,
      })
    );
  }

  public cancel(reason: string): void {
    this.assertStatus(
      [
        ExternalWorkOrderStatusSchema.enum.DRAFT,
        ...OPEN_STATUSES,
        ExternalWorkOrderStatusSchema.enum.DELIVERED,
      ],
      'cancel',
      'Hastaya uygulanmış veya zaten iptal edilmiş iş emri iptal edilemez.'
    );

    const now = DateTimeManager.create();
    this._status = ExternalWorkOrderStatusSchema.enum.CANCELLED;
    this._cancelledAt = now;
    this._cancelReason = reason;
    this._updatedAt = now;
  }

  /** Termini geçmiş ve henüz teslim alınmamış mı? */
  public isOverdue(now: Date = DateTimeManager.create()): boolean {
    if (!this._dueDate) return false;
    if (!OPEN_STATUSES.includes(this._status)) return false;
    return DateTimeManager.isBefore(this._dueDate, now);
  }

  /**
   * Gecikme bildirimi üretildi olarak işaretler ve event'i fırlatır. `overdueNotifiedAt`
   * dolu olduğu sürece tarama bu iş emrini tekrar seçmez (idempotency).
   */
  public markOverdueNotified(now: Date = DateTimeManager.create()): void {
    const daysOverdue = this._dueDate
      ? Math.max(0, DateTimeManager.diffInDays(now, this._dueDate))
      : 0;

    this._overdueNotifiedAt = now;
    this._updatedAt = now;

    this.addDomainEvent(
      new WorkOrderOverdueEvent({
        workOrderId: this._id.value,
        clinicId: this._clinicId.value,
        supplierId: this._supplierId.value,
        patientId: this._patientId,
        dueDate: this._dueDate ?? now,
        daysOverdue,
      })
    );
  }

  public toPersistence(): IExternalWorkOrder {
    return {
      id: this._id.value,
      clinicId: this._clinicId.value,
      organizationId: this._organizationId.value,
      supplierId: this._supplierId.value,
      patientId: this._patientId,
      treatmentId: this._treatmentId,
      providerId: this._providerId,
      referenceNo: this._referenceNo,
      status: this._status,
      sentAt: this._sentAt,
      dueDate: this._dueDate,
      receivedAt: this._receivedAt,
      fittedAt: this._fittedAt,
      cancelledAt: this._cancelledAt,
      cancelReason: this._cancelReason,
      agreedCost: this._agreedCost,
      actualCost: this._actualCost,
      currency: this._currency,
      remakeOfId: this._remakeOfId,
      remakeReason: this._remakeReason,
      overdueNotifiedAt: this._overdueNotifiedAt,
      note: this._note,
      createdById: this._createdById,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    } as unknown as IExternalWorkOrder;
  }

  private assertStatus(
    allowed: ExternalWorkOrderStatus[],
    action: string,
    message: string
  ): void {
    if (allowed.includes(this._status)) return;

    throw new WorkOrderInvalidStateException(message, {
      workOrderId: this._id.value,
      currentStatus: this._status,
      attemptedAction: action,
      allowedStatuses: allowed,
    });
  }
}
