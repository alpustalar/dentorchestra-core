import { ClinicInstagramChannel as IClinicInstagramChannel } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { CreateClinicInstagramChannelProps } from '@modules/channel-config/domain/channel-config.contracts';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { UUID } from '@src/domain/value-objects/uuid.vo';

/**
 * Kliniğin Instagram DM kanal config'i (messaging bounded-context). Clinic'ten ayrıştırılmış
 * 1:1 satellite. Meta Graph API (Messenger Platform): igUserId Instagram professional hesap
 * id'sidir (webhook routing + gönderim hedefi); accessToken (Page/IG token) şifreli saklanır.
 */
export class ClinicInstagramChannel
  extends AggregateRoot
  implements IClinicInstagramChannel
{
  constructor(data: IClinicInstagramChannel) {
    super();
    this._id = data.id;
    this._igUserId = data.igUserId;
    this._pageId = data.pageId;
    this._username = data.username;
    this._accessToken = data.accessToken;
    this._isActive = data.isActive;
    this._tokenExpiresAt = data.tokenExpiresAt;
    this._lastError = data.lastError;
    this._clinicId = data.clinicId;
    this._organizationId = data.organizationId;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: string;
  get id(): string {
    return this._id;
  }

  private _igUserId: string;
  get igUserId(): string {
    return this._igUserId;
  }

  private _pageId: string | null;
  get pageId(): string | null {
    return this._pageId;
  }

  private _username: string | null;
  get username(): string | null {
    return this._username;
  }

  private _accessToken: string | null;
  get accessToken(): string | null {
    return this._accessToken;
  }

  private _isActive: boolean;
  get isActive(): boolean {
    return this._isActive;
  }

  private _tokenExpiresAt: Date | null;
  get tokenExpiresAt(): Date | null {
    return this._tokenExpiresAt;
  }

  private _lastError: string | null;
  get lastError(): string | null {
    return this._lastError;
  }

  private _clinicId: string;
  get clinicId(): string {
    return this._clinicId;
  }

  private _organizationId: string;
  get organizationId(): string {
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

  /** Doğrulanmış token + abone webhook sonrası aktif kanal üretir (accessToken şifreli gelir). */
  public static connect(
    props: CreateClinicInstagramChannelProps
  ): ClinicInstagramChannel {
    const now = DateTimeManager.create();
    return new ClinicInstagramChannel({
      id: UUID.createOrGenerate(props.id).value,
      clinicId: props.clinicId,
      organizationId: props.organizationId,
      igUserId: props.igUserId,
      pageId: props.pageId ?? null,
      username: props.username ?? null,
      accessToken: props.accessToken ?? null,
      isActive: true,
      tokenExpiresAt: props.tokenExpiresAt ?? null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Mevcut kayıt üzerinde yeniden bağlar (token/username/page yeniler, aktifleştirir). */
  public reconnect(params: {
    accessToken: string;
    username: string | null;
    pageId: string | null;
    tokenExpiresAt: Date | null;
  }): void {
    this._accessToken = params.accessToken;
    this._username = params.username;
    this._pageId = params.pageId;
    this._tokenExpiresAt = params.tokenExpiresAt;
    this._isActive = true;
    this._lastError = null;
  }

  /** Bağlantıyı keser → routing + gönderim dışı. */
  public deactivate(): void {
    this._isActive = false;
  }

  /** Kanal hatası (gönderim/webhook) kaydeder; gönderim dışı bırakır. */
  public markError(reason: string): void {
    this._isActive = false;
    this._lastError = reason;
  }

  public isTokenExpired(now: Date = DateTimeManager.create()): boolean {
    return this._tokenExpiresAt !== null && this._tokenExpiresAt <= now;
  }

  public toPersistence(): IClinicInstagramChannel {
    return {
      id: this._id,
      igUserId: this._igUserId,
      pageId: this._pageId,
      username: this._username,
      accessToken: this._accessToken,
      isActive: this._isActive,
      tokenExpiresAt: this._tokenExpiresAt,
      lastError: this._lastError,
      clinicId: this._clinicId,
      organizationId: this._organizationId,
      createdAt: this._createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }
}
