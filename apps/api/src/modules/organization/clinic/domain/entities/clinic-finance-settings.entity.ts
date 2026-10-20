import { Decimal } from 'decimal.js';
import { ClinicFinanceSettings as IClinicFinanceSettings } from '@shared';
import { Currency } from '@src/domain/value-objects/currency.vo';
import { VatRate } from '@src/domain/value-objects/vat-rate.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { Guard } from '@common/domain/guards';
import { ClinicBusinessTypeLockedException } from '@modules/organization/clinic/domain/exceptions/clinic-finance-settings.exceptions';
import {
  ChangeBusinessTypeProps,
  CreateClinicFinanceSettingsProps,
} from '@modules/organization/clinic/domain/contracts/clinic-finance-settings';
import {
  RoundingDirectionSchema,
  RoundingDirectionType as RoundingDirection,
} from '@input-type-schemas/RoundingDirectionSchema';
import {
  PayoutTriggerSchema,
  PayoutTriggerType as PayoutTrigger,
} from '@input-type-schemas/PayoutTriggerSchema';
import { BusinessTypeType as BusinessType } from '@input-type-schemas/BusinessTypeSchema';
import { UUID } from '@src/domain/value-objects/uuid.vo';

interface FinanceSettingsInvariants {
  maxNegativeBalanceAmount: Decimal;
  maxInstallmentCount: number;
  fiscalYearStartMonth: number;
  maxDiscountPercent: Decimal;
}

/**
 * Kliniğin finansal davranış ayarları (1:1 satellite). `defaultCurrency` defterin
 * fonksiyonel para birimidir — muhasebe raporları ve posting bu birim üzerinden çalışır.
 * Para/oran alanları VO ile zırhlıdır; constructor persisted veriyi `fromTrusted` ile
 * yeniden kurar, `create` ise girişleri doğrular.
 */
export class ClinicFinanceSettings {
  constructor(data: IClinicFinanceSettings) {
    this._id = UUID.fromTrusted(data.id);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._defaultCurrency = Currency.fromTrusted(data.defaultCurrency);
    this._roundingType = data.roundingType;
    this._providerPayoutTrigger = data.providerPayoutTrigger;
    this._invoicePrefix = data.invoicePrefix;
    this._autoCreateInvoice = data.autoCreateInvoice;
    this._autoSendDebtReminder = data.autoSendDebtReminder;
    this._defaultVatRate = VatRate.fromTrusted(data.defaultVatRate);
    this._useCostTracking = data.useCostTracking;
    this._allowNegativeBalance = data.allowNegativeBalance;
    this._maxNegativeBalanceAmount = new Decimal(data.maxNegativeBalanceAmount);
    this._maxInstallmentCount = data.maxInstallmentCount;
    this._maxDiscountPercent = new Decimal(data.maxDiscountPercent);
    this._isEInvoiceActive = data.isEInvoiceActive;
    this._fiscalYearStartMonth = data.fiscalYearStartMonth;
    this._businessType = data.businessType;
    this._updatedAt = data.updatedAt;
  }

  /** Girişlerin iş kuralı barikatı — create sırasında koşulur. */
  private static get businessRulesValidator() {
    return {
      create: (input: FinanceSettingsInvariants) => {
        const monthInvalid =
          input.fiscalYearStartMonth < 1 || input.fiscalYearStartMonth > 12;
        const installmentInvalid = input.maxInstallmentCount < 1;
        const negativeLimitInvalid = input.maxNegativeBalanceAmount.isNeg();
        const discountLimitInvalid =
          input.maxDiscountPercent.isNeg() ||
          input.maxDiscountPercent.greaterThan(100);
        const isInvalid =
          monthInvalid ||
          installmentInvalid ||
          negativeLimitInvalid ||
          discountLimitInvalid;

        return {
          isValid: !isInvalid,
          orThrow: () => {
            if (monthInvalid) {
              throw new Error('Mali yıl başlangıç ayı 1-12 aralığında olmalı.');
            }
            if (installmentInvalid) {
              throw new Error('Maksimum taksit sayısı en az 1 olmalı.');
            }
            if (negativeLimitInvalid) {
              throw new Error('Maksimum borçlanma limiti negatif olamaz.');
            }
            if (discountLimitInvalid) {
              throw new Error('İndirim tavanı 0-100 aralığında olmalı.');
            }
          },
        };
      },
    };
  }

  private _id: UUID;

  get id(): UUID {
    return this._id;
  }

  private _clinicId: UUID;

  get clinicId(): UUID {
    return this._clinicId;
  }

  private _defaultCurrency: Currency;

  get defaultCurrency(): Currency {
    return this._defaultCurrency;
  }

  private _roundingType: RoundingDirection;

  /** Küsürat yuvarlama yönü. */
  get roundingType(): RoundingDirection {
    return this._roundingType;
  }

  private _providerPayoutTrigger: PayoutTrigger;

  /** Hekim hakedişi ne zaman tetiklenir (ödemede mi, tedavi tamamlanınca mı). */
  get providerPayoutTrigger(): PayoutTrigger {
    return this._providerPayoutTrigger;
  }

  private _invoicePrefix: string;

  /** Fatura numarası ön eki (ör. "KLN"). */
  get invoicePrefix(): string {
    return this._invoicePrefix;
  }

  private _autoCreateInvoice: boolean;

  get autoCreateInvoice(): boolean {
    return this._autoCreateInvoice;
  }

  private _autoSendDebtReminder: boolean;

  /** Borç hatırlatma mesajları otomatik gönderilsin mi? */
  get autoSendDebtReminder(): boolean {
    return this._autoSendDebtReminder;
  }

  private _defaultVatRate: VatRate;

  get defaultVatRate(): VatRate {
    return this._defaultVatRate;
  }

  private _useCostTracking: boolean;

  get useCostTracking(): boolean {
    return this._useCostTracking;
  }

  private _allowNegativeBalance: boolean;

  get allowNegativeBalance(): boolean {
    return this._allowNegativeBalance;
  }

  private _maxNegativeBalanceAmount: Decimal;

  /** İzin verilen maksimum borçlanma (negatif bakiye) limiti (fonksiyonel para birimi). */
  get maxNegativeBalanceAmount(): Decimal {
    return this._maxNegativeBalanceAmount;
  }

  /**
   * İşlem satırında verilebilecek maksimum indirim yüzdesi. Personel için mutlak
   * sınırdır; yalnız kliniği yöneten aktör aşabilir (bkz. TreatmentCharge).
   */
  private _maxDiscountPercent: Decimal;

  get maxDiscountPercent(): Decimal {
    return this._maxDiscountPercent;
  }

  private _maxInstallmentCount: number;

  get maxInstallmentCount(): number {
    return this._maxInstallmentCount;
  }

  private _isEInvoiceActive: boolean;

  /** E-Fatura/E-Arşiv entegrasyonu aktif mi? */
  get isEInvoiceActive(): boolean {
    return this._isEInvoiceActive;
  }

  private _fiscalYearStartMonth: number;

  get fiscalYearStartMonth(): number {
    return this._fiscalYearStartMonth;
  }

  private _businessType: BusinessType | null;

  /**
   * İşletme biçimi (şirket / şahıs) — yıl sonu devrinin hedefini belirler. Kullanıcı seçer;
   * `null` yalnız bu alandan önce açılmış klinikler içindir.
   */
  get businessType(): BusinessType | null {
    return this._businessType;
  }

  private _updatedAt: Date;

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** Durum sorguları (Guard tabanlı). */
  public get validate() {
    return {
      eInvoice: {
        isActive: Guard.monitor(
          this.isEInvoiceActive,
          this.isEInvoiceActive,
          () => new Error('E-Fatura entegrasyonu aktif değil.')
        ),
      },
      negativeBalance: {
        isAllowed: Guard.monitor(
          this.allowNegativeBalance,
          this.allowNegativeBalance,
          () => new Error('Klinik ayarında negatif bakiyeye izin verilmiyor.')
        ),
      },
    };
  }

  /**
   * İşletme biçimini değiştirir. Kapanmış mali yıl varsa DEĞİŞTİRME kararı muhasebecinindir (hesap
   * planı ve geçmiş devir fişleri eski biçime göre yazıldı): çağıran `hasClosedPeriod` bilgisini
   * verir. İlk seçim (`null` → değer) kapanmış yıl olsa da serbesttir; o yıllarda devir atlanmıştı.
   */
  public changeBusinessType(props: ChangeBusinessTypeProps): void {
    if (this._businessType === props.businessType) return;
    if (this._businessType !== null && props.hasClosedPeriod) {
      throw new ClinicBusinessTypeLockedException();
    }
    this._businessType = props.businessType;
    this._updatedAt = DateTimeManager.create();
  }

  /** Klinik için DB default'larıyla birebir varsayılan finans ayarları. */
  public static createDefault(clinicId: string): ClinicFinanceSettings {
    return ClinicFinanceSettings.create({ clinicId });
  }

  public static create(
    props: CreateClinicFinanceSettingsProps
  ): ClinicFinanceSettings {
    const currency = Currency.create(
      props.defaultCurrency ?? Currency.enum.TRY
    ).orThrow();
    const vatRate = VatRate.create(props.defaultVatRate ?? 20).orThrow();

    const maxNegativeBalanceAmount =
      props.maxNegativeBalanceAmount ?? new Decimal(0);
    const maxInstallmentCount = props.maxInstallmentCount ?? 12;
    const fiscalYearStartMonth = props.fiscalYearStartMonth ?? 1;
    // Varsayılan 0: indirim açıkça tanımlanana kadar verilemez (güvenli taraf).
    const maxDiscountPercent = props.maxDiscountPercent ?? new Decimal(0);

    ClinicFinanceSettings.businessRulesValidator
      .create({
        maxNegativeBalanceAmount,
        maxInstallmentCount,
        fiscalYearStartMonth,
        maxDiscountPercent,
      })
      .orThrow();

    return new ClinicFinanceSettings({
      id: UUID.createOrGenerate(props.id).value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      defaultCurrency: currency.value,
      roundingType: props.roundingType ?? RoundingDirectionSchema.enum.NONE,
      providerPayoutTrigger:
        props.providerPayoutTrigger ?? PayoutTriggerSchema.enum.ON_PAYMENT,
      invoicePrefix: props.invoicePrefix ?? 'KLN',
      autoCreateInvoice: props.autoCreateInvoice ?? true,
      autoSendDebtReminder: props.autoSendDebtReminder ?? false,
      defaultVatRate: vatRate.value,
      useCostTracking: props.useCostTracking ?? true,
      allowNegativeBalance: props.allowNegativeBalance ?? false,
      maxNegativeBalanceAmount,
      maxInstallmentCount,
      maxDiscountPercent,
      isEInvoiceActive: props.isEInvoiceActive ?? false,
      fiscalYearStartMonth,
      businessType: props.businessType ?? null,
      updatedAt: DateTimeManager.create(),
    });
  }

  toPersistence(): IClinicFinanceSettings {
    return {
      id: this.id.value,
      clinicId: this.clinicId.value,
      defaultCurrency: this.defaultCurrency.value,
      roundingType: this.roundingType,
      providerPayoutTrigger: this.providerPayoutTrigger,
      invoicePrefix: this.invoicePrefix,
      autoCreateInvoice: this.autoCreateInvoice,
      autoSendDebtReminder: this.autoSendDebtReminder,
      defaultVatRate: this.defaultVatRate.value,
      useCostTracking: this.useCostTracking,
      allowNegativeBalance: this.allowNegativeBalance,
      maxNegativeBalanceAmount: this.maxNegativeBalanceAmount,
      maxInstallmentCount: this.maxInstallmentCount,
      maxDiscountPercent: this.maxDiscountPercent,
      isEInvoiceActive: this.isEInvoiceActive,
      fiscalYearStartMonth: this.fiscalYearStartMonth,
      businessType: this.businessType,
      updatedAt: this.updatedAt,
    };
  }
}
