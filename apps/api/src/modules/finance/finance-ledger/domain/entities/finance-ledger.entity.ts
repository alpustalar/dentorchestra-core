import {
  FinanceLedger as IFinanceLedger,
  LedgerStatusSchema,
} from '@shared/generated-zod';
import { LedgerCategoryType as LedgerCategory } from '@shared/generated-zod/inputTypeSchemas/LedgerCategorySchema';
import { LedgerTypeType as LedgerType } from '@shared/generated-zod/inputTypeSchemas/LedgerTypeSchema';
import { LedgerSourceType as LedgerSource } from '@shared/generated-zod/inputTypeSchemas/LedgerSourceSchema';
import { LedgerStatusType as LedgerStatus } from '@shared/generated-zod/inputTypeSchemas/LedgerStatusSchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { Money } from '@src/domain/value-objects/money.vo';
import { TaxSpecification } from '@modules/finance/shared/domain/value-objects/tax-specification.vo';
import { CreateFinanceLedgerProps } from '@modules/finance/finance-ledger/domain/contracts/finance-ledger';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Currency } from '@src/domain/value-objects/currency.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { Guard } from '@common/domain/guards';
import { ValidateOptionsType } from '@shared/common/validate-options/validate-options.type';
import { DefaultValidateOptions } from '@common/domain/constants/default-options.constant';
import { FinanceLedgerRules } from '@modules/finance/finance-ledger/domain/rules/finance-ledger.rules';
import {
  LedgerInvalidPrecisionException,
  LedgerInvalidStatusTransitionException,
} from '@modules/finance/finance-ledger/domain/exceptions/finance-ledger.exceptions';

export class FinanceLedgerEntity extends AggregateRoot {
  constructor(data: IFinanceLedger) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._patientId = UUID.create(data.patientId).instance ?? null;
    this._paymentId = UUID.create(data.paymentId).instance ?? null;
    this._installmentId = UUID.create(data.installmentId).instance ?? null;
    // Aktör kimliği ham string: `User.id` bir Firebase UID'dir (UUID değil).
    // UUID VO'sundan geçirmek, aktör damgası taşıyan her cari kaydını okunamaz
    // hale getirirdi.
    this._performedById = data.performedById;
    this._type = data.type;
    this._source = data.source;
    this._category = data.category;
    this._status = data.status;

    const netMoney = Money.fromTrusted(data.amount, data.currency);
    const taxMoney = Money.fromTrusted(data.taxAmount, data.currency);

    // Rehidrasyon: saklanmış kırılım doğrulanmadan kurulur. Okuma anında yeniden
    // yargılanırsa bir kuruşluk sapma kaydı okunamaz hâle getirir.
    this._taxSpecification = TaxSpecification.fromTrusted(
      netMoney,
      data.taxRate,
      taxMoney
    );

    this._description = data.description;
    this._documentNo = data.documentNo;
    this._entryDate = data.entryDate;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }
  private _taxSpecification: TaxSpecification;
  get taxSpecification(): TaxSpecification {
    return this._taxSpecification;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _patientId: UUID | null;
  get patientId(): UUID | null {
    return this._patientId;
  }

  private _paymentId: UUID | null;
  get paymentId(): UUID | null {
    return this._paymentId;
  }

  private _installmentId: UUID | null;
  get installmentId(): UUID | null {
    return this._installmentId;
  }

  private _performedById: string | null;
  get performedById(): string | null {
    return this._performedById;
  }

  private _type: LedgerType;
  get type(): LedgerType {
    return this._type;
  }

  private _source: LedgerSource;
  get source(): LedgerSource {
    return this._source;
  }

  private _category: LedgerCategory;
  get category(): LedgerCategory {
    return this._category;
  }

  private _status: LedgerStatus;
  get status(): LedgerStatus {
    return this._status;
  }

  get amount(): Money {
    return this.taxSpecification.netAmount;
  }

  get currency(): Currency {
    return Currency.fromTrusted(this.taxSpecification.netAmount.currency);
  }
  get taxRate(): number {
    return this.taxSpecification.taxRate;
  }

  get taxAmount(): Money {
    return this.taxSpecification.taxAmount;
  }

  private _description: string | null;
  get description(): string | null {
    return this._description;
  }

  private _documentNo: string | null;
  get documentNo(): string | null {
    return this._documentNo;
  }

  private _entryDate: Date;
  get entryDate(): Date {
    return this._entryDate;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  public get validate() {
    return {
      isCompleted: (msg?: string) => this.isCompleted(msg),
      isRefunded: (msg?: string) => this.isRefunded(msg),
      isCancelled: (msg?: string) => this.isCancelled(msg),
    };
  }

  public static create(props: CreateFinanceLedgerProps): FinanceLedgerEntity {
    FinanceLedgerEntity.assertKurusPrecision(props.money);

    const taxSpec = TaxSpecification.create(props.money, props.taxRate ?? 0);

    return new FinanceLedgerEntity({
      id: UUID.createOrGenerate(props.id).value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      clinicId: UUID.create(props.clinicId).orThrow().value,

      patientId: props.patientId
        ? UUID.create(props.patientId).orThrow().value
        : null,

      paymentId: props.paymentId
        ? UUID.create(props.paymentId).orThrow().value
        : null,

      installmentId: props.installmentId
        ? UUID.create(props.installmentId).orThrow().value
        : null,

      performedById: props.performedById ?? null,

      type: props.type,
      source: props.source,
      category: props.category,
      // Durum dışarıdan gelebilir: tahsilat ile iade olayları **sırasız**
      // teslim edilebiliyor (biri kuyrukta beklerken diğeri işlenir). Kaydı
      // yazan taraf kaynağın o anki nihai durumunu okuyup buraya geçirir;
      // sabit COMPLETED yazmak, önce gelen iadeyi sessizce yutuyordu.
      status: props.status ?? LedgerStatusSchema.enum.COMPLETED,

      amount: taxSpec.netAmount.value,
      currency: taxSpec.netAmount.currency,
      taxRate: taxSpec.taxRate,
      taxAmount: taxSpec.taxAmount.value,

      description: props.description ?? null,
      documentNo: props.documentNo ?? null,
      entryDate: props.entryDate ?? DateTimeManager.create(),
      createdAt: DateTimeManager.create(),
      updatedAt: DateTimeManager.create(),
    });
  }

  public rules(validateOptions: ValidateOptionsType = DefaultValidateOptions) {
    return new FinanceLedgerRules(this, validateOptions);
  }

  /**
   * Kaydı kaynağın (taksit) nihai durumuna hizalar. İdempotent: aynı durum
   * tekrar verilirse hiçbir şey yapmaz ve `false` döner (gereksiz UPDATE yok).
   *
   * Geçiş matrisi tek yerde: COMPLETED → REFUNDED/CANCELLED/CHARGED_BACK
   * serbest; iade, iptal ya da ters ibraz edilmiş bir kaydı tekrar gelire
   * çevirmek **yasak** — telafi turu (backfill) geç gelen bir tahsilat olayıyla
   * iadeyi geri alamaz. Ters ibraz edilen paranın yeniden tahsili AYNI kayda
   * değil, telafi taksidinin kendi kaydına yazılır.
   */
  public syncStatus(target: LedgerStatus): boolean {
    if (this._status === target) return false;

    const isReversed =
      this._status === LedgerStatusSchema.enum.REFUNDED ||
      this._status === LedgerStatusSchema.enum.CANCELLED ||
      this._status === LedgerStatusSchema.enum.CHARGED_BACK;

    if (isReversed) {
      throw new LedgerInvalidStatusTransitionException(this._status, target);
    }

    this._status = target;
    this._updatedAt = DateTimeManager.create();
    return true;
  }

  public refund(): void {
    this.syncStatus(LedgerStatusSchema.enum.REFUNDED);
  }

  public cancel(): void {
    if (this.isCancelled().value) return;

    this.syncStatus(LedgerStatusSchema.enum.CANCELLED);
  }

  public toPersistence(): IFinanceLedger {
    return {
      id: this.id.value,
      organizationId: this.organizationId.value,
      clinicId: this.clinicId.value,
      patientId: this.patientId?.value ?? null,
      paymentId: this.paymentId?.value ?? null,
      installmentId: this.installmentId?.value ?? null,
      performedById: this.performedById,
      type: this.type,
      source: this.source,
      category: this.category,
      status: this.status,

      amount: this.amount.value,
      currency: this.currency.value,
      taxRate: this.taxRate,
      taxAmount: this.taxAmount.value,
      description: this.description,
      documentNo: this.documentNo,
      entryDate: this.entryDate,
      createdAt: this.createdAt,
      // `now()` değil: `toPersistence()` saf olmalı. Her çağrıda yeni bir
      // damga üretmek, hiçbir şeyi değiştirmeyen bir UPDATE'i de "güncellendi"
      // gösteriyordu.
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Tutar kuruş hassasiyetini aşarsa kapıda durdurulur: DB kolonu
   * `Decimal(10,2)`, üçüncü basamağı sessizce yuvarlar ve defter kaynağından
   * (taksit) kayar.
   */
  private static assertKurusPrecision(money: Money): void {
    if (money.value.decimalPlaces() > Money.PRECISION) {
      throw new LedgerInvalidPrecisionException(money.value.toString());
    }
  }

  private isCompleted(msg?: string): Guard<boolean> {
    const is = this._status === LedgerStatusSchema.enum.COMPLETED;
    return Guard.monitor(
      is,
      is,
      () =>
        new LedgerInvalidStatusTransitionException(
          this._status,
          LedgerStatusSchema.enum.COMPLETED,
          msg
        )
    );
  }

  private isRefunded(msg?: string): Guard<boolean> {
    const is = this._status === LedgerStatusSchema.enum.REFUNDED;
    return Guard.monitor(
      is,
      is,
      () =>
        new LedgerInvalidStatusTransitionException(
          this._status,
          LedgerStatusSchema.enum.REFUNDED,
          msg
        )
    );
  }

  private isCancelled(msg?: string): Guard<boolean> {
    const is = this._status === LedgerStatusSchema.enum.CANCELLED;
    return Guard.monitor(
      is,
      is,
      () =>
        new LedgerInvalidStatusTransitionException(
          this._status,
          LedgerStatusSchema.enum.CANCELLED,
          msg
        )
    );
  }
}
