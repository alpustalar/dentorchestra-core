import { IGetContext } from '@common/decorators/get-context.decorator';
import { ExecutionSource, ExecutionSources } from '@shared';
import {
  SYSTEM_ACTOR,
  SYSTEM_PATIENT_ACTOR,
} from '@common/constants/system-actor.constant';
import { IGetPatientContext } from '@common/decorators/get-patient-context.decorator';

export class ExecutionContextFactory {
  static createInternal(
    parentContext?: IGetContext,
    source: ExecutionSource = ExecutionSources.INTERNAL_CASCADE
  ): IGetContext {
    return {
      actor: parentContext?.actor || SYSTEM_ACTOR,
      source: source,
      ip: parentContext?.ip || '127.0.0.1',
      userAgent: parentContext?.userAgent || 'INTERNAL_SERVER',
    };
  }

  static createPatientInternal(
    source: ExecutionSource = ExecutionSources.INTERNAL_CASCADE
  ): IGetPatientContext {
    return {
      actor: SYSTEM_PATIENT_ACTOR,
      source,
    };
  }
}
