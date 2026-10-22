const common = {
  Common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    search: 'Search',
    searchPlaceholder: 'Search patients, leads or operations...',
    loading: 'Loading',
    confirm: 'Confirm',
    appTitle: 'MED ERP',
    appSubtitle: 'Management Panel',
    toggleExpand: 'Expand menu',
    toggleCollapse: 'Collapse menu',
    clinicManager: 'Clinic Manager',
    allClinics: 'All clinics',
    userProfile: '{name} ({role})',
    userFallback: 'User',
    selectRole: 'Select role',
    changeRole: 'Change role',
    roleSwitcherInfo:
      'This selection is available only to clinic owners or company owners.',
    roles: {
      admin: 'System Administrator',
      organizationOwner: 'Organization Owner',
      branchManager: 'Branch Manager',
      clinicOwner: 'Clinic Owner / Responsible Manager',
      provider: 'Doctor',
      assistant: 'Nurse / Assistant',
      accountant: 'Accounting / Finance Manager',
      receptionist: 'Receptionist / Front Desk',
      inventoryManager: 'Inventory Manager',
      staff: 'Support Staff',
    },
    roleScopes: {
      platform: 'Platform administration',
      organization: 'Organization administration',
      branches: 'Branch administration',
      clinic: 'Clinic operations',
    },
    platformAdministration: {
      title: 'Platform administration',
      description:
        'Manage system roles, platform capabilities, and shared clinic configuration.',
    },
  },
} as const;

// Tip türetmeleri
export default common;
