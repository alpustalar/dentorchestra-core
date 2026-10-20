import { FinancialEvent as IFinancialEvent } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { FinancialEventRecordedEvent } from '../events/financial-event-recorded.event';
import { FinancialEventTypeType as FinancialEventType } from '@input-type-schemas/FinancialEventTypeSchema';
import { JsonValueType as JsonValue } from '@input-type-schemas/JsonValueSchema';
import { RecordFinancialEventProps } from '@modules/finance/accounting/financial-events/domain/contracts/financial-event';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { validateFinancialEventPayload } from '@modules/finance/shared/domain/contracts/financial-event-payload.schemas';
import {
  FinancialEventFutureDateException,
  FinancialEventPayloadInvalidException,
} from '@modules/finance/accounting/financial-events/domain/exceptions';

/**
 * Değişmez (append-only) ekonomik olay. Bir kez yazılır, asla güncellenmez.
 * Posting bunu okuyup çift taraflı fişe çevirir.
 */
export class FinancialEvent extends AggregateRoot {
  constructor(data: IFinancialEvent) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._type = data.type;
    this._occurredAt = data.occurredAt;
    this._payload = data.payload;
    this._sourceModule = data.sourceModule;
    this._sourceRefId = data.sourceRefId;
    this._dedupeKey = data.dedupeKey;
    this._performedById = data.performedById;
    this._createdAt = data.createdAt;
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

  private _type: FinancialEventType;
  get type(): FinancialEventType {
    return this._type;
  }

  private _occurredAt: Date;
  get occurredAt(): Date {
    return this._occurredAt;
  }

  private _payload: JsonValue;
  get payload(): JsonValue {
    return this._payload;
  }

  private _sourceModule: string;
  get sourceModule(): string {
    return this._sourceModule;
  }

  private _sourceRefId: string | null;
  get sourceRefId(): string | null {
    return this._sourceRefId;
  }

  private _dedupeKey: string | null;
  get dedupeKey(): string | null {
    return this._dedupeKey;
  }

  private _performedById: string | null;
  get performedById(): string | null {
    return this._performedById;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  /**
   * (New Record): İlk kez yeni bir finansal olay kaydederken çağrılır.
   */
  public static record(props: RecordFinancialEventProps): FinancialEvent {
    const organizationId = UUID.create(props.organizationId).orThrow();
    const clinicId = UUID.create(props.clinicId).orThrow();

    const now = DateTimeManager.create();
    const occurredAt = props.occurredAt ?? now;

    // Olay defteri append-only: yanlış gövde bir kez yazılınca düzeltilemez ve
    // fiş ya hiç üretilemez ya da yanlış üretilir. Doğrulama bu yüzden kapıda.
    const issues = validateFinancialEventPayload(props.type, props.payload);
    if (issues.length > 0) {
      throw new FinancialEventPayloadInvalidException(props.type, issues);
    }

    // İleri tarihli ekonomik olay yazılamaz: henüz gerçekleşmemiş bir işlemi
    // deftere işlemek (ve gelecekteki bir döneme kayıt düşürmek) denetimde
    // doğrudan kırmızı bayraktır. Sınır **günün sonu**: saat kaymasını ve
    // saat dilimi farkını yutar ama "gelecek aya tarihli" kaydı durdurur.
    if (DateTimeManager.isAfter(occurredAt, DateTimeManager.endOfDay(now))) {
      throw new FinancialEventFutureDateException(occurredAt);
    }

    const event = new FinancialEvent({
      id: UUID.createOrGenerate(props.id).value,
      organizationId: organizationId.value,
      clinicId: clinicId.value,
      type: props.type,
      occurredAt,
      payload: props.payload as JsonValue,
      sourceModule: props.sourceModule,
      sourceRefId: props.sourceRefId ?? null,
      dedupeKey: props.dedupeKey ?? null,
      performedById: props.performedById ?? null,
      createdAt: now,
    });

    // 🚀 Çift taraflı fiş (Posting) mekanizmasını tetikleyen domain event
    event.addDomainEvent(
      new FinancialEventRecordedEvent({
        financialEventId: event.id.value,
        clinicId: event.clinicId.value,
        organizationId: event.organizationId.value,
        type: event.type,
      })
    );

    return event;
  }

  public toPersistence(): IFinancialEvent {
    return {
      id: this.id.value,
      organizationId: this.organizationId.value,
      clinicId: this.clinicId.value,
      type: this.type,
      occurredAt: this.occurredAt,
      payload: this.payload,
      sourceModule: this.sourceModule,
      sourceRefId: this.sourceRefId,
      dedupeKey: this.dedupeKey,
      performedById: this.performedById,
      createdAt: this.createdAt,
    };
  }
}
