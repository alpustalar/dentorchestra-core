export default {
  patients: {
    profile: {
      breadcrumb: 'Hasta profili',
      typeLabel: 'Tip: {type}',
      protocol: 'Protokol: {number}',
      provider: 'Sorumlu: {name}',
    },
    status: {
      ACTIVE: 'Aktif',
      INACTIVE: 'Pasif',
      ARCHIVED: 'Arşivlendi',
      DECEASED: 'Vefat',
      BLACKLISTED: 'Kara liste',
      POTENTIAL: 'Potansiyel',
      PASSIVE: 'Pasif',
    },
    type: {
      ACTIVE: 'Aktif',
      VIP: 'VIP',
      STANDARD: 'Standart',
    },
  },
} as const;
