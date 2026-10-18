import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BasePolicy } from '@modules/platform/policy/staff/application/base.policy';
import { PolicyAccessDeniedEvent } from '@modules/platform/policy/staff/domain/events/policy-access-denied.event';
import { emitDetached } from '@common/utils';

export class PolicyEvaluator<T extends BasePolicy> {
  private isValid: boolean = true;
  private lastError?: string;
  private isBypassed: boolean = false;

  constructor(
    private readonly policy: T,
    private readonly eventEmitter?: EventEmitter2
  ) {
    if (this.policy.isSystem()) {
      this.isBypassed = true;
    }
  }

  bypassIf(condition: boolean): this {
    if (condition) this.isBypassed = true;
    return this;
  }

  check(predicate: (policy: T) => boolean, errorMessage?: string): this {
    if (this.isBypassed) return this;
    if (!this.isValid) return this;

    const result = predicate(this.policy);
    if (!result) {
      this.isValid = false;
      this.lastError = errorMessage;
    }
    return this;
  }

  orThrow(operation?: string, customMessage?: string): void {
    if (this.isBypassed) return;

    if (!this.isValid) {
      const finalMessage =
        customMessage || this.lastError || 'Bu işlem için yetkiniz bulunmuyor.';

      const actor = this.policy.getActorContext();

      if (this.eventEmitter) {
        // Yetki reddi denetim kaydı akışı bekletmez; dinleyicinin hatası
        // burada yutulur (çağıran zaten 403 fırlatıyor).
        emitDetached(
          this.eventEmitter,
          PolicyAccessDeniedEvent.NAME,
          new PolicyAccessDeniedEvent({
            actorId: actor.userId,
            source: actor.source,
            organizationId: actor.organizationId,
            reason: finalMessage,
            operation,
          })
        );
      }

      throw new ForbiddenException(finalMessage);
    }
  }

  allowed(): boolean {
    return this.isValid;
  }
}
