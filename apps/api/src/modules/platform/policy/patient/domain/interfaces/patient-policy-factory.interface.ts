import { PatientActorContext } from '@common/interfaces';
import { AppointmentPatientPolicy } from '@modules/clinical/appointment/application/policies/appointment-patient.policy';
import { PatientPolicyEvaluator } from '@modules/platform/policy/patient/application/patient-policy-evaluator';
import { ExecutionSource } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';

export const PATIENT_POLICY_FACTORY = Symbol('IPolicyFactory');
export interface IPatientPolicyFactory {
  appointment(
    actor: PatientActorContext,
    source: ExecutionSource
  ): {
    evaluator: PatientPolicyEvaluator<AppointmentPatientPolicy>;
    policy: AppointmentPatientPolicy;
  };
}
