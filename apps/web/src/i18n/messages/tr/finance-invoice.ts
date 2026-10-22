const financeInvoice = {
  FinanceInvoice: {
    eyebrow: 'Satış faturaları · belge ve mutabakat',
    demoData: 'Örnek veri',
    title: 'Satış faturaları',
    description:
      'Olay güdümlü oluşan faturaları inceleyin, eksik faturaları tespit edin ve gerektiğinde kontrollü telafi veya iptal işlemi uygulayın.',
    noSession: 'Faturaları görmek için oturum açın.',
    noScope: 'Yetkili organizasyon ve klinik kapsamı bulunamadı.',
    totalLabel: 'Toplam fatura',
    loadError: 'Fatura veya mutabakat verisi yüklenemedi.',
    from: 'Başlangıç',
    to: 'Bitiş',
    invalidRange: 'Başlangıç tarihi bitiş tarihinden sonra olamaz.',

    reconciliationTitle: 'Eksik fatura mutabakatı',
    reconciliationDescription:
      'Seçili tarihlerde tahsilatı tamamlanmış ancak faturası oluşmamış ödemeler.',
    reconciliationLoading: 'Mutabakat kontrol ediliyor…',
    reconciliationClean: 'Eksik fatura yok',
    reconciliationCleanDescription:
      'Seçili aralıkta tahsilatı tamamlanıp faturası oluşmamış ödeme bulunmadı.',
    missingTitle: '{count} eksik fatura bulundu',
    missingDescription:
      'Bu tahsilatlar için normal olay akışında fatura oluşmamış. Telafi işlemi yalnız bu boşluğu yeniden dener.',
    collectedAt: 'Tahsilat tarihi',
    payment: 'Tahsilat',
    patient: 'Hasta',
    amount: 'Tutar',
    backfillConfirm:
      'Seçili tarih aralığındaki eksik faturalar için telafi işlemini onaylıyorum.',
    backfillWarning:
      'İşlem mevcut faturaları değiştirmez; faturası olmayan tahsilatları yeniden işlemeye alır.',
    backfill: 'Eksik faturaları telafi et',
    backfilling: 'Telafi ediliyor…',
    backfillError: 'Eksik fatura telafisi başarısız oldu.',
    backfillSuccess:
      'Telafi tamamlandı: {attempted} kayıt denendi, {issued} fatura üretildi, {failed} kayıt başarısız oldu.',

    listTitle: 'Fatura listesi',
    listDescription:
      'Klinik kapsamındaki satış faturaları. Tarih aralığı yalnız eksik fatura mutabakatına uygulanır.',
    searchPlaceholder: 'Fatura numarasına göre ara',
    search: 'Ara',
    loading: 'Faturalar yükleniyor…',
    empty: 'Bu klinik için fatura bulunamadı.',
    noResults: 'Aramayla eşleşen fatura bulunamadı.',
    invoiceNumber: 'Fatura no',
    issuedAt: 'Kesim tarihi',
    statusLabel: 'Durum',
    actions: 'İşlemler',
    view: 'İncele',
    unassigned: 'Numara bekleniyor',
    notIssued: 'Henüz kesilmedi',
    masked: 'Görüntüleme yetkisi yok',
    previous: 'Önceki',
    next: 'Sonraki',
    page: '{page}. / {totalPages}. sayfa',

    detailTitle: 'Fatura detayı',
    detailDescription: 'Belge durumu, vergi kırılımı ve denetim izi.',
    detailLoading: 'Fatura detayı yükleniyor…',
    detailError: 'Fatura detayı yüklenemedi.',
    netTotal: 'Matrah',
    vatTotal: 'KDV',
    vatRate: 'KDV oranı',
    grandTotal: 'Genel toplam',
    clinic: 'Klinik',
    percent: '%{value}',
    cancelledTitle: 'Fatura iptal edildi',
    cancelReasonMissing: 'İptal gerekçesi bulunmuyor.',
    cancelTitle: 'Faturayı iptal et',
    cancelDescription:
      'İptal, belgeyi hükümsüz kılar ve muhasebe etkisini ters kayıtla götürür.',
    cancelReason: 'İptal gerekçesi',
    cancelReasonPlaceholder: 'En az 5 karakterlik denetlenebilir gerekçe yazın',
    cancelConfirm: 'Bu faturayı iptal etmek istediğimi onaylıyorum.',
    cancelWarning:
      'Bu işlem geri alınamaz; e-belge gönderildiyse entegratör iptal bildirimi de kuyruğa alınır.',
    cancelInvoice: 'Faturayı iptal et',
    cancelling: 'İptal ediliyor…',
    cancelSuccess: 'Fatura iptal edildi ve liste güncellendi.',
    cancelError: 'Fatura iptal edilemedi.',
    cancelMissingSelection: 'İptal edilecek fatura seçilmedi.',

    status: {
      PENDING: 'Bekliyor',
      ISSUED: 'Kesildi',
      FAILED: 'Başarısız',
      CANCELLED: 'İptal edildi',
    },
  },
} as const;

export default financeInvoice;
