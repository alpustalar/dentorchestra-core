#!/usr/bin/env node
/**
 * Finansal değişmez taraması (salt okuma).
 *
 * Neden gerekli: defterin değişmezleri bugün **yazma anında** Value Object'lerde
 * zorlanıyor. Yazma anı kontrolü, o kapıdan geçen her satır için çalışır —
 * geçmişte kapı yokken yazılmış satırlar için hiç çalışmamıştır ve kapıyı
 * atlayan bir yol (raw SQL, veri taşıma betiği, `updateMany`) için de
 * çalışmaz. Üstelik en kritik değişmez (fiş başına Σborç = Σalacak) tek satırlık
 * bir CHECK ile ifade edilemez: birden çok satırı ilgilendirir.
 *
 * Bu yüzden saklanan veriye **soru sorulur**. Hiçbir rapor bu soruyu kendiliğinden
 * sormuyordu: dengesiz bir fiş mizanda görünmez (fark fişin içinde kalır), eksi
 * kasa kapanışta "fazla" gibi görünür. Sessiz kalan hatanın bir sorgusu olmak
 * zorundadır.
 *
 * Kullanım: `pnpm finans:degismezler`
 *
 * (30 kontrol; 7'si tur 31: platform dönemi, rezervasyon iadesi, 336; 3'ü tur 32: platform
 * itirazı; 7'si tur 33: yıl sonu kapanışı, 329 GRNI tahakkuku, mal kabul günlüğü, fatura hesap kümesi.)
 *
 * Çıkış kodu 1 ise en az bir aykırılık var. Temiz çıktıysa, migration
 * `20261015100000_financial_invariant_checks` içindeki `NOT VALID` kısıtlar
 * doğrulanabilir (her biri için):
 *   ALTER TABLE "journal_lines" VALIDATE CONSTRAINT "journal_lines_amount_positive";
 *
 * Otomatik onarım YOK: dengesiz bir fişi "düzeltmek" muhasebe kararıdır
 * (CLAUDE.md finans kuralı 8 — POSTED fiş yerinde kalır, düzeltme storno ile).
 */
const fs = require('fs');
const path = require('path');
const {
  loadPurchaseInvoiceAccountCodes,
} = require('./lib/purchase-invoice-account-codes.cjs');

const ENV_FILE = path.join(
  __dirname,
  '..',
  'envs',
  `.env.${process.env.NODE_ENV || 'development'}`
);

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!fs.existsSync(ENV_FILE)) {
    throw new Error(`DATABASE_URL yok ve env dosyası bulunamadı: ${ENV_FILE}`);
  }
  const line = fs
    .readFileSync(ENV_FILE, 'utf8')
    .split('\n')
    .find((l) => l.startsWith('DATABASE_URL'));
  if (!line) throw new Error(`DATABASE_URL ${ENV_FILE} içinde yok`);
  return line
    .slice(line.indexOf('=') + 1)
    .trim()
    .replace(/^["']|["']$/g, '');
}

/**
 * Her kontrol: başlık + neden önemli + aykırı satırları döndüren sorgu.
 * Sorgular `LIMIT`'li: tarama bir teşhis aracıdır, dökümü değil.
 */
const CHECKS = [
  {
    key: 'dengesiz-fis',
    title: 'Dengesiz fiş (Σborç ≠ Σalacak)',
    why: 'Çift taraflı kaydın tek değişmezi. Fark fişin İÇİNDE kaldığı için mizan yine dengeli görünür.',
    sql: `
      SELECT e."id",
             e."entry_no"::text  AS entry_no,
             e."status"::text   AS status,
             sum(l."debit")::text  AS total_debit,
             sum(l."credit")::text AS total_credit
        FROM "journal_entries" e
        JOIN "journal_lines" l ON l."entry_id" = e."id"
       GROUP BY e."id", e."entry_no", e."status"
      HAVING sum(l."debit") <> sum(l."credit")
       ORDER BY e."entry_no" DESC
       LIMIT 50`,
  },
  {
    key: 'tek-satirli-fis',
    title: 'İki satırdan az satırı olan fiş',
    why: 'Tek satırlı fiş çift taraflı kayıt değildir; karşı hesap hiç yazılmamış demektir.',
    sql: `
      SELECT e."id", e."entry_no"::text AS entry_no, count(l."id")::int AS line_count
        FROM "journal_entries" e
        LEFT JOIN "journal_lines" l ON l."entry_id" = e."id"
       GROUP BY e."id", e."entry_no"
      HAVING count(l."id") < 2
       ORDER BY e."entry_no" DESC
       LIMIT 50`,
  },
  {
    key: 'satir-tutar-ihlali',
    title: 'Satır tutarı değişmez ihlali (negatif / XOR / sıfır)',
    why: 'Yön borç-alacak kolonuyla ifade edilir; negatif ya da iki yanı dolu satır hesabın karakterini bozar.',
    sql: `
      SELECT l."id", l."entry_id", l."debit"::text AS debit, l."credit"::text AS credit
        FROM "journal_lines" l
       WHERE l."debit" < 0
          OR l."credit" < 0
          OR (l."debit" > 0 AND l."credit" > 0)
          OR (l."debit" = 0 AND l."credit" = 0)
       LIMIT 50`,
  },
  {
    key: 'kur-ihlali',
    title: 'Geçersiz kur / orijinal tutar',
    why: 'Sıfır veya negatif kur çevrilmiş satırı sessizce sıfırlar ya da ters çevirir; fiş yine denk görünür.',
    sql: `
      SELECT l."id", l."entry_id", l."fx_rate"::text AS fx_rate,
             l."original_debit"::text AS original_debit,
             l."original_credit"::text AS original_credit
        FROM "journal_lines" l
       WHERE ("fx_rate" IS NOT NULL AND "fx_rate" <= 0)
          OR ("original_debit" IS NOT NULL AND "original_debit" < 0)
          OR ("original_credit" IS NOT NULL AND "original_credit" < 0)
       LIMIT 50`,
  },
  {
    key: 'defter-kapsam-ihlali',
    title: 'Fiş ile dönemin kliniği uyuşmuyor',
    why: 'Fiş başka kiracının dönemine yazılmış: o dönem kapandığında fiş kilitlenmez, mizan yanlış deftere düşer.',
    sql: `
      SELECT e."id", e."entry_no"::text AS entry_no,
             e."clinic_id" AS entry_clinic, p."clinic_id" AS period_clinic
        FROM "journal_entries" e
        JOIN "accounting_periods" p ON p."id" = e."period_id"
       WHERE e."clinic_id" <> p."clinic_id"
       LIMIT 50`,
  },
  {
    key: 'eksi-108',
    title: 'Eksi 108 (yolda olmayan para kapatılmış)',
    why: 'Hazır değer hesabı alacak bakiyesine düşemez: sağlayıcı hesap kapaması bekleyen tutardan fazlasını kapatmış demektir (aynı payout iki kez girilmiş olabilir).',
    sql: `
      SELECT a."clinic_id",
             a."code",
             sum(l."debit")::text  AS total_debit,
             sum(l."credit")::text AS total_credit,
             (sum(l."debit") - sum(l."credit"))::text AS balance
        FROM "journal_lines" l
        JOIN "accounts" a ON a."id" = l."account_id"
        JOIN "journal_entries" e ON e."id" = l."entry_id"
       WHERE a."code" = '108'
         AND e."status" IN ('POSTED', 'REVERSED')
       GROUP BY a."clinic_id", a."code"
      HAVING sum(l."debit") - sum(l."credit") < 0
       LIMIT 50`,
  },
  {
    key: 'eksi-kasa',
    title: 'Eksi kasa (beklenen tutar negatif)',
    why: 'Çıkışlar çekmecedeki nakdi aşmış. Kapanışta bu, gerçek olmayan bir "sayım fazlası" → 679 uydurma gelir üretir.',
    sql: `
      SELECT s."id", s."status"::text AS status,
             s."opening_float"::text  AS opening_float,
             s."expected_amount"::text AS expected_amount,
             s."difference"::text      AS difference
        FROM "cash_sessions" s
       WHERE s."expected_amount" IS NOT NULL AND s."expected_amount" < 0
       ORDER BY s."created_at" DESC
       LIMIT 50`,
  },
  {
    key: 'acik-oturumda-eksi-cekmece',
    title: 'Açık oturumda çekmece eksiye düşmüş',
    why: 'Kapanış beklenmeden görülür: açılış + girişler − çıkışlar < 0. Fiziken imkânsız bir durumdur.',
    sql: `
      SELECT s."id",
             s."opening_float"::text AS opening_float,
             coalesce(sum(CASE WHEN m."direction" = 'IN'  THEN m."amount" END), 0)::text AS total_in,
             coalesce(sum(CASE WHEN m."direction" = 'OUT' THEN m."amount" END), 0)::text AS total_out
        FROM "cash_sessions" s
        LEFT JOIN "cash_movements" m ON m."cash_session_id" = s."id"
       WHERE s."status" = 'OPEN'
       GROUP BY s."id", s."opening_float"
      HAVING s."opening_float"
             + coalesce(sum(CASE WHEN m."direction" = 'IN'  THEN m."amount" END), 0)
             - coalesce(sum(CASE WHEN m."direction" = 'OUT' THEN m."amount" END), 0) < 0
       LIMIT 50`,
  },
  {
    key: 'eksi-127',
    title: 'Eksi 127 (açılandan fazla itiraz kapatılmış)',
    why: 'Kart itirazı ara hesabı alacak bakiyesine düşemez: çözüm fişi (kazanıldı/kaybedildi) açılış fişinden fazlasını kapatmış demektir (aynı itiraz iki kez çözülmüş olabilir).',
    sql: `
      SELECT a."clinic_id",
             a."code",
             sum(l."debit")::text  AS total_debit,
             sum(l."credit")::text AS total_credit,
             (sum(l."debit") - sum(l."credit"))::text AS balance
        FROM "journal_lines" l
        JOIN "accounts" a ON a."id" = l."account_id"
        JOIN "journal_entries" e ON e."id" = l."entry_id"
       WHERE a."code" = '127'
         AND e."status" IN ('POSTED', 'REVERSED')
       GROUP BY a."clinic_id", a."code"
      HAVING sum(l."debit") - sum(l."credit") < 0
       LIMIT 50`,
  },
  {
    key: 'itiraz-127-mutabakat',
    title: '127 bakiyesi açık itirazların toplamına eşit değil',
    why: '127 yalnız sonucu bekleyen kart itirazlarını tutar: bakiye = Σ açık (OPEN) itiraz tutarı olmalı. Fark, fişlenmemiş bir itiraz olayı (önce `pnpm finans:eksik`; açılış/çözüm fişi henüz atılmamış olabilir — kısa süreli fark normaldir) ya da 127’ye elle yazılmış bir fiştir.',
    sql: `
      WITH bal AS (
        SELECT a."clinic_id", sum(l."debit") - sum(l."credit") AS balance
          FROM "journal_lines" l
          JOIN "accounts" a ON a."id" = l."account_id"
          JOIN "journal_entries" e ON e."id" = l."entry_id"
         WHERE a."code" = '127'
           AND e."status" IN ('POSTED', 'REVERSED')
         GROUP BY a."clinic_id"
      ),
      open_total AS (
        SELECT c."clinic_id", sum(c."amount") AS open_amount
          FROM "card_chargebacks" c
         WHERE c."status" = 'OPEN'
         GROUP BY c."clinic_id"
      )
      SELECT coalesce(bal."clinic_id", open_total."clinic_id") AS clinic_id,
             coalesce(bal.balance, 0)::text                    AS balance_127,
             coalesce(open_total.open_amount, 0)::text         AS open_chargebacks
        FROM bal
        FULL OUTER JOIN open_total ON open_total."clinic_id" = bal."clinic_id"
       WHERE coalesce(bal.balance, 0) <> coalesce(open_total.open_amount, 0)
       LIMIT 50`,
  },
  {
    key: 'itiraz-tavan-asimi-pos',
    title: 'Kart itirazı + iade/iptal POS satışını aşıyor',
    why: 'Para geri götüren her yol (iade, iptal, ters ibraz) aynı kümülatif tavanı paylaşır. Aşıldıysa kart sahibine aynı para iki kez gitmiştir (bir kez sağlayıcı kesintisi, bir kez bizim iademiz).',
    sql: `
      SELECT c."source_id",
             c."clinic_id",
             s."amount"::text                         AS sale_amount,
             sum(c."amount")::text                    AS active_chargebacks,
             coalesce(r.reversed, 0)::text            AS live_reversals
        FROM "card_chargebacks" c
        JOIN "pos_transactions" s ON s."id" = c."source_id"
        LEFT JOIN (
          SELECT "original_pos_transaction_id" AS id, sum("amount") AS reversed
            FROM "pos_transactions"
           WHERE "kind" IN ('REFUND', 'VOID')
             AND "status" IN ('PENDING', 'SUCCESS')
           GROUP BY "original_pos_transaction_id"
        ) r ON r.id = s."id"
       WHERE c."source_type" = 'POS_TRANSACTION'
         AND c."status" IN ('OPEN', 'LOST')
       GROUP BY c."source_id", c."clinic_id", s."amount", r.reversed
      HAVING sum(c."amount") + coalesce(r.reversed, 0) > s."amount"
       LIMIT 50`,
  },
  {
    key: 'itiraz-tavan-asimi-online',
    title: 'Kart itirazı sanal POS taksidini aşıyor / iade edilmiş taksit itiraz altında',
    why: 'Sanal POS taksidi tek seferde iade edilir. Aktif itirazların toplamı taksit tutarını aşıyorsa ya da itiraz altındaki taksit REFUNDED ise kart sahibine para iki kez gitmiştir.',
    sql: `
      SELECT c."source_id" AS installment_id,
             c."clinic_id",
             i."amount"::text      AS installment_amount,
             i."status"::text      AS installment_status,
             sum(c."amount")::text AS active_chargebacks
        FROM "card_chargebacks" c
        JOIN "payment_installments" i ON i."id" = c."source_id"
       WHERE c."source_type" = 'ONLINE_PAYMENT'
         AND c."status" IN ('OPEN', 'LOST')
       GROUP BY c."source_id", c."clinic_id", i."amount", i."status"
      HAVING sum(c."amount") > i."amount"
          OR i."status" = 'REFUNDED'
       LIMIT 50`,
  },
  {
    key: 'itiraz-tavan-asimi-booking',
    title: 'Kart itirazı + iade platform rezervasyon tahsilatını aşıyor',
    why: 'Para geri götüren her yol (iade, iptal, ters ibraz) aynı kümülatif tavanı paylaşır (kural 17). Rezervasyon iadesi (PENDING / UNCONFIRMED / CONFIRMED) ile aktif itirazların (OPEN + LOST) toplamı iyzico’nun çektiği TRY tutarı aşıyorsa kart sahibine aynı para iki kez gitmiştir: bir kez sağlayıcı kesintisi, bir kez bizim iademiz.',
    sql: `
      SELECT c."source_id" AS booking_payment_id,
             c."clinic_id",
             bp."try_amount"::text                 AS collected_try,
             sum(c."amount")::text                 AS active_chargebacks,
             coalesce(r.returned, 0)::text         AS live_refunds
        FROM "card_chargebacks" c
        JOIN "booking_payments" bp ON bp."id" = c."source_id"
        LEFT JOIN (
          SELECT "booking_payment_id", sum("amount") AS returned
            FROM "booking_payment_refunds"
           WHERE "kind" IN ('CANCELLATION', 'BOOKING_FAILED')
             AND "status" <> 'FAILED'
           GROUP BY "booking_payment_id"
        ) r ON r."booking_payment_id" = bp."id"
       WHERE c."source_type" = 'BOOKING_PAYMENT'
         AND c."status" IN ('OPEN', 'LOST')
       GROUP BY c."source_id", c."clinic_id", bp."try_amount", r.returned
      HAVING sum(c."amount") + coalesce(r.returned, 0) > bp."try_amount"
       LIMIT 50`,
  },
  {
    key: 'itiraz-booking-kaynak-uyumsuz',
    title: 'Rezervasyon itirazı kaynağı iyzico tahsilatı değil ya da platform defterinde değil',
    why: 'BOOKING_PAYMENT itirazı yalnız platform kliniğine ve yalnız iyzico/TRY ile tahsil edilmiş bir rezervasyon ödemesine bağlanabilir. Aksi halde 127/659.01 başka bir kiracının ya da kapanış akışı olmayan (Stripe) bir kanalın parasına yazılmıştır.',
    sql: `
      SELECT c."id", c."clinic_id", c."source_id",
             bp."paid_provider"::text AS paid_provider,
             (cl."is_platform" IS TRUE) AS clinic_is_platform
        FROM "card_chargebacks" c
        LEFT JOIN "booking_payments" bp ON bp."id" = c."source_id"
        LEFT JOIN "clinics" cl ON cl."id" = c."clinic_id"
       WHERE c."source_type" = 'BOOKING_PAYMENT'
         AND (
              bp."id" IS NULL
           OR bp."paid_provider"::text IS DISTINCT FROM 'IYZICO'
           OR cl."is_platform" IS NOT TRUE
         )
       LIMIT 50`,
  },
  {
    key: 'itiraz-659-mutabakat',
    title: '659.01 bakiyesi kaybedilen platform itirazlarının toplamına eşit değil',
    why: '659.01 yalnız kaybedilen platform rezervasyon itirazlarını tutar: bakiye = Σ LOST (BOOKING_PAYMENT) itiraz tutarı olmalı. Fark, fişlenmemiş bir çözüm olayı (önce `pnpm finans:eksik`; kısa süreli fark normaldir) ya da 659.01’e elle yazılmış bir fiştir.',
    sql: `
      WITH bal AS (
        SELECT a."clinic_id", sum(l."debit") - sum(l."credit") AS balance
          FROM "journal_lines" l
          JOIN "accounts" a ON a."id" = l."account_id"
          JOIN "journal_entries" e ON e."id" = l."entry_id"
         WHERE a."code" = '659.01'
           AND e."status" IN ('POSTED', 'REVERSED')
         GROUP BY a."clinic_id"
      ),
      lost_total AS (
        SELECT c."clinic_id", sum(c."amount") AS lost_amount
          FROM "card_chargebacks" c
         WHERE c."source_type" = 'BOOKING_PAYMENT'
           AND c."status" = 'LOST'
         GROUP BY c."clinic_id"
      )
      SELECT coalesce(bal."clinic_id", lost_total."clinic_id") AS clinic_id,
             coalesce(bal.balance, 0)::text                     AS balance_659_01,
             coalesce(lost_total.lost_amount, 0)::text          AS lost_chargebacks
        FROM bal
        FULL OUTER JOIN lost_total ON lost_total."clinic_id" = bal."clinic_id"
       WHERE coalesce(bal.balance, 0) <> coalesce(lost_total.lost_amount, 0)
       LIMIT 50`,
  },
  {
    key: 'itiraz-plan-uyumsuz',
    title: 'Kaybedilen itiraz plana yansımış görünüyor ama taksit/telafi tutmuyor',
    why: 'Plan yansıması SYNCED ise geri alınan taksit CHARGED_BACK olmalı ve onu gösteren bir telafi taksidi bulunmalı. Aksi halde hasta borcu defterde (B 120) var, ödeme planında yok.',
    sql: `
      SELECT c."id",
             c."installment_id",
             i."status"::text AS installment_status,
             c."recovery_installment_id",
             r."recovers_installment_id" AS recovery_points_to
        FROM "card_chargebacks" c
        LEFT JOIN "payment_installments" i ON i."id" = c."installment_id"
        LEFT JOIN "payment_installments" r ON r."id" = c."recovery_installment_id"
       WHERE c."status" = 'LOST'
         AND c."plan_sync_status" = 'SYNCED'
         AND (
              i."id" IS NULL
           OR i."status" <> 'CHARGED_BACK'
           OR r."id" IS NULL
           OR r."recovers_installment_id" IS DISTINCT FROM c."installment_id"
         )
       LIMIT 50`,
  },
  {
    key: 'donemsiz-defter',
    title: 'Bugünü kapsayan muhasebe dönemi olmayan defter',
    why: 'Dönemi olmayan defterde HER fiş NoAccountingPeriodForDateException ile reddedilir. Platform kiracısı normal kayıt akışından geçmediği için dönemi hiç açılmıyordu (yıllık iş yalnız zaten dönemi olanları kapsıyordu). Defter sahipleri: hesap planı kurulu klinikler ∪ platform.',
    sql: `
      SELECT l."clinic_id"
        FROM (
              SELECT DISTINCT "clinic_id" FROM "accounts"
              UNION
              SELECT "id" FROM "clinics" WHERE "is_platform" = true
             ) l
       WHERE NOT EXISTS (
              SELECT 1 FROM "accounting_periods" p
               WHERE p."clinic_id" = l."clinic_id"
                 AND p."starts_at" <= now() AND p."ends_at" >= now()
             )
       LIMIT 50`,
  },
  {
    key: 'rezervasyon-iade-tutar-ihlali',
    title: 'Rezervasyon iadesi kendi tahsilatına bağlı değil ya da tahsilatı aşıyor',
    why: 'Rezervasyonun KENDİ tahsilatını iade eden satır (CANCELLATION / BOOKING_FAILED) aynı kanalı, aynı referansı ve en çok tahsil edilen tutarı taşımalı. Aksi halde iade başka bir paraya ya da fazlasına dokunuyor demektir.',
    sql: `
      SELECT r."id", r."kind"::text AS kind, r."provider"::text AS provider,
             r."charge_provider_ref", bp."paid_provider_ref",
             r."amount"::text AS refund_amount,
             CASE r."provider" WHEN 'IYZICO' THEN bp."try_amount" ELSE bp."sale_amount" END::text AS collected
        FROM "booking_payment_refunds" r
        JOIN "booking_payments" bp ON bp."id" = r."booking_payment_id"
       WHERE r."kind" IN ('CANCELLATION', 'BOOKING_FAILED')
         AND (
              r."charge_provider_ref" IS DISTINCT FROM bp."paid_provider_ref"
           OR r."provider" IS DISTINCT FROM bp."paid_provider"
           OR r."amount" > CASE r."provider" WHEN 'IYZICO' THEN bp."try_amount" ELSE bp."sale_amount" END
         )
       LIMIT 50`,
  },
  {
    key: 'rezervasyon-iade-durum-uyumsuz',
    title: 'Rezervasyon durumu iade satırıyla tutarsız',
    why: 'REFUNDED iade TALEP edildi demektir ve kendi tahsilatı için bir iade satırı olmak zorundadır. CANCELLATION satırı varken kayıt REFUNDED değilse ya da BOOKING_FAILED onaylanmışken kayıt REFUNDED değilse iki kaynak ayrışmış demektir.',
    sql: `
      SELECT bp."id", bp."status"::text AS status
        FROM "booking_payments" bp
       WHERE bp."status" = 'REFUNDED'
         AND NOT EXISTS (
              SELECT 1 FROM "booking_payment_refunds" r
               WHERE r."booking_payment_id" = bp."id"
                 AND r."kind" IN ('CANCELLATION', 'BOOKING_FAILED')
             )
       UNION ALL
      SELECT bp."id", bp."status"::text
        FROM "booking_payments" bp
        JOIN "booking_payment_refunds" r ON r."booking_payment_id" = bp."id"
       WHERE (r."kind" = 'CANCELLATION' AND bp."status" <> 'REFUNDED')
          OR (r."kind" = 'BOOKING_FAILED' AND r."status" = 'CONFIRMED' AND bp."status" <> 'REFUNDED')
          OR (r."kind" = 'BOOKING_FAILED' AND r."status" <> 'CONFIRMED' AND bp."status" NOT IN ('FAILED', 'REFUNDED'))
       LIMIT 50`,
  },
  {
    key: 'iade-askida',
    title: 'Bir saatten uzun süredir PENDING iade',
    why: 'Sağlayıcı çağrısı sürerken süreç ölmüş ya da settle yazılamamış olabilir. Satır elle çözülene kadar iade tavanında "belki döndü" sayılır.',
    sql: `
      SELECT r."id", r."kind"::text AS kind, r."provider"::text AS provider,
             r."charge_provider_ref", r."amount"::text AS amount, r."requested_at"
        FROM "booking_payment_refunds" r
       WHERE r."status" = 'PENDING'
         AND r."requested_at" < now() - interval '1 hour'
       LIMIT 50`,
  },
  {
    key: 'rezervasyon-askida',
    title: 'Bir saatten uzun süredir PAID (para alındı, saga takıldı)',
    why: 'Ödeme onaylandı ama rezervasyon ne BOOKED ne FAILED oldu: HotelBeds çağrısı sırasında süreç ölmüş olabilir. Müşterinin parası alındı, karşılığı yok, iade de talep edilmedi.',
    sql: `
      SELECT bp."id", bp."booking_type"::text AS booking_type, bp."paid_at"
        FROM "booking_payments" bp
       WHERE bp."status" = 'PAID'
         AND bp."paid_at" < now() - interval '1 hour'
       LIMIT 50`,
  },
  {
    key: 'eksi-336',
    title: 'Borç bakiyeli 336 (iadeden fazla kapatılmış)',
    why: '336 müşteriye iade borcudur (alacak karakterli): borç bakiyesine düşmesi açılıştan fazlasının kapatıldığı anlamına gelir (aynı iade iki kez kapatılmış ya da açılış fişi hiç yazılmamış olabilir).',
    sql: `
      SELECT a."clinic_id",
             a."code",
             (sum(l."debit") - sum(l."credit"))::text AS debit_balance
        FROM "journal_lines" l
        JOIN "accounts" a ON a."id" = l."account_id"
        JOIN "journal_entries" e ON e."id" = l."entry_id"
       WHERE a."code" = '336'
         AND e."status" IN ('POSTED', 'REVERSED')
       GROUP BY a."clinic_id", a."code"
      HAVING sum(l."debit") - sum(l."credit") > 0
       LIMIT 50`,
  },
  {
    key: '336-mutabakat',
    title: '336 bakiyesi onaylanmamış iade edilecek tahsilatların toplamına eşit değil',
    why: '336 v1’de YALNIZ iade edilecek tahsilata (çift çekim / başarısız rezervasyon, iyzico) ayrılıdır: alacak bakiyesi = Σ henüz CONFIRMED olmamış LIVE iade tutarı. Fark, fişlenmemiş bir 336 olayı (önce `pnpm finans:eksik`; kısa süreli fark normaldir) ya da 336’ya elle yazılmış bir fiştir.',
    sql: `
      SELECT c."id" AS platform_clinic_id,
             coalesce(b.balance, 0)::text AS ledger_balance,
             coalesce(r.open_amount, 0)::text AS open_refunds
        FROM "clinics" c
        LEFT JOIN (
              SELECT a."clinic_id", sum(l."credit") - sum(l."debit") AS balance
                FROM "journal_lines" l
                JOIN "accounts" a ON a."id" = l."account_id"
                JOIN "journal_entries" e ON e."id" = l."entry_id"
               WHERE a."code" = '336' AND e."status" IN ('POSTED', 'REVERSED')
               GROUP BY a."clinic_id"
             ) b ON b."clinic_id" = c."id"
        CROSS JOIN (
              SELECT coalesce(sum("amount"), 0) AS open_amount
                FROM "booking_payment_refunds"
               WHERE "origin" = 'LIVE'
                 AND "kind" IN ('UNCLAIMED_CHARGE', 'BOOKING_FAILED')
                 AND "provider" = 'IYZICO'
                 AND "status" <> 'CONFIRMED'
             ) r
       WHERE c."is_platform" = true
         AND coalesce(b.balance, 0) <> r.open_amount
       LIMIT 50`,
  },

  // ───────────────────────────── Tur 33: yıl sonu kapanışı (§92) ─────────────────────────────
  {
    key: 'grni-329-yalniz-duzeltme-fisi',
    title: "329'a düzeltme (ADJUSTING) dışı bir fiş yazmış",
    why: "329 (Diğer Ticari Borçlar) yalnız yıl sonu GRNI tahakkuku ve ters kaydının hesabıdır; bu fişler ADJUSTING'tir. Başka bir akış 329'a yazarsa tahakkuk bakiyesi gerçek bir borçla karışır ve '329 yalnız 31.12'de açıktır' değişmezi anlamsızlaşır. Alış faturası kabul kümesinde 329 yoktur — fatura üzerinden yazılması mümkün olmamalıydı.",
    sql: `
      SELECT e."id", e."clinic_id", e."entry_no"::text AS entry_no,
             e."kind"::text AS kind, e."description"
        FROM "journal_entries" e
       WHERE e."kind"::text <> 'ADJUSTING'
         AND EXISTS (
               SELECT 1
                 FROM "journal_lines" l
                 JOIN "accounts" a ON a."id" = l."account_id"
                WHERE l."entry_id" = e."id" AND a."code" = '329'
             )
       ORDER BY e."entry_date" DESC
       LIMIT 50`,
  },
  {
    key: 'grni-329-bakiye',
    title: "329 bakiyesi kapanmış yılın 31 Aralık'ı dışında sıfırdan farklı (ya da ters kaydı yok)",
    why: "Tahakkuk 31.12'de açılır, ertesi yılın 1 Ocak'ında tam tutarıyla kapanır. Başka bir tarihte sıfırdan farklı bakiye, ya yanlış tarihli bir fiş ya da eksik/farklı tutarlı bir ters kayıttır; ters kaydı olmayan tahakkuk faturayla birlikte gideri iki kez sayar. 'bakiye' sütunu alacak bakiyesidir (açık tahakkuk).",
    sql: `
      WITH moves AS (
        SELECT e."clinic_id", e."entry_date", e."id" AS entry_id,
               sum(l."debit" - l."credit") AS delta
          FROM "journal_lines" l
          JOIN "accounts" a ON a."id" = l."account_id" AND a."code" = '329'
          JOIN "journal_entries" e ON e."id" = l."entry_id"
         WHERE e."status" IN ('POSTED', 'REVERSED')
         GROUP BY e."clinic_id", e."entry_date", e."id"
      ), running AS (
        SELECT m.*,
               sum(m.delta) OVER (
                 PARTITION BY m."clinic_id" ORDER BY m."entry_date", m.entry_id
               ) AS balance_after
          FROM moves m
      ), at_year_end AS (
        SELECT r.*,
               (r."entry_date" AT TIME ZONE 'Europe/Istanbul') AS local_ts
          FROM running r
      )
      -- (a) hareket sonrası bakiye sıfır değil ve hareket kapanmış bir yılın 31 Aralık'ında DEĞİL
      SELECT y."clinic_id", y.entry_id::text AS entry_id, y."entry_date",
             (-y.balance_after)::text AS open_credit_balance, 'yanlış tarih' AS reason
        FROM at_year_end y
       WHERE y.balance_after <> 0
         AND NOT (
               extract(month FROM y.local_ts) = 12 AND extract(day FROM y.local_ts) = 31
           AND EXISTS (
                 SELECT 1 FROM "accounting_periods" p
                  WHERE p."clinic_id" = y."clinic_id"
                    AND p."status" = 'CLOSED'
                    AND p."year" = extract(year FROM y.local_ts)::int
               )
             )
      UNION ALL
      -- (b) nihai bakiye sıfır değil: tahakkukun ters kaydı eksik ya da farklı tutarlı
      SELECT m."clinic_id", NULL, NULL, (-sum(m.delta))::text, 'nihai bakiye sıfır değil'
        FROM moves m
       GROUP BY m."clinic_id"
      HAVING sum(m.delta) <> 0
       LIMIT 50`,
  },
  {
    key: 'kapanmis-yil-sonuc-bakiyeli',
    title: 'Kapanmış yılda sıfırlanmamış sonuç hesabı (6, 7 ya da 690)',
    why: "CLOSED bir dönemde 6/7. sınıf hesapları ve 690 havuzu kapanış fişleriyle sıfırlanmış olmalıdır; kalan bakiye, kapanıştan sonra o yıla düşen bir fiş (dönem kapısı atlanmış) ya da yansıtılmamış/kapatılmamış bir hesaptır. Hata sessizdir: kapanış fişleri kendi içinde dengelidir.",
    sql: `
      SELECT p."clinic_id", p."year", a."code",
             (sum(l."debit") - sum(l."credit"))::text AS balance
        FROM "accounting_periods" p
        JOIN "journal_entries" e
          ON e."clinic_id" = p."clinic_id"
         AND e."entry_date" >= p."starts_at" AND e."entry_date" <= p."ends_at"
         AND e."status" IN ('POSTED', 'REVERSED')
        JOIN "journal_lines" l ON l."entry_id" = e."id"
        JOIN "accounts" a ON a."id" = l."account_id"
       WHERE p."status" = 'CLOSED'
         AND (a."code" ~ '^[67]' OR a."code" = '690')
       GROUP BY p."clinic_id", p."year", a."code"
      HAVING sum(l."debit") - sum(l."credit") <> 0
       ORDER BY p."clinic_id", p."year", a."code"
       LIMIT 50`,
  },
  {
    key: 'kapanis-sirasi',
    title: 'Önceki yıl kapanmamışken sonraki yıl kapatılmış',
    why: "Yıllar sırayla kapanır: kapanmamış bir yıl hâlâ fiş alabilirken sonrakini kapatmak kâr/zarar zincirinin (590/591) bir yıl atlanmasıdır ve geri alınamaz. Kapı yokken (tur 33 öncesi) kapatılmış olabilir; onarım yok — muhasebe kararıdır.",
    sql: `
      SELECT p."clinic_id", p."year" AS closed_year,
             o."year" AS still_open_year, o."status"::text AS still_open_status
        FROM "accounting_periods" p
        JOIN "accounting_periods" o
          ON o."clinic_id" = p."clinic_id" AND o."year" < p."year" AND o."status" <> 'CLOSED'
       WHERE p."status" = 'CLOSED'
       ORDER BY p."clinic_id", p."year"
       LIMIT 50`,
  },
  {
    key: 'mal-kabul-gunlugu-sayac',
    title: 'Mal kabul günlüğü toplamı kalemin kümülatif sayacına eşit değil',
    why: "Günlük (purchase_order_receipt_lines) ile sayaç (quantity_received) aynı yazmada ilerler; sapma, günlüğü atlayan bir yol demektir. Yıl sonu GRNI tahakkuku günlükten hesaplanır — sapma tahakkuku yanlış yapar ve geriye dönük düzeltilemez (kabulün tarihi yalnız günlükte durur).",
    sql: `
      SELECT i."id" AS item_id, i."order_id",
             i."quantity_received"::text AS counter,
             coalesce(sum(l."quantity"), 0)::text AS journal
        FROM "purchase_order_items" i
        LEFT JOIN "purchase_order_receipt_lines" l ON l."item_id" = i."id"
       GROUP BY i."id", i."order_id", i."quantity_received"
      HAVING i."quantity_received" <> coalesce(sum(l."quantity"), 0)
       LIMIT 50`,
  },
  {
    key: 'mal-kabul-gunlugu-satirsiz',
    title: 'Satırsız mal kabul kaydı',
    why: "Başlık var, hiçbir kalem satırı yok: kabul yapılmış görünür ama tutar taşımaz. Kabul kaydı aggregate tarafından kalem satırlarıyla birlikte üretilir; satırsız başlık bu yolun atlandığını gösterir.",
    sql: `
      SELECT r."id", r."order_id", r."received_at", r."source"::text AS source
        FROM "purchase_order_receipts" r
        LEFT JOIN "purchase_order_receipt_lines" l ON l."receipt_id" = r."id"
       GROUP BY r."id", r."order_id", r."received_at", r."source"
      HAVING count(l."id") = 0
       LIMIT 50`,
  },
  {
    key: 'alis-faturasi-hesap-kumesi-disi',
    title: 'Alış faturası karşı hesabı kabul kümesinin dışında',
    why: "Karşı hesap serbest metin iken '102' (banka), '329' (GRNI tahakkuku) gibi başka akışlara ait bir hesap faturanın borcu olabiliyordu: dengeli fiş, bankada olmayan para. Küme `PURCHASE_INVOICE_LINE_ACCOUNT_CODES` sabitinden okunur. Mevcut kayıt kapı yokken yazılmış olabilir — fiş zaten yazıldıysa onarım muhasebe kararıdır (storno + yeni fatura).",
    sql: `
      SELECT f."id", f."clinic_id", f."invoice_number", f."line_account_code",
             f."status"::text AS status
        FROM "purchase_invoices" f
       WHERE f."line_account_code" NOT IN (${loadPurchaseInvoiceAccountCodes()
         .map((code) => `'${code}'`)
         .join(', ')})
       ORDER BY f."created_at" DESC
       LIMIT 50`,
  },
  {
    key: 'sanal-pos-iade-sonucu-bilinmiyor',
    title: 'Sonucu doğrulanmamış sanal POS iade/iptal girişimi',
    why: "İade/iptal çağrısı zaman aşımına uğradığında para sağlayıcıda çıkmış olabilir; taksit COMPLETED kalır ve damga (reversal_requested_at) bayatlar. Damga doluyken kart itirazı açılamaz ve otomatik yeniden denenmez (kural 18). Sağlayıcı panelinde iade kaydını `paymentTransactionId`/`paymentId` ile arayın: iade gittiyse taksit elle REFUNDED yapılmalı ve PAYMENT_REFUNDED olayı yazılmalı, gitmediyse yeniden deneyin. Eşik `REVERSAL_RETRY_AFTER_MINUTES` (10 dk).",
    sql: `
      SELECT i."id" AS installment_id, i."payment_id", p."clinic_id",
             i."amount"::text AS amount, i."reversal_requested_at"
        FROM "payment_installments" i
        JOIN "payments" p ON p."id" = i."payment_id"
       WHERE i."status" = 'COMPLETED'
         AND i."reversal_requested_at" IS NOT NULL
         AND i."reversal_requested_at" < now() - interval '10 minutes'
       ORDER BY i."reversal_requested_at"
       LIMIT 50`,
  },
];

async function main() {
  process.env.DATABASE_URL = loadDatabaseUrl();
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  let violations = 0;
  // Çalıştırılamayan kontroller "temiz" sayılmaz: çalışmayan bir kontrol hiçbir
  // şeyi kanıtlamaz (CLAUDE.md finans kuralı 15 — kanıtlanmamış güvence güvence
  // değildir). Eski sürüm bunları sessizce atlayıp "tüm değişmezler sağlam"
  // yazıyordu; yeni tablo henüz migrate edilmemişken bile.
  const skipped = [];

  try {
    console.log('# Finansal değişmez taraması\n');

    for (const check of CHECKS) {
      let rows;
      try {
        rows = await prisma.$queryRawUnsafe(check.sql);
      } catch (error) {
        // Bir kontrolün patlaması (ör. henüz uygulanmamış migration) diğerlerini
        // susturmamalı: tarama kısmi de olsa bilgi verir.
        console.log(`## ${check.title}\n`);
        console.log(`⚠️  Kontrol çalıştırılamadı: ${error.message}\n`);
        skipped.push(check.key);
        continue;
      }

      if (rows.length === 0) {
        console.log(`## ${check.title}\n\n✅ aykırılık yok\n`);
        continue;
      }

      violations += rows.length;
      console.log(`## ${check.title}\n`);
      console.log(`**${rows.length} aykırı kayıt.** ${check.why}\n`);
      const columns = Object.keys(rows[0]);
      console.log(`| ${columns.join(' | ')} |`);
      console.log(`| ${columns.map(() => '---').join(' | ')} |`);
      for (const row of rows) {
        console.log(
          `| ${columns.map((c) => String(row[c] ?? '—')).join(' | ')} |`
        );
      }
      console.log('');
    }

    if (violations === 0 && skipped.length === 0) {
      console.log(
        '---\n\nTüm değişmezler sağlam. `NOT VALID` kısıtlar artık ' +
          '`VALIDATE CONSTRAINT` ile tam güvenceye alınabilir.'
      );
      return;
    }

    if (skipped.length > 0) {
      console.log(
        `---\n\n⚠️  **${skipped.length} kontrol çalıştırılamadı** (${skipped.join(', ')}). ` +
          'Sonuç EKSİK: çalışmayan kontrol hiçbir şeyi kanıtlamaz. Çoğunlukla ' +
          'ilgili migration henüz uygulanmamıştır — `pnpm migrate:dev` sonrası yeniden çalıştırın. ' +
          '`VALIDATE CONSTRAINT` için tüm kontrollerin temiz çıkması beklenmeli.\n'
      );
      // 1 = aykırılık, 2 = eksik tarama. Aykırılık varsa daha ağır olan o.
      process.exitCode = violations > 0 ? 1 : 2;
    }

    if (violations > 0) {
      console.log(`---\n\n**Toplam ${violations} aykırı kayıt.**`);
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Betik doğrudan çalıştırılınca tarar; `require` edilince yalnız kontrol listesini verir (testler
// ve doğrulama araçları SQL'i buradan okur — ikinci bir kopya yazılmaz).
if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { CHECKS };
