import { Decimal } from 'decimal.js';
import { BankStatement as IBankStatement } from '@model-schema/BankStatementSchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { ImportBankStatementProps } from '@modules/finance/bank/domain/contracts';
import { BankStatementLine } from '@modules/finance/bank/domain/entities/bank-statement-line.entity';
import {
  BankStatementBalanceMismatchException,
  BankStatementEmptyLinesException,
  BankStatementInvalidPrecisionException,
} from '@modules/finance/bank/domain/exceptions/bank.exceptions';
import { Money } from '@src/domain/value-objects/money.vo';
import { isDefined, isEmpty } from '@common/utils';
import { DateRange } from '@src/domain/value-objects';

/**
 * Banka Ekstresi (aggregate root). Bir import batch'i: dönem + hareket satırları.
 * Satırlar UNMATCHED olarak doğar; mutabakat satır bazında (BankStatementLine) yürür.
 */
export class BankStatement extends AggregateRoot {
  constructor(data: IBankStatement, lines: BankStatementLine[]) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._bankAccountId = UUID.fromTrusted(data.bankAccountId);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._organizationId = UUID.fromTrusted(data.organizationId);

    this._periodDateRange = DateRange.fromTrusted(
      data.periodStart,
      data.periodEnd
    );

    this._openingBalance = data.openingBalance
      ? new Decimal(data.openingBalance.toString())
      : null;
    this._closingBalance = data.closingBalance
      ? new Decimal(data.closingBalance.toString())
      : null;
    this._fileName = data.fileName;
    this._importedById = data.importedById;
    this._createdAt = data.createdAt;
    this._lines = lines;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
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

  private _periodDateRange: DateRange;
  get periodDateRange(): DateRange {
    return this._periodDateRange;
  }

  get periodStart(): Date {
    return this.periodDateRange.startDate;
  }

  get periodEnd(): Date {
    return this.periodDateRange.endDate;
  }

  private _openingBalance: Decimal | null;
  get openingBalance(): Decimal | null {
    return this._openingBalance;
  }

  private _closingBalance: Decimal | null;
  get closingBalance(): Decimal | null {
    return this._closingBalance;
  }

  private _fileName: string | null;
  get fileName(): string | null {
    return this._fileName;
  }

  private _importedById: string;
  get importedById(): string {
    return this._importedById;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _lines: BankStatementLine[];
  get lines(): BankStatementLine[] {
    return this._lines;
  }

  public static create(props: ImportBankStatementProps): BankStatement {
    if (isEmpty(props.lines)) {
      throw new BankStatementEmptyLinesException();
    }

    const now = DateTimeManager.create();
    const statementId = UUID.createOrGenerate(props.id).value;

    const openingBalance = isDefined(props.openingBalance)
      ? BankStatement.toKurus(props.openingBalance)
      : null;
    const closingBalance = isDefined(props.closingBalance)
      ? BankStatement.toKurus(props.closingBalance)
      : null;

    const lines = props.lines.map((line) =>
      BankStatementLine.createForImport({
        bankStatementId: statementId,
        bankAccountId: props.bankAccountId,
        clinicId: props.clinicId,
        organizationId: props.organizationId,
        transactionDate: line.transactionDate,
        description: line.description,
        amount: line.amount,
        balanceAfter: line.balanceAfter,
        reference: line.reference,
        counterpartyName: line.counterpartyName,
      })
    );

    // Ekstrenin kendi tutarlılığı: açılış + Σ hareket = kapanış. Mutabakatın
    // tamamı bu dosyanın doğru olduğu varsayımına dayanır; CSV ayrıştırmasında
    // düşen/çiftlenen bir satır burada yakalanmazsa defterle farkı aylarca
    // kovalanır.
    BankStatement.assertBalancesAgreeWithLines({
      openingBalance,
      closingBalance,
      lines,
    });

    return new BankStatement(
      {
        id: statementId,
        bankAccountId: UUID.create(props.bankAccountId).orThrow().value,
        clinicId: UUID.create(props.clinicId).orThrow().value,
        organizationId: UUID.create(props.organizationId).orThrow().value,
        periodStart: props.periodStart,
        periodEnd: props.periodEnd,
        openingBalance,
        closingBalance,
        fileName: props.fileName ?? null,
        // Aktör kimliği ham string: `ctx.actor.userId` bir Firebase UID'dir
        // (`User.id = firebaseUid`), UUID değil — `UUID.create(...).orThrow()`
        // her gerçek personel için patlıyor, ekstre hiç içe alınamıyordu.
        importedById: props.importedById,
        createdAt: now,
      },
      lines
    );
  }

  /**
   * `açılış + Σ hareket = kapanış`. Yalnız iki bakiye de verildiyse çalışır:
   * bazı bankaların CSV'si bakiye kolonu taşımaz, o durumda kontrol edilecek
   * bir şey yoktur (ekstrenin kendi beyanı yok).
   */
  private static assertBalancesAgreeWithLines(input: {
    openingBalance: Decimal | null;
    closingBalance: Decimal | null;
    lines: BankStatementLine[];
  }): void {
    const { openingBalance, closingBalance, lines } = input;
    if (openingBalance === null || closingBalance === null) return;

    const lineTotal = lines.reduce(
      (total, line) => total.plus(line.amount),
      new Decimal(0)
    );
    const difference = openingBalance.plus(lineTotal).minus(closingBalance);

    // Tolerans yok: banka ekstresi kuruşu kuruşuna denk gelir.
    if (!difference.isZero()) {
      throw new BankStatementBalanceMismatchException({
        openingBalance: openingBalance.toFixed(2),
        closingBalance: closingBalance.toFixed(2),
        lineTotal: lineTotal.toFixed(2),
        difference: difference.toFixed(2),
      });
    }
  }

  private static toKurus(amount: number): Decimal {
    const decimal = new Decimal(amount);
    if (decimal.decimalPlaces() > Money.PRECISION) {
      throw new BankStatementInvalidPrecisionException(decimal.toString());
    }
    return decimal;
  }

  public toPersistence(): IBankStatement {
    return {
      id: this.id.value,
      bankAccountId: this.bankAccountId.value,
      clinicId: this.clinicId.value,
      organizationId: this.organizationId.value,
      periodStart: this.periodStart,
      periodEnd: this.periodEnd,
      openingBalance: this.openingBalance,
      closingBalance: this.closingBalance,
      fileName: this.fileName,
      importedById: this.importedById,
      createdAt: this.createdAt,
    };
  }
}
