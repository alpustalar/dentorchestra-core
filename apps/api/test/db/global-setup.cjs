/* eslint-disable */
// Gerçek-DB turu (CLAUDE.md finans kuralı 21): izole, tek kullanımlık veritabanı kurar,
// tüm migration'ları uygular. Dev DB'ye ASLA dokunmaz — yalnız aynı sunucuda yeni bir
// veritabanı açar/siler.
const { execSync } = require('node:child_process');
const path = require('node:path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

module.exports = async () => {
  const root = path.resolve(__dirname, '../..');
  // Yalnız SUNUCU bilgisi (host/kimlik) için okunur; veritabanı adı her zaman yenidir.
  // E2E_ADMIN_DATABASE_URL verilirse o kullanılır.
  dotenv.config({ path: path.join(root, 'envs/.env.development') });

  const base = process.env.E2E_ADMIN_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL yok (envs/.env.development).');

  const dbName = `core_crm_e2e_${Date.now()}_${process.pid}`;
  const toUrl = (db) => base.replace(/\/[^/?]+(\?|$)/, `/${db}$1`);

  const admin = new PrismaClient({ datasourceUrl: toUrl('postgres') });
  await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  await admin.$disconnect();

  const url = toUrl(dbName);
  execSync('npx prisma migrate deploy', {
    cwd: root,
    env: { ...process.env, DATABASE_URL: url, NODE_ENV: 'development' },
    stdio: 'pipe',
  });

  process.env.E2E_DATABASE_URL = url;
  process.env.E2E_DATABASE_NAME = dbName;
  globalThis.__E2E_DB__ = { dbName, adminUrl: toUrl('postgres') };
  console.log(`\n[db-e2e] izole DB hazır: ${dbName}`);
};
