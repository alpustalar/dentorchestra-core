import { Party as IParty } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { PartyTypeType as PartyType } from '@input-type-schemas/PartyTypeSchema';
import { PartyRoleType as PartyRole } from '@input-type-schemas/PartyRoleSchema';
import { PartyOriginTypeType as PartyOriginType } from '@input-type-schemas/PartyOriginTypeSchema';
import { CreatePartyProps } from '@modules/finance/party/domain/contracts/party';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Name } from '@src/domain/value-objects/name.vo';
import { DateTimeManager, isDefined } from '@common/utils';
import { isNotUndefined } from '@common/utils/is-not-undefined';
import { Email } from '@src/domain/value-objects/email.vo';
import { Phone } from '@src/domain/value-objects/phone.vo';
import { TckNo } from '@src/domain/value-objects/tck-no.vo';
import { Guard } from '@common/domain/guards';
import { PartyRoleMissingException } from '@modules/finance/party/domain/exceptions/party.exceptions';

export class Party extends AggregateRoot {
  constructor(data: IParty) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._type = data.type;
    this._roles = data.roles;
    this._name = Name.fromTrusted(data.name);
    this._taxNumber = data.taxNumber;
    this._nationalId = TckNo.create(data.nationalId).instance ?? null;
    this._taxOffice = data.taxOffice;
    this._email = Email.create(data.email).instance ?? null;
    this._phone = Phone.create(data.phone).instance ?? null;
    this._address = data.address;
    this._isEInvoiceUser = data.isEInvoiceUser;
    this._eInvoiceMailbox = data.eInvoiceMailbox;
    this._receivableAccountId = data.receivableAccountId;
    this._payableAccountId = data.payableAccountId;
    this._originType = data.originType;
    this._originId = data.originId;
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

  private _type: PartyType;
  get type(): PartyType {
    return this._type;
  }

  private _roles: PartyRole[];
  get roles(): PartyRole[] {
    return this._roles;
  }

  private _name: Name;
  get name(): Name {
    return this._name;
  }

  private _taxNumber: string | null;
  get taxNumber(): string | null {
    return this._taxNumber;
  }

  private _nationalId: TckNo | null;
  get nationalId(): TckNo | null {
    return this._nationalId;
  }

  private _taxOffice: string | null;
  get taxOffice(): string | null {
    return this._taxOffice;
  }

  private _email: Email | null;
  get email(): Email | null {
    return this._email;
  }

  private _phone: Phone | null;
  get phone(): Phone | null {
    return this._phone;
  }

  private _address: string | null;
  get address(): string | null {
    return this._address;
  }

  private _isEInvoiceUser: boolean;
  get isEInvoiceUser(): boolean {
    return this._isEInvoiceUser;
  }

  private _eInvoiceMailbox: string | null;
  get eInvoiceMailbox(): string | null {
    return this._eInvoiceMailbox;
  }

  private _receivableAccountId: string | null;
  get receivableAccountId(): string | null {
    return this._receivableAccountId;
  }

  private _payableAccountId: string | null;
  get payableAccountId(): string | null {
    return this._payableAccountId;
  }

  private _originType: PartyOriginType;
  get originType(): PartyOriginType {
    return this._originType;
  }

  private _originId: string | null;
  get originId(): string | null {
    return this._originId;
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

  public get validate() {
    return {
      hasRole: (role: PartyRole) => this.hasRole(role),
    };
  }

  public static create(props: CreatePartyProps): Party {
    const now = DateTimeManager.create();
    return new Party({
      id: UUID.createOrGenerate(props.id).value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      type: props.type,
      roles: props.roles,
      name: Name.create(props.name).orThrow().value,
      taxNumber: props.taxNumber ?? null,

      nationalId: props.nationalId
        ? TckNo.create(props.nationalId).orThrow().value
        : null,

      taxOffice: props.taxOffice ?? null,

      email: props.email ? Email.create(props.email).orThrow().value : null,

      phone: props.phone ?? null,
      address: props.address ?? null,
      isEInvoiceUser: props.isEInvoiceUser ?? false,
      eInvoiceMailbox: props.eInvoiceMailbox ?? null,
      receivableAccountId: props.receivableAccountId ?? null,
      payableAccountId: props.payableAccountId ?? null,
      originType: props.originType,
      originId: props.originId ?? null,
      isActive: props.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
  }

  public ensure(input: EnsurePartySnapshot) {
    this.addRole(input.role);

    // Pasif cari YENİDEN AKTİFLEŞTİRİLİR. `isActive` hiçbir yerde okunmuyordu
    // (ne çözümleme ne fişleme noktasında) — yani bir güvence değil süstü.
    // Kural: varlığın değişmez koşulu çözümlendiği yerde zorlanır
    // (CLAUDE.md finans kuralı 10). Burada doğru davranış engellemek DEĞİL
    // aktifleştirmektir: cari için yeni bir mali hareket geldiyse o cari
    // fiilen aktiftir; yazmayı durdurmak parayı defterin dışında bırakırdı.
    // Pasif kalsaydı `?isActive=true` süzgeçli cari mutabakatı bakiyesi olan
    // bir cariyi hiç göstermezdi.
    if (!this._isActive) this.activate();

    // Kimlik/iletişim alanlarında `null` "bilinmiyor" demektir, "yok" değil:
    // kaynak kayıtta TCKN boşsa bilinen TCKN SİLİNMEZ. Silinirse e-fatura
    // kesimi (gerçek kişide TCKN zorunlu) sessizce durur ve değer geri
    // getirilemez. Değer temizlemek bilinçli bir düzenleme işidir; otomatik
    // köprünün işi değildir.
    this.updateSnapshot({
      name: input.name,
      taxNumber: input.taxNumber ?? undefined,
      nationalId: input.nationalId ?? undefined,
      taxOffice: input.taxOffice ?? undefined,
      email: input.email ?? undefined,
      phone: input.phone ?? undefined,
      address: input.address ?? undefined,
    });
  }

  /**
   * Rolü ekler (idempotent). Eklendiyse true döner.
   *
   * `hasRole` bir `Guard` **nesnesi** döndürüyor ve koşul doğrudan nesne
   * üzerinde çalışıyordu: nesne daima truthy olduğu için `addRole` HİÇ rol
   * eklemiyordu, her zaman `false` dönüyordu. Derleyici görmez (nesne de
   * geçerli bir koşul ifadesidir); sonucu, aynı kaynağın ikinci rolünü
   * (hastanın aynı zamanda müşteri, personelin aynı zamanda tedarikçi olması)
   * hiç kazanmaması ve rol süzgeçli cari listelerinin eksik çalışmasıydı.
   */
  public addRole(role: PartyRole): boolean {
    if (this.hasRole(role).value) return false;
    this._roles = [...this._roles, role];
    return true;
  }

  /** Kaynak kayıttan gelen kimlik/iletişim snapshot'ını günceller. */
  public updateSnapshot(
    snapshot: Partial<
      Pick<
        IParty,
        | 'name'
        | 'taxNumber'
        | 'nationalId'
        | 'taxOffice'
        | 'email'
        | 'phone'
        | 'address'
      >
    >
  ): void {
    if (isDefined(snapshot.name)) {
      this._name = Name.create(snapshot.name).orThrow();
    }
    if (isNotUndefined(snapshot.taxNumber))
      this._taxNumber = snapshot.taxNumber;

    if (isNotUndefined(snapshot.nationalId)) {
      this._nationalId = snapshot.nationalId
        ? TckNo.create(snapshot.nationalId).orThrow()
        : null;
    }
    if (isNotUndefined(snapshot.taxOffice))
      this._taxOffice = snapshot.taxOffice;

    if (isNotUndefined(snapshot.email))
      this._email = snapshot.email
        ? Email.create(snapshot.email).orThrow()
        : null;

    if (isNotUndefined(snapshot.phone))
      this._phone = snapshot.phone
        ? Phone.create(snapshot.phone).orThrow()
        : null;

    if (isNotUndefined(snapshot.address)) this._address = snapshot.address;
  }

  public linkReceivableAccount(accountId: string): void {
    this._receivableAccountId = accountId;
  }

  public linkPayableAccount(accountId: string): void {
    this._payableAccountId = accountId;
  }

  public deactivate(): void {
    this._isActive = false;
  }

  public activate(): void {
    this._isActive = true;
  }

  public toPersistence(): IParty {
    return {
      id: this._id.value,
      clinicId: this._clinicId.value,
      organizationId: this._organizationId.value,
      type: this._type,
      roles: this._roles,
      name: this._name.value,
      taxNumber: this._taxNumber,
      nationalId: this._nationalId?.value ?? null,
      taxOffice: this._taxOffice,
      email: this._email?.value ?? null,
      phone: this._phone?.value ?? null,
      address: this._address,
      isEInvoiceUser: this._isEInvoiceUser,
      eInvoiceMailbox: this._eInvoiceMailbox,
      receivableAccountId: this._receivableAccountId,
      payableAccountId: this._payableAccountId,
      originType: this._originType,
      originId: this._originId,
      isActive: this._isActive,
      createdAt: this._createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }

  private hasRole(role: PartyRole): Guard<boolean> {
    const has = this._roles.includes(role);
    return Guard.monitor(has, has, () => new PartyRoleMissingException(role));
  }
}

/** Kaynak kayıttan taşınan kimlik/iletişim anlık görüntüsü. */
export interface EnsurePartySnapshot {
  role: PartyRole;
  name: string;
  taxNumber?: string | null;
  nationalId?: string | null;
  taxOffice?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}
