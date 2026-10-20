const fs = require('fs');
const path = require('path');

// Script'in konumu: apps/api/scripts/generate-capabilities.js
// 1 üst klasör (api), 2 üst klasör (apps), 3 üst klasör (monorepo root)
// Ancak en garanti yol path.join(__dirname, '../..') doğrudan 'apps/api' klasörüdür.

const apiDir = path.resolve(__dirname, '..');
const schemaDir = path.join(
  apiDir,
  'src/infrastructure/persistence/prisma/schema'
);

// Monorepo kökünü bulmak için apiDir'den bir üst klasöre (apps), oradan da root'a çıkıyoruz
const monorepoRoot = path.resolve(apiDir, '../..');
const outputFile = path.join(
  monorepoRoot,
  'packages/shared/datasets/generated-capabilities.ts'
);

function getModelsFromPrismaSchemas() {
  if (!fs.existsSync(schemaDir)) {
    console.error(`[Error] Schema directory not found: ${schemaDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(schemaDir);
  const models = new Set();

  for (const file of files) {
    if (file.endsWith('.prisma')) {
      const content = fs.readFileSync(path.join(schemaDir, file), 'utf8');
      const matches = content.matchAll(/model\s+(\w+)\s*\{/g);
      for (const match of matches) {
        models.add(match[1]);
      }
    }
  }

  return Array.from(models).sort();
}

const models = getModelsFromPrismaSchemas();
console.log(
  `[Capabilities Generator] Bulunan Prisma model sayısı: ${models.length}`
);

const fileContent = `// ----------------------------------------------------------------------------
// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// Prisma şemalarından otomatik olarak üretilmiştir.
// ----------------------------------------------------------------------------

export const STATIC_PRISMA_MODELS = ${JSON.stringify(models, null, 2)} as const;
`;

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, fileContent, 'utf8');

console.log(`[Capabilities Generator] Başarıyla yazıldı: ${outputFile}`);
