import {
  ActorContext,
  PatientActorContext,
} from '@common/interfaces/actor-context.type';
import { Capability, Role, RoleCapability, User } from '@shared';
import { ExecutionSource } from '../../../../shared/common/constants/execution-source.constant';
import { Request } from 'express';

export type RoleWithCapabilities = Role & {
  capabilities: (RoleCapability & {
    capability: Capability;
  })[];
};

export interface IRequestWithUser extends Request {
  user: Omit<User, 'role'> & {
    role: RoleWithCapabilities | null;
    managedClinics?: { id: string; name: string }[] | null;
    ownedOrganizations?: { id: string; name: string }[] | null;
    doctorProfile?: { id: string } | null;
  };

  actor: ActorContext;
}

export interface IRequestWithActor extends Request {
  actor: ActorContext;
  executionSource?: ExecutionSource;
}

export interface IRequestWithPatient extends Request {
  patientActor: PatientActorContext;
}
