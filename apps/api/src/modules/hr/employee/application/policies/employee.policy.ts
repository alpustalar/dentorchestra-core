import { ActorContext } from '@common/interfaces';
import { ClinicPolicy } from '@modules/organization/clinic/application/policies';
import { ExecutionSource } from '../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { SerializationOptionsResponse } from '@common/interfaces/serialization-policy.interface';
import {
  EmployeeResponseGroup,
  EmployeeResponseGroups,
} from '@modules/hr/employee/domain/contracts/employee.contracts';

/**
 * İK (personel + izin) staff policy'si. Klinik erişim yardımcılarını ClinicPolicy'den
 * miras alır. Personel kayıtları hassastır (nationalId, maaş) — okuma aynı klinik,
 * yazma (işe alma/fesih/sözleşme/izin onayı) klinik yöneticisi ister.
 */
export class EmployeePolicy extends ClinicPolicy {
  constructor(actor: ActorContext, source: ExecutionSource) {
    super(actor, source);
  }

  /**
   * Aktör bu kliniğin personel kayıtlarını görüntüleyebilir mi? (liste/detay/izin okuma)
   */
  canAccessClinicHr(clinicId: string | undefined): boolean {
    return this.isSystem() || this.actorCanAccessTargetClinic(clinicId);
  }

  /**
   * Aktör bu kliniğin personelini yönetebilir mi?
   * (işe alma, güncelleme, fesih, sözleşme, izin onay/ret)
   */
  canManageClinicHr(clinicId: string | undefined | null): boolean {
    return this.isSystem() || this.actorCanManageTargetClinic(clinicId);
  }

  /**
   * Personel cevap alanlarının hangi gruplarla serileştirileceğini belirler.
   * - INTERNAL: aynı klinik personeli (temel demografik/iletişim)
   * - MANAGEMENT + FINANCIAL: kliniği yöneten aktör (nationalId, maaş/sözleşme)
   * - ADMIN: sistem (tüm alanlar)
   */
  getSerializationOptions(payload: {
    clinicId: string;
  }): SerializationOptionsResponse<EmployeeResponseGroup> {
    const isSameClinic = this.actorCanAccessTargetClinic(payload.clinicId);
    const isManager = this.actorCanManageTargetClinic(payload.clinicId);
    const isSystem = this.isSystem();

    const { ADMIN, INTERNAL, FINANCIAL, MANAGEMENT } = EmployeeResponseGroups;

    const groups: EmployeeResponseGroup[] = [];

    if (isSameClinic) groups.push(INTERNAL, FINANCIAL);
    if (isManager) groups.push(MANAGEMENT);
    if (isSystem) groups.push(ADMIN);

    return {
      isGroupActive: isSameClinic || isManager || isSystem,
      groups,
    };
  }
}
