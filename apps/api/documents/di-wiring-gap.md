# CQRS Handler'ları DI Grafiğine Bağlı Değil — Bulgu Raporu

**Tespit:** 2026-08-25, Duffel uçuş entegrasyonu sırasında.
**Kapsam ölçüldü + tamamı onarıldı:** 2026-09-19, hesap planı incelemesi sırasında.
**Durum:** KAPANDI ✅ — 304 kayıtsız provider → 0; uygulama ayağa kalkıyor; kalıcı test eklendi.

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

| Modül                                   | Durum            |
| --------------------------------------- | ---------------- |
| `LeadCommandModule` / `LeadQueryModule` | import edilmiyor |
| `AppointmentCommandModule`              | import edilmiyor |
| `ClinicCommandModule`                   | import edilmiyor |
| `ClinicPaymentGatewayApplicationModule` | import edilmiyor |
| `PhysicalPosApplicationModule`          | import edilmiyor |

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

---

## Kapanış (2026-09-19)

### Kök neden

`99472fe5` ("changes", 2026-08-09) **266 modül dosyasına** dokunup her `X.module.ts`'in
application/altyapı import'larını silmiş, geriye yalnız presentation modülünü bırakmış:

```diff
-@Module({ imports: [FirebaseModule, PrismaModule, UserCommandModule,
-                    UserQueryModule, UserPresentationModule, UserEventModule] })
+@Module({ imports: [UserPresentationModule] })
 export class UserModule {}
```

Derleyici görmez (import'lar zaten silinmiş, kimse referans vermiyor), testler geçer
(hepsi handler'ı elle `new` ile kurar), uygulama açılır — hata yalnız ilgili uç
çağrıldığında `QueryHandlerNotFoundException` olarak çıkar.

### Ölçüm

|                                         | önce    | sonra                            |
| --------------------------------------- | ------- | -------------------------------- |
| Kayıtsız handler / dinleyici / AI aracı | **304** | **0**                            |
| Yetim `*CommandModule` / `*QueryModule` | 67      | 0                                |
| `/` kökünde çakışan controller          | 45      | 0 (yalnız NATS RPC controller'ı) |

### Yapılanlar

1. **64 modül import'u** 28 feature modülüne geri bağlandı; `SubscriptionModule` hiç
   `AppModule`'de değildi, eklendi; `RoleModule` tamamen boştu (`@Module({})`).
2. Modülüne hiç yazılmamış 5 provider kaydedildi — aralarında **hasta girişini**
   besleyen `FindPatientByFirebaseUidHandler`, **ekonomik olay → yevmiye fişi**
   köprüsü `FinancialEventRecordedListener` ve kullanıcı pasifleşince yetki
   önbelleğini düşüren `CleanAuthCacheOnUserUpdatedListener`.
3. Sınıf olarak inject edilen ama yalnız token ile sağlanan 6 bağımlılık token'a
   çevrildi (`ContextService`, `ClinicCacheService`, `SubscriptionCacheService`,
   `PolicyFactory`, `IyzicoProvider`, `FirebaseService`).
4. `ClinicInfrastructureModule` sağlamadığı bir token'ı dışa açıyordu; kaldırıldı.
5. **RouterModule ön ekleri**: `APP_ROUTES` girişleri `module:` ile feature modülünü
   gösteriyordu ama controller'lar artık `XPresentationModule`'da; Nest ön eki yalnız
   **listelenen modülün kendi** controller'larına uygular. Sonuç: 45 controller `/`
   kökünde çakışıyordu. Tüm girişlere `children: [XPresentationModule]` eklendi;
   hiç rotası olmayan üç modüle (`leaves`, `attendance`, `consent-forms`) giriş
   açıldı; ön eki elle yazdığı için ikizlenen 4 controller sadeleştirildi
   (`/pos/pos/pax` → `/pos/pax`, sağlayıcı geri çağrısı dahil).

### Kalıcı koruma

`apps/api/src/app.module.spec.ts` — altyapı gerektirmeyen (provider üretmeyen) üç kontrol:

1. Modül grafiği kurulabiliyor mu (geçersiz export, döngüsel/eksik modül).
2. Her provider'ın constructor bağımlılığı kendi modül bağlamında çözülebiliyor mu.
3. Kaynak ağacındaki her `@CommandHandler`/`@QueryHandler` grafikte kayıtlı mı.

Bu üçü olmadan aynı regresyon yine sessizce girebilirdi.
