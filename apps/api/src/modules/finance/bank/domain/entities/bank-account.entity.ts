import { Decimal } from 'decimal.js';
import { BankAccount as IBankAccount } from '@model-schema/BankAccountSchema';
import {
  BankAccountStatusSchema,
  BankAccountStatusType as BankAccountStatus,
} from '@input-type-schemas/BankAccountStatusSchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { Currency, UUID } from '@src/domain/value-objects';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { CreateBankAccountProps } from '@modules/finance/bank/domain/contracts';
import { BankAccountArchivedException } from '@modules/finance/bank/domain/exceptions/bank.exceptions';

/**
 * Banka Hesabı (aggregate root). Klinik-başı operasyonel banka hesabı; ekstreler
 * bu hesaba import edilip mutabakat yapılır. Muhasebe posting'i YOK — 102 Bankalar
 * zaten payment/kasa köprüsünden beslenir; bu modül yalnızca mutabakat yapar.
 */
export class BankAccount extends AggregateRoot {
  constructor(data: IBankAccount) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._name = data.name;
    this._bankName = data.bankName;
    this._iban = data.iban;
    this._accountNo = data.accountNo;
    this._currency = Currency.fromTrusted(data.currency);
    this._status = data.status;
    this._openingBalance = new Decimal(data.openingBalance.toString());
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

  private _name: string;
  get name(): string {
    return this._name;
  }

  private _bankName: string;
  get bankName(): string {
    return this._bankName;
  }

  private _iban: string | null;
  get iban(): string | null {
    return this._iban;
  }

  private _accountNo: string | null;
  get accountNo(): string | null {
    return this._accountNo;
  }

  private _currency: Currency;
  get currency(): Currency {
    return this._currency;
  }

  private _status: BankAccountStatus;
  get status(): BankAccountStatus {
    return this._status;
  }

  private _openingBalance: Decimal;
  get openingBalance(): Decimal {
    return this._openingBalance;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  public static create(props: CreateBankAccountProps): BankAccount {
    const now = DateTimeManager.create();
    const id = UUID.createOrGenerate(props.id).value;

    return new BankAccount({
      id,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      name: props.name,
      bankName: props.bankName,
      iban: props.iban ?? null,
      accountNo: props.accountNo ?? null,
      currency: props.currency
        ? Currency.create(props.currency).orThrow().value
        : Currency.enum.TRY,
      status: BankAccountStatusSchema.enum.ACTIVE,
      openingBalance: new Decimal(props.openingBalance ?? 0),
      createdAt: now,
      updatedAt: now,
    });
  }

  public isActive(): boolean {
    return this._status === BankAccountStatusSchema.enum.ACTIVE;
  }

  /** Ekstre import'u için hesap aktif olmalı. */
  public assertActiveForImport(): void {
    if (!this.isActive()) {
      throw new BankAccountArchivedException(this._id.value);
    }
  }

  public archive(): void {
    if (!this.isActive()) {
      throw new BankAccountArchivedException(this._id.value);
    }
    this._status = BankAccountStatusSchema.enum.ARCHIVED;
    this._updatedAt = DateTimeManager.create();
  }

  public toPersistence(): IBankAccount {
    return {
      id: this.id.value,
      clinicId: this.clinicId.value,
      organizationId: this.organizationId.value,
      name: this.name,
      bankName: this.bankName,
      iban: this.iban,
      accountNo: this.accountNo,
      currency: this.currency.value,
      status: this.status,
      openingBalance: this.openingBalance,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
