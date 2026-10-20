import { ClinicWhatsappChannel as IClinicWhatsappChannel } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { CreateClinicWhatsappChannelProps } from '@modules/channel-config/domain/channel-config.contracts';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import {
  isWhatsappTokenExpired,
  whatsappChannelNeedsReauth,
} from '@modules/channel-config/domain/rules/whatsapp-channel.rules';
import { UUID } from '@src/domain/value-objects/uuid.vo';

/**
 * Kliniğin WhatsApp Business kanal config'i (messaging bounded-context). Clinic'ten
 * ayrıştırılmış 1:1 satellite; Meta phone_number_id + (şifreli) credential'ları barındırır.
 * Webhook gelen olayları phoneNumberId ile bu kayda routing eder.
 */
export class ClinicWhatsappChannel
  extends AggregateRoot
  implements IClinicWhatsappChannel
{
  constructor(data: IClinicWhatsappChannel) {
    super();
    this._id = data.id;
    this._phoneNumberId = data.phoneNumberId;
    this._wabaId = data.wabaId;
    this._displayPhoneNumber = data.displayPhoneNumber;
    this._accessToken = data.accessToken;
    this._verifyToken = data.verifyToken;
    this._isActive = data.isActive;
    this._registrationPin = data.registrationPin;
    this._registeredAt = data.registeredAt;
    this._tokenExpiresAt = data.tokenExpiresAt;
    this._qualityRating = data.qualityRating;
    this._messagingTier = data.messagingTier;
    this._clinicId = data.clinicId;
    this._organizationId = data.organizationId;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: string;
  get id(): string {
    return this._id;
  }

  private _phoneNumberId: string;
  get phoneNumberId(): string {
    return this._phoneNumberId;
  }

  private _wabaId: string | null;
  get wabaId(): string | null {
    return this._wabaId;
  }

  private _displayPhoneNumber: string | null;
  get displayPhoneNumber(): string | null {
    return this._displayPhoneNumber;
  }

  private _accessToken: string | null;
  get accessToken(): string | null {
    return this._accessToken;
  }

  private _verifyToken: string | null;
  get verifyToken(): string | null {
    return this._verifyToken;
  }

  private _isActive: boolean;
  get isActive(): boolean {
    return this._isActive;
  }

  private _registrationPin: string | null;
  get registrationPin(): string | null {
    return this._registrationPin;
  }

  private _registeredAt: Date | null;
  get registeredAt(): Date | null {
    return this._registeredAt;
  }

  private _tokenExpiresAt: Date | null;
  get tokenExpiresAt(): Date | null {
    return this._tokenExpiresAt;
  }

  private _qualityRating: string | null;
  get qualityRating(): string | null {
    return this._qualityRating;
  }

  private _messagingTier: string | null;
  get messagingTier(): string | null {
    return this._messagingTier;
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

  public static create(
    props: CreateClinicWhatsappChannelProps
  ): ClinicWhatsappChannel {
    const now = DateTimeManager.create();
    return new ClinicWhatsappChannel({
      id: UUID.createOrGenerate(props.id).value,
      clinicId: props.clinicId,
      organizationId: props.organizationId,
      phoneNumberId: props.phoneNumberId,
      wabaId: props.wabaId ?? null,
      displayPhoneNumber: props.displayPhoneNumber ?? null,
      accessToken: props.accessToken ?? null,
      verifyToken: props.verifyToken ?? null,
      isActive: props.isActive ?? true,
      registrationPin: props.registrationPin ?? null,
      registeredAt: props.registeredAt ?? null,
      tokenExpiresAt: props.tokenExpiresAt ?? null,
      qualityRating: props.qualityRating ?? null,
      messagingTier: props.messagingTier ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  public deactivate(): void {
    this._isActive = false;
  }

  /** Webhook/health sorgusundan gelen numara kalitesi + mesaj limiti tier'ını günceller. */
  public recordHealth(params: {
    qualityRating?: string | null;
    messagingTier?: string | null;
  }): void {
    if (params.qualityRating !== undefined) {
      this._qualityRating = params.qualityRating;
    }
    if (params.messagingTier !== undefined) {
      this._messagingTier = params.messagingTier;
    }
  }

  /** accessToken'ın geçerlilik süresi dolmuş mu? (reconnect gerekir) */

  public isTokenExpired(now: Date = DateTimeManager.create()): boolean {
    return isWhatsappTokenExpired(
      { tokenExpiresAt: this._tokenExpiresAt },
      now
    );
  }

  /** Aktif ama token yok/expired → FE yeniden bağlama (reconnect) istemeli. */
  public needsReauth(now: Date = DateTimeManager.create()): boolean {
    return whatsappChannelNeedsReauth(
      {
        isActive: this._isActive,
        accessToken: this._accessToken,
        tokenExpiresAt: this._tokenExpiresAt,
      },
      now
    );
  }

  public toPersistence(): IClinicWhatsappChannel {
    return {
      id: this._id,
      phoneNumberId: this._phoneNumberId,
      wabaId: this._wabaId,
      displayPhoneNumber: this._displayPhoneNumber,
      accessToken: this._accessToken,
      verifyToken: this._verifyToken,
      isActive: this._isActive,
      registrationPin: this._registrationPin,
      registeredAt: this._registeredAt,
      tokenExpiresAt: this._tokenExpiresAt,
      qualityRating: this._qualityRating,
      messagingTier: this._messagingTier,
      clinicId: this._clinicId,
      organizationId: this._organizationId,
      createdAt: this._createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }
}
