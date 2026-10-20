export const ResponseGroups = {
  DATA_OWNER: 'DATA_OWNER', // Verinin sahibi (Kullanıcının kendisi)
  INTERNAL: 'INTERNAL', // Aynı klinik/organizasyon içi erişim
  ADMIN: 'ADMIN',
  MANAGEMENT: 'MANAGEMENT',
  FINANCIAL: 'FINANCIAL'
} as const;

export type ResponseGroup =
  (typeof ResponseGroups)[keyof typeof ResponseGroups];

