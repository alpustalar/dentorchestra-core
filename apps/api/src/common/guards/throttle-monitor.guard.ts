/* eslint-disable */
import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { THROTTLE_EVENTS } from '@src/domain/constants/events';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import { emitDetached } from '@common/utils';

export interface RateLimitExceededPayload {
  ip: string;
  url: string;
  method: string;
  userId: string | null;
  limit: number;
  ttl: number;
  totalHits: number;
  timestamp: Date;
}

@Injectable()
export class ThrottleMonitorGuard extends ThrottlerGuard {
  @Inject(EventEmitter2)
  private readonly eventEmitter: EventEmitter2;

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail
  ): Promise<void> {
    const request = context.switchToHttp().getRequest();

    const payload: RateLimitExceededPayload = {
      ip: request.ip,
      url: request.url,
      method: request.method,
      userId: request.user?.userId ?? null,
      limit: throttlerLimitDetail.limit,
      ttl: throttlerLimitDetail.ttl,
      totalHits: throttlerLimitDetail.totalHits,
      timestamp: DateTimeManager.create(),
    };

    // Bekletmeden yayınlanır (istek zaten 429 ile kapanıyor); dinleyicinin
    // hatası burada yutulur — bkz. `emitDetached`.
    emitDetached(
      this.eventEmitter,
      THROTTLE_EVENTS.RATE_LIMIT_EXCEEDED,
      payload
    );

    await super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
