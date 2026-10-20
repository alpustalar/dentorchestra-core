import { MetaAdAccount as IMetaAdAccount } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { Guard } from '@common/domain/guards';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Name } from '@src/domain/value-objects/name.vo';
import {
  CreateMetaAdAccountProps,
  DeactivateMetaAdAccountProps,
} from '@modules/crm/meta-ads/domain/contracts';
import {
  MetaAccountConnectedEvent,
  MetaAccountDisconnectedEvent,
} from '@modules/crm/meta-ads/domain/events';
import {
  LogAction,
  LogSource,
  LogType,
} from '@src/domain/constants/log-action.constant';

const TOKEN_EXPIRY_WARNING_DAYS = 7;

export class MetaAdAccount extends AggregateRoot {
  constructor(data: IMetaAdAccount) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._clinicId = UUID.fromTrusted(data.clinicId);

    this._adAccountId = data.adAccountId;
    this._accessToken = data.accessToken;
    this._pageId = data.pageId;

    this._businessName = Name.create(data.businessName).instance ?? null;

    this._isActive = data.isActive;
    this._tokenExpiresAt = data.tokenExpiresAt;
    this._lastSyncAt = data.lastSyncAt;
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

  private _adAccountId: string;
  get adAccountId(): string {
    return this._adAccountId;
  }

  private _accessToken: string;
  get accessToken(): string {
    return this._accessToken;
  }

  private _pageId: string | null;
  get pageId(): string | null {
    return this._pageId;
  }

  private _businessName: Name | null;
  get businessName(): Name | null {
    return this._businessName;
  }

  private _isActive: boolean;
  get isActive(): boolean {
    return this._isActive;
  }

  private _tokenExpiresAt: Date | null;
  get tokenExpiresAt(): Date | null {
    return this._tokenExpiresAt;
  }

  private _lastSyncAt: Date | null;
  get lastSyncAt(): Date | null {
    return this._lastSyncAt;
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
      token: {
        isExpiringSoon: (() => {
          const isExpiringSoon = this.isTokenExpiringSoon();

          return Guard.monitor(
            isExpiringSoon,
            isExpiringSoon,
            () => new Error('Token süresi yakında doluyor')
          );
        })(),
      },
    };
  }

  public static create(props: CreateMetaAdAccountProps): MetaAdAccount {
    const now = DateTimeManager.create();

    const account = new MetaAdAccount({
      id: UUID.createOrGenerate(props.id).value,
      clinicId: UUID.create(props.clinicId).orThrow().value,

      adAccountId: props.adAccountId,
      accessToken: props.accessToken,
      pageId: props.pageId ?? null,

      businessName: props.businessName
        ? Name.create(props.businessName).orThrow().value
        : null,

      isActive: true,
      tokenExpiresAt: props.tokenExpiresAt ?? null,
      lastSyncAt: null,
      createdAt: now,
      updatedAt: now,
    });

    account.addDomainEvent(
      new MetaAccountConnectedEvent({
        metaAdAccountId: account.id.value,
        clinicId: account.clinicId.value,
        adAccountId: account.adAccountId,
        action: LogAction.META_ADS_ACCOUNT_CONNECTED,
        type: LogType.INFO,
        source: props.logSource ?? LogSource.SYSTEM,
        actorId: props.actorId,
        details: `Meta reklam hesabı bağlandı: ${account.adAccountId}`,
      })
    );

    return account;
  }

  /**
   * Hesap bağlantısını keser. Kayıt silinmez — geçmiş kampanya metrikleri ve
   * lead'ler hesaba bağlı kaldığı için yalnız senkronizasyon durdurulur.
   */
  public deactivate(props: DeactivateMetaAdAccountProps = {}): void {
    this._isActive = false;
    this._updatedAt = DateTimeManager.create();

    this.addDomainEvent(
      new MetaAccountDisconnectedEvent({
        metaAdAccountId: this.id.value,
        clinicId: this.clinicId.value,
        adAccountId: this.adAccountId,
        action: LogAction.META_ADS_ACCOUNT_DISCONNECTED,
        type: LogType.INFO,
        source: props.logSource ?? LogSource.SYSTEM,
        actorId: props.actorId,
        details: `Meta reklam hesabı bağlantısı kesildi: ${this.adAccountId}`,
      })
    );
  }

  public markSynced(): void {
    this._lastSyncAt = DateTimeManager.create();
  }

  public refreshToken(accessToken: string, expiresAt: Date | null): void {
    this._accessToken = accessToken;
    this._tokenExpiresAt = expiresAt;
  }

  public toPersistence(): IMetaAdAccount {
    return {
      id: this.id.value,
      clinicId: this.clinicId.value,
      adAccountId: this.adAccountId,
      accessToken: this.accessToken,
      pageId: this.pageId,
      businessName: this.businessName?.value ?? null,
      isActive: this.isActive,
      tokenExpiresAt: this.tokenExpiresAt,
      lastSyncAt: this.lastSyncAt,
      createdAt: this.createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }

  private isTokenExpiringSoon(): boolean {
    if (!this._tokenExpiresAt) return false;
    const threshold = DateTimeManager.create();
    threshold.setDate(threshold.getDate() + TOKEN_EXPIRY_WARNING_DAYS);
    return this._tokenExpiresAt <= threshold;
  }
}
