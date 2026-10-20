'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  getAllSystemCapabilities,
  ROLE_SLUGS,
  rolesCreateManyInputs,
} from '@shared/datasets';
import type { ActorContextResponse } from '@core-crm/shared/client';
import type { Role } from '@shared/generated-zod/modelSchema';
import { formatCapabilityToString } from '@/lib/auth/capability.utils';

export type RoleDTO = Omit<Role, 'createdAt' | 'updatedAt'>;

type MockActor = ActorContextResponse & { roleSlug: string };

export const AVAILABLE_ROLES = rolesCreateManyInputs.map((role) => ({
  id: `role_${role.slug}`,
  name: role.name,
  slug: role.slug,
  priority: role.priority,
  isSystemRole: role.isSystemRole,
  capabilities: role.caps.map(formatCapabilityToString),
})) satisfies Array<
  Pick<RoleDTO, 'id' | 'name' | 'slug' | 'priority' | 'isSystemRole'> & {
    capabilities: string[];
  }
>;

const INITIAL_ROLE = AVAILABLE_ROLES.find(
  (role) => role.slug === ROLE_SLUGS.ADMIN
)!;

const INITIAL_ACTOR: MockActor = {
  userId: 'mock-admin-user',
  email: 'admin@medora.com',
  roleId: INITIAL_ROLE.id,
  roleSlug: INITIAL_ROLE.slug,
  rolePriority: INITIAL_ROLE.priority,
  capabilities: getAllSystemCapabilities().map(formatCapabilityToString),
  clinicId: 'clinic_fethiye',
  organizationId: 'org_as_yazilim',
  managedClinics: ['clinic_fethiye', 'clinic_ataevler', 'clinic_besevler'],
  ownedOrganizations: ['org_as_yazilim'],
};

export interface UserClaims {
  role: RoleDTO;
  organizationId: string;
  clinicId: string;
  capabilities: string[];
}

interface MockActorState {
  actor: MockActor;
  claims: UserClaims;
  /** Başlangıç actor'ının priority sınırı, rol önizlemesinde değişmez. */
  roleSwitcherPriority: number;
  selectedClinicId: string | null;
  hasHydrated: boolean;
  availableRoles: typeof AVAILABLE_ROLES;
  selectableRoles: typeof AVAILABLE_ROLES;
  canSwitchRole: boolean;
  setMockRole: (roleSlug: string) => void;
  switchClinic: (clinicId: string | null) => void;
  setHasHydrated: (hydrated: boolean) => void;
}

function claimsForRole(
  role: (typeof AVAILABLE_ROLES)[number],
  actor: MockActor
): UserClaims {
  return {
    role: {
      id: role.id,
      name: role.name,
      slug: role.slug,
      priority: role.priority,
      isSystemRole: role.isSystemRole,
    } as RoleDTO,
    organizationId: actor.organizationId ?? '',
    clinicId: actor.clinicId ?? '',
    capabilities: role.capabilities,
  };
}

export const useAuth = create<MockActorState>()(
  persist(
    (set, get) => ({
      actor: INITIAL_ACTOR,
      claims: claimsForRole(INITIAL_ROLE, INITIAL_ACTOR),
      roleSwitcherPriority: INITIAL_ACTOR.rolePriority,
      selectedClinicId: INITIAL_ACTOR.clinicId ?? null,
      hasHydrated: false,
      availableRoles: AVAILABLE_ROLES,
      selectableRoles: AVAILABLE_ROLES.filter(
        (role) => role.priority <= INITIAL_ACTOR.rolePriority
      ),
      canSwitchRole: INITIAL_ACTOR.rolePriority >= 80,
      setMockRole: (roleSlug) => {
        const { selectableRoles, roleSwitcherPriority } = get();
        const role = selectableRoles.find(
          (candidate) =>
            candidate.slug === roleSlug &&
            candidate.priority <= roleSwitcherPriority
        );

        if (!role) return;

        const actor = {
          ...get().actor,
          roleId: role.id,
          roleSlug: role.slug,
          rolePriority: role.priority,
          capabilities: role.capabilities,
        };
        set({ actor, claims: claimsForRole(role, actor) });
      },
      switchClinic: (clinicId) => {
        const currentActor = get().actor;
        if (clinicId && !currentActor.managedClinics.includes(clinicId)) return;
        set({
          selectedClinicId: clinicId,
          actor: { ...currentActor, clinicId: clinicId ?? undefined },
          claims: {
            ...get().claims,
            clinicId: clinicId ?? '',
          },
        });
      },
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'mederp-mock-actor',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        actor: state.actor,
        claims: state.claims,
        roleSwitcherPriority: state.roleSwitcherPriority,
        selectedClinicId: state.selectedClinicId,
      }) as MockActorState,
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<MockActorState> | undefined;
        const persistedActor = persisted?.actor;
        // Keep the mock actor's initial authority and clinic scope available even
        // when localStorage contains an older/incomplete mock state.
        const actor: MockActor = {
          ...INITIAL_ACTOR,
          ...persistedActor,
          managedClinics:
            persistedActor?.managedClinics?.length
              ? persistedActor.managedClinics
              : INITIAL_ACTOR.managedClinics,
        };
        const roleSwitcherPriority = Math.max(
          INITIAL_ACTOR.rolePriority,
          persisted?.roleSwitcherPriority ?? currentState.roleSwitcherPriority
        );
        const persistedRoleSlug =
          persisted?.claims?.role?.slug ?? actor.roleSlug;
        const role =
          AVAILABLE_ROLES.find((candidate) => candidate.slug === persistedRoleSlug) ??
          INITIAL_ROLE;
        const persistedClinicId = persisted?.selectedClinicId;
        const initialClinicId = actor.managedClinics.includes(
          INITIAL_ACTOR.clinicId!
        )
          ? INITIAL_ACTOR.clinicId!
          : (actor.managedClinics[0] ?? null);
        const selectedClinicId =
          persistedClinicId === null
            ? null
            : persistedClinicId &&
                actor.managedClinics.includes(persistedClinicId)
              ? persistedClinicId
              : initialClinicId;

        return {
          ...currentState,
          ...persisted,
          actor,
          claims: claimsForRole(role, actor),
          selectedClinicId,
          roleSwitcherPriority,
          selectableRoles: AVAILABLE_ROLES.filter(
            (role) => role.priority <= roleSwitcherPriority
          ),
          canSwitchRole: roleSwitcherPriority >= 80,
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
