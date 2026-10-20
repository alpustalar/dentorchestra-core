import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';
import { RoundingDirectionType as RoundingDirection } from '@input-type-schemas/RoundingDirectionSchema';
import { PayoutTriggerType as PayoutTrigger } from '@input-type-schemas/PayoutTriggerSchema';

const { INTERNAL, MANAGEMENT, ADMIN } = ResponseGroups;

export class ClinicFinanceSettingsResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string;

  // --- Temel Finansal Kimlik ve Para Birimi Bilgileri (Herkes Görebilir) ---
  @Expose() defaultCurrency: string;
  @Expose() defaultVatRate: number;

  // --- Operasyonel Yuvarlama ve Muhasebe Akışı Kuralları (İç Operasyon ve Üst Roller) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  roundingType: RoundingDirection;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  providerPayoutTrigger: PayoutTrigger;

  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  fiscalYearStartMonth: number;

  // --- Fatura ve Belge Numaralandırma Şablonları (İç Operasyon ve Üst Roller) ---
  @Expose({ groups: [INTERNAL, MANAGEMENT, ADMIN] })
  invoicePrefix: string;

  // --- Otomasyon ve Hatırlatıcı Davranış Bayrakları (Sadece Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  autoCreateInvoice: boolean;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  autoSendDebtReminder: boolean;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  useCostTracking: boolean;

  // --- Risk ve Limit Yönetimi (Sadece Yönetim ve Admin) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  allowNegativeBalance: boolean;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => String)
  maxNegativeBalanceAmount: string;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  maxInstallmentCount: number;

  /** İşlem satırında verilebilecek maksimum indirim yüzdesi. */
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => String)
  maxDiscountPercent: string;

  // --- Regülasyon ve Resmi Entegrasyon Durumları (Kesinlikle Sadece Admin) ---
  @Expose({ groups: [ADMIN] })
  isEInvoiceActive: boolean;

  // --- Audit Zaman Damgaları ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
