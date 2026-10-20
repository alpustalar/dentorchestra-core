import { isTelegramChannelActive } from '@modules/channel-config/domain/rules/telegram-channel.rules';
import { ClinicTelegramChannel as IClinicTelegramChannel } from '@shared';
import {
  TelegramProviderSchema,
  TelegramProviderType as TelegramProvider,
} from '@shared';
import {
  TelegramChannelStatusSchema,
  TelegramChannelStatusType as TelegramChannelStatus,
} from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { CreateClinicTelegramBotChannelProps } from '@modules/channel-config/domain/channel-config.contracts';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { UUID } from '@src/domain/value-objects/uuid.vo';

/**
 * Kliniğin Telegram kanal config'i (messaging bounded-context). Clinic'ten ayrıştırılmış
 * satellite; hibrit provider (BOT_API / MTPROTO). Şu an yalnız BOT_API (BotFather token +
 * klinik bazlı webhook secret) implement edilmiştir; MTProto alanları gelecekte doldurulur.
 * Webhook gelen olayları yol parametresindeki clinicId ile bu kayda routing eder.
 */
export class ClinicTelegramChannel
  extends AggregateRoot
  implements IClinicTelegramChannel
{
  constructor(data: IClinicTelegramChannel) {
    super();
    this._id = data.id;
    this._provider = data.provider;
    this._status = data.status;
    this._botTokenEnc = data.botTokenEnc;
    this._botUsername = data.botUsername;
    this._webhookSecret = data.webhookSecret;
    this._phoneNumber = data.phoneNumber;
    this._mtprotoSessionEnc = data.mtprotoSessionEnc;
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

  private _provider: TelegramProvider;
  get provider(): TelegramProvider {
    return this._provider;
  }

  private _status: TelegramChannelStatus;
  get status(): TelegramChannelStatus {
    return this._status;
  }

  private _botTokenEnc: string | null;
  get botTokenEnc(): string | null {
    return this._botTokenEnc;
  }

  private _botUsername: string | null;
  get botUsername(): string | null {
    return this._botUsername;
  }

  private _webhookSecret: string | null;
  get webhookSecret(): string | null {
    return this._webhookSecret;
  }

  private _phoneNumber: string | null;
  get phoneNumber(): string | null {
    return this._phoneNumber;
  }

  private _mtprotoSessionEnc: string | null;
  get mtprotoSessionEnc(): string | null {
    return this._mtprotoSessionEnc;
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

  /** Kanal şu an gönderim/alım için kullanılabilir mi? (status === ACTIVE) */
  get isActive(): boolean {
    return isTelegramChannelActive({ status: this._status });
  }

  /**
   * Bot API ile bağlama: doğrulanmış (getMe) bot + kurulmuş webhook sonrası ACTIVE kanal
   * üretir. botTokenEnc ve webhookSecret çağırandan şifreli/üretilmiş gelir.
   */
  public static connectBot(
    props: CreateClinicTelegramBotChannelProps
  ): ClinicTelegramChannel {
    const now = DateTimeManager.create();
    return new ClinicTelegramChannel({
      id: UUID.createOrGenerate(props.id).value,
      clinicId: props.clinicId,
      organizationId: props.organizationId,
      provider: TelegramProviderSchema.enum.BOT_API,
      status: TelegramChannelStatusSchema.enum.ACTIVE,
      botTokenEnc: props.botTokenEnc,
      botUsername: props.botUsername ?? null,
      webhookSecret: props.webhookSecret,
      phoneNumber: null,
      mtprotoSessionEnc: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Mevcut kayıt üzerinde botu yeniden bağlar (token/username/secret yeniler, ACTIVE'e çeker). */
  public reconnectBot(params: {
    botTokenEnc: string;
    botUsername: string | null;
    webhookSecret: string;
  }): void {
    this._provider = TelegramProviderSchema.enum.BOT_API;
    this._botTokenEnc = params.botTokenEnc;
    this._botUsername = params.botUsername;
    this._webhookSecret = params.webhookSecret;
    this._status = TelegramChannelStatusSchema.enum.ACTIVE;
    this._lastError = null;
  }

  /** Bağlantıyı keser (logout/disconnect) → routing+gönderim dışı. */
  public revoke(): void {
    this._status = TelegramChannelStatusSchema.enum.REVOKED;
  }

  /** Kanal hatası (gönderim/webhook) kaydeder; gönderim dışı bırakır. */
  public markError(reason: string): void {
    this._status = TelegramChannelStatusSchema.enum.ERROR;
    this._lastError = reason;
  }

  public toPersistence(): IClinicTelegramChannel {
    return {
      id: this._id,
      provider: this._provider,
      status: this._status,
      botTokenEnc: this._botTokenEnc,
      botUsername: this._botUsername,
      webhookSecret: this._webhookSecret,
      phoneNumber: this._phoneNumber,
      mtprotoSessionEnc: this._mtprotoSessionEnc,
      lastError: this._lastError,
      clinicId: this._clinicId,
      organizationId: this._organizationId,
      createdAt: this._createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }
}
