#!/usr/bin/env node
/**
 * Outbox'ın **teslim edilemeyen** kayıtlarını listeler (salt okuma).
 *
 * Neden script: ölü mektuba düşen kayıt için CRITICAL uyarı çıkar, ama uyarı
 * tek satırdır ve geçmişi taşımaz. "Hangi kritik işler yapılmadan kaldı"
 * sorusunun bir **sorgusu** olmak zorunda (CLAUDE.md finans kuralı 4: yutulan
 * hata için ya retry ya backfill + eksik kalanlar sorgusu). Bu dosya o sorgudur.
 *
 * Kullanım: `pnpm outbox:dead-letters` (ya da `node scripts/outbox-dead-letters.cjs`)
 *
 * Kayıt **silinmez ve otomatik onarılmaz**: yeniden deneme bir operasyon
 * kararıdır (sebebi giderilmeden tekrar denemek aynı hatayı üretir). Hazır
 * olduğunda, aşağıdaki SQL kaydı tekrar sahiplenilebilir hâle getirir:
 *
 *   UPDATE "Outbox"
 *      SET "failedAt" = NULL, "claimedAt" = NULL, "attempts" = 0
 *    WHERE id = '<outbox-id>';
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

async function main() {
  process.env.DATABASE_URL = loadDatabaseUrl();
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const [summary] = await prisma.$queryRawUnsafe(`
      SELECT
        count(*) FILTER (WHERE "processedAt" IS NULL AND "failedAt" IS NULL)::int AS pending,
        count(*) FILTER (WHERE "processedAt" IS NULL AND "failedAt" IS NOT NULL)::int AS dead,
        count(*) FILTER (WHERE "processedAt" IS NOT NULL)::int AS processed,
        min("createdAt") FILTER (WHERE "processedAt" IS NULL AND "failedAt" IS NULL) AS oldest_pending
      FROM "Outbox"
    `);

    console.log('# Outbox teslim durumu\n');
    console.log(`- Bekleyen (denenmeye devam): **${summary.pending}**`);
    console.log(`- Ölü mektup (artık denenmiyor): **${summary.dead}**`);
    console.log(`- Teslim edilmiş: ${summary.processed}`);
    console.log(
      `- En yaşlı bekleyen kayıt: ${
        summary.oldest_pending ? summary.oldest_pending.toISOString() : '—'
      }\n`
    );

    const dead = await prisma.$queryRawUnsafe(`
      SELECT "id", "type", "attempts", "createdAt", "failedAt", "lastError"
        FROM "Outbox"
       WHERE "processedAt" IS NULL AND "failedAt" IS NOT NULL
       ORDER BY "seq" ASC
       LIMIT 200
    `);

    if (dead.length === 0) {
      console.log('Ölü mektup yok.');
      return;
    }

    console.log('## Ölü mektuplar\n');
    console.log('| id | event | deneme | oluştu | bırakıldı | son hata |');
    console.log('| --- | --- | --- | --- | --- | --- |');
    for (const row of dead) {
      const error = (row.lastError || '').replace(/\s+/g, ' ').slice(0, 120);
      console.log(
        `| \`${row.id}\` | ${row.type} | ${row.attempts} | ` +
          `${row.createdAt.toISOString().slice(0, 16)} | ` +
          `${row.failedAt.toISOString().slice(0, 16)} | ${error} |`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
