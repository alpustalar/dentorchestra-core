import { Injectable } from '@nestjs/common';
import { IPatientPolicyFactory } from '@modules/platform/policy/patient/domain/interfaces/patient-policy-factory.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PatientActorContext } from '@common/interfaces';
import { AppointmentPatientPolicy } from '@modules/clinical/appointment/application/policies/appointment-patient.policy';
import { PatientBasePolicy } from '@modules/platform/policy/patient/application/patient-base.policy';
import { PatientPolicyEvaluator } from '@modules/platform/policy/patient/application/patient-policy-evaluator';
import { ExecutionSource } from '../../../../../../../../packages/shared/common/constants/execution-source.constant';

@Injectable()
export class PatientPolicyFactory implements IPatientPolicyFactory {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  appointment(actor: PatientActorContext, source: ExecutionSource) {
    return this.build(AppointmentPatientPolicy, actor, source);
  }

  private build<T extends PatientBasePolicy>(
    PolicyClass: new (actor: PatientActorContext, source: ExecutionSource) => T,
    actor: PatientActorContext,
    source: ExecutionSource
  ) {
    const policy = new PolicyClass(actor, source);
    const evaluator = new PatientPolicyEvaluator(policy, this.eventEmitter);
    return { evaluator, policy };
  }
}
