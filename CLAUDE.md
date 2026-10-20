# CLAUDE.md

**Kod yazarken bu kurallara sadık kal**

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Core CRM is a monorepo containing a NestJS-based API backend and a Next.js frontend for managing CRM operations in
healthcare sectors (dental, hair transplant, aesthetics). The project uses pnpm workspaces, Turbo for build
orchestration, Prisma for database management, and follows Clean Architecture principles.

## Monorepo Structure

```
apps/
  api/        # NestJS backend API
  web/        # Next.js frontend
packages/
  shared/     # Shared types, schemas, and Zod validations
```

## Common Commands

### Development

```bash
# Run all apps in dev mode
pnpm dev

# Run specific app
cd apps/api && pnpm start:dev
cd apps/web && pnpm dev
```

### Database

```bash
# Navigate to API directory first
cd apps/api

# Generate Prisma client and Zod schemas
pnpm prisma:generate

# Create and apply migrations
pnpm migrate:dev

# Seed database
pnpm prisma db seed
```

### Build & Test

```bash
# Build all packages
pnpm build

# Lint all packages
pnpm lint

# Format code
pnpm format

# Run tests (from apps/api)
cd apps/api
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:cov          # With coverage
pnpm test:e2e          # E2E tests
```

## Architecture (apps/api)

### Clean Architecture Layers

The API follows a modular CQRS + Clean Architecture pattern with strict separation of concerns:

**Module Groups** (`src/modules/`):

```
clinical/    → appointment, medical-files, provider, treatment, treatment-package
crm/         → lead, meta-ads, patient
finance/     → finance-ledger, invoice, payment, pos, subscription
identity/    → auth, role, user
inventory/   → (tekil modül)
organization/ → clinic, organization
platform/    → admin-request, audit-log, lookup, mail, policy
```

**Module Structure** (e.g., `src/modules/organization/clinic/`):

```
domain/                    # Business entities and domain events
  events/                  # Domain events (e.g., ClinicSoftDeletedEvent)
  repositories/
  exceptions/
    <aggregate-name>.exceptions.ts. DomainException extends edilir
  entities/
  rules/
  interfaces/
  value-objects/ <name>.vo.ts
  services/
  contracts/
    <aggregate-name>.contracts.ts  # Merkezi Zod kontrat dosyası (Props/Data/Filter/Response) — domain/types/ KULLANILMAZ
application/               # Commands, queries, ai tools- and business logic
  ai-tools/
    clinic-ai-tools.module.ts
    book-appointment.tool.ts
  policies/                # Authorization policies
  commands/                # Command handlers (write operations)
    create-clinic/
      create-clinic.command.ts     # Command class (input payload)
      create-clinic.handler.ts     # Handler (business logic, @CommandHandler)
      create-clinic.response.ts    # Output contract (return type)
      create-clinic.spec.ts        # Unit tests
    update-clinic/
      update-clinic.command.ts
      update-clinic.handler.ts
      update-clinic.response.ts
      update-clinic.spec.ts
    command.module.ts              # Registers all command handlers
  queries/                 # Query handlers (read operations)
    get-clinic/
      get-clinic.query.ts          # Query class (input payload)
      get-clinic.handler.ts        # Handler (@QueryHandler)
      get-clinic.response.ts       # Output contract
      get-clinic.spec.ts
    query.module.ts                # Registers all query handlers
infrastructure/            # External concerns
  persistence/prisma/      # Database repositories
  events/               # events
    listener/           #listeners
    clinic-event-publisher.service.ts               # Event publisher servisi
    clinic-event.module.ts
  qeueue/
    processors/
    producer/           # Queue processors
  cache/
    clinic-cache.service.ts
presentation/              # API layer
  controllers/             # HTTP controllers
  dto/
    clinic-response.dto.ts        # response dtos.
  clinic-presentation.module
```

**CQRS Folder Structure Rules**:

Each command/query is self-contained in its own folder with:

- `*.command.ts` / `*.query.ts` — Plain class holding the input payload; no logic
- `*.handler.ts` — The handler decorated with `@CommandHandler` / `@QueryHandler`; all business logic lives here
- `*.response.ts` — Output contract (type alias for the return value)
- `*.spec.ts` — Unit tests for the handler
- No cross-folder imports between command/query folders; share via repositories or the bus
- All handlers are registered in `command.module.ts` / `query.module.ts` and wired with `CqrsModule`

**Response Type Kuralı — KURAL**:

| İşlem tipi                            | Dönüş tipi                                       | Notlar                                                            |
| ------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| **Query**                             | `QueryResponse<T>`                               | `@shared/common/response/response.interface.ts`'den import edilir |
| **Command — create**                  | `string`                                         | Oluşturulan kaydın `id`'si doğrudan döner                         |
| **Command — update / delete (basit)** | `void`                                           | Sadece aşağıdaki istisnalar yoksa                                 |
| **Command — optimistic locking**      | `{ version: number }` veya `{ updatedAt: Date }` | Frontend bir sonraki istekte doğru version'ı gönderebilmeli       |
| **Command — 3rd party entegrasyon**   | `{ referenceId, status, ... }`                   | Dış servis (Nilvera, İyzico, Stripe) anlık metadata üretiyorsa    |
| **Command — Saga / workflow adımı**   | İlgili state / output                            | Sonraki adım bu çıktıya bağlıysa                                  |

**Altın Kural**: Command'ler asla zengin domain modeli veya entity listesi döndürmez. Sadece o command'in yaşam döngüsünü tamamlamak için gereken **minimum metadata** döner (ID, version, status, entegrasyon ref no). Veri listelemek veya detay göstermek için her zaman Query kullanılır.

**Query response** (`*.response.ts`) — `T` her zaman plain model / read-model'dir, **domain entity DEĞİL**:

```typescript
import { QueryResponse } from '@shared/common/response/response.interface';
import { Lead } from '@shared'; // generated plain model — domain entity DEĞİL

export type GetLeadByIdResponse = QueryResponse<Lead | null>;
```

**Query sınıfında `__responseType`** (TSQueryBus için tip çıkarımı sağlar):

```typescript
export class GetLeadByIdQuery implements IQuery {
  readonly __responseType!: GetLeadByIdResponse;
  constructor(
    public readonly leadId: string,
    public readonly ctx: IGetContext
  ) {}
}
```

**Command / Query sınıfı constructor imzası — KURAL: `payload` objesi + `data`/`filter` adlandırması**:

Command/Query sınıfının constructor'ı **2 veya daha az** alan taşıyorsa alanlar doğrudan ayrı parametre olarak geçilir (`leadId`, `ctx` gibi — yukarıdaki `GetLeadByIdQuery` örneği). **2'den fazla** alan taşıyorsa (ör. `id` + gövde + `ctx`) hepsi **tek bir `payload` objesi** içinde toplanır; ayrı ayrı sıralanmaz.

`payload` içindeki gövde alanının adı ve tipi:

| Sınıf tipi  | Gövde alan adı | Tip                                             |
| ----------- | -------------- | ----------------------------------------------- |
| **Command** | `data`         | `@shared` zod-infer **type** (DTO sınıfı DEĞİL) |
| **Query**   | `filter`       | `@shared` zod-infer **type** (DTO sınıfı DEĞİL) |

Controller `@Body()` / `@Query()` ile **DTO** alır; bus'a geçerken command/query sınıfına aktarılan alan adı `data`/`filter` ve tipi zod-infer **type** (`ReviewPurchaseRequest`) olur. DTO sınıf adı (`...Dto`) command/query sınıfının içine **sızmaz**.

**`payload` içindeki alanlar da `readonly`** — command/query bir immutable value object'tir; dış `public readonly payload` referansı korur ama iç alanlar `readonly` işaretlenmezse mutasyona açık kalır. Her iç alan `readonly` yazılır.

**DTO adlandırması (presentation katmanı) — KURAL:**

| DTO tipi                 | İsim deseni                      | Örnek                                                                           |
| ------------------------ | -------------------------------- | ------------------------------------------------------------------------------- |
| **Query filtre DTO'su**  | `...FilterDto`                   | `GetPurchaseOrdersFilterDto`, `GetPurchaseRequestsFilterDto`                    |
| **Command gövde DTO'su** | `...Dto` (fiil-önekli, değişmez) | `CreatePurchaseOrderDto`, `ReceivePurchaseOrderDto`, `ReviewPurchaseRequestDto` |

Query DTO'su kavramsal olarak bir filtredir → `...FilterDto` rolü belgeler ve payload'daki `filter` alanıyla simetriktir. Command DTO'su zaten fiil-önekli (`Create...`, `Receive...`, `Review...`) olduğundan rolü nettir; `...DataDto` **yazılmaz** (DTO zaten "data" demektir — tautoloji; ayrıca zod-infer type `CreatePurchaseOrder` ile paralelliği bozar).

```typescript
// ✓ Command — >2 alan → tek payload objesi; iç alanlar readonly; gövde alanı `data`, tipi zod-infer type
import type { ReviewPurchaseRequest } from '@shared/modules/purchasing/types/commands';

export class ApprovePurchaseRequestCommand implements ICommand {
  constructor(
    public readonly payload: {
      readonly requestId: string;
      readonly data: ReviewPurchaseRequest; // ❌ ReviewPurchaseRequestDto DEĞİL
      readonly ctx: IGetContext;
    }
  ) {}
}

// ✓ Query — >2 alan → tek payload objesi; iç alanlar readonly; gövde alanı `filter`
import type { GetPurchaseOrders } from '@shared/modules/purchasing/types/queries';

export class GetPurchaseOrdersQuery implements IQuery {
  readonly __responseType!: GetPurchaseOrdersResponse;
  constructor(
    public readonly payload: {
      readonly filter: GetPurchaseOrders; // ❌ GetPurchaseOrdersFilterDto DEĞİL
      readonly pagination: Pagination;
      readonly ctx: IGetContext;
    }
  ) {}
}
```

```typescript
// ❌ Yanlış — çok sayıda ayrı parametre + `dto` alanı + DTO tipi
export class ApprovePurchaseRequestCommand implements ICommand {
  constructor(
    public readonly requestId: string,
    public readonly dto: ReviewPurchaseRequestDto, // hem ayrı param hem `dto`/DTO tipi yanlış
    public readonly ctx: IGetContext
  ) {}
}

// ✓ Controller DTO alır (query filtresi → ...FilterDto), payload'a `data`/`filter` olarak aktarır
@Post(':id/approve')
approve(
  @Param('id') requestId: string,
  @Body() dto: ReviewPurchaseRequestDto,
  @GetContext() ctx: IGetContext
) {
  return this.commandBus.execute(
    new ApprovePurchaseRequestCommand({ requestId, data: dto, ctx })
  );
}

@Get()
list(
  @Query() dto: GetPurchaseOrdersFilterDto,
  @Query() pagination: PaginationDto,
  @GetContext() ctx: IGetContext
) {
  return this.queryBus.execute(
    new GetPurchaseOrdersQuery({ filter: dto, pagination, ctx })
  );
}
```

**Query Handler dönüş tipi — KURAL: Handler ASLA entity döndürmez**:

Sorumluluk ayrımı nettir: **repository `find*` metodları domain entity döndürür** (iş kuralları, getter'lar, VO'lar için); **query handler'ı bu entity'yi dışarı sızdırmaz**. Handler, response'a koymadan önce entity'yi mutlaka plain / serileştirilebilir bir shape'e çevirir:

| Senaryo                        | Handler dönüşü                                                            |
| ------------------------------ | ------------------------------------------------------------------------- |
| **Tek kayıt**                  | `entity.toPersistence()` → `@shared` generated plain model                |
| **Liste**                      | `items.map((e) => e.toPersistence())`                                     |
| **Projeksiyon / okuma modeli** | `domain/<module>.contracts.ts`'teki `Filter` / `Response` read-model tipi |

**Gerekçe**: Entity domain katmanına aittir; private alanları, Value Object'leri (`UUID`, `Phone`, `Money`) ve davranış metotları HTTP/serileştirme sınırının ötesine taşınmaz. Bu yüzden `QueryResponse<T>` içindeki `T` **hiçbir zaman bir entity değildir** — daima plain model veya read-model'dir. Repository entity döner ki handler domain mantığını çalıştırabilsin; handler düz veriye map'leyip öyle döner.

```typescript
// ❌ Yanlış — handler entity'yi response'a sızdırıyor
async execute(query: GetLeadByIdQuery): Promise<GetLeadByIdResponse> {
  const lead = await this.leadQueryRepo.findById(query.leadId); // Lead entity
  return { data: lead }; // entity HTTP sınırını geçiyor
}

// ✓ Doğru — entity plain shape'e map'lenip dönülüyor
async execute(query: GetLeadByIdQuery): Promise<GetLeadByIdResponse> {
  const lead = await this.leadQueryRepo.findById(query.leadId); // Lead entity
  return { data: lead ? lead.toPersistence() : null };
}
```

**Command — create** (`*.response.ts` gerekmez, doğrudan `string`):

```typescript
// create-lead.handler.ts
async execute(command: CreateLeadCommand): Promise<string> {
  const lead = await this.leadCommandRepo.create(props);
  return lead.id;
}
```

**Command — basit update / delete** (`void`, response dosyası olmaz):

```typescript
async execute(command: UpdateLeadStatusCommand): Promise<void> {
  // optimistic locking, 3rd party entegrasyon veya saga yoksa void yeterli
}
```

**Command — optimistic locking** (versiyonlu güncelleme, response dosyası olur):

```typescript
// update-appointment.response.ts
export interface UpdateAppointmentResponse {
  version: number; // veya updatedAt: Date
}

// update-appointment.handler.ts
async execute(command: UpdateAppointmentCommand): Promise<UpdateAppointmentResponse> {
  // entity.version DB'de artırıldı, frontend bir sonraki istekte bunu gönderecek
  return { version: saved.version };
}
```

**Command — 3rd party entegrasyon** (response dosyası olur):

```typescript
// create-invoice.response.ts
export interface CreateInvoiceResponse {
  referenceId: string; // GİB / Nilvera'nın ürettiği belge no
  status: string;
}
```

**TSCommandBus / TSQueryBus — KURAL**:

Controller'larda ham `CommandBus` / `QueryBus` yerine tip-güvenli sarmalayıcılar kullanılır.

- Konum: `src/common/cqrs/`
- `TSCommandBus`: `TCommand.__responseType` üzerinden dönüş tipini çıkarır
- `TSQueryBus`: `TQuery.__responseType` üzerinden dönüş tipini çıkarır

```typescript
// ❌ Yanlış
constructor(private readonly queryBus: QueryBus) {}
const result = await this.queryBus.execute(new GetLeadByIdQuery(...)); // tip: any

// ✓ Doğru
constructor(private readonly queryBus: TSQueryBus) {}
const result = await this.queryBus.execute(new GetLeadByIdQuery(...)); // tip: GetLeadByIdResponse
```

### Key Architectural Patterns

**1. CQRS (Commands & Queries)**: All business logic is encapsulated in command/query handlers

- Commands (write): `CreateClinicCommand` + `CreateClinicHandler`, `UpdateClinicCommand` + `UpdateClinicHandler`
- Queries (read): `GetClinicQuery` + `GetClinicHandler`, `FindManyClinicsQuery` + `FindManyClinicsHandler`
- Controllers dispatch via `TSCommandBus.execute()` / `TSQueryBus.execute()` — no direct handler injection
- Each module registers its handlers in `command.module.ts` and `query.module.ts`, both imported by the main module

**2. Repository Pattern**: Database access is abstracted through repositories

- Located in `infrastructure/persistence/prisma/repositories/`
- Injected into command and query handlers, not controllers
- Example: `ClinicRepository`, `UserRepository`
- **All repositories extend `BaseRepository`** (`src/infrastructure/persistence/prisma/base.repository.ts`)

**BaseRepository**:

```typescript
// src/infrastructure/persistence/prisma/base.repository.ts
export abstract class BaseRepository {
  protected constructor(protected readonly prisma: PrismaService) {}

  protected get db() {
    return txStorage.getStore()?.tx ?? this.prisma;
  }
}
```

- `this.db` yerine `this.prisma` kullanılmaz — her zaman `this.db` kullanılır
- `this.db`, Async Local Storage (ALS) üzerinden aktif bir transaction varsa onu, yoksa ana `PrismaService`'i döner
- Bu sayede `txStorage` ile koordine edilen transaction'lar otomatik olarak yakalanır

**Repository Mimarisi — KURAL: Command / Query Ayrımı + Interface + Token**:

Her repository **iki ayrı implementasyon dosyasına** bölünür. Interface'ler ve injection token'ları **domain katmanında** tutulur (Dependency Inversion Principle: domain kendi ihtiyacını tanımlar, infrastructure implement eder). Başka katmanlarda inject ederken sınıf adı değil, **token** kullanılır.

**Klasör yapısı**:

```
domain/
  repositories/
    foo.repository.ts            # IFooCommandRepository + IFooQueryRepository + token'lar

infrastructure/persistence/prisma/repositories/
  foo/
    foo.command.repository.ts    # Write operasyonları (create, update, delete)
    foo.query.repository.ts      # Read operasyonları (find, list)
    foo.repository.module.ts     # İkisini birleştiren NestJS modülü
```

**Interface dosyası** (`domain/repositories/foo.repository.ts`):

```typescript
export const FOO_COMMAND_REPOSITORY = Symbol('IFooCommandRepository');
export const FOO_QUERY_REPOSITORY = Symbol('IFooQueryRepository');

export interface IFooCommandRepository {
  create(data: CreateFooInput): Promise<Foo>;
  update(id: string, data: UpdateFooInput): Promise<Foo>;
  softDelete(id: string): Promise<void>;
}

export interface IFooQueryRepository {
  findById(id: string): Promise<Foo | null>;
  findMany(
    spec: Specification<Prisma.FooWhereInput>,
    pagination: Pagination
  ): Promise<PaginatedResult<Foo>>;
}
```

**Query repository** (`foo.query.repository.ts`):

```typescript
@Injectable()
export class FooQueryRepository
  extends BaseRepository
  implements IFooQueryRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findById(id: string) {
    return this.db.foo.findUnique({ where: { id } });
  }

  findMany(spec: Specification<Prisma.FooWhereInput>, pagination: Pagination) {
    return paginate({
      delegate: this.db.foo,
      pagination,
      where: spec.toQuery(),
    });
  }
}
```

**Repository modülü** (`infrastructure/persistence/prisma/repositories/foo/foo.repository.module.ts`):

```typescript
import {
  FOO_COMMAND_REPOSITORY,
  FOO_QUERY_REPOSITORY,
} from '@modules/foo/domain/repositories/foo.repository';

@Module({
  providers: [
    { provide: FOO_COMMAND_REPOSITORY, useClass: FooCommandRepository },
    { provide: FOO_QUERY_REPOSITORY, useClass: FooQueryRepository },
  ],
  exports: [FOO_COMMAND_REPOSITORY, FOO_QUERY_REPOSITORY],
})
export class FooRepositoryModule {}
```

**Handler'da inject etme**:

```typescript
// ❌ Yanlış — sınıfı direkt inject etmek
constructor(private readonly fooRepository: FooCommandRepository) {}

// ✓ Doğru — domain'deki token + interface üzerinden inject etmek
import {
  FOO_COMMAND_REPOSITORY,
  FOO_QUERY_REPOSITORY,
  IFooCommandRepository,
  IFooQueryRepository,
} from '@modules/foo/domain/repositories/foo.repository';

constructor(
  @Inject(FOO_COMMAND_REPOSITORY)
  private readonly fooCommandRepo: IFooCommandRepository,

  @Inject(FOO_QUERY_REPOSITORY)
  private readonly fooQueryRepo: IFooQueryRepository,
) {}
```

**Command Handler'da Command Repo vs Query Repo — KESİN KURAL**:

Bir **Command Handler** (yazma tarafı / Command Context) içinde **durumu değiştirilecek, güncellenecek veya kilitlenecek her şey Query Repo'dan değil, Command Repo'dan** çekilir (`findById`, `findByIdForUpdate`, `findOpenByRegister` vb.). Bu CQRS'in temel doğruluk kuralıdır.

**Neden:**

1. **Transaction & kilit bütünlüğü** — Query Repo'lar doğaları gereği read-only kurgulanır; kilit (`SELECT … FOR UPDATE`) veya mutasyon-güvenli okuma garantisi vermezler. Query Repo'dan okuyup Command Repo ile yazarsan okunan veri aktif transaction'ın kilit kapsamı dışında kalabilir → **stale data üzerine yazma** (lost update).
2. **Read-replica / eventual consistency** — Büyük ölçekte Query Repo'lar Read-Replica'ya (slave) yönlenebilir; replication lag nedeniyle master'a yeni yazılmış veri replica'da henüz görünmeyebilir. Command Handler içinde Query Repo okursan **eski veriyi** okursun (örn. kasa oturumunu kapatıp 10 ms sonra açmak isterken Query Repo "hâlâ açık" görebilir).
3. **Aggregate Root farkı** — Query Repo DTO/ViewModel/ham kayıt döner (iş kuralı yok); Command Repo tam **Aggregate Root / Domain Entity** döner (tüm invariant'lar ve state geçişleri üstünde).

**Altın Kural:**

| Katman | Query Repo | Command Repo |
| --- | --- | --- |
| **Query Handler (read side)** | %100 her zaman | ❌ asla |
| **Command Handler (write side)** | ❌ **yalnız** kilit/sorumluluk gerektirmeyen "read-only ön-kontrol" (salt varlık kontrolü / yetki testi, sonucu bir mutasyonu belirlemiyorsa) | %100 (mutasyon, kilit, iş kararı besleyen okuma için) |

Bir Command Handler bir veriyi okuyup **üzerinde karar verecek veya değiştirecekse**, o veri **daima** Command Repo'dan (`findById` / `findByIdForUpdate`) çekilir. Query Repo, Command Handler'a yalnız UI'a dönecek read-only veriyi toplamak için girebilir — iş mantığında **kullanılmaz**.

```typescript
// ❌ Yanlış — kilit altında mutasyon kararını Query Repo besliyor
const open = await this.sessionQueryRepo.findOpenByRegister(registerId); // stale/replica riski
if (open) throw new CashSessionAlreadyOpenException(...);
await this.sessionCommandRepo.create(session);

// ✓ Doğru — karar Command Repo'dan (aynı tx + kilit kapsamı)
const open = await this.sessionCommandRepo.findOpenByRegister(registerId);
if (open) throw new CashSessionAlreadyOpenException(...);
await this.sessionCommandRepo.create(session);
```

**Pessimistic kilit (`findByIdForUpdate`) — KURAL**: Eşzamanlı yazma çekişmesi olan sıcak satırlarda (kasa oturumu aç/kapa, stok düşümü, bakiye/sayaç) Command Repo `findByIdForUpdate(id)` metodu `BaseRepository.lockRowForUpdate(table, id)` ile satırı `FOR UPDATE` kilitler. **Yalnız aktif transaction içinde** çağrılır (`lockRowForUpdate` tx yoksa patlar — kilit tx dışında sessizce etkisizdir). Genel `findById`'a blanket `lock` bayrağı **eklenmez**; kilit ihtiyacı olan repo'ya ayrı, adını söyleyen `findByIdForUpdate` metodu eklenir.

**Optimistic kilit (`version` kolonu) — KURAL**: Çekişmenin nadir ama lost-update'in kabul edilemez olduğu aggregate'lerde (randevu, abonelik) entity bir `version: number` taşır; `update()` `updateMany({ where: { id, version }, data: { …, version: version + 1 } })` ile günceller ve etkilenen satır 0 ise `ConcurrencyConflictException` (`@common/domain/exceptions`, 409) fırlatır. `create()` literal'i `version: 0` ile başlatır; `toPersistence()` `version`'ı taşır. `sync`/`upsert` (dış-senkron) yolları optimistic guard'a tabi değildir.

**7. Domain Types & Kontratlar (`domain/contracts/`) — KURAL**:

Domain kontratları **plain TypeScript `interface`/`type`** ile yazılır — Zod **DEĞİL**. Gerekçe: bu tipler hiçbir zaman `.parse()`/`.safeParse()` edilmez (sadece `z.infer` için şema kuruluyordu — çalışma zamanı maliyeti olan, hiç tetiklenmeyen bir "doğrulama" illüzyonu); gerçek doğrulama zaten iki yerde yapılıyor: **HTTP sınırında** `@shared` DTO'ları (`nestjs-zod` pipe) ve **entity `create()` içinde** Value Object'ler (`Phone.create`, `UUID.create`, `DateRange.create`, `Guard.monitor`). Zod şeması + `z.infer` kombinasyonu bu iki gerçek katmanı tekrar ediyor, hem de hiç çalışmayan `.refine()` zincirleriyle sahte güvenlik hissi veriyordu.

**İstisna — gerçekten `.parse()`/`.safeParse()` edilen kontratlar Zod kalır**: Bir kontrat dış/güvenilmeyen veriyi (OAuth `state` param'ı, webhook payload'ı, imza doğrulaması gereken bir gövde) runtime'da fiilen doğruluyorsa Zod şeması olarak kalır — bkz. `meta-ads.contracts.ts` içindeki `oAuthStatePayloadSchema` + `isOAuthStatePayload()` type-guard'ı. **Kural**: bir şema silinmeden/tipleştirilmeden önce `grep` ile o şemanın adı `.parse(` / `.safeParse(` ile birlikte codebase'de aranır — gerçek bir çağrı varsa Zod kalır, yoksa `interface`/`type`'a çevrilir. Bir kontratta `.refine()`/`.min()`/`.max()`/`.regex()` gibi iş kuralı taşıyan bir kısıt varsa ve bu kısıt entity/VO katmanında **karşılığı yoksa**, tip'e çevrilirken kural kaybolmaz — ilgili Guard/VO kontrolü olarak entity'ye taşınır.

**Klasörleme — aggregate başına klasör**: Modülün bir (veya birden çok) entity'si/aggregate'i varsa, `domain/contracts/` altında **her aggregate için kendi adını taşıyan bir alt klasör** açılır: `domain/contracts/<aggregate-name>/`. Bu klasör konu bazlı dosyalara bölünür (tek dosya çok satır birikince): girdi tipleri (`<aggregate>-inputs.contracts.ts` — `...Props`), okuma modelleri (`<aggregate>-queries.contracts.ts` — `Filter`/`Response`), ve gerekirse modüle özgü ayrı alt-konular (bkz. `appointment/calendar.contracts.ts`, `appointment/reception.contracts.ts`, `appointment/slot-engine.contracts.ts`). Her klasör bir **`index.ts`** barrel'ı ile dışa açılır; tüketiciler klasör yolundan import eder (`.../domain/contracts/<aggregate-name>` → `index.ts`'e çözülür), dosya-içi yoldan değil. Birden fazla aggregate taşıyan modüllerde her aggregate kendi klasörünü alır (ör. `organization/clinic` → `contracts/clinic/`, `contracts/clinic-appointment-settings/`, `contracts/clinic-finance-settings/`, ...). Entity'si olmayan (salt config/value) modüller tek düz dosyada kalabilir: `domain/contracts/<module>.contracts.ts`. Referans örnek: `clinical/appointment/domain/contracts/appointment/`.

**Mimarî Katmanlar ve Veri Akışı (Data Pipeline)** — verinin mimarideki yolculuğuna göre doğru suffix:

| Suffix                    | Ne                                                                                              | Nerede                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **`...Props`**            | Command Handler'dan çıkıp **Entity static `create`** metoduna beslenen katı giriş tipi          | `domain/contracts/<aggregate>/*-inputs.contracts.ts` |
| **`...Data`**             | Repository katmanında doğrudan **Prisma / ORM**'e paslanan, DB şemasına uygun saf veri nesnesi  | `domain/contracts/<aggregate>/*-inputs.contracts.ts` |
| **`...Payload`**          | Domain Event gerçekleştiğinde event parametresi olarak fırlatılan veri paketi                   | `domain/events`                            |
| **`Filter` / `Response`** | Okuma modelleri, listeleme filtreleri, sorgu çıktıları (ör. `StockLevel`, `FindBookingsFilter`) | `domain/contracts/<aggregate>/*-queries.contracts.ts` |

**İsimlendirme Standartları**:

- Entity `create`'e beslenen giriş tiplerinin sonu **`Props`** ile biter (ör. `CreateProductProps`).
- Repository'e (ORM/Prisma) paslanan altyapı veri tiplerinin sonu **`Data`** ile biter (ör. `CreateProductData`).
- Domain Event gövdelerinin sonu **`Payload`** ile biter (ör. `StockPurchasedEventPayload`).
- Read-model / Response / Filter tipleri doğrudan işlevini belirtir (ör. `StockLevel`, `FindBookingsFilter`).
- Zod olarak kalan (gerçekten parse edilen) istisnai kontratlarda şema adı **`Schema`** ile biter; diğer her şey düz `interface`/`type`'tır.

**Katı Tip Güvenliği & Direct Mapping**:

- Başka tiplerden TS `Omit<>`/`Pick<>`/`Partial<>` gibi türetme **kullanılmaz**. Her kontrat doğrudan (**Direct Mapping**) kendi alanlarıyla açıkça yazılır — okunabilirlik ve modülün bağımsızlığı için.
- Value Object taşıyan alanlar (`Money`, `Quantity`, `VatRate`) doğrudan gerçek VO tipiyle yazılır (`quantity: Quantity`); Zod'daki gibi bir sarmalayıcıya gerek yoktur çünkü tip zaten derleme zamanında zorlanır.

```typescript
// supply/inventory/domain/contracts/product/product-inputs.contracts.ts
import { Quantity } from '@src/domain/value-objects/quantity.vo';
import { VatRate } from '@src/domain/value-objects/vat-rate.vo';

// Entity static create() girişi → Props
export interface CreateProductProps {
  id?: string;
  clinicId: string;
  name: string;
  quantity: Quantity;
  vatRate?: VatRate | null;
}
```

```typescript
// supply/inventory/domain/contracts/product/product-queries.contracts.ts

// Filter (read-model) — doğrudan işlevini belirtir
export interface FindProductsFilter {
  clinicId: string;
  search?: string;
}
```

```typescript
// supply/inventory/domain/contracts/product/index.ts
export * from './product-inputs.contracts';
export * from './product-queries.contracts';
```

```typescript
// ❌ Yanlış — command dosyasından import / ayrı domain/types dosyası / dosya-içi yol
import { CreateProductProps } from '@modules/supply/inventory/application/commands/create-product/create-product.command';
import { CreateProductProps } from '@modules/supply/inventory/domain/types/create-product.props';
import { CreateProductProps } from '@modules/supply/inventory/domain/contracts/product/product-inputs.contracts';

// ✓ Doğru — aggregate klasörünün barrel'ından import
import { CreateProductProps } from '@modules/supply/inventory/domain/contracts/product';
```

- `shared` paketindeki DTO'lara (`CreateUser`, `UpdateUser`) **asla** DB'ye özgü alan (ör. `firebaseUid`, `id`) eklenmez; o alanlar `domain/contracts/<aggregate>/`'teki `...Props` / `...Data` tiplerine gider.

---

**Handler / Repository sorumluluk ayrımı — KURAL**:

| Katman                 | Sorumluluğu                                                                                                         | Değil                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Handler**            | İş mantığı, validasyon, karar verme, entity çözümleme (ör. patientId → isim/telefon), endTime hesabı, field mapping | Ham DB sorgusu, event üretme kararı            |
| **Repository**         | Kendi modeline ait ham DB operasyonu (create, update, find, delete)                                                 | İş kararı, koşul, birleştirme, event tetikleme |
| **TransactionManager** | `outboxRun()` ile transaction sonunda ALS'deki event'leri Outbox tablosuna atomik olarak mühürler                   | İş kararı, event içeriği belirleme             |

Örnek: Bir randevu oluşturulurken `patientId`'den hasta adının çekilmesi, `endTime` hesabı ve `doctorId → providerId`
mapping'i **handler**'ın sorumluluğundadır. Repository yalnızca hazır veriyi alıp yazar.

**Domain Entity — KURAL**:

Domain entity'ler `domain/entities/` klasöründe bulunur. Her entity şu yapıya uyar:

- Value objectler oluşturulabilir. Mevcut vo'lar kullanılır. bunlar "<name>.vo.ts" şeklinde
- Tüm field'lar `private _field` olarak tanımlanır; dışarıya yalnızca getter açılır
- Domain iş metodları (durum geçişleri, validasyon) entity içinde yaşar
- `toPersistence()` metodu entity'yi ham Prisma kaydına dönüştürür; repository'nin `update()` metodunu besler
- Static factory metodlar (ör. `calculateEndTime`) hesaplamaları entity'ye katar

**Örnek: `appointment.entity.ts`**

```typescript
import { Appointment as IAppointment } from '@model-schema/AppointmentSchema';
import {
  AppointmentStatusSchema,
  AppointmentStatusType as AppointmentStatus,
} from '@input-type-schemas/AppointmentStatusSchema';
import { ExaminationTypeType as ExaminationType } from '@input-type-schemas/ExaminationTypeSchema';
import { ExternalSystemType as ExternalSystem } from '@input-type-schemas/ExternalSystemSchema';
import { VisitTypeType as VisitType } from '@input-type-schemas/VisitTypeSchema';
import {
  AppointmentSourceSchema,
  AppointmentSourceType as AppointmentSource,
} from '@input-type-schemas/AppointmentSourceSchema';
import {
  AppointmentCreatorTypeSchema,
  AppointmentCreatorTypeType as AppointmentCreatorType,
} from '@input-type-schemas/AppointmentCreatorTypeSchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import {
  AppointmentCompletedEvent,
  AppointmentCompletedEventPayload,
} from '@modules/clinical/appointment/domain/events/complete-appointment.event';
import { AppointmentScheduledEvent } from '@modules/clinical/appointment/domain/events/schedule-appointment.event';
import { AppointmentBookedEvent } from '@modules/clinical/appointment/domain/events/book-appointment.event';
import { AppointmentCancelledEvent } from '@modules/clinical/appointment/domain/events/cancelled-appointment.event';
import { AppointmentConfirmedEvent } from '@modules/clinical/appointment/domain/events/confirm-appointment.event';
import { AppointmentRescheduledEvent } from '@modules/clinical/appointment/domain/events/reschedule-appointment.event';
import {
  CalculateEndTimeProps,
  CancelScheduleProps,
  CreateAppointmentProps,
  RescheduleByPatientProps,
  RescheduleRequestProps,
  UpdateAppointmentDetailsProps,
} from '@modules/clinical/appointment/domain/contracts/appointment.contracts';
import { AppointmentDetailsUpdatedEvent } from '@modules/clinical/appointment/domain/events/appointment-details-updated.event';
import { AppointmentCheckedInEvent } from '@modules/clinical/appointment/domain/events/appointment-checked-in.event';
import { AppointmentReminderDueEvent } from '@modules/clinical/appointment/domain/events/appointment-reminder-due.event';
import { TimeZone } from '@src/domain/value-objects/timezone.vo';
import {
  AppointmentInvalidCreationDateException,
  AppointmentInvalidTimeRangeException,
  AppointmentNotCancelledException,
  AppointmentNotCompletedException,
  AppointmentNotConfirmedException,
  AppointmentNotNoShowException,
  AppointmentNotPendingException,
  AppointmentPastDateException,
  AppointmentPatientRequiredException,
  AppointmentRescheduleWindowExpiredException,
} from '@modules/clinical/appointment/domain/exceptions/appointment.exceptions';
import { DateRange } from '@src/domain/value-objects/date-range.vo';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import { Email } from '@src/domain/value-objects/email.vo';
import { Phone } from '@src/domain/value-objects/phone.vo';
import { Guard } from '@common/domain/guards';
import { endTimeCalculator, isDefined } from '@common/utils';
import { Name } from '@src/domain/value-objects/name.vo';
import { DefaultValidateOptions } from '@common/domain/constants/default-options.constant';
import { isNotUndefined } from '@common/utils/is-not-undefined';
import { AppointmentRules } from '@modules/clinical/appointment/domain/rules/appointment.rules';
import { ValidateOptionsType } from '@shared/common/validate-options/validate-options.type';
import { Cancellation } from '@modules/clinical/appointment/domain/value-objects/cancellation.vo';

export class Appointment extends AggregateRoot {
  constructor(data: IAppointment) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._patientName = Name.fromTrusted(data.patientName);
    this._patientPhone = Phone.fromTrusted(data.patientPhone);
    this._patientEmail = Email.create(data.patientEmail).instance ?? null;
    this._timeRange = DateRange.fromTrusted(data.startTime, data.endTime);
    this._timezone = TimeZone.fromTrusted(data.timezone);
    this._treatmentType = data.treatmentType;
    this._notes = data.notes;
    this._status = data.status;
    this._checkedInAt = data.checkedInAt;
    this._reminderSentAt = data.reminderSentAt;
    this._cancellation =
      data.canceledAt && data.canceledBy
        ? Cancellation.create({
            canceledAt: data.canceledAt,
            canceledBy: data.canceledBy,
            reason: data.cancelReason,
          })
        : null;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
    this._externalSystem = data.externalSystem;
    this._externalId = data.externalId ?? null;
    this._treatmentId = UUID.create(data.treatmentId).instance ?? null;
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._providerId = UUID.fromTrusted(data.providerId);
    this._patientId = UUID.fromTrusted(data.patientId);
    this._examinationType = data.examinationType;
    this._visitType = data.visitType;
    this._isConsultation = data.isConsultation;
    this._resourceId = data.resourceId;
    this._isDeleted = data.isDeleted;
    this._deletedAt = data.deletedAt;
    this._source = data.source;
    this._creatorType = data.creatorType;
    this._approvedAt = data.approvedAt;
    this._approvedBy = data.approvedBy;
    this._createdById = data.createdById;
    this._createdByRealName = data.createdByRealName
      ? Name.fromTrusted(data.createdByRealName)
      : null;
  }

  private _cancellation: Cancellation | null;

  get cancellation(): Cancellation | null {
    return this._cancellation;
  }

  private _id: UUID;

  get id(): UUID {
    return this._id;
  }

  private _isConsultation: boolean;

  get isConsultation(): boolean {
    return this._isConsultation;
  }

  private _patientName: Name;

  get patientName(): Name {
    return this._patientName;
  }

  private _patientPhone: Phone;

  get patientPhone(): Phone {
    return this._patientPhone;
  }

  private _patientEmail: Email | null;

  get patientEmail(): Email | null {
    return this._patientEmail;
  }

  get startTime(): Date {
    return this._timeRange.startDate;
  }

  get endTime(): Date {
    return this._timeRange.endDate;
  }

  private _timeRange: DateRange;

  get timeRange(): DateRange {
    return this._timeRange;
  }

  private _timezone: TimeZone;

  get timezone(): TimeZone {
    return this._timezone;
  }

  private _treatmentType: string | null;

  get treatmentType(): string | null {
    return this._treatmentType;
  }

  private _notes: string | null;

  get notes(): string | null {
    return this._notes;
  }

  private _status: AppointmentStatus;

  get status(): AppointmentStatus {
    return this._status;
  }

  private _checkedInAt: Date | null;

  get checkedInAt(): Date | null {
    return this._checkedInAt;
  }

  private _reminderSentAt: Date | null;

  get reminderSentAt(): Date | null {
    return this._reminderSentAt;
  }

  get canceledAt(): Date | null {
    return this.cancellation?.canceledAt ?? null;
  }

  get canceledBy(): string | null {
    return this.cancellation?.canceledBy ?? null;
  }

  get cancelReason(): string | null {
    return this.cancellation?.reason ?? null;
  }

  private _createdAt: Date;

  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;

  get updatedAt(): Date {
    return this._updatedAt;
  }

  private _externalSystem: ExternalSystem | null;

  get externalSystem(): ExternalSystem | null {
    return this._externalSystem;
  }

  private _externalId: string | null;

  get externalId(): string | null {
    return this._externalId;
  }

  private _treatmentId: UUID | null;

  get treatmentId(): UUID | null {
    return this._treatmentId;
  }

  private _clinicId: UUID;

  get clinicId(): UUID {
    return this._clinicId;
  }

  private _providerId: UUID;

  get providerId(): UUID {
    return this._providerId;
  }

  private _patientId: UUID;

  get patientId(): UUID {
    return this._patientId;
  }

  private _examinationType: ExaminationType | null;

  get examinationType(): ExaminationType | null {
    return this._examinationType;
  }

  private _visitType: VisitType | null;

  get visitType(): VisitType | null {
    return this._visitType;
  }

  private _resourceId: string | null;

  get resourceId(): string | null {
    return this._resourceId;
  }

  private _isDeleted: boolean;

  get isDeleted(): boolean {
    return this._isDeleted;
  }

  private _deletedAt: Date | null;

  get deletedAt(): Date | null {
    return this._deletedAt;
  }

  private _source: AppointmentSource;

  get source(): AppointmentSource {
    return this._source;
  }

  private _creatorType: AppointmentCreatorType;

  get creatorType(): AppointmentCreatorType {
    return this._creatorType;
  }

  private _approvedAt: Date | null;

  get approvedAt(): Date | null {
    return this._approvedAt;
  }

  private _approvedBy: string | null;

  get approvedBy(): string | null {
    return this._approvedBy;
  }

  private _createdById: string | null;

  get createdById(): string | null {
    return this._createdById;
  }

  private _createdByRealName: Name | null;

  get createdByRealName(): Name | null {
    return this._createdByRealName;
  }

  // DOMAIN BUSINESS METHODS

  public get validate() {
    return {
      status: {
        isPending: (error?: Error) => this.isPending(error),
        isConfirmed: (error?: Error) => this.isConfirmed(error),
        isCancelled: (error?: Error) => this.isCancelled(error),
        isCompleted: (error?: Error) => this.isCompleted(error),
        isNoShow: (error?: Error) => this.isNoShow(error),
      },
    };
  }

  private get raiseEvent() {
    return {
      cancelled: (canceledBy: string, reason?: string): void => {
        this.addDomainEvent(
          new AppointmentCancelledEvent({
            appointmentId: this.id.value,
            clinicId: this.clinicId.value,
            providerId: this.providerId.value,
            patientId: this.patientId.value,
            patientName: this.patientName.value,
            patientPhone: this.patientPhone.value,
            patientEmail: this.patientEmail?.value ?? null,
            startTime: this.startTime,
            canceledBy,
            cancelReason: reason,
          })
        );
      },
      confirmed: (): void => {
        this.addDomainEvent(
          new AppointmentConfirmedEvent({
            appointmentId: this.id.value,
            clinicId: this.clinicId.value,
            providerId: this.providerId.value,
            patientId: this.patientId.value,
            patientName: this.patientName.value,
            patientPhone: this.patientPhone.value,
            patientEmail: this.patientEmail?.value ?? null,
            startTime: this.startTime,
          })
        );
      },
      rescheduled: (): void => {
        this.addDomainEvent(
          new AppointmentRescheduledEvent({
            appointmentId: this.id.value,
            clinicId: this.clinicId.value,
            providerId: this.providerId.value,
            patientId: this.patientId.value,
            patientName: this.patientName.value,
            patientPhone: this.patientPhone.value,
            patientEmail: this.patientEmail?.value ?? null,
            startTime: this.startTime,
          })
        );
      },
      reminderDue: (requireResponse: boolean): void => {
        this.addDomainEvent(
          new AppointmentReminderDueEvent({
            appointmentId: this.id.value,
            clinicId: this.clinicId.value,
            providerId: this.providerId.value,
            patientId: this.patientId.value,
            patientName: this.patientName.value,
            patientPhone: this.patientPhone.value,
            patientEmail: this.patientEmail?.value ?? null,
            startTime: this.startTime,
            requireResponse,
          })
        );
      },
      checkedIn: (): void => {
        this.addDomainEvent(
          new AppointmentCheckedInEvent({
            appointmentId: this.id.value,
            clinicId: this.clinicId.value,
            providerId: this.providerId.value,
            patientId: this.patientId.value,
            checkedInAt: this.checkedInAt ?? DateTimeManager.create(),
          })
        );
      },
      detailsUpdated: (): void => {
        this.addDomainEvent(
          new AppointmentDetailsUpdatedEvent({
            appointmentId: this.id.value,
            clinicId: this.clinicId.value,
            providerId: this.providerId.value,
            patientId: this.patientId.value,
          })
        );
      },
    };
  }

  public static schedule(props: CreateAppointmentProps): Appointment {
    const appointment = Appointment.create(props);
    appointment.addDomainEvent(
      new AppointmentScheduledEvent({
        appointmentId: appointment.id.value,
        clinicId: appointment.clinicId.value,
        providerId: appointment.providerId.value,
        patientId: appointment.patientId.value,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
      })
    );
    return appointment;
  }

  public static book(props: CreateAppointmentProps): Appointment {
    const appointment = Appointment.create(props);

    const now = DateTimeManager.create();

    if (DateTimeManager.isBefore(props.startTime, now)) {
      throw new AppointmentInvalidCreationDateException(props.startTime);
    }

    if (DateTimeManager.isBeforeOrEqual(props.endTime, props.startTime)) {
      throw new AppointmentInvalidTimeRangeException(
        props.startTime,
        props.endTime
      );
    }

    appointment.addDomainEvent(
      new AppointmentBookedEvent({
        appointmentId: appointment.id.value,
        clinicId: appointment.clinicId.value,
        providerId: appointment.providerId.value,
        patientId: appointment.patientId.value,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
      })
    );
    return appointment;
  }

  public static calculateEndTime({
    startTime,
    endTime,
    duration,
  }: CalculateEndTimeProps) {
    return endTimeCalculator({ startTime, endTime, duration });
  }

  private static create(props: CreateAppointmentProps): Appointment {
    const endTime = this.calculateEndTime({
      startTime: props.startTime,
      endTime: props.endTime,
      duration: props.duration,
    }).orThrow();

    const now = DateTimeManager.create();

    const dateRange = DateRange.create(props.startTime, endTime).orThrow();

    const timezone = TimeZone.create(props.timezone).orThrow().value;

    return new Appointment({
      id: UUID.createOrGenerate(props.id).value,

      patientName: props.patientName,
      patientPhone: Phone.create(props.patientPhone).orThrow().value,
      patientEmail: props.patientEmail
        ? Email.create(props.patientEmail).orThrow().value
        : null,
      patientId: UUID.create(props.patientId).orThrow().value,
      providerId: UUID.create(props.providerId).orThrow().value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      treatmentId: props.treatmentId
        ? UUID.create(props.treatmentId).orThrow().value
        : null,
      startTime: dateRange.startDate,
      endTime: dateRange.endDate,
      timezone,
      notes: props.notes ?? null,
      treatmentType: props.treatmentType ?? null,
      externalSystem: props.externalSystem ?? null,
      externalId: props.externalId ?? null,
      examinationType: props.examinationType ?? null,
      visitType: props.visitType ?? null,
      resourceId: props.resourceId ?? null,
      status: props.status ?? AppointmentStatusSchema.enum.PENDING,
      checkedInAt: null,
      reminderSentAt: null,
      canceledAt: null,
      canceledBy: null,
      cancelReason: null,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
      isConsultation: props.isConsultation,
      source: props.source ?? AppointmentSourceSchema.enum.CLINIC_INTERNAL,
      creatorType:
        props.creatorType ?? AppointmentCreatorTypeSchema.enum.CLINIC_STAFF,
      approvedAt: null,
      approvedBy: null,
      createdById: props.createdById ?? null,
      createdByRealName: props.createdByRealName ?? null,
    });
  }

  public confirm(): void {
    this._status = AppointmentStatusSchema.enum.CONFIRMED;
    this._updatedAt = DateTimeManager.create();

    this.raiseEvent.confirmed();
  }

  public cancelSchedule(props: CancelScheduleProps): void {
    this.applyCancellation(props.canceledBy, props.reason);

    this._updatedAt = DateTimeManager.create();

    // İptal event'i fırlatılır; sağlık turizmi iadesi + hasta bildirimi + audit
    // yan etkileri listener'da (AppointmentCancelledEvent) işlenir.
    this.raiseEvent.cancelled(props.canceledBy, props.reason);
  }

  /**
   * Hasta (Patient) tarafından yapılan iptal işlemi.
   *
   * NOT: Hastanın kendi iptal edip edemeyeceği (allowPatientCancel) ve iptalin
   * doğrudan mı yoksa "onay bekliyor" olarak mı işleneceği (cancelLimitHours)
   * kararı klinik ayarına bağlıdır ve handler'da verilir (settings okunur).
   * Bu metod çağrıldığında iptal fiilen uygulanır ve event fırlatılır.
   */
  public cancelBooking(patientId?: string, reason?: string): void {
    if (!patientId) {
      throw new AppointmentPatientRequiredException();
    }

    this.applyCancellation(patientId, reason);

    this._updatedAt = DateTimeManager.create();

    this.raiseEvent.cancelled(patientId, reason);
  }

  public complete(
    eventPayload: Omit<
      AppointmentCompletedEventPayload,
      'appointmentId' | 'clinicId' | 'patientId' | 'providerId'
    >
  ): void {
    this._status = AppointmentStatusSchema.enum.COMPLETED;
    this._updatedAt = DateTimeManager.create();

    this.addDomainEvent(
      new AppointmentCompletedEvent({
        ...eventPayload,
        appointmentId: this.id.value,
        clinicId: this.clinicId.value,
        patientId: this.patientId.value,
        providerId: this.providerId.value,
      })
    );
  }

  public markAsNoShow(): void {
    this._status = AppointmentStatusSchema.enum.NOSHOW;
    this._updatedAt = DateTimeManager.create();
  }

  /**
   * Hasta kliniğe geldiğinde check-in (ARRIVED). Yalnız bekleyen/onaylanan
   * randevular check-in edilebilir; geliş zamanı (bekleme sırası için) işaretlenir.
   */
  public checkIn(): void {
    const now = DateTimeManager.create();
    this._status = AppointmentStatusSchema.enum.ARRIVED;
    this._checkedInAt = now;
    this._updatedAt = now;

    this.raiseEvent.checkedIn();
  }

  /**
   * Randevu hatırlatmasını "gönderildi" olarak işaretler (aynı randevuya tekrar
   * gönderimi önler) ve dış-kanal hatırlatmasını tetikleyen event'i fırlatır.
   * `requireResponse` klinik ayarından (iki yönlü onay) taşınır.
   */
  public markReminderSent(requireResponse = false): void {
    const now = DateTimeManager.create();
    this._reminderSentAt = now;
    this._updatedAt = now;

    this.raiseEvent.reminderDue(requireResponse);
  }

  public reschedule(props: RescheduleRequestProps): void {
    this.applyReschedule({
      startTime: props.startTime,
      endTime: props.endTime,
      providerId: props.providerId,
      notes: props.notes,
      treatmentId: props.treatmentId,
    });

    this._status = AppointmentStatusSchema.enum.CONFIRMED;
    this._updatedAt = DateTimeManager.create();

    this.raiseEvent.rescheduled();
  }

  /**
   * Hasta (Patient) tarafından yapılan yeniden zamanlama. Klinik ayarındaki
   * `rescheduleLimitHours` kadar saatten az kaldıysa reddedilir ve işlem onay
   * bekliyor (PENDING) statüsüne düşürülür.
   */
  public rescheduleByPatient(props: RescheduleByPatientProps): void {
    const now = DateTimeManager.create();
    const hoursLeft = DateTimeManager.diffInHours(this.startTime, now);

    const lastRescheduleTimeForPatient = props.rescheduleLimitHours;

    const isTooLate = hoursLeft < lastRescheduleTimeForPatient;

    if (isTooLate) {
      throw new AppointmentRescheduleWindowExpiredException(
        lastRescheduleTimeForPatient
      );
    }

    const isNewTimeInPast =
      DateTimeManager.isBefore(props.startTime, now) ||
      DateTimeManager.isSame(props.startTime, now);

    if (isNewTimeInPast) {
      throw new AppointmentPastDateException();
    }

    this.applyReschedule(props);
    this._status = AppointmentStatusSchema.enum.PENDING;
    this._updatedAt = DateTimeManager.create();

    this.raiseEvent.rescheduled();
  }

  /**
   * Personel (resepsiyon) tarafından randevu "içerik" alanlarının düzenlenmesi.
   * Zaman/doktor/durum DEĞİL — yalnız hasta iletişim, not, tedavi/muayene/ziyaret türü.
   * undefined alan dokunulmaz; null gönderilen nullable alan temizlenir. Kullanıcı
   * girişi VO'larla (Phone/Email/Name/UUID) doğrulanır.
   */
  public updateDetails(props: UpdateAppointmentDetailsProps): void {
    if (isNotUndefined(props.patientName))
      this._patientName = Name.create(props.patientName).orThrow();
    if (isNotUndefined(props.patientPhone))
      this._patientPhone = Phone.create(props.patientPhone).orThrow();
    if (isNotUndefined(props.patientEmail))
      this._patientEmail = props.patientEmail
        ? Email.create(props.patientEmail).orThrow()
        : null;
    if (isNotUndefined(props.notes)) this._notes = props.notes;
    if (isNotUndefined(props.treatmentType))
      this._treatmentType = props.treatmentType;
    if (isNotUndefined(props.treatmentId))
      this._treatmentId = props.treatmentId
        ? UUID.create(props.treatmentId).orThrow()
        : null;
    if (isNotUndefined(props.examinationType))
      this._examinationType = props.examinationType;
    if (isNotUndefined(props.visitType)) this._visitType = props.visitType;

    this._updatedAt = DateTimeManager.create();

    this.raiseEvent.detailsUpdated();
  }

  public rules(validateOptions: ValidateOptionsType = DefaultValidateOptions) {
    return new AppointmentRules(this, validateOptions);
  }

  public toPersistence(): IAppointment {
    return {
      id: this.id.value,
      patientName: this.patientName.value,
      patientPhone: this.patientPhone.value,
      patientEmail: this.patientEmail?.value ?? null,
      startTime: this.startTime,
      endTime: this.endTime,
      timezone: this.timezone.value,
      treatmentType: this.treatmentType,
      notes: this.notes,
      status: this.status,
      checkedInAt: this.checkedInAt,
      reminderSentAt: this.reminderSentAt,
      canceledAt: this.canceledAt,
      canceledBy: this.canceledBy,
      cancelReason: this.cancelReason,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      externalSystem: this.externalSystem,
      externalId: this.externalId ?? null,
      treatmentId: this.treatmentId?.value ?? null,
      clinicId: this.clinicId.value,
      providerId: this.providerId.value,
      patientId: this.patientId.value,
      examinationType: this.examinationType,
      visitType: this.visitType,
      resourceId: this.resourceId ?? null,
      isDeleted: this.isDeleted,
      deletedAt: this.deletedAt,
      isConsultation: this.isConsultation,
      source: this.source,
      creatorType: this.creatorType,
      approvedAt: this.approvedAt,
      approvedBy: this.approvedBy,
      createdById: this.createdById,
      createdByRealName: this.createdByRealName?.value ?? null,
    };
  }

  private isNoShow(error?: Error) {
    const is = this._status === AppointmentStatusSchema.enum.NOSHOW;
    return Guard.monitor(
      is,
      is,
      () => error ?? new AppointmentNotNoShowException()
    );
  }

  private isCompleted(error?: Error) {
    const isCompleted = this._status === AppointmentStatusSchema.enum.COMPLETED;

    return Guard.monitor(
      isCompleted,
      isCompleted,
      () =>
        error ??
        new AppointmentNotCompletedException(this.id.value, this.status)
    );
  }

  private isCancelled(error?: Error) {
    const isCancelled = this._status === AppointmentStatusSchema.enum.CANCELLED;
    return Guard.monitor(
      isCancelled,
      isCancelled,
      () =>
        error ||
        new AppointmentNotCancelledException(this.id.value, this.status)
    );
  }

  private isConfirmed(error?: Error) {
    const isConfirmed = this._status === AppointmentStatusSchema.enum.CONFIRMED;
    return Guard.monitor(
      isConfirmed,
      isConfirmed,
      () =>
        error ??
        new AppointmentNotConfirmedException(this.id.value, this.status)
    );
  }

  private isPending(error?: Error) {
    const isPending = this._status === AppointmentStatusSchema.enum.PENDING;
    return Guard.monitor(
      isPending,
      isPending,
      () =>
        error ?? new AppointmentNotPendingException(this.id.value, this.status)
    );
  }

  /**
   * Yeniden zamanlama işlemlerinin ortak validasyon ve atama motoru (Private Helper)
   */
  private applyReschedule(props: RescheduleRequestProps): void {
    this._providerId = UUID.create(props.providerId).orThrow();

    this._timeRange = DateRange.create(
      props.startTime,
      props.endTime
    ).orThrow();

    if (isNotUndefined(props.notes)) this._notes = props.notes;
    if (isDefined(props.treatmentId))
      this._treatmentId = UUID.create(props.treatmentId).instance ?? null;
  }

  private applyCancellation(canceledBy: string, reason?: string): void {
    this._cancellation = Cancellation.create({
      canceledBy,
      canceledAt: DateTimeManager.create(),
      reason,
    });

    this._status = AppointmentStatusSchema.enum.CANCELLED;
  }
}



```

---

**Domain Entity Persistence — KURAL: Tekli vs. Toplu İşlem**:

| Senaryo                 | Yaklaşım                                                 |
| ----------------------- | -------------------------------------------------------- |
| Tekli state değişikliği | `entity.domainMethod()` → `repo.update(entity)`            |
| Toplu işlem (bulk)      | `repo.updateMany(...)` veya `repo.softDeleteAllByX(...)` |

**Tekli işlemler** her zaman entity üzerinden yapılır. Domain metodu hem invariant'ı korur hem ilgili event'i raise eder. `update()` entity'nin o anki tüm halini yazar — hangi alan değiştiğinden bağımsız tek bir metod yeterlidir.

**Toplu işlemlerde** entity pattern N+1 soruna yol açar. "Her entity için ayrı domain event/validation gerekiyor mu?" sorusu sorulur; genellikle cevap hayırdır — bu durumda doğrudan `updateMany` / `deleteMany` kullanılır ve domain bypass açıkça kabul edilir.

#### ⚠️ Toplu İşlem İstisnaları ve Güvenlik Duvarı:

- **Event Dağıtımı:** Toplu işlem sonucu sistemin geri kalanının (Read-Model, Cache, Diğer Modüller) haberdar olması gerekiyorsa, domain bypass edildiği için Command Handler içinden manuel olarak tek bir toplu event (Örn: `InvoicesBulkUpdatedEvent`) fırlatılmalıdır.
- **İlişki Kısıtı (Prisma):** `updateMany` işlemlerinin ilişkili tablolar (relations) üzerinde toplu kural işletemeyeceği, sadece düz kolon bazlı filtreleme ve atama yapabileceği unutulmamalıdır.

```typescript
// ✓ Tekli — entity pattern
const provider = await this.providerQueryRepo.findById(id);
provider.activate();
await this.providerCommandRepo.update(provider);

// ✓ Toplu — doğrudan DB (N+1 önlenir, domain bypass kabul edilir)
await this.providerCommandRepo.softDeleteAllByClinicId(clinicId);
```

---

**Command Repository API — KURAL: `create` (insert) vs `update` (güncelleme) ayrımı**:

`*CommandRepository` interface'i iki tip işlemi netleştirir:

- **`create(props)`**: Yeni kayıt **ekler** (INSERT). İlişkiler kurması gerekiyorsa (M2M, nested create), bu metod uzlaşabilir.
- **`update(entity)`**: Mevcut entity'yi **günceller** (UPDATE — `upsert` bile değil, doğrudan `update`). Veri zaten `id` taşıyor; entity domain metodları sonrası çağrılır.

Upsert yapması gereken işlemler (`findOrCreate`, auth bulun-veya-oluştur, broker login) **istisna** olarak ayrı metod (`upsertByEmail`, `findOrCreateByOAuth`) alabilir.

> **⛔ `update` ASLA `upsert` yapmaz — KESİN KURAL**
>
> `update(entity)` gövdesi **her zaman** `this.db.<model>.update({ where: { id }, data: update })` çağırır (`id` destructure edilip PK payload'dan çıkarılır). `update` içinde `upsert` **yasaktır**. Yeni kayıt her zaman `create` ile açılır.
>
> **Get-or-create / natural-key upsert gerekiyorsa ayrı, amacını söyleyen bir metod adı kullanılır** — `update` DEĞİL:
>
> | Senaryo | Metod adı |
> | --- | --- |
> | PK dışı doğal anahtarla 1:1 satellite (clinicId unique) | `upsertByClinicId(entity)` |
> | organizationId unique satellite | `upsertByOrganizationId(entity)` |
> | Bileşik doğal anahtar (clinicId + provider) | `upsertByClinicAndProvider(entity)` |
> | E-posta/OAuth bulun-veya-oluştur | `upsertByEmail(...)`, `findOrCreateByOAuth(...)` |
>
> Handler tarafında: yeni kayıt kesinse `create`; mevcut kaydın state değişimiyse `update`; "varsa güncelle yoksa oluştur" (config satellite gibi) ise `upsertBy...`.
>
> ```typescript
> // ❌ Yanlış — update upsert yapıyor
> async update(e: Foo) {
>   return this.db.foo.upsert({ where: { id: e.id }, create: data, update: data });
> }
>
> // ✓ Doğru — update yalnız günceller (upsert değil); ayrı upsert metodu doğal anahtarla
> async update(e: Foo): Promise<Foo> {
>   const data = e.toPersistence();
>   const { id, ...update } = data;
>   const raw = await this.db.foo.update({ where: { id }, data: update });
>   e.flushEvents();
>   return new Foo(raw);
> }
> async upsertByClinicId(e: Foo): Promise<Foo> {
>   const data = e.toPersistence();
>   const { id: _id, ...update } = data;
>   const raw = await this.db.foo.upsert({ where: { clinicId: data.clinicId }, create: data, update });
>   e.flushEvents();
>   return new Foo(raw);
> }
> ```

**ID GENERATION KURALI: Prisma modellerinde hiçbir zaman otomatik ID üretilmez.** Her kayıt oluşturulurken `create(props)` çağrısında `props.id` gönderilir — handler/command'de UUID.generate() ile üretilir, repository'ye geçilir.

**Her command repo `BaseCommandRepository` ile kurulur; `create`, `update`, `findById` taşır — KURAL**:

Tüm `*CommandRepository` sınıfları **`BaseCommandRepository<TEntity>`** taban sınıfını extend eder; interface'leri **`IBaseCommandRepository<TEntity>`**'den türer. `IBaseCommandRepository` **`create(props)` + `update(entity)` + `findById(id)`**'yi zorunlu kılar:

- **`create(props)`**: Yeni kayıt INSERT eder (handler UUID.generate() ile id gönderir)
- **`update(entity)`**: Mevcut entity'yi UPDATE eder (domain metodları sonrası çağrılır, `flushEvents` çağrılır)
- **`findById(id)`**: Entity yükler (state değişikliği akışında kullanılır)

Böylece "yükle → domain metodu → kaydet" akışı **tek repository** ile yürür: `const entity = await repo.findById(id); entity.activate(); await repo.update(entity);`

```typescript
// ✓ İdeal command repository interface — create/update/findById IBaseCommandRepository'den
import { IBaseCommandRepository } from '@common/domain/repositories/base-command-repository.interface';
import { Foo } from '@modules/foo/domain/entities/foo.entity';
import { CreateFooProps } from '@modules/foo/domain/foo.contracts';

export type IFooCommandRepository = IBaseCommandRepository<Foo> & {
  create(props: CreateFooProps): Promise<Foo>;
};
// ekstra metod (updateMany, bulk, upsert vb.) gerekiyorsa:
// export interface IFooCommandRepository extends IBaseCommandRepository<Foo> {
//   create(props: CreateFooProps): Promise<Foo>;
//   updateMany(entities: Foo[]): Promise<void>;
//   upsertByEmail(email: string, props: CreateFooProps): Promise<Foo>;
// }
```

```typescript
// command repo — BaseCommandRepository extend eder; create/findById/update implement
@Injectable()
export class FooCommandRepository
  extends BaseCommandRepository<Foo>
  implements IFooCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async create(props: CreateFooProps): Promise<Foo> {
    const raw = await this.db.foo.create({ data: props });
    return new Foo(raw);
  }

  async findById(id: string): Promise<Foo | null> {
    const raw = await this.db.foo.findUnique({ where: { id } });
    return raw ? new Foo(raw) : null;
  }

  async update(entity: Foo): Promise<Foo> {
    const data = entity.toPersistence();
    const { id, ...update } = data;
    const raw = await this.db.foo.update({ where: { id }, data: update });
    entity.flushEvents();
    return new Foo(raw);
  }
}
```

```typescript
// handler — yeni kayıt: create; state değişikliği: load-modify-update
// Yeni kayıt
const newFoo = await this.fooCommandRepo.create({
  id: UUID.generate().value,
  name: dto.name,
});

// State değişikliği: "yükle → metodu çağır → kaydet"
const existing = await this.fooCommandRepo.findById(fooId);
existing.activate(); // domain metodu
await this.fooCommandRepo.update(existing); // UPDATE + flushEvents otomatik
```

**`create(props)` implementasyonu** — INSERT, ilişkiler kurabilir:

```typescript
async create(props: CreateFooProps): Promise<FooEntity> {
  // props.id gelen handler'dan UUID.generate() ile gelir — hiçbir zaman auto-generate değil
  const raw = await this.db.foo.create({
    data: props,
    include: { /* ilişkiler gerekiyorsa */ },
  });
  return new FooEntity(raw);
}
```

**`update(entity)` implementasyonu** — UPDATE + flushEvents (upsert değil):

```typescript
async update(entity: FooEntity): Promise<FooEntity> {
  const persistenceData = entity.toPersistence();
  const {id, ...data} = persistenceData;
  const raw = await this.db.foo.update({
    where: { id },
    data, // id hariç (PK güncellemez)
  });
  entity.flushEvents();
  return new FooEntity(raw);
}
```

**`updateMany(entities)` implementasyonu** — Batch UPDATE:

```typescript
async updateMany(entities: FooEntity[]): Promise<void> {
  const queries = entities.map((e) => {
    const data = e.toPersistence();
    const { id, ...update } = data;
    return this.db.foo.update({ where: { id }, data: update });
  });
  if (txStorage.getStore()?.tx) {
    await Promise.all(queries);
  } else {
    await this.prisma.$transaction(queries);
  }
  entities.forEach((e) => e.flushEvents());
}
```

**`upsertByEmail(email, data)` istisna örneği** — findOrCreate:

```typescript
async upsertByEmail(email: string, data: CreateFoo): Promise<FooEntity> {
  const { id, ...update} = data
  const raw = await this.db.foo.upsert({
    where: { email },
    create: data,
    update
  });
  return new FooEntity(raw);
}
```

**İzin verilen istisnalar** — `create`/`update` dışı ekstra metod:

| İstisna                                | Örnek                                                                                | Neden                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| İlk kayıt M2M/nested create ile        | `create(props)` — `role.connect`, `managedClinics.connect`, `providerProfile.create` | `toPersistence()` scalar türetir; ilişkiler `create` data payload'ında kurulur      |
| FindOrCreate / auth bulun-veya-oluştur | `upsertByEmail(email, props)`, `findOrCreateByOAuth(provider, id)`                   | Atomik bulma + oluşturma gerekli; DB constraint (unique email) altında upsert uygun |
| Bulk işlem                             | `softDeleteAllByOrganizationId(orgId)`                                               | Entity pattern N+1; domain bypass kabul edilir                                      |
| Hot-path scalar güncelleme             | `updateLastLogin(userId)`                                                            | Entity yükleme overhead'i kabul edilemez                                            |

```typescript
// ❌ Yanlış — entity `update(entity)` varken ayrı alan-bazlı update(id, data) metodu
update(id: string, data: Partial<Foo>): Promise<Foo>; // state değişikliği için fazlalık

// ✓ Doğru — state değişikliği entity üzerinden
const foo = await this.fooCommandRepo.findById(id);
foo.activate(); // domain method
await this.fooCommandRepo.update(foo); // UPDATE

// ✓ İstisna — findOrCreate
const user = await this.userCommandRepo.upsertByEmail(email, { id: UUID.generate().value, ...props });
```

**AggregateRoot — KURAL**:

Tüm domain entity'ler `src/common/domain/aggregate-root.ts` içindeki `AggregateRoot` abstract class'ını extend eder. Bu class şu API'yi sağlar:

- `protected addDomainEvent(event: BaseEvent)` — entity domain metodundan çağrılır
- `flushEvents()` — repository `update()` sonrası çağrılır; birikmiş event'leri ALS store'a push eder ve temizler

```typescript
// Entity domain metodu — event raise eder
public activate(): void {
  this._isActive = true;
  this.addDomainEvent(new ProviderActivatedEvent({ providerId: this.id, ... }));
}

// Command repository update() — persist + flush
async update(entity: Provider): Promise<Provider> {
  const persistenceData = entity.toPersistence();
  const {id, ...data} = persistenceData;
  const raw = await this.db.provider.update({ where: { id }, data });
  entity.flushEvents();
  return new Provider(raw);
}

// Handler — sadece orchestrate eder, event bilmez
const provider = await this.providerQueryRepo.findById(id);
provider.activate();
await this.providerCommandRepo.update(provider); // flush otomatik
```

Handler asla `addDomainEvent()` veya `contextService.addEvent()` çağırmaz. Event raise etme sorumluluğu entity domain metoduna aittir.

---

**Prisma ID Policy — KURAL: Manuel ID üretimi**:

Prisma modellerinde **hiçbir zaman `@default()`** (auto-increment, cuid, uuid) kullanılmaz. Her id elle gönderilir:

```prisma
model Foo {
  id String @id @map("id")
  // ❌ ASLA: @default(uuid())
  // ❌ ASLA: @default(cuid())
  // ❌ ASLA: @default(autoincrement())
}
```

```typescript
import { DefaultValidateOptions } from '@common/domain/constants/default-options.constant';
import { shouldValidate } from '@common/domain/utils/should-validate';
import { DateTimeManager } from '@common/utils';

export class Foo extends AggregateRoot {
  // ... constructor ve property'ler ...

  public static create(
    props: { id?: string; name: string }, // ID OPSİYONEL
    options = DefaultValidateOptions
  ): Foo {

    // 🚧 Kapıdaki koruma: ID gelmişse formatını doğrula, gelmemişse jilet gibi generate et!
    const fooId = props.id
      ? UUID.create(props.id).orThrow()
      : UUID.generate();

    // Diğer iş kuralları validasyonları...
    if(shouldValidate(options))
    /*iş kuralı validasyonları */

    const now = DateTimeManager.create()

    const instance = new Foo({
      id: fooId.value,
      name: props.name,
      createdAt: now,
      updatedAt: now,
    });

    // Event fırlatma konforu
    instance.addDomainEvent(new FooCreatedEvent({ fooId: instance.id.value }));

    return instance;
  }
}
// foo.command-handler.ts
async execute(command: CreateFooCommand) {
  // 🚀 1. Nesne domain katmanında, tüm kurallara uyarak doğar
  const foo = Foo.create({
    id: command.id, // Eğer dışarıdan gelen özel bir ID varsa geçilir (örn: bulk sync), yoksa undefined kalır
    name: command.name
  });

  // 🚀 2. Repo sadece doğmuş ve zırhlanmış DOMAIN ENTITY kabul eder
  await this.fooCommandRepo.create(foo);
}

// repo.create: props.id'yi Prisma'ya direk kopyalar
// foo.prisma.repository.ts
async create(entity: Foo): Promise<Foo> {
  const data = entity.toPersistence();

  // DB'ye doğrudan zırhlı veri yazılır
  const raw = await this.db.foo.create({ data });

  // Event'ler güvenle salınır
  entity.flushEvents();

  return new Foo(raw);
}
```

**Gerekçe**: Pre-generated ID'ler (1) state consistency'yi sağlar (handler kontrol eder), (2) ID'yi bilinçli bir şekilde dağıtabilir (örn. correlation/audit), (3) Prisma automatic ID'ler ile oluşan race condition'ları ortadan kaldırır.

---

**4. Policy-Based Authorization**:

- Uses `PolicyFactory` to create policies based on `ActorContext`
- Policies provide filtering and access control
- Example: `policy.getOrganizationFilter(organizationId)`

**4. Event-Driven Architecture — Hibrit Model**:

Sistem iki kanallı çalışır. Kanal seçimi **handler**'da `TransactionManager` metodu seçilerek yapılır:

| Kanal               | Metot                            | Ne zaman                                                                 |
| ------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| **In-memory**       | `TransactionManager.run()`       | Audit log, bildirim gibi kritik olmayan event'ler                        |
| **Outbox (atomik)** | `TransactionManager.outboxRun()` | Finansal kayıt, hard delete gibi veri bütünlüğü gereken kritik event'ler |

**Akış:**

1. Handler → `contextService.addEvent(new XEvent(payload))` ile event'i ALS context'ine ekler
2. `run()` bitiminde: event'ler `EventBus.publish()` ile in-memory yayınlanır
3. `outboxRun()` bitiminde: event'ler **aynı Prisma transaction içinde** `Outbox` tablosuna `createMany` ile yazılır

**Metadata otomasyonu**: `correlationId`, `eventId`, `occurredAt` hiçbir zaman manuel set edilmez. `ContextService.addEvent()` ve `AggregateRoot.addDomainEvent()` bu alanları ALS (`txStorage`) üzerinden otomatik doldurur; `BaseEvent` constructor'ından gelen `metadata` mevcutsa o önceliklidir.

- Domain events in `domain/events/` (e.g., `ClinicSoftDeletedEvent`)
- Event publishers in `infrastructure/events/` (e.g., `clinic-event-publisher.service.ts`)
- Event listeners in `infrastructure/events/listeners/` handle side effects
- Uses `@nestjs/event-emitter` with `@OnEvent()` decorator
- Outbox schema: `src/infrastructure/persistence/prisma/schema/outbox.prisma`

**Audit Loglama — KURAL**: Loglar handler içinde yazılmaz. Her zaman aşağıdaki 3 adımlı akış izlenir:

**Adım 1 — Event sınıfı:** `modulename/domain/events/` altında oluşturulur.

```typescript
// clinic/domain/events/clinic-created.event.ts

import { CLINIC_EVENTS } from '@common/constants/events';

export interface ClinicCreatedEventPayload extends IAuditLog {
  readonly clinicId: string;
  readonly organizationId?: string;
}

export class ClinicCreatedEvent extends BaseEvent {
  static readonly NAME = CLINIC_EVENTS.CREATED;

  public readonly clinicId: string;
  public readonly organizationId?: string;

  constructor(payload: ClinicCreatedEventPayload) {
    super({
      source: payload.source,
      action: payload.action,
      details: payload.details,
      actorId: payload.actorId,
      type: payload.type,
    });
    this.clinicId = payload.clinicId;
    this.organizationId = payload.organizationId;
  }
}
```

**Adım 2 — Publisher methodu:** `modulename/infrastructure/events/` altında `contextService.addEvent()` ile publish edilir.

```typescript
// clinic/infrastructure/events/clinic-event-publisher.service
clinicCreated(payload: ClinicCreatedEventPayload) {
  this.contextService.addEvent(new ClinicCreatedEvent(payload));
}
```

**Adım 3 — Listener:** `modulename/infrastructure/events/listeners/` altında `@OnEvent()` ile dinlenir ve `AuditLogService` ile loglanır.

```typescript
// user/infrastructure/events/listeners/create.user.listener.ts
@Injectable()
export class CreateClinicListener {
  private readonly logger = new Logger(CreateClinicListener.name);
  constructor(private readonly auditLogService: AuditLogService) {}

  @OnEvent(CreateUserEvent.NAME, { async: true })
  async handle(event: CreateUserEvent) {
     const {
      actorEmail,
      log,
      metadata: { eventId, correlationId },
    } = event;

     try {
      if (log) {
        const { action, details, source, actorId, type } = log;

        const auditLogInput = {
          action,
          source,
          details,
          metadata: { eventId, correlationId },
          actorId,
        };

        if (type === LogType.SECURITY) {
          await this.auditLogService.security(auditLogInput);
          return;
        }
        } // şeklinde
  }
}
```

**Outbox Pattern — KURAL**:

**KURAL 1 — Repository izolasyonu**: `*CommandRepository` ve `*QueryRepository` sınıfları asla `Outbox` tablosuna erişemez, event fırlatamaz. Sadece kendi modelleriyle ilgili ham DB operasyonu yapar.

**KURAL 2 — Her command handler `TransactionManager` kullanır**: Tüm command handler'lar DB yazma işlemlerini ve event publishing'i `TransactionManager.run()` veya `TransactionManager.outboxRun()` içinde yapar. `TransactionManager` olmadan çağrılan `contextService.addEvent()` / `eventPublisher.*()` çağrıları event'leri ALS'e ekler ama hiç yayınlanmaz — bu sessiz bir bug'dır.

- Kritik olmayan event'ler (audit log, bildirim): `TransactionManager.run()`
- Atomik garanti gereken event'ler (finansal kayıt, hard delete): `TransactionManager.outboxRun()`

`TransactionManager`, `PrismaModule` tarafından `@Global()` olarak sağlanır — ek modül importu gerekmez, handler constructor'ına direkt inject edilir.

```typescript
// ❌ Yanlış — TransactionManager yok, event yayınlanmaz
async execute(command: CreateLeadCommand): Promise<string> {
  const lead = await this.leadCommandRepo.create(props);
  this.eventPublisher.leadCreated({ ... }); // event kaybolur
  return lead.id;
}

// ✓ Doğru
async execute(command: CreateLeadCommand): Promise<string> {
  return this.txManager.run(async () => {
    const lead = await this.leadCommandRepo.create(props);
    this.eventPublisher.leadCreated({ ... });
    return lead.id;
  });
}
```

**KURAL 2b — Kritik event'ler için `outboxRun()`**: Atomik garantisi gereken event'lerde (finansal kayıt, hard delete, vb.) handler'da `TransactionManager.outboxRun()` kullanılır. Kritik olmayan event'lerde `TransactionManager.run()` yeterlidir.

```typescript
// ❌ Yanlış — kritik bir işlemde run() kullanmak
async execute(command: ForceDeleteCommand) {
  await this.txManager.run(async () => { ... });
}

// ✓ Doğru — kritik işlemde outboxRun() kullanmak
async execute(command: ForceDeleteCommand) {
  await this.txManager.outboxRun(async () => { ... });
}
```

**KURAL 3 — Metadata otomasyonu**: `correlationId`, `eventId`, `occurredAt`, `version` alanları hiçbir zaman handler veya entity içinde manuel set edilmez. Bu alanlar `ContextService.addEvent()` ve `AggregateRoot.addDomainEvent()` tarafından ALS (`txStorage`) üzerinden otomatik doldurulur.

```typescript
// ❌ Yanlış — metadata elle set ediliyor
contextService.addEvent(
  new XEvent({ ...payload, correlationId: 'abc', eventId: uuid() })
);

// ✓ Doğru — sadece domain payload geçiliyor, metadata otomatik eklenir
contextService.addEvent(new XEvent(payload));
```

**5. GetContext Pattern**:

- Extracted via `@GetContext()` decorator in controllers
- Containst actor: ActorContext, source (Exection source) etc
- actor Contains `userId`, `organizationId`, `clinicId`, `managedClinics`, `source`, `capabilities`, `roleId`
- Passed inside commands/queries for authorization and audit

**6. Cross-Module Communication (Modüller Arası İletişim) — KURAL**:

- **Hiçbir modül diğer modülün repository'sine veya handler'ına direkt erişemez.**
- Modüller `CommandBus` / `QueryBus` üzerinden **veya** hedef modülün açtığı **domain servisi** üzerinden haberleşir (aşağıdaki tabloya bak).
- Hedef modülün query/command sınıfı import edilir; handler veya repo inject edilmez.
- `module.api.ts` / `module.api.interface.ts` pattern'i **kullanılmaz**. Modüller kendi query/command sınıflarını dışarıya açar.

**Hangi yol — KURAL**:

| İhtiyaç | Yol |
| --- | --- |
| Veri getirme (isim, telefon, liste, read-model) | **QueryBus** |
| Diğer modülün state'ini değiştirme | **CommandBus** |
| Senkron invariant kontrolü — veri dönmez, çağıranın yazmasını kapıda durdurur | **Domain servisi** (token ile inject) |
| Kimlik/kapsam çözümlemesi — skaler id (ör. `clinicId` → `organizationId`) | **Domain servisi** (token ile inject) |

**Domain servisi istisnası — dar sözleşme**:

Bir modül, başka modüllerin yazma işlemini doğrulaması için `domain/services/` altında bir servis açabilir
(ör. `CLINIC_BOOKING_SERVICE` → `assertCanBook`). Kabul koşulları:

1. **Interface + Symbol token sahibi modülün `domain/` katmanında** tanımlanır; tüketen taraf soyutlamaya bağımlıdır
   (repository token deseninin aynısı — Dependency Inversion).
2. Metotlar **yalnız `assert*`**: `void` döner ya da `DomainException` fırlatır. **Veri döndürmez, yazma yapmaz.**
   Veri lazımsa QueryBus, yazma lazımsa CommandBus kullanılır. **İki istisna: kimlik/kapsam çözümlemesi** ve
   **kilitli skaler okuma** (aşağıdaki maddeler).
3. Okuma **Command Repository**'den yapılır — bu servis bir yazmayı kapıda durdurduğu için Command Context'e aittir
   (bkz. "Command Handler'da Command Repo vs Query Repo").
4. Servis **yaprak bir modülde** (`domain/services/services.module.ts`) sağlanır ve tüketici **yalnız o modülü**
   import eder. Sahibin ana modülünü (`ClinicModule` gibi) import etmek yasaktır: controller'ları ve tüm
   handler'ları da beraberinde çeker, modül grafiğini şişirir ve döngü riski üretir.

**Gerekçe**: Bir invariant kontrolü kavramsal olarak "sorgu" değildir; `void` dönen `Assert*Query` bus'ı zorlamaktır.
Ayrıca bus üzerinden gidildiğinde okuma karşı modülün *query* handler'ına düşer ve yazma kararını besleyen okumanın
kilitsiz/replica'dan yapılması riski doğar.

```typescript
// ✓ Doğru — yaprak domain-servis modülü import edilir
imports: [ProviderDomainServicesModule, ClinicDomainServicesModule]

// ❌ Yanlış — tek servis için sahibin tüm modülü
imports: [ProviderModule, ClinicModule]
```

**Kilitli skaler okuma istisnası — `lockAndGet*`**:

Domain servisleri DTO / composite read-model döndüremez. **Tek istisna**: bir yazma kararını besleyen **kilitli**
domain durumunu, kilidi alan çağrıyla **aynı metotta** döndürmek. Koşullar:

- Metot adı kilidi görünür kılar: **`lockAndGet*`**.
- Dönüş tipi tek bir **skaler ya da Value Object**'tir — read-model, liste, entity değil.
- Okuma **Command Repository**'den ve kilit kapsamı içinden yapılır (yukarıdaki 3. madde).
- **Kilit ile okumayı ayrı metotlara bölmek yasaktır.** Bölünürse sırayı bozmak ya da kilidi atlamak derleyicinin
  göremediği bir hata olur; bakiye/sayaç kararı sessizce kilitsiz veriyle verilir. Tek atomik metot bu ihtimali
  sıfırlar.
- Yetki kontrolü **çağıran handler'ın** işidir; servis yetki değerlendirmez.

```typescript
// ✓ Doğru — kilit + okuma tek atomik metot, dönüş bir VO
@Inject(EMPLOYEE_LEAVE_ENTITLEMENT_SERVICE)
private readonly entitlementService: IEmployeeLeaveEntitlementService

const entitlement = await this.entitlementService.lockAndGetAnnualEntitlement(employeeId);

// ❌ Yanlış — kilit ve okuma ayrı; çağrı sırası derleyiciye görünmez
await this.employeeService.lockEmployee(employeeId);
const entitlement = await this.employeeService.getEntitlement(employeeId);
```

**Kimlik/kapsam çözümlemesi istisnası — `TENANT_SCOPE_RESOLVER`**:

`clinicId → organizationId` gibi **kiracı kapsamı** çözümlemesi iş verisi değil, kaydın kime ait olduğunu belirleyen
**kimlik bilgisidir**; neredeyse her yazma işleminin başında gerekir. Bu yüzden bus'tan değil, sahibin `domain/services/`
altındaki token'lı çözücüsünden alınır:

```typescript
// ✓ Doğru — token'lı çözücü; DTO/payload'ı doğrudan yutar (organizationId doluysa DB'ye gitmez)
@Inject(TENANT_SCOPE_RESOLVER)
private readonly tenantScopeResolver: ITenantScopeResolver

const organizationId = await this.tenantScopeResolver.resolve(data);
// clinicId ayrı bir alandaysa:
const organizationId = await this.tenantScopeResolver.resolve({ clinicId });

// ❌ Yanlış — her handler'da bus hop'u + elle sarmalayıcı açma + private helper kopyası
const { data: organizationId } = await this.queryBus.execute(
  new GetClinicOrganizationIdQuery(data.clinicId)
);
```

Kabul koşulları (yukarıdaki 1/3/4 aynen geçerli) + ek iki şart:

- Dönüş **skaler kimlik** olmalı (id). Read-model, isim, liste, tutar dönüyorsa bu istisna geçmez → QueryBus.
- Sözleşme (`ITenantScopeResolver`, `TenantScopeInput`) **`@shared`'te**, framework-agnostik tanımlanır; token ve adapter
  sahibin `domain/` katmanında durur. Böylece modül başka bir servise taşındığında tüketici handler'lar değişmez,
  yalnız token'a bağlanan adapter (in-process → NATS/HTTP) değişir.

DTO tarafı: `clinicId` **zorunlu**, `organizationId` **DTO'da yer almaz** — kiracı kimliği istemciden alınmaz,
`resolve()` her zaman `clinicId`'den çözer (Redis önbellekli).

`TenantScopeInput.organizationId` alanı yalnız **iç çağrılar** için durur (org zaten elde olan registration/saga
akışları) ve **kısa devre değil, doğrulama** yolundan geçer: gönderilen değer kliniğin gerçek organizasyonuyla
karşılaştırılır, uyuşmazsa `TenantScopeMismatchException` (403) fırlar.

**Neden kısa devre değil:** bu alan bir DTO'ya eklendiği anda istemci kontrolüne geçer. Gelen değer doğrudan
kabul edilseydi aktör, kendi kliniğinin `clinicId`'siyle **başka bir kiracının** `organizationId`'sini eşleştirip
kaydı o kiracının org-kapsamlı listelerine enjekte edebilirdi (yetki kontrolü klinik yarısından geçtiği için fark
edilmezdi). Doğrulamanın maliyeti önbellekli bir okumadır; kısa devrenin kazandırdığından düşüktür.

```typescript
// ✓ Doğru — org clinicId'den türetilir ve kayda O damgalanır
const organizationId = await this.tenantScopeResolver.resolve(data);
entity.create({ ...data, organizationId });

// ❌ Yanlış — istemcinin gönderdiği org kayda damgalanıyor
entity.create({ ...data, organizationId: data.organizationId });
```

**Akış**:

1. Hedef modülde işi yapacak bir query/command handler oluşturulur (örn. `FindPatientByIdQuery` + `FindPatientByIdHandler`)
2. Handler, hedef modülün `query.module.ts` / `command.module.ts`'ine kayıt edilir
3. Kaynak modülün handler'ı hedef modülün query/command sınıfını import edip bus üzerinden dispatch eder

**Örnek**:

```typescript
// ❌ Yanlış — direkt repo veya handler inject etmek
@CommandHandler(BookAppointmentCommand)
export class BookAppointmentHandler implements ICommandHandler<BookAppointmentCommand> {
  constructor(
    private patientRepository: PatientRepository, // ❌ Başka modülün repo'su
    private appointmentRepository: AppointmentRepository
  ) {}
}

// ✓ Doğru — PatientModule'de query handler oluştur
// crm/patient/application/queries/find-patient-by-id/find-patient-by-id.handler.ts
@QueryHandler(FindPatientByIdQuery)
export class FindPatientByIdHandler implements IQueryHandler<FindPatientByIdQuery> {
  constructor(
    @Inject(PATIENT_QUERY_REPOSITORY)
    private readonly patientQueryRepo: IPatientQueryRepository
  ) {}
  execute(query: FindPatientByIdQuery) { ... }
}

// crm/patient/application/queries/query.module.ts
@Module({
  imports: [CqrsModule, PatientRepositoryModule],
  providers: [FindPatientByIdHandler, ...],
  exports: [FindPatientByIdHandler, ...],
})
export class PatientQueryModule {}

// clinical/appointment/application/commands/book-appointment/book-appointment.handler.ts
// FindPatientByIdQuery sınıfını doğrudan import et; sadece QueryBus inject et
@CommandHandler(BookAppointmentCommand)
export class BookAppointmentHandler implements ICommandHandler<BookAppointmentCommand> {
  constructor(
    private readonly queryBus: QueryBus, // ✓ QueryBus üzerinden dispatch
    @Inject(APPOINTMENT_COMMAND_REPOSITORY)
    private readonly appointmentCommandRepo: IAppointmentCommandRepository
  ) {}

  async execute(command: BookAppointmentCommand) {
    const patient = await this.queryBus.execute(
      new FindPatientByIdQuery(command.patientId, command.context)
    );
    // ...
  }
}
```

### Prisma Configuration

Prisma schema and migrations are in a non-standard location:

- Schema: `apps/api/src/infrastructure/persistence/prisma/schema.prisma`
- Migrations: `apps/api/src/infrastructure/persistence/prisma/migrations/`
- Seed: `apps/api/src/infrastructure/persistence/prisma/seed.ts`
- Prisma config: `apps/api/prisma.config.ts`

**Seed Data**:

- Located in `apps/api/src/infrastructure/persistence/prisma/data/`
- Includes organizations, clinics, roles, capabilities, master treatments, sectors, languages
- Use helper utilities in `data/utils/` for seeding

### Shared Package

The `@core-crm/shared` package contains:

- **Generated Zod schemas**: Auto-generated from Prisma schema via `zod-prisma-types`
- **Module-specific schemas**: Hand-written validation schemas (e.g., `packages/shared/modules/clinic/schemas/`)
- **DTOs and interfaces**: Shared between frontend and backend
- **Common utilities**: Pagination types, etc.

### CQRS Implementation Pattern

**Example: `create-clinic.command.ts`**

```typescript
// src/modules/organization/clinic/application/commands/create-clinic/create-clinic.command.ts
import { CreateClinicDto } from '@shared/modules/clinic/dto/commands';
import { ExecutionContext } from '@src/domain/common/execution/execution-context';

export class CreateClinicCommand {
  constructor(
    public readonly dto: CreateClinicDto,
    public readonly ctx: ExecutionContext
  ) {}
}
```

**Example: `create-clinic.handler.ts`**

```typescript
// src/modules/organization/clinic/application/commands/create-clinic/create-clinic.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateClinicCommand } from './create-clinic.command';
import type { CreateClinicResponse } from './create-clinic.response';

@CommandHandler(CreateClinicCommand)
export class CreateClinicHandler implements ICommandHandler<
  CreateClinicCommand,
  CreateClinicResponse
> {
  constructor(private readonly clinicRepository: ClinicRepository) {}

  async execute(command: CreateClinicCommand): Promise<CreateClinicResponse> {
    const { dto } = command;
    const clinic = await this.clinicRepository.create(dto);
    return {
      id: clinic.id,
      name: clinic.name,
      organizationId: clinic.organizationId,
    };
  }
}
```

**Example: `create-clinic.response.ts`**

```typescript
// src/modules/organization/clinic/application/commands/create-clinic/create-clinic.response.ts
export interface CreateClinicResponse {
  id: string;
  name: string;
  organizationId: string;
}
```

**Example: `command.module.ts`**

```typescript
// src/modules/organization/clinic/application/commands/command.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CreateClinicHandler } from './create-clinic/create-clinic.handler';
import { ClinicRepositoryModule } from '../../infrastructure/persistence/prisma/clinic-repository.module';

export const CLINIC_COMMAND_HANDLERS = [CreateClinicHandler];

@Module({
  imports: [CqrsModule, ClinicRepositoryModule],
  providers: CLINIC_COMMAND_HANDLERS,
  exports: CLINIC_COMMAND_HANDLERS,
})
export class ClinicCommandModule {}
```

### Coding Conventions

**Tarih/Zaman İşlemleri — KURAL**:

- Tarih ve zaman ile ilgili tüm işlemlerde **`dayjs`** kullanılır; native `Date` metotları (`getHours`, `setMinutes`, vb.) doğrudan kullanılmaz.
- Tüm dayjs yardımcı metodları **`DateTimeManager`** sınıfı içinde static metot olarak tanımlanır (`src/common/utils/date-time.manager.ts`).
- Yeni bir tarih/zaman operasyonuna ihtiyaç duyulduğunda önce `DateTimeManager`'a metot eklenir, ardından kullanılır.

```typescript
// ❌ Yanlış — native Date veya inline dayjs kullanımı
const end = new Date(start.getTime() + 30 * 60 * 1000);
const minutes = dayjs(date).hour() * 60 + dayjs(date).minute();

// ✓ Doğru — DateTimeManager üzerinden
const end = DateTimeManager.addMinutes(start, 30);
const minutes = DateTimeManager.getDayMinutes(date);
```

---

**Repository `findMany` kuralı**:

- Repository'de çok satır döndüren her sorgu **`paginate` helper'ı** ile yazılır; `this.db.*.findMany(...)` doğrudan
  kullanılmaz.
- `paginate`, `{ items, total }` döndürür ve tutarlı sayfalama + sıralama sağlar.
- Helper: `src/infrastructure/persistence/prisma/paginate.helper.ts`

```typescript
// ❌ Yanlış
findAll(clinicId
:
string
)
{
    return this.db.appointment.findMany({where: {clinicId}});
}

// ✓ Doğru
findAll(clinicId
:
string, pagination
:
Pagination
)
{
    return paginate({
        delegate: this.db.appointment,
        pagination,
        where: {clinicId, isDeleted: false},
    });
}
```

---

**Repository `find*` dönüş tipi — KURAL: Command entity döner, Query read-model döner**:

Dönüş tipi repository'nin tarafına göre belirlenir. Kural tek cümleyle: **entity yalnız yazma tarafında yaşar.**

| Repository | `find*` dönüşü | Neden |
| --- | --- | --- |
| **Command repo** | **Domain entity** | Okunan veri üzerinde iş kuralı işletilecek, state değiştirilecek, `update()`'e verilecek — invariant'lar ve VO'lar gerekli |
| **Query repo** | **Plain model / read-model** | Veri doğrudan HTTP sınırını geçecek; entity kurup hemen sökmek boşuna iş |

- Mapping (Prisma kaydı → entity) **command** repository içinde yapılır; handler veya use-case'e sızmaz.
- Command repo'da `findMany` / `paginate` `{ items: Entity[], total: number }` döndürür.
- Query repo `@shared` generated plain model (`Lead`, `Appointment`) ya da `domain/contracts/<module>.contracts.ts`'te
  tanımlı bir read-model döndürür. `select` / `include` ile daraltılmış projeksiyonlar (ör. `ConflictingAppointment`,
  `OccupiedSlot`) da bu kontrat dosyasında adlandırılır ve interface'de açıkça belirtilir.
- **Query handler artık `toPersistence()` çağırmaz** — çağırıyorsa repo gereksiz yere entity hidrate ediyor demektir.

```typescript
// ✓ Command repo — entity döner (handler domain metodunu çağırıp update edecek)
async findById(id: string): Promise<Appointment | null> {
  const raw = await this.db.appointment.findUnique({ where: { id } });
  return raw ? new Appointment(raw) : null;
}

// ✓ Query repo — plain model döner (veri HTTP'ye gidiyor)
findById(id: string): Promise<IAppointment | null> {
  return this.db.appointment.findUnique({ where: { id } });
}

// ❌ Yanlış — query repo entity kuruyor, handler hemen söküyor (satır başına iki gereksiz dönüşüm)
// repo:    return raw ? new Appointment(raw) : null;
// handler: return { data: appointment.toPersistence() };

// ✓ Doğru — query repo'da paginate: read-model listesi
async findMany(spec: Specification<Prisma.AppointmentWhereInput>, pagination: Pagination) {
  return paginate({ delegate: this.db.appointment, pagination, where: spec.toQuery() });
}

// ✓ Doğru — projeksiyon: kontrat dosyasında adlandırılmış read-model
findConflictingAppointment(props: FindConflictingAppointmentProps): Promise<ConflictingAppointment | null> {
  return this.db.appointment.findFirst({ where: { ... }, select: { id: true, startTime: true, endTime: true } });
}
```

**Query handler'da iş kuralı gerekirse** entity hidrate edilmez; kural entity'den **bağımsız** bir yere taşınır:

- Değer hesabı/doğrulaması → **Value Object** (`LeaveBalance.calculate(...)`, `DateRange.validate.isOverlappingWith(...)`)
- Entity durumuna bağlı kural → entity'nin ürettiği **snapshot** üzerinde çalışan `*Rules` sınıfı
  (`AppointmentRules(snapshot)`) — böylece aynı kural hem command hem query tarafında, entity kurmadan işler
- Static hesap → entity static metodu (`Appointment.calculateEndTime(...)`)

---

**Parametre sayısı kuralı**:

- Bir fonksiyon veya metoda **2'den fazla parametre** geçilecekse mutlaka **obje** olarak geçilir.
- Bu kural use case `execute`, private method, repository metodu dahil tüm fonksiyonlar için geçerlidir.
- **2 veya daha az parametre** varsa tip tanımı doğrudan fonksiyon imzasında yapılır.
- **Obje parametre kullanıldığında** tip tanımı (`interface` veya `type`) mutlaka **dışarıda** tanımlanır; inline
  `}: { ... }` yazılmaz.

```typescript
// ❌ Yanlış — çok sayıda düz parametre
resolvePatient(patientId, name, phone, email)

// ❌ Yanlış — obje parametre ama tip inline
resolvePatient({patientId, dtoPatientName}
:
{
    patientId ? : string;
    dtoPatientName ? : string
}
)

// ✓ Doğru — obje geçiliyor, tip dışarıda tanımlı
interface ResolvePatientInput {
    patientId?: string;
    dtoPatientName?: string;
    dtoPatientPhone?: string;
    dtoPatientEmail?: string;
}

resolvePatient({patientId, dtoPatientName, dtoPatientPhone, dtoPatientEmail}
:
ResolvePatientInput
)
```

---

### Common Patterns

**Controllers**:

- Use `@UseGuards(AuthGuard)` for protected routes
- Extract context with `@GetContext() context: IGetContext`
- Dispatch commands via `CommandBus.execute()` and queries via `QueryBus.execute()` — inject no handlers directly
- Keep thin — no business logic, only HTTP mapping and bus dispatch

**Creating New Modules**:

1. Follow the CQRS module structure above
2. Create `command.module.ts` registering all command handlers; create `query.module.ts` for query handlers
3. Import both in the main module alongside `CqrsModule`
4. Create repository in `infrastructure/persistence/prisma/repositories/`
5. Define domain events in `domain/events/`
6. Create event listeners in `infrastructure/listeners/`
7. Register listeners in module providers array

**Path Aliases**:

- `@src/*` → `apps/api/src/*`
- `@common/*` → `apps/api/src/common/*`
- `@modules/*` → `apps/api/src/modules/*`
- `@shared` → `packages/shared`

### Infrastructure Services

**Configuration** (`InfrastructureModule`):

- PostgreSQL (Prisma)
- MongoDB (Mongoose)
- Redis (ioredis)
- BullMQ (job queues)
- Firebase Admin
- Winston logging (Betterstack/Logtail)
- Environment validation with Joi

**Global Middleware & Guards**:

- Helmet (security headers)
- CORS (configurable via `ALLOWED_ORIGINS`)
- Throttler guard (rate limiting)
- Zod validation pipe
- All exceptions filter
- Logging interceptor

**API Versioning**:

- URI-based versioning: `/api/v1/`
- Default version: `1`

## Exception Handling & Layer Discipline

**KURAL — Katman izolasyonu:**

- **Domain & Application Katmanları (Handlers, Services, Use Cases, Entities):** NestJS'in yerleşik HTTP exception sınıfları (`BadRequestException`, `NotFoundException`, `InternalServerErrorException`, vb.) **BU KATMANLARDA ASLA KULLANILAMAZ**. Bu katmanlar HTTP protokolünden ve web framework bağımlılıklarından tamamen izole olmalıdır.
- **Custom Domain Exceptions:** İş mantığı hataları için her zaman `DomainException<T>` taban sınıfından türetilmiş, amaca özel, tip güvenli hata sınıfları yazılmalıdır. Konum: `modulename/domain/exceptions/`.
- **`errorCode` merkezi sabitten gelir:** Hata kodları asla sınıf içine string literal olarak yazılmaz; tümü `src/common/constants/error-codes.constant.ts` içindeki **`ERROR_CODES`** sabitinde tanımlanır ve `ERROR_CODES.<MODULE>.<CODE>` üzerinden referans verilir (tip güvenli `ErrorCode` union).
- **Polimorfik HTTP Eşleşmesi:** Her özel hata sınıfı, ihtiyaç duyduğu HTTP durum kodunu `public override readonly httpStatus` alanı ile **kendisi** belirler. Belirtilmezse varsayılan olarak `400 Bad Request` kabul edilir. (Merkezi `errorCode → status` lookup map'i artık kullanılmaz; her exception kendi statüsünü taşır.)
- **Jenerik Metadata (Payload) Desteği:** Frontend'in hata anında akıllı kararlar alabilmesi (örneğin doluluk saatlerini listelemesi, validasyon detaylarını görmesi) için exception sınıfları strongly-typed jenerik `meta` objesi taşıyabilir.
- **Meta arayüzleri `@shared`'te tanımlanır (iki-uçlu tip güvenliği):** `meta` payload tipi exception dosyasında **local** tanımlanmaz; `@shared/modules/<module>/interfaces` altında tanımlanıp hem backend exception'ı (`extends DomainException<SlotConflictMeta>`) hem frontend (`response.meta as SlotConflictMeta`) tarafından import edilir. Local tanım yalnızca backend'i tipler; payload'ın asıl tüketicisi frontend olduğu için tip sözleşmesi tek kaynaktan (`@shared`) gelmelidir.
- **NestJS Yerleşik Exception'ları:** Sadece HTTP giriş/çıkış kapılarında (Controllers, Guards, Pipes) kullanılabilir. Tüm domain hataları merkezi `AllExceptionsFilter` tarafından yakalanıp standardize edilerek frontend'e fırlatılır.

**Taban sınıf** (`src/domain/shared/domain.exception.ts`) — polimorfik `httpStatus` + jenerik `meta`:

> Notlar: (1) `errorCode` tipi `ErrorCode` union'ıdır → ERROR_CODES'ta tanımlı olmayan bir kod yazmak **derleme hatası** verir (kural derleyici tarafından zorlanır). (2) `TMeta extends Record<string, unknown>` (`any` değil) — tüketen tarafı narrow'lamaya zorlar. (3) `TMeta` için varsayılan tip parametresi (`Record<string, never>`) sayesinde meta taşımayan exception'lar `extends DomainException` olarak (tip argümanı yazmadan) yazılabilir. (4) `HttpStatus` yalnızca sayısal bir enum (runtime framework bağımlılığı değil); status kodlarını tip-güvenli tutmak için domain'de kullanımına izin verilir.

```typescript
import { HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@common/constants/error-codes.constant';

export abstract class DomainException<
  TMeta extends Record<string, unknown> = Record<string, never>,
> extends Error {
  /** Makine-okunur hata kodu — `ErrorCode` union'ı; ERROR_CODES dışı bir kod derleme hatasıdır. */
  public abstract readonly errorCode: ErrorCode;

  /** Alt sınıf override etmezse varsayılan 400. */
  public readonly httpStatus: HttpStatus = HttpStatus.BAD_REQUEST;

  /** Frontend'in akıllı karar almasını sağlayan strongly-typed metadata. */
  public readonly meta?: TMeta;

  protected constructor(message: string, meta?: TMeta) {
    super(message);
    this.meta = meta;
    this.name = new.target.name;
    // TS down-level (extends Error) prototip zinciri düzeltmesi — instanceof güvenliği.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
```

**Merkezi hata kodu sabiti** (`src/common/constants/error-codes.constant.ts`):

```typescript
export const ERROR_CODES = {
  APPOINTMENT: {
    NOT_FOUND: 'APPOINTMENT.NOT_FOUND',
    ALREADY_BOOKED: 'APPOINTMENT.ALREADY_BOOKED',
    INVALID_DATE: 'APPOINTMENT.INVALID_DATE',
    SLOT_CONFLICT: 'APPOINTMENT.SLOT_CONFLICT',
  },
  PAYMENT: {
    INSUFFICIENT_FUNDS: 'PAYMENT.INSUFFICIENT_FUNDS',
    TIMEOUT: 'PAYMENT.TIMEOUT',
  },
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
```

### 🛠️ Örnek Mimari Uygulama (Best Practice)

**1) Basit exception** — meta yok, statü override edilmiyor (varsayılan `400`):

```typescript
// clinical/appointment/domain/exceptions/appointment.exceptions.ts
import { DomainException } from '@src/domain/shared/domain.exception';
import { ERROR_CODES } from '@common/constants/error-codes.constant';

export class AppointmentNotFoundException extends DomainException {
  public readonly errorCode = ERROR_CODES.APPOINTMENT.NOT_FOUND;

  constructor(message = 'Randevu bulunamadı.') {
    super(message);
  }
}
```

**2) Polimorfik statü + tip-güvenli payload** — kendi `httpStatus`'unu ve `meta`'sını taşır:

```typescript
// 1) Meta sözleşmesi @shared'te — backend ve frontend aynı tipi import eder
// packages/shared/modules/appointment/interfaces/slot-conflict-meta.interface.ts
export interface SlotConflictMeta {
  conflictingSlots: string[];
  suggestedNextAvailableSlot: string;
}

// 2) clinical/appointment/domain/exceptions/appointment.exceptions.ts
import { DomainException } from '@src/domain/shared/domain.exception';
import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@common/constants/error-codes.constant';
import type { SlotConflictMeta } from '@shared/modules/appointment/interfaces';

export class AppointmentSlotConflictException extends DomainException<SlotConflictMeta> {
  public readonly errorCode = ERROR_CODES.APPOINTMENT.SLOT_CONFLICT;
  public override readonly httpStatus = HttpStatus.CONFLICT; // 409

  constructor(
    meta: SlotConflictMeta,
    message = 'Seçilen randevu saatleri dolu.'
  ) {
    super(message, meta);
  }
}
```

**3) Handler içinde kullanım** (`application` katmanı — HTTP'den habersiz):

```typescript
// ❌ YANLIŞ — HTTP bağımlılığı domain/application'a sızıyor
throw new ConflictException('Saatler dolu');

// ✓ DOĞRU — saf domain hatası + tip-güvenli payload
throw new AppointmentSlotConflictException({
  conflictingSlots: ['10:00', '11:00'],
  suggestedNextAvailableSlot: '13:00',
});
```

**4) Merkezi filter** (`all-exceptions-filter`) — statü ve payload exception'ın kendisinden okunur:

```typescript
if (exception instanceof DomainException) {
  return response.status(exception.httpStatus).json({
    errorCode: exception.errorCode,
    message: exception.message,
    meta: exception.meta ?? null, // frontend strongly-typed payload'ı tüketir
  });
}
```

**Neden:** Handler/service'ler HTTP'den habersiz kalır → aynı use-case bir kuyruk işleyicisinden, CLI'dan veya başka bir bounded-context'ten çağrıldığında HTTP semantiği sızmaz. Hata kimliği `errorCode` ile sabittir, HTTP statüsü her exception'ın `httpStatus` alanında polimorfik olarak yaşar (merkezi map bakımı gerekmez) ve frontend, tip-güvenli `meta` payload'ı ile hata anında akıllı kararlar (alternatif slot önerme, validasyon detayı gösterme) alabilir.

## Finans / Muhasebe — Para Güvenliği Kuralları (KURAL)

Finans modüllerinde (`src/modules/finance/**`) aşağıdaki kurallar **derleyicinin göremediği**
ama defteri bozan hataları kapatır. Yeni finans kodu bunlara uymadan yazılmaz; denetim listesi ve
açık bulgular: `apps/api/documents/finans/09-guvence-denetimi.md`.

**1. Dönem kapısı (period gate) kilit altında okunur.** Bir fişin hangi döneme düştüğü ve dönemin
açık olup olmadığı bir **yazma kararıdır**: dönem satırı, fişin yazıldığı **aynı transaction**
içinde ve **satır kilidi altında** Command Repo'dan okunur. Dönem durumunu QueryBus/Query Repo'dan
okuyup ayrı tx'te fiş yazmak, kapanış ile fiş arasında yarış açar (kapanmış yılın mizanı değişir).

**2. Yevmiye numarası tek-UPDATE ile tahsis edilir.** `MAX(entry_no) + 1` **yasaktır** — kilitsiz
okuma iki eşzamanlı fişe aynı numarayı verir. Numara, dönem satırındaki sayaçtan
`UPDATE ... SET last_entry_no = last_entry_no + 1 ... RETURNING` ile, fişle **aynı tx** içinde
alınır; DB'de `@@unique([clinicId, periodId, entryNo])` emniyet kemeri olarak durur. Numara ayrı
bir tx'te "rezerve" edilemez: aggregate okuma hiçbir şey rezerve etmez, yalnız boşluk üretir.

**3. Koşulsuz `update(entity)` bir durum yarışını kapatmaz.** `claim*` (koşullu `updateMany`) ya da
`version` ile korunan bir aggregate'te, aynı aggregate'in **diğer** geçişleri de korunmalıdır;
aksi halde koşulsuz yazan geçiş, atomik claim'i geri alır (ör. `reopen`, `claimForClosing` ile
kapatılmış dönemi tekrar OPEN'a çeker). Bir aggregate için ya **bütün** geçişler korumalı, ya
hiçbiri.

**4. Yutulan hata retry değildir.** Kritik finansal yan etki (fiş üretimi, muhasebe köprüsü) bir
listener'da `try/catch` ile yutuluyorsa, outbox'ın at-least-once garantisi iptal olur: kayıt
`processedAt` ile kapanır ve iş **kalıcı olarak** yapılmamış kalır. Alarm (CRITICAL) tek başına
çözüm değildir; her yutulan kritik iş için (a) yeniden deneme veya (b) **backfill komutu +
"eksik kalanlar" sorgusu** bulunmak zorundadır.

**5. Takvime bağlı ön koşullar otomasyona bağlanır.** Muhasebe dönemi, vergi parametresi gibi
yıl/ay dönümünde yenilenmesi gereken kayıtlar yalnız kurulum akışında açılıyorsa, dönüm gününde
tüm yazma yolu sessizce durur. Bu kayıtlar idempotent bir zamanlanmış işle önceden açılır. **Zamanlanmış işin kapsamı "zaten kaydı olan kiracılar"dan türetilmez**: kaydı hiç olmayan (ör. normal kayıt akışından geçmeyen platform kiracısı) sonsuza dek dışarıda kalır; kapsam kaynak listeden (kiracı tablosu) ya da açıkça sayılan istisnalarla kurulur.

**6. Dönem kapanışı ön koşulsuz çalıştırılmaz.** Kapanış öncesi "fişlenmemiş ekonomik olay var mı"
kontrolü zorunludur (bkz. `documents/finans/04-muhasebe-defterler.md` §5 adım 1): dönem
kapandıktan sonra o olaylar hiç fişlenemez ve mizan kalıcı eksik kalır.

**7. Yüksek etkili finansal işlem ayrı yetki ister.** Mali yılı kapatmak, kilitli dönemi yeniden
açmak, storno, iade tavanı aşımı gibi işlemler sıradan `update` capability'siyle yapılamaz; ayrı
capability (gerekirse step-up doğrulama) ve **kalıcı damga** (kim/ne zaman: event + kolon) ister.

**8. Storno defterden kayıt silmez — rapor süzgeci `POSTED` + `REVERSED`'dir.** Ters kayıt
atıldığında orijinal fiş `REVERSED` olarak **yerinde kalır** ve etkisini storno fişi götürür;
`REVERSED` "bu fiş hiç olmadı" değil "etkisi şu fişle iptal edildi" demektir. Defter/bakiye
üreten her sorgu (mizan, kebir, yevmiye defteri, nakit akışı, KDV, mutabakat adayları) bu iki
durumu **birlikte** süzer — tek yerden: `LEDGER_EFFECTIVE_ENTRY_STATUSES`. Yalnız `POSTED`
süzmek orijinali düşürür, ters fişi bırakır ve hesap bakiyesini **ters işaretle** yanlış
gösterir. Bu hata sessizdir: ters fiş kendi içinde dengeli olduğu için "Σborç = Σalacak"
kontrolü yine tutar.

**9. Repository mapping'inde alan düşmesi sessiz veri kaybıdır.** Nested `create` içinde
alanlar tek tek yazılıyorsa (Prisma'nın `entryId` gibi alanları kendisi kurduğu için
gerekir), şemaya eklenen her yeni kolon bu listeye de eklenmek **zorundadır**. Entity'nin
hesapladığı ama mapping'in yazmadığı alan hata vermez, log üretmez ve geri getirilemez —
`original*`/`fxRate` (yabancı para izlenebilirliği) tam böyle kaybolmuştu. Para/kur taşıyan
kolonlar için mapping'i kilitleyen bir repository testi yazılır.

**10. Bir varlığın kendi değişmez kuralları, o varlık çözümlenirken zorlanır.**
Kontrolü tek bir çağrı yerine (ör. bir handler'ın satır döngüsüne) koymak, aynı varlığı çözen
diğer N−1 yolu korumasız bırakır — `isPostable` kontrolü yalnız `post-financial-event`'te
durduğu için yıl sonu kapanışı ve kambiyo farkı satırı kolektif hesaba fiş atabiliyordu.
Kural: lookup/resolver fonksiyonu varlığa **içkin** olan her koşulu (var mı, aktif mi, kullanıma
uygun mu) kendisi zorlar; yalnız **çağrı bağlamına** bağlı koşullar (ör. "bu satırda party
verilmiş mi") çağırana kalır. Okunmayan bir bayrak kolonu (`isActive` gibi) güvence değil
süstür: ya çözüm noktasında zorlanır ya da kaldırılır.

**11. Referans veri şablondan kuruluyorsa sapma raporu zorunludur.** Hesap planı, vergi
parametresi gibi şablondan üretilen kümelerde kurulum komutu idempotent olsun diye genelde
"yalnız ekler" — mevcut kayıtların niteliklerine dokunmaz. Şablon ise yaşayan bir dosyadır:
düzeltildiği an **yeni kiracılar yeni davranışı, eskiler eskisini** taşır ve fark hiçbir yerde
görünmez (ör. `requiresParty` düzeltmesi yeni kliniklerde cari zorunlu tutar, eskilerde
tutmaz → cari mutabakatı yapılamaz). Şablon ↔ fiilî durum farkını **alan alan** gösteren bir
mutabakat sorgusu bulunmak zorundadır. Otomatik onarım varsayılan değildir: geçmişi geriye
dönük yorumlayan alanlarda (hesap tipi/karakteri, vergi oranı) düzeltme muhasebe kararıdır.
Şablonun kendi tutarlılığı ise **açılışta** doğrulanır, ilk kullanımda değil.

**12. Bir değeri doğrulayan kural, o değerin kullanıldığı kuralla aynı olmalıdır.**
Aynı büyüklüğü (KDV oranı, para birimi, tutar sınırı) iki ayrı yerde tanımlamak, ikisi
uyuşmadığında **yazılabilen ama kullanılamayan** veri üretir: vergi parametresi tablosuna %8
yazılabiliyordu (0–100 kontrolü), fatura kesilirken `VatRate` VO'su onu reddediyordu
(`{0,1,10,20}`) → faturalama, sebebinden kopuk bir hatayla duruyordu. Kural: kabul kümesi **tek
bir sabitte** yaşar, hem yazma kapısı hem kullanım yeri onu import eder; kopya liste yazılmaz.
Kapı daima kullanım yerinin kabul ettiğinden **daha geniş olamaz**. Tarih-versiyonlu tablolarda
(`validFrom`/`validTo`) aralık **yarı açıktır** (`[from, to)`) ve "aynı anda en fazla bir açık
sürüm" kısıtı DB'de durur — `validTo IS NULL` üzerine kısmî unique index; uygulama kilidi ilk
sürüm henüz yokken serileştirecek satır bulamaz.

**13. "Teslim edildi" damgası, dinleyicinin bittiğini kanıtlamak zorundadır.** Outbox'ın tek
varlık sebebi kritik event'in mutlaka teslim edilmesidir; damga teslim yerine *kuyruğa atmayı*
kanıtlıyorsa araya düşen bir yeniden başlatma işi kalıcı kaybettirir ve kayıt kapalı olduğu
için kimse bakmaz. Bu yüzden domain event dinleyicileri **yalnız `@OnDomainEvent` ile**
kaydedilir (`async` + `promisify` + `suppressErrors: false`): çıplak `@OnEvent` ile dinleyici
`emitAsync` tarafından beklenmez ve fırlattığı hata framework'te yutulur (ikisi de ölçüldü;
tarama testi çıplak kullanımı engeller). **Hatayı kimin yutacağına çağıran karar verir:**
beklenen yol (outbox işçisi) yeniden dener ve sınırda **ölü mektuba** düşürür (kayıt silinmez,
CRITICAL + sorgu), beklemeyen fire-and-forget yol `emitDetached()` ile yayınlar ve hatayı çağrı
yerinde yakalar — aksi hâlde yakalanmayan promise süreci düşürür. At-least-once'ın bedeli
tüketicinin idempotent olmasıdır; kayıt **sahiplenilir** (`FOR UPDATE SKIP LOCKED` + kiralama),
yoksa iki işçi aynı event'i iki kez yayınlar. Son olarak **sıra zamanlamaya bırakılmaz**: bir
işin başka bir işten sonra olması gerekiyorsa aynı transaction'a alınır — "dinleyici sonra
çalışır" varsayımı, teslim gerçekleştiği gün bozulur (ölçüldü: commit sonrası tazelenen bir
önbellek, AI'ın hastanın yeni mesajını görmeden yanıt üretmesine yol açıyordu).

**14. Bir değişmez, uygulamada değil **saklanan veride** doğru olmak zorundadır.** Yazma anı
kontrolü yalnız o kapıdan geçen satır için çalışır: kapı yokken yazılmış satırlar için hiç
çalışmamıştır, kapıyı atlayan yol (raw SQL, veri taşıma betiği, bir `updateMany`) için de
çalışmaz. Bundan üç sonuç çıkar. (a) **Ölçü kapısı en içte durur:** para kolonu `Decimal(x,2)`
ise üçüncü basamak hata vermez, **sessizce yuvarlanır**; denge kontrolü yuvarlamadan önce ham
`Decimal`'lerde yapıldığı için uygulama `Σborç = Σalacak` görürken veritabanı bir kuruş şaşmış
fiş saklayabilir (10.005 + 89.995 = 100.00 doğrulanır, 10.01 + 90.00 = 100.01 saklanır) ve fark
fişin içinde kaldığı için mizan yine dengeli görünür. Ölçünün tanımı tek yerde yaşar
(`Money.isKurusScaled` / `Money.scale`), hatanın kimliği her katmanın kendisinde. (b) **Fiziken
imkânsız olanı kaydın önünde durdur:** bakiye kontrolü (kasa çekmecesi, stok, cari tavanı)
hesaplandığı yerde değil **yazıldığı yerde** olur ve okuması kilitli olur. Eksi bakiye kayda
girdiğinde "eksi bakiye" olarak görünmez: kasa kapanışında **uydurma gelir** (sayım fazlası →
679) ve **olmayan banka mevcudu** (yatırılmamış para → 102) olarak görünür, ikisi de dengeli fiş
ürettiği için her kontrol sessiz kalır. Aynı büyüklüğü hesaplayan formül **tek metot** olur —
kapı ile kapanış beklentisi ayrı formüllerden okunursa biri düzeltildiğinde boşluk geri gelir.
(c) **Saklanan veriye soru soran bir tarama bulunmak zorundadır:** çok satırı ilgilendiren
değişmezler (fiş başına denge) tek satırlık `CHECK` ile ifade edilemez; ifade edilebilenler
migration'a **`NOT VALID`** olarak girer (doğrulama uzun bir `ACCESS EXCLUSIVE` kilidi demektir;
ayrıca aykırı tek bir eski satır dağıtımı durdurur — oysa o bir **veri** sorunudur) ve tarama
temiz çıktığında `VALIDATE CONSTRAINT` ile tamamlanır. Tarama **onarmaz**: dengesiz bir fişi
düzeltmek muhasebe kararıdır (kural 8). Bugün: `pnpm finans:degismezler`.

**15. Uyarıya bağlanmış bir güvence, uyarının ulaştığı kanıtlanmadıkça güvence değildir.**
"Hata yutuluyor ama CRITICAL uyarı çıkıyor" cümlesi bir kalemi kapatıyorsa, o kalem artık uyarı
zincirinin sağlamlığına bağlıdır — zincir sessizce kopabilir ve kimse fark etmez. Dört yerde
kopabilir, dördü de kapatılmak zorundadır. (a) **Kanal:** uyarı kanalının yapılandırılmadığı
durumda sistem çalışmaya devam eder (uyarı göndermek iş gereksinimi değil, operasyon
gereksinimidir) ama bu seçim **sessiz yapılmaz** — açılışta duyurulur, üretimde `error`
seviyesinde, ve değişken `envs/.env.example`'da **ne işe yaradığıyla** belgelenir; yazılı olmayan
bir değişkenin eksik olduğu görülemez. Burada fail-closed yoktur: "uyarı gönderemiyorsan çalışmayı
durdur" denemez. (b) **Dinleyici:** kaydolmayan bir CQRS handler'ı uç çağrıldığında patlar, ama
kaydolmayan bir **dinleyici hiç patlamaz** (`emitAsync` sıfır dinleyiciye yayın yapar) ve bağlı
olduğu güvenceyi sessizce iptal eder; bu yüzden dinleyicilerin DI grafiğine kaydı **testle**
kilitlenir (`app.module.spec.ts`) ve yayıncı, dinleyici yoksa uyarının içeriğini log'a basar.
(c) **Altyapı servisi hatayı herkes adına yutmaz** (kural 13'ün uzantısı): yutan bir servis,
çağıranların yazdığı `catch` bloklarını ölü koda çevirir — niyet koda yazılmış ama etkisiz olur.
Servis uyarır ve **fırlatır**; yutma kararı çağıranın. (d) **Sürecin ölümü de bir uyarıdır:**
yakalanmayan bir promise reddi uçuşta olan istekleri yarıda bırakır ("para alındı, defter
yazılmadı") ve yeniden başlatma sessiz kalırsa geriye kimsenin izlemediği bir stdout satırı kalır.
Uyarı basılır, süreç **yine kapatılır** — durumu bozulmuş bir süreci ayakta tutmak para hareketine
devam etmesi demektir.

**16. Bir geçiş (kontrol) hesabı açan akış, onu kapatan akışla birlikte tasarlanır.**
"Para yolda" demek için açılan hesaplar — 108 Diğer Hazır Değerler (kart tahsilatı sağlayıcıda),
159/326 (mal geldi fatura gelmedi), 191/391 (KDV) — borç tarafı yazılıp **alacak tarafı hiç
yazılmazsa** üç hata birlikte doğar ve hiçbiri denge kontrolüne yakalanmaz: (a) geçiş hesabı
sonsuza kadar şişer (bilançoda var olmayan bir değer), (b) paranın gittiği gerçek hesap (102)
boş kalır → **banka ekstresiyle mutabakat imkânsızlaşır**, kalıcı `UNMATCHED` üretir, (c) aradaki
kesinti (komisyon) hiç gider yazılmaz → kâr sistematik olarak fazla görünür. Üçü de kendi içinde
dengeli fiş ürettiği için `Σborç = Σalacak` tutar; eksik olan bir kontrol değil, **bir ekonomik
olayın kendisidir** ve kod incelemesiyle değil **hesap bakiyesine bakarak** fark edilir. Bu yüzden:
yeni bir geçiş hesabı kullanan ilk kural yazılırken kapatan olay tipi + kuralı + komutu da
tanımlanır; kapatma akışı erteleniyorsa hangi hesabın hangi koşulda kapanacağı erteleme tablosuna
**hesap koduyla** yazılır. Kapatma tutarı ayrıca **bekleyen bakiyeyi aşamaz** (kural 14/b): aşarsa
hazır değer hesabı alacak bakiyesine düşer — imkânsız bir durum — ve karşılığında gelmemiş para
102'ye girer. Bakiye binlerce satırın toplamı olduğu için kilitlenecek bir satırı yoktur: isme
danışma kilidi (`lockConcept` + `lockAndGetAccountBalance`) tek atomik metotta tutulur.

**17. Parayı kart sahibine geri götüren her yol aynı kümülatif tavanı paylaşır ve aynı kaynak
satırını kilitler.** Üç yol vardır: iade, iptal ve ters ibraz (kart itirazı — kart sahibi bankasına
itiraz eder, sağlayıcı parayı geri keser). Üçü de aynı satışın aynı tutarına dokunur. Tavanı her yol
kendi kayıtlarından hesaplarsa (iade yalnız iadeleri, itiraz yalnız itirazları sayarsa) **her kontrol
tek başına doğrudur ve para yine de iki kez geri gider** (bir kez sağlayıcı kesintisi, bir kez bizim
iademiz): iade ≤ satış tutar, itiraz ≤ satış tutar, ama toplamları satışı aşıyor. Bu hata hiçbir
yerde görünmez — fişler kendi içinde dengeli, hiçbir alan negatife düşmüyor; kasa/banka tarafında
gerçek para kaybı olarak ortaya çıkar. Bu yüzden: tavan kapısı (`CARD_CHARGEBACK_EXPOSURE_GUARD`:
`iade/iptal + aktif itiraz + istenen ≤ tahsilat`) her geri götüren yolda **kilit altında** çağrılır ve
iki yol aynı satış satırını `FOR UPDATE` ile kilitler (`lockAndGet*` — kilit ile okuma tek metotta).
"Aktif itiraz" = açık (`OPEN`) + kaybedilmiş (`LOST`); kazanılan itirazın parası geri geldiği için
düşülmez. Yeni bir geri götüren yol (ör. başka bir ödeme sağlayıcısının iade türü) eklenirken ilk iş
bu kapıya bağlamaktır. İtiraz süresince para **doğrudan 120'ye** değil, sonuç belli olana kadar bir
ara hesapta (127) bekler; kaybedilen itiraz `REFUNDED` değil kendi durumunu (`CHARGED_BACK`) taşır —
iade geri verilen, ters ibraz geri **alınan** paradır ve hasta borcu yerinde durur.

**18. Sağlayıcı çağrısının sonucu üç durumludur: oldu / olmadı / bilinmiyor.** Dış sağlayıcıya para
geri götüren (iade) ya da para hareketi başlatan her çağrı üç sonuçtan birini verir ve ikisi
birbirine karıştırılamaz. (a) **Adaptör ham SDK sonucunu değil tipli sonucu döner**
(`SUCCEEDED | REJECTED | UNKNOWN`): iyzico iş hatasında **fırlatmaz** (`status:'failure'` ile
çözülür), sonucu okumayan kod "iade tamamlandı" yazıp ters fişi atar ve para dönmemiştir —
hata ne `catch`'e düşer ne bir kontrole yakalanır, çünkü fiş kendi içinde dengelidir.
Taşıma hatası (zaman aşımı, bağlantı kopması) sağlayıcıda **başarı olabilir**: `UNKNOWN`'dur,
"olmadı" değil. (b) **`UNKNOWN` yalnız elle doğrulamayla kapanır ve otomatik yeniden denenmez**:
yeniden denemek parayı iki kez geri götürür. Ters fiş yalnız `SUCCEEDED`'da yazılır; "iade edildi"
demek yanlış beyandır, yazmamak **bilinen** bir eksikliktir ve alarmla insana gider. Doğrulanmamış
satır "eksik kalanlar" sorgusunda görünür (kural 4) ve operatörün sağlayıcı panelinde arayacağı
tekrar-güvenli anahtarı (`${id}:${attempt}`) taşır. (c) **İdempotent olay dedupe'u sahiplenme
değildir**: `dedupeKey` mevcut kimliği sessizce döner ("zaten vardı" bilgisini vermez) ve okuma-sonra-
yazma kilitsizdir; ikinci iade çağrısını engelleyen şey iade SATIRININ unique kısıtıdır. (d) Para
hareketi başlatan satır sağlayıcı çağrısından ÖNCE kalıcı yazılır (kısa tx), çağrı tx DIŞINDA yapılır,
sonuç ayrı kısa tx'te `PENDING && girişim eşleşiyor` koşuluyla yazılır (kural 3): araya giren akışın
sonucu ezilmez.

## Important Notes

### Database Migrations

- Always run migrations from `apps/api` directory
- After schema changes, run `pnpm prisma:generate` to regenerate client and Zod schemas
- Zod schemas are generated to `packages/shared/generated-zod/`

### Multi-Tenancy

- Most entities are scoped to an `Organization`
- Use `PolicyFactory` to enforce organization-level access control
- Actor context provides organization filtering

### Event Sourcing

- Events are published after successful database operations or after security problems for logging
- Listeners handle side effects (audit logging, notifications, cascading deletes)

### Required Environment Variables

Check `apps/api/src/infrastructure/infrastructure.module.ts` for required env vars:

- `DATABASE_URL` (PostgreSQL)
- `MONGODB_URI`
- `REDIS_URL`
- `ADMIN_EMAIL`
- `BETTERSTACK_TOKEN`
- `PORT` (defaults to 8080)
- `ALLOWED_ORIGINS` (comma-separated, defaults to `http://localhost:3000`)

### Working with Sectors

The application supports multiple sectors: `ALL`, `DENTAL`, `HAIR_TRANSPLANT`, `AESTHETICS`. Entities like Clinic,
Provider, and treatments are sector-specific.

### Firebase Integration

Firebase Admin SDK is used for authentication. Configuration file should be at `firebase-sdk.json` (excluded from git).

## DTO, Schema, Types

The shared package (`packages/shared`) serves as the **Single Source of Truth** for validation, types, and DTOs. It ensures
synchronization between the Backend (NestJS) and Frontend (Next.js/React).

### Folder Structure — KURAL

For each module in `packages/shared/modules/{moduleName}/`, organize schemas, types, and DTOs by **commands and queries**:

```
modules/{moduleName}/
  schemas/
    commands/
      create-{entity}.schema.ts
      update-{entity}.schema.ts
      delete-{entity}.schema.ts
      index.ts                    # Barrel export
    queries/
      find-{entity}.schema.ts
      index.ts
    index.ts                       # Barrel export for all schemas
  types/
    commands/
      create-{entity}.type.ts
      update-{entity}.type.ts
      delete-{entity}.type.ts
      index.ts                    # Barrel export
    queries/
      find-{entity}.type.ts
      index.ts
    index.ts                       # Barrel export for all types
  dto/
    commands/
      create-{entity}.dto.ts
      update-{entity}.dto.ts
      delete-{entity}.dto.ts
      index.ts                    # Barrel export
    queries/
      find-{entity}.dto.ts
      index.ts
    index.ts                       # Barrel export for all DTOs
  interfaces/
    {entity}-response.interface.ts # API response contracts
    index.ts
```

**Example: User Module Structure**

```
modules/user/
  schemas/
    commands/
      create-user.schema.ts
      change-user-password.schema.ts
      update-user-by-actor.schema.ts
      send-user-password-reset-by-actor.schema.ts
      index.ts
    queries/
      check-email.schema.ts
      index.ts
    index.ts
  types/
    commands/
      create-user.type.ts
      change-user-password.type.ts
      update-user-by-actor.type.ts
      send-user-password-reset-by-actor.type.ts
      index.ts
    queries/
      check-email.type.ts
      index.ts
    index.ts
  dto/
    commands/
      create-user.dto.ts
      change-user-password.dto.ts
      update-user-by-actor.dto.ts
      send-user-password-reset-by-actor.dto.ts
      index.ts
    queries/
      check-email.dto.ts
      index.ts
    index.ts
  interfaces/
    user-response.interface.ts
    index.ts
```

### Implementation Pattern

**1. Schema (schemas/commands/create-appointment.schema.ts)**

Avoid importing directly from `@prisma/client` to prevent frontend crashes.

```typescript
import { z } from 'zod';

export const CreateAppointmentSchema = z.object({
  patientId: z.string().uuid(),
  providerId: z.string().uuid(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED']).default('PENDING'),
});
```

**2. Type (types/commands/create-appointment.type.ts)**

Never write types manually; always infer from schema:

```typescript
import { z } from 'zod';
import { CreateAppointmentSchema } from '../../schemas/commands';

export type CreateAppointment = z.infer<typeof CreateAppointmentSchema>;
```

**3. DTO (dto/commands/create-appointment.dto.ts)**

Used exclusively by NestJS Backend for `@Body()` or `@Query()` decorators:

```typescript
import { createZodDto } from 'nestjs-zod';
import { CreateAppointmentSchema } from '../../schemas/commands';

export class CreateAppointmentDto extends createZodDto(
  CreateAppointmentSchema
) {}
```

**4. Response Interface (interfaces/appointment-response.interface.ts)**

Lightweight definitions for Frontend consumption:

```typescript
import { CreateAppointment } from '../types/commands';

export interface AppointmentResponse {
  id: string;
  startTime: Date;
  endTime: Date;
  status: string;
  patientName: string;
  providerName: string;
}
```

### Barrel Exports (index.ts) — KURAL

Every folder must have an `index.ts` to allow clean imports:

```typescript
// modules/user/types/commands/index.ts
export type { CreateUser } from './create-user.type';
export type { ChangeUserPassword } from './change-user-password.type';
export type { UpdateUserByActor } from './update-user-by-actor.type';

// modules/user/types/queries/index.ts
export type { CheckEmail } from './check-email.type';

// modules/user/types/index.ts
export * from './commands';
export * from './queries';

// modules/user/index.ts (main entry point)
export * from './schemas';
export * from './types';
export * from './dto';
export * from './interfaces';
```

### Usage Examples

**Backend (NestJS)**:

```typescript
import { CreateUserDto } from '@shared/modules/user/dto/commands';
import type { CreateUser } from '@shared/modules/user/types/commands';
```

**Frontend (React)**:

```typescript
import type { UserResponse } from '@shared/modules/user/interfaces';
```

### Important Considerations

**1. Prisma Enum Conflict**

- Frontend cannot import from `@prisma/client`
- Solution: Define enums in shared package as Zod Enum
- Backend Prisma will auto-map string values

**2. Build Artifacts**

- Add `*.js`, `*.js.map`, `*.d.ts` to `.gitignore` (except `node_modules`)
- Generate build artifacts only during deployment

**3. No Frontend Dependencies**

- Never import NestJS-specific packages (decorators, guards, etc.) in shared schemas
- Keep shared package framework-agnostic

## Cross-Module Data & Relationship Rules

### 1. Modüller Arası Veri Paylaşımı ve Sorgu Sınırları (Bounded Context)

**Kural:** Hiçbir modül, veritabanı düzeyinde (Prisma `include`/join vb.) başka bir modülün ilişkisel tablolarına sızamaz. Deep nesting (`include: { clinic: { include: { ... } } }`) kesinlikle YASAKTIR.

**Yöntem:** Eğer bir modül (örn: `User`), başka bir modüle ait veriye (örn: `Clinic`) ihtiyaç duyuyorsa, sorgu sonucundan sadece ilkel kimliği (`clinicId`) almalı ve hedef modülden veriyi bağımsız olarak talep etmelidir. TSQueryBus (src/common/cqrs/type-safe-query-bus.ts) kullanabilirsin.

```typescript
// ❌ Yanlış — başka modülün DB ilişkilerine sızmak (Sınır İhlali)
const user = await this.prisma.user.findUnique({
  where: { id: userId },
  include: {
    clinic: {
      include: {
        address: true, // User modülü Clinic ilişkilerini bilmemeli
      },
    },
  },
});

// ✓ Doğru — kendi modülünden ID al, diğer modülü QueryBus ile sorgula
const user = await this.userQueryRepo.findById(userId);
const clinicDetails = await this.queryBus.execute(
  new GetClinicDetailsQuery({ clinicId: user.clinicId })
);
```

#### ✅ Onaylanmış Altyapı İstisnası (Intentional Trade-off)

**Kural:** "Modüller arası veri paylaşımı yasaktır" kuralının **tek ve mutlak istisnası**, Auth Guard katmanında çalışan `findForAuth` (veya benzeri ActorContext inşa eden) merkezi altyapı sorgularıdır.

- **Gerekçe:** Her HTTP isteğinde tetiklenen Auth Guard'ın performansını korumak ve veritabanı gidiş-dönüş (I/O) maliyetini düşürmek adına, aktörün yetki sınırlarını çizen ilişkisel kimlikler tek bir sorguda `include` edilmelidir.

```typescript
// src/modules/identity/auth/infrastructure/persistence/auth.repository.ts
// Bu sorgu, performans darboğazını engellemek için kasıtlı olarak birleşik yazılmıştır.
async findForAuth(firebaseUid: string) {
  return this.db.user.findFirst({
    where: { id: firebaseUid, status: GlobalStatus.ACTIVE },
    include: {
      managedClinics: { select: { id: true } },     // Sadece ID - Sınır ihlali yapmıyor
      ownedOrganizations: { select: { id: true } }, // Sadece ID - Sınır ihlali yapmıyor
      providerProfile: { select: { id: true } },
      role: {
        include: {
          capabilities: { include: { capability: true } }, // Yetki ağacı tek seferde çözülür
        },
      },
    },
  });
}
```

### 2. ID Yönetimi ve Veritabanı Bağımsızlığı (Pre-Generated IDs)

**Kural:** Çoklu modül barındıran orkestrasyon/Saga işlemlerinde, veritabanının auto-increment veya işlem sonrası ID üretmesi beklenmeyecektir.

**Yöntem:** Gerekli tüm benzersiz kimlikler (UUID), işlemin en tepesinde (Handler katmanında) `UUID.generate()` ile peşinen üretilir ve alt servislerine dikte edilir.

**Kazanç:** Modüller arası bağımlılık zinciri kırılır, `if (!id) throw` kontrolleri elenir, asenkron Outbox loglaması güvenli hale gelir.

```typescript
// ✓ Doğru — ID'leri handler'da üret, servislere ilet
async execute(command: RegisterClinicCommand) {
  const generatedClinicUUID = UUID.generate();
  const generatedAdminUserUUID = UUID.generate();

  await this.txManager.outboxRun(async () => {
    await this.clinicCommandRepo.create({ id: generatedClinicUUID.value, ... });
    await this.commandBus.execute(
      new CreateUserCommand({ id: generatedAdminUserUUID.value, clinicId: generatedClinicUUID.value, ... })
    );
  });
}
```
