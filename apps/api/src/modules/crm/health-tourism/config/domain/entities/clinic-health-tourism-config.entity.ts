import { ClinicHealthTourismConfig as IClinicHealthTourismConfig } from '@shared/generated-zod';
import { AggregateRoot } from '@common/domain/aggregate-root';
import {
  CreateClinicHealthTourismConfigProps,
  UpdateClinicHealthTourismConfigProps,
} from '../contracts/config';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { Currency } from '@src/domain/value-objects/currency.vo';
import { isDefined } from '@common/utils';
import { isNotUndefined } from '@common/utils/is-not-undefined';
import { Guard } from '@common/domain/guards';

/**
 * Kliniğin sağlık-turizmi (otel + transfer) config'i — 1:1 satellite. AI asistanı hangi
 * otelleri (allowlist öncelikli, yoksa şehir destinationCode) arayacağını ve transferin
 * hangi havalimanı/hedef üzerinden kurulacağını buradan okur.
 */
export class ClinicHealthTourismConfig extends AggregateRoot {
  constructor(data: IClinicHealthTourismConfig) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._isEnabled = data.isEnabled;
    this._destinationCode = data.destinationCode;
    this._nearbyHotelCodes = data.nearbyHotelCodes;
    this._airportIata = data.airportIata;
    this._clinicLocationType = data.clinicLocationType;
    this._clinicLocationCode = data.clinicLocationCode;
    this._pickupAddress = data.pickupAddress;

    this._defaultCurrency = Currency.fromTrusted(data.defaultCurrency);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _isEnabled: boolean;
  get isEnabled(): boolean {
    return this._isEnabled;
  }

  private _destinationCode: string | null;
  get destinationCode(): string | null {
    return this._destinationCode;
  }

  private _nearbyHotelCodes: string[];
  get nearbyHotelCodes(): string[] {
    return this._nearbyHotelCodes;
  }

  private _airportIata: string | null;
  get airportIata(): string | null {
    return this._airportIata;
  }

  private _clinicLocationType: string | null;
  get clinicLocationType(): string | null {
    return this._clinicLocationType;
  }

  private _clinicLocationCode: string | null;
  get clinicLocationCode(): string | null {
    return this._clinicLocationCode;
  }

  private _pickupAddress: string | null;
  get pickupAddress(): string | null {
    return this._pickupAddress;
  }

  private _defaultCurrency: Currency;
  get defaultCurrency(): Currency {
    return this._defaultCurrency;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** Allowlist doluysa onu, yoksa şehir destinationCode'unu kullan (B0 kararı). */
  public get effectiveHotelScope(): {
    hotelCodes: string[] | null;
    destinationCode: string | null;
  } {
    if (this._nearbyHotelCodes.length > 0) {
      return { hotelCodes: this._nearbyHotelCodes, destinationCode: null };
    }
    return { hotelCodes: null, destinationCode: this._destinationCode };
  }

  public get validate() {
    return {
      status: {
        isDisabled: this.isDisabled(),
      },
    };
  }

  public static create(
    props: CreateClinicHealthTourismConfigProps
  ): ClinicHealthTourismConfig {
    const now = DateTimeManager.create();

    const id = UUID.createOrGenerate(props.id);

    return new ClinicHealthTourismConfig({
      id: id.value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      isEnabled: props.isEnabled ?? false,
      destinationCode: props.destinationCode ?? null,
      nearbyHotelCodes: props.nearbyHotelCodes ?? [],
      airportIata: props.airportIata ?? null,
      clinicLocationType: props.clinicLocationType ?? null,
      clinicLocationCode: props.clinicLocationCode ?? null,

      pickupAddress: props.pickupAddress ?? null,

      defaultCurrency: props.defaultCurrency ?? Currency.enum.EUR,

      createdAt: now,
      updatedAt: now,
    });
  }

  /** Yalnız sağlanan (undefined olmayan) alanları günceller. */
  public updateSettings(props: UpdateClinicHealthTourismConfigProps): void {
    if (isDefined(props.isEnabled)) this._isEnabled = props.isEnabled;

    if (isNotUndefined(props.destinationCode)) {
      this._destinationCode = props.destinationCode;
    }

    if (isDefined(props.nearbyHotelCodes)) {
      this._nearbyHotelCodes = props.nearbyHotelCodes;
    }
    if (isNotUndefined(props.airportIata))
      this._airportIata = props.airportIata;

    if (isNotUndefined(props.clinicLocationType)) {
      this._clinicLocationType = props.clinicLocationType;
    }
    if (isNotUndefined(props.clinicLocationCode)) {
      this._clinicLocationCode = props.clinicLocationCode;
    }
    if (isNotUndefined(props.pickupAddress)) {
      this._pickupAddress = props.pickupAddress;
    }

    if (isDefined(props.defaultCurrency)) {
      this._defaultCurrency = Currency.create(props.defaultCurrency).orThrow();
    }
  }

  public enable(): void {
    this._isEnabled = true;
  }

  public disable(): void {
    this._isEnabled = false;
  }

  public toPersistence(): IClinicHealthTourismConfig {
    return {
      id: this.id.value,
      isEnabled: this.isEnabled,
      destinationCode: this.destinationCode,
      nearbyHotelCodes: this.nearbyHotelCodes,
      airportIata: this.airportIata,
      clinicLocationType: this.clinicLocationType,
      clinicLocationCode: this.clinicLocationCode,
      pickupAddress: this.pickupAddress,
      defaultCurrency: this.defaultCurrency.value,
      clinicId: this.clinicId.value,
      organizationId: this.organizationId.value,
      createdAt: this.createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }

  private isDisabled() {
    const isDisabled = !this._isEnabled;
    return Guard.monitor(
      isDisabled,
      isDisabled,
      () => new Error('Ayarlar pasif değil')
    );
  }
}
