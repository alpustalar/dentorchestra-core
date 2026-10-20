import { JournalLine as IJournalLine } from '@shared';
import { JournalEntryLineAmount } from '@modules/finance/shared/domain/value-objects/journal-entry-line-amount.vo';
import { Currency } from '@src/domain/value-objects/currency.vo';
import { Decimal } from 'decimal.js';
import { CreateJournalEntryLineProps } from '@modules/finance/accounting/posting/domain/contracts/journal-line';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Money } from '@src/domain/value-objects/money.vo';
import { InvalidJournalLineAmountException } from '@modules/finance/shared/domain/exceptions';

export class JournalLine {
  private readonly _amount: JournalEntryLineAmount;

  constructor(data: IJournalLine) {
    this._id = data.id;
    this._entryId = data.entryId;
    this._accountId = data.accountId;
    this._partyId = data.partyId;

    // Tutarlar domain'e `decimal.js` olarak girer. Repository satırları DB'den Prisma'nın
    // kendi `Decimal`'iyle döndürür (`Prisma.Decimal` ≠ `decimal.js` — farklı sınıf, `instanceof`
    // ikisi arasında FALSE verir); `JournalEntryLineAmount` katı `instanceof` istediği için
    // sınırda çevrilmezse fişi yazan HER çağrı satırları yeniden kurarken patlar ve transaction
    // geri sarılır. Mock'lu testler hep decimal.js verdiği için bu yalnız gerçek DB'de görünür.
    this._amount = JournalEntryLineAmount.create(
      JournalLine.hydrate(data.debit),
      JournalLine.hydrate(data.credit),
      Currency.create(data.currency).orThrow()
    );

    this._originalDebit =
      data.originalDebit != null
        ? JournalLine.hydrate(data.originalDebit)
        : null;
    this._originalCredit =
      data.originalCredit != null
        ? JournalLine.hydrate(data.originalCredit)
        : null;
    this._originalCurrency = data.originalCurrency
      ? Currency.create(data.originalCurrency).orThrow()
      : null;
    this._fxRate =
      data.fxRate != null ? JournalLine.hydrate(data.fxRate) : null;

    this._lineDesc = data.lineDesc;
  }

  private _id: string;
  get id(): string {
    return this._id;
  }

  private _entryId: string;
  get entryId(): string {
    return this._entryId;
  }

  private _accountId: string;

  get accountId(): string {
    return this._accountId;
  }

  private _partyId: string | null;

  get partyId(): string | null {
    return this._partyId;
  }

  get debit(): Decimal {
    return this._amount.debit;
  }

  get credit(): Decimal {
    return this._amount.credit;
  }

  // Para birimi tek kaynak: JournalEntryLineAmount VO. Ayrı _currency alanı tutulmaz
  // (constructor'da set edilmediği için undefined kalıyordu → save'de patlıyordu).
  get currency(): Currency {
    return this._amount.currency;
  }

  // Yabancı para izlenebilirliği — yalnız çevrilmiş satırlarda dolu (Model A).
  private _originalDebit: Decimal | null;
  get originalDebit(): Decimal | null {
    return this._originalDebit;
  }

  private _originalCredit: Decimal | null;
  get originalCredit(): Decimal | null {
    return this._originalCredit;
  }

  private _originalCurrency: Currency | null;
  get originalCurrency(): Currency | null {
    return this._originalCurrency;
  }

  private _fxRate: Decimal | null;
  get fxRate(): Decimal | null {
    return this._fxRate;
  }

  private _lineDesc: string | null;

  get lineDesc(): string | null {
    return this._lineDesc;
  }

  /** DB’den (Prisma `Decimal`) ya da domain’den (`decimal.js`) gelen tutarı `decimal.js`’e indirger. */
  private static hydrate(value: { toString(): string }): Decimal {
    return new Decimal(value.toString());
  }

  public static create(
    entryId: string,
    props: CreateJournalEntryLineProps
  ): JournalLine {
    // hatalı giriş (negatif sayı, XOR ihlali vb.) anında exception fırlatır.

    const amount = JournalEntryLineAmount.create(
      new Decimal(props.debit ?? 0),
      new Decimal(props.credit ?? 0),
      Currency.create(props.currency).instance ??
        Currency.fromTrusted(Currency.enum.TRY)
    );

    // Orijinal (yabancı para) tutarlar da `Decimal(14,2)` kolonunda durur:
    // kuruş ölçeği onlar için de zorlanır, yoksa izlenebilirlik kolonu saklanan
    // değerden sapar ve `original × fxRate ≈ debit` mutabakatı hiç tutmaz.
    const originalDebit = JournalLine.toKurusOrThrow(props.originalDebit);
    const originalCredit = JournalLine.toKurusOrThrow(props.originalCredit);

    return new JournalLine({
      id: UUID.createOrGenerate(props.id).value,
      entryId,
      accountId: props.accountId,
      partyId: props.partyId ?? null,
      debit: amount.debit,
      credit: amount.credit,
      currency: amount.currency.value ?? 'TRY',
      originalDebit,
      originalCredit,
      originalCurrency: props.originalCurrency
        ? Currency.create(props.originalCurrency).orThrow().value
        : null,
      fxRate:
        props.fxRate != null ? new Decimal(props.fxRate.toString()) : null,
      lineDesc: props.lineDesc ?? null,
    });
  }

  /**
   * Orijinal para tutarını kuruş ölçeğinde doğrular; ölçek aşılırsa satır
   * tutarıyla **aynı** tipli hatayı fırlatır (tek kural, tek hata kimliği).
   */
  private static toKurusOrThrow(
    value: Decimal | string | number | null | undefined
  ): Decimal | null {
    if (value == null) return null;
    const decimal = new Decimal(value.toString());
    if (!Money.isKurusScaled(decimal)) {
      throw new InvalidJournalLineAmountException(
        `Orijinal para tutarı en çok iki ondalık hane taşıyabilir (gelen: ${decimal.toString()}).`
      );
    }
    return decimal;
  }

  public matchesAccount(accountId: string): boolean {
    return this._accountId === accountId;
  }

  public isDebit(): boolean {
    return this._amount.debit.gt(0);
  }

  public isCredit(): boolean {
    return this._amount.credit.gt(0);
  }

  public toPersistence(): IJournalLine {
    return {
      id: this._id,
      entryId: this._entryId,
      accountId: this._accountId,
      partyId: this._partyId,
      debit: this._amount.debit,
      credit: this._amount.credit,
      currency: this._amount.currency.value,
      originalDebit: this._originalDebit,
      originalCredit: this._originalCredit,
      originalCurrency: this._originalCurrency?.value ?? null,
      fxRate: this._fxRate,
      lineDesc: this._lineDesc,
    };
  }
}
