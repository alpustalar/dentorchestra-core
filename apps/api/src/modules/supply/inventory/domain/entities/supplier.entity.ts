import { Supplier as ISupplier } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Phone } from '@src/domain/value-objects/phone.vo';
import { Name } from '@src/domain/value-objects/name.vo';
import { Email } from '@src/domain/value-objects/email.vo';
import { isNotUndefined } from '@common/utils/is-not-undefined';
import {
  CreateSupplierProps,
  UpdateSupplierProps,
} from '@modules/supply/inventory/domain/contracts';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';

export class Supplier extends AggregateRoot {
  constructor(data: ISupplier) {
    super();

    this._id = UUID.fromTrusted(data.id);
    this._name = Name.fromTrusted(data.name);

    this._contactName = data.contactName
      ? Name.fromTrusted(data.contactName)
      : null;

    this._phone = Phone.create(data.phone).instance ?? null;
    this._email = Email.create(data.email).instance ?? null;
    this._address = data.address;
    this._taxNumber = data.taxNumber;
    this._taxOffice = data.taxOffice;

    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._isActive = data.isActive;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _name: Name;
  get name(): Name {
    return this._name;
  }

  private _contactName: Name | null;
  get contactName(): Name | null {
    return this._contactName;
  }

  private _phone: Phone | null;
  get phone(): Phone | null {
    return this._phone;
  }

  private _email: Email | null;
  get email(): Email | null {
    return this._email;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _address: string | null;
  get address(): string | null {
    return this._address;
  }

  private _taxNumber: string | null;
  get taxNumber(): string | null {
    return this._taxNumber;
  }

  private _taxOffice: string | null;
  get taxOffice(): string | null {
    return this._taxOffice;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
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

  public static create(props: CreateSupplierProps): Supplier {
    const now = DateTimeManager.create();

    return new Supplier({
      id: UUID.createOrGenerate(props.id).value,
      organizationId: props.organizationId,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      name: Name.create(props.name).orThrow().value,

      contactName: props.contactName
        ? Name.create(props.contactName).orThrow().value
        : null,

      phone: props.phone ? Phone.create(props.phone).orThrow().value : null,

      email: props.email ? Email.create(props.email).orThrow().value : null,

      address: props.address ?? null,
      taxNumber: props.taxNumber ?? null,
      taxOffice: props.taxOffice ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  public update(props: UpdateSupplierProps): void {
    if (isNotUndefined(props.name))
      this._name = Name.create(props.name).orThrow();

    if (isNotUndefined(props.contactName))
      this._contactName = props.contactName
        ? Name.create(props.contactName).orThrow()
        : null;

    if (isNotUndefined(props.phone))
      this._phone = props.phone ? Phone.create(props.phone).orThrow() : null;

    if (isNotUndefined(props.email))
      this._email = props.email ? Email.create(props.email).orThrow() : null;

    if (isNotUndefined(props.address)) this._address = props.address;
    if (isNotUndefined(props.taxNumber)) this._taxNumber = props.taxNumber;
    if (isNotUndefined(props.taxOffice)) this._taxOffice = props.taxOffice;
  }

  public activate(): void {
    this._isActive = true;
  }

  public deactivate(): void {
    this._isActive = false;
  }

  toPersistence(): ISupplier {
    return {
      id: this.id.value,
      name: this.name.value,
      contactName: this.contactName?.value ?? null,
      phone: this.phone?.value ?? null,
      email: this.email?.value ?? null,
      address: this.address,
      taxNumber: this.taxNumber,
      taxOffice: this.taxOffice,
      organizationId: this.organizationId.value,
      clinicId: this.clinicId.value,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
