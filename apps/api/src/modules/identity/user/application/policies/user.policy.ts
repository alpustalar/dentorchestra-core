import { ActorContext } from '@common/interfaces';
import { ClinicPolicy } from '@modules/organization/clinic/application/policies';
import { UserResponseGroups } from '@modules/identity/user/domain/contracts';
import { Priority } from '@src/domain/value-objects/priority.vo';
import { ExecutionSource } from '../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { isPlatformCapability } from '@src/infrastructure/persistence/prisma/data/modules';

type HasPriority = {
  priority: number;
  role?: {
    priority: number;
  };
};

type PriorityAndClinicId = {
  clinicId: string;
} & HasPriority;

const { ADMIN, INTERNAL, FINANCIAL, DATA_OWNER, MANAGEMENT } =
  UserResponseGroups;

export class UserPolicy extends ClinicPolicy {
  private readonly actorCapabilities: string[];
  private readonly priority: Priority;

  constructor(actor: ActorContext, source: ExecutionSource) {
    super(actor, source);
    this.actorCapabilities = actor.capabilities || [];
    this.priority = Priority.fromTrusted(actor.rolePriority);
  }
  /**
   * Kullanıcının kendisi mi?
   */
  isSelf(targetUserId: string): boolean {
    return this.actor.userId === targetUserId;
  }

  /**
   * Aktör bu yetkiyi kendisi taşıyor mu? (rol + kişisel yetkiler birleşimi)
   */
  actorHasCapability(capability: string): boolean {
    return this.actorCapabilities.includes(capability);
  }

  /**
   * Aktör bu yetkiyi BAŞKA bir kullanıcıya devredebilir mi?
   *
   * İki kural birlikte işler:
   * 1. Platform kapsamındaki yetkiler kimseye devredilemez — sistem yöneticisine
   *    bile. Onlar zaten rolle gelir; kişisel devir yolunu açmak, global rolleri
   *    değiştirebilecek bir personel üretme riskini kalıcı kılardı.
   * 2. Aktör yalnız KENDİ taşıdığı yetkiyi devredebilir. Aksi hâlde bir yönetici,
   *    kendisinde olmayan yetkiyi personeline verip o hesapla kullanarak kendi
   *    tavanını dolaylı yoldan aşabilirdi.
   */
  actorCanGrantCapability(capability: string): boolean {
    if (isPlatformCapability(capability)) return false;
    return this.actorHasCapability(capability);
  }

  /**
   * Hedef kendi yönettiği clinic'lerden birinde mi? (Manage için)
   */
  isTargetInActorsManagedClinic(
    targetUserClinicId: string | null | undefined
  ): boolean {
    if (!targetUserClinicId) return false;
    return this.actorCanManageTargetClinic(targetUserClinicId);
  }

  actorCanUpdateTargetUser(
    targetUserPriority: Priority | undefined,
    targetUserClinicId: string | undefined
  ) {
    const priority = this.getTargetPriority(targetUserPriority);
    return (
      this.isPrivilegedUser() ||
      this.actorHasHigherPriorityThanTarget(priority) ||
      this.isTargetInActorsManagedClinic(targetUserClinicId)
    );
  }

  /**
   * Hedef kendi çalıştığı clinic'te mi? (Read için)
   */
  isTargetInActorsSameClinic(
    targetUserClinicId: string | null | undefined
  ): boolean {
    if (!targetUserClinicId || !this.actor.clinicId) return false;
    return this.actorCanAccessTargetClinic(targetUserClinicId);
  }
  /**
   * Privileged user mu? (Priority >= 80)
   */
  isPrivilegedUser(): boolean {
    return this.priority.validate.isPrivilegedUser.value;
  }
  /**
   * Aktör, hedeften KESİN OLARAK ÜST mü?
   */
  actorHasHigherPriorityThanTarget(
    targetPriority: Priority | number | string | undefined | null
  ): boolean {
    return this.priority.validate.isHigherThan(
      this.getTargetPriority(targetPriority)
    ).value;
  }

  /**
   * Aktör ve hedef AYNI seviyede mi?
   */
  actorHasEqualPriorityWithTarget(target: Priority | number | string): boolean {
    return this.priority.validate.isEqual(this.getTargetPriority(target)).value;
  }

  /**
   * Aktör, hedeften DÜŞÜK mü?
   */
  actorHasLowerPriorityThanTarget(target: Priority | number | string): boolean {
    return this.priority.validate.isLowerThan(this.getTargetPriority(target))
      .value;
  }
  //? ==========================================
  //? PRIORITY CHECKS (Cached)
  //? ==========================================

  /**
   * Kullanıcıyı tamamen yönetebilir mi? (Update/Delete)*
   */
  actorCanManageTargetUser(targetUser: PriorityAndClinicId): boolean {
    if (!this.isTargetInActorsManagedClinic(targetUser.clinicId)) {
      return false;
    }
    return this.actorHasHigherPriorityThanTarget(targetUser.priority);
  }

  /**
   * Kullanıcıyı silebilir mi?
   */
  actorCanDeleteTargetUser(
    targetUser: PriorityAndClinicId & { id: string }
  ): boolean {
    if (this.isSelf(targetUser.id)) {
      return false;
    }
    return this.actorCanManageTargetUser(targetUser);
  }

  //? ==========================================
  //? BUSINESS LOGIC (Main Policy Methods)
  //? ==========================================

  /**
   * Kullanıcının rolünü değiştirebilir mi?
   *
   * NOT: Hem targetUser.role hem newRole.priority gerekli
   */
  actorCanChangeTargetUserRole(
    targetUser: PriorityAndClinicId,
    newRolePriority: number
  ): boolean {
    if (!this.actorCanManageTargetUser(targetUser)) {
      return false;
    }
    return this.actorHasHigherPriorityThanTarget(newRolePriority);
  }

  /**
   * kullanıcı geri dönüş grupları
   */

  getSerializationOptions(
    targetUserId: string,
    targetUserClinicId: string | null | undefined
  ) {
    const isSameClinic = this.isTargetInActorsSameClinic(targetUserClinicId);
    const isManager = this.isTargetInActorsManagedClinic(targetUserClinicId);
    const isSelf = this.isSelf(targetUserId);
    const isAdmin = this.isSystemAdmin();

    const groups: string[] = [];

    if (isSelf) groups.push(DATA_OWNER);
    if (isManager) groups.push(MANAGEMENT, FINANCIAL);
    if (isSameClinic) groups.push(INTERNAL);
    if (isAdmin) groups.push(ADMIN);

    return {
      isGroupActive: isSameClinic || isSelf || isManager || isAdmin,
      groups,
    };
  }

  /**
   * for debug
   */
  getActorSummary() {
    return {
      userId: this.actor.userId,
      roleId: this.actor.roleId,
      roleName: this.actor.role?.name,
      roleSlug: this.actor.role?.slug,
      priority: this.actorPriority,
      capabilities: this.actorCapabilities,
      isSystemAdmin: this.isSystemAdmin(),
    };
  }

  private getTargetPriority(
    target: Priority | number | undefined | null | string
  ): Priority {
    // İmza `Priority` kabul ediyordu ama onu karşılayan dal yoktu: VO tüm
    // kontrollerden düşüp `priorityNumber = 0` ile devam ediyor, `Priority`
    // şeması 1..100 aralığı istediği için de InvalidPriorityException fırlıyordu.
    // `update-user-by-staff` hedef kullanıcının rol önceliğini VO olarak geçirdiği
    // için bu uç fiilen hiç çalışmıyordu.
    if (target instanceof Priority) return target;

    let priorityNumber: number | undefined;
    if (!target) {
      priorityNumber = 0;
    }

    if (typeof target === 'number') {
      priorityNumber = target;
    }

    const hasPriority = isHasPriority(target);

    if (hasPriority) {
      priorityNumber = target?.role?.priority
        ? target?.role?.priority
        : target.priority;
    }

    priorityNumber = priorityNumber || 0;
    return Priority.create(priorityNumber).orThrow();
  }
}

function isHasPriority(param: unknown): param is HasPriority {
  if (param === null || typeof param !== 'object') return false;

  if (!('priority' in param)) return false;

  return param.priority instanceof Priority;
}
