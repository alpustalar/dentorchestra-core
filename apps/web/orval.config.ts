import { defineConfig } from 'orval';

/**
 * Sözleşme kaynağı çalışan API'nin OpenAPI çıktısıdır (yalnız geliştirmede açık).
 * Önce `cd apps/api && pnpm start:dev`, sonra `pnpm gen:api`.
 */
export default defineConfig({
  api: {
    input: {
      target: process.env.OPENAPI_URL ?? 'http://localhost:8080/api-json',
    },
    output: {
      mode: 'tags-split',
      target: 'src/api/generated',
      schemas: 'src/api/generated/model',
      client: 'react-query',
      // Mutator `{ url, method, params, data }` alır (axios biçimi) — `fetch`
      // biçimi sorguyu URL'e ve gövdeyi string'e gömüp `executeRaw`ı atlatırdı.
      httpClient: 'axios',
      clean: true,
      override: {
        operationName: (operation, route, verb) => {
          const operationId =
            operation.operationId ?? `${verb}_${route.replace(/\W+/g, '_')}`;
          const pascalName = operationId
            .replace(/(?:Command|Query)Controller|Controller/g, '')
            .replace(/(?:_api\/v\d+|ApiV\d+)$/i, '')
            .split(/[^a-zA-Z0-9]+/)
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join('');
          const methodName =
            pascalName.charAt(0).toLowerCase() + pascalName.slice(1);

          // Keep the resource prefix in type names to avoid collisions, while
          // removing transport/controller noise from methods and React Query hooks.
          return [methodName, pascalName];
        },
        mutator: {
          path: 'src/lib/api/orval-mutator.ts',
          name: 'orvalMutator',
        },
      },
      mock: {
        indexMockFiles: true,
        generators: [{ type: 'msw' }],
      },
    },
  },
});
