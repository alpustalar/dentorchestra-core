export const FINANCE_JOBS = {
  PROCESS_LEDGER: 'process-ledger-entry',
  GENERATE_INVOICE: 'generate-invoice',
} as const;

export const E_DOCUMENT_JOBS = {
  SEND: 'send-e-document',
  /**
   * Entegratörde iptal bildirimi. Fatura iptali **yerel** bir muhasebe kararıdır
   * (storno atılır, belge CANCELLED damgalanır); entegratöre haber vermek doc 07
   * §5 uyarınca ayrı bir outbound adımdır ve iptali bloklamaz.
   */
  CANCEL: 'cancel-e-document',
} as const;

export const ORGANIZATION_JOBS = {
  CLEAN_UP: 'organization-clean-up',
} as const;

export const APPOINTMENT_JOBS = {
  /** Toplu iptal/silme sonrası ilgili hastalara bildirim + Redis temizliği. */
  NOTIFY_BULK_SOFT_DELETED: 'appointment-notify-bulk-soft-deleted',
  /** Yaklaşan randevuları tarayıp (klinik-başına saat penceresi) hatırlatma tetikler. */
  SCAN_DUE_REMINDERS: 'appointment-scan-due-reminders',
} as const;

/**
 * Reminder tarama işinin en geniş ileri penceresi (saat). Klinik-başına
 * `sendSmsReminderHours` bu üst sınırın altında olmalıdır; tarama bu pencerede
 * CONFIRMED + reminderSentAt=null randevuları çeker, sonra klinik ayarına göre eler.
 */
export const APPOINTMENT_REMINDER_MAX_WINDOW_HOURS = 72;

export const USER_JOBS = {
  FIREBASE_ROLLBACK: 'firebase-rollback',
} as const;

export const OUTBOX_JOBS = {
  PROCESS: 'process-outbox',
} as const;

export const POS_JOBS = {
  RECONCILE_PENDING: 'pos-reconcile-pending',
} as const;

export const META_ADS_JOBS = {
  SYNC_CAMPAIGN_METRICS: 'meta-ads-sync-campaign-metrics',
  REFRESH_TOKENS: 'meta-ads-refresh-tokens',
} as const;

export const HEALTH_TOURISM_JOBS = {
  SYNC_HOTEL_CONTENT: 'health-tourism-sync-hotel-content',
} as const;

export const SUBSCRIPTION_JOBS = {
  /** Dönemi geçmiş aktif abonelikleri yeniler (cancelAtPeriodEnd ise iptal, değilse PAST_DUE). */
  RENEW_DUE: 'subscription-renew-due',
  /** Grace süresi dolan PAST_DUE abonelikleri EXPIRED yapar. */
  EXPIRE_PAST_DUE: 'subscription-expire-past-due',
  /** Deneme süresi (trialEndsAt) dolan FREE_TRIAL abonelikleri EXPIRED yapar (grace yok). */
  EXPIRE_TRIALS: 'subscription-expire-trials',
} as const;

/** PAST_DUE aboneliğin süresi bitmeden önceki ödeme bekleme (grace) süresi. */
export const SUBSCRIPTION_GRACE_DAYS = 7;

/** Yeni kiracının otomatik ücretsiz deneme süresi (gün). */
export const SUBSCRIPTION_TRIAL_DAYS = 10;

export const WORK_ORDER_JOBS = {
  /** Termini geçmiş dış iş emirlerini tarar, personele gecikme bildirimi ürettirir. */
  SCAN_OVERDUE: 'work-order-scan-overdue',
} as const;

export const ACCOUNTING_JOBS = {
  /**
   * Gelecek yılın muhasebe dönemini her defter (clinic) için önceden açar.
   * Dönem yoksa posting tümüyle durur (`NoAccountingPeriodForDateException`) ve
   * ekonomik olaylar fişsiz kalır — bu iş o takvim uçurumunu kapatır.
   */
  OPEN_NEXT_YEAR_PERIODS: 'accounting-open-next-year-periods',
} as const;

export const POSTING_JOBS = {
  /**
   * Fişlenmemiş ekonomik olayları süpürür (bütün defterler).
   *
   * Posting hatası dinleyicide yutuluyor (olay defteri bozulmasın diye): CRITICAL
   * uyarı düşüyor ama iş **kalıcı olarak** yapılmamış kalıyordu. Elle backfill
   * komutu vardı; onu tetikleyen tek otomatik kontrol yılda bir kez çalışan dönem
   * kapanışı kapısıydı — yani bir fiş boşluğu aylarca fark edilmeden durabilirdi.
   * Bu iş o aralığı bir güne indirir (at-least-once teslimin yerine geçen tur).
   */
  SWEEP_UNPOSTED_FINANCIAL_EVENTS: 'posting-sweep-unposted-financial-events',
} as const;
