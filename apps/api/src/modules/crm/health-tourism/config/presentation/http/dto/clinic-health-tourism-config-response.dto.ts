import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../../packages/shared/common/constants/response-groups.constant';

const { INTERNAL, MANAGEMENT, ADMIN } = ResponseGroups;

export class ClinicHealthTourismConfigResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string;
  @Expose() organizationId: string;
  @Expose() isEnabled: boolean;
  @Expose() defaultCurrency: string;

  // --- Operasyonel Havaalanı Kodu (İç Ekip, Yönetici ve Admin Görebilir) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  airportIata: string | null;

  // --- Tedarikçi Entegrasyon Kodları (Sadece Yönetici, İç Operasyon ve Admin) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  destinationCode: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  nearbyHotelCodes: string[];

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  clinicLocationType: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  clinicLocationCode: string | null;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  pickupAddress: string | null;

  // Satış komisyonu (serviceFeePercent) burada YOK — platform geliridir, klinik göremez/ayarlayamaz.
  // Oran platform-global env ayarından (HEALTH_TOURISM_SERVICE_FEE_PERCENT) uygulanır.

  // --- Audit Zaman Damgaları (Sadece Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
