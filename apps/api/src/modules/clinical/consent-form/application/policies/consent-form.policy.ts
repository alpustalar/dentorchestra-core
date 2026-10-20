import { ActorContext } from '@common/interfaces';
import { ClinicPolicy } from '@modules/organization/clinic/application/policies';
import { ExecutionSource } from '../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { SerializationOptionsResponse } from '@common/interfaces/serialization-policy.interface';
import {
  ConsentFormResponseGroup,
  ConsentFormResponseGroups,
} from '@modules/clinical/consent-form/domain/contracts';

/**
 * Onam formu (template + submission) staff policy'si. Template CRUD klinik yöneticisi
 * ister (hassas/legal metin); tablette imza akışını başlatma/tamamlama ve submission
 * görüntüleme aynı-klinik personeline açıktır (facilitasyon, yönetim kararı değil).
 */
export class ConsentFormPolicy extends ClinicPolicy {
  constructor(actor: ActorContext, source: ExecutionSource) {
    super(actor, source);
  }

  /** Şablon oluşturma/güncelleme/arşivleme — klinik yöneticisi. */
  canManageConsentTemplates(clinicId: string | undefined | null): boolean {
    return this.isSystem() || this.actorCanManageTargetClinic(clinicId);
  }

  /** Şablon listeleme/görüntüleme — aynı klinik personeli. */
  canAccessConsentTemplates(clinicId: string | undefined): boolean {
    return this.isSystem() || this.actorCanAccessTargetClinic(clinicId);
  }

  /** Tablet imza akışını başlatma/tamamlama — aynı klinik personeli yeterli. */
  canSignConsentForm(clinicId: string | undefined): boolean {
    return this.isSystem() || this.actorCanAccessTargetClinic(clinicId);
  }

  /** İmzalanmış onam formlarını görüntüleme — aynı klinik personeli. */
  canAccessConsentSubmissions(clinicId: string | undefined): boolean {
    return this.isSystem() || this.actorCanAccessTargetClinic(clinicId);
  }

  /**
   * Onam cevaplarının alan görünürlüğü.
   * - INTERNAL: aynı klinik personeli (şablon metni, imza kaydının varlığı)
   * - MANAGEMENT: kliniği yöneten aktör (imza görseli, denetim izleri)
   * - ADMIN: sistem
   *
   * İmza görseli (`signatureImage`) hukuki delildir; listeleme yapan her personele
   * değil yalnız yönetime açılır. FINANCIAL grubu bu modülde anlamsız — üretilmez.
   */
  override getSerializationOptions(payload: {
    clinicId: string | undefined;
  }): SerializationOptionsResponse<ConsentFormResponseGroup> {
    const isSameClinic = this.actorCanAccessTargetClinic(payload.clinicId);
    const isManager = this.actorCanManageTargetClinic(payload.clinicId);
    const isSystem = this.isSystem();

    const { ADMIN, INTERNAL, MANAGEMENT } = ConsentFormResponseGroups;

    const groups: ConsentFormResponseGroup[] = [];

    if (isSameClinic) groups.push(INTERNAL);
    if (isManager) groups.push(MANAGEMENT);
    if (isSystem) groups.push(ADMIN, MANAGEMENT, INTERNAL);

    return {
      isGroupActive: isSameClinic || isManager || isSystem,
      groups,
    };
  }
}
