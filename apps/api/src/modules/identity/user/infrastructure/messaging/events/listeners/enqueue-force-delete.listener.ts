import { USER_EVENTS } from '@src/domain/constants/events';
import { Injectable, Logger } from '@nestjs/common';
import { EnqueueForceDeleteEvent } from '@modules/identity/user/domain/events/enqueue-force-delete.event';
import { UserProducer } from '@modules/identity/user/infrastructure/messaging/queue/producer/user.producer';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { OnDomainEvent } from '@common/decorators';

@Injectable()
export class EnqueueForceDeleteListener {
  private readonly logger = new Logger(EnqueueForceDeleteListener.name);

  constructor(
    private readonly userProducer: UserProducer,
    private readonly criticalFailure: CriticalFailurePublisher
  ) {}

  @OnDomainEvent(USER_EVENTS.ENQUEUE_FORCE_DELETE)
  async handle(event: EnqueueForceDeleteEvent) {
    const { log, firebaseUid } = event;

    try {
      this.logger.log(log, firebaseUid);
      await this.userProducer.compensateFirebaseRollback({ firebaseUid });
    } catch (e) {
      this.logger.error(
        `FATAL: Failed to enqueue Firebase cleanup for ${firebaseUid}. 
        Manual intervention required!: ${JSON.stringify(e)}`
      );
      // Log satırı zaten "manuel müdahale gerekli" diyordu ama bunu okuyacak
      // kimse yoktu: Firebase kimliği kuyruğa hiç girmediği için yetim kalır —
      // silinmiş kullanıcı hâlâ oturum açabilir.
      this.criticalFailure.publish({
        operation: 'identity.firebase-cleanup.enqueue',
        severity: 'CRITICAL',
        summary:
          'Firebase kimlik temizliği kuyruğa alınamadı; yetim kimlik kalıyor.',
        errorMessage: e instanceof Error ? e.message : String(e),
        context: { firebaseUid },
        clinicId: null,
        dedupeKey: `firebase-cleanup-enqueue-failed:${firebaseUid}`,
      });
    }
  }
}
