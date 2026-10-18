# Frontend Mimarisi — apps/web

Bu doküman `apps/web` için hedef mimariyi tanımlar. Backend (`apps/api`) mevcut hâliyle
**değişmez**; frontend onun sözleşmesine uyar.

---

## 0. Mevcut Durum (tespit)

| Alan            | Durum                                                                 |
| --------------- | --------------------------------------------------------------------- |
| `apps/web`      | Boş iskelet — `layout.tsx`, `page.tsx`, `globals.css`, favicon (4 dosya) |
| Next.js         | 16.1.6 (App Router), React 19.2.3                                     |
| Styling         | Tailwind v4 (`@tailwindcss/postcss`) kurulu, kullanılmamış             |
| `@core-crm/shared` | `workspace:*` bağımlılık olarak ekli, hiç import edilmemiş           |
| Veri katmanı    | Yok                                                                    |
| Auth            | Yok                                                                    |

Temiz sayfa. Doğru kurmak için ideal an.

---

## 1. Karar: tRPC **kullanmıyoruz**

Soru "tRPC mi?" idi. Cevap: **hayır** — bu projede net biçimde yanlış araç.

**Gerekçe:**

1. **tRPC sunucunun tRPC router'ı olmasını ister.** Bizim sunucumuz NestJS: CQRS bus,
   `AuthGuard`, `CapabilityGuard`, `ModuleEntitlementGuard`, policy tabanlı serileştirme,
   URI versiyonlama (`/api/v1`), `AllExceptionsFilter`, `TransformInterceptor`. tRPC'yi
   sokmak için ya (a) NestJS'in önüne ikinci bir tRPC katmanı koyup her endpoint'i **iki kez**
   yazacağız ve guard'ları duplike edeceğiz, ya da (b) controller'ları tRPC procedure'lerine
   çevirip bu altyapının tamamını çöpe atacağız. İkisi de kayıp.

2. **tRPC'nin çözdüğü problemi zaten çözmüşüz.** tRPC'nin asıl değeri "şema el sıkışması
   olmadan uçtan uca tip çıkarımı". Bizde `packages/shared` zaten Single Source of Truth —
   Zod şeması yazılıyor, tip `z.infer` ile türetiliyor, iki uç da aynı tipi import ediyor.
   Tipler **zaten akıyor**. tRPC bunu tekrar çözmek için transport'u değiştirmemizi ister.

3. `nestjs-trpc` gibi köprüler olgun değil ve CQRS bus pattern'iyle sürtüşür.

**Bunun yerine:** REST kalıyor + `shared`'daki Zod sözleşmelerinden beslenen **tipli fetch
client** + **TanStack Query**. Bu, tRPC DX'inin (otomatik tamamlama, çıkarımlı input/output,
runtime doğrulama) pratikte tamamını verir, backend'de tek satır değişiklik gerektirmez.

> İleride sözleşmeyi daha resmî istersek **ts-rest** doğal yükseltme yoludur: contract-first
> REST + Zod, NestJS adaptörü controller'ları koruyarak çalışır. Ama Faz 1 için gereksiz.

---

## 2. ⚠️ Kritik Bulgular — frontend'e başlamadan önce düzeltilmeli

Bunlar tercih değil, **bloker**. Üçü de `shared` paketinde.

### 2.1 `@core-crm/shared` barrel'ı tarayıcıyı zehirliyor

```
packages/shared/index.ts
  └── export * from './modules'
        └── modules/lead/index.ts
              └── export * from './dto'
                    └── create-lead.dto.ts → import { createZodDto } from 'nestjs-zod'  ❌
```

`nestjs-zod` shared'ın **166 dosyasında** geçiyor ve `package.json`'da runtime `dependencies`
altında. Frontend `import ... from '@core-crm/shared'` yazdığı an NestJS bağımlılıkları
tarayıcı bundle'ına girer.

Bu, projenin **kendi CLAUDE.md kuralını** ihlal ediyor:
> "Never import NestJS-specific packages (decorators, guards, etc.) in shared schemas"

Aynı şekilde `export * from './generated-zod'` — 1.3 MB, ve **38 dosyası `@prisma/client`
import ediyor** (`Prisma.Decimal` runtime değeri olarak). CLAUDE.md yine der ki:
> "Frontend cannot import from `@prisma/client`"

**Çözüm — export subpath'leri + tarayıcı-güvenli giriş noktası:**

`packages/shared/package.json`:

```jsonc
{
  "name": "@core-crm/shared",
  "exports": {
    ".": "./index.ts",              // backend (her şey)
    "./client": "./client.ts",      // frontend (yalnız tarayıcı-güvenli)
    "./modules/*": "./modules/*",
    "./common/*": "./common/*"
  }
}
```

`packages/shared/client.ts` (yeni) — **sadece** şu üçü:

```ts
// Elle yazılmış saf Zod şemaları — runtime güvenli
export * from './modules/lead/schemas';
export * from './modules/appointment/schemas';
// ... modül modül

// z.infer tipleri — derlemede silinir
export type * from './modules/lead/types';

// Response sözleşmeleri + exception meta arayüzleri
export * from './modules/lead/interfaces';

export * from './common/response/response.interface';
export * from './common/pagination';
```

`dto/` **asla** buraya girmez (nestjs-zod). `generated-zod` şemaları da girmez — ama
**tipleri** girebilir, çünkü `export type` derlemede tamamen silinir:

```ts
// ✓ Güvenli — tip silinir, @prisma/client runtime'a gelmez
export type { Lead, Appointment, Patient } from './generated-zod';

// ❌ Yasak — runtime Zod nesnesi, @prisma/client'ı sürükler
export { LeadSchema } from './generated-zod';
```

**Kural:** frontend runtime şemayı **yalnız** `modules/*/schemas`'tan alır; `generated-zod`'dan
**yalnız tip** alır.

Ve `apps/web/eslint.config.mjs` bunu derleyiciye zorlatır:

```js
'no-restricted-imports': ['error', {
  patterns: [
    { group: ['@core-crm/shared'], message: '@core-crm/shared/client kullan (kök barrel nestjs-zod çeker).' },
    { group: ['@core-crm/shared/**/dto/**'], message: 'DTO backend-only (nestjs-zod).' },
    { group: ['**/generated-zod/**'], message: "generated-zod'dan yalnız `import type` ile al." },
  ],
}]
```

### 2.2 Commit edilmiş build artifact'ları

`git ls-files packages/shared` → **175 adet** `.js` / `.d.ts` / `.js.map` dosyası izleniyor
(`modules/appointment/index.js`, `index.d.ts`, ...). CLAUDE.md:
> "Add `*.js`, `*.js.map`, `*.d.ts` to `.gitignore` … Generate build artifacts only during deployment"

Bunlar **bayat**. Node/TS çözümlemesi `.ts` yerine yanındaki `.js`/`.d.ts`'i tercih edebilir →
"kodu değiştirdim ama değişmiyor" tipi saatler yakan hatalar. Frontend bu paketi ciddi biçimde
tüketmeye başlamadan temizlenmeli:

```bash
git rm -r --cached packages/shared --include='*.js' '*.d.ts' '*.js.map'
# + packages/shared/.gitignore
```

### 2.3 `transpilePackages` eksik

`shared` ham TypeScript yayınlıyor (`"main": "index.ts"`). Next.js `node_modules` içindeki ham
`.ts`'i varsayılan olarak derlemez. `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@core-crm/shared'],   // ← ekle
};
```

---

## 3. Stack

| Katman              | Seçim                                  | Neden                                                                 |
| ------------------- | -------------------------------------- | --------------------------------------------------------------------- |
| Framework           | Next.js 16 App Router (mevcut)         | —                                                                     |
| Sunucu durumu       | **TanStack Query v5**                  | Cache, invalidation, optimistic update; CRM'in %90'ı bu               |
| İstemci durumu      | **Zustand**                            | Sadece server-state olmayanlar (sidebar, aktif klinik, modal)         |
| HTTP                | **Tipli fetch wrapper** (kendi yazımız) | Envelope + hata + token + `x-source-type` tek yerde                   |
| Sözleşme            | `shared` Zod şemaları + endpoint kaydı  | tRPC'nin yerini tutan katman (§4)                                     |
| Form                | **react-hook-form + zodResolver**      | `shared` şemasını **doğrudan** yeniden kullanır — en büyük kazanç     |
| UI                  | **shadcn/ui** (Radix + Tailwind v4)    | Tailwind zaten kurulu; kopyala-sahiplen, kilitlenme yok               |
| Tablo               | **TanStack Table**                     | CRM = tablo; sunucu-taraflı sayfalama/sıralama API ile birebir        |
| Tarih               | **dayjs**                              | Backend `DateTimeManager` dayjs kullanıyor — aynı semantik            |
| Auth                | **Firebase Web SDK** + httpOnly cookie | Backend Firebase ID token doğruluyor                                  |


> **Not:** kök `package.json`'da `date-fns` + `date-fns-tz` var ama API tarafı `dayjs` kullanıyor.
> Frontend'de **dayjs**'te birleş — iki tarih kütüphanesi taşımanın anlamı yok.

---

## 4. Sözleşme Katmanı — tRPC'nin yerine ne koyuyoruz

Eksik olan tek parça: **endpoint tanımları**. Şemalar ve tipler var, "hangi URL, hangi metod,
hangi cevap" bilgisi yok. Onu da `shared`'a koyuyoruz ki tek kaynak korunsun.

`packages/shared/modules/lead/contracts/lead.endpoints.ts`:

```ts
import { z } from 'zod';
import { CreateLeadSchema, GetLeadsSchema } from '../schemas';
import { PaginationSchema } from '../../../common/pagination';
import type { Lead } from '../../../generated-zod';   // type-only → güvenli

export const leadEndpoints = {
  create: {
    method: 'POST',
    path: (p: { clinicId: string }) => `/clinics/${p.clinicId}/leads`,
    body: CreateLeadSchema,
    response: z.string(),                    // command → oluşan id (CLAUDE.md kuralı)
  },
  list: {
    method: 'GET',
    path: (p: { clinicId: string }) => `/clinics/${p.clinicId}/leads`,
    query: GetLeadsSchema.extend(PaginationSchema.shape),
    response: null as unknown as Lead[],     // QueryResponse<T>'nin T'si
  },
  byId: {
    method: 'GET',
    path: (p: { leadId: string }) => `/leads/${p.leadId}`,
    response: null as unknown as Lead | null,
  },
} as const;
```

Bu, `apps/api` controller'ındaki rotaların birebir aynası (`clinics/:clinicId/leads`,
`leads/:leadId`). Client tarafı bundan tam çıkarım yapar:

```ts
const id   = await api(leadEndpoints.create, { params: { clinicId }, body: dto });   // string
const list = await api(leadEndpoints.list,   { params: { clinicId }, query: { page: 1 } }); // Lead[]
```

Otomatik tamamlama, tip güvenliği, runtime doğrulama — tRPC hissi, REST üstünde, backend'e
dokunmadan.

**Yazma disiplini:** yeni endpoint açan backend geliştiricisi aynı PR'da `*.endpoints.ts`
kaydını da ekler. Sözleşme tek yerde tutulur.

---

## 5. HTTP İstemcisi

Backend'in tel formatı sabit; tek yerde soyutlanır.

**Başarı:** `QueryResponse<T>` → `{ data, meta? }`; `meta` içinde `pagination` ve/veya
`serializationOptions`. `TransformInterceptor` devredeyse şekil `{ data, serialization }`
olur — client ikisini de normalize eder.

**Hata** (`AllExceptionsFilter`):

```jsonc
{ "success": false, "statusCode": 409, "path": "/api/v1/...",
  "code": "APPOINTMENT.SLOT_CONFLICT", "error": "Seçilen randevu saatleri dolu.",
  "meta": { "conflictingSlots": ["10:00"], "suggestedNextAvailableSlot": "13:00" },
  "timestamp": "..." }
```

`meta` **tipli** — `@shared/modules/appointment/interfaces` içindeki `SlotConflictMeta` hem
backend exception'ının hem frontend'in import ettiği aynı arayüz. Bu, "hata anında akıllı UI"
(alternatif slot önerme, alan-bazlı validasyon gösterme) için doğrudan kullanılır:

```ts
export class ApiError<TMeta = unknown> extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    message: string,
    readonly meta?: TMeta
  ) { super(message); }
}

// Kullanım — daraltılmış tip
catch (e) {
  if (e instanceof ApiError && e.code === ERROR_CODES.APPOINTMENT.SLOT_CONFLICT) {
    const meta = e.meta as SlotConflictMeta;
    showAlternatives(meta.suggestedNextAvailableSlot);
  }
}
```

**İstemcinin sorumlulukları:** base URL (`/api/v1`), `Authorization: Bearer <idToken>`,
`x-source-type: WEB` başlığı (AuthGuard bunu okuyup `actor.source`'a yazıyor — audit log için
kritik), 401'de token yenileme + tek sefer retry, envelope soyma, `ApiError` fırlatma.

---

## 6. Klasör Yapısı

Backend'in modül gruplarını **aynen** yansıtır — tek zihinsel model:

```
apps/web/
  app/
    (auth)/login/
    (app)/
      layout.tsx                     # kabuk: sidebar + topbar + guard
      dashboard/
      clinics/[clinicId]/
        leads/                       # crm
        appointments/                # clinical
        patients/
        finance/                     # finance
        messages/                    # messaging (inbox)
        settings/
      organizations/[organizationId]/
      admin/                         # platform
    api/auth/session/route.ts        # idToken → httpOnly cookie
  src/
    lib/
      api/                           # §5 — client, error, envelope
      auth/                          # firebase init, session, token yenileme
      query/                         # QueryClient, key factory
    features/                        # backend modül gruplarıyla hizalı
      crm/lead/
        api/                         # useLeads, useCreateLead (TanStack hooks)
        components/
        schemas/                     # YALNIZ UI-only alanlar; iş şeması shared'ta
      clinical/appointment/
      finance/payment/
      messaging/conversation/
      identity/
    components/ui/                   # shadcn primitive'leri
    components/                      # paylaşılan bileşik bileşenler
    hooks/
    stores/                          # zustand
```

**Kural:** `features/*/api/` dışında hiçbir yerde `fetch` çağrılmaz. Bileşenler yalnız hook
tüketir.

---

## 7. Veri Çekme Konvansiyonları

**Query key factory** — invalidation'ın öngörülebilir olması için:

```ts
export const leadKeys = {
  all:    ['leads'] as const,
  lists:  (clinicId: string) => [...leadKeys.all, 'list', clinicId] as const,
  list:   (clinicId: string, f: GetLeads) => [...leadKeys.lists(clinicId), f] as const,
  detail: (leadId: string) => [...leadKeys.all, 'detail', leadId] as const,
};
```

**Command sonrası invalidation.** Backend command'leri CLAUDE.md gereği zengin model
döndürmez (create → `string` id, update → `void`). Yani mutation cevabından cache'i
besleyemeyiz; **invalidate zorunlu**:

```ts
export const useCreateLead = (clinicId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLead) => api(leadEndpoints.create, { params: { clinicId }, body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: leadKeys.lists(clinicId) }),
  });
};
```

**Optimistic locking.** `version` / `updatedAt` dönen command'lerde (randevu, abonelik) cevap
cache'e yazılır; sonraki istek doğru `version`'ı göndersin, `ConcurrencyConflictException`
(409) yemeyelim. 409 gelirse: "kayıt başkası tarafından güncellendi, yenile" akışı.

**RSC vs Client.** CRM oturum arkasında, SEO gerekmiyor. Varsayılan: **client component +
TanStack Query** (filtre/sayfalama/canlı yenileme burada çok daha rahat). İlk boyanın kritik
olduğu ekranlarda (dashboard) RSC ile prefetch + `HydrationBoundary` kullanılır — istisna,
kural değil.

---

## 8. Auth

Backend stateless: `Authorization: Bearer <firebase-id-token>` (`AuthGuard` →
`validateAndGetContext`).

**Akış:**

1. İstemcide Firebase Web SDK ile giriş → `idToken`
2. `POST /api/auth/session` (Next Route Handler) → token **httpOnly + secure cookie**'ye yazılır
3. Client istekleri: token'ı Firebase SDK'dan bellekten alır (otomatik yenilenir)
4. Server Component / Server Action istekleri: cookie'den okur, `Bearer` olarak iletir
5. `middleware.ts`: cookie yoksa `(app)/**` → `/login` yönlendirmesi

Cookie'yi hem middleware guard'ı hem RSC'den veri çekebilmek için istiyoruz. Sadece client-side
fetch yapılacaksa cookie atlanabilir ama ilerisi için maliyeti düşük.

**Token yenileme:** Firebase ID token 1 saat ömürlü. API client 401'de bir kez
`getIdToken(true)` deneyip isteği tekrarlar; yine 401 ise oturumu düşürür.

---

## 9. Yetkilendirme — backend'in aynası

Backend üç katman uyguluyor; frontend bunları **tekrar uygulamaz, yansıtır** (UI'da gizlemek
güvenlik değil, UX'tir — otorite her zaman backend):

| Backend                     | Frontend karşılığı                                    |
| --------------------------- | ------------------------------------------------------ |
| `CapabilityGuard`           | `useCapability('lead:create')` / `<Can capability=…>`  |
| `ModuleEntitlementGuard`    | `useModule('e_invoice')` — kapalıysa upsell göster     |
| Policy serileştirme grupları | Cevaptaki `meta.serializationOptions.groups`           |

`ActorContext` (userId, capabilities, rolePriority, clinicId, organizationId, managedClinics,
ownedOrganizations) girişte bir kez çekilir, `AuthProvider` context'inde tutulur, `staleTime:
Infinity` ile cache'lenir.

**Serileştirme grupları** özellikle değerli: backend zaten görmemesi gereken alanları
cevaptan **siliyor** (`TransformInterceptor` + `class-transformer`). Frontend `groups`'a
bakarak o alanın kolonunu/inputunu hiç render etmez — "undefined" gösteren kırık UI olmaz.

---

## 10. Çok Kiracılılık (Multi-tenancy)

API rotaları zaten klinik-kapsamlı (`clinics/:clinicId/leads`). Frontend bunu **URL'de**
taşır: `/clinics/[clinicId]/leads`. Aktif kliniği global store'da saklamak yerine route
param'da tutmak; derin link, çoklu sekme ve paylaşılan URL'leri bedavaya çözer.

Klinik değiştirici (`managedClinics` listesinden) sadece `router.push` yapar. `[clinicId]`
layout'u yetki doğrular ve context'e yayar.

---

## 11. Uygulama Sırası

**Faz 0 — shared temizliği (bloker, §2).** Export subpath'leri + `client.ts`, artifact
temizliği, `transpilePackages`, ESLint kısıtları. Bu bitmeden aşağısına başlanmaz.

**Faz 1 — iskelet.** Bağımlılıklar, shadcn init, `lib/api` + `lib/auth` + `lib/query`,
`(auth)/login`, `(app)` kabuğu + middleware, `ActorContext` provider.

**Faz 2 — dikey dilim: Lead.** Uçtan uca bir modül (endpoint kaydı → hook → tablo → form →
detay). Diğer her şeyin kopyalanacağı şablon burada oturur. Tek modülde tüm desenleri
(sayfalama, filtre, mutation+invalidation, capability, hata meta) doğrula.

**Faz 3 — yatay yayılım.** Appointment (takvim), Patient, Finance, Messages (inbox). Faz 2
şablonu tekrarlanır.

| Dilim | Durum | Ekranlar |
| --- | --- | --- |
| Appointment | ✅ | Günlük ajanda (`/clinics/:id/appointments`) — gün/doktor/durum filtresi URL'de, durum geçişleri, çakışma `meta`sı |
| Patient | ✅ | Liste + detay. **Backend okuma yüzeyi yoktu, bu dilimde yazıldı** (`findMany`, `GetPatientsQuery`, policy'li `GetPatientByIdQuery`, query controller) |
| Finance | ✅ | Cari defter + dönem özeti (`/clinics/:id/finance`), fatura listesi (`/finance/invoices`), hasta detayında cari kart |
| Messages | ✅ | Gelen kutusu (`/clinics/:id/messages`) — konuşma listesi + mesaj akışı + gönderim, çok kanallı (WhatsApp/Telegram/Instagram) |

**Finance diliminde not edilen iki sınır** (kod yorumlarında da var):

1. **Tarih aralığı yalnız özete uygulanır.** `GetLedgerByClinicIdQuery` yalnız sayfalama
   alıyor, tarih filtresi almıyor. Arayüz bunu gizlemek yerine aralık seçiliyken kullanıcıya
   söylüyor — aksi hâlde listenin de filtrelendiği sanılırdı. Uca tarih filtresi eklemek
   ayrı bir iş.
2. **Fatura listesi `organizationId`'yi zorunlu istiyor** (`@Query('organizationId',
   ParseUUIDPipe)`), oysa aktörün organizasyonu bağlamda zaten var. Sözleşme uydurmak yerine
   olduğu gibi yansıtıldı; aktör yüklenene kadar istek `enabled: false` ile bekletiliyor.

**Messages dilimi — messaging ayrı serviste.** Yollar `/messaging` önekiyle yazılır ve ters
vekil (`infra/nginx/core-crm.conf`) onları :8081'e yönlendirir; istemci tek origin görür.
Yerel geliştirmede vekil kapalı olduğu için `NEXT_PUBLIC_MESSAGING_API_URL` verilirse
`/messaging` önekli yollar doğrudan messaging'e gider (`lib/api/client.ts`). Üretimde bu
değişken boş bırakılır ve kod yolu hiç devreye girmez.

**Bu dilimde iki backend eksiği kapatıldı** (ayrıntı: `apps/api/documents/messaging-microservice.md`):

1. **Cross-tenant veri sızıntısı (kritik).** Conversation handler'ları `clinicId`'yi URL'den
   alıp doğrudan sorguya geçiriyordu; var olan kontroller kaydı **URL parametresiyle**
   karşılaştırıyordu, aktörle değil. Oturum açmış herhangi bir kullanıcı başka kliniğin
   id'sini yazarak o kliniğin tüm yazışmalarını okuyabiliyor ve o klinik adına mesaj
   gönderebiliyordu. `assertActorCanAccessClinic` eklendi (9 handler).
2. **24s servis penceresi düz 400 dönüyordu.** Arayüzün bu duruma özel davranması gerekiyor
   (kutuyu kilitle, şablona yönlendir); `MESSAGING.SERVICE_WINDOW_CLOSED` tipli domain
   exception'ına çevrildi, `meta` sözleşmesi `@shared`'te.

**Serileştirme tier'ı arayüz kararıdır.** Finans alanları (`amount`, `grandTotal`,
`totalIncome`) yetkisi olmayan aktörün cevabından **silinerek** gelir. Bu yüzden `shared`
interface'lerinde `?:` yazılıdır ve arayüz `undefined`ı "—" ile göstermez: "boş" ile "görme
yetkin yok" farklı şeyler. Özet kartlarında blok tamamen gizlenir, tablo hücresinde "gizli"
yazar.

---

## 12. Özet

- **tRPC yok** — sözleşme zaten `shared`'da; tRPC transport'u yeniden yazdırır, guard
  altyapısını duplike ettirir. REST + tipli client + TanStack Query aynı DX'i sıfır backend
  değişikliğiyle verir.
- **Önce `shared` düzeltilir** — kök barrel `nestjs-zod` ve `@prisma/client` sızdırıyor;
  bu proje kendi CLAUDE.md kuralını ihlal ediyor ve frontend'i doğrudan kırar.
- **Endpoint kaydı** (`*.endpoints.ts`) eksik parçadır; tRPC router'ının yerini tutar.
- **Klasörler backend modül gruplarını yansıtır** — tek zihinsel model, kolay gezinme.
