/* eslint-disable */
const { PrismaClient } = require('@prisma/client');

module.exports = async () => {
  const info = globalThis.__E2E_DB__;
  if (!info) return;
  if (process.env.E2E_KEEP_DB === '1') {
    console.log(`[db-e2e] E2E_KEEP_DB=1, DB bırakıldı: ${info.dbName}`);
    return;
  }
  const admin = new PrismaClient({ datasourceUrl: info.adminUrl });
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${info.dbName}" WITH (FORCE)`);
  await admin.$disconnect();
  console.log(`[db-e2e] izole DB silindi: ${info.dbName}`);
};
