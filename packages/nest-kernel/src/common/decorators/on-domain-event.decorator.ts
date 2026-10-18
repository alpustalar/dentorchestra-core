import { OnEvent, OnEventType } from '@nestjs/event-emitter';

/**
 * Domain event dinleyicisinin tek kapısı: dinleyici **beklenir** ve hatası
 * **yukarı fırlar**. Çıplak `@OnEvent` ikisini de yapmaz.
 *
 * ### 1. `promisify` — yoksa `emitAsync` dinleyiciyi hiç beklemez
 *
 * `eventemitter2`, `async: true` ile kaydedilen dinleyiciyi sarar ve promise'e mi
 * çevireceğine şöyle karar verir: `promisify = listener.constructor.name === 'AsyncFunction'`.
 * NestJS'in kaydettiği şey ise dinleyicinin kendisi değil, onu try/catch'e saran
 * bir **arrow wrapper**'dır (`event-subscribers.loader.js`) ve onun `constructor.name`'i
 * `'Function'`. Yani otomatik tanıma **her zaman başarısız** olur: dinleyici
 * `setImmediate` ile kuyruğa atılır, dönüş değeri atılır ve `emitAsync`'in
 * `Promise.all`'una bir `Timeout` nesnesi girer.
 *
 * Sonuç: `await emitAsync(...)` dinleyici **henüz başlamadan** çözülür. `OutboxProcessor`
 * tam bu noktada kaydı `processedAt` ile kapatıyordu — teslim edildiğine değil,
 * *kuyruğa atıldığına* bakarak. Araya düşen bir yeniden başlatma/dağıtım kritik işi
 * (fiş üretimi, stok hareketi, defter köprüsü) kalıcı olarak kaybettirir.
 *
 * ### 2. `suppressErrors` — varsayılanı `true`
 *
 * Aynı loader her dinleyiciyi try/catch'e sarar ve `options?.suppressErrors ?? true`
 * olduğu için fırlatılan hata yalnız framework log'una düşer. Dinleyici "ben
 * yutmuyorum, outbox yeniden denesin" diye yazılmış olsa bile (bkz.
 * `StockQuantityChangedListener`) hata çağırana ulaşmaz; kayıt "işlendi" olur.
 * CLAUDE.md finans kuralı 4: **yutulan hata retry değildir.**
 *
 * ### Hatayı kim yutar
 *
 * Çağıran karar verir, framework varsayılanı değil:
 * - beklenen yol — `TransactionManager.emitAfterCommit` (uyarı üretir),
 *   `OutboxProcessor` (yeniden dener, sınırda ölü-mektuba düşürür);
 * - beklenmeyen (fire-and-forget) yol `emitDetached()` ile yayınlar ve hatayı
 *   çağrı yerinde yutar — aksi hâlde reddedilen promise'i kimse tutmadığı için
 *   **unhandled rejection** süreci düşürür.
 *
 * Kapı **hiç seçenek almaz**: üç bayrak da bu kapının sözleşmesidir, çağrı yerinde
 * yeniden açılabilen bir tercih değil. Başka bir dinleyici seçeneği gerçekten
 * gerekirse buraya eklenir — çağrı yerine değil.
 */
export const OnDomainEvent = (event: OnEventType): MethodDecorator =>
  OnEvent(event, { async: true, promisify: true, suppressErrors: false });
