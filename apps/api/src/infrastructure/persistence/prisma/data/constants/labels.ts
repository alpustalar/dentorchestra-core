/**
 * Yetki (capability) adlarının kullanıcıya gösterilen Türkçe karşılıkları.
 *
 * Anahtar = Prisma model adının küçük harfli hâli (`capabilityHelper` bu şekilde
 * üretir). Etiketi olmayan model, rol yönetimi ekranında ham model adıyla görünür
 * (`lead Oluştur` gibi) — bu yüzden **yeni bir Prisma modeli eklendiğinde buraya
 * da bir satır eklenir**.
 */
export const MODULE_LABELS = {
  // --- Kimlik & yetkilendirme ---
  user: 'Kullanıcı',
  role: 'Rol',
  rolecapability: 'Rol Yetkisi',
  usercapability: 'Kullanıcıya Özel Yetki',
  capability: 'Yetki',

  // --- Organizasyon & klinik ---
  organization: 'Organizasyon',
  organizationfinancesettings: 'Organizasyon Finans Ayarları',
  clinic: 'Klinik',
  clinicavailability: 'Klinik Çalışma Saatleri',
  clinicexception: 'Klinik Tatil / İstisna Günleri',
  clinicportalsettings: 'Klinik Portal Ayarları',
  clinicappointmentsettings: 'Klinik Randevu Ayarları',
  clinicfinancesettings: 'Klinik Finans Ayarları',
  clinicgovernmentspecs: 'Klinik Resmî Kurum Bilgileri',
  sector: 'Sektör',
  language: 'Dil',

  // --- Hizmet verenler ---
  provider: 'Hizmet Veren',
  providertreatment: 'Hizmet Veren Tedavi',
  providershift: 'Hizmet Veren Çalışma Saatleri (Shift)',
  provideravailability: 'Hizmet Veren Müsaitliği',
  providerexception: 'Hizmet Veren İzin / İstisna Günleri',
  providertitle: 'Hizmet Veren Unvanı',
  providertitletranslation: 'Hizmet Veren Unvanı Dil Çevirisi',
  providerspecialty: 'Hizmet Veren Uzmanlığı',
  providerspecialtytranslation: 'Hizmet Veren Uzmanlığı Dil Çevirisi',

  // --- Hasta & klinik kayıtlar ---
  patient: 'Hasta',
  patientgroup: 'Hasta Grubu',
  medicalfile: 'Medikal Dosya',
  appointment: 'Randevu',
  appointmentdiagnosis: 'Randevu Tanısı',
  appointmentprocedure: 'Randevu İşlemi',
  // pgvector modeli (AI arama indeksi): şemada var, etiketi yoktu — `prisma
  // generate` istemciyi tazeleyince roles.spec'in etiket kapsamı kırmızıya düştü.
  appointmentembedding: 'Randevu Vektör İndeksi (AI)',
  enabizsync: 'e-Nabız Senkronizasyonu',
  consentformtemplate: 'Onam Formu Şablonu',
  consentformsubmission: 'Onam Formu Kaydı',
  resource: 'Kaynak (Oda / Cihaz)',
  resourceavailability: 'Kaynak Müsaitliği',

  // --- Tedavi kataloğu ---
  treatment: 'Tedavi',
  mastertreatment: 'Ana Tedavi',
  treatmenttranslation: 'Tedavi Dil Çevirisi',
  treatmentcategory: 'Tedavi Kategorisi',
  treatmentcategorytranslation: 'Tedavi Kategorisi Dil Çevirisi',
  treatmentpackage: 'Tedavi Paketi',
  treatmentpackageitem: 'Tedavi Paketi Kalemi',
  treatmentpackageprovider: 'Tedavi Paketi Hizmet Vereni',
  patienttreatmentpackage: 'Hastanın Tedavi Paketi',
  treatmentcharge: 'İşlem Ücret Satırı',

  // --- CRM & pazarlama ---
  lead: 'Potansiyel Hasta (Lead)',
  activity: 'Görüşme / Aktivite',
  pipeline: 'Satış Hunisi',
  pipelinestage: 'Satış Hunisi Aşaması',
  metaadaccount: 'Meta Reklam Hesabı',
  metacampaignmetric: 'Meta Kampanya Metriği',
  metalead: 'Meta Lead',

  // --- Sağlık turizmi ---
  hotelbedshotel: 'Otel Kataloğu',
  hotelbedsbooking: 'Otel Rezervasyonu',
  hotelbedstransferbooking: 'Transfer Rezervasyonu',
  duffelflightbooking: 'Uçuş Rezervasyonu',
  clinichealthtourismconfig: 'Sağlık Turizmi Ayarları',
  bookingpayment: 'Rezervasyon Ödemesi',
  bookingpaymentrefund: 'Rezervasyon İadesi (Elle Doğrulama)',

  // --- Faturalama & tahsilat ---
  invoice: 'Satış Faturası',
  purchaseinvoice: 'Alış Faturası',
  party: 'Cari Hesap',
  taxparameter: 'Vergi Parametresi',
  financeledger: 'Cari Hareket Defteri',
  payment: 'Tahsilat / Ödeme',
  paymentinstallment: 'Taksit',
  iyzicotransaction: 'İyzico İşlemi',
  clinicpaymentgateway: 'Sanal POS Ayarları',
  posdevice: 'POS Cihazı',
  postransaction: 'POS İşlemi',
  cliniciyzicoterminalconfig: 'İyzico Terminal Ayarları',

  // --- Kasa & banka ---
  cashregister: 'Kasa',
  cashsession: 'Kasa Oturumu',
  cashmovement: 'Kasa Hareketi',
  bankaccount: 'Banka Hesabı',
  bankstatement: 'Banka Ekstresi',
  bankstatementline: 'Ekstre Satırı',
  providersettlement: 'Sağlayıcı Hesap Kapaması',
  cardchargeback: 'Kart İtirazı (Ters İbraz)',

  // --- Muhasebe ---
  account: 'Hesap Planı',
  accountingperiod: 'Muhasebe Dönemi',
  journalentry: 'Yevmiye Fişi',
  journalline: 'Yevmiye Satırı',
  financialevent: 'Finansal Olay',

  // --- Stok & satın alma ---
  productcategory: 'Ürün Kategorisi',
  product: 'Ürün',
  productbatch: 'Ürün Partisi (Lot)',
  productprice: 'Ürün Fiyatı',
  productusage: 'Ürün Kullanımı',
  stockmovement: 'Stok Hareketi',
  supplier: 'Tedarikçi',
  purchaserequest: 'Satın Alma Talebi',
  purchaserequestitem: 'Satın Alma Talebi Kalemi',
  purchaseorder: 'Satın Alma Siparişi',
  purchaseorderitem: 'Satın Alma Siparişi Kalemi',
  purchaseorderreceipt: 'Mal Kabul Kaydı',
  purchaseorderreceiptline: 'Mal Kabul Kaydı Satırı',
  externalworkorder: 'Dış İş Emri',
  externalworkorderitem: 'Dış İş Emri Kalemi',

  // --- İnsan kaynakları ---
  employee: 'Personel',
  employeecontract: 'Personel Sözleşmesi',
  leaverequest: 'İzin Talebi',
  attendancerecord: 'Giriş / Çıkış Kaydı',

  // --- Proje yönetimi ---
  project: 'Proje',
  projectphase: 'Proje Aşaması',
  projecttask: 'Proje Görevi',
  projectcost: 'Proje Maliyeti',
  projectresourceallocation: 'Proje Kaynak Tahsisi',

  // --- Platform ---
  adminrequest: 'Yönetici Talebi',
  auditlog: 'Log',
  outbox: 'Giden Kutusu (Outbox)',
  staffnotification: 'Personel Bildirimi',
  module: 'Abonelik Modülü',
  plan: 'Abonelik Planı',
  planmodule: 'Plan Modülü',
  subscription: 'Abonelik',
  subscriptionitem: 'Abonelik Kalemi',
  subscriptionpaymentmethod: 'Abonelik Ödeme Yöntemi',
  subscriptioncharge: 'Abonelik Tahsilatı',

  // --- Sanal (tek tabloya karşılık gelmeyen) yetki alanları ---
  finance: 'Finansal Veri',
} as const;

export type ModuleLabel = (typeof MODULE_LABELS)[keyof typeof MODULE_LABELS];

export const CRUD_ACTION_LABELS = {
  create: 'Oluştur',
  read: 'Görüntüle',
  update: 'Güncelle',
  delete: 'Sil',
} as const;

export type ActionLabel =
  (typeof CRUD_ACTION_LABELS)[keyof typeof CRUD_ACTION_LABELS];
