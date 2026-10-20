import { ActorContext } from '@common/interfaces';
import { ClinicPolicy } from '@modules/organization/clinic/application/policies';
import { ExecutionSource } from '../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { SerializationOptionsResponse } from '@common/interfaces/serialization-policy.interface';
import {
  ProjectResponseGroup,
  ProjectResponseGroups,
} from '@modules/organization/project/domain/contracts';

/**
 * Proje yönetimi staff policy'si.
 *
 * Üç kademe: (1) görüntüleme ve kendi görevini ilerletme aynı klinik personeline
 * açıktır, (2) proje/aşama/görev tanımlama ve kaynak tahsisi klinik yöneticisi
 * ister, (3) bütçe ve maliyet ayrıca finans yetkisi ister — proje harcaması
 * ticari bir veridir ve panoyu gören herkes görmemelidir.
 */
export class ProjectPolicy extends ClinicPolicy {
  constructor(actor: ActorContext, source: ExecutionSource) {
    super(actor, source);
  }

  /** Proje/pano görüntüleme + kendi görevini ilerletme (aynı klinik personeli). */
  canAccessClinicProjects(clinicId: string | undefined | null): boolean {
    return this.actorCanAccessTargetClinic(clinicId ?? undefined);
  }

  /** Proje/aşama/görev tanımlama, durum değiştirme, kaynak tahsisi (yönetici). */
  canManageClinicProjects(clinicId: string | undefined | null): boolean {
    return this.actorCanManageTargetClinic(clinicId);
  }

  override getSerializationOptions(payload: {
    clinicId: string | undefined | null;
  }): SerializationOptionsResponse<ProjectResponseGroup> {
    const canAccess = this.canAccessClinicProjects(payload.clinicId);
    const isManager = this.actorCanManageTargetClinic(payload.clinicId);
    const isSystem = this.isSystem();

    const { ADMIN, INTERNAL, FINANCIAL, MANAGEMENT } = ProjectResponseGroups;

    const groups: ProjectResponseGroup[] = [];

    if (canAccess) groups.push(INTERNAL, FINANCIAL);
    if (isManager) groups.push(MANAGEMENT);
    if (isSystem) groups.push(ADMIN);

    return {
      isGroupActive: canAccess || isManager || isSystem,
      groups,
    };
  }
}
