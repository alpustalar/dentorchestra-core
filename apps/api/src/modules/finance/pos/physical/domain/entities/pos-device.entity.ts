import { PosDevice as IPosDevice } from '@prisma/client';
import { AggregateRoot } from '@common/domain/aggregate-root';
import PosProviderSchema, {
  PosProviderType as PosProvider,
} from '@input-type-schemas/PosProviderSchema';
import {
  CreatePosDeviceProps,
  PaxConnection,
} from '@modules/finance/pos/physical/domain/contracts/pos-device';
import {
  PosDeviceClinicMismatchException,
  PosDeviceInactiveException,
  PosDeviceMissingDeviceUniqueIdException,
  PosDeviceProviderMismatchException,
} from '@modules/finance/pos/physical/domain/exceptions/pos.exceptions';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Guard } from '@common/domain/guards';
import { Name } from '@src/domain/value-objects/name.vo';

export class PosDevice extends AggregateRoot {
  constructor(data: IPosDevice) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._label = Name.fromTrusted(data.label);
    this._provider = data.provider;
    this._terminalId = data.terminalId;
    this._merchantId = data.merchantId;
    this._host = data.host;
    this._port = data.port;
    this._deviceUniqueId = data.deviceUniqueId;
    this._isActive = data.isActive;
    this._isDeleted = data.isDeleted;
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

  private _label: Name;
  get label(): Name {
    return this._label;
  }

  private _provider: PosProvider;
  get provider(): PosProvider {
    return this._provider;
  }

  private _terminalId: string | null;
  get terminalId(): string | null {
    return this._terminalId;
  }

  private _merchantId: string | null;
  get merchantId(): string | null {
    return this._merchantId;
  }

  private _host: string | null;
  get host(): string | null {
    return this._host;
  }

  private _port: number | null;
  get port(): number | null {
    return this._port;
  }

  private _deviceUniqueId: string | null;
  get deviceUniqueId(): string | null {
    return this._deviceUniqueId;
  }

  private _isActive: boolean;
  get isActive(): boolean {
    return this._isActive;
  }

  private _isDeleted: boolean;
  get isDeleted(): boolean {
    return this._isDeleted;
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
      posDevice: {
        isPax: this._isPax,
        isIyzicoTerminal: this._isIyzicoTerminal,
      },
      status: {
        isActive: (() => {
          const activeStatus = this._isActive;
          return {
            isValid: activeStatus,
            orThrow: () => {
              if (!activeStatus) throw new PosDeviceInactiveException();
            },
          };
        })(),
      },
    };
  }

  /**
   * Cihazın hedef kliniğe ait olduğunu doğrular.
   *
   * Kural entity'de: cihazı yükleyen HER akış (satış, iade, void, gün sonu) bunu
   * çağırmak zorunda; kontrolü handler'lara dağıtmak birini atlamayı kolaylaştırırdı
   * (nitekim atlanmıştı).
   */
  public assertBelongsToClinic(clinicId: string): void {
    if (this._clinicId.value !== clinicId) {
      throw new PosDeviceClinicMismatchException(
        this._clinicId.value,
        clinicId
      );
    }
  }

  /**
   * iyzico Terminal cihaz benzersiz kimliğini null-güvenli döner. Cihaz iyzico
   * terminal değilse veya deviceUniqueId yoksa domain hatası fırlatır.
   */
  public get iyzicoDeviceUniqueId() {
    this._isIyzicoTerminal.orThrow();

    const isInvalid = this._deviceUniqueId === null;

    return Guard.monitor(
      this.deviceUniqueId ?? undefined,
      !isInvalid,
      () => new PosDeviceMissingDeviceUniqueIdException()
    );
  }

  private get _isPax(): Guard<boolean> {
    const isPax = this._provider === PosProviderSchema.enum.PAX;
    return Guard.monitor(
      isPax,
      isPax,
      () =>
        new PosDeviceProviderMismatchException(
          PosProviderSchema.enum.PAX,
          this._provider
        )
    );
  }

  private get _isIyzicoTerminal(): Guard<boolean> {
    const isIyzico = this._provider === PosProviderSchema.enum.IYZICO_TERMINAL;
    return Guard.monitor(
      isIyzico,
      isIyzico,
      () =>
        new PosDeviceProviderMismatchException(
          PosProviderSchema.enum.IYZICO_TERMINAL,
          this._provider
        )
    );
  }

  public static create(props: CreatePosDeviceProps): PosDevice {
    const now = DateTimeManager.create();

    return new PosDevice({
      id: UUID.createOrGenerate(props.id).value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      provider: props.provider,
      label: Name.create(props.label).orThrow().value,
      terminalId: props.terminalId ?? null,
      merchantId: props.merchantId ?? null,
      host: props.host ?? null,
      port: props.port ?? null,
      deviceUniqueId: props.deviceUniqueId ?? null,
      isActive: true,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * PAX TCP bağlantı bilgisini null-güvenli döner. Cihaz PAX değilse veya
   * bağlantı alanları eksikse domain hatası fırlatır.
   */
  public getPaxConnection(): PaxConnection {
    this._isPax.orThrow();

    if (
      this._host === null ||
      this._port === null ||
      this._terminalId === null ||
      this._merchantId === null
    ) {
      throw new PosDeviceProviderMismatchException(
        PosProviderSchema.enum.PAX,
        this._provider,
        'PAX cihazı için host, port, terminalId ve merchantId zorunludur.'
      );
    }
    return {
      host: this._host,
      port: this._port,
      terminalId: this._terminalId,
      merchantId: this._merchantId,
    };
  }

  public deactivate(): void {
    this._isActive = false;
    this._updatedAt = DateTimeManager.create();
  }

  public softDelete(): void {
    this._isActive = false;
    this._isDeleted = true;
    this._updatedAt = DateTimeManager.create();
  }

  public toPersistence(): IPosDevice {
    return {
      id: this._id.value,
      clinicId: this._clinicId.value,
      label: this._label.value,
      provider: this._provider,
      terminalId: this._terminalId,
      merchantId: this._merchantId,
      host: this._host,
      port: this._port,
      deviceUniqueId: this._deviceUniqueId,
      isActive: this._isActive,
      isDeleted: this._isDeleted,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
