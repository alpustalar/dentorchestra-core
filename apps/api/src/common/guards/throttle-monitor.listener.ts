import { Injectable, Logger } from '@nestjs/common';
import { THROTTLE_EVENTS } from '@src/domain/constants/events';
import { RateLimitExceededPayload } from './throttle-monitor.guard';
import { OnDomainEvent } from '@common/decorators';

@Injectable()
export class ThrottleMonitorListener {
  private readonly logger = new Logger(ThrottleMonitorListener.name);

  @OnDomainEvent(THROTTLE_EVENTS.RATE_LIMIT_EXCEEDED)
  handle(payload: RateLimitExceededPayload) {
    this.logger.warn(
      `Rate limit exceeded | ${payload.method} ${payload.url} | ip: ${payload.ip} | userId: ${payload.userId ?? 'anonymous'} | hits: ${payload.totalHits}/${payload.limit} | ttl: ${payload.ttl}ms`
    );
  }
}
