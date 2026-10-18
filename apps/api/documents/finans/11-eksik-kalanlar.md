# Finans denetimi — ertelenen kalemlerin ham listesi

> **ÜRETİLMİŞ DOSYA — elle düzenlenmez.**
> Kaynak: `09-guvence-denetimi.md` içindeki "Bilinçli yapılmayanlar" tabloları.
> Yeniden üretmek için: `node scripts/finans-eksik-liste.cjs`

**2026-10-15 itibarıyla 205 kalem; 193 açık, 12 kapandı.**

Bu dosya **tek tek** kalem listesidir (ne yapılacağına karar vermek için
değil, hiçbir kalemin kaybolmadığını görmek için). Konu bazında gruplanmış,
bağımlılık sırasına dizilmiş ve tetikleyicileri yorumlanmış hâli:
`10-kalan-isler.md`. Bir kalemin **gerekçesinin tamamı** her zaman kendi
§-bölümündedir — burada yalnız başlık, tetikleyici ve durum durur.

Tetikleyici sütunundaki `—`, o kalemin §-bölümünde tetikleyicinin düz yazı
içinde anlatıldığı (ayrıca etiketlenmediği) anlamına gelir.

**Durum sütununun sınırı:** yalnız kaynak tabloda işaretlenmiş (`✅` /
üstü çizili) kapanışları görür. Bir kalem kapandığında bunu kendi
§-tablosuna yazmak bir alışkanlık meselesidir ve geçmiş turlarda düzenli
yapılmamış — yani "açık" görünen kalemlerin bir kısmı kapanmış olabilir.
Başlıktan otomatik çıkarım denenmedi: yanlış kapatılan bir kalem, listenin
hiç olmamasından kötüdür (§55). Bkz. §70 — bu kalemin kendi ertelemesi.

## §5 — `accounting/periods`

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 1 | **P1-2 · Ayrı capability (SoD)** | — | açık |
| 2 | **P2-1 · Klinik saat dilimi / özel hesap dönemi** | — | açık |
| 3 | **Açılış fişi (doc 04 §5 adım 6)** | — | açık |
| 4 | **Listener'ın posting hatasını yutması** | — | açık |
| 5 | **Yarı-açık dönem aralığı** | — | açık |

## §7 — `accounting/posting`

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 6 | **Rol matrisinde storno ayrımı (SoD'nin ikinci yarısı)** | — | açık |
| 7 | **Manuel fiş (storno sonrası doğru kaydı atma yolu)** | — | açık |
| 8 | **P2-1 · Açık yuvarlama modu** ✅ **KAPANDI (§53.6)** | — | ✅ kapandı |
| 9 | **Dinleyicinin hatayı fırlatması (gerçek at-least-once)** | — | açık |
| 10 | **Bilanço `dateFrom` semantiği / açılış fişi** ⚠️ **YARISI KAPANDI (§51.1)** | — | açık |

## §9 — `accounting/chart-of-accounts`

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 11 | **Sapmayı otomatik onaran reconcile komutu** | — | açık |
| 12 | **Sapma için zamanlanmış alarm** | — | açık |
| 13 | **Hesap planını Command Repo'dan okumak** | — | açık |
| 14 | **Hesap planı yönetim ucu (ekle/pasife al/yeniden adlandır)** | — | açık |

## §11 — `accounting/tax-parameters`

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 15 | **Ondalıklı KDV oranı desteği (uçtan uca)** | yasal bir orana ondalık gelirse önce bu migration yapılmalı, `STATUTORY_VAT_RATES` sonra güncellenmeli | açık |
| 16 | **Oran değişikliği için domain olayı / denetim izi** | — | açık |
| 17 | **Mevzuat değişikliğini tüm kliniklere yayan komut** | — | açık |
| 18 | **Controller'ın `clinicId`'yi yalnız `actor.clinicId`'den alması** | — | açık |

## §15 — `invoice` / `purchase-invoice`

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 19 | **Fatura iptali / storno akışı (iki modülde)** ✅ **KAPANDI (§47)** | canlıda ilk hatalı fatura; ya da e-Belge entegratörü devreye alınırken (iptal penceresi mevzuatla sınırlı) | ✅ kapandı |
| 20 | **Alış faturası ödeme durumu (`PAID` / `PARTIALLY_PAID`)** | tedarikçi bazlı vade/yaşlandırma raporu istenirse — o zaman sayaç değil, defterden türeyen bir read-model doğru cevap | açık |
| 21 | **Dönem kapısının fatura kapısına taşınması** ✅ **KAPANDI (2026-10-11)** | — | ✅ kapandı |
| 22 | **e-Belge `FAILED` durumundan çıkış (elle yeniden kuyruğa alma)** | gerçek entegratör adapter'ı yazılırken — `getStatus` ile doğrula, sonra `requeue` komutu ekle | açık |
| 23 | **Alış faturası eşleştirme/koparma için audit olayı** | sipariş-fatura mutabakatında "bu bağ ne zaman koptu" sorusu operasyonda sorulursa | açık |
| 24 | **Sipariş sayacına para `.toNumber()` ile geçiyor** ✅ **KAPANDI (2026-10-12)** | `purchasing` denetim turuydu; o tur yapıldı: `ApplyInvoiceToPurchaseOrderCommand` / `RevertInvoiceFromPurchaseOrderCommand` artık kuruş ölçeğinde ondalık **string** alıyor, üç çağıran `toFixed(2)` gönderiyor — bkz | ✅ kapandı |
| 25 | **KDV oranı kolonlarının `Decimal(5,2)`'ye taşınması** | yasal bir orana ondalık gelirse | açık |

## §19 — `payment` / `payment-gateway`

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 26 | **Kısmi tutar iadesi (taksitin bir kısmı)** | operasyonda "şu 1 | açık |
| 27 | **POS/webhook aktörünün gerçek kullanıcıya bağlanması** ✅ **KAPANDI (§57)** | `pos` denetim turu (§2 tablosunda sırada) | ✅ kapandı |
| 28 | **`InstallmentStatus.OVERDUE`'yu yazan otomasyon** | "vadesi geçmiş taksit" üzerinden tetiklenen bir iş akışı (otomatik hatırlatma/faiz) istenirse | açık |
| 29 | **İade sonrası dış sağlayıcı ↔ yerel durum mutabakatı** | `pos/virtual` denetim turu | açık |
| 30 | **Rapor sorgularında `paginate`** | tek klinikte açık taksit sayısı ~10⁵'e yaklaşırsa | açık |
| 31 | **`payment` modülünde dönem kapısı** | geriye dönük tarihli tahsilat girişi (elle kasa düzeltmesi) eklenirse | açık |

## §22 — `pos/physical` / `pos/virtual`

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 32 | **iyzico Terminal için durum sorgusu (inquiry) entegrasyonu** | iyzico Terminal dokümantasyonunda inquiry ucu doğrulandığında — o zaman `reconcile` sağlayıcıya göre dallanır | açık |
| 33 | **POS entity olaylarının audit log'a yazılması** | hastasız (ödeme kaydı olmayan) kart çekimleri operasyonel olarak kullanılmaya başlanırsa — o akışta ödeme tarafı hiç devreye girmiyor | açık |
| 34 | **Kısmi iadenin ödeme planına yansıtılması** | aynı §19 maddesi (kısmi tutar iadesi talebi) | açık |
| 35 | **`initiate-pos-transaction` akışındaki `TODO: logic hatası olabilir`** | gerçek banka/terminal adapter'ı yazılırken | açık |
| 36 | **Gün sonu (EOD / batch-close) tutarlarının defterle mutabakatı** | `bank` denetim turu (§2) — oto-eşleştirme oradaki kalıpla birlikte tasarlanır | açık |
| 37 | **POS cihaz kimliklerinin şifrelenmesi (at-rest)** | sır yönetimi/PCI turu — tek modülde çözülmemeli | açık |

## §25 — `cash-register` / `bank`

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 38 | **Kasa farkı için eşik + ayrı onay (SoD)** | klinik "X TL üstü kasa açığı müdür onayına düşsün" dediğinde; o zaman eşik ayarı + `CASHSESSION | açık |
| 39 | **Aynı ekstrenin iki kez içe alınması** | mutabakat ekranında mükerrer satır şikâyeti gelirse — doğru çözüm import yanıtında "bu satırların N tanesi zaten mevcut" uyarısı (bloklamadan) | açık |
| 40 | **Kasa → banka transferinin iki uçlu eşleştirilmesi** | "para kasadan çıktı, bankaya hiç girmedi" vakası; o zaman transfer kaydı + iki ucun durum makinesi birlikte kurulur | açık |
| 41 | **POS gün sonu (EOD/batch-close) toplamlarının defterle mutabakatı** | EOD yanıtını kalıcı hale getiren bir iş (POS tarafı) yazıldığında | açık |
| 42 | **`statement-line-matcher`'ın açıklama/karşı taraf benzerliğine göre öğrenmesi** | elle eşleştirme hacmi ölçülüp "makine şu kalıbı %100 doğrulukla buluyor" denebildiğinde | açık |

## §29 — `finance-ledger` / `party`

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 43 | **Cari defterin gider tarafını beslemek** | panelde "kâr/zarar" ya da "gider" gösterilecekse kaynak `accounting` mizanı olmalı; o rapor yazılırken bu alanlar kaldırılır | açık |
| 44 | **Cari hareket için ayrı audit event** | elle cari hareket girişi (ör | açık |
| 45 | **`patientId` ile cari hareket listesinin payment tablosuna `include` etmesi** | payment ayrı servise taşındığında (o noktada satırlara `paymentMethod`/`providerName` denormalize edilir ya da liste projeksiyonu payment tarafında kurulur) | açık |
| 46 | **Organizasyon geneli (konsolide) cari listesi** | franchise sahibinin "tüm şubelerin carileri" ekranı istendiğinde | açık |
| 47 | **Cari kartı için elle düzenleme/pasifleştirme ucu** | "tedarikçinin vergi dairesi yanlış, elle düzeltmek istiyorum" ihtiyacı; o zaman alan-bazlı "elle kilitlendi" işareti de gerekir | açık |
| 48 | **Mutabakat turunun zamanlanmış işe bağlanması** | mutabakat ekranı canlıda kullanılmaya başlayıp "her sabah otomatik dönsün" dendiğinde | açık |

## §33 — `treatment-charge` / `payroll`

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 49 | **Faturadan önce eklenen satır (phantom INSERT) için tam serileştirme** | randevu bazlı bir "fiyatlandırma kapandı" bayrağı/aggregate'i çıkarsa (ör | açık |
| 50 | **İndirim tavanı aşımı için ayrı capability + 4-göz onayı** | klinik "şu orandan fazlasını müdür onaylasın" dediğinde; o zaman eşik + bekleyen durum + ayrı yetki birlikte tasarlanır (kasa farkı onayı §25 ile aynı kalıp) | açık |
| 51 | **Bordro için ayrı yetki (`payroll:*`)** | bordro kalıcı bir tabloya bağlandığında (aşağıdaki madde) yetki de onunla birlikte doğar | açık |
| 52 | **Bordronun kalıcı belgesi (tablo) ve mutabakatı** | bordro hesabı sisteme alınırsa | açık |
| 53 | **Satır bazlı fatura kalemleri (invoice line items)** | gerçek e-belge adapter'ı (§14 | açık |
| 54 | **Karışık KDV oranlı randevunun faturalanması** | yukarıdaki madde | açık |

## §37 — `financial-events` / `e-document`

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 55 | **Dönem kapısının `now` tarihli akışlara (tahsilat/POS/kasa) uygulanması** | geriye dönük tarihli elle tahsilat/kasa düzeltmesi eklenirse (§18 | açık |
| 56 | **Dönemi olmayan klinikte belge kaydının reddi** | klinik kurulumunda dönem açma zorunlu hale gelirse (`ensure-ledger-periods` bütün kiracıları kapsadığında) — o zaman "dönem yok" bir veri hatasıdır ve kapı sertleşir | açık |
| 57 | **Kapanmış döneme düşen belgenin cari açık döneme fişlenmesi (geç gelen belge)** | canlıda ilk "dönem kapandı ama fatura elimde" vakası | açık |
| 58 | **Gövde şemalarının posting kurallarından üretilmesi** | yeni bir posting kuralı eklenirken (o anda iki dosya birlikte düzenlenir) | açık |
| 59 | **`attempts: 5`'in anlamlı hâle getirilmesi (P2-5)** | gerçek adapter'ın `getStatus`'u geldiğinde — o zaman claim sonrası retry **anlamlı** olur (önce doğrula, sonra gönder) ve ayar yeniden tasarlanır | açık |
| 60 | **Faturası bulunamayan e-belge job'unun sesli hâle getirilmesi (P2-6)** | fatura iptali akışı (§15) yazılırken — o zaman "iptal edildi" ile "kayboldu" ayrışır ve ikincisi alarm olur | açık |
| 61 | **e-Belge kalem bazlı XML + satıcı unvanı + `FAILED` → requeue** | entegratör adapter'ı yazılırken (§2'deki `e-document` satırının tam denetimi de o tura kalıyor) | açık |

## §40 — `supply/purchasing`

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 62 | **Mal kabul belgesi (geri alınabilir teslim) ** | ilk hatalı mal kabul vakası ya da depo ekranının canlıya alınması | açık |
| 63 | **Sayaç ↔ fatura toplamı sapma raporu** | fatura iptali akışı (§15) yazılırken — o akış sayaca dokunan ilk "tx dışı" yol olur | açık |
| 64 | **Sipariş gönderimi/iptali için audit olayı** | "bu siparişi kim iptal etti" sorusu operasyonda sorulursa (ya da satın alma ekranları canlıya alınırken) | açık |
| 65 | **Mal kabul için ayrı capability (kural 7)** | depo personelinin satın alma yöneticisinden ayrıldığı ilk kurulum — o an mal kabul depo rolüne, iptal yöneticide kalır | açık |
| 66 | **`ReceiveStockDto.purchasePrice` / `quantity`'nin `number` kalması** | `supply/inventory` turu | ✅ kapandı |
| 67 | **`adjust-stock` / `record-product-usage`'ın kendi kapıları** ✅ **KAPANDI (§41–§43 turunda)** | `supply/inventory` turuydu ve o tur ikisini de düzeltti; bu not **bayat kalmıştı** (bkz | ✅ kapandı |
| 68 | **Sipariş tutarının talep tahmininden sapmasının raporlanması** | bütçe/onay limiti (tutara göre onay kademesi) istenirse — o zaman tahmin bağlayıcı hâle gelir ve onay kapısı tutarı okur | açık |

## §43 — `supply/inventory`

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 69 | **Envanter değeri raporu + 150 hesabıyla mutabakat** ✅ **KAPANDI (§44)** | stok sayımı canlıya alınırken ya da 150 bakiyesi ilk kez sorgulandığında | ✅ kapandı |
| 70 | **Tüketimin muhasebeye fişlenmesi (SMM) / `finance_ledger_id`** ✅ **KAPANDI (§44)** | yukarıdaki değerleme turu — ikisi aynı turda tasarlanır | ✅ kapandı |
| 71 | **`product_prices` tablosu (ölü şema)** | ürün satışı (hasta ya da perakende) ürün fiyatını kullanmaya başlarsa; o an kısmî unique index de eklenir | açık |
| 72 | **Çok partili tüketim (FEFO bölüştürme)** | operasyonda "stok var ama düşemiyorum" vakası | açık |
| 73 | **Sayım düzeltmesi için ayrı capability (kural 7)** | depo personelinin satın alma/klinik yöneticisinden ayrıldığı ilk kurulum (satın alma turunda da aynı not var) | açık |
| 74 | **Tüketimde `usedByProviderId`** | hekim bazlı malzeme tüketimi raporu istenirse | açık |
| 75 | **Ürün KDV oranında `hasTax` çelişkisi** ✅ **KAPANDI (2026-10-13)** | — | ✅ kapandı |
| 76 | **Parti miktarının hareketlerle mutabakatı** | stok sayımı ekranı ya da ilk elle veri düzeltmesi | açık |

## §46 — değerleme / fişleme turu

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 77 | **Parti ↔ alış faturası bağı (yabancı para maliyeti + "mal geldi fatura gelmedi")** | ilk yabancı para alımı ya da ay sonunda ilk "faturası gelmemiş mal" sorusu | açık |
| 78 | **Dönem sonu maliyet aktarımı (740 → 622/620 yansıtma)** | ilk gerçek dönem kapanışı ya da gelir tablosunda hizmet maliyetinin sorulması | açık |
| 79 | **Transfer / iade hareketlerinin fişlenmesi** | klinikler arası transfer ya da tedarikçi iadesi akışı yazılırken (eşleme haritası o anda birlikte güncellenir) | açık |
| 80 | **Değerlemenin tarih bazlı (asOf) olması** | dönem sonu envanter raporu ya da geçmişe dönük mutabakat ihtiyacı | açık |
| 81 | **Sıfır maliyetli (bedelsiz numune) hareketin fişi** | bedelsiz numune/promosyon akışı tanımlanırsa | açık |
| 82 | **`_ctx` lint borcu (posting kuralları)** | posting modülünün kendi turu (§6/§7) ya da lint'in CI'da zorunlu olması | açık |

## §48 — belge iptali turu

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 83 | **İade (refund) akışının iptale bağlanması** | hasta iadesi akışı yazılırken (iptal → iade önerisi olarak bağlanır, otomatik değil) | açık |
| 84 | **Olay defterinde "iptal edildi" işareti** | olay defteri üzerinden doğrudan rapor üreten bir ekran çıkarsa | açık |
| 85 | **`InvoiceStatus.FAILED` ölü değerinin kaldırılması** | fatura durum makinesinin kendi turu | açık |
| 86 | **Dönem kapalıysa iptalin reddi yerine uyarısı** | dönem otomasyonu (§5 kuralı) sonrası ilk operatör şikâyeti | açık |
| 87 | **Kısmî iptal (satır bazlı düzeltme)** | gerçek entegratör adapter'ı + kalem bazlı fatura | açık |
| 88 | **İade faturası (düzeltme belgesi) olarak iptal** | gerçek entegratör adapter'ı; `cancel()` 8 gün dışında hata dönerse iptal yerine iade faturası akışı önerilir | açık |

## §50 — mutabakat turu

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 89 | **GRNI tahakkuk fişinin otomatik atılması (159/326)** | ilk gerçek dönem kapanışı — yıl sonu kapanış komutuyla (§6) ve 740 → 622 yansıtmasıyla (§46) **birlikte** tasarlanmalı | açık |
| 90 | **Parti ↔ alış faturası bağı (yabancı para parti maliyeti)** | ilk yabancı para alımı | açık |
| 91 | **Parti sapmasının alarma bağlanması** | fişlenmemiş olay süpürmesine (§34) bir kalem daha eklenirken aynı işte birlikte yapılır | açık |
| 92 | **Ödeme yöntemi kümesinin DB enum'una çevrilmesi** | olay gövdesi şemalaştırılırsa (bugün planda yok) | açık |
| 93 | **GRNI raporunun tarih penceresi / sayfalama** | bir klinikte sipariş sayısı binleri aşarsa — o zaman doğru çözüm sayfalama değil, siparişe **kapanmış** (üçlü eşleşmesi tamamlanmış) damgası basıp aday kümesini daraltmaktır | açık |

## §52 — raporlama turu

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 94 | **Açılış fişi (590 → 570 devri)** | ikinci dönem kapanışı ya da resmî bilanço çıktısı istendiğinde | açık |
| 95 | **Kapanmış dönemin eski kapanış fişlerinin damgalanması** | kapanışı olan bir kurulum | açık |
| 96 | **`isBalanced`'ın totolojik kalması** | nazım hesaplar (9xx) kullanılmaya başlanırsa | açık |
| 97 | **Bilançonun geçmişe dönük (`asOf`) doğruluğu** | — | açık |
| 98 | **Yarı-açık dönem aralığı (`[from, to)`)** | — | açık |
| 99 | **Rapor çıktılarının dışa aktarımı (e-Defter/XBRL)** | ilk resmî e-Defter dönemi | açık |

## §54 — yuvarlama turu

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 100 | **`Money`'nin kuruş ölçeğini VO'da zorlaması** | — | açık |
| 101 | **`toFixed(2)` ailesinin global ayara bağlılığı** | yeni bir yuvarlanmamış-değer sızıntısı bulunursa | açık |
| 102 | **Açılışta `Decimal` global ayarının doğrulanması** | `Decimal | açık |
| 103 | **`Money.allocate`'in tüketicisiz durması** | sunucuda taksit bölüştürme özelliği | açık |
| 104 | **Satış faturasının kalem bazına geçmesi** | gerçek entegratör adapter'ı + kalem bazlı fatura | açık |
| 105 | **Yuvarlama artığının ayrı hesaba yazılması (kuruş hesabı)** | nakit yuvarlaması (ör | açık |

## §56 — ürün KDV kapısı turu

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 106 | **POS cihazı ↔ defter mutabakatı (EOD beyanı)** — §22/§25'in keskinleşmiş hâli | gerçek sağlayıcı dokümanı/sandbox ile birimin doğrulanması — PAX için ayrıca yanıt alanlarının ayrıştırılması | açık |
| 107 | **Gün sonu beyanının iş günü (`businessDate`) ataması** | mutabakat raporu yazılırken birlikte | açık |
| 108 | **`VatRate.validate.hasTax`'ın kaldırılması** | sıfır oranı reddetmesi gereken ilk yer — ya da bir sonraki hijyen turu | açık |
| 109 | **Ürün kartının `apps/web` tarafı** | envanter ekranları (Faz 3) | açık |

## §58 — POS aktör damgası turu

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 110 | **Satış (SALE) için denetim kaydı** | POS işlem listesi ekranı yazılırken "kim çekti" kolonu talep edilirse — o zaman okuma modeli damgayı taşır, audit log'a ikinci kopya yazılmaz | açık |
| 111 | **Olay `source`'unun (WEB/MOBILE) taşınması** | kanal bazlı denetim raporu istenirse — o zaman doğru yer `ExecutionContext`'in olayla birlikte mühürlenmesidir, tek alan değil | açık |
| 112 | **Eski satırların damgasının geriye doldurulması** | yok — bu kalıcı bir karar | açık |
| 113 | **Ayrı capability (POS iptal/iade yetkisi)** | rol matrisi turu (bkz | açık |
| 114 | **`pos_transactions` okuma ucunda damganın gösterilmesi** | POS işlem listesi ekranı (iş paketi 13) | açık |

## §60 — abonelik tahsilatı turu

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 115 | **Abonelik tahsilatının muhasebeye fişlenmesi** | platformun kendi beyanı/faturası gündeme geldiğinde — o zaman olay tipi + posting kuralı + e-belge birlikte tasarlanır | açık |
| 116 | **İade (refund) akışı** | ilk abonelik iadesi talebi; `10-kalan-isler | açık |
| 117 | **`findUnresolved` için zamanlanmış rapor** | ilk gerçek `PENDING` vakası ya da fişlenmemiş olay süpürmesine (§34) bir kalem daha eklenirken aynı işte birlikte | açık |
| 118 | **Yenilemede `paidPrice` okunması** | yenilemenin taksitlendirilmesi (o an fark gerçek olur) | açık |
| 119 | **Geçmiş tahsilatların deftere geriye doldurulması** | yok — kalıcı karar | açık |
| 120 | **Abonelik tutarının `Money` olarak taşınması (uçtan uca)** | `10-kalan-isler | açık |
| 121 | **`crm/health-tourism` ve diğer finans-dışı para yolları** | sıradaki tur — `10-kalan-isler | açık |

## §62 — ödeme linkleri turu

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 122 | **Süresi geçmiş ödeme linklerinin süpürülmesi (`markExpired`)** | ilk "linki geç ödedi" vakası ya da zamanlanmış işlerin (§5 kuralı) gözden geçirildiği tur — o zaman süpürme + `expireLink` best-effort birlikte eklenir | açık |
| 123 | **İkinci çekimin kalıcı kaydı (satır/kolon)** | çift çekim operasyonda tekrarlayan bir vaka hâline gelirse — o an sayılabilir/raporlanabilir bir kayıt gerekir | açık |
| 124 | **İade tutarının `number` olarak sağlayıcıya geçmesi** | para tiplerinin uçtan uca string'e çekildiği hijyen turu (`10-kalan-isler | açık |
| 125 | **Platform defterine yazımın `best-effort` kalması** | yok (kabul edilmiş tasarım) | açık |
| 126 | **`crm/health-tourism` hotel/transfer modüllerinin kendi turu** | komisyon oranı değişikliği ya da ilk fiyat uyuşmazlığı şikâyeti | açık |

## §64 — fiyat türetme turu

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 127 | **Sağlayıcıya `tolerance` gönderilmesi** | sağlayıcı dokümanı/sandbox ile doğrulama (§56 ile aynı aile: doğrulanmamış sağlayıcı semantiğine davranış bağlanmaz) | açık |
| 128 | **Maliyetin altında satışta zararın hesaplanması** | ilk maliyet-altı rezervasyon — o an hesap seçilip kurala eklenir | açık |
| 129 | **Transfer satış tabanının `netAmount`'a çekilmesi** | ilk tedarikçi faturası mutabakatı — fatura hangi tutardan kesiliyorsa taban odur | açık |
| 130 | **`hotelbeds_bookings.service_fee` kolonunun kaldırılması** | hijyen turu (`10-kalan-isler | açık |
| 131 | **Müşteriye giden referans kodunun sağlayıcı referansı olması** | rezervasyon ekranı / mesaj şablonlarının gözden geçirilmesi | açık |
| 132 | **Manuel override rezervasyonlarının deftere girmesi** | kanal dışı tahsilatın (nakit/havale) kayda bağlanması | açık |
| 133 | **Fiyatı okunamayan OTEL seçeneğinin listeden atılması** | yok (ölçülmüş denge) | açık |

## §66 — iade turu

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 134 | ~~**Rezervasyon iadesinin platform defterini ters kaydetmesi**~~ **✅ §67** | sıradaki tur | ✅ kapandı |
| 135 | **Nakit tahsilat/iadenin ekonomik olayı** | nakit tahsilatın ödeme planına bağlanması | açık |
| 136 | **Kısmi iadenin ödeme planına ve cari deftere yansıması** | operasyonda kısmi iade talebi — aynı §19 maddesi | açık |
| 137 | **İade sonrası sağlayıcı ↔ yerel durum mutabakatı** | ilk "iade edildi mi edilmedi mi" vakası | açık |
| 138 | **İadenin iptale (storno) bağlanması** | hasta-yüzü iade ekranı | açık |
| 139 | **Ayrı capability (iade yetkisi)** | — | açık |

## §68 — rezervasyon iadesi turu

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 140 | **Otel iptal cezasının okunması** | sandbox'ta ücretli bir iptal yapılıp yanıt gövdesi doğrulanınca — değişiklik tek satır (`cancelBooking` gövdeyi parse edip `retained` doldurur, `toSupplierRetainedCost` zaten hazır) | açık |
| 141 | ~~**Platform defteri için "eksik kalanlar" sorgusu + backfill**~~ **✅ §69** | sıradaki tur | ✅ kapandı |
| 142 | **İptal cezasının satış fiyatından mahsubu** | iptal politikasının ürün kararı olarak verilmesi | açık |
| 143 | **İade kuru ile tahsilat kurunun farkı (108 kalıntısı)** | kambiyo farkı turu | açık |
| 144 | **659 vs 689 (iptal cezasının hesabı)** | şablon sapma turu | açık |
| 145 | **İkinci tahsilatın (çift çekim) deftere girmemesi** | 108 → 102 aktarım/mutabakat turu | açık |
| 146 | **Rezervasyon iptalinin kendi yetkisi** | — | açık |

## §70 — telafi yolu turu

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 147 | **Telafi turunun zamanlanmış işe bağlanması** | zamanlanmış finans işlerinin (§5 kuralı) gözden geçirildiği tur — POS ve rezervasyon birlikte | açık |
| 148 | **Fişlenmemiş olay süpürmesiyle tek rapor** | finans mutabakat ekranının tasarlandığı tur | açık |
| 149 | **`FindExistingFinancialEventRefsQuery`'nin dedupeKey'e taşınması** | üçüncü bir modül aynı engele düştüğünde | açık |
| 150 | **Telafi yetkisinin ayrılması** | — | açık |
| 151 | **Telafi turunun kendi damgası** | iş paketi 4 (damga ve yetki aynı turda) | açık |
| 152 | **Ham erteleme listesinin "durum" sütununun güvenilirliği** | erteleme listesinin kendi denetim turu (§55/§57'nin üçüncüsü) — o turda her açık kalem tek tek ölçülür ve kapananlar kaynakta işaretlenir | açık |

## §72 — yabancı para turu

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 153 | **Realize kur farkının tanınması (646/656)** | ilk yabancı para faturası ya da yabancı cari bakiyesi | açık |
| 154 | **Dönem sonu kur değerlemesi** | — | açık |
| 155 | **Yabancı para alt defteri raporu** | ilk sağlayıcı mutabakatı (HotelBeds ekstresi) | açık |
| 156 | **Sağlayıcı kesintisi + 108 → 102 aktarımı** | ilk sağlayıcı hesap kapaması (payout) mutabakatı | açık |
| 157 | **`FX_*` env değerlerinin yapılandırılması** | — | açık |
| 158 | **Kur tarihinin fiş satırında saklanması** | — | açık |
| 159 | **Fonksiyonel paranın TRY dışı olması** | ilk TRY-olmayan fonksiyonel paralı klinik | açık |
| 160 | **Çift-çekim iadesinin kendi tutarıyla deftere girmesi** | — | açık |
| 161 | **Dört spec dosyasındaki `unbound-method` lint borcu** | — | açık |

## §74 — webhook güvenliği turu

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 162 | **Fiziksel POS callback'inde gövde ↔ yol bağı** | ilk gerçek fiziksel POS adapter'ı | açık |
| 163 | **Abonelik callback'inde yerel token kanıtı** | abonelik ödeme akışının bir sonraki turu (tutar kapısıyla birlikte) | açık |
| 164 | **Abonelikte sepet tutarı kapısı** | yukarıdaki kalemle aynı tur | açık |
| 165 | **`paidPrice` ↔ `price` mutabakat raporu** | — | açık |
| 166 | **`StubBillingAdapter`'ın koşulsuz başarı dönmesi** | adapter seçimi env'e bağlanırsa | açık |
| 167 | **Callback uçlarının tekrar-oynatma penceresi** | iyzico imza doğrulama dokümanı netleşirse | açık |
| 168 | **`@Public` para uçlarının tek listede izlenmesi** | beşinci para ucu | açık |

## §76 — hassas veri turu

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 169 | **Sağlayıcı blob'unun tanı alt kümesine indirilmesi** | ilk sağlayıcı itirazı / mutabakat turu | açık |
| 170 | **`raw_response` saklama süresi ve temizleme işi** | — | açık |
| 171 | **Kart saklama token'larının şifrelenmesi** | — | açık |
| 172 | **`@Serialize` kapsamının tamamlanması** | serileştirme yayılımının Faz 2'si | açık |
| 173 | **e-Nabız blob'una maskeleme** | — | açık |
| 174 | **Log saklama politikasının belgelenmesi** | KVKK uyum dokümantasyonu | açık |

## §78 — outbox teslim turu

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 175 | **Ölü mektup yeniden deneme komutu** (uçtan/CLI'dan `attempts` sıfırlama) | — | açık |
| 176 | **Outbox saklama / temizleme işi** | — | açık |
| 177 | **Backlog yaşı alarmı** (en yaşlı bekleyen kayıt > eşik) | — | açık |
| 178 | **Payload sözleşmesi: outbox düz JSON taşır** | — | açık |
| 179 | **Dinleyici başına teslim kaydı** | — | açık |
| 180 | **In-memory kanalda bitiş sırası** | — | açık |
| 181 | **`attempts` ayrımı** | — | açık |

## §80 — önbellek/teklif turu

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 182 | **Teklif tek kullanımlık değil** | — | açık |
| 183 | **Transfer müsaitlik önbelleğinin kiracı kapsamı** | — | açık |
| 184 | **Teklif önbelleğinin DB yedeği** | — | açık |
| 185 | **`conversationId` yerine hasta/lead bağı** | — | açık |
| 186 | **Dağıtık kilidin ikinci kullanım yeri** | — | açık |
| 187 | **Aktör önbelleğinde yetki geri alma** | — | açık |

## §82 — değişmezler turu

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 188 | **Hasta borç tavanı** (`allowNegativeBalance`, `maxNegativeBalanceAmount`) | — | açık |
| 189 | **`NOT VALID` → `VALIDATE CONSTRAINT`** | — | açık |
| 190 | **Fiş başına denge DB'de** | defterin yazma yoluna görünmez bir mantık ekler (hata mesajı uygulamanın tipli hatası olmaz) — bugün uygulama kapısı + tarama yeterli Uygulamayı atlayan bir yazma yolu doğarsa (veri taşıma betiği, raw SQL toplu düzeltme) | açık |
| 191 | **Taramanın zamanlanmış işe bağlanması** | — | açık |
| 192 | **`toFixed(2)`'nin para üreten çağrı yerleri** | — | açık |
| 193 | **`invoicePrefix` ayarı** | — | açık |
| 194 | **`ProjectCost` satırının silinebilmesi** | — | açık |

## §84 — alarm turu

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 195 | **İz kaybının kalıcı telafisi** (audit log) | — | açık |
| 196 | **Uyarı fırtınası sınırı** (operasyon başına üst sınır) | — | açık |
| 197 | **Uyarıların bir panoda toplanması** (alert geçmişi) | — | açık |
| 198 | **Sağlık kontrolü ucunun uyarıya bağlanması** | — | açık |
| 199 | **Yığın izinin kanala taşınması** | — | açık |

## §86 — hesap kapaması turu

| # | Kalem | Tetikleyici | Durum |
| --- | --- | --- | --- |
| 200 | **Komisyonun KDV'si (191)** | — | açık |
| 201 | **108'in sağlayıcı bazında alt hesaplanması (108.01/108.02)** | — | açık |
| 202 | **Bekleyen tahsilatların FIFO yaşlandırma raporu** | — | açık |
| 203 | **Banka ekstresi satırı ↔ hesap kapaması otomatik eşleşmesi** | — | açık |
| 204 | **Sağlayıcı payout API'si** | — | açık |
| 205 | **Platform defterinin 108'i** | — | açık |
