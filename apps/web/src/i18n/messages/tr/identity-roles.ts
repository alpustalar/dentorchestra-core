const identityRoles = {
  IdentityRoles: {
    eyebrow: 'Kimlik ve erişim yönetimi',
    title: 'Roller ve yetkiler',
    description:
      'Sistem rollerinin kapsamını, öncelik seviyesini ve modül bazındaki yetkilerini inceleyin.',
    readOnly: 'Sistem kataloğu · salt okunur',
    systemRole: 'Sistem rolü',
    priority: 'Öncelik: {value}',
    moduleCount: '{count} modül',
    capabilityCount: '{count} yetki',
    summary: {
      roles: 'Tanımlı sistem rolü',
      modules: 'Yetkilendirilebilir modül',
      capabilities: 'Benzersiz yetki',
    },
    roleList: {
      title: 'Rol kataloğu',
      description: 'Detaylarını görmek için bir rol seçin.',
      searchPlaceholder: 'Rol ara…',
      searchLabel: 'Rollerde ara',
      empty: 'Aramanızla eşleşen bir rol bulunamadı.',
    },
    scopes: {
      platform: 'Platform kapsamı',
      organization: 'Organizasyon kapsamı',
      branches: 'Çoklu klinik kapsamı',
      clinic: 'Klinik kapsamı',
    },
    descriptions: {
      admin:
        'Platformun tamamını, sistem tanımlarını ve tüm tenant verilerini yönetir.',
      organization_owner:
        'Organizasyona bağlı kliniklerin operasyon, finans ve ekip yönetiminden sorumludur.',
      branch_manager:
        'Yetkilendirildiği birden fazla kliniğin günlük operasyonlarını ve ekiplerini yönetir.',
      clinic_owner:
        'Tek bir kliniğin klinik, ticari ve idari operasyonlarını uçtan uca yönetir.',
      provider:
        'Hasta, randevu ve tıbbi kayıt süreçlerini kendi hizmet kapsamı içinde yürütür.',
      assistant:
        'Hasta hazırlığı, randevu akışı, klinik kayıtlar ve sarf kullanımını destekler.',
      accountant:
        'Faturalama, tahsilat, kasa, banka ve muhasebe süreçlerini yürütür.',
      receptionist:
        'Hasta kabul, randevu, lead karşılama ve ön büro tahsilat işlemlerini yürütür.',
      inventory_manager:
        'Stok, tedarikçi, satın alma ve ürün hareketlerini yönetir.',
      staff:
        'Kendi özlük işlemlerine ve ortak operasyon kataloglarına sınırlı erişir.',
    },
    capabilities: {
      title: 'Yetki matrisi',
      description:
        'Yetkiler merkezi sistem kataloğundan modül ve aksiyon bazında gösterilir.',
      searchPlaceholder: 'Modül veya aksiyon ara…',
      searchLabel: 'Yetkilerde ara',
      resultCount: '{count} modül',
      moduleCode: 'Modül kodu',
      emptyTitle: 'Eşleşen yetki bulunamadı',
      emptyDescription: 'Arama ifadenizi değiştirerek yeniden deneyin.',
    },
    actions: {
      create: 'Oluşturma',
      read: 'Görüntüleme',
      update: 'Güncelleme',
      delete: 'Silme',
      access: 'Erişim',
    },
  },
} as const;

export default identityRoles;
