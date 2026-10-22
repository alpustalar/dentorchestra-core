const financeLedger = {
  FinanceLedger: {
    eyebrow: 'Klinik defteri · tahsilat ve gider kayıtları',
    demoData: 'Örnek veri',
    title: 'Finans defteri',
    description:
      'Tahsilat, iade ve gider kayıtlarının klinik defterini; seçili aralık için özet ve mutabakat durumunu inceleyin.',
    noSession: 'Finans defterini görmek için oturum açın.',
    noClinic: 'Yetkili klinik kapsamı bulunamadı. Defter yüklenmedi.',
    from: 'Başlangıç',
    to: 'Bitiş',
    invalidRange: 'Başlangıç tarihi bitiş tarihinden sonra olamaz.',
    loadError: 'Özet veya mutabakat verisi yüklenemedi.',

    summaryTitle: 'Dönem özeti',
    summaryDescription:
      'Seçili tarih aralığında tamamlanmış kayıtların para birimi bazında toplamı.',
    noSummary: 'Seçili aralıkta tamamlanmış kayıt bulunamadı.',
    income: 'Gelir',
    expenses: 'Gider',
    balance: 'Bakiye',
    entryCount: '{count} kayıt',

    reconciliationTitle: 'Mutabakat',
    reconciliationClean: 'Fark yok',
    reconciliationCleanDescription:
      'Seçili aralıkta tahsilat/iade ile defter arasında fark bulunmadı.',
    reconcileTitle: 'Defter farkı bulundu',
    reconcileDescription:
      '{count} kayıt, tahsilat/iade durumuyla defterdeki karşılığı arasında fark taşıyor. Telafi işlemi eksik kalan kayıtları üretir ve durumu kaymış kayıtları hizalar.',
    reconcileConfirm: 'Seçili aralık için telafi işlemini çalıştıracağımı onaylıyorum.',
    reconcileWarning:
      'Bu işlem geri alınamaz; yalnız eksik veya durumu kaymış kayıtları düzeltir, mevcut doğru kayıtları değiştirmez.',
    backfill: 'Telafi et',
    backfilling: 'Telafi ediliyor…',
    backfillError: 'Telafi işlemi başarısız oldu.',
    backfillSuccess: 'Telafi işlemi tamamlandı; defter ve özet güncellendi.',
    mismatchKind: 'Tür',
    mismatchInstallment: 'Taksit',
    mismatchPayment: 'Tahsilat',
    mismatchPatient: 'Hasta',
    mismatchSettledAt: 'Kapanış tarihi',
    mismatchExpectedStatus: 'Beklenen durum',
    mismatchLedgerStatus: 'Defter durumu',
    mismatchMissing: 'Kayıt yok',

    listTitle: 'Defter kayıtları',
    listDescription:
      'Klinik defterindeki tüm kayıtlar; tarih aralığı filtresi bu listeye uygulanmaz.',
    searchPlaceholder: 'Açıklamaya göre ara',
    search: 'Ara',
    sortEntryDate: 'Tarihe göre sırala',
    sortAmount: 'Tutara göre sırala',
    sortAscending: 'Artan sıraya geç',
    sortDescending: 'Azalan sıraya geç',
    loading: 'Defter yükleniyor…',
    empty: 'Bu klinik için defter kaydı bulunamadı.',
    noResults: 'Aramayla eşleşen defter kaydı bulunamadı.',
    noDescription: 'Açıklama yok',
    noDocument: 'Belge no yok',
    noPatient: 'Hastaya bağlı değil',

    columnDate: 'Tarih',
    columnType: 'Tür',
    columnCategory: 'Kategori',
    columnSource: 'Kaynak',
    columnStatus: 'Durum',
    columnDescription: 'Açıklama',
    columnPatient: 'Hasta',
    columnAmount: 'Tutar',
    columnTax: 'KDV',

    previous: 'Önceki',
    next: 'Sonraki',
    page: '{page}. / {totalPages}. sayfa',

    type: {
      INCOME: 'Gelir',
      EXPENSE: 'Gider',
    },
    category: {
      TREATMENT_PAYMENT: 'Tedavi tahsilatı',
      REFUND: 'İade',
      MATERIAL_PURCHASE: 'Malzeme alımı',
      STOCK_ADJUSTMENT: 'Stok düzeltmesi',
      SALARY: 'Maaş',
      RENT: 'Kira',
      OTHER: 'Diğer',
    },
    source: {
      PAYMENT_MODULE: 'Tahsilat modülü',
      INVENTORY_MODULE: 'Stok modülü',
      MANUAL_ENTRY: 'Elle giriş',
    },
    status: {
      COMPLETED: 'Tamamlandı',
      CANCELLED: 'İptal',
      REFUNDED: 'İade edildi',
      CHARGED_BACK: 'Ters ibraz',
    },
  },
} as const;

export default financeLedger;
