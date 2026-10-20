import {
  TreatmentPackage as ITreatmentPackage,
  TreatmentPackageItem,
  TreatmentPackageProvider,
} from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';

import {
  TreatmentPackageCreatedEvent,
  TreatmentPackageDeletedEvent,
  TreatmentPackageUpdatedEvent,
} from '@modules/clinical/treatment-package/domain/events';
import { Money } from '@src/domain/value-objects/money.vo';
import {
  CreateTreatmentPackageProps,
  TreatmentPackageItemProps,
  UpdateTreatmentPackageProps,
} from '@modules/clinical/treatment-package/domain/contracts';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { isNotUndefined } from '@common/utils/is-not-undefined';
import { Currency } from '@src/domain/value-objects/currency.vo';
import { Guard } from '@common/domain/guards';
import { ValidateOptionsType } from '@shared/common/validate-options/validate-options.type';
import { TreatmentPackageRules } from '@modules/clinical/treatment-package/domain/rules/treatment-package.rules';
import { TreatmentPackageNameEmptyException } from '@modules/clinical/treatment-package/domain/exceptions/treatment-package.exceptions';

export class TreatmentPackage extends AggregateRoot {
  constructor(
    data: ITreatmentPackage & {
      providers?: TreatmentPackageProvider[];
      items?: TreatmentPackageItem[];
    }
  ) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._name = data.name;
    this._examinationCount = data.examinationCount;
    this._controlCount = data.controlCount;
    this._validityDays = data.validityDays;
    this._price = Money.fromTrusted(data.price, data.currency);
    this._isActive = data.isActive;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
    this._deletedAt = data.deletedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _name: string;
  get name(): string {
    return this._name;
  }

  private _examinationCount: number;
  get examinationCount(): number {
    return this._examinationCount;
  }

  private _controlCount: number;
  get controlCount(): number {
    return this._controlCount;
  }

  private _validityDays: number;
  get validityDays(): number {
    return this._validityDays;
  }

  private _price: Money;
  get price(): Money {
    return this._price;
  }

  private _isActive: boolean;
  get isActive(): boolean {
    return this._isActive;
  }

  get currency(): Currency {
    return Currency.fromTrusted(this.price.currency);
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  private _deletedAt: Date | null;
  get deletedAt(): Date | null {
    return this._deletedAt;
  }

  get validate() {
    return {
      isDeleted: this.isDeleted,
    };
  }

  /**
   * Repository update() tarafından senkronlanacak ilişki yazma niyeti.
   * `undefined` → ilişkilere dokunma; dizi → mevcut ilişkileri bu set ile değiştir.
   * Prisma scalar modeline ait olmadıkları için toPersistence() dışında tutulur.
   */
  private _providerIdsToSync?: string[];

  get providerIdsToSync(): string[] | undefined {
    return this._providerIdsToSync;
  }

  private _itemsToSync?: TreatmentPackageItemProps[];

  get itemsToSync(): TreatmentPackageItemProps[] | undefined {
    return this._itemsToSync;
  }

  get totalSessionCount(): number {
    return this._examinationCount + this._controlCount;
  }

  private get isDeleted() {
    const is = !!this.deletedAt;
    return Guard.monitor(is, is, () => new Error('Tedavi paketi silinmemiş'));
  }

  public static create(props: CreateTreatmentPackageProps): TreatmentPackage {
    // İsim boşluğu kuralı: eskiden CreateTreatmentPackageSchema'nın `.min(1)`
    // kısıtıydı; şema yalnız spec dosyasında `.parse()` ediliyordu (gerçek
    // uygulama akışında hiç çağrılmıyordu). Zod kaldırılırken kural burada,
    // entity'nin kendisinde gerçek zamanlı enforce edilecek şekilde taşındı.
    Guard.monitor(
      props.name,
      props.name.length > 0,
      () => new TreatmentPackageNameEmptyException()
    ).orThrow();

    const now = DateTimeManager.create();

    const entity = new TreatmentPackage({
      id: UUID.createOrGenerate(props.id).value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      name: props.name,
      examinationCount: props.examinationCount,
      controlCount: props.controlCount,
      validityDays: props.validityDays,
      price: props.price.value,
      currency: props.price.currency,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    entity._providerIdsToSync = props.providerIds ?? [];
    entity._itemsToSync = props.items ?? [];

    entity.addDomainEvent(
      new TreatmentPackageCreatedEvent({
        packageId: entity.id.value,
        clinicId: entity.clinicId.value,
        name: entity.name,
      })
    );

    return entity;
  }

  public rules(validateOptions: ValidateOptionsType) {
    return new TreatmentPackageRules(this, validateOptions);
  }

  public update(props: UpdateTreatmentPackageProps): void {
    if (isNotUndefined(props.name)) {
      this._name = props.name;
    }
    if (isNotUndefined(props.examinationCount))
      this._examinationCount = props.examinationCount;
    if (isNotUndefined(props.controlCount))
      this._controlCount = props.controlCount;
    if (isNotUndefined(props.validityDays))
      this._validityDays = props.validityDays;

    if (isNotUndefined(props.price)) {
      this._price = props.price;
    }
    if (isNotUndefined(props.isActive)) this._isActive = props.isActive;

    if (isNotUndefined(props.providerIds))
      this._providerIdsToSync = props.providerIds;

    if (isNotUndefined(props.items)) this._itemsToSync = props.items;

    this._updatedAt = DateTimeManager.create();

    this.addDomainEvent(
      new TreatmentPackageUpdatedEvent({
        packageId: this.id.value,
        clinicId: this.clinicId.value,
      })
    );
  }

  public activate(): void {
    this._isActive = true;
    this._updatedAt = DateTimeManager.create();
  }

  public deactivate(): void {
    this._isActive = false;
    this._updatedAt = DateTimeManager.create();
  }

  public switchActiveStatus(): void {
    this._isActive = !this.isActive;
    this._updatedAt = DateTimeManager.create();
  }

  public softDelete(): void {
    if (this.deletedAt) return;

    const now = DateTimeManager.create();
    this._deletedAt = now;
    this._updatedAt = now;

    this.deactivate();

    this.addDomainEvent(
      new TreatmentPackageDeletedEvent({
        packageId: this.id.value,
        clinicId: this.clinicId.value,
      })
    );
  }

  toPersistence(): ITreatmentPackage {
    return {
      id: this.id.value,
      clinicId: this.clinicId.value,
      name: this.name,
      examinationCount: this.examinationCount,
      controlCount: this.controlCount,
      validityDays: this.validityDays,
      price: this.price.value,
      currency: this.price.currency,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
    };
  }
}
