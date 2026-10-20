import { Patient as IPatient, PatientStatusSchema } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { GenderType as Gender } from '@input-type-schemas/GenderSchema';
import { BloodTypeType as BloodType } from '@input-type-schemas/BloodTypeSchema';
import { PatientStatusType as PatientStatus } from '@input-type-schemas/PatientStatusSchema';
import { PatientTypeType as PatientType } from '@input-type-schemas/PatientTypeSchema';
import { CreatePatientProps } from '@modules/crm/patient/domain/contracts/patient';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { Guard } from '@common/domain/guards';
import {
  Email,
  FirebaseUid,
  FullName,
  Img,
  LastName,
  Name,
  Phone,
  TckNo,
  UUID,
} from '@src/domain/value-objects';

export class Patient extends AggregateRoot {
  constructor(data: IPatient) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._organizationId = UUID.fromTrusted(data.organizationId);

    if (data.clinicId) this._clinicId = UUID.fromTrusted(data.clinicId);

    if (data.sectorId) this._sectorId = UUID.fromTrusted(data.sectorId);

    this._firstName = Name.fromTrusted(data.firstName);

    this._lastName = LastName.create(data.lastName).instance ?? null;

    if (data.tcNo) this._tcNo = TckNo.fromTrusted(data.tcNo);

    this._birthDate = data.birthDate;
    this._gender = data.gender;

    if (data.phone) this._phone = Phone.fromTrusted(data.phone);

    if (data.alternativePhone)
      this._alternativePhone = Phone.fromTrusted(data.alternativePhone);

    if (data.email) this._email = Email.fromTrusted(data.email);

    if (data.firebaseUid)
      this._firebaseUid = FirebaseUid.fromTrusted(data.firebaseUid);

    this._address = data.address;
    this._emergencyContact = data.emergencyContact;
    this._companionName = data.companionName;

    if (data.companionPhone)
      this._companionPhone = Phone.fromTrusted(data.companionPhone);

    if (data.profilePhoto)
      this._profilePhoto = Img.fromTrusted(data.profilePhoto);

    this._protocolNo = data.protocolNo;
    this._allergies = data.allergies;
    this._chronicDiseases = data.chronicDiseases;
    this._bloodType = data.bloodType;
    this._status = data.status;
    this._patientType = data.patientType;
    this._responsibleProviderId = data.responsibleProviderId;
    this._checkupDate = data.checkupDate;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
    this._deletedAt = data.deletedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _firebaseUid: FirebaseUid | null;
  get firebaseUid(): FirebaseUid | null {
    return this._firebaseUid;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _clinicId: UUID | null;
  get clinicId(): UUID | null {
    return this._clinicId;
  }

  private _sectorId: UUID | null;
  get sectorId(): UUID | null {
    return this._sectorId;
  }

  private _firstName: Name;
  get firstName(): Name {
    return this._firstName;
  }

  private _lastName: LastName | null;
  get lastName(): LastName | null {
    return this._lastName;
  }

  private _tcNo: TckNo | null;
  get tcNo(): TckNo | null {
    return this._tcNo;
  }

  private _birthDate: Date | null;
  get birthDate(): Date | null {
    return this._birthDate;
  }

  private _gender: Gender | null;
  get gender(): Gender | null {
    return this._gender;
  }

  private _phone: Phone | null;
  get phone(): Phone | null {
    return this._phone;
  }

  private _alternativePhone: Phone | null;

  get alternativePhone(): Phone | null {
    return this._alternativePhone;
  }

  private _email: Email | null;

  get email(): Email | null {
    return this._email;
  }

  private _address: string | null;

  get address(): string | null {
    return this._address;
  }

  private _emergencyContact: string | null;

  get emergencyContact(): string | null {
    return this._emergencyContact;
  }

  private _companionName: string | null;

  get companionName(): string | null {
    return this._companionName;
  }

  private _companionPhone: Phone | null;

  get companionPhone(): Phone | null {
    return this._companionPhone;
  }

  private _profilePhoto: Img | null;

  get profilePhoto(): Img | null {
    return this._profilePhoto;
  }

  private _protocolNo: string | null;

  get protocolNo(): string | null {
    return this._protocolNo;
  }

  private _allergies: string | null;

  get allergies(): string | null {
    return this._allergies;
  }

  private _chronicDiseases: string | null;

  get chronicDiseases(): string | null {
    return this._chronicDiseases;
  }

  private _bloodType: BloodType | null;

  get bloodType(): BloodType | null {
    return this._bloodType;
  }

  private _status: PatientStatus;

  get status(): PatientStatus {
    return this._status;
  }

  private _patientType: PatientType | null;

  get patientType(): PatientType | null {
    return this._patientType;
  }

  private _responsibleProviderId: string | null;

  get responsibleProviderId(): string | null {
    return this._responsibleProviderId;
  }

  private _checkupDate: Date | null;

  get checkupDate(): Date | null {
    return this._checkupDate;
  }

  // NOT: Kalıcı `discountRate` kaldırıldı — "sürekli indirimli hasta" ticari
  // olarak savunulamaz ve raporlanamazdı. İndirim artık işlem anında
  // TreatmentCharge satırında donuyor (gerekçesi, tavanı ve onaylayanıyla).

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
      hasPhone: this.hasPhone(),
      status: {
        isActive: this.isActive(),
        isInactive: this.isInactive(),
        isArchived: this.isArchived(),
        isBlackListed: this.isBlacklisted(),
        isDeceased: this.isDeceased(),
      },
      mode: {
        isClinicInline: this.isClinicInline(),
      },
    };
  }

  public static create(props: CreatePatientProps): Patient {
    const firstName = Name.create(props.firstName).orThrow();

    const lastName = props.lastName
      ? LastName.create(props.lastName).orThrow()
      : null;

    const organizationId = UUID.create(props.organizationId).orThrow();

    const clinicId = props.clinicId
      ? UUID.create(props.clinicId).orThrow()
      : null;

    const sectorId = props.sectorId
      ? UUID.create(props.sectorId).orThrow()
      : null;

    const phone = props.phone ? Phone.create(props.phone).orThrow() : null;

    const alternativePhone = props.alternativePhone
      ? Phone.create(props.alternativePhone).orThrow()
      : null;

    const companionPhone = props.companionPhone
      ? Phone.create(props.companionPhone).orThrow()
      : null;

    const email = props.email ? Email.create(props.email).orThrow() : null;

    const tcNo = props.tcNo ? TckNo.create(props.tcNo).orThrow() : null;

    const firebaseUid = props.firebaseUid
      ? FirebaseUid.create(props.firebaseUid).orThrow()
      : null;

    const profilePhoto = props.profilePhoto
      ? Img.create(props.profilePhoto).orThrow()
      : null;

    const now = DateTimeManager.create();

    return new Patient({
      id: UUID.createOrGenerate(props.id).value,
      organizationId: organizationId.value,
      clinicId: clinicId?.value ?? null,
      sectorId: sectorId?.value ?? null,
      phone: phone?.value ?? null,
      firstName: firstName.value,
      lastName: lastName?.value ?? null,
      tcNo: tcNo?.value ?? null,
      birthDate: props.birthDate ?? null,
      gender: props.gender ?? null,
      alternativePhone: alternativePhone?.value ?? null,
      email: email?.value ?? null,
      address: props.address ?? null,
      emergencyContact: props.emergencyContact ?? null,
      companionName: props.companionName ?? null,
      companionPhone: companionPhone?.value ?? null,
      profilePhoto: profilePhoto?.value ?? null,
      protocolNo: props.protocolNo ?? null,
      allergies: props.allergies ?? null,
      chronicDiseases: props.chronicDiseases ?? null,
      bloodType: props.bloodType ?? null,
      patientType: props.patientType ?? null,
      responsibleProviderId: props.responsibleProviderId ?? null,
      checkupDate: props.checkupDate ?? null,
      status: PatientStatusSchema.enum.ACTIVE,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      firebaseUid: firebaseUid?.value ?? null,
    });
  }

  public linkFirebaseAccount(firebaseUid: string): void {
    this._firebaseUid = FirebaseUid.create(firebaseUid).orThrow();
  }

  public activate(): void {
    if (this.isActive().value) return;
    this._status = PatientStatusSchema.enum.ACTIVE;
    this._deletedAt = null;
  }

  public deactivate(): void {
    if (this.isInactive().value) return;
    this._status = PatientStatusSchema.enum.INACTIVE;
  }

  public archive(): void {
    if (this._status === PatientStatusSchema.enum.ARCHIVED) return;
    this._status = PatientStatusSchema.enum.ARCHIVED;
  }

  public blacklist(): void {
    this._status = PatientStatusSchema.enum.BLACKLISTED;
  }

  public markDeceased(): void {
    this._status = PatientStatusSchema.enum.DECEASED;
  }

  // STATUS QUERIES

  public softDelete(): void {
    this._deletedAt = DateTimeManager.create();
  }

  public fullName(): string {
    return FullName.fromTrusted(
      `${this.firstName.value} ${this.lastName?.value ?? ''}`
    ).value;
  }

  public toPersistence(): IPatient {
    return {
      id: this.id.value,
      organizationId: this.organizationId.value,
      clinicId: this.clinicId?.value ?? null,
      sectorId: this.sectorId?.value ?? null,
      firstName: this.firstName.value,
      lastName: this.lastName?.value ?? null,
      tcNo: this.tcNo?.value ?? null,
      birthDate: this.birthDate,
      gender: this.gender,
      phone: this.phone?.value ?? null,
      alternativePhone: this.alternativePhone?.value ?? null,
      email: this.email?.value ?? null,
      address: this.address,
      emergencyContact: this.emergencyContact,
      companionName: this.companionName,
      companionPhone: this.companionPhone?.value ?? null,
      profilePhoto: this.profilePhoto?.value ?? null,
      protocolNo: this.protocolNo,
      allergies: this.allergies,
      chronicDiseases: this.chronicDiseases,
      bloodType: this.bloodType,
      status: this.status,
      patientType: this.patientType,
      responsibleProviderId: this.responsibleProviderId,
      checkupDate: this.checkupDate,
      createdAt: this.createdAt,
      updatedAt: DateTimeManager.create(),
      deletedAt: this.deletedAt,
      firebaseUid: this.firebaseUid?.value ?? null,
    };
  }

  private isActive(): Guard<boolean> {
    const isValid = this.status === PatientStatusSchema.enum.ACTIVE;
    return Guard.monitor(isValid, isValid, () => new Error());
  }

  private isInactive() {
    const isValid = this.status === PatientStatusSchema.enum.INACTIVE;
    return Guard.monitor(isValid, isValid, () => new Error());
  }

  private isArchived() {
    const isValid = this.status === PatientStatusSchema.enum.ARCHIVED;
    return Guard.monitor(isValid, isValid, () => new Error());
  }

  private isBlacklisted(): Guard<boolean> {
    const isValid = this.status === PatientStatusSchema.enum.BLACKLISTED;
    return Guard.monitor(isValid, isValid, () => new Error());
  }

  private isDeceased(): Guard<boolean> {
    const isValid = this.status === PatientStatusSchema.enum.DECEASED;
    return Guard.monitor(isValid, isValid, () => new Error());
  }

  private isDeleted(): Guard<boolean> {
    const isValid = this.deletedAt !== null;
    return Guard.monitor(isValid, isValid, () => new Error());
  }

  private isClinicInline(): Guard<boolean> {
    const isFirebaseUser = !!this.firebaseUid?.value;
    return Guard.monitor(!isFirebaseUser, !isFirebaseUser, () => new Error());
  }

  private hasPhone(): Guard<boolean> {
    const isValid = this.phone !== null;
    return Guard.monitor(isValid, isValid, () => new Error());
  }
}
