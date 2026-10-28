/**
 * Backend'in `ERROR_CODES` sabiti `nest-kernel`'de yaşıyor ve tarayıcıya açık
 * değil (`@dentorchestra/shared/client` yalnız şema/tip/arayüz taşır). Frontend'in
 * özel olarak ele aldığı kodlar bu yüzden burada, tek yerde sabitlenir —
 * bileşenlerin içine serpiştirilmiş çıplak string'ler yerine.
 */
export const APPOINTMENT_ERROR_CODES = {
  /** Seçilen saatte aynı doktorun başka randevusu var (409). */
  ALREADY_BOOKED: 'APPOINTMENT.ALREADY_BOOKED',
} as const;
