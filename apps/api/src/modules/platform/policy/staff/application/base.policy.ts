import { ActorContext } from '@common/interfaces';
import { Priority } from '@src/domain/value-objects/priority.vo';
import { ExecutionSource } from '../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { ExecutionPolicy } from '@src/domain/common/execution/execution.policy';

export abstract class BasePolicy {
  protected readonly actorPriority: Priority;

  constructor(
    protected readonly actor: ActorContext,
    protected readonly source: ExecutionSource
  ) {
    this.actorPriority = Priority.fromTrusted(actor.rolePriority ?? 0);
  }

  isSystemAdmin(): boolean {
    return this.actorPriority.validate.isAdmin.value;
  }

  isSystemInitiation() {
    return ExecutionPolicy.isSystemInitiated(this.source);
  }

  isSystem() {
    return this.isSystemAdmin() || this.isSystemInitiation();
  }

  getActorContext(): ActorContext {
    return this.actor;
  }
}
