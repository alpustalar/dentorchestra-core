import { Decimal } from 'decimal.js';
import { BankStatementLine as IBankStatementLine } from '@model-schema/BankStatementLineSchema';
import {
  BankStatementLineMatchStatusSchema,
  BankStatementLineMatchStatusType as MatchStatus,
} from '@input-type-schemas/BankStatementLineMatchStatusSchema';
import {
  BankStatementLineMatchSourceSchema,
  BankStatementLineMatchSourceType as MatchSource,
} from '@input-type-schemas/BankStatementLineMatchSourceSchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import {
  AutoMatchLineInput,
  ReconcileLineInput,
  StatementLineImportProps,
} from '@modules/finance/bank/domain/contracts';
import { MatchableStatementLine } from '@modules/finance/bank/domain/rules/statement-line-matcher';
import {
  BankStatementInvalidPrecisionException,
  BankStatementLineMatchNoteTooLongException,
  BankStatementLineMatchRefRequiredException,
} from '@modules/finance/bank/domain/exceptions/bank.exceptions';
import { Money } from '@src/domain/value-objects/money.vo';

/**
 * Ekstre Hareketi (aggregate root). Bankadan gelen tekil hareket satırı; içerideki
 * kayıtla eşleştirilerek (MATCHED) veya bilinçli atlanarak (IGNORED) mutabık edilir.
 */
export class BankStatementLine extends AggregateRoot {
  constructor(data: IBankStatementLine) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._bankStatementId = UUID.fromTrusted(data.bankStatementId);
    this._bankAccountId = UUID.fromTrusted(data.bankAccountId);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._transactionDate = data.transactionDate;
    this._description = data.description;
    this._amount = new Decimal(data.amount.toString());
    this._balanceAfter = data.balanceAfter
      ? new Decimal(data.balanceAfter.toString())
      : null;
    this._reference = data.reference;
    this._counterpartyName = data.counterpartyName;
    this._matchStatus = data.matchStatus;
    this._matchedRef = data.matchedRef;
    this._matchNote = data.matchNote;
    this._matchSource = data.matchSource;
    this._reconciledById = data.reconciledById;
    this._reconciledAt = data.reconciledAt;
    this._createdAt = data.createdAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _bankStatementId: UUID;
  get bankStatementId(): UUID {
    return this._bankStatementId;
  }

  private _bankAccountId: UUID;
  get bankAccountId(): UUID {
    return this._bankAccountId;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _transactionDate: Date;
  get transactionDate(): Date {
    return this._transactionDate;
  }

  private _description: string;
  get description(): string {
    return this._description;
  }

  private _amount: Decimal;
  get amount(): Decimal {
    return this._amount;
  }

  private _balanceAfter: Decimal | null;
  get balanceAfter(): Decimal | null {
    return this._balanceAfter;
  }

  private _reference: string | null;
  get reference(): string | null {
    return this._reference;
  }

  private _counterpartyName: string | null;
  get counterpartyName(): string | null {
    return this._counterpartyName;
  }

  private _matchStatus: MatchStatus;
  get matchStatus(): MatchStatus {
    return this._matchStatus;
  }

  private _matchedRef: string | null;
  get matchedRef(): string | null {
    return this._matchedRef;
  }

  private _matchNote: string | null;
  get matchNote(): string | null {
    return this._matchNote;
  }

  private _matchSource: MatchSource;
  get matchSource(): MatchSource {
    return this._matchSource;
  }

  private _reconciledById: string | null;
  get reconciledById(): string | null {
    return this._reconciledById;
  }

  private _reconciledAt: Date | null;
  get reconciledAt(): Date | null {
    return this._reconciledAt;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  public static createForImport(
    props: StatementLineImportProps
  ): BankStatementLine {
    // Kuruştan ince tutar `Decimal(16,2)` kolonunda yuvarlanır; ekstrenin kendi
    // bakiye kontrolü (açılış + Σ = kapanış) o zaman yanlış yere düşer.
    const amount = BankStatementLine.toKurus(props.amount);

    return new BankStatementLine({
      id: UUID.createOrGenerate(props.id).value,
      bankStatementId: UUID.create(props.bankStatementId).orThrow().value,
      bankAccountId: UUID.create(props.bankAccountId).orThrow().value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      transactionDate: props.transactionDate,
      description: props.description,
      amount,
      balanceAfter:
        props.balanceAfter !== undefined && props.balanceAfter !== null
          ? BankStatementLine.toKurus(props.balanceAfter)
          : null,
      reference: props.reference ?? null,
      counterpartyName: props.counterpartyName ?? null,
      matchStatus: BankStatementLineMatchStatusSchema.enum.UNMATCHED,
      matchedRef: null,
      matchNote: null,
      matchSource: BankStatementLineMatchSourceSchema.enum.MANUAL,
      reconciledById: null,
      reconciledAt: null,
      createdAt: DateTimeManager.create(),
    });
  }

  private static toKurus(amount: number): Decimal {
    const decimal = new Decimal(amount);
    if (decimal.decimalPlaces() > Money.PRECISION) {
      throw new BankStatementInvalidPrecisionException(decimal.toString());
    }
    return decimal;
  }

  /** Mutabakat: eşleştir / yoksay / geri al. UNMATCHED'e dönüşte iz temizlenir. */
  public reconcile(input: ReconcileLineInput): void {
    if (
      input.matchStatus === BankStatementLineMatchStatusSchema.enum.UNMATCHED
    ) {
      this._matchStatus = BankStatementLineMatchStatusSchema.enum.UNMATCHED;
      this._matchedRef = null;
      this._matchNote = null;
      this._matchSource = BankStatementLineMatchSourceSchema.enum.MANUAL;
      this._reconciledById = null;
      this._reconciledAt = null;
      return;
    }

    // İş kuralı: MATCHED durumunda eşleşme referansı zorunludur — referanssız bir
    // MATCHED kaydı hangi 102 defter satırına bağlandığını izlenemez kılar.
    if (
      input.matchStatus === BankStatementLineMatchStatusSchema.enum.MATCHED &&
      (!input.matchedRef || input.matchedRef.trim() === '')
    ) {
      throw new BankStatementLineMatchRefRequiredException(this._id.value);
    }

    if (input.matchNote && input.matchNote.length > 500) {
      throw new BankStatementLineMatchNoteTooLongException(this._id.value);
    }

    this._matchStatus = input.matchStatus;
    this._matchedRef = input.matchedRef ?? null;
    this._matchNote = input.matchNote ?? null;
    // Elle yapılan her mutabakat kaynağı MANUAL'a döner: personel makinenin
    // kurduğu bir eşleşmeyi düzelttiğinde iz artık insana aittir.
    this._matchSource = BankStatementLineMatchSourceSchema.enum.MANUAL;
    this._reconciledById = input.reconciledById;
    this._reconciledAt = DateTimeManager.create();
  }

  /**
   * Oto-eşleştirme taramasının kurduğu eşleşme. `reconcile`'dan ayrı bir metottur
   * çünkü (1) kaynağı AUTO işaretler, (2) yalnız UNMATCHED satıra uygulanır —
   * makine personelin verdiği kararın (MATCHED/IGNORED) üzerine yazmaz.
   *
   * Halihazırda mutabık edilmiş satırda çağrılırsa sessizce atlanır ve `false`
   * döner; tarama bunu "dokunulmadı" olarak sayar.
   */
  public autoMatch(input: AutoMatchLineInput): boolean {
    if (
      this._matchStatus !== BankStatementLineMatchStatusSchema.enum.UNMATCHED
    ) {
      return false;
    }

    this._matchStatus = BankStatementLineMatchStatusSchema.enum.MATCHED;
    this._matchedRef = input.matchedRef;
    this._matchNote = input.matchNote;
    this._matchSource = BankStatementLineMatchSourceSchema.enum.AUTO;
    this._reconciledById = input.reconciledById;
    this._reconciledAt = DateTimeManager.create();
    return true;
  }

  /** Eşleştirme motorunun beklediği sade izdüşüm (motor entity bilmez). */
  public toMatchable(): MatchableStatementLine {
    return {
      id: this.id.value,
      transactionDate: this.transactionDate,
      amount: this.amount,
      description: this.description,
      reference: this.reference,
      counterpartyName: this.counterpartyName,
    };
  }

  public toPersistence(): IBankStatementLine {
    return {
      id: this.id.value,
      bankStatementId: this.bankStatementId.value,
      bankAccountId: this.bankAccountId.value,
      clinicId: this.clinicId.value,
      organizationId: this.organizationId.value,
      transactionDate: this.transactionDate,
      description: this.description,
      amount: this.amount,
      balanceAfter: this.balanceAfter,
      reference: this.reference,
      counterpartyName: this.counterpartyName,
      matchStatus: this.matchStatus,
      matchedRef: this.matchedRef,
      matchNote: this.matchNote,
      matchSource: this.matchSource,
      reconciledById: this.reconciledById,
      reconciledAt: this.reconciledAt,
      createdAt: this.createdAt,
    };
  }
}
