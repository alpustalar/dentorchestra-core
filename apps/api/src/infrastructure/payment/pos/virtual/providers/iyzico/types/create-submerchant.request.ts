export type SubMerchantType =
  | 'PERSONAL'
  | 'PRIVATE_COMPANY'
  | 'LIMITED_OR_JOINT_STOCK_COMPANY';

export interface CreateSubMerchantRequest {
  conversationId: string;
  subMerchantExternalId: string;
  subMerchantType: SubMerchantType;
  address: string;
  taxOffice?: string;
  legalCompanyTitle?: string;
  email: string;
  gsmNumber: string;
  name: string;
  iban: string;
  identityNumber: string;
}

export interface UpdateSubMerchantRequest extends CreateSubMerchantRequest {
  subMerchantKey: string;
}

export interface SubMerchantResult {
  subMerchantKey: string;
}

/**
 * Alt üye işyerini **dış kimlikten** (bizim `clinicId`) sorgular.
 *
 * Kurtarma yolu için gerekli: alt üye işyeri iyzico'da açıldıktan sonra yerel
 * yazma başarısız olursa, ikinci deneme `create` ile "zaten var" hatası alır ve
 * klinik kalıcı olarak kurulamaz hale gelir. `retrieve` ile anahtar geri
 * okunabildiği için akış idempotent olur.
 */
export interface RetrieveSubMerchantRequest {
  conversationId: string;
  subMerchantExternalId: string;
}
