import { ActorContext } from '@common/interfaces';
import { ClinicPolicy } from '@modules/organization/clinic/application/policies';
import { ExecutionSource } from '../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { SerializationOptionsResponse } from '@common/interfaces/serialization-policy.interface';
import {
  PatientResponseGroup,
  PatientResponseGroups,
} from '@shared/modules/patients/constants';

export interface PatientScope {
  organizationId: string;
  clinicId?: string | null;
}

/**
 * Hasta kayıtları için staff policy'si. Hastalar organizasyon kapsamlıdır
 * (opsiyonel klinik); erişim yardımcılarını ClinicPolicy'den miras alır.
 * PII/tıbbi alanların görünürlüğünü serileştirme gruplarıyla belirler.
 */
export class PatientPolicy extends ClinicPolicy {
  constructor(actor: ActorContext, source: ExecutionSource) {
    super(actor, source);
  }

  /**
   * Aktör bu hastanın kaydına erişebilir mi?
   * Aynı organizasyon, hastanın kliniğini yöneten aktör veya sistem yöneticisi.
   */
  canAccessPatient(scope: PatientScope): boolean {
    if (this.actorCanAccessTargetClinic(scope?.clinicId ?? undefined))
      return true;
    return (
      !!scope.organizationId &&
      scope.organizationId === this.actor.organizationId
    );
  }

  /**
   * Aktör tıbbi (klinik) personel mi? Provider profili olan aktörler
   * hastanın tıbbi alanlarını (MEDICAL) görebilir.
   */
  isMedicalStaff(): boolean {
    return !!this.actor.providerId;
  }

  /**
   * Hasta cevap alanlarının hangi gruplarla serileştirileceğini belirler.
   * - INTERNAL: aynı klinik/organizasyon personeli (temel demografik/iletişim)
   * - MEDICAL: klinik personel (kan grubu, checkup, tıbbi notlar)
   * - MANAGEMENT + FINANCIAL: hastanın kliniğini yöneten aktör (bakiye, indirim)
   * - ADMIN: sistem yöneticisi (tüm alanlar)
   */
  getSerializationOptions(
    scope: PatientScope
  ): SerializationOptionsResponse<PatientResponseGroup> {
    const hasAccess = this.canAccessPatient(scope);
    const isManager = this.actorCanManageTargetClinic(scope.clinicId);
    const isSystem = this.isSystem();
    const isMedical = hasAccess && this.isMedicalStaff();

    const groups: PatientResponseGroup[] = [];

    if (hasAccess) groups.push(PatientResponseGroups.INTERNAL);
    if (isMedical) groups.push(PatientResponseGroups.MEDICAL);
    if (isManager) groups.push(PatientResponseGroups.MANAGEMENT);
    if (isSystem) groups.push(PatientResponseGroups.ADMIN);

    return {
      isGroupActive: hasAccess || isSystem,
      groups,
    };
  }
}
