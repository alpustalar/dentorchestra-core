import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Standalone output creates a self-contained bundle for Docker deployments.
  // Does not affect `next dev` — only applies after `next build`.
  output: 'standalone',

  // Let Next.js trace files from the monorepo root so shared packages are included.
  outputFileTracingRoot: path.join(__dirname, '../../'),

  // `@dentorchestra/shared` ham TypeScript yayınlıyor (`"main": "index.ts"`).
  // Next.js node_modules içindeki ham .ts'i varsayılan olarak derlemez; bu
  // olmadan paketten yapılan ilk import derleme hatasıyla düşer.
  transpilePackages: ['@dentorchestra/shared'],
};

export default withNextIntl(nextConfig);
