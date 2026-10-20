import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';

const { ADMIN } = ResponseGroups;

export class ProductCategoryResponseDto {
  // --- Çekirdek Kimlik Bilgileri ---
  @Expose() id: string;
  @Expose() name: string;

  // --- Hiyerarşik Yapı Bağlantısı ---
  @Expose() parentId: string | null;

  // --- İzolasyon ve Kapsam Bilgileri ---
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
