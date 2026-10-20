import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { randomInt } from 'crypto';
import { MongoTransactionManager } from '@src/infrastructure/persistence/mongo/mongo-transaction.manager';
import { TokenCipherService } from '@src/infrastructure/security/crypto/token-cipher.service';
import {
  IWhatsappCloudApi,
  WHATSAPP_CLOUD_API,
} from '@modules/channel-config/domain/interfaces/whatsapp-cloud-api.interface';
import {
  CLINIC_WHATSAPP_CHANNEL_COMMAND_REPOSITORY,
  IClinicWhatsappChannelCommandRepository,
} from '@modules/channel-config/domain/repositories/clinic-whatsapp-channel.repository';
import { ClinicWhatsappChannel } from '@modules/channel-config/domain/entities/clinic-whatsapp-channel.entity';
import { ConnectClinicWhatsappChannelCommand } from './connect-clinic-whatsapp-channel.command';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

@CommandHandler(ConnectClinicWhatsappChannelCommand)
export class ConnectClinicWhatsappChannelHandler
  implements ICommandHandler<ConnectClinicWhatsappChannelCommand, string>
{
  private readonly logger = new Logger(
    ConnectClinicWhatsappChannelHandler.name
  );

  constructor(
    @Inject(WHATSAPP_CLOUD_API)
    private readonly cloudApi: IWhatsappCloudApi,
    @Inject(CLINIC_WHATSAPP_CHANNEL_COMMAND_REPOSITORY)
    private readonly channelCommandRepo: IClinicWhatsappChannelCommandRepository,
    private readonly cipher: TokenCipherService,
    private readonly txManager: MongoTransactionManager
  ) {}

  async execute(command: ConnectClinicWhatsappChannelCommand): Promise<string> {
    const { clinicId, input, ctx } = command;

    // 1) Yetki kodu → erişim token'ı, ardından uzun-ömürlüye (~60 gün) çevir.
    const shortLived = await this.cloudApi.exchangeCodeForToken(input.code);
    const { accessToken, expiresAt } = await this.toLongLived(shortLived);

    // 2) WABA'yı platform app webhook'una abone et (başarısızsa onboarding durur).
    await this.cloudApi.subscribeAppToWaba(input.wabaId, accessToken);

    // 3) Numarayı Cloud API'ye register et (2FA PIN) — yapılmadan gönderim olmaz.
    const pin = this.generatePin();
    await this.cloudApi.registerPhoneNumber(
      input.phoneNumberId,
      pin,
      accessToken
    );

    // 4) Kanalı şifreli token + şifreli PIN ile kaydet.
    const channel = ClinicWhatsappChannel.create({
      clinicId,
      organizationId: ctx.actor.organizationId!,
      phoneNumberId: input.phoneNumberId,
      wabaId: input.wabaId,
      displayPhoneNumber: input.displayPhoneNumber,
      accessToken: this.cipher.encrypt(accessToken),
      tokenExpiresAt: expiresAt,
      registrationPin: this.cipher.encrypt(pin),
      registeredAt: DateTimeManager.create(),
      isActive: true,
    });

    const saved = await this.txManager.run(() =>
      this.channelCommandRepo.upsertByClinicId(channel)
    );
    return saved.id;
  }

  /**
   * Kısa-ömürlü token'ı uzun-ömürlüye çevirmeyi dener; başarısız olursa (kritik değil)
   * kısa-ömürlüyle devam eder. Token süresi dolduğunda FE reconnect ister.
   */
  private async toLongLived(short: {
    accessToken: string;
    expiresAt: Date | null;
  }): Promise<{ accessToken: string; expiresAt: Date | null }> {
    try {
      return await this.cloudApi.exchangeForLongLivedToken(short.accessToken);
    } catch (err) {
      this.logger.warn(
        `Uzun-ömürlü token alınamadı, kısa-ömürlü ile devam: ${
          err instanceof Error ? err.message : err
        }`
      );
      return short;
    }
  }

  /** Cloud API register için 6-haneli 2FA PIN üretir. */
  private generatePin(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }
}
