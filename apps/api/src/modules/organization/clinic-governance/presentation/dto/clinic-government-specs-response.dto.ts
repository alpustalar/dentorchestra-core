import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '@common/constants/response-groups.constant';
import { ClinicLegalTypeType as ClinicLegalType } from '@input-type-schemas/ClinicLegalTypeSchema';

const { INTERNAL, MANAGEMENT, ADMIN } = ResponseGroups;

export class ClinicGovernmentSpecsResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string;

  // --- Temel Regülasyon ve Kimlik Bilgileri (İç Operasyon ve Üst Roller) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  legalType: ClinicLegalType;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  healthFacilityCode: string;

  // --- Finansal ve Vergi Verileri (Sadece Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => String)
  companyTaxNumber: string | null;

  // --- Kritik Regülasyon Sırları ---
  // Şifrenin KENDİSİ yanıtta yok; yalnız yapılandırılmış olup olmadığı. Grup
  // kısıtı ("sadece ADMIN") yanlış yere konmuş bir güvenceydi: gruba giren
  // aktör için hâlâ düz metin bir şifre ve serileştirme interceptor'ı
  // `@Serialize` yoksa fail-open çalışıyor.
  @Expose({ groups: [ADMIN] })
  ussPasswordConfigured: boolean;

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
