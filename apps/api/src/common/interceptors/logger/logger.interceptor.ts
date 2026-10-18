/* eslint-disable */

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { User } from '@model-schema/UserSchema';
import { redactSensitive } from '@common/utils';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: User }>();
    const { method, url, body, user } = request;
    const now = Date.now();

    const safeBody = this.sanitizeBody(body);
    const userId = user?.id ? `[User: ${user.id}]` : '[Guest]';
    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const delay = Date.now() - now;

        // 2. Detaylı Log (Body ile birlikte)
        this.logger.log(
          `🌐${userId} ${method} ${url} | Status: ${response.statusCode} | Time: +${delay}ms`
        );

        // Sadece POST, PATCH, PUT gibi body içeren isteklerde body'yi göster
        if (
          ['POST', 'PATCH', 'PUT'].includes(method) &&
          Object.keys(safeBody).length
        ) {
          this.logger.debug(`📦 Body: ${JSON.stringify(safeBody)}`);
        }
      })
    );
  }

  /**
   * Gövde maskeleme **ortak kurala** bağlı (`redactSensitive`).
   *
   * Eski hâli iki yönden eksikti: (1) liste yalnız **en üst seviyeye** bakıyordu
   * — `{ paymentCard: { cardToken } }` gibi iç içe gelen credential'ları hiç
   * görmüyordu; (2) kendi listesini taşıyordu, yani sağlayıcı ham yanıtı için
   * tutulan listeyle ayrışmaya açıktı (kural 12).
   *
   * NOT: bu satır `logger.debug` ile yazılıyor ve winston'un varsayılan seviyesi
   * `info` → gövde log'u bugün **hiçbir transport'a ulaşmıyor**. Yani bu
   * maskeleme bugün bir şeyi korumuyor; seviyeyi bir olay incelemesi için
   * `debug`'a çeken kişinin karşılaşacağı davranışı doğru kılıyor. Koruma
   * kalitesinin, ona ihtiyaç duyulan güne kadar görünmez kalması tam olarak
   * sorunun kendisiydi.
   */
  private sanitizeBody(body: unknown) {
    if (!body) return {};
    return redactSensitive(body) as Record<string, unknown>;
  }
}
