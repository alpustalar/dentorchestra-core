import { CashRegister as ICashRegister } from '@model-schema/CashRegisterSchema';
import {
  CashRegisterStatusSchema,
  CashRegisterStatusType as CashRegisterStatus,
} from '@input-type-schemas/CashRegisterStatusSchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { CreateCashRegisterProps } from '@modules/finance/cash-register/domain/contracts';
import { CashRegisterArchivedException } from '@modules/finance/cash-register/domain/exceptions/cash-register.exceptions';
import { Currency } from '@src/domain/value-objects';

/**
 * Kasa (aggregate root). Fiziki nakit kasasını temsil eder; günlük oturumlar
 * (CashSession) bu kasaya bağlı açılır/kapatılır. Arşivlenmiş kasada oturum açılamaz.
 */
export class CashRegister extends AggregateRoot {
  constructor(data: ICashRegister) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._name = data.name;
    this._currency = Currency.fromTrusted(data.currency);
    this._status = data.status;
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

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _name: string;
  get name(): string {
    return this._name;
  }

  private _currency: Currency;
  get currency(): Currency {
    return this._currency;
  }

  private _status: CashRegisterStatus;
  get status(): CashRegisterStatus {
    return this._status;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  public static create(props: CreateCashRegisterProps): CashRegister {
    const now = DateTimeManager.create();
    const id = UUID.createOrGenerate(props.id).value;

    return new CashRegister({
      id,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      name: props.name,
      currency:
        Currency.create(props.currency).orThrow().value ?? Currency.enum.TRY,
      status: CashRegisterStatusSchema.enum.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
  }

  public isActive(): boolean {
    return this._status === CashRegisterStatusSchema.enum.ACTIVE;
  }

  /** Yeni oturum açılabilmesi için kasa aktif olmalı. */
  public assertActiveForSession(): void {
    if (!this.isActive()) {
      throw new CashRegisterArchivedException(this._id.value);
    }
  }

  public archive(): void {
    if (!this.isActive()) {
      throw new CashRegisterArchivedException(this._id.value);
    }
    this._status = CashRegisterStatusSchema.enum.ARCHIVED;
    this._updatedAt = DateTimeManager.create();
  }

  public toPersistence(): ICashRegister {
    return {
      id: this.id.value,
      clinicId: this.clinicId.value,
      organizationId: this.organizationId.value,
      name: this.name,
      currency: this.currency.value,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
