import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

const logger = new Logger('EmitDetached');

/**
 * Event'i **beklemeden** yayınlar ve dinleyici hatasını çağrı yerinde yutar.
 *
 * Dinleyiciler artık hatayı yukarı fırlatıyor (`@OnDomainEvent`). Beklenen
 * yollarda bu istenen davranıştır (uyarı / yeniden deneme), ama akışı
 * bekletmeden yayınlayan yerlerde (`catch` bloğu, guard, politika
 * değerlendirici) kimse `emitAsync`'in promise'ini await etmez: reddedilen
 * promise **unhandled rejection** olur ve Node süreci düşürür. Bu yardımcı o
 * boşluğu kapatır — "yayınla, hatayı burada yut" niyetini tek yerde yazar.
 *
 * Hata her hâlde **loglanır**; `onError` verilirse ek olarak çağrılır (ör. uyarı
 * kanalına WARNING düşürmek için). Uyarı kanalının kendisi de buradan geçtiği
 * için varsayılan davranış yalnız log'dur: uyarı yayınının hatası yeni bir uyarı
 * doğurursa döngü olur.
 */
export function emitDetached(
  emitter: EventEmitter2,
  event: string,
  payload: unknown,
  onError?: (error: unknown) => void
): void {
  const report = (error: unknown, prefix: string): void => {
    logger.error(
      `${prefix} (event=${event}): ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    onError?.(error);
  };

  try {
    void emitter.emitAsync(event, payload).catch((error: unknown) => {
      report(error, 'Event dinleyicisi hata verdi');
    });
  } catch (error) {
    // `emitAsync`'in kendisi (dinleyici değil) senkron patlarsa: yayın yolu
    // çağıranı düşürmemeli — çağıran zaten bu event'i beklemiyor.
    report(error, 'Event yayınlanamadı');
  }
}
