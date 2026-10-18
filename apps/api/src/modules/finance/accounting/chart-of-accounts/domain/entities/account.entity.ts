import { Account as IAccount, AccountSideSchema } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import {
  AccountTemplateNode,
  CLINIC_CHART_OF_ACCOUNTS_TEMPLATE,
} from '../constants/clinic-chart-of-accounts.template';
import { AccountCode } from '@modules/finance/accounting/chart-of-accounts/domain/value-objects/account-code.vo';
import { Currency } from '@src/domain/value-objects/currency.vo';
import { AccountTypeType as AccountType } from '@input-type-schemas/AccountTypeSchema';
import { AccountSideType as AccountSide } from '@input-type-schemas/AccountSideSchema';
import {
  CreateAccountProps,
  CreateChildAccountProps,
} from '@modules/finance/accounting/chart-of-accounts/domain/contracts/account';
import {
  AccountCodeHierarchyMismatchException,
  CannotCreateChildException,
} from '@modules/finance/accounting/chart-of-accounts/domain/exceptions/chart-of-accounts.exceptions';
import { ChartTemplateIntegrity } from '@modules/finance/accounting/chart-of-accounts/domain/services/template-integrity/chart-template-integrity';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Name } from '@src/domain/value-objects/name.vo';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';

export interface BuildChartInput {
  clinicId: string;
  organizationId: string;
  /**
   * Şubede zaten duran hesapların `code -> id` eşlemesi. Şablon büyüdüğünde eksik
   * hesapların eklenebilmesi için şart: yeni bir alt hesabın `parentId`'si, üst
   * hesabın DB'deki GERÇEK id'sine işaret etmeli — yeniden üretilen bir UUID'ye
   * değil (aksi hâlde FK ihlali ya da ağacın kopması).
   */
  existingIdByCode?: Readonly<Record<string, string>>;
}

export class Account extends AggregateRoot {
  constructor(data: IAccount) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._code = AccountCode.fromTrusted(data.code);
    this._name = Name.fromTrusted(data.name);
    this._parentId = data.parentId;
    this._type = data.type;
    this._normalSide = data.normalSide;
    this._isPostable = data.isPostable;
    this._requiresParty = data.requiresParty;
    this._currency = Currency.create(data.currency)?.instance ?? null;

    this._isActive = data.isActive;
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

  private _code: AccountCode;
  get code(): AccountCode {
    return this._code;
  }

  private _name: Name;
  get name(): Name {
    return this._name;
  }

  private _parentId: string | null;
  get parentId(): string | null {
    return this._parentId;
  }

  private _type: AccountType;
  get type(): AccountType {
    return this._type;
  }

  private _normalSide: AccountSide;
  get normalSide(): AccountSide {
    return this._normalSide;
  }

  private _isPostable: boolean;
  get isPostable(): boolean {
    return this._isPostable;
  }

  private _requiresParty: boolean;
  get requiresParty(): boolean {
    return this._requiresParty;
  }

  private _currency: Currency | null;
  get currency(): Currency | null {
    return this._currency;
  }

  private _isActive: boolean;
  get isActive(): boolean {
    return this._isActive;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  public static create(props: CreateAccountProps): Account {
    const accountCode = AccountCode.create(props.code);
    const currencyStr =
      Currency.create(props.currency)?.instance?.value ?? null;

    const now = DateTimeManager.create();

    const name = Name.create(props.name).orThrow();

    return new Account({
      id: UUID.createOrGenerate(props.id).value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      code: accountCode.value,
      name: name.value,
      parentId: props.parentId ?? null,
      type: props.type,
      normalSide: props.normalSide,
      isPostable: props.isPostable ?? true,
      requiresParty: props.requiresParty ?? false,
      currency: currencyStr,
      isActive: props.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Bir şablondan tüm hesap ağacını üretir. `parentId`'ler önceden üretilen
   * UUID'ler üzerinden (code → id) çözülür; böylece tek bir bulk insert yeterli olur.
   */
  public static buildChartFromTemplate(
    input: BuildChartInput,
    template: readonly AccountTemplateNode[] = CLINIC_CHART_OF_ACCOUNTS_TEMPLATE
  ): Account[] {
    const { clinicId, organizationId, existingIdByCode = {} } = input;

    // Mevcut hesaplar kimliklerini KORUR; yalnız eksik olanlara yeni UUID üretilir.
    const idByCode = new Map<string, string>();
    template.forEach((node) =>
      idByCode.set(
        node.code,
        existingIdByCode[node.code] ?? UUID.generate().value
      )
    );

    // Şablon bozuksa sessizce kök hesap üretmek yerine sesli hata ver: ağacın
    // kopması mizanı bozar ve kimse fark etmez. Doğrulama tek yerde
    // (`ChartTemplateIntegrity`) — aynı kontrol açılışta da çalışıyor.
    ChartTemplateIntegrity.assertTemplateIsConsistent(template);

    return template.map((node) => {
      return Account.create({
        id: idByCode.get(node.code),
        clinicId,
        organizationId,
        code: node.code,
        name: node.name,
        parentId: node.parentCode ? idByCode.get(node.parentCode)! : null,
        type: node.type,
        normalSide: node.normalSide,
        isPostable: node.isPostable,
        requiresParty: node.requiresParty ?? false,
      });
    });
  }

  public createChild(props: CreateChildAccountProps): Account {
    // İş Kuralı: Eğer bu hesaba daha önce doğrudan kayıt atılabiliyorduysa,
    // altına çocuk açıldığı an bu hesap artık "kolektif/ana" hesap olur ve doğrudan kayıt kabul etmez.
    if (this._isPostable) {
      throw new CannotCreateChildException(this._code.value);
    }

    // Kod, üst hesabın kodunu önek olarak taşımalı. Aksi hâlde ağaç (`parentId`)
    // ile kod hiyerarşisi ayrışır: kod önekine göre toplayan rapor ile ağaca göre
    // toplayan rapor aynı defterde farklı sonuç verir.
    const childCode = AccountCode.create(props.code);
    if (childCode.parentCode !== this._code.value) {
      throw new AccountCodeHierarchyMismatchException(
        childCode.value,
        this._code.value
      );
    }

    return Account.create({
      ...props,
      parentId: this.id.value,
      clinicId: this.clinicId.value,
      organizationId: this.organizationId.value,
      type: this.type, // Ana hesaptan miras
      normalSide: this.normalSide, // Ana hesaptan miras
      isPostable: true, // Yeni açılan uç hesap varsayılan olarak aktiftir
    });
  }

  public isDebitNormal(): boolean {
    return this._normalSide === AccountSideSchema.enum.DEBIT;
  }

  public deactivate(): void {
    this._isActive = false;
    this._updatedAt = DateTimeManager.create();
  }

  public activate(): void {
    this._isActive = true;
    this._updatedAt = DateTimeManager.create();
  }

  public rename(newName: string): void {
    this._name = Name.create(newName).orThrow();
    this._updatedAt = DateTimeManager.create();
  }

  public toPersistence(): IAccount {
    return {
      id: this.id.value,
      clinicId: this.clinicId.value,
      organizationId: this.organizationId.value,
      code: this.code.value,
      name: this.name.value,
      parentId: this.parentId,
      type: this.type,
      normalSide: this.normalSide,
      isPostable: this.isPostable,
      requiresParty: this.requiresParty,
      currency: this.currency ? this.currency.value : null,
      isActive: this.isActive,
      createdAt: this.createdAt,
      // Saf okuma: iki çağrı aynı sonucu vermeli. `now()` burada üretilirse
      // entity'nin kendi `_updatedAt` damgası hiç yazılmaz.
      updatedAt: this._updatedAt,
    };
  }
}
