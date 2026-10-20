import { EmployeeContract as IEmployeeContract } from '@shared';
import { EmploymentTypeType as EmploymentType } from '@input-type-schemas/EmploymentTypeSchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Money } from '@src/domain/value-objects/money.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { CreateEmployeeContractProps } from '@modules/hr/employee/domain/contracts';
import { Currency } from '@src/domain/value-objects';

const DEFAULT_CURRENCY = Currency.enum.TRY;

/** Çalışan sözleşmesi. grossSalary Money VO ile korunur; aynı anda tek aktif beklenir. */
export class EmployeeContract extends AggregateRoot {
  constructor(data: IEmployeeContract) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._employeeId = UUID.fromTrusted(data.employeeId);
    this._type = data.type;
    this._startDate = data.startDate;
    this._endDate = data.endDate;
    this._grossSalary = Money.create(data.grossSalary, data.currency).orThrow();
    this._isActive = data.isActive;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _employeeId: UUID;
  get employeeId(): UUID {
    return this._employeeId;
  }

  private _type: EmploymentType;
  get type(): EmploymentType {
    return this._type;
  }

  private _startDate: Date;
  get startDate(): Date {
    return this._startDate;
  }

  private _endDate: Date | null;
  get endDate(): Date | null {
    return this._endDate;
  }

  private _grossSalary: Money;
  get grossSalary(): Money {
    return this._grossSalary;
  }

  private _isActive: boolean;
  get isActive(): boolean {
    return this._isActive;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  public static create(props: CreateEmployeeContractProps): EmployeeContract {
    const now = DateTimeManager.create();
    const currency = props.currency ?? DEFAULT_CURRENCY;
    return new EmployeeContract({
      id: UUID.createOrGenerate(props.id).value,
      employeeId: UUID.create(props.employeeId).orThrow().value,
      type: props.type,
      startDate: props.startDate,
      endDate: props.endDate ?? null,
      grossSalary: Money.create(props.grossSalary, currency).orThrow().value,
      currency,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Sözleşmeyi sonlandırır (yeni sözleşme geldiğinde veya işten çıkışta). */
  public end(endDate: Date): void {
    this._isActive = false;
    this._endDate = endDate;
    this._updatedAt = DateTimeManager.create();
  }

  public toPersistence(): IEmployeeContract {
    return {
      id: this.id.value,
      employeeId: this.employeeId.value,
      type: this.type,
      startDate: this.startDate,
      endDate: this.endDate,
      grossSalary: this.grossSalary.value,
      currency: this.grossSalary.currency,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }
}
