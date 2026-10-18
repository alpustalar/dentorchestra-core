import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '@common/constants/response-groups.constant';
import { JsonValueType } from '@input-type-schemas/JsonValueSchema';
import { IyzicoTransactionStatusType as IyzicoTransactionStatus } from '@input-type-schemas/IyzicoTransactionStatusSchema';

const { INTERNAL, MANAGEMENT, FINANCIAL, ADMIN } = ResponseGroups;

export class IyzicoTransactionResponseDto {
  @Expose() id: string;
  @Expose() installmentId: string;

  // --- Genel Durum ve Takip Bilgileri (İç Operasyon ve Üst Roller) ---
  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  conversationId: string;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  status: IyzicoTransactionStatus;

  // --- Gateway Referansları (Sadece Finans, Yönetim ve Admin) ---
  // `token` BİLİNÇLİ olarak yok: §73'teki callback bağının yerel kanıtı bu
  // kolondur; yanıtta taşımak kanıtı okunabilir kılar.

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  iyzicoPaymentId: string | null;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  iyzicoPaymentTransactionId: string | null;

  // --- Hata Yönetim Alanları (Sadece Finans, Yönetim ve Admin) ---
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  errorCode: string | null;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  errorMessage: string | null;

  /**
   * Gateway ham yanıtı (yalnız yönetim/admin).
   *
   * Bu alan bir dönem **non-3DS çekim yapmaya yeten** kart saklama
   * token'larını (`cardToken` + `cardUserKey`) tarayıcıya kadar taşıyordu.
   * Artık taşımıyor ama güvence **burada değil, yazma sınırında**:
   * `IyzicoTransaction` blob'u `redactSensitive` ile maskeleyerek saklıyor.
   * Burada süzmek yalnız bu okuyucuyu korurdu — DB'ye bakan operatör, yedek ve
   * ileride eklenecek raporlar korumasız kalırdı.
   */
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  rawResponse: JsonValueType | null;

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
