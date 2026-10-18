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
];

async function main() {
  process.env.DATABASE_URL = loadDatabaseUrl();
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  let violations = 0;

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

    if (violations === 0) {
      console.log(
        '---\n\nTüm değişmezler sağlam. `NOT VALID` kısıtlar artık ' +
          '`VALIDATE CONSTRAINT` ile tam güvenceye alınabilir.'
      );
      return;
    }

    console.log(`---\n\n**Toplam ${violations} aykırı kayıt.**`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
