import { Expose, Type } from 'class-transformer';
import { PatientPackageStatus } from '@shared';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';

const { INTERNAL, MANAGEMENT, DATA_OWNER, ADMIN } = ResponseGroups;

const OPS_SHARED_GROUPS = { groups: [ADMIN, DATA_OWNER, INTERNAL, MANAGEMENT] };

const MANAGEMENT_GROUPS = { groups: [ADMIN, MANAGEMENT] };

export class PatientTreatmentPackageResponseDto {
  @Expose() id: string;
  @Expose() patientId: string;
  @Expose() packageId: string;
  @Expose() providerId: string;
  @Expose() status: PatientPackageStatus;

  // --- Paket Geçerlilik Tarihleri (Herkese Açık) ---
  @Expose()
  @Type(() => Date)
  startDate: Date;

  @Expose()
  @Type(() => Date)
  endDate: Date;

  // --- Kullanım Sayaçları (Hasta Kendisi, Klinik İçi ve Yönetim Görebilir) ---
  @Expose(OPS_SHARED_GROUPS)
  usedExaminationCount: number;

  @Expose(OPS_SHARED_GROUPS)
  usedControlCount: number;

  // --- Klinik Notlar (Sadece Klinik İçi Personel, Yönetim ve Veri Sahibi) ---
  @Expose(OPS_SHARED_GROUPS)
  notes: string | null;

  // --- Finansal Bağlantı ID'si (Sadece Finans ve Yönetim Görebilir, Hasta Göremez) ---
  @Expose({ groups: [ADMIN, INTERNAL, MANAGEMENT] })
  paymentId: string | null;

  // --- Audit Zaman Damgaları ---
  @Expose(MANAGEMENT_GROUPS)
  @Type(() => Date)
  createdAt: Date;

  @Expose(MANAGEMENT_GROUPS)
  @Type(() => Date)
  updatedAt: Date;
}
