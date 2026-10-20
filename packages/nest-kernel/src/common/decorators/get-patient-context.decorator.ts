import { IRequestWithPatient, PatientActorContext } from '@common/interfaces';
import {
  ExecutionSource,
  ExecutionSources,
} from '../../../../shared/common/constants/execution-source.constant';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface IGetPatientContext {
  actor: PatientActorContext;
  source: ExecutionSource;
}

export const GetPatientContext = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): IGetPatientContext => {
    const request = ctx.switchToHttp().getRequest<IRequestWithPatient>();
    return {
      actor: request.patientActor,
      source: ExecutionSources.USER_ACTION,
    };
  }
);
