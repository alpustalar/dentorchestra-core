import * as fs from 'fs';
import * as path from 'path';

export const prismaTools = [
  {
    name: 'inspect_prisma_schema',
    description:
      'Modüler Prisma şema klasörünü tarar; tüm şemayı veya istenen spesifik modeli getirir.',
    inputSchema: {
      type: 'object',
      properties: {
        modelName: {
          type: 'string',
          description:
            'Sorgulanacak spesifik Prisma modeli (Örn: Appointment, Patient - boş bırakılırsa tüm modelleri birleştirip gösterir)',
        },
      },
    },
    handler: async (args: any) => {
      const possibleSchemaDirs = [
        path.resolve(
          process.cwd(),
          './apps/api/src/infrastructure/persistence/prisma/schema'
        ),
        path.resolve(
          process.cwd(),
          '../apps/api/src/infrastructure/persistence/prisma/schema'
        ),
        path.resolve(
          process.cwd(),
          '../../apps/api/src/infrastructure/persistence/prisma/schema'
        ),
        path.resolve(process.cwd(), './schema'),
      ];

      let schemaDir = '';
      for (const dir of possibleSchemaDirs) {
        if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
          schemaDir = dir;
          break;
        }
      }

      if (!schemaDir) {
        throw new Error(
          `Prisma schema klasörü bulunamadı. Aranan yollar: ${possibleSchemaDirs.join(', ')}`
        );
      }

      const files = fs
        .readdirSync(schemaDir)
        .filter((f) => f.endsWith('.prisma'));

      let combinedContent = '';
      const modelName = args?.modelName ? String(args.modelName).trim() : null;

      for (const file of files) {
        const filePath = path.join(schemaDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        if (modelName) {
          const modelRegex = new RegExp(
            `model\\s+${modelName}\\s+{[^}]*}`,
            's'
          );
          const match = content.match(modelRegex);
          if (match) {
            return `--- Kaynak Dosya: ${file} ---\n\n${match[0]}`;
          }
        } else {
          combinedContent += `\n// --- File: ${file} ---\n${content}\n`;
        }
      }

      if (modelName) {
        return `⚠️ '${modelName}' modeli modüler şemalar içinde (${schemaDir}) bulunamadı.`;
      }

      return combinedContent;
    },
  },
];
