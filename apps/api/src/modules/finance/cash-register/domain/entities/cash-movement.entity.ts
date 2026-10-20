import { Decimal } from 'decimal.js';
import { CashMovement as ICashMovement } from '@model-schema/CashMovementSchema';
import {
  CashMovementTypeSchema,
  CashMovementTypeType as CashMovementType,
} from '@input-type-schemas/CashMovementTypeSchema';
import {
  CashMovementDirectionSchema,
  CashMovementDirectionType as CashMovementDirection,
} from '@input-type-schemas/CashMovementDirectionSchema';
import { CurrencyType as Currency } from '@input-type-schemas/CurrencySchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { RecordCashMovementProps } from '@modules/finance/cash-register/domain/contracts';
import {
  CashInvalidAmountException,
  CashInvalidPrecisionException,
  CashOpeningFloatNotAMovementException,
} from '@modules/finance/cash-register/domain/exceptions/cash-register.exceptions';
import { Money } from '@src/domain/value-objects';

/** Kasaya nakit girişi (IN) sağlayan hareket türleri; diğerleri çıkıştır (OUT). */
const IN_TYPES: ReadonlySet<CashMovementType> = new Set<CashMovementType>([
  CashMovementTypeSchema.enum.OPENING_FLOAT,
  CashMovementTypeSchema.enum.SALE_COLLECTION,
  CashMovementTypeSchema.enum.CASH_IN,
]);

/**
 * Kasa Hareketi (aggregate root). Bir oturum içindeki tekil nakit giriş/çıkışı.
 * `amount` her zaman pozitif; yön (`direction`) türden türetilir.
 */
export class CashMovement extends AggregateRoot {
  constructor(data: ICashMovement) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._cashSessionId = UUID.fromTrusted(data.cashSessionId);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._type = data.type;
    this._direction = data.direction;
    this._money = Money.fromTrusted(data.amount, data.currency);
    this._description = data.description;
    this._referenceType = data.referenceType;
    this._referenceId = data.referenceId;
    this._performedById = data.performedById;
    this._occurredAt = data.occurredAt;
    this._createdAt = data.createdAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _cashSessionId: UUID;
  get cashSessionId(): UUID {
    return this._cashSessionId;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _type: CashMovementType;
  get type(): CashMovementType {
    return this._type;
  }

  private _direction: CashMovementDirection;
  get direction(): CashMovementDirection {
    return this._direction;
  }

  private _money: Money;
  get money(): Money {
    return this._money;
  }

  get amount(): Decimal {
    return this.money.value;
  }

  get currency(): Currency {
    return this.money.currency;
  }

  private _description: string | null;
  get description(): string | null {
    return this._description;
  }

  private _referenceType: string | null;
  get referenceType(): string | null {
    return this._referenceType;
  }

  private _referenceId: string | null;
  get referenceId(): string | null {
    return this._referenceId;
  }

  private _performedById: string;
  get performedById(): string {
    return this._performedById;
  }

  private _occurredAt: Date;
  get occurredAt(): Date {
    return this._occurredAt;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  public static directionFor(type: CashMovementType): CashMovementDirection {
    return IN_TYPES.has(type)
      ? CashMovementDirectionSchema.enum.IN
      : CashMovementDirectionSchema.enum.OUT;
  }

  public static record(props: RecordCashMovementProps): CashMovement {
    if (props.amount <= 0) {
      throw new CashInvalidAmountException(undefined, props.amount);
    }

    // Açılış nakdi oturumun kolonunda yaşar ve kapanış formülüne zaten dahildir;
    // bir de hareket olarak girilirse beklenen tutar iki kez şişer ve gerçek bir
    // kasa açığı "denk" görünür.
    if (props.type === CashMovementTypeSchema.enum.OPENING_FLOAT) {
      throw new CashOpeningFloatNotAMovementException();
    }

    const amount = new Decimal(props.amount);
    if (!Money.isKurusScaled(amount)) {
      throw new CashInvalidPrecisionException(amount.toString());
    }

    const now = DateTimeManager.create();
    const id = UUID.createOrGenerate(props.id).value;

    return new CashMovement({
      id,
      cashSessionId: UUID.create(props.cashSessionId).orThrow().value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      type: props.type,
      direction: CashMovement.directionFor(props.type),
      amount,
      currency: props.currency,
      description: props.description ?? null,
      referenceType: props.referenceType ?? null,
      referenceId: props.referenceId ?? null,
      // Aktör kimliği ham string: `ctx.actor.userId` bir Firebase UID'dir
      // (`User.id = firebaseUid`), UUID değil — `UUID.create(...).orThrow()`
      // her gerçek personel için patlıyor, hareket hiç kaydedilemiyordu.
      performedById: props.performedById,
      occurredAt: now,
      createdAt: now,
    });
  }

  public toPersistence(): ICashMovement {
    return {
      id: this.id.value,
      cashSessionId: this.cashSessionId.value,
      clinicId: this.clinicId.value,
      organizationId: this.organizationId.value,
      type: this.type,
      direction: this.direction,
      amount: this.amount,
      currency: this.currency,
      description: this.description,
      referenceType: this.referenceType,
      referenceId: this.referenceId,
      performedById: this.performedById,
      occurredAt: this.occurredAt,
      createdAt: this.createdAt,
    };
  }
}
