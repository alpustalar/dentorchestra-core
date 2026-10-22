export default {
  patients: {
    profile: {
      breadcrumb: 'Patient profile',
      typeLabel: 'Type: {type}',
      protocol: 'Protocol: {number}',
      provider: 'Assigned to: {name}',
    },
    status: {
      ACTIVE: 'Active',
      INACTIVE: 'Inactive',
      ARCHIVED: 'Archived',
      DECEASED: 'Deceased',
      BLACKLISTED: 'Blacklisted',
      POTENTIAL: 'Potential',
      PASSIVE: 'Passive',
    },
    type: {
      ACTIVE_TYPE: 'Active',
      VIP: 'VIP',
      STANDARD: 'Standard',
    },
  },
} as const;
