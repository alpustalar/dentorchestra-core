import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Bu üç kural bir tercih değil, bundle güvenliği. Kök barrel `dto/`
      // üzerinden nestjs-zod çekiyor (164 dosya); generated-zod ise 1.3 MB
      // runtime şema. İkisi de tarayıcıya girmemeli — kural olmazsa tek bir
      // dalgın import ile sessizce girer.
      "no-restricted-imports": [
        "error",
        {
          // Kök barrel `paths` ile yasaklanır, `patterns` ile DEĞİL: `patterns`
          // gitignore semantiği kullanıyor ve "@dentorchestra/shared" bir dizin gibi
          // davranıp izin verilen "@dentorchestra/shared/client" alt yolunu da
          // yakalıyor. `paths` tam ad eşleşmesi yapar.
          paths: [
            {
              name: "@dentorchestra/shared",
              message:
                "@dentorchestra/shared/client kullan — kök barrel dto/ üzerinden nestjs-zod çeker.",
            },
            {
              name: "@dentorchestra/shared/index",
              message: "@dentorchestra/shared/client kullan.",
            },
          ],
          patterns: [
            {
              group: ["@dentorchestra/shared/modules/*/dto", "**/dto/**"],
              message: "DTO'lar backend-only (nestjs-zod).",
            },
            {
              group: ["@dentorchestra/shared/generated-zod*", "**/generated-zod/**"],
              message:
                "generated-zod'dan yalnız `import type` ile al (runtime şema 1.3 MB).",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
