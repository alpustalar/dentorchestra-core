import { Expose } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';

const { INTERNAL, MANAGEMENT, ADMIN } = ResponseGroups;

export class ClinicAvailabilityResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string;

  // --- Temel Takvim ve Çalışma Gün Bilgisi (Herkes Görebilir) ---
  @Expose() dayOfWeek: number;
  @Expose() isClosed: boolean;

  // --- Operasyonel Saat Aralığı Dakikaları (İç Operasyon ve Üst Roller) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  startMinute: number;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  endMinute: number;
}
