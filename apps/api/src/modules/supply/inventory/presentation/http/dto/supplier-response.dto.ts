import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';

const { MANAGEMENT, ADMIN, FINANCIAL } = ResponseGroups;

export class SupplierResponseDto {
  // --- Çekirdek Kimlik Bilgileri ---
  @Expose() id: string;
  @Expose() name: string; // Şirket / Unvan adı
  @Expose() isActive: boolean;

  // --- İletişim Parametreleri ---
  @Expose() contactName: string | null; // Yetkili kişi adı
  @Expose() phone: string | null;
  @Expose() email: string | null;
  @Expose() address: string | null;

  // --- Finansal & Kurumsal Bilgiler (Rol Korumalı) ---
  @Expose({ groups: [MANAGEMENT, FINANCIAL, ADMIN] })
  taxNumber: string | null;

  @Expose({ groups: [MANAGEMENT, FINANCIAL, ADMIN] })
  taxOffice: string | null;

  // --- Kapsam & İzolasyon İzleri ---
  @Expose() clinicId: string;

  @Expose({ groups: [ADMIN] })
  organizationId: string;

  // --- Audit Zaman Damgaları ---
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @Expose()
  @Type(() => Date)
  updatedAt: Date;
}
