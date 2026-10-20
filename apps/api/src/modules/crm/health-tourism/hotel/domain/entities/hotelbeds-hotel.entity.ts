import { HotelbedsHotel as IHotelbedsHotel } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { JsonValueType as JsonValue } from '@input-type-schemas/JsonValueSchema';
import { Coordinates } from '@src/domain/value-objects/coordinates.vo';
import { CreateHotelbedsHotelProps } from '@modules/crm/health-tourism/hotel/domain/contracts';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Name } from '@src/domain/value-objects/name.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

export class HotelbedsHotel extends AggregateRoot {
  constructor(data: IHotelbedsHotel) {
    super();

    this._id = UUID.fromTrusted(data.id);
    this._name = Name.fromTrusted(data.name);
    this._categoryCode = data.categoryCode;

    this._categoryName = data.categoryName
      ? Name.fromTrusted(data.categoryName)
      : null;
    this._destinationCode = data.destinationCode;

    this._destinationName = data.destinationName
      ? Name.fromTrusted(data.destinationName)
      : null;

    this._address = data.address;

    this._images = data.images;
    this._phones = data.phones;
    this._lastSyncedAt = data.lastSyncedAt;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;

    this._coordinates =
      Coordinates.create(data.latitude, data.longitude).instance ?? null;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Private Properties & Getters
  // ────────────────────────────────────────────────────────────────────────────
  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _name: Name;
  get name(): Name {
    return this._name;
  }

  private _categoryCode: string;
  get categoryCode(): string {
    return this._categoryCode;
  }

  private _categoryName: Name | null;
  get categoryName(): Name | null {
    return this._categoryName;
  }

  private _destinationCode: string;
  get destinationCode(): string {
    return this._destinationCode;
  }

  private _destinationName: Name | null;
  get destinationName(): Name | null {
    return this._destinationName;
  }

  private _address: string | null;
  get address(): string | null {
    return this._address;
  }

  get latitude(): number | null {
    return this._coordinates?.longitude ?? null;
  }

  get longitude(): number | null {
    return this._coordinates?.longitude ?? null;
  }

  private _coordinates: Coordinates | null;
  get coordinates(): Coordinates | null {
    return this._coordinates;
  }

  private _images: JsonValue | null;
  get images(): JsonValue | null {
    return this._images;
  }

  private _phones: JsonValue | null;
  get phones(): JsonValue | null {
    return this._phones;
  }

  private _lastSyncedAt: Date;
  get lastSyncedAt(): Date {
    return this._lastSyncedAt;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  Static Create Method (Factory)
  // ────────────────────────────────────────────────────────────────────────────
  public static create(props: CreateHotelbedsHotelProps): HotelbedsHotel {
    const coordinates = Coordinates.create(
      props.latitude,
      props.longitude
    ).instance;

    const id = UUID.createOrGenerate(props.id);

    const now = DateTimeManager.create();

    return new HotelbedsHotel({
      id: id.value,
      name: props.name,
      categoryCode: props.categoryCode,
      categoryName: props.categoryName ?? null,
      destinationCode: props.destinationCode,
      destinationName: props.destinationName ?? null,
      address: props.address ?? null,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      images: props.images ?? null,
      phones: props.phones ?? null,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Otelin verilen başka bir lokasyona (Örn: Havalimanı veya merkeze) olan mesafesini metre cinsinden söyler.
   */
  public distanceTo(target: Coordinates): number | null {
    if (!this._coordinates) return null;
    return this._coordinates.distanceTo(target);
  }

  /**
   * Otel koordinatlarını manuel veya senkronizasyon esnasında günceller.
   */
  public updateCoordinates(coordinates: Coordinates): void {
    this._coordinates = coordinates;
    this._updatedAt = DateTimeManager.create();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Mapping to Persistence
  // ────────────────────────────────────────────────────────────────────────────
  public toPersistence(): IHotelbedsHotel {
    return {
      id: this.id.value,
      name: this.name.value,
      categoryCode: this.categoryCode,
      categoryName: this.categoryName?.value ?? null,
      destinationCode: this.destinationCode,
      destinationName: this.destinationName?.value ?? null,
      address: this.address,
      latitude: this.latitude,
      longitude: this.longitude,
      images: this.images ?? null,
      phones: this.phones ?? null,
      lastSyncedAt: this.lastSyncedAt,
      createdAt: this.createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }
}
