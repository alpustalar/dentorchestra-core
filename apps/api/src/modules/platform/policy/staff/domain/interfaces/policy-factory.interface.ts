import { ActorContext } from '@common/interfaces';
import { AppointmentPolicy } from '@modules/clinical/appointment/application/policies/appointment.policy';
import { ClinicPolicy } from '@modules/organization/clinic/application/policies';
import { OrganizationPolicy } from '@modules/organization/organization/application/policies/organization.policy';
import { PolicyEvaluator } from '@modules/platform/policy/staff/application/policy-evaluator';
import { UserPolicy } from '@modules/identity/user/application/policies/user.policy';
import { ProviderPolicy } from '@modules/clinical/provider/application/policies/provider.policy';
import { EntityPolicy } from '@modules/platform/policy/entity/entity.policy';
import { FinancePolicy } from '@modules/finance/shared/application/policies';
import { PatientPolicy } from '@modules/crm/patient/application/policies';
import { EmployeePolicy } from '@modules/hr/employee/application/policies';
import { PurchasingPolicy } from '@modules/supply/purchasing/application/policies';
import { ConsentFormPolicy } from '@modules/clinical/consent-form/application/policies';
import { WorkOrderPolicy } from '@modules/supply/work-order/application/policies';
import { ProjectPolicy } from '@modules/organization/project/application/policies';
import { ExecutionSource } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';

export const POLICY_FACTORY = Symbol('IPolicyFactory');
export interface IPolicyFactory {
  user(
    actor: ActorContext,
    source: ExecutionSource
  ): {
    evaluator: PolicyEvaluator<UserPolicy>;
    policy: UserPolicy;
  };
  organization(
    actor: ActorContext,
    source: ExecutionSource
  ): {
    evaluator: PolicyEvaluator<OrganizationPolicy>;
    policy: OrganizationPolicy;
  };
  clinic(
    actor: ActorContext,
    source: ExecutionSource
  ): {
    evaluator: PolicyEvaluator<ClinicPolicy>;
    policy: ClinicPolicy;
  };
  appointment(
    actor: ActorContext,
    source: ExecutionSource
  ): {
    evaluator: PolicyEvaluator<AppointmentPolicy>;
    policy: AppointmentPolicy;
  };
  provider(
    actor: ActorContext,
    source: ExecutionSource
  ): {
    evaluator: PolicyEvaluator<ProviderPolicy>;
    policy: ProviderPolicy;
  };
  entity(
    actor: ActorContext,
    source: ExecutionSource
  ): {
    evaluator: PolicyEvaluator<EntityPolicy>;
    policy: EntityPolicy;
  };
  finance(
    actor: ActorContext,
    source: ExecutionSource
  ): {
    evaluator: PolicyEvaluator<FinancePolicy>;
    policy: FinancePolicy;
  };
  patient(
    actor: ActorContext,
    source: ExecutionSource
  ): {
    evaluator: PolicyEvaluator<PatientPolicy>;
    policy: PatientPolicy;
  };
  employee(
    actor: ActorContext,
    source: ExecutionSource
  ): {
    evaluator: PolicyEvaluator<EmployeePolicy>;
    policy: EmployeePolicy;
  };
  purchasing(
    actor: ActorContext,
    source: ExecutionSource
  ): {
    evaluator: PolicyEvaluator<PurchasingPolicy>;
    policy: PurchasingPolicy;
  };
  consentForm(
    actor: ActorContext,
    source: ExecutionSource
  ): {
    evaluator: PolicyEvaluator<ConsentFormPolicy>;
    policy: ConsentFormPolicy;
  };
  workOrder(
    actor: ActorContext,
    source: ExecutionSource
  ): {
    evaluator: PolicyEvaluator<WorkOrderPolicy>;
    policy: WorkOrderPolicy;
  };
  project(
    actor: ActorContext,
    source: ExecutionSource
  ): {
    evaluator: PolicyEvaluator<ProjectPolicy>;
    policy: ProjectPolicy;
  };
}
