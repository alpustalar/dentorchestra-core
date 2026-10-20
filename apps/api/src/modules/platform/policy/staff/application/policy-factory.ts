import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActorContext } from '@common/interfaces';
import { OrganizationPolicy } from '@modules/organization/organization/application/policies/organization.policy';
import { ClinicPolicy } from '@modules/organization/clinic/application/policies';
import { AppointmentPolicy } from '@modules/clinical/appointment/application/policies/appointment.policy';
import { PolicyEvaluator } from '@modules/platform/policy/staff/application/policy-evaluator';
import { BasePolicy } from '@modules/platform/policy/staff/application/base.policy';
import { IPolicyFactory } from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
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
import { ExecutionSource } from '../../../../../../../../packages/shared/common/constants/execution-source.constant';

@Injectable()
export class PolicyFactory implements IPolicyFactory {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  user(actor: ActorContext, source: ExecutionSource) {
    return this.build(UserPolicy, actor, source);
  }

  organization(actor: ActorContext, source: ExecutionSource) {
    return this.build(OrganizationPolicy, actor, source);
  }

  clinic(actor: ActorContext, source: ExecutionSource) {
    return this.build(ClinicPolicy, actor, source);
  }

  appointment(actor: ActorContext, source: ExecutionSource) {
    return this.build(AppointmentPolicy, actor, source);
  }

  provider(actor: ActorContext, source: ExecutionSource) {
    return this.build(ProviderPolicy, actor, source);
  }

  entity(actor: ActorContext, source: ExecutionSource) {
    return this.build(EntityPolicy, actor, source);
  }

  finance(actor: ActorContext, source: ExecutionSource) {
    return this.build(FinancePolicy, actor, source);
  }

  patient(actor: ActorContext, source: ExecutionSource) {
    return this.build(PatientPolicy, actor, source);
  }

  employee(actor: ActorContext, source: ExecutionSource) {
    return this.build(EmployeePolicy, actor, source);
  }

  purchasing(actor: ActorContext, source: ExecutionSource) {
    return this.build(PurchasingPolicy, actor, source);
  }

  consentForm(actor: ActorContext, source: ExecutionSource) {
    return this.build(ConsentFormPolicy, actor, source);
  }

  workOrder(actor: ActorContext, source: ExecutionSource) {
    return this.build(WorkOrderPolicy, actor, source);
  }

  project(actor: ActorContext, source: ExecutionSource) {
    return this.build(ProjectPolicy, actor, source);
  }

  private build<T extends BasePolicy>(
    PolicyClass: new (actor: ActorContext, source: ExecutionSource) => T,
    actor: ActorContext,
    source: ExecutionSource
  ) {
    const policy = new PolicyClass(actor, source);
    const evaluator = new PolicyEvaluator(policy, this.eventEmitter);
    return { evaluator, policy };
  }
}
