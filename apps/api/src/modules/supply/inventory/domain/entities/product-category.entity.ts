import { ProductCategory as IProductCategory } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { CreateProductCategoryProps } from '@modules/supply/inventory/domain/contracts';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { Name } from '@src/domain/value-objects/name.vo';
import { UUID } from '@src/domain/value-objects/uuid.vo';

export class ProductCategory extends AggregateRoot {
  constructor(data: IProductCategory) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._name = Name.fromTrusted(data.name);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._parentId = UUID.create(data.parentId).instance ?? null;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _name: Name;
  get name(): Name {
    return this._name;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _parentId: UUID | null;
  get parentId(): UUID | null {
    return this._parentId;
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
   * Domain kurallarına uygun olarak yeni bir Ürün Kategorisi (Aggregate) oluşturur.
   */
  public static create(props: CreateProductCategoryProps): ProductCategory {
    const now = DateTimeManager.create();

    const name = Name.create(props.name).orThrow();

    return new ProductCategory({
      id: UUID.createOrGenerate(props.id).value,
      name: name.value,

      organizationId: UUID.create(props.organizationId).orThrow().value,
      clinicId: UUID.create(props.clinicId).orThrow().value,

      parentId: props.parentId
        ? UUID.create(props.parentId).orThrow().value
        : null,

      createdAt: now,
      updatedAt: now,
    });
  }

  public rename(name: string): void {
    this._name = Name.create(name).orThrow();
    this._updatedAt = DateTimeManager.create();
  }

  toPersistence(): IProductCategory {
    return {
      id: this.id.value,
      name: this.name.value,
      organizationId: this.organizationId.value,
      clinicId: this.clinicId.value,
      parentId: this.parentId?.value ?? null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
