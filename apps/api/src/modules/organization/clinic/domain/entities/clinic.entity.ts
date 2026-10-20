import { Clinic as IClinic, UpdateClinic } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { ClinicCreatedEvent } from '@modules/organization/clinic/domain/events/clinic-created.event';
import { ClinicSoftDeletedEvent } from '@modules/organization/clinic/domain/events/clinic-soft-deleted.event';
import {
  GlobalStatusSchema,
  GlobalStatusType as GlobalStatus,
} from '@input-type-schemas/GlobalStatusSchema';
import { CreateClinicProps } from '@modules/organization/clinic/domain/contracts/clinic';
import { Coordinates } from '@src/domain/value-objects/coordinates.vo';
import { TimeZone } from '@src/domain/value-objects/timezone.vo';
import { Slug } from '@src/domain/value-objects/slug.vo';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Phone } from '@src/domain/value-objects/phone.vo';
import { Email } from '@src/domain/value-objects/email.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { Name } from '@src/domain/value-objects/name.vo';
import { Img } from '@src/domain/value-objects/img.vo';
import { Guard } from '@common/domain/guards';
import { isNotUndefined } from '@common/utils/is-not-undefined';

export class Clinic extends AggregateRoot {
  constructor(data: IClinic) {
    super();

    let coordinates: Coordinates | undefined;

    if (data.latitude && data.longitude) {
      coordinates =
        Coordinates.fromTrusted(data.latitude, data.longitude) ?? null;
    }

    const name = Name.fromTrusted(data.name);

    this._id = UUID.fromTrusted(data.id);
    this._name = name;
    this._slug = name.toSlug();
    this._sectorId = UUID.fromTrusted(data.sectorId);
    this._phone = Phone.create(data.phone).instance ?? null;
    this._email = Email.create(data.email).instance ?? null;
    this._address = data.address;
    this._city = data.city;
    this._district = data.district;
    this._coordinates = coordinates ?? null;
    this._consultationSlotDuration = data.consultationSlotDuration;
    this._status = data.status;
    this._timezone = TimeZone.fromTrusted(data.timezone);
    this._logo = Img.fromTrusted(data.logo);
    this._isPlatform = data.isPlatform;
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
    this._deletedAt = data.deletedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _name: Name;
  get name(): Name {
    return this._name;
  }

  private _slug: Slug;
  get slug(): Slug {
    return this._slug;
  }

  private _sectorId: UUID;
  get sectorId(): UUID {
    return this._sectorId;
  }

  private _phone: Phone | null;
  get phone(): Phone | null {
    return this._phone;
  }

  private _email: Email | null;
  get email(): Email | null {
    return this._email;
  }

  private _address: string | null;
  get address(): string | null {
    return this._address;
  }

  private _city: string | null;
  get city(): string | null {
    return this._city;
  }

  private _district: string | null;
  get district(): string | null {
    return this._district;
  }

  get latitude(): number | null {
    return this._coordinates?.latitude ?? null;
  }

  get longitude(): number | null {
    return this._coordinates?.longitude ?? null;
  }

  private _coordinates: Coordinates | null;
  get coordinates(): Coordinates | null {
    return this._coordinates;
  }

  private _consultationSlotDuration: number;
  get consultationSlotDuration(): number {
    return this._consultationSlotDuration;
  }

  private _status: GlobalStatus;
  get status(): GlobalStatus {
    return this._status;
  }

  private _timezone: TimeZone;
  get timezone(): TimeZone {
    return this._timezone;
  }

  private _logo: Img | null;
  get logo(): Img | null {
    return this._logo;
  }

  /**
   * Platformun kendi defter sahibi "şube"si mi. Sistem satırıdır (migration ile
   * kurulur); uygulamadan açılan hiçbir klinik bu bayrağı alamaz ve bayrağı
   * değiştiren bir domain metodu bilerek yoktur.
   */
  private _isPlatform: boolean;
  get isPlatform(): boolean {
    return this._isPlatform;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  private _deletedAt: Date | null;
  get deletedAt(): Date | null {
    return this._deletedAt;
  }

  public get validate() {
    return {
      status: {
        isDeleted: this._isDeleted,
        isActive: this._isActive,
        isSuspended: this._isSuspended,
      },
      canAcceptAppointments: this._canAcceptAppointments,
    };
  }

  private get _isDeleted() {
    const is = !!this._deletedAt;
    return Guard.monitor(is, is, () => new Error('Klinik silinmemiş'));
  }

  private get _isSuspended() {
    const is =
      this._status === GlobalStatusSchema.enum.SUSPENDED &&
      !this._isDeleted.value;
    return Guard.monitor(
      is,
      is,
      () =>
        new Error(
          !this._isDeleted.value
            ? 'Silinmiş hesap askıya alınamaz'
            : 'Klinik askıya alınmamış'
        )
    );
  }

  private get _isActive() {
    const isActive =
      this._status === GlobalStatusSchema.enum.ACTIVE && !this._isDeleted.value;
    return Guard.monitor(
      isActive,
      isActive,
      () =>
        new Error(
          !this._isDeleted.value
            ? 'Silinmiş hesap aktif edilemez'
            : 'Klinik aktif değil'
        )
    );
  }

  private get _canAcceptAppointments() {
    const can = this._isActive.value;
    return Guard.monitor(
      can,
      can,
      () => new Error('Klinik aktif değil, randevu alınamaz')
    );
  }

  /**
   * consultationSlotDuration pozitif bir tam sayı olmalı. HTTP DTO'sunda
   * (@shared/modules/clinic CreateClinicSchema) yalnız `.default(15)` var,
   * pozitiflik/tam-sayı kontrolü yok — bu yüzden domain katmanında koşulur.
   */
  private static isValidConsultationSlotDuration(value: number): Guard<number> {
    const isValid = Number.isInteger(value) && value > 0;
    return Guard.monitor(
      value,
      isValid,
      () => new Error('Muayene slot süresi pozitif bir tam sayı olmalıdır.')
    );
  }

  public static create(props: CreateClinicProps, actorId?: string): Clinic {
    Clinic.isValidConsultationSlotDuration(
      props.consultationSlotDuration
    ).orThrow();

    const now = DateTimeManager.create();

    let coordinates: Coordinates | undefined;

    if (props.latitude || props.longitude) {
      coordinates = Coordinates.create(
        props.latitude,
        props.longitude
      ).orThrow();
    }

    const name = Name.create(props.name).orThrow();

    const clinic = new Clinic({
      id: UUID.createOrGenerate(props.id).value,
      name: name.value,
      slug: name.toSlug().value,

      sectorId: UUID.create(props.sectorId).orThrow().value,
      phone: props.phone ? Phone.create(props.phone).orThrow().value : null,
      email: props.email ? Email.create(props.email).orThrow().value : null,
      address: props.address ?? null,
      city: props.city ?? null,
      district: props.district ?? null,
      latitude: coordinates ? coordinates.latitude : null,
      longitude: coordinates ? coordinates.longitude : null,
      consultationSlotDuration: props.consultationSlotDuration,

      status: props.status ?? GlobalStatusSchema.enum.ACTIVE,

      timezone: TimeZone.create(props.timezone).orThrow().value,

      logo: props.logo
        ? Img.create(props.organizationId).orThrow().value
        : null,

      // Uygulamadan açılan klinik hiçbir zaman platform değildir; platform
      // kiracısı migration ile kurulan tek bir sistem satırıdır.
      isPlatform: false,

      organizationId: UUID.create(props.organizationId).orThrow().value,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    clinic.addDomainEvent(
      new ClinicCreatedEvent({
        clinicId: clinic.id.value,
        organizationId: clinic.organizationId.value,
        actorId,
      })
    );
    return clinic;
  }

  public switchStatus() {
    if (this.validate.status.isDeleted.value)
      throw new Error('Klinik silinmiş');

    if (this.validate.status.isActive.value) this.suspend();
    if (this.validate.status.isSuspended.value) this.activate();
  }

  public activate() {
    this._status = GlobalStatusSchema.enum.ACTIVE;
    this._updatedAt = DateTimeManager.create();
  }

  public suspend() {
    this._status = GlobalStatusSchema.enum.SUSPENDED;
    this._updatedAt = DateTimeManager.create();
  }

  public update(props: UpdateClinic): void {
    if (isNotUndefined(props.name)) {
      const name = Name.create(props.name).orThrow();
      this._name = name;
      this._slug = name.toSlug();
    }
    if (isNotUndefined(props.phone))
      this._phone = Phone.create(props.phone).orThrow();
    if (isNotUndefined(props.email))
      this._email = Email.create(props.email).orThrow();

    if (isNotUndefined(props.address)) this._address = props.address;
    if (isNotUndefined(props.city)) this._city = props.city;
    if (isNotUndefined(props.district)) this._district = props.district;

    const longitude = props?.longitude ?? this.longitude;
    const latitude = props?.latitude ?? this.latitude;
    if (props.latitude || props.longitude) {
      this._coordinates = Coordinates.create(latitude, longitude).orThrow();
    }

    if (isNotUndefined(props.logo)) {
      this._logo = props.logo ? Img.create(props.logo).orThrow() : null;
    }

    if (isNotUndefined(props.status)) this._status = props.status;

    if (isNotUndefined(props.timezone))
      this._timezone = TimeZone.create(props.timezone).orThrow();
    if (isNotUndefined(props.organizationId))
      this._organizationId = UUID.create(props.organizationId).orThrow();

    if (isNotUndefined(props.sectorId))
      this._sectorId = UUID.create(props.sectorId).orThrow();

    if (isNotUndefined(props.consultationSlotDuration)) {
      Clinic.isValidConsultationSlotDuration(
        props.consultationSlotDuration
      ).orThrow();
      this._consultationSlotDuration = props.consultationSlotDuration;
    }
    this._updatedAt = DateTimeManager.create();
  }

  public softDelete(actorId?: string): void {
    this._status = GlobalStatusSchema.enum.DELETED;
    this._deletedAt = DateTimeManager.create();
    this.addDomainEvent(
      new ClinicSoftDeletedEvent({
        clinicId: this._id.value,
        organizationId: this._organizationId.value,
        actorId,
      })
    );
  }

  toPersistence(): IClinic {
    return {
      id: this.id.value,
      name: this.name.value,
      slug: this.slug.value,
      sectorId: this.sectorId.value,
      phone: this.phone?.value ?? null,
      email: this.email?.value ?? null,
      address: this.address,
      city: this.city,
      district: this.district,
      latitude: this.latitude,
      longitude: this.longitude,
      consultationSlotDuration: this.consultationSlotDuration,
      status: this.status,
      timezone: this.timezone.value,
      logo: this.logo?.value ?? null,
      isPlatform: this.isPlatform,
      organizationId: this.organizationId?.value ?? null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
    };
  }
}
