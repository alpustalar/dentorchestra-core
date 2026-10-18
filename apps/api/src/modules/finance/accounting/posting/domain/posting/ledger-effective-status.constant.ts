import { JournalEntryStatus } from '@prisma/client';

/**
 * Defterde **etkili** (bakiyeye giren) fiş durumları.
 *
 * Neden `POSTED` tek başına yetmez: storno, defterden kayıt silmez — çift taraflı
 * muhasebede orijinal fiş yerinde kalır ve *yanına* borç/alacağı ters çevrilmiş
 * ikinci bir fiş yazılır; ikisinin net etkisi sıfırdır. `REVERSED`, "bu fiş hiç
 * olmadı" demez, "bu fişin etkisi şu storno fişiyle iptal edildi" der.
 *
 * Yalnız `POSTED` süzülürse storno sonrası **orijinal düşer, storno kalır** ve her
 * hesabın bakiyesi orijinal tutar kadar **ters işaretle** yanlış olur. Bu hata
 * sessizdir: storno fişi kendi içinde dengeli olduğundan mizanın "Σborç = Σalacak"
 * kontrolü yine tutar — sapma yalnız hesap bazında görünür.
 *
 * `DRAFT` dışarıdadır: numarası yoktur, henüz deftere girmemiştir.
 */
export const LEDGER_EFFECTIVE_ENTRY_STATUSES: readonly JournalEntryStatus[] = [
  JournalEntryStatus.POSTED,
  JournalEntryStatus.REVERSED,
];
