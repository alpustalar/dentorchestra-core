const financePayroll = {
  FinancePayroll: {
    eyebrow: 'Klinik defteri · bordro tahakkuku',
    demoData: 'Örnek veri',
    title: 'Bordro tahakkuku',
    description:
      'Dışarıda (bordro programında) hesaplanmış brüt→net rakamları kayda geçirin; finans yalnız tahakkuk fişini üretir.',
    noSession: 'Bordro tahakkuklarını görmek için oturum açın.',
    noClinic: 'Yetkili klinik kapsamı bulunamadı. Tahakkuklar yüklenmedi.',
    totalLabel: 'Toplam tahakkuk',
    newAccrual: 'Yeni tahakkuk',
    listTitle: 'Tahakkuk geçmişi',
    listDescription:
      'Kalıcı bir bordro tablosu yoktur; bu liste finansal olay defterinden (PAYROLL_ACCRUED) okunur.',
    filterEmployee: 'Çalışan',
    filterAllEmployees: 'Tüm çalışanlar',
    filterMonth: 'Ay',
    applyFilter: 'Filtrele',
    clearFilter: 'Temizle',
    filterPairHint:
      'Çalışan ve ay birlikte seçilmeli; tek başına filtre uygulanmaz.',
    loadError: 'Tahakkuk geçmişi yüklenemedi.',
    loading: 'Tahakkuklar yükleniyor…',
    empty: 'Bu klinik için kayıtlı tahakkuk bulunamadı.',
    noResults: 'Seçilen çalışan ve ay için tahakkuk bulunamadı.',
    employee: 'Çalışan',
    month: 'Ay',
    grossSalary: 'Brüt ücret',
    employerSgk: 'İşveren SGK',
    netPayable: 'Net ödenecek',
    taxWithholding: 'Stopaj (GV + damga)',
    employeeSgk: 'İşçi SGK',
    createdAt: 'Kayıt tarihi',
    unknownEmployee: 'Çözülemeyen cari',
    partyIdLabel: 'Cari kimliği',
    previous: 'Önceki',
    next: 'Sonraki',
    pagination: '{total} kayıttan {page}. / {totalPages}. sayfa',
    close: 'Kapat',
    detailTitle: 'Tahakkuk detayı',
    detailDescription: 'Finansal olay kaydının bordro dökümü.',
    detailLoading: 'Tahakkuk detayı yükleniyor…',
    detailError: 'Tahakkuk detayı yüklenemedi.',
    breakdownTitle: 'Bordro dökümü',
    systemInfo: 'Sistem bilgileri',
    accountingHint:
      'Bu tahakkuk muhasebe fişine (770 / 335 + 360 + 361) köprülenir; fiş durumu Muhasebe → Fişler ekranından takip edilir.',
    newAccrualTitle: 'Yeni bordro tahakkuku',
    newAccrualDescription:
      'Brüt→net hesaplaması bordro programında yapılır; burada yalnız hazır rakamlar kayda geçirilir.',
    selectEmployee: 'Çalışan seçin',
    noPayableEmployee:
      'Bu klinikte kullanıcı hesabına bağlı aktif çalışan bulunamadı.',
    accrualDate: 'Tahakkuk tarihi',
    accrualDateHint:
      'Bu tarih muhasebe dönemini belirler; kapanmış bir döneme tahakkuk kabul edilmez.',
    balanceCheck:
      'Brüt {gross} — net + stopaj + işçi SGK {decomposed}. Uyuşmazsa kayıt sunucu tarafında reddedilir.',
    validationError: 'Form alanlarını kontrol edin.',
    submitError: 'Tahakkuk kaydedilemedi.',
    recorded: 'Tahakkuk kaydedildi.',
    demoRecorded: 'Örnek modda tahakkuk gerçekten kaydedilmez.',
    recording: 'Kaydediliyor…',
    record: 'Kaydet',
  },
} as const;

export default financePayroll;
