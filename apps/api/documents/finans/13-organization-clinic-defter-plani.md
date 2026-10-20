# 13 — Organization / Clinic Defter Sahipliği ve Muhasebe Uygulama Planı

Tarih: 2026-10-20. Durum: **tasarım ve uygulama iş listesi; henüz uygulanmadı**.

Bu belge kullanıcının onayladığı yönü somutlaştırır. Mevcut Prisma şeması,
endpoint'ler ve generated istemci bu tasarımı henüz desteklemez. Aşağıdaki model,
alan, capability ve endpoint adları öneridir; çalışan sözleşmeler gibi kullanılmaz.

İlgili belgeler: [frontend uygulama planı](../../../web/docs/finance-implementation-plan.md),
[API eksikleri](../../../web/docs/frontend-api-endpoint-gaps.md),
[mevcut finans durumu](./12-durum-devri.md).

## 1. Kesinleşen ürün kapsamı

- Organization şirket/üst yönetim kapsamını, Clinic klinik operasyonunu temsil eder.
- Klinik tek başına bir şirket olabilir ve kendi muhasebesini tutabilir.
- Bir organization'a bağlı birden fazla klinik aynı şirketin şubesi olabilir.
- Klinik gerektirmeyen merkez geliri, gideri, banka hesabı ve ödemeleri olabilir.
- Franchise klinikler desteklenir. Bağlılık, muhasebe sahipliği, tahsilat ve veri
  paylaşımı DB'de birbirinden bağımsız, doğrulanmış politikalarla tanımlanır.
- Organization ve Clinic ana iş varlıkları olarak korunur. Muhasebe sahipliğini
  bunlardan birine bağlayan teknik aggregate `AccountingBook` olur.

| Senaryo                                     | Defter sahibi         | Operasyon ve raporlama                          |
| ------------------------------------------- | --------------------- | ----------------------------------------------- |
| Bağımsız şirket olan klinik                 | Clinic                | Kendi defteri, dönemleri ve hesap planı         |
| Aynı şirketin klinik şubeleri               | Organization          | Ortak defter; şube/maliyet merkezi kırılımı     |
| Şirket merkezi                              | Organization          | Klinik seçmeden merkez işlemi                   |
| Organizasyon altında ayrı klinik şirketleri | İlgili Clinic'ler     | Ayrı defter; yetkili birleşik yönetim raporu    |
| Franchise ağı                               | İlgili hukuki işletme | Sözleşmeye bağlı erişim, tahsilat ve hesaplaşma |

Franchise olmak tek başına defter sahibini belirlemez. Faturayı düzenleyen
mükellef, hizmet veren klinik ve parayı tahsil eden işletme ayrı olabilir.

## 2. Mevcut koddan doğrulanan başlangıç noktası

| Kanıt                                                   | Bugünkü davranış                                         | Tasarım etkisi                                                       |
| ------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| `schema/accounting.prisma`                              | Account ve AccountingPeriod clinicId zorunlu             | Hesap planı, dönem ve sayaç book kapsamına taşınır                   |
| `schema/journal-entry.prisma`, `financial-event.prisma` | Event/fiş sahibi Clinic                                  | Defter kimliği kaynak klinikten ayrılır                              |
| `schema/organization.prisma`                            | Org finans ayarında yalnız subscriptionBillingTarget     | Platform aboneliği ayarı muhasebe yönlendirmesi olarak kullanılmaz   |
| `schema/governance.prisma`                              | Klinik VKN ve legalType taşır                            | Org sahibi deftere de mükellefiyet profili gerekir                   |
| `local-tenant-scope.resolver.ts`                        | Tenant organizationId klinikten çözülür                  | Merkez işlemlerinde clinicId gerektirmeyen yetkili çözümleme gerekir |
| `post-financial-event.handler.ts`                       | Fonksiyonel para GetClinicCurrencyQuery ile çözülür      | Fonksiyonel para ve mali takvim book'tan çözülür                     |
| `get-journal-entries.handler.ts`                        | Klinik erişimi kontrol edilip org filtresiyle listelenir | Seçilen kapsamın repository'ye eksiksiz taşınması P0 iştir           |
| Web `module-route-page.tsx`                             | Finans rotaları ortak demo tabloya gider                 | Gerçek ekranlar feature bazında bağlanır                             |

Yalnız clinicId alanını nullable yapmak bu geçişi tamamlamaz. Unique kısıtlar,
row lock'lar, yetkilendirme, cache, outbox, fatura kimliği ve tüm raporlar aynı
defter sınırını kullanmalıdır. Para temsili mevcut Decimal/Money yaklaşımında kalır.

## 3. Önerilen DB modelleri

### 3.1 AccountingBook — muhasebe defteri

| Alan                           | Anlamı                                                 |
| ------------------------------ | ------------------------------------------------------ |
| id                             | Uygulamada üretilen UUID                               |
| organizationId                 | Defterin tenant/yönetim sınırı                         |
| ownerType                      | ORGANIZATION veya CLINIC                               |
| ownerClinicId                  | Yalnız CLINIC sahibi için zorunlu                      |
| code, name                     | Tenant içinde benzersiz kod ve görünen ad              |
| status                         | DRAFT, ACTIVE, ARCHIVED; arşivlenmiş defter okunabilir |
| functionalCurrency             | Defterin fonksiyonel para birimi                       |
| timezone, fiscalYearStartMonth | Dönem sınırlarının tek kaynağı                         |
| version                        | Yönetim komutlarında optimistic concurrency            |

DB invariant'ları:

1. ORGANIZATION sahibi için ownerClinicId NULL; CLINIC için NOT NULL olur.
2. ownerClinicId'nin organizationId'si defterin organizationId'siyle eşleşir.
   Composite FK veya eşdeğer DB kısıtıyla korunur; yalnız UI kontrolüne bırakılmaz.
3. `(organizationId, code)` tekildir. Bir sahibin geçmiş/aktif birden fazla
   defteri olabilir; kullanılacak defter tarihli yönlendirmeyle seçilir.
4. İlk mali belge veya FinancialEvent kabulünden sonra fonksiyonel para ve mali
   takvim yerinde değiştirilmez; asenkron posting'in tamamlanması beklenmez.
   Yeni defter ve kontrollü geçiş gerekir. Defter sahibi geriye dönük değiştirilmez.

`BookTaxProfileVersion`, mükellefin unvanı, ülke/vergi kimliği, vergi dairesi,
legalType ve belge seri yapılandırmasını tarihli tutar. Klinik operasyonel
ayarları ortak book'un vergi kimliğini override edemez. Düzenlenen belgede
kullanılan profil sürümü ve satıcı bilgileri snapshot olarak saklanır.

### 3.2 OrganizationFinanceDefaults — operasyonel varsayımlar

Mevcut OrganizationFinanceSettings genişletilir; bu bölümdeki
OrganizationFinanceDefaults adı bu modelin operasyonel varsayımlar rolünü anlatır,
ikinci bir paralel ayar tablosu gerektirmez. İndirim, hatırlatma, taksit ve otomatik
fatura gibi operasyonel varsayımları taşır. `subscriptionBillingTarget` kendi
anlamını korur.

Her alanın miras alma/override kuralı açıktır. Nullable override alanında NULL
"org varsayımını kullan", false/0 gerçek değer anlamına gelir. Para birimi,
mükellefiyet, mali yıl ve defter sahipliği bu miras mekanizmasına dahil değildir.
Miras alınan ayarın etkili değeri, kaynağı ve sürümü API'de gösterilir.
Mali karar doğuran etkili değerler, kullanılan org varsayımı ve tahsilat politikası
sürümüyle birlikte karar anında mühürlenir. Eski/bekleyen işler güncel org
ayarlarından yeniden indirim/taksit/fatura/tahsilat kararı üretmez.
Mevcut clinic defaultCurrency işlem para birimi tercihi olarak değerlendirilebilir;
book'un fonksiyonel parasını değiştirmez. Vergi oranlarının otoritesi tarihli
TaxParameter/ilgili vergi kontratıdır; ikinci, bağımsız bir serbest KDV ayarı açılmaz.

### 3.3 ClinicFinanceConfiguration — tarihli muhasebe yönlendirmesi

`clinicId`, `accountingBookId`, `collectionPolicyId`, `validFrom`, `validTo`,
`version` ve operasyonel override'ları taşır. Organization'ın merkez işlemi
kullanacağı asıl defter için de tarihli `OrganizationBookAssignment` bulunur.

ClinicFinanceSettings içindeki mevcut değerler ilk konfigürasyon sürümüne alınır.
Geçişte eski okuma sözleşmesi compatibility mapping ile korunur; aynı operasyonel
ayarın iki tabloda bağımsız güncellendiği kalıcı bir yapı oluşturulmaz.

- Aralıklar `[validFrom, validTo)` biçimindedir; validTo boşsa açık uçludur.
- Aynı klinik için geçerli yönlendirmeler çakışamaz. Postgres exclusion constraint
  için gerekiyorsa btree_gist uzantısı migration önkoşulu olarak değerlendirilir.
- OrganizationBookAssignment için de `(organizationId, kullanım amacı, tarih
aralığı)` çakışmazlığı ve tarih başına tek hedef zorunludur.
- İşlem tarihine uygun tek kayıt bulunmalıdır. Eksik/çakışan ayarda güncel deftere
  sessiz fallback yapılmaz.
- Sahiplik/defter geçişi genel settings PATCH'iyle yapılmaz; expectedVersion,
  effectiveFrom, gerekçe ve devir kontrolü alan ayrı command kullanılır.
- Kullanılmış sürümler değiştirilmez. Yeni sürüm oluşturulur; retroaktif değişim
  kayıtları yeniden sahiplenemez.

Bir sonraki sürümü açarken önceki sürümün açık validTo sınırını kontrollü kapatmak
izinli yönlendirme metadata işlemidir. Bu işlem mevcut mali kayıtların mühürlü
referansını değiştirmez; kullanılmış ekonomik tarihleri kapsama dışına itemez.
Eski sınırı kapatma ve yeni sürümü açma aynı transaction/kilit altında yapılır.

### 3.4 ClinicOrganizationAffiliation ve FranchiseAgreement

Affiliation `clinicId`, `relatedOrganizationId`, `relationshipType`
(BRANCH/INDEPENDENT/FRANCHISE), `validFrom`, `validTo`, `version` taşır.
Clinic.organizationId tenant sınırını korur. Franchise markasıyla ilişki kurmak
kliniği başka tenant'a taşımaz ve defter erişimi vermez.

FranchiseAgreement tarafları, tarihleri, varsa merkez payı/royalty koşullarını,
hesaplama temelini ve hesaplaşma periyodunu tutar. Hesaplama temeli açık enum'dur
(örneğin NET_SALES veya NET_COLLECTIONS); oran tek başına yeterli değildir.
İade/iptal, vergi ve komisyonların tabana etkisi sözleşme sürümünde belirtilir.
Bu sözleşme şartları otomatik tahakkuk motoru implementasyonu sayılmaz.

### 3.5 CollectionPolicy ve FinanceAccessGrant

CollectionPolicy LOCAL/CENTRAL/MIXED kullanımını, paranın faydalanıcı defterini,
izinli banka/POS/kasa kaynaklarını ve hesaplaşma kuralını tanımlar. MIXED modda
işlem düzeyindeki tahsilat kanalı/faydalanıcı açıkça belirlenir.

FinanceAccessGrant kullanıcı, rol veya yetkili organization için hedef book,
izinli işlem kapsamı, veri kapsamı (FULL_BOOK/COST_CENTER/AGGREGATE_ONLY) ve
geçerlilik tarihlerini taşır. Bir principal için tür/kimlik eşleşmesi doğrulanır.
Grant, capability kontrolünün yerine geçmez; ikisi birlikte gerekir.

Grant geçerliliği isteğin yürütüldüğü anda değerlendirilir; raporun asOf tarihi
erişim yetkisini geçmişe döndürmez. Ekonomik tarih muhasebe yönlendirmesini,
istek zamanı erişim yetkisini belirler. İptal/sona erme sunucuda uygulanır ve
ilgili cache/kapsam seçimlerini geçersizleştirir.

- Franchise bağlantısı veya organization üyeliği otomatik tam defter erişimi vermez.
- AGGREGATE_ONLY erişimi satır, hasta, banka veya fiş detayına dönüşmez.
- COST_CENTER erişimi merkez giderlerini ve diğer şubeleri açmaz. Birden fazla
  merkez içeren fişte yetkisiz satırlar üzerinden toplam sızıntısı önlenir.
- Grant yönetimi ayrı yönetim yetkisi ister; kullanıcı kendi kapsamını yükseltemez.

### 3.6 CostCenter ve dağıtımlar

CostCenter book'a aittir; HEAD_OFFICE/CLINIC/OTHER türündedir. CLINIC türü bir
klinik referansı taşır. Finansal olayın sourceClinicId'si menşe bilgisidir;
maliyet merkezi ise raporlama boyutudur. İkisi eş anlamlı değildir.

Belge satırındaki `DocumentCostAllocation`, hedef merkezler ve dağıtım tutarlarını
tutar. Posting bu dağıtımı JournalLine.costCenterId boyutuna uygular. Dağıtılan
tutar kaynak satıra tam eşittir; kuruş farkları Money kurallarıyla deterministik
dağıtılır. Merkezde bırakılan pay HEAD_OFFICE olarak görünür. Dağıtım ek bir gider
fişi üretmez ve aynı gideri iki kez saydırmaz.

## 4. Kaydın defterinin çözülmesi

1. Yetkili actor ve operasyonun tenant sınırı doğrulanır.
2. Klinik işlemi için occurredAt tarihindeki ClinicFinanceConfiguration;
   merkez işlemi için OrganizationBookAssignment bulunur.
3. Belgenin hukuki düzenleyeni ve kullanılan ödeme kaynağı doğrulanır.
4. İşleme accountingBookId, aşağıda tanımlanan yönlendirme referansı,
   sourceClinicId ve ilgili profil/sözleşme/etkili ayar sürümleri mühürlenir.
   İstemcinin book ID'si yetki yerine geçmez.
5. Dönem kapısı ve satır kilitleri bu book kapsamında çalışır; ekonomik olay
   mevcut outboxRun transaction'ında atomik yazılır.
6. Posting güncel ayarlardan yeniden defter seçmez; olayın mühürlü book'unu,
   defter parasını ve ekonomik tarihini kullanır.

Yönlendirme referansı serbest polimorfik bir string değildir. `routingSource`
CLINIC ise yalnız `clinicConfigurationVersionId`, ORGANIZATION ise yalnız
`organizationAssignmentVersionId` doludur. CHECK ve gerçek FK'lerle XOR, book,
tenant ve kaynak klinik eşleşmesi korunur. Doğrudan defter işlemlerinde (örneğin
manuel açılış fişi) EXPLICIT_BOOK kaynağı ve boş routing FK'leri kullanılabilir;
handler seçilen book yetkisini ve dönemi ayrıca doğrular. Teknik kapanış fişi
event taşımıyorsa kaynağı kendi book/period kimliğidir. Geçmiş sürüm referansları
ve belge snapshot'ları yeni bir profile/yönlendirmeye yeniden bağlanmaz.

Muhasebe kayıtlarında accountingBookId zorunludur. sourceClinicId merkez kaydı
için NULL olabilir. clinicId klinik-bağlı işlemlerde zorunlu kalır; randevu/hasta
gibi operasyonel alanlar topluca nullable yapılmaz. Eski clinicId'nin her modelde
sahiplik mi menşe mi olduğu migration envanterinde ayrı kararlaştırılır.

İade, storno, iptal, gecikmiş callback ve yeniden fişleme orijinal işlemin
book'unu korur. İade kendi ekonomik tarihinde uygun açık döneme yazılır.
Eski ayara ait gecikmiş event'in yeni book'a düşmesi engellenir.

## 5. Merkez tahsilatı ve defterler arası hesaplaşma

- Aynı book içindeki şubeler arası aktarım bir defter içi işlemdir; yeni şirket
  geliri oluşturmaz.
- Farklı book'lar arasında `InterBookSettlement` / ortak operationId altında
  taraf başına ayrı, dengeli event ve fiş gerekir. Her book kendi dönemini ve
  yetkisini doğrular; bir taraf başarıp diğer taraf sessizce kaybolamaz.
- Bugünkü eventId→tek fiş unique kuralı korunur. İki book'a aynı eventId ile iki
  fiş yazılmaz; tarafların ayrı eventId ve ortak operationId'si olur.
- Merkezin franchise adına topladığı tutar hak sahibine borç/aktarılacak tutar
  olarak izlenir. Komisyon/royalty ayrı gelir olayıdır. Kesin hesap eşleşmeleri
  ilgili iş paketiyle belirlenir; bu belge yeni posting kuralı uygulamaz.
- Aynı DB'deki iki taraf atomik işlemle ve outbox'la yürütülebilir. Dış sağlayıcı
  sonucunun bilinmediği durumlarda mevcut üç durumlu doğrulama yaklaşımı korunur.

## 6. Etkilenen şema ve backend parçaları

| Parça                               | Hedef değişim                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| Account                             | `(accountingBookId, code)` unique; book'a ait hesap ağacı                     |
| AccountingPeriod                    | `(accountingBookId, year)` unique; book takvimi ve dönem sayacı               |
| FinancialEvent / JournalEntry       | accountingBookId ve orijinal routing sürümü; isteğe bağlı kaynak klinik       |
| JournalLine                         | Hesap/cari/merkez aynı book'a ait; kur ve orijinal tutarlar korunur           |
| TaxParameter                        | Book kapsamı; tarihli parametre ve açık sürüm unique kuralı                   |
| Party                               | Kaynak kimlik korunur; cari ve bakiye book kapsamında ayrı                    |
| Invoice / PurchaseInvoice           | Düzenleyen/muhatap book, belge snapshot'ı, dağıtım ve vade/ödeme bağlantıları |
| Bank / Cash / POS / Gateway         | Hukuki kaynak sahibi book; kullanılabilir klinikler ayrı yetki/atama          |
| ProviderSettlement / CardChargeback | Orijinal tahsilat book'u ve kaynak ödeme izleri                               |
| FinanceLedger                       | Operasyonel özet kaynağı; şirket muhasebesinin yerine kullanılmaz             |
| Payroll / Inventory köprüleri       | Operasyonel klinik korunur; muhasebe book'u ve maliyet merkezi çözülür        |

Özellikle taşınacak unique sınırları: party origin anahtarı, alış faturası
tedarikçi+fatura no anahtarı, provider settlement referansı, chargeback case
referansı ve yevmiye numarasıdır. Gerçek sağlayıcı referansının global unique
olduğu yerlerde kapsam keyfi daraltılmaz; idempotency semantiği ayrıca denetlenir.

Raw SQL de taranır: `tax_parameters_open_version_key` bugün `(clinic_id,key)`
üzerinde partial unique index'tir. Row lock SQL'leri, rapor sorguları, backfill
script'leri ve finans invariant taramaları Prisma şemasına bakarak kendiliğinden
güncellenmiş sayılmaz.

Domain/application uygulaması repository token'ları, CQRS ve mevcut katman
kurallarıyla yapılır. Command kararı için yönlendirme/grant/dönem Command Repo'dan
aktif transaction içinde okunur. Birden fazla lock varsa deterministik sıra
kullanılır. Tenant resolver ile accounting scope resolver ayrı sorumluluklardır.

## 7. API ve response sözleşmeleri

- Yeni kaynaklar için `/api/v1/accounting/books` ve tarihli yapılandırma
  command'leri önerilir. Kesin gap kayıtları frontend endpoint belgesindedir.
- Mevcut rapor/fiş/dönem/kasa/banka endpoint'leri explicit accountingBookId ile
  genişler; aynı operasyon için paralel bir book endpoint ailesi açılmaz.
- Klinik ve organization uyumluluk uçları geçişte korunabilir. Klinik→book
  çözümleme sunucuda yetkiyle yapılır; tarihsel raporda güncel routing tek başına
  yeterli değildir. Dönemde kullanılan birden fazla book açıkça gösterilir.
- Seçim URL/Zustand'da tutulur. Sunucudaki actor'u değiştiren genel bir scope
  mutation'ı veya güvenilmeyen header üzerinden yetki genişletme gerekmez.
- Tek book yazma hedefidir. accountingBookIds veya reportGroupId yalnız yetkili
  çoklu-defter okumasıdır; consolidation komut hedefi olamaz.
- QueryResponse.data plain/read-model döner. Para decimal string, sıra no string,
  tarih ISO string olarak belgelenir. Serialization ile çıkarılan alanlar frontend
  tarafından mevcut varsayılmaz; görünürlük grupları kullanılır.
- Create command ID; basit update void; sürümlü update yalnız yeni version;
  dış sağlayıcı/workflow command'i gereken minimum metadata döndürür.
- Değişiklik DTO→OpenAPI→Orval zinciriyle üretilir; generated elle düzenlenmez.

Fiş detayında book, tür, satırlar, hesap kod/adı, cari, maliyet merkezi, kaynak
belge/event, döviz ve storno bağlantıları bulunmalı. Yetki detay sorgusunda da
uygulanmalı; listeyi görebilmek tüm book'a erişim anlamına gelmez.

## 8. Raporların anlamı

1. **Defter raporu:** Bir şirketin/bağımsız kliniğin book'unun tamamı.
2. **Şube performansı:** Aynı book'un maliyet merkezi dağılımı. Dağıtılmamış merkez
   payı ayrıca görünür; bu rapor tam şirket bilançosu diye adlandırılmaz.
3. **Ağ yönetim raporu:** Erişim verilen defterlerin açıkça seçilmiş metrikleri.
4. **Konsolidasyon:** ReportGroup üyeleri, tarihli kapsam, raporlama para birimi,
   hesap eşleştirmesi ve defterler arası eliminasyon politikası olan ayrı query.

Franchise üyeliği konsolidasyona otomatik dahil olma anlamına gelmez. Ayrı
para birimleri keyfi toplanmaz. Tahsilat, faturalanan hasılat ve muhasebe kârı
aynı KPI olarak gösterilmez. Her rapor kapsam, tarih ve para birimini taşır.

## 9. Veri koruyan migration sırası

| Adım | İş                                                                  | Tamamlanma koşulu                                                         |
| ---- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| M0   | Şema/SQL/event/endpoint envanteri, mevcut mizan ve bakiye ölçümleri | Başlangıç kayıt sayıları, borç/alacak ve kur/tutarları kayıtlı            |
| M1   | Yeni modeller ve önce nullable book/routing alanları                | Eski uygulama davranışı korunur; migration henüz otomatik uygulanmaz      |
| M2   | Her mevcut klinik için ayrı legacy book ve ilk yönlendirme          | Tarihsel kayıtların tamamı tek, doğrulanmış book'a eşlenir                |
| M3   | Scope verisini denetlenebilir şekilde backfill                      | Event payload/ID/dedupe ve fiş/account/period ID'leri korunur             |
| M4   | Tüm write/read/queue/callback yollarını book kapsamına geçirmek     | Tek kayıt tek book'a yazar; bekleyen eski event'ler doğru book'u kullanır |
| M5   | Yeni FK/unique/check doğrulaması, karşılaştırmalı raporlar          | Mizan, bakiye, orijinal para ve storno etkisi eskiyle aynı                |
| M6   | NOT NULL ve eski sahiplik bağımlılığını daraltmak                   | Scope'suz write yolu kalmaz; eski istemci davranışı belgelenir            |
| M7   | İstenen org-owned book'ları ve geçişleri etkinleştirmek             | Her geçiş tarihli, mutabakatlı, açık kapanış/açılış sürecine sahip        |

FinancialEvent uygulamada append-only kalır. Bir kerelik migration backfill'i
yalnız yeni sahiplik metadata'sını doldurur; ekonomik payload'ı yeniden yazmaz.
Mevcut kaynaklardan güvenle çıkarılamayan tarih/sahiplik bilgisi uydurulmaz.

Organization'a bağlı diye eski klinik defterleri birleştirilmez. Mevcut
dedupeKey'ler yeniden adlandırılmaz; event'ler kopyalanmaz. Çift book'a muhasebe
yazan dual-write yapılmaz. Eski ve yeni read karşılaştırmaları salt okunur olabilir.

Geri dönüş M1–M3'te additive kalabilir. Yeni book'ta mali kayıt üretildikten sonra
rollback eski fişleri silmek anlamına gelemez; yeni yazma durdurulup kontrollü
ileriye düzeltme/devir uygulanır. Migration hazırlama, uygulama ve constraint
doğrulama adımları ayrı işlerdir; bu plan migration çalıştırma talimatı değildir.

## 10. Uygulanabilir iş paketleri

| Sıra  | İş paketi                                                                   | Bağımlılık ve kabul kriteri                                         |
| ----- | --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| B0    | Yevmiye clinic scope hatası, auth/clinic context ve OpenAPI drift envanteri | Başka kliniğin satırı gelmez; mevcut finans testleri korunur        |
| B1    | Book/config/affiliation/grant domain kontratları ve additive şema           | Sahiplik/kapsam/aralık invariant'ları; migration taslağı            |
| B2    | Legacy mapping/backfill ve finans ölçümleri                                 | Eski book bakiyeleri kuruşu kuruşuna eşit                           |
| B3    | Scope resolver, dönem, hesap/cari ve posting geçişi                         | Org merkez işlemi clinic zorlamaz; retry orijinal book'u korur      |
| B4    | Operasyonel köprüler ve açık HTTP scope sözleşmeleri                        | Tahsilat/fatura/kasa/banka aynı sahiplik kararını kullanır          |
| B5    | Query/read-model, book dizini, fiş detayı ve API generation                 | Typed/minimal response; yetki/serialization ve filtre kapsamı doğru |
| W1    | Gerçek web kapsamı + read-only book/rapor dikey dilimi                      | DB→policy→HTTP→generated→ekran uçtan uca doğrulanır                 |
| W2    | Hasta tahsilatı, gider/ödeme allocation, kasa ve banka                      | Mükerrer gider/tahsilat yok; kaynak ile defter mutabık              |
| B6/W3 | Merkez tahsilatı, franchise sözleşmesi ve iki defterli hesaplaşma           | Tarafların dengeli kayıtları ve açık bakiye mutabakatı              |
| B7/W4 | Açılış/manüel fiş, sabit kıymet, kredi/sermaye, yıl sonu ve e-belge         | Eksik posting/use case/adapter'lar ayrıca tamamlanır                |

İlk dikey dilim B0–B5'in gerekli temeliyle bir legacy klinik book'unu yetkili
olarak listeleyip mevcut raporu gerçek web ekranında göstermektir. Organization
merkez işlemi ve franchise akışı eklenmeden ilgili modlar kullanılabilir gösterilmez.

## 11. Doğrulama senaryoları

- Aynı organization içinde iki ayrı clinic book'u: A yetkilisi B satırını,
  tutarını, arama sonucunu veya cache'ini göremez.
- Bir org book'u, iki klinik merkezi ve dağıtılmamış merkez gideri: toplam gider
  dağıtım öncesi/sonrası aynı; şube toplamları + merkez payı book toplamını verir.
- Klinik sahibi ve org sahibi defter CHECK/FK ihlalleri DB'de reddedilir.
- Geri tarih, effectiveFrom sınırı, boşluk, çakışma ve eşzamanlı config değişimi
  tek ve deterministik book seçimine yol açar; optimistic conflict kaybolmaz.
- Yönlendirme değiştikten sonra eski callback/outbox replay/iade/storno doğru
  eski book'a ve doğru ekonomik tarihin dönemine gider; mükerrer fiş oluşmaz.
- Franchise aggregate erişimi ham hareket, IBAN, hasta veya başka book yazma
  yetkisi vermez; salt üyelik erişim için yeterli değildir.
- Merkezi tahsilat ve iki defterli settlement tekrarı taraflardan birinin
  kaydını eksik veya çift oluşturmaz. Bir taraf kapalı dönemse atomik davranış
  veya açıkça izlenen workflow durumu doğrulanır.
- Kasa gideri + alış faturası + tedarikçi ödeme aynı maliyeti iki kez giderleştirmez.
- Migration öncesi/sonrası dönem, fiş, hesap, event sayıları ve mizan/bakiyeler
  eşittir; mevcut kur/original\* kolonları ve storno etkisi korunur.
- Web'de book/klinik/rol değişimi açık formdaki eski hedefi sessizce kullanmaz;
  hassas cache ve eski response görünmez; maskelenmiş alan 0 kabul edilmez.

Bu tur yalnız planlama belgelerini oluşturur. Prisma şeması, migration,
handler, generated istemci ve canlı/veri tabanı davranışı değiştirilmez.
