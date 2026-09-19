# CQRS Handler'ları DI Grafiğine Bağlı Değil — Bulgu Raporu

**Tespit:** 2026-08-25, Duffel uçuş entegrasyonu sırasında.
**Durum:** Sağlık turizmi zinciri düzeltildi ✅ · Diğer dikeyler **açık** 🔴

---

## Sorun

Nest'te `@CommandHandler` / `@QueryHandler` dekoratörü tek başına yetmez: `CqrsModule`'ün
explorer'ı handler'ı ancak **DI grafiğindeki bir modülün `providers` dizisinde** bulursa
kaydeder. Bu projede pek çok dikeyde `*CommandModule` / `*QueryModule` tanımlı ama
**hiçbir yerden import edilmiyor**; dolayısıyla handler'lar konteynere hiç girmiyor ve
controller'ın bus'a yaptığı dispatch çalışma zamanında handler bulamıyor.

`TSCqrsModule` (`packages/nest-kernel/src/common/cqrs/type-safe-cqrs.module.ts`) düz bir
`CqrsModule` sarmalayıcısıdır — otomatik keşif **yoktur**.

Bu bir derleme hatası vermez: `tsc` temiz geçer, testler geçer, sorun yalnız çalışan
uygulamada görünür.

## Doğru desen

Repoda zaten var — `organization/project`:

```
ProjectModule
  └── ProjectPresentationModule
        ├── ProjectApplicationModule → ProjectQueryModule + ProjectCommandModule
        └── controllers
```

## Düzeltilen (bu turda)

`crm/health-tourism` alt ağacının tamamı:

- `hotel.module.ts` → `HotelApplicationModule` + `HotelInfrastructureModule`
  (import'ları `224cee35` "Grup 8 — proje yönetimi" commit'inde silinmiş, muhtemelen
  yanlışlıkla)
- `transfer.module.ts` → aynısı (dosya `@Module({})` boş kabuktu)
- yeni `hotel/application/application.module.ts` ve `transfer/application/application.module.ts`
- `config/presentation` → command + query modülleri
- `booking-payment/presentation` → command + query modülleri
- `health-tourism.module.ts` → `HealthTourismConfigModule` + `BookingPaymentModule`
  (ikisi de hiçbir yerden import edilmiyordu)
- yeni `flight` modülü baştan doğru bağlandı

## Açık kalan (ayrı iş)

Aynı kopukluk en az şu modüllerde sürüyor — repo-geneli tarama gerekir:

| Modül | Durum |
| --- | --- |
| `LeadCommandModule` / `LeadQueryModule` | import edilmiyor |
| `AppointmentCommandModule` | import edilmiyor |
| `ClinicCommandModule` | import edilmiyor |
| `ClinicPaymentGatewayApplicationModule` | import edilmiyor |
| `PhysicalPosApplicationModule` | import edilmiyor |

Tarama komutu:

```bash
cd apps/api
for f in $(find src/modules -name "command.module.ts" -o -name "query.module.ts" \
           -o -name "application.module.ts"); do
  cls=$(grep -o "export class [A-Za-z]*" "$f" | awk '{print $3}')
  n=$(grep -rn "$cls" src --include "*.ts" | grep -v "$f" | wc -l | tr -d ' ')
  [ "$n" = "0" ] && echo "BAĞLI DEĞİL: $cls ($f)"
done
```

## Önerilen kalıcı koruma

Boot anında (veya bir spec içinde) her `*Command` / `*Query` sınıfının kayıtlı bir
handler'ı olduğunu doğrulayan smoke test. Böyle bir kontrol olmadan aynı regresyon
sessizce tekrar girebilir — nitekim `224cee35`'te girmiş ve aylarca fark edilmemiş.
