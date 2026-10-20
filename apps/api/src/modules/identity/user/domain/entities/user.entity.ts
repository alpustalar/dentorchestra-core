import type { User as IUser } from '@shared';
import {
  GlobalStatusSchema,
  GlobalStatusType,
} from '@input-type-schemas/GlobalStatusSchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UserUpdatedEvent } from '@modules/identity/user/domain/events/user-updated.event';
import { LogAction, LogType } from '@src/domain/constants/log-action.constant';
import {
  InvalidUserDeletionException,
  InvalidUserUpdateException,
} from '@modules/identity/user/domain/exceptions/user.exceptions';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { FirebaseUid } from '@src/domain/value-objects/firebase-uid.vo';
import { Email } from '@src/domain/value-objects/email.vo';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Img } from '@src/domain/value-objects/img.vo';
import { Phone } from '@src/domain/value-objects/phone.vo';
import { Guard } from '@common/domain/guards';
import { FullName } from '@src/domain/value-objects/full-name.vo';
import { isNotUndefined } from '@common/utils/is-not-undefined';
import { isDefined } from '@common/utils';
import { Priority } from '@src/domain/value-objects/priority.vo';
import { UserDeletedEvent } from '@modules/identity/user/domain/events/delete-user.event';
import {
  UserManagedClinicsAssignedEvent,
  UserOrganizationOwnershipGrantedEvent,
} from '@modules/identity/user/domain/events/user-scope-changed.event';
import {
  AssignManagedClinicsProps,
  CreateUserProps,
  GrantOrganizationOwnershipProps,
  UpdateDetailsProps,
} from '@modules/identity/user/domain/contracts';

export type UserRoleRef = { id: string; priority: Priority };
export type UserWorkingClinicRef = { id: string };

export type UserWithRelations = IUser & {
  role: UserRoleRef | null;
  workingClinic: UserWorkingClinicRef | null;
  managedClinicIds: string[];
  ownedOrganizationIds: string[];
  providerProfileId: string | null;
};

export class User extends AggregateRoot {
  constructor(data: UserWithRelations) {
    super();
    this._id = FirebaseUid.fromTrusted(data.id);
    this._displayName = FullName.fromTrusted(data.displayName);
    this._email = Email.fromTrusted(data.email);
    this._emailVerified = data.emailVerified;
    this._status = data.status;
    this._roleId = UUID.fromTrusted(data.roleId);
    this._picture = Img.fromTrusted(data.picture) ?? null;
    this._clinicId = data.clinicId ? UUID.fromTrusted(data.clinicId) : null;
    this._lastLogin = data.lastLogin;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
    this._deletedAt = data.deletedAt ?? null;
    this._phoneNumber = data.phoneNumber
      ? Phone.fromTrusted(data.phoneNumber)
      : null;
    this._role = data.role ?? null;
    this._workingClinic = data.workingClinic ?? null;

    this._managedClinicIds = data.managedClinicIds
      ? data.managedClinicIds.map((ids) => UUID.fromTrusted(ids))
      : [];

    this._ownedOrganizationIds = data.ownedOrganizationIds
      ? data.ownedOrganizationIds.map((ids) => UUID.fromTrusted(ids))
      : [];

    this._providerProfileId = data.providerProfileId
      ? UUID.fromTrusted(data.providerProfileId)
      : null;
  }

  private _ownedOrganizationIds: UUID[] | null;

  get ownedOrganizationIds(): UUID[] | null {
    return this._ownedOrganizationIds;
  }

  private _providerProfileId: UUID | null;

  get providerProfileId(): UUID | null {
    return this._providerProfileId;
  }

  private _managedClinicIds: UUID[] | null;

  get managedClinicIds(): UUID[] | null {
    return this._managedClinicIds;
  }

  private _id: FirebaseUid;

  get id(): FirebaseUid {
    return this._id;
  }

  private _displayName: FullName;

  get displayName(): FullName {
    return this._displayName;
  }

  private _email: Email;

  get email(): Email {
    return this._email;
  }

  private _emailVerified: boolean;

  get emailVerified(): boolean {
    return this._emailVerified;
  }

  private _status: GlobalStatusType;

  get status(): GlobalStatusType {
    return this._status;
  }

  private _roleId: UUID;

  get roleId(): UUID {
    return this._roleId;
  }

  private _picture: Img | null;

  get picture(): Img | null {
    return this._picture;
  }

  private _phoneNumber: Phone | null;

  get phoneNumber(): Phone | null {
    return this._phoneNumber;
  }

  private _clinicId: UUID | null;

  get clinicId(): UUID | null {
    return this._clinicId;
  }

  private _lastLogin: Date;

  get lastLogin(): Date {
    return this._lastLogin;
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

  private _role: UserRoleRef | null;

  get role(): UserRoleRef | null {
    return this._role;
  }

  private _workingClinic: UserWorkingClinicRef | null;

  get workingClinic(): UserWorkingClinicRef | null {
    return this._workingClinic;
  }

  get isDeleted(): boolean {
    return !!this._deletedAt;
  }

  // Domain query methods

  get isActive(): Guard<boolean> {
    const isValid =
      this._status === GlobalStatusSchema.enum.ACTIVE && !this.isDeleted;
    return Guard.monitor(
      isValid,
      isValid,
      () => new Error('Kullanıcı aktif değil')
    );
  }

  get canSoftDelete() {
    let canSoft = true;

    if (this.role && this.role.priority.validate.isAdmin.value) canSoft = false;

    return Guard.monitor(
      canSoft,
      canSoft,
      () => new InvalidUserDeletionException()
    );
  }

  static create(props: CreateUserProps): User {
    const now = DateTimeManager.create();

    return new User({
      id: FirebaseUid.create(props.id).orThrow().value,
      email: Email.create(props.email).orThrow().value,
      displayName: FullName.fromTrusted(props.displayName).value,
      emailVerified: false,
      status: GlobalStatusSchema.enum.ACTIVE,
      roleId: UUID.create(props.roleId).orThrow().value,

      picture: props.picture ? Img.create(props.picture).orThrow().value : null,

      phoneNumber: props.phone
        ? Phone.create(props.phone).orThrow().value
        : null,

      clinicId: props.clinicId
        ? UUID.create(props.clinicId).orThrow().value
        : null,

      lastLogin: now,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      role: null,
      workingClinic: null,

      managedClinicIds: props.managedClinicIds
        ? props.managedClinicIds.map((ids) => UUID.create(ids).orThrow().value)
        : [],

      ownedOrganizationIds: props.ownedOrganizationIds
        ? props.ownedOrganizationIds.map(
            (ids) => UUID.create(ids).orThrow().value
          )
        : [],

      providerProfileId: props.providerProfileId
        ? UUID.create(props.providerProfileId).orThrow().value
        : null,
    });
  }

  private static toDistinctIds(ids: string[]): string[] {
    return [...new Set(ids.map((id) => UUID.create(id).orThrow().value))];
  }

  private static diffScope(
    current: UUID[] | null,
    next: string[]
  ): { added: string[]; removed: string[] } {
    const before = new Set((current ?? []).map(({ value }) => value));
    const after = new Set(next);

    return {
      added: next.filter((id) => !before.has(id)),
      removed: [...before].filter((id) => !after.has(id)),
    };
  }

  /**
   * Profil güncellemesi: isim, resim, telefon, durum, rol, çalışılan klinik.
   *
   * Kapsam devri (yönetilen klinikler / organizasyon sahipliği) bilerek burada
   * DEĞİL; assignManagedClinics ve grantOrganizationOwnership metotlarında.
   * Aynı metotta olsalardı telefon güncelleyen bir çağrı, eksik gönderilen bir
   * dizi yüzünden kullanıcının tüm yetki kapsamını silebilirdi; üstelik ikisi
   * farklı denetim olayı üretir (INFO vs SECURITY).
   */
  updateDetails(props: UpdateDetailsProps, actorId: string): void {
    if (this.isDeleted) {
      throw new InvalidUserUpdateException(this.id.value);
    }
    if (isDefined(props.displayName))
      this._displayName = FullName.create(props.displayName).orThrow();

    if (isNotUndefined(props.picture))
      this._picture = Img.create(props.picture).orThrow();

    if (isNotUndefined(props.phoneNumber))
      this._phoneNumber = props.phoneNumber
        ? Phone.create(props.phoneNumber).orThrow()
        : null;
    if (isDefined(props.status)) this._status = props.status;
    if (isDefined(props.roleId))
      this._roleId = UUID.create(props.roleId).orThrow();
    if (isDefined(props.clinicId))
      this._clinicId = UUID.create(props.clinicId).orThrow();

    this._updatedAt = DateTimeManager.create();

    this.addDomainEvent(
      new UserUpdatedEvent({
        userId: this.id.value,
        actorId,
        action: LogAction.USER_UPDATE,
        type: LogType.INFO,
        details: 'Kullanıcı bilgileri başarıyla güncellendi.',
      })
    );
  }

  /**
   * Kullanıcının YÖNETTİĞİ kliniklerin tam listesini belirler (replace).
   *
   * Hangi kliniğin atanabileceği kararı entity'nin işi değildir; aktörün
   * kapsamına bakmak gerekir, o bilgi burada yok. Entity kimlik formatını
   * doğrular, farkı hesaplar ve güvenlik olayını üretir; devrin meşruluğunu
   * çağıran handler kapıda doğrular.
   */
  assignManagedClinics(props: AssignManagedClinicsProps): void {
    if (this.isDeleted) {
      throw new InvalidUserUpdateException(this.id.value);
    }

    const next = User.toDistinctIds(props.clinicIds);
    const { added, removed } = User.diffScope(this._managedClinicIds, next);

    // Fark yoksa denetim kaydı da üretilmez: "değişmedi" satırları gerçek
    // devirleri gürültüye boğar.
    if (!added.length && !removed.length) return;

    this._managedClinicIds = next.map((id) => UUID.fromTrusted(id));
    this._updatedAt = DateTimeManager.create();

    this.addDomainEvent(
      new UserManagedClinicsAssignedEvent({
        targetUserId: this.id.value,
        actorId: props.actorId,
        assigned: next,
        added,
        removed,
      })
    );
  }

  /**
   * Kullanıcının SAHİBİ olduğu organizasyonların tam listesini belirler
   * (replace). Sistemdeki en geniş kapsam olduğu için kendi olayını üretir.
   */
  grantOrganizationOwnership(props: GrantOrganizationOwnershipProps): void {
    if (this.isDeleted) {
      throw new InvalidUserUpdateException(this.id.value);
    }

    const next = User.toDistinctIds(props.organizationIds);
    const { added, removed } = User.diffScope(this._ownedOrganizationIds, next);

    if (!added.length && !removed.length) return;

    this._ownedOrganizationIds = next.map((id) => UUID.fromTrusted(id));
    this._updatedAt = DateTimeManager.create();

    this.addDomainEvent(
      new UserOrganizationOwnershipGrantedEvent({
        targetUserId: this.id.value,
        actorId: props.actorId,
        assigned: next,
        added,
        removed,
      })
    );
  }

  changeStatus(status: GlobalStatusType): void {
    this._status = status;
    this._updatedAt = DateTimeManager.create();
  }

  softDelete(actorId: string): void {
    this.canSoftDelete.orThrow();
    if (this.isDeleted) return;

    this.addDomainEvent(
      new UserDeletedEvent({
        userId: this.id.value,
        action: LogAction.USER_DELETE,
        type: LogType.INFO,
        details: 'Kullanıcı silindi',
        actorId,
      })
    );

    this._deletedAt = DateTimeManager.create();
    this._updatedAt = DateTimeManager.create();
    this._status = GlobalStatusSchema.enum.DELETED;
  }

  toPersistence(): IUser {
    return {
      id: this.id.value,
      displayName: this.displayName.value,
      email: this.email.value,
      emailVerified: this.emailVerified,
      status: this.status,
      roleId: this.roleId.value,
      picture: this.picture?.value ?? null,
      phoneNumber: this.phoneNumber?.value ?? null,
      clinicId: this.clinicId?.value ?? null,
      lastLogin: this.lastLogin,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
    };
  }
}
