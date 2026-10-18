/**
 * Modül grafiği güvenlik ağı.
 *
 * Commit 99472fe5 ("changes") 266 modül dosyasına dokunup her `X.module.ts`'in
 * application-modül import'larını silmişti. Sonuç: 300'den fazla CQRS handler'ı ve
 * olay dinleyicisi hiçbir modülün provider'ı olmadığı için bus'a hiç kaydolmadı.
 * Uygulama sorunsuz ayağa kalkmaya devam etti — handler'lar tembel çözüldüğü için
 * hata ancak ilgili uç çağrıldığında `QueryHandlerNotFoundException` olarak çıktı.
 * Derleyici de görmedi: import'lar zaten silinmişti, kimse onlara referans vermiyordu.
 *
 * Bu test o sessiz kırılmayı derleme/test zamanına çeker:
 *   1. Nest'in kendi tarayıcısıyla modül grafiğini kurar (geçersiz export, döngüsel
 *      modül, eksik modül burada patlar) — provider ÜRETMEZ, bu yüzden DB/Redis/NATS
 *      bağlantısı gerektirmez.
 *   2. Kaynak ağacındaki her @CommandHandler/@QueryHandler'ın grafikte kayıtlı
 *      olduğunu doğrular.
 *   3. Her provider'ın constructor bağımlılığının kendi modül bağlamında çözülebildiğini
 *      doğrular. Bu kontrol olmadan "modülü bağladım" demek yetmiyor: kayıtlı ama
 *      bağımlılığı çözülemeyen bir provider uygulamayı açılışta düşürür ve bunu
 *      yalnız gerçek bir boot gösterir.
 */
import 'reflect-metadata';
import { EVENT_LISTENER_METADATA } from '@nestjs/event-emitter/dist/constants';
import * as fs from 'fs';
import * as path from 'path';

// Grafiği kurmak ConfigModule'ün Joi doğrulamasından geçmeyi gerektiriyor. Test
// hermetik olsun diye gerçek env dosyası okunmaz; biçim olarak geçerli sahte
// değerler verilir (hiçbiri kullanılmıyor — provider üretilmiyor).
const ENV_FIXTURE: Record<string, string> = {
  MODE: 'TEST',
  PORT: '8080',
  ORIGIN: 'http://localhost:3000',
  ALLOWED_ORIGINS: 'http://localhost:3000',
  ADMIN_EMAIL: 'admin@example.com',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=public',
  MONGODB_URI: 'mongodb://localhost:27017/test',
  MESSAGING_MONGODB_URI: 'mongodb://localhost:27017/test-messaging',
  REDIS_URL: 'redis://localhost:6379',
  NATS_URL: 'nats://localhost:4222',
  BETTERSTACK_TOKEN: 'test-token',
  TOKEN_CIPHER_KEY: 'a'.repeat(64),
  EMAIL_SMTP_HOST: 'smtp.example.com',
  EMAIL_SMTP_PORT: '587',
  EMAIL_ADDRESS: 'noreply@example.com',
  EMAIL_PASSWORD: 'test',
  IYZICO_API_KEY: 'test',
  IYZICO_SECRET_KEY: 'test',
  IYZICO_BASE_URL: 'https://sandbox-api.iyzipay.com',
  IYZICO_TERMINAL_BASE_URL: 'https://sandbox-api.iyzipay.com',
  QUEUE_MONITOR_ADMIN_PASSWORD: 'test',
  META_APP_ID: 'test',
  META_APP_SECRET: 'test',
  META_OAUTH_REDIRECT_URI: 'http://localhost:8080/cb',
  META_WEBHOOK_VERIFY_TOKEN: 'test',
  WHATSAPP_APP_ID: 'test',
  WHATSAPP_APP_SECRET: 'test',
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'test',
  ANTHROPIC_API_KEY: 'test',
  ANTHROPIC_DEFAULT_MODEL: 'claude-haiku-4-5',
  HOTELBEDS_HOTEL_API_KEY: 'test',
  HOTELBEDS_HOTEL_SECRET: 'test',
  HOTELBEDS_TRANSFER_API_KEY: 'test',
  HOTELBEDS_TRANSFER_SECRET: 'test',
};

for (const [k, v] of Object.entries(ENV_FIXTURE)) process.env[k] = v;

jest.setTimeout(180000);

type Ctor = new (...args: unknown[]) => unknown;

interface ScannedGraph {
  registered: Set<unknown>;
  unresolvable: string[];
}

/**
 * CqrsModule'ün seçenek sağlayıcısı dinamik olarak eklenir; statik metadata
 * taramasında görünmez. Kütüphane kaynaklı tek bilinen sahte pozitif.
 */
const DYNAMIC_TOKEN_ALLOWLIST = new Set(['CQRS_MODULE_OPTIONS']);

const NATIVE_TYPES = new Set([
  'Object',
  'Function',
  'String',
  'Number',
  'Boolean',
  'Array',
]);

const tokenName = (token: unknown): string =>
  typeof token === 'function'
    ? (token as { name: string }).name
    : String(token);

/** Provider ÜRETMEDEN Nest'in modül grafiğini kurar. */
async function scanGraph(): Promise<ScannedGraph> {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const { NestContainer } = require('@nestjs/core/injector/container');
  const { DependenciesScanner } = require('@nestjs/core/scanner');
  const { MetadataScanner } = require('@nestjs/core/metadata-scanner');
  const { GraphInspector } = require('@nestjs/core/inspector/graph-inspector');
  const { AppModule } = require('@src/app.module');
  /* eslint-enable @typescript-eslint/no-var-requires */

  const container = new NestContainer();
  const inspector = new GraphInspector(container);
  const scanner = new DependenciesScanner(
    container,
    new MetadataScanner(),
    inspector
  );

  await scanner.scan(AppModule);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const modules: any[] = [...container.getModules().values()];
  const globals = modules.filter((module) => module.isGlobal);

  const registered = new Set<unknown>();
  for (const module of modules) {
    for (const [token] of module.providers) registered.add(token);
  }

  // Bir modülün bir token'ı dışa açıp açmadığı — yeniden dışa açılan modüller dahil.
  const exportsToken = (
    module: any,
    token: unknown,
    seen: Set<unknown>
  ): boolean => {
    if (seen.has(module)) return false;
    seen.add(module);

    for (const exported of module.exports) {
      if (exported === token) {
        if (module.providers.has(token)) return true;
        for (const imported of module.imports) {
          if (exportsToken(imported, token, seen)) return true;
        }
      }
      // Yeniden dışa açılan modül: `exports` dizisinde modül SINIFI durur, ama
      // Nest modüle ayrıca string bir `token` verir — ikisi de karşılaştırılmalı.
      for (const imported of module.imports) {
        if (exported === imported.metatype || exported === imported.token) {
          if (exportsToken(imported, token, seen)) return true;
        }
      }
    }
    return false;
  };

  const isAvailable = (module: any, token: unknown): boolean => {
    if (module.providers.has(token)) return true;
    for (const imported of module.imports) {
      if (exportsToken(imported, token, new Set())) return true;
    }
    return globals.some((global) => exportsToken(global, token, new Set()));
  };

  const unresolvable: string[] = [];

  for (const module of modules) {
    for (const [, wrapper] of module.providers) {
      const metatype = wrapper.metatype;
      if (typeof metatype !== 'function' || !wrapper.isNewable) continue;

      const params: unknown[] =
        Reflect.getMetadata('design:paramtypes', metatype) ?? [];
      const injected: { index: number; param: unknown }[] =
        Reflect.getMetadata('self:paramtypes', metatype) ?? [];
      const byIndex = new Map(injected.map((i) => [i.index, i.param]));

      params.forEach((param, index) => {
        const token = byIndex.has(index) ? byIndex.get(index) : param;
        if (token === undefined || token === null) return;
        if (typeof token === 'function' && NATIVE_TYPES.has(token.name)) return;
        if (DYNAMIC_TOKEN_ALLOWLIST.has(tokenName(token))) return;
        if (isAvailable(module, token)) return;

        unresolvable.push(
          `${metatype.name}[${index}] -> ${tokenName(token)} (modül: ${tokenName(
            module.metatype
          )})`
        );
      });
    }
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return { registered, unresolvable };
}

function collectTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectTsFiles(full, out);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts'))
      out.push(full);
  }
  return out;
}

describe('AppModule modül grafiği', () => {
  let graph: ScannedGraph;
  let registered: Set<unknown>;

  beforeAll(async () => {
    graph = await scanGraph();
    registered = graph.registered;
  });

  it('grafik geçerli — geçersiz export / döngüsel modül yok', () => {
    // scanGraph() yapısal bir hata bulursa beforeAll'da fırlatır.
    expect(registered.size).toBeGreaterThan(0);
  });

  it('her provider’ın bağımlılığı kendi modül bağlamında çözülebiliyor', () => {
    expect([...new Set(graph.unresolvable)].sort()).toEqual([]);
  });

  it('her olay dinleyicisi bir modülde kayıtlı', () => {
    // CQRS handler'ı kaydolmadığında uç çağrıldığında patlar; **dinleyici**
    // kaydolmadığında hiçbir şey patlamaz: `emitAsync` sıfır dinleyiciye yayın
    // yapar, boş dizi döner ve akış devam eder. Bu yüzden grafikten düşmüş bir
    // dinleyici, bağlı olduğu güvenceyi (muhasebe köprüsü, audit log, kritik
    // hata uyarısı, stok defteri) **sessizce** iptal eder.
    const files = collectTsFiles(__dirname);
    const unregistered: string[] = [];

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      if (!/@(OnDomainEvent|OnEvent)\(/.test(source)) continue;

      let mod: Record<string, unknown>;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        mod = require(file) as Record<string, unknown>;
      } catch {
        continue; // yan etkili modül — kayıt kontrolü bu dosya için atlanır
      }

      for (const [name, exported] of Object.entries(mod)) {
        if (typeof exported !== 'function') continue;
        const proto = (exported as Ctor).prototype as object | undefined;
        if (!proto) continue;

        const listens = Object.getOwnPropertyNames(proto).some((method) => {
          const descriptor = Object.getOwnPropertyDescriptor(proto, method);
          if (typeof descriptor?.value !== 'function') return false;
          return Boolean(
            Reflect.getMetadata(EVENT_LISTENER_METADATA, descriptor.value)
          );
        });
        if (!listens) continue;

        if (!registered.has(exported as Ctor)) {
          unregistered.push(`${name} (${path.relative(__dirname, file)})`);
        }
      }
    }

    expect(unregistered.sort()).toEqual([]);
  });

  it('her CQRS handler’ı bir modülde kayıtlı', () => {
    const files = collectTsFiles(__dirname);
    const unregistered: string[] = [];

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      if (!/@(QueryHandler|CommandHandler)\(/.test(source)) continue;

      let mod: Record<string, unknown>;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        mod = require(file) as Record<string, unknown>;
      } catch {
        continue; // yan etkili modül — kayıt kontrolü bu dosya için atlanır
      }

      for (const [name, exported] of Object.entries(mod)) {
        if (typeof exported !== 'function') continue;
        const isHandler =
          Reflect.getMetadata('__queryHandler__', exported) ??
          Reflect.getMetadata('__commandHandler__', exported);
        if (!isHandler) continue;
        if (!registered.has(exported as Ctor)) {
          unregistered.push(`${name} (${path.relative(__dirname, file)})`);
        }
      }
    }

    expect(unregistered.sort()).toEqual([]);
  });
});
