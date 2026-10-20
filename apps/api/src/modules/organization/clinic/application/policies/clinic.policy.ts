import { Injectable } from '@nestjs/common';
import { BasePolicy } from '@modules/platform/policy/staff/application/base.policy';
import { OrganizationPolicy } from '@modules/organization/organization/application/policies/organization.policy';
import { SerializationOptionsResponse } from '@common/interfaces/serialization-policy.interface';
import {
  ResponseGroup,
  ResponseGroups,
} from '../../../../../../../../packages/shared/common/constants/response-groups.constant';

@Injectable()
export class ClinicPolicy extends BasePolicy {
  /**
   * Klinik kapsamı: aktör hedef kliniğe dokunabilir mi?
   *
   * Klinik-kapsamlı yazmalarda **tek** kapsam kontrolüdür. Koşul "klinik erişimi
   * VEYA organizasyon sahipliği": sahiplik ile `managedClinics` ayrışabiliyor —
   * `create-clinic` yeni kliniği kurucunun yönettikleri listesine bağlamaz,
   * dolayısıyla sahibi olduğu organizasyona sonradan açılan klinikte
   * `actorCanAccessTargetClinic` false döner. Sahiplik org seviyesinde bir
   * gerçektir; `managedClinics`'e denormalize edilirse zamanla kayar (devir,
   * admin'in açtığı şube).
   *
   * İkinci koşul bilerek `actorCanManageTargetOrganization` (SAHİPLİK) — org
   * ÜYELİĞİ (`actorCanAccessTargetOrganization`) olsaydı, aynı organizasyondaki
   * herhangi bir personel hiç ilgisi olmayan kardeş kliniğe yazabilirdi; klinik
   * seviyesindeki yalıtım tamamen kalkardı.
   *
   * `targetOrganizationId` **daima `TENANT_SCOPE_RESOLVER`'dan türetilmiş**
   * değer olmalıdır, DTO'dan gelen ham alan değil (resolver istemcinin
   * gönderdiğini kliniğe karşı doğrular).
   */
  actorCanAccessClinicOrOwnsOrganization(
    targetClinicId: string | undefined,
    targetOrganizationId: string
  ): boolean {
    if (this.actorCanAccessTargetClinic(targetClinicId)) return true;

    const organizationPolicy = new OrganizationPolicy(this.actor, this.source);

    return organizationPolicy.actorCanManageTargetOrganization(
      targetOrganizationId
    );
  }

  /**
   * Bir kliniği BAŞKASINA atayabilmek için gereken seviye.
   *
   * `actorCanAccessClinicOrOwnsOrganization`'ın "erişim" değil "yönetim" sürümü:
   * bir kliniğe erişebilmek onu başkasına dağıtabilmek anlamına gelmez. Yetki
   * devrinde ölçüt, aktörün o kliniği fiilen yönetiyor ya da kliniğin bağlı
   * olduğu organizasyona sahip olmasıdır.
   */
  actorCanManageClinicOrOwnsOrganization(
    targetClinicId: string | undefined,
    targetOrganizationId: string
  ): boolean {
    if (this.actorCanManageTargetClinic(targetClinicId)) return true;

    const organizationPolicy = new OrganizationPolicy(this.actor, this.source);

    return organizationPolicy.actorCanManageTargetOrganization(
      targetOrganizationId
    );
  }

  actorCanAccessTargetClinic(targetClinicId: string | undefined): boolean {
    if (this.actorCanManageTargetClinic(targetClinicId)) return true;
    if (!targetClinicId || !this.actor.clinicId) return false;
    return this.actor.clinicId === targetClinicId;
  }

  actorCanManageTargetClinic(
    targetClinicId: string | undefined | null
  ): boolean {
    if (!targetClinicId) return false;
    return !!this.actor.managedClinics?.some(
      (clinic) => clinic.id === targetClinicId
    );
  }

  getSerializationOptions(...args: unknown[]): SerializationOptionsResponse {
    const payload = (args[0] ?? {}) as { clinicId?: string };
    const isSameClinic = this.actorCanAccessTargetClinic(payload.clinicId);
    const isManager = this.actorCanManageTargetClinic(payload.clinicId);
    const isSystem = this.isSystem();

    const { ADMIN, INTERNAL } = ResponseGroups;

    const groups: ResponseGroup[] = [];

    if (isSameClinic) groups.push(INTERNAL);
    if (isSystem) groups.push(ADMIN);

    return {
      isGroupActive: isSameClinic || isManager || isSystem,
      groups,
    };
  }
}
