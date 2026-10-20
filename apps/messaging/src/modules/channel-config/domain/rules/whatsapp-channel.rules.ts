import { ClinicWhatsappChannel as IClinicWhatsappChannel } from '@shared';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

/**
 * Kanal kuralları entity'den bağımsız, saf fonksiyonlar olarak durur: yazma tarafı
 * (entity) ve okuma tarafı (düz kayıt döndüren query repo) aynı kuralı iki ayrı
 * kopyada taşımasın diye. Girdi yalnız kuralın ihtiyaç duyduğu alanlardır.
 */
export type WhatsappChannelTokenState = Pick<
  IClinicWhatsappChannel,
  'isActive' | 'accessToken' | 'tokenExpiresAt'
>;

/** accessToken'ın geçerlilik süresi dolmuş mu? (reconnect gerekir) */
export function isWhatsappTokenExpired(
  channel: Pick<WhatsappChannelTokenState, 'tokenExpiresAt'>,
  now: Date = DateTimeManager.create()
): boolean {
  return channel.tokenExpiresAt !== null && channel.tokenExpiresAt <= now;
}

/** Aktif ama token yok/expired → FE yeniden bağlama (reconnect) istemeli. */
export function whatsappChannelNeedsReauth(
  channel: WhatsappChannelTokenState,
  now: Date = DateTimeManager.create()
): boolean {
  return (
    channel.isActive &&
    (channel.accessToken === null || isWhatsappTokenExpired(channel, now))
  );
}
