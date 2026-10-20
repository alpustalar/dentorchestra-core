import {
  Controller,
  Get,
  Inject,
  Query,
  Sse,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { interval, map, merge, Observable } from 'rxjs';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { Public } from '@common/decorators/public.decorator';
import { PaginationDto } from '@shared';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { NotificationRealtimeBridge } from '@modules/platform/notification/infrastructure/realtime/notification-realtime.bridge';
import { GetMyNotificationsQuery } from '@modules/platform/notification/application/queries/get-my-notifications/get-my-notifications.query';
import { GetUnreadCountQuery } from '@modules/platform/notification/application/queries/get-unread-count/get-unread-count.query';
import {
  INotificationCacheService,
  NOTIFICATION_CACHE_SERVICE,
} from '@modules/platform/notification/domain/interfaces/notification-cache.service.interface';
import { Serialize } from '@common/decorators/serialize.decorator';
import { StaffNotificationResponseDto } from '@modules/platform/notification/presentation/http/dto/staff-notification-response.dto';
import type { StaffNotificationListItem } from '@modules/platform/notification/domain/contracts/staff-notification';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';

// SSE keepalive — ara proxy'ler boşta bağlantıyı düşürmesin diye periyodik ping.
const SSE_HEARTBEAT_MS = 25000;

const { STAFFNOTIFICATION } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@Controller()
export class NotificationQueryController {
  constructor(
    @Inject(NOTIFICATION_CACHE_SERVICE)
    private readonly cacheService: INotificationCacheService,
    private readonly queryBus: TSQueryBus,
    private readonly realtimeBridge: NotificationRealtimeBridge
  ) {}

  /**
   * Canlı bildirim akışı (SSE). Bilet ile doğrulanır (header taşınamaz), bu yüzden
   * @Public — AuthGuard bypass edilir ama erişim tek-kullanımlık bilete bağlıdır.
   */
  @Public()
  @Sse('stream')
  async stream(
    @Query('ticket') ticket?: string
  ): Promise<Observable<MessageEvent>> {
    const staffId = ticket
      ? await this.cacheService.sseTicket.consume(ticket)
      : null;

    if (!staffId) {
      throw new UnauthorizedException(
        'Geçersiz veya süresi dolmuş bağlantı bileti.'
      );
    }

    const notifications$ = this.realtimeBridge
      .streamFor(staffId)
      .pipe(
        map(
          (payload) =>
            ({ data: payload, type: 'notification' }) as unknown as MessageEvent
        )
      );
    const heartbeat$ = interval(SSE_HEARTBEAT_MS).pipe(
      map(() => ({ data: 'ping', type: 'ping' }) as unknown as MessageEvent)
    );

    return merge(notifications$, heartbeat$);
  }

  @HasCapability(STAFFNOTIFICATION.read)
  @Get()
  @Serialize<StaffNotificationListItem, StaffNotificationResponseDto>(
    StaffNotificationResponseDto,
    { isArray: true }
  )
  list(
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext,
    @Query('onlyUnread') onlyUnread?: string
  ) {
    return this.queryBus.execute(
      new GetMyNotificationsQuery({
        pagination,
        ctx,
        onlyUnread: onlyUnread === 'true',
      })
    );
  }

  @HasCapability(STAFFNOTIFICATION.read)
  @Get('unread-count')
  unreadCount(@GetContext() ctx: IGetContext) {
    return this.queryBus.execute(new GetUnreadCountQuery(ctx));
  }
}
