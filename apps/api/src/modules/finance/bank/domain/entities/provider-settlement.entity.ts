import { Decimal } from 'decimal.js';
import { ProviderSettlement as IProviderSettlement } from '@model-schema/ProviderSettlementSchema';
import { SettlementProviderType } from '@input-type-schemas/SettlementProviderSchema';
import { CurrencyType } from '@input-type-schemas/CurrencySchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Money } from '@src/domain/value-objects/money.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import {
  MarkSettlementPostedProps,
  RecordProviderSettlementProps,
} from '@modules/finance/bank/domain/contracts';
import {
  SettlementAmountMismatchException,
  SettlementInvalidAmountException,
  SettlementInvalidPrecisionException,
  SettlementReferenceRequiredException,
} from '@modules/finance/bank/domain/exceptions/bank.exceptions';

/**
 * Sağlayıcı Hesap Kapaması (aggregate root).
 *
 * Kartla tahsil edilen para üye işyeri hesabına anında geçmez: sağlayıcı tutarı
 * biriktirir, komisyonunu keser, valör günü net tutarı bankaya aktarır. Defterde
 * bekleyen para 108 Diğer Hazır Değerler'de durur ve bu kayıt onun kapanışıdır:
 *
 *   B 102 Bankalar            net
 *   B 653 Komisyon Giderleri  komisyon
 *       A 108 Diğer Hazır Değ.    brüt
 *
 * Varlığın tek iç değişmezi **brüt = net + komisyon**. Tolerans yok: bu bizim
 * hesabımız değil, sağlayıcının kendi payout raporudur — tutmuyorsa veri girişi
 * hatalıdır ve fişin dengesi (Σborç = Σalacak) buna dayanır.
 */
export class ProviderSettlement extends AggregateRoot {
  constructor(data: IProviderSettlement) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._provider = data.provider;
    this._reference = data.reference;
    this._payoutDate = data.payoutDate;
    this._grossAmount = new Decimal(data.grossAmount.toString());
    this._commissionAmount = new Decimal(data.commissionAmount.toString());
    this._netAmount = new Decimal(data.netAmount.toString());
    this._currency = data.currency;
    this._bankAccountId = data.bankAccountId;
    this._note = data.note;
    this._accountingEventId = data.accountingEventId;
    this._postedToAccountingAt = data.postedToAccountingAt;
    this._recordedById = data.recordedById;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _provider: SettlementProviderType;
  get provider(): SettlementProviderType {
    return this._provider;
  }

  private _reference: string;
  get reference(): string {
    return this._reference;
  }

  private _payoutDate: Date;
  get payoutDate(): Date {
    return this._payoutDate;
  }

  private _grossAmount: Decimal;
  get grossAmount(): Decimal {
    return this._grossAmount;
  }

  private _commissionAmount: Decimal;
  get commissionAmount(): Decimal {
    return this._commissionAmount;
  }

  private _netAmount: Decimal;
  get netAmount(): Decimal {
    return this._netAmount;
  }

  private _currency: CurrencyType;
  get currency(): CurrencyType {
    return this._currency;
  }

  private _bankAccountId: string | null;
  get bankAccountId(): string | null {
    return this._bankAccountId;
  }

  private _note: string | null;
  get note(): string | null {
    return this._note;
  }

  private _accountingEventId: string | null;
  get accountingEventId(): string | null {
    return this._accountingEventId;
  }

  private _postedToAccountingAt: Date | null;
  get postedToAccountingAt(): Date | null {
    return this._postedToAccountingAt;
  }

  private _recordedById: string;
  get recordedById(): string {
    return this._recordedById;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  public static record(
    props: RecordProviderSettlementProps
  ): ProviderSettlement {
    const reference = props.reference.trim();
    if (reference.length === 0) {
      // Referans idempotency anahtarının yarısı: boş geçerse aynı payout ikinci
      // kez girildiğinde DB kısıtı onu ayırt edemez ve 108 iki kez kapanır.
      throw new SettlementReferenceRequiredException();
    }

    ProviderSettlement.assertAmounts({
      grossAmount: props.grossAmount,
      commissionAmount: props.commissionAmount,
      netAmount: props.netAmount,
    });

    const now = DateTimeManager.create();

    return new ProviderSettlement({
      id: UUID.createOrGenerate(props.id).value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      provider: props.provider,
      reference,
      payoutDate: props.payoutDate,
      grossAmount: props.grossAmount,
      commissionAmount: props.commissionAmount,
      netAmount: props.netAmount,
      currency: props.currency,
      bankAccountId: props.bankAccountId ?? null,
      note: props.note ?? null,
      accountingEventId: null,
      postedToAccountingAt: null,
      recordedById: props.recordedById,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Tutar değişmezleri. Üçü birlikte zorunlu:
   *  - brüt ve net **pozitif** (sıfır tutarlı payout diye bir şey yok; fiş satırı
   *    da sıfır olamaz),
   *  - komisyon negatif olamaz (sağlayıcı para ekleyemez; eklediği bir durum
   *    varsa o ayrı bir ekonomik olaydır, bu kayda sığdırılamaz),
   *  - **brüt = net + komisyon** birebir. Bu eşitlik fişin dengesidir: tutmazsa
   *    `B 102 + B 653 ≠ A 108` olur ve olay gövdesi append-only olduğu için
   *    sonsuza kadar fişlenemez (§53 ile aynı gerekçe — ret, kaynağın tutarı
   *    hâlâ düzeltebildiği yerde verilir).
   */
  private static assertAmounts(amounts: {
    grossAmount: Decimal;
    commissionAmount: Decimal;
    netAmount: Decimal;
  }): void {
    const { grossAmount, commissionAmount, netAmount } = amounts;

    for (const amount of [grossAmount, commissionAmount, netAmount]) {
      if (!amount.isFinite()) {
        throw new SettlementInvalidAmountException(amount.toString());
      }
      if (!Money.isKurusScaled(amount)) {
        throw new SettlementInvalidPrecisionException(amount.toString());
      }
    }

    if (grossAmount.lessThanOrEqualTo(0) || netAmount.lessThanOrEqualTo(0)) {
      throw new SettlementInvalidAmountException(
        `brüt=${grossAmount.toString()} net=${netAmount.toString()}`
      );
    }

    if (commissionAmount.isNegative()) {
      throw new SettlementInvalidAmountException(
        `komisyon=${commissionAmount.toString()}`
      );
    }

    const expected = netAmount.plus(commissionAmount);
    if (!grossAmount.equals(expected)) {
      throw new SettlementAmountMismatchException({
        grossAmount: grossAmount.toFixed(Money.PRECISION),
        netAmount: netAmount.toFixed(Money.PRECISION),
        commissionAmount: commissionAmount.toFixed(Money.PRECISION),
      });
    }
  }

  public isPostedToAccounting(): boolean {
    return this._accountingEventId !== null;
  }

  /** Muhasebe köprüsü izi — mükerrer fiş ve yarıda kalma koruması. */
  public markAsPostedToAccounting(props: MarkSettlementPostedProps): void {
    this._accountingEventId = props.accountingEventId;
    this._postedToAccountingAt = DateTimeManager.create();
    this._updatedAt = DateTimeManager.create();
  }

  public toPersistence(): IProviderSettlement {
    return {
      id: this.id.value,
      organizationId: this.organizationId.value,
      clinicId: this.clinicId.value,
      provider: this.provider,
      reference: this.reference,
      payoutDate: this.payoutDate,
      grossAmount: this.grossAmount,
      commissionAmount: this.commissionAmount,
      netAmount: this.netAmount,
      currency: this.currency,
      bankAccountId: this.bankAccountId,
      note: this.note,
      accountingEventId: this.accountingEventId,
      postedToAccountingAt: this.postedToAccountingAt,
      recordedById: this.recordedById,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
