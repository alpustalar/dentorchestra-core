# @dentorchestra/nest-kernel

Backend uygulamalarının (`apps/api`, `apps/messaging`) paylaştığı **NestJS'e bağlı**
ortak çekirdek: tip-güvenli CQRS bus'ları, `ExecutionContext`/`GetContext`, `AggregateRoot`
ve event altyapısı, Value Object'ler, `DateTimeManager`, kripto servisleri ve Mongo
persistence katmanı.

## Neden `packages/shared` değil

`packages/shared` framework-agnostic olmak **zorunda**: onu `apps/web` (Next.js) tüketiyor
ve CLAUDE.md orada NestJS paketlerini yasaklıyor. Buradaki kodun göbeği ise `@nestjs/common`,
`@nestjs/cqrs`, `@nestjs/mongoose`'a bağlı. İkisi aynı pakette olsaydı frontend build'i
NestJS'i çekmeye çalışırdı.

Kural: **`apps/web` bu paketi asla import etmez.** Zod şeması, DTO, salt tip gibi
framework'süz sözleşmeler `packages/shared`'a gider; NestJS'e dokunan her şey buraya.

## Ne buraya girer, ne girmez

| Girer | Girmez |
| --- | --- |
| Birden fazla backend app'in ihtiyaç duyduğu altyapı | Tek bir modüle özgü kod |
| Framework'e bağlı ortak soyutlamalar (bus, decorator, base sınıflar) | İş kuralı, domain entity, handler |
| Veritabanı-**bağımsız** transaction/event mekanizması | Prisma'ya özgü repository/servisler (`apps/api`'de kalır) |

Son satır önemli: `TransactionContext.tx` bilerek `unknown` tiplenmiştir. Prisma'ya
tiplenseydi tüm event mekanizması `@prisma/client`'a zincirlenir ve Mongo kullanan
messaging servisi bu paketi kullanamazdı.

## Nasıl tüketilir

Path alias ile — paket `main`/`types` alanı taşımaz. Tüketen app'in tsconfig'i:

```jsonc
"@common/*": ["src/common/*", "../../packages/nest-kernel/src/common/*"],
"@src/*":    ["src/*",        "../../packages/nest-kernel/src/*"]
```

Dizi sırası önemli: app'in kendi dosyası varsa o kazanır, yoksa çekirdeğe düşer.
`apps/api` için bu bir geçiş kolaylığıdır (62 dosya taşınırken tek bir import satırı
değişmedi). Yeni app'ler alias'ı **tek hedefe** bağlamalı — böylece çekirdekte olmayan
bir şeye uzanmak derleme hatası verir, sessiz bir bağımlılık değil.

## Standalone tip-kontrolü

```bash
pnpm --filter @dentorchestra/nest-kernel typecheck
```

Paket `apps/api`'ye hiç erişmeden derlenir. Bu bir süsleme değil, ayrılmanın ön koşuluydu:
`packages/shared`'ın üretilmiş zod şemaları eskiden `@prisma/client`'ı import ediyordu ve
üretilmiş client npm paketinde değil `apps/api/generated/prisma` içinde yaşıyor — yani
çekirdek `Role`/`User` tiplerini alabilmek için app'in içine uzanmak zorundaydı.

Çözüldü (2026-08-08): Prisma şeması yerinde kaldı, ama üretilen zod çıktısı artık kendi
tiplerini kullanıyor. `apps/api/scripts/clean-generated-zod.cjs` (bölüm 2) `prisma generate`
sonrası çalışır ve `@prisma/client` import'larını söker; sonunda hâlâ Prisma kalırsa
**sesli patlar** (jenerator çıktısı değişirse sessizce geri gelmesin diye).
