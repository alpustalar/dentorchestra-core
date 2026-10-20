import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { LockAppointmentSlotCommand } from './lock-appointment-slot.command';
import { LockAppointmentSlotResponse } from './lock-appointment-slot.response';
import { SlotTemporarilyHeldException } from '@modules/clinical/appointment/domain/exceptions/appointment.exceptions';
import { ClinicNotAssignedException } from '@src/domain/exceptions/clinic-not-assigned.exception';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import {
  APPOINTMENT_CACHE_SERVICE,
  IAppointmentCacheService,
} from '@modules/clinical/appointment/domain/interfaces/appointment-cache.service.interface';
import { Inject } from '@nestjs/common';

/**
 * Slotu (doktor + başlangıç anı) aktör adına geçici kilitler. Başka biri tutuyorsa
 * SlotTemporarilyHeldException; aksi halde lockedUntil + ttl döner. Kilit yalnız
 * Redis'te tutulur (kısa TTL) — DB'ye yazılmaz; gerçek çakışma booking anında denetlenir.
 */
@CommandHandler(LockAppointmentSlotCommand)
export class LockAppointmentSlotHandler
  implements
    ICommandHandler<LockAppointmentSlotCommand, LockAppointmentSlotResponse>
{
  constructor(
    @Inject(APPOINTMENT_CACHE_SERVICE)
    private readonly cacheService: IAppointmentCacheService
  ) {}

  async execute(
    command: LockAppointmentSlotCommand
  ): Promise<LockAppointmentSlotResponse> {
    const { data, ctx, holderId } = command.payload;
    const { actor } = ctx;

    // Personel akışında holder = aktör userId; hasta/AI akışında çağıran açıkça
    // kanal-kararlı bir holderId (ör. conversationId) geçer.
    const effectiveHolderId = holderId ?? actor.userId;
    if (!effectiveHolderId) throw new ClinicNotAssignedException();

    const acquired = await this.cacheService.slotLock.acquire({
      providerId: data.providerId,
      startTimeIso: data.startTime.toISOString(),
      holderId: effectiveHolderId,
    });

    if (!acquired) throw new SlotTemporarilyHeldException();

    const ttlSeconds = this.cacheService.slotLockTtlSeconds;

    return {
      ttlSeconds,
      lockedUntil: DateTimeManager.addSeconds(
        DateTimeManager.create(),
        ttlSeconds
      ),
    };
  }
}
