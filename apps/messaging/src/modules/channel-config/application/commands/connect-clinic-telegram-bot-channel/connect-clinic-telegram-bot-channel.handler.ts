import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ENV } from '@common/constants/env.constant';
import { getGlobalPrefix } from '../../../../../../../../packages/shared/common/constants/api-config.constant';
import { MongoTransactionManager } from '@src/infrastructure/persistence/mongo/mongo-transaction.manager';
import { TokenCipherService } from '@src/infrastructure/security/crypto/token-cipher.service';
import {
  ITelegramBotApi,
  TELEGRAM_BOT_API,
} from '@modules/channel-config/domain/interfaces/telegram-bot-api.interface';
import {
  CLINIC_TELEGRAM_CHANNEL_COMMAND_REPOSITORY,
  IClinicTelegramChannelCommandRepository,
} from '@modules/channel-config/domain/repositories/clinic-telegram-channel.repository';
import { ClinicTelegramChannel } from '@modules/channel-config/domain/entities/clinic-telegram-channel.entity';
import { ConnectClinicTelegramBotChannelCommand } from './connect-clinic-telegram-bot-channel.command';

/** Klinik bazlı Telegram webhook yolu (RouterModule prefix `messaging` + controller). */
const TELEGRAM_WEBHOOK_PATH = 'messaging/telegram/bot';

@CommandHandler(ConnectClinicTelegramBotChannelCommand)
export class ConnectClinicTelegramBotChannelHandler
  implements ICommandHandler<ConnectClinicTelegramBotChannelCommand, string>
{
  constructor(
    @Inject(TELEGRAM_BOT_API)
    private readonly botApi: ITelegramBotApi,
    @Inject(CLINIC_TELEGRAM_CHANNEL_COMMAND_REPOSITORY)
    private readonly channelCommandRepo: IClinicTelegramChannelCommandRepository,
    private readonly cipher: TokenCipherService,
    private readonly configService: ConfigService,
    private readonly txManager: MongoTransactionManager
  ) {}

  async execute(
    command: ConnectClinicTelegramBotChannelCommand
  ): Promise<string> {
    const { clinicId, input, ctx } = command;
    const botToken = input.botToken.trim();

    // 1) Token geçerli mi? getMe bot kimliğini döner (geçersizse hata fırlatır).
    const identity = await this.botApi.getMe(botToken);

    // 2) Klinik bazlı gizli webhook secret_token üret + webhook'u kur.
    const webhookSecret = randomBytes(24).toString('hex');
    const webhookUrl = this.buildWebhookUrl(clinicId);
    await this.botApi.setWebhook(botToken, webhookUrl, webhookSecret);

    // 3) Kanalı şifreli token + webhook secret ile kaydet (upsert: connect/reconnect).
    const channel = ClinicTelegramChannel.connectBot({
      clinicId,
      organizationId: ctx.actor.organizationId!,
      botTokenEnc: this.cipher.encrypt(botToken),
      botUsername: identity.username,
      webhookSecret,
    });

    const saved = await this.txManager.run(() =>
      this.channelCommandRepo.upsertByClinicAndProvider(channel)
    );
    return saved.id;
  }

  /** `${PUBLIC_BASE_URL}/api/v1/messaging/telegram/bot/${clinicId}` (HTTPS zorunlu). */
  private buildWebhookUrl(clinicId: string): string {
    const base = this.configService
      .getOrThrow<string>(ENV.PUBLIC_BASE_URL)
      .replace(/\/+$/, '');
    return `${base}/${getGlobalPrefix()}/${TELEGRAM_WEBHOOK_PATH}/${clinicId}`;
  }
}
