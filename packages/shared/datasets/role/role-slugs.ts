export const ROLE_SLUGS = {
  ADMIN: 'admin',
  ORGANIZATION_OWNER: 'organization_owner',
  BRANCH_MANAGER: 'branch_manager',
  CLINIC_OWNER: 'clinic_owner',
  PROVIDER: 'provider',
  ASSISTANT: 'assistant',
  ACCOUNTANT: 'accountant',
  RECEPTIONIST: 'receptionist',
  INVENTORY_MANAGER: 'inventory_manager',
  STAFF: 'staff',
} as const;

export type RoleSlug = (typeof ROLE_SLUGS)[keyof typeof ROLE_SLUGS];
