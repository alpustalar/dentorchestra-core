# Frontend Mühendislik Kuralları ve AI Ajan Kuralları

Bu kurallar yalnızca `apps/web` frontend projesi için geçerlidir.

## 1. Teknoloji Yığını ve Ekosistem

- **Framework:** Next.js 14+ (App Router, Server Components ve Client Components hibrit yapısı)
- **Dil:** TypeScript (Strict mode aktif)
- **Stil:** Tailwind CSS + shadcn/ui bileşenleri
- **Yerelleştirme (i18n):** `next-intl` (veya `useTranslation` hook'u). **Arayüzde asla hardcoded (statik) metin yer almayacak.**
- **Durum Yönetimi (State Management):** Zustand (global UI, aktif rol, aktif klinik/tenant durumu), TanStack Query (client-side veri çekme ve cache yönetimi)
- **Mimari Desen:** Feature-Sliced Design (FSD) + 3 katmanlı katmanlama modeli ve bileşen yerleşimi (colocation)

## 2. Dizin Yapısı ve 3 Katmanlı Mimari Modeli

Global dizinleri asla kirletmeyin. Aşağıdaki hiyerarşiye uyun:

1. **Route/Page Katmanı (`app/`):** `kebab-case` rota klasörleri kullanın. Sayfaya özel, paylaşılmayan UI bileşenleri `page.tsx` yanında gizli bir `_components/` klasöründe yer almalıdır.
2. **Feature (Özellik) Katmanı (`src/features/`):** Domain'e (iş mantığına) özel mantık, tipler, Zod şemaları, server action'lar ve aynı modül içindeki birden fazla sayfada paylaşılan bileşenleri barındırır.
3. **Global/Shared (Ortak) Katmanı (`src/components/`):** Domain bağımsız atomik UI bileşenlerini (`components/ui/`) ve Sidebar, Topbar, RoleSwitcher, CommandMenu gibi global yerleşim öğelerini (`components/layout/`) barındırır.

## 3. Katı İsimlendirme Kuralları (`kebab-case`)

- React bileşenleri, hook'lar, yardımcı araçlar (utilities) ve action'lar `kebab-case` dosya adlandırması kullanmalıdır.
- Next.js App Router dosyaları standart adlandırmalara uymalıdır (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`).

## 3a. Feature Klasörü İç Organizasyonu — KURAL

Bir feature bileşeni (`features/{module}/components/{name}.tsx`) form şeması, parsing/hesap mantığı,
localStorage gibi birden fazla sorumluluğu tek dosyada topladığında (Single Responsibility ihlali) şu
katmanlara bölünür — hiçbiri `components/` içinde kalmaz:

```
features/{module}/{feature}/
  components/
    {feature}-workspace.tsx      # Orkestratör — sadece akış/adım/wiring, iş mantığı yok
    {feature}-foo-card.tsx       # Flat: aynı özelliğin tüm alt bileşenleri components/ içinde düz durur
    index.ts                     # Barrel — SADECE orkestratörü dışa açar
    wizard-steps/                # Yalnız adım/alt-görünüm gibi anlamlı bir alt kümeyse ayrı klasör açılabilir
      step-0-meta.tsx
  schemas/
    {feature}.schema.ts          # Zod şema + ondan infer edilen tipler + varsayılan değerler
  utils/
    {feature}-parser.util.ts     # Parsing / hesaplama / normalizasyon fonksiyonları
    {feature}-storage.util.ts    # localStorage gibi yan etkili yardımcılar
  hooks/
    use-{feature}.ts             # Form + state + türetilmiş veri + handler'lar burada toplanır
```

**`components/` altında asla tekrar `_components/` (ya da başka bir genel "diğerleri" klasörü)
açılmaz** — bu anti-pattern'dir. Aynı özelliğin alt bileşenleri `components/` içinde düz (flat)
durur; `components/index.ts` barrel'ı **yalnızca o feature'ın orkestratör bileşenini** dışa açar
(`export { FooWorkspace } from './foo-workspace';`). Sayfa (`page.tsx`) veya başka bir üst katman
sadece bu barrel'dan orkestratörü import eder; feature'ın alt bileşenlerini dışarıdan hiçbir dosya
doğrudan import etmez — onları yalnızca feature'ın kendi orkestratörü/ebeveyn bileşeni kullanır.

Birden fazla sayfa/özellikte genel amaçlı kullanılma ihtimali olan yardımcı fonksiyonlar (ör. para
yuvarlama, tarih biçimleme) feature'a özel `utils/` içinde değil, `features/{module}/shared/utils/`
içinde ya da gerçekten modül-bağımsızsa global `lib/` içinde tutulur.

Referans örnek: `features/finance/bank/` (bank-statement-import-wizard bölünmesi — `schemas/
bank-statement-import.schema.ts`, `utils/bank-statement-parser.util.ts`, `utils/
bank-statement-mapping-storage.util.ts`, `hooks/use-bank-statement-import.ts`, `components/
wizard-steps/`).

## 4. Backend Yanıt Kontratı ve Tip Tanımlamaları

NestJS backend'i, liste ve tekil yanıtları `MixinTransformInterceptor` aracılığıyla sarar; bu yapı `packages/shared/common/response/response.interface.ts` ile uyumludur:

```typescript
export interface SerializationOptions {
  isGroupActive: boolean;
  groups: string[];
}

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type Meta = {
  serializationOptions?: SerializationOptions;
  pagination?: PaginationMeta;
  [key: string]: any;
};

export interface QueryResponse<T> {
  data: T;
  meta?: Meta;
  serialization?: { groups: string[] };
}

Backend tarafında @Expose({ groups: [...] }) ile korunan alanlar atlanabilir. Maskelenmiş alanlar için null / undefined durumları güvenli bir şekilde ele alınmalıdır.

Hassas kontrolleri, aksiyonları veya kolonları render etmeden önce response.serialization?.groups üzerinden aktif grupları okuyun.

UI rol simülasyonu ve klinik değiştirici (switcher) bağlamları için global Zustand store'unu kullanın.

Her etiket (label), buton metni, tablo sütun başlığı, bildirim (toast) mesajı ve yer tutucu (placeholder) bir i18n hook'u kullanmalıdır. Arayüz metinlerini asla doğrudan (hardcoded) yazmayın.

Çeviri anahtarlarını yerel (locale) JSON dosyalarında modüler tutun.

İlk sayfa yüklemeleri, SEO açısından kritik veriler veya Server Component'ler için uygun cache/revalidation direktifleriyle birlikte yerel fetch kullanın.

İnteraktif, gerçek zamanlı veya cache'lenen client-side sorgular için TanStack Query ile Axios kullanın.

features/[module]/api/ altında .action.ts uzantısıyla Next.js Server Actions ('use server') kullanın ve payload'ları Zod ile doğrulayın.

Uygun senaryolarda, kritik klinik iş akışları için service-worker önbellekleme (caching) ve çevrimdışı mutasyon senkronizasyonunu destekleyin.

Tablet ve mobil form faktörleri için tasarım yapın. Sadece fareyle üzerine gelme (hover-only) etkileşimlerinden kaçının ve uygun dokunma alanları (touch targets) sağlayın.

5. Sürekli Güncellemeler
Bu dosya, frontend mühendislik kurallarının canlı kaynağıdır. Proje geliştikçe gelecekteki frontend standartlarını ve kararlarını buraya ekleyin.

6. PWA ve Çevrimdışı (Offline-First) Stratejileri
Service Worker: Statik varlıklar ve dinamik rotalar next-pwa veya Workbox tabanlı bir yapı ile önbelleğe alınmalıdır.

Çevrimdışı Mutasyonlar (Offline Mutations): Kritik klinik operasyonlarında ağ kesintilerine karşı form verileri geçici olarak IndexedDB üzerinde tutulmalı ve ağ bağlantısı geri geldiğinde otomatik olarak senkronize edilmelidir (background-sync).

Responsive ve Dokunma Alanları (Touch Targets): Saha ve klinik kullanımındaki tablet ile el terminalleri göz önüne alınarak interaktif elemanlar (butonlar, girdi alanları) en az 44x44px dokunma alanına sahip olmalıdır.

7. Global Hata ve Bildirim (Toast) Yönetimi
API Hataları: Tüm hata yönetimleri merkezi orvalMutator üzerinden yürütülmeli; kullanıcıya gösterilecek hata mesajları asla doğrudan yazılmamalı, next-intl sözlüklerinden çekilmelidir.

Form Validasyonları: Zod şemaları hem frontend tarafında (react-hook-form aracılığıyla) hem de backend kontratı ile birebir senkronize tutulmalıdır.

8. API Endpoint İhtiyaçlarının Yönetimi
---------------------------------------

Frontend geliştirmesi sırasında ihtiyaç duyulan ancak API tarafında henüz HTTP
endpoint'i bulunmayan ihtiyaçlar `docs/frontend-api-endpoint-gaps.md` dosyasına
ayrıntılı olarak yazılmalıdır. Kayıtta ekran, kullanıcı aksiyonu, önerilen
method/path, yetki, request/response şekli, beklenen UI davranışı ve kabul
kriterleri bulunmalıdır.

- Önce API tarafında aynı ihtiyacı karşılayan mevcut query veya command handler
  (use case) aranmalıdır.
- Use case zaten mevcutsa ve yalnızca HTTP controller'dan dışarı açılmamışsa,
  uygun guard, capability, DTO ve serialization kurallarıyla controller'a
  eklenebilir.
- Gerekli use case mevcut değilse frontend çalışması içinde backend'e yeni
  handler, repository veya persistence davranışı eklenmemelidir. İhtiyaç,
  ayrıntılarıyla endpoint gap dosyasına yazılmalı ve backend iş listesi olarak
  bırakılmalıdır.
- Endpoint kullanıma açıldıktan sonra gap kaydı güncellenmeli ve OpenAPI
  üretimi sonrası frontend'de Orval ile oluşturulan hook tercih edilmelidir.

9. Tarih ve Zaman Yönetimi
--------------------------

- Frontend'deki tarih oluşturma, "şimdi"yi alma, tarih ekleme/çıkarma, fark
  hesaplama ve takvim işlemleri `@shared/common` içindeki `DateTimeManager`
  üzerinden yapılmalıdır.
- İş mantığında `new Date()`, `Date.now()`, `setDate`, `setMonth` gibi ham
  JavaScript tarih işlemleri kullanılmamalıdır. `Intl.DateTimeFormat` yalnızca
  `DateTimeManager` tarafından üretilen tarihlerin kullanıcıya gösterilecek
  biçimini oluşturmak için kullanılabilir.
- Ekranlarda ve mock/demo verilerinde güncel zamanı temsil eden sabit yıl veya
  tarih yazılmamalıdır. Bu değerler `DateTimeManager.create()`, `currentYear()`,
  `addDays()`, `subtractDays()` ve benzeri yardımcılarla çalışma anına göre
  türetilmelidir. Doğum tarihi gibi gerçekten sabit tarihsel veriler bu kuralın
  dışındadır.
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
