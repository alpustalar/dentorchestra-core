import { InvoiceStatusSchema } from '@input-type-schemas/InvoiceStatusSchema';
import type { InvoiceStatusType as InvoiceStatus } from '@input-type-schemas/InvoiceStatusSchema';
import { EDocumentStatusSchema } from '@input-type-schemas/EDocumentStatusSchema';
import type { EDocumentStatusType as EDocumentStatus } from '@input-type-schemas/EDocumentStatusSchema';

/**
 * "Bu randevu/tahsilat için fatura var" sayılan durumlar — **tek kaynak**
 * (CLAUDE.md finans kuralı 12).
 *
 * İptal edilmiş fatura bu kümede DEĞİLDİR: storno defterden kayıt silmez, belge
 * yerinde kalır (kural 8) ama ticari olarak hükümsüzdür — dolayısıyla aynı
 * randevu/tahsilat için DOĞRU faturanın kesilmesini engellememelidir.
 *
 * Bu kümenin tümleyeni (`CANCELLED`) DB'deki kısmî unique index'lerin koşuludur:
 * `invoices_appointment_id_active_key` / `invoices_payment_id_active_key`
 * (`WHERE status <> 'CANCELLED'`, bkz. migration 20261012120000). Kapı ile
 * kullanım yeri aynı kümeyi zorlamak zorundadır: index daha genişse mükerrer etkin
 * fatura yazılır, kod daha genişse yazılamayan bir faturaya "zaten var" denir.
 *
 * `FAILED` bilinçli olarak kümenin İÇİNDEDİR: hiçbir kod yolu faturayı bu duruma
 * götürmüyor (e-belge hatası yalnız `einvoiceStatus`'ü değiştirir — bkz.
 * `Invoice.markEDocumentFailed`), ama elle/veri taşıma yoluyla oluşmuş bir
 * `FAILED` satır iptal edilmediği sürece o randevunun faturası sayılır.
 */
export const ACTIVE_INVOICE_STATUSES: readonly InvoiceStatus[] = [
  InvoiceStatusSchema.enum.PENDING,
  InvoiceStatusSchema.enum.ISSUED,
  InvoiceStatusSchema.enum.FAILED,
] as const;

/**
 * e-Belge gönderimi **havada**: hak sahiplenilmiş, sonuç henüz bilinmiyor. Bu
 * durumda yerel iptal REDDEDİLİR — iptal ettiğimiz anda processor belgeyi
 * entegratörde oluşturabilir ve elimizde "iptal edilmiş ama vergi idaresinde
 * geçerli" bir belge kalır. Gönderim sonuçlandığında (SENT/ACCEPTED/FAILED)
 * iptal yeniden denenebilir.
 */
export const EDOCUMENT_DISPATCH_IN_FLIGHT_STATUSES: readonly EDocumentStatus[] =
  [EDocumentStatusSchema.enum.QUEUED] as const;

/**
 * Belge entegratörde **kesin** oluştu: yerel iptal yetmez, vergi idaresindeki
 * belgenin de iptal bildirimi gerekir (`EInvoicePort.cancel`). Bildirim doc 07 §5
 * uyarınca ayrı bir outbound adımdır (kuyruk) — iptali bloklamaz.
 *
 * `FAILED` bilinçli olarak burada DEĞİL: gönderim hatasında belgenin oluşup
 * oluşmadığı bilinmiyor ve `einvoiceUuid` boş kalır, yani çağrılacak bir iptal
 * referansı yoktur. O durumu zaten `edocument-send-failed:<invoiceId>` CRITICAL
 * alarmı takip ediyor; yerel iptal engellenmez.
 */
export const EDOCUMENT_CANCEL_REQUIRED_STATUSES: readonly EDocumentStatus[] = [
  EDocumentStatusSchema.enum.SENT,
  EDocumentStatusSchema.enum.ACCEPTED,
] as const;
