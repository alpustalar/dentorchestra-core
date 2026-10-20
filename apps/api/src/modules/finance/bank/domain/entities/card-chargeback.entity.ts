import { Decimal } from 'decimal.js';
import { CardChargeback as ICardChargeback } from '@model-schema/CardChargebackSchema';
import CardChargebackStatusSchema, {
  CardChargebackStatusType,
} from '@input-type-schemas/CardChargebackStatusSchema';
import CardChargebackSourceSchema, {
  CardChargebackSourceType,
} from '@input-type-schemas/CardChargebackSourceSchema';
import { ChargebackFundsChannelType } from '@input-type-schemas/ChargebackFundsChannelSchema';
import { CardChargebackPlanSyncType } from '@input-type-schemas/CardChargebackPlanSyncSchema';
import { SettlementProviderType } from '@input-type-schemas/SettlementProviderSchema';
import { CurrencyType } from '@input-type-schemas/CurrencySchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Money } from '@src/domain/value-objects/money.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import {
  MarkChargebackPostedProps,
  OpenCardChargebackProps,
  RecordChargebackPlanSyncProps,
  ResolveChargebackLostProps,
  ResolveChargebackWonProps,
} from '@modules/finance/bank/domain/contracts';
import {
  ChargebackAlreadyResolvedException,
  ChargebackInvalidAmountException,
  ChargebackInvalidDateException,
  ChargebackInvalidPrecisionException,
  ChargebackPlanSyncNotApplicableException,
  ChargebackReferenceRequiredException,
  ChargebackSourceActorsInvalidException,
  ChargebackReturnChannelRequiredException,
} from '@modules/finance/bank/domain/exceptions/bank.exceptions';

/**
 * Kart itirazı (chargeback / ters ibraz) — aggregate root.
 *
 * Kart sahibi bankasına itiraz ettiğinde sağlayıcı parayı üye işyerinden geri
 * keser; sonuç haftalar sonra belli olur. Bu kayıt itirazın yaşam döngüsüdür ve
 * **tek yönlü bir durum makinesidir**:
 *
 *   OPEN ──► WON   (para geri geldi:   B 108|102 / A 127)
 *        └─► LOST  (kesinleşti:        B 120 (hasta) / A 127)
 *
 * Çözüm tek seferliktir: kazanılanı kaybedilene (ya da tersine) çevirmek ayrı
 * bir ekonomik olaydır (itirazın yeniden açılması / ikinci tur), bu kaydın
 * düzenlenmesi değil.
 *
 * Sayısal değişmezler (hepsi **yazma anında** zorlanır; gövde append-only olduğu
 * için sonradan düzeltilemez — §53 gerekçesi):
 *  - tutar pozitif, ücret negatif olamaz,
 *  - ikisi de kuruş ölçeğinde (DB `Decimal(14,2)` fazla haneyi sessizce yuvarlar
 *    ve fişin dengesi bir kuruş kayar — §81.3),
 *  - çözüm tarihi açılış tarihinden önce olamaz.
 */
export class CardChargeback extends AggregateRoot {
  constructor(data: ICardChargeback) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._provider = data.provider;
    this._caseReference = data.caseReference;
    this._sourceType = data.sourceType;
    this._sourceId = data.sourceId;
    this._paymentId = data.paymentId;
    this._installmentId = data.installmentId;
    this._patientId = data.patientId ? UUID.fromTrusted(data.patientId) : null;
    this._partyId = data.partyId ? UUID.fromTrusted(data.partyId) : null;
    this._amount = new Decimal(data.amount.toString());
    this._feeAmount = new Decimal(data.feeAmount.toString());
    this._currency = data.currency;
    this._status = data.status;
    this._openedAt = data.openedAt;
    this._openedFundsChannel = data.openedFundsChannel;
    this._openedBankAccountId = data.openedBankAccountId;
    this._evidenceDueAt = data.evidenceDueAt;
    this._note = data.note;
    this._resolvedAt = data.resolvedAt;
    this._resolvedFundsChannel = data.resolvedFundsChannel;
    this._resolvedBankAccountId = data.resolvedBankAccountId;
    this._resolutionNote = data.resolutionNote;
    this._openedEventId = data.openedEventId;
    this._resolvedEventId = data.resolvedEventId;
    this._planSyncStatus = data.planSyncStatus;
    this._recoveryInstallmentId = data.recoveryInstallmentId;
    this._recordedById = data.recordedById;
    this._resolvedById = data.resolvedById;
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

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _provider: SettlementProviderType;
  get provider(): SettlementProviderType {
    return this._provider;
  }

  private _caseReference: string;
  get caseReference(): string {
    return this._caseReference;
  }

  private _sourceType: CardChargebackSourceType;
  get sourceType(): CardChargebackSourceType {
    return this._sourceType;
  }

  private _sourceId: string;
  get sourceId(): string {
    return this._sourceId;
  }

  private _paymentId: string | null;
  get paymentId(): string | null {
    return this._paymentId;
  }

  private _installmentId: string | null;
  get installmentId(): string | null {
    return this._installmentId;
  }

  /** Platform rezervasyon itirazında (`BOOKING_PAYMENT`) yoktur. */
  private _patientId: UUID | null;
  get patientId(): UUID | null {
    return this._patientId;
  }

  /** Platform rezervasyon itirazında yoktur: kayıp 120'ye değil 659.01'e yazılır. */
  private _partyId: UUID | null;
  get partyId(): UUID | null {
    return this._partyId;
  }

  private _amount: Decimal;
  get amount(): Decimal {
    return this._amount;
  }

  private _feeAmount: Decimal;
  get feeAmount(): Decimal {
    return this._feeAmount;
  }

  private _currency: CurrencyType;
  get currency(): CurrencyType {
    return this._currency;
  }

  private _status: CardChargebackStatusType;
  get status(): CardChargebackStatusType {
    return this._status;
  }

  private _openedAt: Date;
  get openedAt(): Date {
    return this._openedAt;
  }

  private _openedFundsChannel: ChargebackFundsChannelType;
  get openedFundsChannel(): ChargebackFundsChannelType {
    return this._openedFundsChannel;
  }

  private _openedBankAccountId: string | null;
  get openedBankAccountId(): string | null {
    return this._openedBankAccountId;
  }

  private _evidenceDueAt: Date | null;
  get evidenceDueAt(): Date | null {
    return this._evidenceDueAt;
  }

  private _note: string | null;
  get note(): string | null {
    return this._note;
  }

  private _resolvedAt: Date | null;
  get resolvedAt(): Date | null {
    return this._resolvedAt;
  }

  private _resolvedFundsChannel: ChargebackFundsChannelType | null;
  get resolvedFundsChannel(): ChargebackFundsChannelType | null {
    return this._resolvedFundsChannel;
  }

  private _resolvedBankAccountId: string | null;
  get resolvedBankAccountId(): string | null {
    return this._resolvedBankAccountId;
  }

  private _resolutionNote: string | null;
  get resolutionNote(): string | null {
    return this._resolutionNote;
  }

  private _openedEventId: string | null;
  get openedEventId(): string | null {
    return this._openedEventId;
  }

  private _resolvedEventId: string | null;
  get resolvedEventId(): string | null {
    return this._resolvedEventId;
  }

  private _planSyncStatus: CardChargebackPlanSyncType | null;
  get planSyncStatus(): CardChargebackPlanSyncType | null {
    return this._planSyncStatus;
  }

  private _recoveryInstallmentId: string | null;
  get recoveryInstallmentId(): string | null {
    return this._recoveryInstallmentId;
  }

  private _recordedById: string;
  get recordedById(): string {
    return this._recordedById;
  }

  private _resolvedById: string | null;
  get resolvedById(): string | null {
    return this._resolvedById;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Hasta/cari alanları kaynakla tutarlı mı? `BOOKING_PAYMENT`'ta hiçbiri olmaz ve yalnız
   * iyzico/TRY olabilir (platform sanal POS'u); diğerlerinde hasta + cari zorunludur. DB CHECK
   * aynı kuralı zorlar — buradaki kapı kaydı veritabanına varmadan açıklayıcı reddeder.
   */
  private static assertSourceActors(props: OpenCardChargebackProps): void {
    const isBooking =
      props.sourceType === CardChargebackSourceSchema.enum.BOOKING_PAYMENT;
    const hasActors = Boolean(props.patientId) && Boolean(props.partyId);
    const hasAnyActor = Boolean(props.patientId) || Boolean(props.partyId);

    const valid = isBooking
      ? !hasAnyActor &&
        props.paymentId === null &&
        props.provider === 'IYZICO' &&
        props.currency === 'TRY'
      : hasActors;

    if (!valid) {
      throw new ChargebackSourceActorsInvalidException({
        sourceType: props.sourceType,
      });
    }
  }

  public static open(props: OpenCardChargebackProps): CardChargeback {
    const caseReference = props.caseReference.trim();
    if (caseReference.length === 0) {
      // Vaka numarası idempotency anahtarının yarısı: boş geçerse aynı itiraz
      // ikinci kez girildiğinde DB kısıtı onu ayırt edemez.
      throw new ChargebackReferenceRequiredException();
    }

    CardChargeback.assertAmounts({
      amount: props.amount,
      feeAmount: props.feeAmount,
    });
    CardChargeback.assertSourceActors(props);

    const now = DateTimeManager.create();

    return new CardChargeback({
      id: UUID.createOrGenerate(props.id).value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      provider: props.provider,
      caseReference,
      sourceType: props.sourceType,
      sourceId: props.sourceId,
      paymentId: props.paymentId,
      // Sanal POS'ta kaynak zaten taksittir (DB CHECK `installment_id =
      // source_id`); POS'ta hangi taksidin ödendiği kaybedilince bulunur.
      installmentId:
        props.sourceType === CardChargebackSourceSchema.enum.ONLINE_PAYMENT
          ? props.sourceId
          : null,
      patientId: props.patientId
        ? UUID.create(props.patientId).orThrow().value
        : null,
      partyId: props.partyId
        ? UUID.create(props.partyId).orThrow().value
        : null,
      amount: props.amount,
      feeAmount: props.feeAmount,
      currency: props.currency,
      status: CardChargebackStatusSchema.enum.OPEN,
      openedAt: props.openedAt,
      openedFundsChannel: props.openedFundsChannel,
      openedBankAccountId: props.openedBankAccountId ?? null,
      evidenceDueAt: props.evidenceDueAt ?? null,
      note: props.note ?? null,
      resolvedAt: null,
      resolvedFundsChannel: null,
      resolvedBankAccountId: null,
      resolutionNote: null,
      openedEventId: null,
      resolvedEventId: null,
      planSyncStatus: null,
      recoveryInstallmentId: null,
      recordedById: props.recordedById,
      resolvedById: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Tutar değişmezleri. Tutar pozitif, ücret negatif olamaz ve ikisi kuruş
   * ölçeğinde olmak zorundadır — gövde append-only olduğu için ret, kaynağın
   * tutarı hâlâ düzeltebildiği yerde verilir.
   */
  private static assertAmounts(amounts: {
    amount: Decimal;
    feeAmount: Decimal;
  }): void {
    for (const value of [amounts.amount, amounts.feeAmount]) {
      if (!value.isFinite()) {
        throw new ChargebackInvalidAmountException(value.toString());
      }
      if (!Money.isKurusScaled(value)) {
        throw new ChargebackInvalidPrecisionException(value.toString());
      }
    }

    if (amounts.amount.lessThanOrEqualTo(0)) {
      throw new ChargebackInvalidAmountException(
        `tutar=${amounts.amount.toString()}`
      );
    }

    if (amounts.feeAmount.isNegative()) {
      throw new ChargebackInvalidAmountException(
        `ücret=${amounts.feeAmount.toString()}`
      );
    }
  }

  public isOpen(): boolean {
    return this._status === CardChargebackStatusSchema.enum.OPEN;
  }

  /**
   * Kazanıldı: para geri geldi. Paranın NEREYE döndüğü (108 mi, 102 mi) zorunlu —
   * açılıştaki kanala bağlı değildir.
   */
  public resolveWon(props: ResolveChargebackWonProps): void {
    this.assertOpen();
    this.assertResolvedAtNotBeforeOpened(props.resolvedAt);

    if (!props.fundsChannel) {
      // Tip sistemi zorluyor; çalışma zamanı kapısı tip dışı çağrılar için.
      throw new ChargebackReturnChannelRequiredException();
    }

    this._status = CardChargebackStatusSchema.enum.WON;
    this._resolvedAt = props.resolvedAt;
    this._resolvedFundsChannel = props.fundsChannel;
    this._resolvedBankAccountId = props.bankAccountId ?? null;
    this._resolutionNote = props.note ?? null;
    this._resolvedById = props.resolvedById;
    this._updatedAt = DateTimeManager.create();
  }

  /** Kaybedildi: kesinleşti. Para dönmez; hasta borcu yeniden doğar. */
  public resolveLost(props: ResolveChargebackLostProps): void {
    this.assertOpen();
    this.assertResolvedAtNotBeforeOpened(props.resolvedAt);

    this._status = CardChargebackStatusSchema.enum.LOST;
    this._resolvedAt = props.resolvedAt;
    this._resolvedFundsChannel = null;
    this._resolvedBankAccountId = null;
    this._resolutionNote = props.note ?? null;
    this._resolvedById = props.resolvedById;
    this._updatedAt = DateTimeManager.create();
  }

  /** Açılış fişinin muhasebe köprüsü izi. */
  public markOpenedPosted(props: MarkChargebackPostedProps): void {
    this._openedEventId = props.accountingEventId;
    this._updatedAt = DateTimeManager.create();
  }

  /** Çözüm fişinin muhasebe köprüsü izi. */
  public markResolvedPosted(props: MarkChargebackPostedProps): void {
    this._resolvedEventId = props.accountingEventId;
    this._updatedAt = DateTimeManager.create();
  }

  /**
   * Kaybedilen itirazın ödeme planına yansıma sonucu. Yalnız LOST'ta anlamlıdır:
   * kazanılan itirazda plan değişmez, açık itirazda henüz sonuç yok.
   */
  public recordPlanSync(props: RecordChargebackPlanSyncProps): void {
    if (this._status !== CardChargebackStatusSchema.enum.LOST) {
      throw new ChargebackPlanSyncNotApplicableException({
        chargebackId: this._id.value,
        status: this._status,
      });
    }

    this._planSyncStatus = props.status;
    // POS'ta geri alınan taksit tutar eşleşmesiyle şimdi bulundu; ONLINE'da zaten dolu.
    this._installmentId = props.installmentId ?? this._installmentId;
    this._recoveryInstallmentId = props.recoveryInstallmentId ?? null;
    this._updatedAt = DateTimeManager.create();
  }

  public toPersistence(): ICardChargeback {
    return {
      id: this.id.value,
      organizationId: this.organizationId.value,
      clinicId: this.clinicId.value,
      provider: this.provider,
      caseReference: this.caseReference,
      sourceType: this.sourceType,
      sourceId: this.sourceId,
      paymentId: this.paymentId,
      installmentId: this.installmentId,
      patientId: this.patientId?.value ?? null,
      partyId: this.partyId?.value ?? null,
      amount: this.amount,
      feeAmount: this.feeAmount,
      currency: this.currency,
      status: this.status,
      openedAt: this.openedAt,
      openedFundsChannel: this.openedFundsChannel,
      openedBankAccountId: this.openedBankAccountId,
      evidenceDueAt: this.evidenceDueAt,
      note: this.note,
      resolvedAt: this.resolvedAt,
      resolvedFundsChannel: this.resolvedFundsChannel,
      resolvedBankAccountId: this.resolvedBankAccountId,
      resolutionNote: this.resolutionNote,
      openedEventId: this.openedEventId,
      resolvedEventId: this.resolvedEventId,
      planSyncStatus: this.planSyncStatus,
      recoveryInstallmentId: this.recoveryInstallmentId,
      recordedById: this.recordedById,
      resolvedById: this.resolvedById,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  private assertOpen(): void {
    if (!this.isOpen()) {
      throw new ChargebackAlreadyResolvedException({
        chargebackId: this._id.value,
        status: this._status,
      });
    }
  }

  private assertResolvedAtNotBeforeOpened(resolvedAt: Date): void {
    if (DateTimeManager.isBefore(resolvedAt, this._openedAt)) {
      throw new ChargebackInvalidDateException({
        openedAt: this._openedAt.toISOString(),
        resolvedAt: resolvedAt.toISOString(),
      });
    }
  }
}
