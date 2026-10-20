import { HttpStatus } from '@nestjs/common';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import { ERROR_CODES } from '../../../../../../../packages/shared/common/constants/error-codes.constant';
import type {
  ChannelNotConnectedMeta,
  MessageChannelValue,
} from '@shared/modules/messaging/interfaces';

const CHANNEL_LABELS: Record<MessageChannelValue, string> = {
  WHATSAPP: 'WhatsApp',
  TELEGRAM: 'Telegram',
  INSTAGRAM: 'Instagram',
};

/**
 * Klinikte o kanal hiç bağlanmamış ya da bağlantı geçersiz (pasif / token yok).
 *
 * Üç kanalın (WhatsApp / Telegram / Instagram) hepsi aynı sınıfı kullanır; hangisi
 * olduğu `meta.channel`'da makine-okunur durur ki arayüz kullanıcıyı **doğru**
 * bağlantı ekranına götürebilsin. Ayrı ayrı üç sınıf yazmak aynı davranışı üç
 * yere kopyalamak olurdu.
 */
export class ChannelNotConnectedException extends DomainException<ChannelNotConnectedMeta> {
  public readonly errorCode = ERROR_CODES.MESSAGING.CHANNEL_NOT_CONNECTED;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(channel: MessageChannelValue, clinicId: string) {
    super(`${CHANNEL_LABELS[channel]} kanalı bağlı değil.`, {
      channel,
      clinicId,
    });
  }
}
