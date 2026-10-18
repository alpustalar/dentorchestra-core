import { QueryResponse } from '@shared/common/response/response.interface';
import { ClinicLegalTypeType as ClinicLegalType } from '@input-type-schemas/ClinicLegalTypeSchema';

export interface ClinicGovernmentSpecsView {
  clinicId: string;
  healthFacilityCode: string;
  /**
   * USS **şifresinin kendisi değil**, yapılandırılmış olup olmadığı.
   *
   * Şifre bir dönem bu okuma modelinde ve yanıt DTO'sunda (ADMIN grubu) düz
   * metin olarak taşınıyordu — yani canlı bir uçta kliniğin kurum entegrasyon
   * şifresi HTTP üzerinden dönüyordu. Ekranın ihtiyacı "ayar tamam mı"
   * sorusunun cevabı; şifrenin değeri yalnız entegrasyonu çağıran yolun
   * (command tarafı) işidir.
   */
  ussPasswordConfigured: boolean;
  companyTaxNumber: string | null;
  legalType: ClinicLegalType;
  createdAt: Date;
  updatedAt: Date;
}

/** Kayıt yoksa data null döner. */
export type GetClinicGovernmentSpecsResponse =
  QueryResponse<ClinicGovernmentSpecsView | null>;
