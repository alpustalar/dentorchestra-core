# Finans ve muhasebe frontend uygulama planı

Durum: **Kısmen uygulandı.** İlk klinik kapsamlı muhasebe raporu, dönem yönetimi, hesap planı/mutabakat, klinik defteri (tahsilat/iade/gider), kasa (oturum/hareket/kapanış), banka (hesap/ekstre importu/oto-eşleştirme/mutabakat), satış faturası ve bordro tahakkuk (liste/detay/yazma) ekranları eklendi; organizasyon/defter kapsamı ve global gerçek auth entegrasyonu bekliyor.
İnceleme tarihi: 2026-10-21.
Bu belge mevcut kaynak koduna dayanır; canlı HTTP veya tarayıcı doğrulaması yapıldığı anlamına gelmez.
Bu frontend çalışması API, veritabanı şeması ve migration'ları değiştirmez; generated
istemci çalışan API'nin güncel OpenAPI sözleşmesinden yeniden üretilir.

## 1. Amaç ve model kararı

Uygulama, tek başına şirket olan kliniği, aynı şirkete bağlı çok sayıda şubeyi,
şirket merkezinde yürütülen finansı ve franchise kliniklerini desteklemelidir.
Hukuki defter, operasyonun gerçekleştiği klinik ve maliyet dağılımı ayrı kavramlardır.
Backend tasarımının kaynağı: [Organization / clinic defter planı](../../api/documents/finans/13-organization-clinic-defter-plani.md).

- `organizationId` tenant sınırıdır; aynı organizasyondaki bütün klinikler aynı şirket/defter kabul edilmez.
- Önerilen `AccountingBook`, `ownerType: ORGANIZATION | CLINIC` taşır; `ownerClinicId` yalnız `CLINIC` sahibinde bulunur.
- Defterin şirket kimliği/vergi profili, fonksiyonel para birimi, zaman dilimi ve mali yıl ayarları deftere aittir.
- İlk mali belge/event kabulünden sonra fonksiyonel para ve mali takvim yerinde değişmez; asenkron posting penceresi bu sınırı ertelemez.
- Kliniğin `BRANCH | INDEPENDENT | FRANCHISE` ilişkisi, geçerlilik tarihli defter yönlendirmesi ve `LOCAL | CENTRAL | MIXED` tahsilat politikası ayrı ayarlardır.
- Organizasyon varsayılanları operasyonel ayarlardır. Klinik override'ı defterin hukuki/vergi alanlarını değiştiremez.
- `sourceClinicId`, merkezi işlemlerde boş olabilen operasyon kaynağıdır; satır bazında maliyet merkezi dağılımının yerine geçmez.
- Tahsilatı alan kurum ile gelirin hukuki sahibi ayrı seçilebilir; franchise üyeliği finans verisine erişim vermez.
- Mevcut kayıtlar klinik başına bir legacy defterle taşınır; yeni ortak defter seçimi geçmişi sessizce birleştirmez.

## 2. Bugünkü frontend ve sözleşmeler

| Bulgu                                                                               | Kaynak                                                                                                                                                                     | Uygulamaya etkisi                                                         |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Finans alt rotalarının tamamı aynı demo tabloya gidiyor                             | [module-route-page.tsx](../src/components/layout/dashboard/module-route-page.tsx), satır 29; [module-table.tsx](../src/components/module-table/module-table.tsx), satır 88 | Her iş alanı gerçek feature ekranına bağlanmalı.                          |
| Sidebar, klinik seçici ve route scope mock actor/dizin kullanıyor                   | [auth-context.tsx](../src/data/auth/auth-context.tsx), satır 36; [clinic-selector.tsx](../src/components/layout/dashboard/topbar/clinic-selector.tsx), satır 24            | Mock ID'lerle mali istek gönderilmemeli; yetkili gerçek kapsam çözülmeli. |
| Gerçek `AuthProvider` mevcut, provider ağacına bağlı değil                          | [auth-provider.tsx](../src/lib/auth/auth-provider.tsx), satır 35; [providers/index.tsx](../src/providers/index.tsx), satır 29                                              | `useCapability` / `Can` ve gerçek actor önce bağlanmalı.                  |
| Taşıyıcı token ve kaynak başlığı gönderiyor; klinik değişimi local state'te kalıyor | [client.ts](../src/lib/api/client.ts), satır 160; [auth-context.tsx](../src/data/auth/auth-context.tsx), satır 121                                                         | Seçili klinik/defter API'nin doğruladığı kapsamla eşleşmeli.              |
| Genel tahsilat paneli süre sonunda başarı gösteriyor                                | [payments-panel.tsx](<../app/[locale]/[clinic-slug]/(dashboard)/_components/payments-panel.tsx>), satır 82                                                                 | Gerçek durum sorgusu ve ortak tahsilat akışı gerekli.                     |
| Generated kaynak çalışan API OpenAPI'si                                             | [orval.config.ts](../orval.config.ts), satır 8                                                                                                                             | Kontrat düzeltmeleri API'de yapılır; generated elle düzenlenmez.          |

### İlk kod kesiti — uygulandı

`finance/accounting` ekranı generated mizan ve yevmiye raporlarını kullanır;
tarih aralığı, borç/alacak bakiyeleri, denge durumu ve son 10 yevmiye kaydını
gösterir. Ekran salt okunurdur, parasal değerleri decimal string olarak biçimlendirir
ve gerçek Firebase `AuthProvider` içindeki `/me/context` actor'ının geçerli UUID
klinik kapsamı yoksa rapor sorgusu başlatmaz. Bu, legacy klinik raporlarının ilk
frontend kesitidir; organizasyon defteri, maliyet merkezi veya fiş detay API desteği
değildir.

`NEXT_PUBLIC_API_MOCKING=enabled` olduğunda ekran Firebase/API çağrısı yapmadan
ayrı, sabit demo mizan ve dengeli yevmiye kayıtlarını gösterir. Demo etiketi ekranda
görünür; bu fixture'lar canlı API veya muhasebe verisi yerine kullanılmaz.

Bu ekrandaki auth bağlantısı yereldir; global mock Zustand store'u ve clinic
selector henüz değiştirilmedi. Kullanıcının birden fazla yetkili kliniği arasında
seçim, merkezi defter dizini ve kapsam değişiminde bütün finans cache/form
izolasyonu F1'de tamamlanmalıdır.

Mevcut `bankAccountList`, `cashRegisterList`, `cashSessionList`, `purchaseInvoiceList`
filtreleri `clinicId` taşımıyor; scope'u sunucu context'inden alıyor. URL slug'ını veya
query key'i değiştirmek tek başına bu endpoint'lerin kapsamını değiştirmez.
Mevcut `all-clinics` seçeneği, şirket defteri veya konsolide bilanço anlamına gelmez.

### İkinci kod kesiti — uygulandı

`finance/accounting/periods` ekranı gerçek dönem listeleme, dönem açma, kilitleme,
yeniden açma ve yıl sonu kapanış akışlarını kullanır. Yazma aksiyonları
`accountingperiod:create` / `accountingperiod:update` yetkinlikleriyle görünür;
backend yine nihai yetki otoritesidir. Kapanış doğrudan gönderilmez: kullanıcı önce
GRNI seçimleriyle sunucu önizlemesini alır, blocker ve özetleri görür, seçim değişirse
önizlemeyi yeniler ve geri alınamaz işlem onayından sonra önizlemenin
`expectedLastEntryNo` değeriyle kapatır. Böylece önizleme sonrasında değişen defter
sayacıyla eski kapanışın gönderilmesi engellenir.

Ekran canlı modda gerçek actor klinik kapsamını kullanır; mock modda API/Firebase
çağrısı yapmadan yerel demo dönemleri ve güvenli kapanış örneği gösterir. Dönem
query key'i klinik kapsamını içerir ve her başarılı durum geçişinden sonra ilgili
dönem sorguları yenilenir. Global klinik seçici ve organizasyon defteri çözümü hâlâ
F1/F2 kapsamındadır.

### Üçüncü ve dördüncü kod kesiti — uygulandı

`finance/accounting/chart-of-accounts` ekranı gerçek hesap planı listesi, arama,
hesap türü filtresi ve şablon sapma raporunu kullanır. Eksik kodlar, şablon dışı
kodlar ve niteliği farklı hesaplar ayrı gösterilir. `account:create` yetkisi olan
kullanıcı idempotent kurulum komutuyla yalnız eksik şablon hesaplarını ekleyebilir;
mevcut hesaplardaki muhasebe anlamı taşıyan farklar otomatik düzeltilmez.

Sayfa içi genel yenileme düğmeleri kaldırılmıştır. Sekme yenilemesi hem Next.js
route verisini hem React Query önbelleğini geçersiz kılar. Kapanış önizlemesini
yeniden hesaplama gibi iş akışına özgü aksiyonlar sayfa içinde kalır.

`finance/accounting/tax-parameters` ekranı güncel oran özetini ve bütün tarihsel
sürümleri gerçek API'den okur. `taxparameter:update` yetkisi olan kullanıcı yeni
bir yürürlük sürümü açabilir. Arayüz geçmiş tarih girişini ve KDV için yasal küme
dışındaki oranları isteği göndermeden engeller; stopaj/kurumlar vergisinde 0–100
ve iki ondalık basamak sınırını uygular. Geçmiş sürümler yerinde değiştirilmez.

`finance/accounting/posting` ekranı klinik kapsamındaki yevmiye fişlerini dönem ve
durum filtresiyle sayfalı listeler. `journalentry:delete` yetkisi olan kullanıcı
POSTED fiş için açık onaydan sonra storno oluşturabilir; orijinal fiş silinmez ve
başarıdan sonra rapor/defter sorguları birlikte geçersiz kılınır. Liste endpoint'inin
backend'de opsiyonel olan `status`/`periodId` alanları generated istemcide zorunlu
göründüğü için ekran bunları seçilmediklerinde HTTP isteğinden çıkarır; OpenAPI
opsiyonellik düzeltmesi hâlâ sözleşme işidir.

`finance/accounting/financial-events` ekranı olay geçmişini ve seçilen tarih
aralığında fişi oluşmamış ekonomik olayları ayrı görünümlerde listeler. Mutabakat
listesi boş değilse `financialevent:update` yetkili kullanıcı, kapsamı ve işlemin
toplu etkisini açıkça onaylayarak mevcut backfill komutunu çalıştırabilir. Sonuçtaki
fişlenen/atlanan/hatalı sayıları gösterilir; olay, fiş ve rapor sorguları birlikte
yenilenir. Serbest `unknown` backfill response'u typed DTO'ya bağlama ihtiyacı API
sözleşmesi maddesi olarak korunur.

### Beşinci kod kesiti — uygulandı

`finance/finance-ledger` ekranı klinik defterinin (tahsilat/iade/gider kayıtları —
muhasebe yevmiyesinden ayrı, `FinanceLedger` modeli) gerçek dönem özetini,
tahsilat/iade ↔ defter mutabakatını ve sayfalı kayıt listesini kullanır. Üç ayrı
sorgu birleştirilir: `GET clinic/:id/summary` (tarih aralığına göre para birimi
bazlı gelir/gider/bakiye), `GET reconciliation/mismatches` (taksit/tahsilat ile
defter durumu arasında fark) ve `GET clinic/:id` (sayfalı tüm kayıtlar).
`financeledger:create` yetkisi olan kullanıcı, fark bulunduğunda açık onaydan
sonra `POST reconciliation/backfill` ile eksik/durumu kaymış kayıtları telafi
edebilir; backend'in `FinanceLedgerCommandController`'ı bunu tek yazma ucu olarak
tanımlar (elle kayıt girişi yoktur).

Kayıt listesi backend'in gerçekten desteklediği sorgu yüzeyiyle sınırlıdır:
`financeLedgerGetClinicLedger` yalnız sayfalama, `search`/`searchColumn` ve
`orderBy`/`orderByColumn` alır (`paginate` helper'ı, bkz.
`finance-ledger.query.repository.ts`); tür/kategori/durum/tarih aralığına göre
sunucu tarafı filtre **yoktur**. Ekran bu yüzden listede yalnız açıklamaya göre
arama ve tarih/tutara göre sıralama sunar; tarih aralığı seçici sadece özet ve
mutabakat sorgularına uygulanır — bu sınır arayüzde açıkça yazılıdır. Tür/
kategori/kaynak/durum filtresi gerekirse önce backend sorgu yüzeyi
genişletilmeli, sonra `frontend-api-endpoint-gaps.md`'ye yeni filtre eklenmeden
ekrana filtre eklenmemelidir.

`FinanceLedgerResponseDto.amount`/`taxAmount` sözleşmede `number` (diğer finans
DTO'larındaki decimal-string'den farklı — bilinen bir sözleşme tutarsızlığı,
bölüm 5'teki kontrol listesinde yer alır); ekran bunu olduğu gibi `number`
formatlayıcısıyla gösterir, dönüştürme yapmaz. Hasta/ödeme/taksit kimlikleri
yalnız kısaltılmış biçimde gösterilir — ad/telefon gibi çapraz modül verisi
(patient/payment) bu ekranda **çözülmez** (cross-module kuralı, bkz. `CLAUDE.md`
§Cross-Module Data); isim gösterimi ayrı bir query/handler ihtiyacı olarak
kalır.

Mock modda (`NEXT_PUBLIC_API_MOCKING=enabled`) ekran API/Firebase çağrısı
yapmadan sabit demo özet, iki örnek mutabakat farkı ve beş örnek defter kaydı
gösterir; demo etiketi görünür.

### Altıncı kod kesiti — uygulandı

`finance/cash-register` ekranı bölüm 7'deki "ilk yazma kesiti" senaryosunu
karşılar: klinik kapsamındaki gerçek kasaları listeler, bir kasa seçildiğinde
açık oturumu (`GET registers/:id/open-session`) çözer ve oturum kimliğini
`GET sessions/:id` ile hareketleri dahil tam detaya genişletir — tek uçtan
alınan `CashSessionResponseDto.movements` her koşulda dolu gelmediği için
(`findOpenByRegister` movements include etmiyor; sadece `findByIdWithMovements`
dolduruyor) ekran bilerek iki sorguyu zincirler. Kasa yoksa oluşturma
(`cashregister:create`), kasa açma (`cashsession:create`), hareket kaydı
(`cashmovement:create`) ve fiili sayımla kapanış (`cashsession:update`)
capability'leriyle gösterilir/gizlenir; backend yine nihai yetki otoritesidir.

Kapanış mutasyonunun dönüşü (`CashSessionClose200`) sözleşmede serbest
`{[key: string]: unknown}` nesnesidir (bölüm 5'teki kontrol listesi); ekran
bunu tip korumalı bir okuyucuyla (`readCloseSummary`) ayrıştırıp anlık bildirim
gösterir, sonra ilgili sorguları geçersiz kılıp kalıcı beklenen/sayılan/fark ve
muhasebeleşme (`accountingEventId`/`postedToAccountingAt`) durumunu geçmiş
oturumlar listesinden (`GET sessions?cashRegisterId&status=CLOSED`) okur.
Zaten açık oturum / oturum açık değil gibi 409 hataları backend mesajıyla
olduğu gibi gösterilir; ekran kendi başına "çift kapanış" kontrolü uygulamaz.

Mevcut `cashRegisterList`/`cashSessionList` filtreleri bölüm 2'de belirtildiği
gibi `clinicId` almıyor, kapsamı sunucu context'inden alıyor; bu ekran da
defter/`sourceClinicId` kapsamını henüz desteklemiyor (F1/F2 ile birlikte
gelecek). Mock modda (`NEXT_PUBLIC_API_MOCKING=enabled`) ekran API çağrısı
yapmadan üç örnek kasa (biri arşivli), bir açık oturum + iki hareket ve iki
kapanmış oturum (biri muhasebeleşmiş, biri beklemede) gösterir; demo
mutasyonlar yerel state üzerinde aynı geçişleri simüle eder.

### Yedinci kod kesiti — uygulandı

`finance/bank` ekranı gerçek klinik banka hesaplarını, hesap başına içe
aktarılmış ekstreleri, seçili ekstrenin satırlarını, mutabakat özetini ve
oto-eşleştirme/elle mutabakat akışını kullanır. `bankaccount:create` yetkisi
olan kullanıcı yeni hesap açabilir (`bankaccount:delete` ile arşivleyebilir);
`bankstatement:create` yetkisi olan kullanıcı dönem aralığı ve satırlarıyla
yeni bir ekstre içe aktarabilir; `bankstatementline:update` yetkisi olan
kullanıcı oto-eşleştirmeyi (tarih toleransı parametreli) çalıştırabilir ve tek
tek satırı mutabık kılabilir. Backend yine nihai yetki otoritesidir.

Ekstre importu API'siz çalışır: backend `ImportBankStatementDto.lines` bekler,
ekran bunun yerine basit bir CSV metin alanı sunar (`tarih,açıklama,tutar[,
bakiye,referans,karşı taraf]`) ve satırları istemci tarafında ayrıştırıp
doğrular (tarih `YYYY-MM-DD`, tutar imzalı iki ondalık). Alan içi virgül
kaçışı desteklenmez; bu sınır arayüzde açıkça yazılıdır. Gerçek dosya
parser'ı (banka-özel MT940/CSV biçimleri) hâlâ bölüm 5'teki açık iş.

Satır mutabakatı iki yoldan yürür: `bankStatementAutoMatch` yalnız tutar/yön
birebir ve tek adaylı satırları kapatır; eşleşmeyen satırlar için ekran
`bankStatementLineSuggestions`'ı çağırıp aday muhasebe fişlerini (puan,
gerekçe, tarih farkı) listeler ve kullanıcı bir adayı seçip
`bankStatementReconcileLine` ile `MATCHED` yapar. Elle, öneri dışı bir
`matchedRef` girişi bu ilk kesitte **yoktur**; kullanıcı yalnız öneri listesinden
seçebilir, satırı `IGNORED` işaretleyebilir veya `UNMATCHED`'a geri alabilir.
Backend'in döndürdüğü `BankAccountResponseDto.iban`/`accountNo`/
`organizationId` alanları `MANAGEMENT`/`ADMIN` serileştirme grubuna kapalıdır
(bkz. `bank-response.dto.ts`); ekran bu alanları yalnız yanıtta fiilen
geldiklerinde gösterir, eksikliklerini "maskeli" olarak ayrıca işaretlemez —
bu, maskeleme/boş değer ayrımını kapsamayan bilinen bir sınırdır (bölüm 5'teki
genel maskeleme notuyla aynı kapsam).

Mock modda (`NEXT_PUBLIC_API_MOCKING=enabled`) ekran API çağrısı yapmadan üç
örnek hesap (biri arşivli), bir örnek ekstre (eşleşen/yok sayılan/eşleşmeyen
karışık satırlarla) ve sabit öneri listesi gösterir; demo mutasyonlar yerel
state üzerinde aynı geçişleri simüle eder (oto-eşleştirme demo modunda ilk
eşleşmeyen satırı kapatır — gerçek puanlama algoritmasını taklit etmez).

### Sekizinci kod kesiti — uygulandı

`finance/invoice` ekranı klinik ve organizasyon kapsamındaki satış faturalarını
gerçek liste/detay uçlarından okur; fatura numarası araması, sayfalama, durum,
kesim tarihi ve yetkiye göre gelebilen parasal/KDV kırılımını gösterir. Detay
modelinde bulunmayan fatura numarası seçili liste satırından korunur. Fatura
normal akışta olay güdümlü üretildiği için arayüzde elle fatura kesme formu
yoktur.

Seçili tarih aralığında tahsilatı tamamlanmış ancak faturası oluşmamış ödemeler
`GET /invoices/uninvoiced-payments` ile ayrı bir mutabakat iş listesi olarak
gösterilir. `invoice:create` yetkili kullanıcı açık onaydan sonra mevcut
`POST /invoices/backfill` telafi komutunu çalıştırabilir; sonuçtaki denenen,
üretilen ve başarısız sayıları gösterilir ve bütün fatura sorguları yenilenir.
OpenAPI'nin bu iki dönüşü serbest object olarak üretmesi nedeniyle ekran dar,
runtime-korumalı okuyucular kullanır; typed response DTO ihtiyacı bölüm 5'teki
kontrol listesinde kalır.

`invoice:delete` yetkili kullanıcı yalnız kesilmiş (`ISSUED`) faturayı en az beş
karakterlik gerekçe ve geri alınamaz işlem onayıyla iptal edebilir. Bu aksiyon
mevcut storno endpoint'ini kullanır; tahsilat iadesi veya ödeme sağlayıcı iptali
olarak sunulmaz. E-belge gönderme/indirme/yeniden deneme aksiyonu da mevcut API
olmadığı için üretilmemiştir. Serileştirme nedeniyle gelmeyen tutarlar sıfır
yerine yetkiyle maskelenmiş olarak gösterilir.

Mock modda ekran API/Firebase çağrısı yapmadan dinamik tarihlerle dört örnek
fatura ve iki eksik-fatura mutabakat kaydı gösterir; telafi ve iptal akışları
yerel state üzerinde simüle edilir.

### Dokuzuncu kod kesiti — uygulandı

`finance/payroll` ekranı, kalıcı bir bordro tablosu olmadığı için (doc 05 §2.9,
bilinçli kapsam dışı) tahakkuk geçmişini finansal olay defterinden
(`FinancialEvent(PAYROLL_ACCRUED)`) okuyan iki yeni query ile çalışır:
`GET payroll/accruals` (liste, sayfalı) ve `GET payroll/accruals/:id` (detay).
Her iki uç da cari (Party) adını `partyId` üzerinden çözüp zenginleştirir —
isim Party'nin kendi snapshot'ında zaten var olduğu için (bordro tahakkuku
yazılırken `EnsurePartyForEmployeeCommand` ile düşürülmüş) ayrı bir HR
sorgusuna gerek kalmadı. Bu kesit **migration gerektirmedi**; hiçbir yeni
Prisma tablosu açılmadı.

Liste sayfalama destekler ama sunucu tarafı serbest arama **yoktur**:
altyapı (`financial_events`) yalnız `sourceRefId` EŞİTLİĞİNİ bilir, bu yüzden
filtre `employeeUserId` + `monthKey` çiftini **birlikte** ister (ikisi de
dedupe anahtarına eşlenir); tek başına biri verilirse arayüz filtreyi
uygulamaz ve bunu açıkça bir ipucuyla gösterir. Yazma tarafı değişmedi: mevcut
`POST payroll/accruals` (brüt→net rakamları dışarıdan — bordro programından —
gelir) formu, çalışan seçimini `hr/employee` listesinden (`userId` dolu olan
aktif çalışanlar) alır ve canlı bir denge önizlemesi (`brüt = net + stopaj +
işçi SGK`) gösterir; sunucu denge kontrolü ayrıca ve nihai olarak kalır.

Ayrı bir bordro yetkisi hâlâ yok (bilinçli — doc 09 §33): okuma ve yazma aynı
`financialevent:read` / `financialevent:create` eksenindedir. Mock modda
ekran API/Firebase çağrısı yapmadan iki örnek çalışan ve üç örnek tahakkuk
kaydı (iki ay, iki çalışan) gösterir.

## 3. Ekranlar ve navigasyon

Kullanıcı menüsü: **Özet / Tahsilatlar ve Alacaklar / Giderler ve Borçlar / Kasa ve
Banka / Faturalar / Muhasebe ve Raporlar / Ayarlar**. Teknik `financial-events`
ve `posting` ekranları muhasebecinin “Kontrol ve Mutabakat” iş listesinde yer alır.
URL adları korunabilir; menü etiketleri kullanıcı işini anlatır.

| Alan           | Mevcut klinik web rotası                                            | Planlanan ekran                                                      |
| -------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Özet           | `/[locale]/[clinic-slug]/finance`                                   | Tahsilat, tahakkuk, borç/alacak, bekleyen işler; para birimleri ayrı |
| Kasa           | `finance/cash-register`                                             | Kasa listesi, oturum, hareket, sayım ve kapanış                      |
| Banka          | `finance/bank`                                                      | Hesaplar, ekstre import, eşleştirme, komisyon/yatış, chargeback      |
| Hasta finansı  | `finance/payment`, `finance/treatment-charge`                       | Borçlandırma, plan/taksit, tahsilat, iade; hasta/randevuya bağlantı  |
| Belgeler       | `finance/invoice`, `finance/purchase-invoice`, `finance/e-document` | Satış/alış faturaları ve mevcut entegrasyonların gerçek durumu       |
| Cari ve bordro | `finance/party`, `finance/payroll`                                  | Cari detay/ekstre; bordro tahakkuk liste/detay/yazma uygulandı       |
| Defter         | `finance/accounting`, `finance/accounting/posting`                  | Fişler, ters kayıt, muhasebeleşmeyen işler ve hata takibi            |
| Kurulum        | `finance/accounting/chart-of-accounts`, `periods`, `tax-parameters` | Hesap planı, mali dönemler ve tarihli vergi parametreleri            |

Aşağıdaki **web rotaları Proposed**; henüz uygulanmış sayfalar değildir:

| Proposed web rotası                                                            | Kullanım                                                                           |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `/[locale]/organizations/[organization-slug]/finance`                          | Organizasyon finans merkezi; yetkili defterler ve özetleri                         |
| `/[locale]/organizations/[organization-slug]/finance/books/[accountingBookId]` | Tek defterin çalışma alanı; klinik/merkez kırılımı                                 |
| `.../finance/books/[accountingBookId]/reports`                                 | Defter raporları ve yetkiye uygun maliyet merkezi analizleri                       |
| `.../finance/settings/books`                                                   | Hukuki defterler ve kimlik/vergi profilleri                                        |
| `.../finance/settings/clinic-routing`                                          | Klinik ilişkisi, defter yönlendirmesi, tahsilat politikası ve geçerlilik tarihleri |
| `.../finance/settings/cost-centers`                                            | Deftere bağlı maliyet merkezleri ve dağıtım seçenekleri                            |
| `.../finance/settings/access`                                                  | Defter/şube/özet erişim kapsamları ve mevcut grant yönetimi                        |

Organizasyon sayfaları `all-clinics` altında sahte klinik bağlamına yerleştirilmez.
Klinik finansı açılırken işlem tarihi için geçerli defter yönlendirmesi çözülür.
Merkez kullanıcısı erişebildiği defteri açıkça seçer; klinik seçimi zorunlu değildir.
Yeni organizasyon rotaları var olan klinik layout'una otomatik bağlanmaz; ortak
shell bileşenlerini kullanabilen, kendi yetkili scope'unu çözen layout gerekir.

## 4. Kapsam, filtre ve ayarlar

- Üst barda organizasyon, defter ve ekranın kapsamı görünür; şirket/klinik sahibinin etiketi defter seçicisini açıklamalı.
- Yazma hedefi tek `accountingBookId`'dir. Okumada desteklenen `accountingBookIds`, `sourceClinicId`, `costCenterId`, dönem/tarih, para birimi ve durum ayrı filtrelerdir.
- Maliyet merkezi seçenekleri seçili deftere aittir; başka deftere geçince geçersiz filtre ve dağıtım satırları temizlenir.
- Merkezi kaynak için açık “Merkez” seçeneği bulunur; `sourceClinicId = null` kayıp klinik olarak gösterilmez.
- Fiş/form satırlarında maliyet merkezi dağılımı backend kontratına göre tutar veya yüzdeyle yapılır; toplamın tam olması sunucuda doğrulanır.
- Şube performans analizi kısmi veri olabilir. Kısmi kapsamlı rapor, tam hukuki mizan/bilanço gibi etiketlenmez; tam defter raporu ayrı yetki gerektirir.
- Birden fazla defter görünümü ayrı defter özetleridir. Konsolidasyon salt okunur, açık `reportGroups` ve erişim grant'leriyle tanımlanan ayrı akıştır; command hedefi değildir. Kur çevrimi/eliminasyon use case'i olmadan toplu bilanço hesaplanmaz.
- `LOCAL | CENTRAL | MIXED` politikası tahsilat hesabı/kanalı seçeneklerini belirler; hukuki gelir sahibini tek başına değiştirmez.
- Defterler arası mahsup, iki dengeli kayıt ve karşılıklı referans gerektiren ayrı akış olarak tasarlanır; basit kasa/banka transferi kabul edilmez.
- Tarihli ayar değişikliğinde geçerli/eski/gelecek sürüm, etki tarihi ve etkilenen açık işler gösterilir; geçmiş kayıtlara otomatik yeniden etiket uygulanmaz.
- Ekonomik tarih yönlendirmeyi, istek zamanı erişim yetkisini belirler. Eski tarihli rapor seçmek iptal edilmiş franchise erişimini geri getirmez; bekleyen işler mühürlü ayar/politika sürümlerini kullanır.
- Defter hukuki alanları klinik ayarında salt okunur gösterilir; operasyonel miras/override alanlarında “hangi seviyeden geldiği” görünür.

## 5. API hazır olma matrisi

“Mevcut” aşağıda kaynak kodda HTTP/generated desteği bulunduğunu belirtir; canlı doğrulama yapılmamıştır.

| İş akışı            | Mevcut HTTP / generated destek                                                                    | Tamamlanması gereken                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Kasa                | register/session liste/detay, aç, hareket, kapat                                                  | Defter/sourceClinic kapsamı; kapanış çıktısının typed DTO'su                 |
| Banka               | account liste/create/archive; statement import/detail; öneri/auto-match/reconcile/özet            | Defter kapsamı; desteklenen import biçimleri ve gerçek parser akışı          |
| Alış faturası       | liste/record/match/unmatch/cancel                                                                 | Defter, maliyet merkezi ve cari ödeme bağlantısının açık sözleşmesi          |
| Cari                | party liste/detay; supplier-payment command                                                       | Cari bakiye/ekstre okuması ve gerektiğinde bağımsız cari yönetimi            |
| Satış faturası      | liste/detay/payment lookup/uninvoiced/cancel/backfill                                             | Genel fatura düzenleme akışı ve e-belge durum ihtiyacının use case karşılığı |
| Raporlar            | mizan, hesap ekstresi, yevmiye, gelir tablosu, bilanço, nakit akışı, KDV, aging, provider revenue | Klinik odaklı imzaların book/grant ve analiz filtrelerine uyarlanması        |
| Muhasebe kontrolü   | journal liste/reverse; events/unposted/post; ledger mismatch/backfill                             | Typed onarım sonuçları; fiş detay/drilldown kapsamı                          |
| Kart işlemleri      | PAX/iyzico operasyonları, cihazlar, pending/unbridged; chargeback; settlement record              | İşlem durumunu ID ile okuma; settlement geçmişi ve operasyon durumu          |
| Hasta ödemesi       | defter/özet, tedavi charge, raporlar                                                              | Payment/plan/installment HTTP akışları; genel tahsilat geçmişi               |
| Bordro              | accrual record command + liste/detay (FinancialEvent+Party projeksiyonu, migration yok)          | Hesaplama motoru ve ödeme yaşam döngüsü ayrı ihtiyaçlar (bilinçli kapsam dışı — doc 05 §2.9) |
| Organizasyon/defter | Mevcut raporlar tek clinicId etrafında                                                            | Book, routing, cost center, grant ve merkezi finans kontratları Proposed     |

Yeni HTTP method/path önerileri ve ayrıntılı request/response kayıtları
[Frontend API Endpoint Gaps](frontend-api-endpoint-gaps.md) içinde tutulur.
Bu dosyadaki yeni web rotaları HTTP endpoint taahhüdü değildir. Klinik dizini, POS
durum okuması, hasta ödeme/plan/taksit, yöntem dağılımı ve genel işlem geçmişi için
mevcut gap kayıtları genişletilmeli; aynı ihtiyaç yeniden kaydedilmemelidir.
Önce mevcut handler aranır; use case eksikse frontend işi içinde repository/handler yazılmaz.

Kontrat yayını öncesindeki somut kontroller:

- `journalGetEntriesParams` içindeki `status/periodId`, `financialEventGetEventsParams` içindeki `type/sourceModule/sourceRefId` ve gelir tablosundaki `compare` için gerçek opsiyonellik Swagger'a doğru aktarılmalı.
- `CashSessionClose200`, `ChartOfAccountsDrift200`, `InvoiceBackfill201`, `FinancialEventPostUnposted201` gibi serbest `unknown` object çıktıları gereken metadata DTO'larına bağlanmalı.
- Finance ledger ve purchase invoice parasal DTO'ları `number`, banka/kasa/raporlar çoğunlukla `string`; para taşıma standardı ve geçiş uyumluluğu kararlaştırılmalı.
- Chargeback generated source enum'u `POS_TRANSACTION | ONLINE_PAYMENT` iken güncel shared schema `BOOKING_PAYMENT` da içeriyor. Yeni seçenek eklemeden önce OpenAPI/Orval senkronize edilmeli.
- Maskeleme nedeniyle hiç gelmeyen alanlar ile gerçek `null` ayrılmalı; generated alanın required olması serileştirmede mutlaka geleceğini garanti etmez.
- `JournalEntryResponseDto` satır taşımaz; satırlı rapor DTO'su veya ayrı mevcut use case üzerinden fiş detay ihtiyacı doğrulanmalı.

## 6. Frontend uygulama kuralları

Route katmanı ince kalır; `page.tsx` ilgili feature ekranını çağırır. Sayfaya özel
bileşenler `_components/`, tekrar kullanılan finans bileşenleri `src/features/finance/`
altında bulunur. Önerilen feature'lar: `overview`, `cash`, `bank`, `receivables`,
`invoices`, `purchase-invoices`, `parties`, `payroll`, `accounting`, `reconciliation`.
Her feature gerektiği kadar `api/`, `hooks/`, `schemas/`, `components/` içerir.
Ortak money input, scope, response group ve filtre parçaları `finance/shared/` altında olur.

- İsteklerde generated Orval operasyonları tercih edilir; wrapper scope/enabled koşulu, select ve invalidation sağlar. Runtime'da uydurma Proposed endpoint çağrısı yapılmaz.
- Gerçek actor yetki kaynağıdır. URL/Zustand seçili yetkili kapsamı ve UI/preview durumunu tutar; rol önizlemesi backend yetkisi üretmez. Yeni scope-switch mutation tasarlanmaz; yeniden tasarlanan API'ler açık kapsamı her istekte yetkilendirir.
- Grant kapsamları `full book`, `branch data`, `aggregate only` ayrımını taşır; franchise veya organization üyeliği bunların yerine kullanılmaz.
- Capability aksiyon görünürlüğünü, response `serialization.groups` ve geriye uyumlu `meta.serializationOptions.groups` alan görünürlüğünü belirler. Maskeleme sıfır bakiye gibi gösterilmez.
- Query key, actor/organization/book + veri kapsamı + filtre + sayfa içerir. Context ile çalışan URL-only generated key'lere scope eklenir; defter/actor/grant değişiminde hassas cache temizlenir.
- Scope değişiminde bekleyen sorgular iptal edilir; eski defter datası yeni başlık altında placeholder olarak gösterilmez. Açık parasal form yanlış deftere sessizce taşınmaz.
- URL'de book/cost center/dönem/sayfa filtreleri geri yüklenebilir; arama ve filtre değişimi sayfayı başa alır. Yetkisiz URL parametresi sunucu kontrolünü aşamaz.
- Form payload'ı shared Zod kontratıyla doğrulanır; tarih/şimdi ve dönem sınırları `DateTimeManager` ile üretilir. İşlem tarihi ve ilgili defter zaman dilimi açık tutulur.
- Para input state'i decimal string kalır; yalnız mevcut endpoint number istiyorsa submit sınırında kontrollü dönüşür. Bakiye, vergi, fiş toplamı sunucudan gelir; farklı paralar toplanmaz.
- Mutation retry varsayılan kapalı kalır. Çift tıklama engellenir; ağ sonucu belirsizse kayıt sorgulanır. Otomatik yeniden gönderim ancak backend'in garanti ettiği idempotency sözleşmesiyle yapılır.
- Kapanış, ters kayıt ve ayar değişiminde kullanıcı işlem kapsamını/tarihini görür. Version çatışması güncel veriyi yeniden yükletir; eski form zorla kaydedilmez.
- POS başlangıç kabulü tahsilat başarısı sayılmaz; bounded polling mevcut/uygulanmış durum endpoint'ine bağlıdır. Pending timeout ayrı durumdur.
- Finansal yazmalar otomatik offline kuyruğa alınmaz; çevrimdışı taslak saklama mümkündür. Senkronizasyon için sunucu idempotency ve conflict sözleşmesi ayrıca sağlanmalıdır.
- Hatalar merkezi API error yolundan i18n anahtarlarına çevrilir; tüm metinler `tr/en` sözlüklerinde yer alır. Tablet etkileşimleri en az 44×44 px ve klavye erişimlidir.

Mutation sonrası invalidate kümeleri açık tanımlanır: kasa → session/register/özet;
alış/tedarikçi ödeme → invoice/party/journal/rapor; tahsilat/iade/kart itirazı →
patient ledger/plan/kasa-banka/rapor; post/reverse/dönem → journal/unposted/rapor/dönem.
Hesaplama/asenkron posting tamamlanmadıysa “kaydedildi” ve “muhasebeleşti” ayrı gösterilir.

## 7. Uygulanabilir iş listesi

| Faz                     | İş paketi ve bağımlılık                                                                                           | Bitti kabulü                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| F0 — Sözleşme           | ADR + endpoint-gap kararları; book/routing/grant DTO'ları; Swagger opsiyonellik/enum/para düzeltmeleri            | Her ekran ihtiyacı Mevcut / Proposed / Deferred işaretli; generated kaynakla eşleşiyor.        |
| F1 — Kapsam altyapısı   | Gerçek AuthProvider, yetkili klinik/organizasyon/defter dizini ve scope resolver; mock shell ayrımı               | İki farklı tenant/defter arasında veri ve form sızıntısı yok; yetkisiz deep link reddediliyor. |
| F2 — İlk okuma kesiti   | Legacy klinik book dizini/seçimi, gerçek rapor/fiş listesi ve yetkili drilldown; F1 + book-aware read kontratları | Tek book için gerçek DB→HTTP→generated→ekran akışı; salt okunur kapsam ve tutarlar doğru.      |
| F3 — Günlük muhasebe    | Aşağıdaki ilk kasa yazma kesiti, alış/gider faturası, supplier ödeme, cari; mevcut satış faturası okuma/iptal     | Kaynak işlem → cari/defter bağlantısı, boş/hatalı/maskeli durumlar ve invalidation tamam.      |
| F4 — Tahsilat           | Handler exposure boşlukları sonrası hasta plan/taksit/tahsilat/iade ve POS                                        | Pending/başarısız/başarılı/iade ayrımı gerçek server state'inden geliyor.                      |
| F5 — Banka ve kontrol   | Ekstre import/mutabakat, yatış/komisyon, chargeback, unposted ve mismatch işleri                                  | Eşleşen kayıtlar takip edilebilir; tekrar işlemler mükerrer fiş üretmiyor.                     |
| F6 — Merkez ve raporlar | Organizasyon workspace, merkez işlemleri, cost center analizleri, dönem/kapanış                                   | Shared book şubeleri doğru; franchise yetkisi ve kısmi/tam rapor ayrımı doğrulanmış.           |
| F7 — İleri kapsam       | Konsolidasyon/eliminasyon, tam bordro, defterler arası mahsup; ayrı backend use case'leri gerekli                 | Her özellik kendi muhasebe kontratı ve kabul senaryosuyla açılıyor.                            |

### İlk yazma kesiti: bir kliniğin gerçek kasa oturumu — uygulandı (bölüm 2.6)

Önce F2'de mevcut legacy book ve gerçek raporlar salt okunur bağlanır. Aşağıdaki
kasa senaryosu F3'ün ilk yazma kesitidir; ilk okuma tesliminin önkoşulu değildir.
Ekran kodu yazıldı (bölüm 2'deki "Altıncı kod kesiti"); book-aware kapsam F1/F2
tamamlanmadan hâlâ bekliyor, bu yüzden aşağıdaki adımlar geçerli klinik kapsamıyla
sınırlıdır.

1. Yetkili kullanıcı mevcut klinik rotasından girer; API işlem tarihi için defteri ve kasa açma yetkisini çözer.
2. `finance/cash-register` gerçek kasaları ve açık oturumu gösterir; hiçbir demo kasa veya bakiye fallback'i kullanılmaz.
3. Kullanıcı kasa açar; ID yanıtından sonra açık oturum query'si yenilenir. Oturum/defter/para birimi ekranda görünür.
4. Backend'in desteklediği hareket türü kaydedilir; açıklama/referans ve gerekli maliyet merkezi alanları doğru kontratla gönderilir.
5. Kullanıcı fiili sayımla kapatır; expected/counted/difference sunucudan gösterilir. Aktif transaction/çift kapanış hatası doğru ele alınır.
6. Oturum detayı, varsa accounting event/journal referansı ve kaynak kasa hareketi arasında bağlantı kurulur; posting durumu ayrı gösterilir.

Kesitin önkoşulu book-aware kasa endpoint sözleşmesidir; mevcut kliniğe bağlı
endpoint'e frontend'den ek alan göndererek defter desteği varmış gibi yapılmaz.

### Kabul ve doğrulama senaryoları

- Tek şirket/tek klinik, ortak şirket defterli iki şube ve aynı tenant içindeki bağımsız franchise için yetkili kapsam matrisi çalışır.
- Hızlı defter/klinik geçişinde geç gelen response, eski tablo veya açık form yeni kapsamla eşleşmez; yenilemede URL filtresi korunur.
- Branch-only kullanıcı diğer şubenin hareketini, aggregate-only kullanıcı satır detayını göremez; tam bilanço erişimi ayrı doğrulanır.
- Tarihli yönlendirme değişikliğinin iki tarafındaki işlemler doğru deftere gider; legacy geçmiş taşınmış gibi görünmez.
- Merkez kaydı `sourceClinicId = null` ile görünür; satır dağıtımları seçili defterin merkezlerinde tam tutar verir.
- Aynı anda kasa açma/kapatma, çift tıklama, 409 conflict ve ağ sonucu belirsizliği sahte başarı veya ikinci kayıt oluşturmaz.
- Maskeli tutar 0 sayılmaz; TRY/EUR karışmaz; decimal hassasiyeti ve tarih sınırları form/rapor arasında korunur.
- Kaynak kayıt, oturum ve muhasebe fişi birbirine bağlanır; iptal/iade/ters kayıt sonrası ilgili query'ler yenilenir.
- API tamamlandıktan sonra Orval üretimi, TypeScript/lint, kritik akış entegrasyon testleri ve dar bir browser smoke testi çalışır; yalnız mock MSW başarısı canlı entegrasyon kabulü sayılmaz.
