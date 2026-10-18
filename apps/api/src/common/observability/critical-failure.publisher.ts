import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CriticalFailureEvent,
  CriticalFailurePayload,
} from '@common/observability/critical-failure.event';
import { emitDetached } from '@common/utils';

/**
 * Kritik hata yayıncısı.
 *
 * **`contextService.addEvent()` KULLANMAZ** — bilerek. Diğer publisher'lar event'i
 * ALS'deki transaction store'una biriktirir ve commit sonunda yayınlar; bu yayıncı
 * ise çoğunlukla `catch` bloklarından çağrılıyor: o noktada transaction ya geri
 * alınmıştır ya da hiç yoktur (kuyruk işçisi, zamanlanmış tarama). ALS'ye
 * eklenen event orada asla yayınlanmazdı — sessiz bir bug.
 *
 * Bu yüzden doğrudan `EventEmitter2` üzerinden yayınlanır ve **hiçbir koşulda
 * fırlatmaz**: uyarı gönderimi, uyarıya sebep olan akışı ikinci kez düşüremez.
 */
@Injectable()
export class CriticalFailurePublisher {
  private readonly logger = new Logger(CriticalFailurePublisher.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  publish(payload: CriticalFailurePayload): void {
    // Uyarının **kendisi** de kaybolabilir: dinleyici DI grafiğinden düşmüşse
    // `emitAsync` sıfır dinleyiciye yayın yapar, boş dizi döner ve hiçbir şey
    // olmaz. Bu yayıncı sistemdeki her alarmın son durağı olduğu için sessiz
    // kalmaz — uyarının içeriğini log'a basar, böylece kanal kopsa bile bilgi
    // kalır. (Grafiğe kayıt ayrıca `app.module.spec.ts` ile kilitli.)
    if (this.eventEmitter.listenerCount(CriticalFailureEvent.NAME) === 0) {
      this.logger.error(
        `Uyarı dinleyicisi yok, uyarı kanala taşınamadı — ${payload.severity} ` +
          `${payload.operation}: ${payload.summary}` +
          (payload.errorMessage ? ` | hata: ${payload.errorMessage}` : '') +
          ` | bağlam: ${JSON.stringify(payload.context)}`
      );
      return;
    }

    // `emitDetached`: dinleyici artık hatayı yukarı fırlatıyor (`@OnDomainEvent`),
    // ama burada kimse onu beklemiyor — yakalanmayan promise süreci düşürürdü.
    // Hata yalnız loglanır; uyarı kanalının hatası yeni bir uyarı doğurmaz.
    emitDetached(
      this.eventEmitter,
      CriticalFailureEvent.NAME,
      new CriticalFailureEvent(payload)
    );
  }
}
