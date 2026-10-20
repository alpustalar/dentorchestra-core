import { PatientActorContext } from '@common/interfaces';
import { ExecutionSource } from '../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { ExecutionPolicy } from '@src/domain/common/execution/execution.policy';

export abstract class PatientBasePolicy {
  constructor(
    protected readonly actor: PatientActorContext,
    protected readonly source: ExecutionSource
  ) {}
  getActorContext(): PatientActorContext {
    return this.actor;
  }

  isSystem() {
    return ExecutionPolicy.isSystemInitiated(this.source);
  }
}
