import { Expose } from 'class-transformer';
import { GlobalStatusType as GlobalStatus } from '@input-type-schemas/GlobalStatusSchema';

/**
 * Yetkili klinik dizini (organizasyon seçici, grafik serisi etiketleri)
 * için minimal, grup-bağımsız DTO. Erişim zaten handler'da organizasyon
 * kapsamı kontrolüyle verildiği için satır başına ek alan gizleme gerekmez.
 */
export class ClinicDirectoryResponseDto {
  @Expose() id: string;
  @Expose() organizationId: string;
  @Expose() name: string;
  @Expose() slug: string;
  @Expose() timezone: string;
  @Expose() status: GlobalStatus;
}
