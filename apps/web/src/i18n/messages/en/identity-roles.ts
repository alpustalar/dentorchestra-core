const identityRoles = {
  IdentityRoles: {
    eyebrow: 'Identity and access management',
    title: 'Roles and permissions',
    description:
      'Review the scope, priority, and module-level permissions of system roles.',
    readOnly: 'System catalog · read only',
    systemRole: 'System role',
    priority: 'Priority: {value}',
    moduleCount: '{count} modules',
    capabilityCount: '{count} permissions',
    summary: {
      roles: 'Defined system roles',
      modules: 'Permission modules',
      capabilities: 'Unique permissions',
    },
    roleList: {
      title: 'Role catalog',
      description: 'Select a role to inspect its details.',
      searchPlaceholder: 'Search roles…',
      searchLabel: 'Search roles',
      empty: 'No roles match your search.',
    },
    scopes: {
      platform: 'Platform scope',
      organization: 'Organization scope',
      branches: 'Multi-clinic scope',
      clinic: 'Clinic scope',
    },
    descriptions: {
      admin:
        'Manages the entire platform, system definitions, and all tenant data.',
      organization_owner:
        'Oversees operations, finance, and teams across clinics in the organization.',
      branch_manager:
        'Manages daily operations and teams across multiple assigned clinics.',
      clinic_owner:
        'Manages the clinical, commercial, and administrative operations of one clinic.',
      provider:
        'Handles patients, appointments, and medical records within their care scope.',
      assistant:
        'Supports patient preparation, appointment flow, clinical records, and supply usage.',
      accountant:
        'Runs invoicing, collections, cash, banking, and accounting processes.',
      receptionist:
        'Handles patient intake, appointments, leads, and front-desk collections.',
      inventory_manager:
        'Manages inventory, suppliers, purchasing, and product movements.',
      staff:
        'Has limited access to self-service records and shared operational catalogs.',
    },
    capabilities: {
      title: 'Permission matrix',
      description:
        'Permissions are shown by module and action from the central system catalog.',
      searchPlaceholder: 'Search modules or actions…',
      searchLabel: 'Search permissions',
      resultCount: '{count} modules',
      moduleCode: 'Module code',
      emptyTitle: 'No matching permissions',
      emptyDescription: 'Adjust your search and try again.',
    },
    actions: {
      create: 'Create',
      read: 'View',
      update: 'Update',
      delete: 'Delete',
      access: 'Access',
    },
  },
} as const;

export default identityRoles;
