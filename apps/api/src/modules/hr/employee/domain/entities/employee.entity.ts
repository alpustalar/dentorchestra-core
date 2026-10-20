import { Employee as IEmployee } from '@shared';
import { EmploymentTypeType as EmploymentType } from '@input-type-schemas/EmploymentTypeSchema';
import {
  EmployeeStatusSchema,
  EmployeeStatusType as EmployeeStatus,
} from '@input-type-schemas/EmployeeStatusSchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { isDefined } from '@common/utils';
import { isNotUndefined } from '@common/utils/is-not-undefined';
import {
  CreateEmployeeProps,
  UpdateEmployeeProps,
} from '@modules/hr/employee/domain/contracts';
import { EmployeeAlreadyTerminatedException } from '@modules/hr/employee/domain/exceptions/employee.exceptions';
import {
  Email,
  FirebaseUid,
  FullName,
  LastName,
  Name,
  Phone,
  TckNo,
} from '@src/domain/value-objects';

const DEFAULT_ANNUAL_LEAVE = 14;

/** Personel (İK). organizationId + clinicId birlikte taşınır; sözleşmeler ayrı entity. */
export class Employee extends AggregateRoot {
  constructor(data: IEmployee) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._userId = FirebaseUid.create(data.userId).instance ?? null;
    this._firstName = Name.fromTrusted(data.firstName);
    this._lastName = LastName.fromTrusted(data.lastName);
    this._email = Email.create(data.email).instance ?? null;
    this._phone = Phone.create(data.phone).instance ?? null;
    this._nationalId = TckNo.create(data.nationalId).instance ?? null;
    this._title = data.title;
    this._department = data.department;
    this._employmentType = data.employmentType;
    this._status = data.status;
    this._hireDate = data.hireDate;
    this._terminationDate = data.terminationDate;
    this._annualLeaveEntitlement = data.annualLeaveEntitlement;
    this._isDeleted = data.isDeleted;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
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

  private _userId: FirebaseUid | null;
  get userId(): FirebaseUid | null {
    return this._userId;
  }

  private _firstName: Name;
  get firstName(): Name {
    return this._firstName;
  }

  private _lastName: LastName;
  get lastName(): LastName {
    return this._lastName;
  }

  get fullName(): FullName {
    return FullName.fromTrusted(
      `${this.firstName.value} ${this.lastName.value}`
    );
  }

  private _email: Email | null;
  get email(): Email | null {
    return this._email;
  }

  private _phone: Phone | null;
  get phone(): Phone | null {
    return this._phone;
  }

  private _nationalId: TckNo | null;
  get nationalId(): TckNo | null {
    return this._nationalId;
  }

  private _title: string | null;
  get title(): string | null {
    return this._title;
  }

  private _department: string | null;
  get department(): string | null {
    return this._department;
  }

  private _employmentType: EmploymentType;
  get employmentType(): EmploymentType {
    return this._employmentType;
  }

  private _status: EmployeeStatus;
  get status(): EmployeeStatus {
    return this._status;
  }

  private _hireDate: Date;
  get hireDate(): Date {
    return this._hireDate;
  }

  private _terminationDate: Date | null;
  get terminationDate(): Date | null {
    return this._terminationDate;
  }

  private _annualLeaveEntitlement: number;
  get annualLeaveEntitlement(): number {
    return this._annualLeaveEntitlement;
  }

  private _isDeleted: boolean;
  get isDeleted(): boolean {
    return this._isDeleted;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  public static create(props: CreateEmployeeProps): Employee {
    const now = DateTimeManager.create();

    return new Employee({
      id: UUID.createOrGenerate(props.id).value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      userId: props.userId
        ? FirebaseUid.create(props.userId).orThrow().value
        : null,
      firstName: Name.create(props.firstName).orThrow().value,
      lastName: LastName.create(props.lastName).orThrow().value,
      email: props.email ? Email.create(props.email).orThrow().value : null,
      phone: props.phone ? Phone.create(props.phone).orThrow().value : null,
      nationalId: props.nationalId
        ? TckNo.create(props.nationalId).orThrow().value
        : null,
      title: props.title ?? null,
      department: props.department ?? null,
      employmentType: props.employmentType,
      status: EmployeeStatusSchema.enum.ACTIVE,
      hireDate: props.hireDate,
      terminationDate: null,
      annualLeaveEntitlement:
        props.annualLeaveEntitlement ?? DEFAULT_ANNUAL_LEAVE,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  public updateProfile(props: UpdateEmployeeProps): void {
    if (isDefined(props.firstName))
      this._firstName = Name.create(props.firstName).orThrow();

    if (isDefined(props.lastName))
      this._lastName = LastName.create(props.lastName).orThrow();

    if (isNotUndefined(props.email))
      this._email = props.email ? Email.create(props.email).orThrow() : null;

    if (isNotUndefined(props.phone))
      this._phone = props.phone ? Phone.create(props.phone).orThrow() : null;

    if (isNotUndefined(props.nationalId))
      this._nationalId = props.nationalId
        ? TckNo.create(props.nationalId).orThrow()
        : null;

    if (isNotUndefined(props.title)) this._title = props.title;
    if (isNotUndefined(props.department)) this._department = props.department;
    if (isDefined(props.employmentType))
      this._employmentType = props.employmentType;
    if (isDefined(props.annualLeaveEntitlement))
      this._annualLeaveEntitlement = props.annualLeaveEntitlement;
    this._updatedAt = DateTimeManager.create();
  }

  public terminate(terminationDate: Date): void {
    if (this._status === EmployeeStatusSchema.enum.TERMINATED) {
      throw new EmployeeAlreadyTerminatedException(this._id.value);
    }
    this._status = EmployeeStatusSchema.enum.TERMINATED;
    this._terminationDate = terminationDate;
    this._updatedAt = DateTimeManager.create();
  }

  public isTerminated(): boolean {
    return this._status === EmployeeStatusSchema.enum.TERMINATED;
  }

  public softDelete(): void {
    this._isDeleted = true;
    this._updatedAt = DateTimeManager.create();
  }

  public toPersistence(): IEmployee {
    return {
      id: this.id.value,
      organizationId: this.organizationId.value,
      clinicId: this.clinicId.value,
      userId: this.userId?.value ?? null,
      firstName: this.firstName.value,
      lastName: this.lastName.value,
      email: this.email?.value ?? null,
      phone: this.phone?.value ?? null,
      nationalId: this.nationalId?.value ?? null,
      title: this.title,
      department: this.department,
      employmentType: this.employmentType,
      status: this.status,
      hireDate: this.hireDate,
      terminationDate: this.terminationDate,
      annualLeaveEntitlement: this.annualLeaveEntitlement,
      isDeleted: this.isDeleted,
      createdAt: this.createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }
}
