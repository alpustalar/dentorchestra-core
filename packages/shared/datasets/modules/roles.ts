import { CAPABILITIES } from './capabilities';
import {
  fullAccess,
  getAllSystemCapabilities,
  manage,
  readOnly,
  submitOnly,
  uniqueCapabilities,
} from '../utils';
import { ROLE_SLUGS } from '@shared/datasets';

const {
  // Kimlik & yetkilendirme
  USER,
  ROLE,
  // Organizasyon & klinik
  ORGANIZATION,
  ORGANIZATIONFINANCESETTINGS,
  CLINIC,
  CLINICAVAILABILITY,
  CLINICEXCEPTION,
  CLINICPORTALSETTINGS,
  CLINICAPPOINTMENTSETTINGS,
  CLINICFINANCESETTINGS,
  CLINICGOVERNMENTSPECS,
  SECTOR,
  LANGUAGE,
  // Hizmet verenler
  PROVIDER,
  PROVIDERTREATMENT,
  PROVIDERSHIFT,
  PROVIDERAVAILABILITY,
  PROVIDEREXCEPTION,
  PROVIDERTITLE,
  PROVIDERSPECIALTY,
  // Hasta & klinik kayıtlar
  PATIENT,
  PATIENTGROUP,
  MEDICALFILE,
  APPOINTMENT,
  APPOINTMENTDIAGNOSIS,
  APPOINTMENTPROCEDURE,
  ENABIZSYNC,
  CONSENTFORMTEMPLATE,
  CONSENTFORMSUBMISSION,
  RESOURCE,
  RESOURCEAVAILABILITY,
  // Tedavi kataloğu
  TREATMENT,
  MASTERTREATMENT,
  TREATMENTCATEGORY,
  TREATMENTPACKAGE,
  TREATMENTPACKAGEITEM,
  TREATMENTPACKAGEPROVIDER,
  PATIENTTREATMENTPACKAGE,
  TREATMENTCHARGE,
  // CRM & pazarlama
  LEAD,
  ACTIVITY,
  PIPELINE,
  PIPELINESTAGE,
  METAADACCOUNT,
  METACAMPAIGNMETRIC,
  METALEAD,
  // Sağlık turizmi
  HOTELBEDSHOTEL,
  HOTELBEDSBOOKING,
  HOTELBEDSTRANSFERBOOKING,
  DUFFELFLIGHTBOOKING,
  CLINICHEALTHTOURISMCONFIG,
  BOOKINGPAYMENT,
  // Faturalama & tahsilat
  INVOICE,
  PURCHASEINVOICE,
  PARTY,
  TAXPARAMETER,
  FINANCELEDGER,
  PAYMENT,
  PAYMENTINSTALLMENT,
  IYZICOTRANSACTION,
  CLINICPAYMENTGATEWAY,
  POSDEVICE,
  POSTRANSACTION,
  CLINICIYZICOTERMINALCONFIG,
  // Kasa & banka
  CASHREGISTER,
  CASHSESSION,
  CASHMOVEMENT,
  BANKACCOUNT,
  BANKSTATEMENT,
  BANKSTATEMENTLINE,
  PROVIDERSETTLEMENT,
  // Muhasebe
  ACCOUNT,
  ACCOUNTINGPERIOD,
  JOURNALENTRY,
  JOURNALLINE,
  FINANCIALEVENT,
  // Stok & satın alma
  PRODUCTCATEGORY,
  PRODUCT,
  PRODUCTBATCH,
  PRODUCTPRICE,
  PRODUCTUSAGE,
  STOCKMOVEMENT,
  SUPPLIER,
  PURCHASEREQUEST,
  PURCHASEORDER,
  EXTERNALWORKORDER,
  // İnsan kaynakları
  EMPLOYEE,
  EMPLOYEECONTRACT,
  LEAVEREQUEST,
  ATTENDANCERECORD,
  // Proje yönetimi
  PROJECT,
  PROJECTPHASE,
  PROJECTTASK,
  PROJECTCOST,
  PROJECTRESOURCEALLOCATION,
  // Platform
  ADMINREQUEST,
  AUDITLOG,
  STAFFNOTIFICATION,
  SUBSCRIPTION,
  SUBSCRIPTIONCHARGE,
  PLAN,
  MODULE,
  // Sanal (kesitsel) alan
  FINANCE,
} = CAPABILITIES;

// ============================================================================
// YETKİ DEMETLERİ (BUNDLE)
// ----------------------------------------------------------------------------
// Roller modelleri tek tek saymaz; işlevsel demetleri birleştirir. Yeni bir
// Prisma modeli eklendiğinde ilgili demete yazılır ve o demeti taşıyan tüm
// roller yetkiyi otomatik alır.
// ============================================================================

/** Klinik takvimi: randevu, kaynak (oda/cihaz), hizmet veren müsaitliği. */
const SCHEDULING = [
  APPOINTMENT,
  RESOURCE,
  RESOURCEAVAILABILITY,
  PROVIDERAVAILABILITY,
  PROVIDEREXCEPTION,
  PROVIDERSHIFT,
];

/** Hasta dosyası ve klinik kayıtlar (tıbbi gizlilik alanı). */
const CLINICAL_RECORDS = [
  MEDICALFILE,
  APPOINTMENTDIAGNOSIS,
  APPOINTMENTPROCEDURE,
  ENABIZSYNC,
  CONSENTFORMSUBMISSION,
];

/** Tedavi kataloğu — fiyat/paket tanımları dahil. */
const TREATMENT_CATALOG = [
  TREATMENT,
  MASTERTREATMENT,
  TREATMENTCATEGORY,
  TREATMENTPACKAGE,
  TREATMENTPACKAGEITEM,
  TREATMENTPACKAGEPROVIDER,
  PATIENTTREATMENTPACKAGE,
  TREATMENTCHARGE,
  PROVIDERTREATMENT,
];

/** Satış hunisi: lead, görüşme kaydı, huni/aşama. */
const CRM = [LEAD, ACTIVITY, PIPELINE, PIPELINESTAGE];

/** Reklam entegrasyonu ve kampanya metrikleri. */
const MARKETING = [METAADACCOUNT, METACAMPAIGNMETRIC, METALEAD];

/** Sağlık turizmi: otel/transfer/uçuş rezervasyonu ve rezervasyon tahsilatı. */
const HEALTH_TOURISM = [
  HOTELBEDSHOTEL,
  HOTELBEDSBOOKING,
  HOTELBEDSTRANSFERBOOKING,
  DUFFELFLIGHTBOOKING,
  BOOKINGPAYMENT,
];

/**
 * Faturalama: satış/alış faturası, cari hesap, vergi parametresi ve faturanın
 * dayanağı olan fiyatlı işlem satırları.
 */
const BILLING = [
  INVOICE,
  PURCHASEINVOICE,
  PARTY,
  TAXPARAMETER,
  FINANCELEDGER,
  TREATMENTCHARGE,
];

/** Tahsilat: ödeme, taksit, sanal/fiziksel POS işlemleri. */
const COLLECTION = [
  PAYMENT,
  PAYMENTINSTALLMENT,
  IYZICOTRANSACTION,
  POSTRANSACTION,
  POSDEVICE,
];

/** Kasa ve banka mutabakatı. */
const TREASURY = [
  CASHREGISTER,
  CASHSESSION,
  CASHMOVEMENT,
  BANKACCOUNT,
  BANKSTATEMENT,
  BANKSTATEMENTLINE,
  // Sağlayıcı hesap kapaması (108 → 102 + 653): kasa/banka mutabakatının
  // parçası — kartla tahsil edilen paranın bankaya geçişini kaydeder.
  PROVIDERSETTLEMENT,
];

/** Çift taraflı muhasebe: hesap planı, dönem, yevmiye, finansal olay parkesi. */
const ACCOUNTING = [
  ACCOUNT,
  ACCOUNTINGPERIOD,
  JOURNALENTRY,
  JOURNALLINE,
  FINANCIALEVENT,
];

/** Stok: ürün kartı, parti/lot, fiyat, hareket, kullanım, tedarikçi. */
const INVENTORY = [
  PRODUCTCATEGORY,
  PRODUCT,
  PRODUCTBATCH,
  PRODUCTPRICE,
  PRODUCTUSAGE,
  STOCKMOVEMENT,
  SUPPLIER,
];

/** Satın alma ve dış iş emri (protez/laboratuvar vb.). */
const PROCUREMENT = [PURCHASEREQUEST, PURCHASEORDER, EXTERNALWORKORDER];

/** İnsan kaynakları: personel, sözleşme, izin, mesai. */
const HR = [EMPLOYEE, EMPLOYEECONTRACT, LEAVEREQUEST, ATTENDANCERECORD];

/** Proje yönetimi: proje, aşama, görev, maliyet, kaynak tahsisi. */
const PROJECT_MANAGEMENT = [
  PROJECT,
  PROJECTPHASE,
  PROJECTTASK,
  PROJECTCOST,
  PROJECTRESOURCEALLOCATION,
];

/** Klinik yapılandırması (ayar satellite'leri). */
const CLINIC_SETTINGS = [
  CLINICAVAILABILITY,
  CLINICEXCEPTION,
  CLINICPORTALSETTINGS,
  CLINICAPPOINTMENTSETTINGS,
  CLINICGOVERNMENTSPECS,
];

/** Finansal yapılandırma — para birimi, sanal POS ve terminal kimlikleri. */
const FINANCE_SETTINGS = [
  CLINICFINANCESETTINGS,
  CLINICPAYMENTGATEWAY,
  CLINICIYZICOTERMINALCONFIG,
];

/** Her personelin sahip olduğu taban: kendi bildirimleri + ortak katalog okuma. */
const BASELINE = [
  ...manage(STAFFNOTIFICATION),
  ...readOnly(SECTOR, LANGUAGE, PROVIDERTITLE, PROVIDERSPECIALTY),
];

/**
 * Kendi özlük kaydını görüntüleme + izin talebi açma + giriş/çıkış kaydı.
 * Kayıt sahipliği (yalnız kendi kaydı) policy katmanında zorlanır; yetki yalnız
 * "bu ekranı kullanabilir" der.
 */
const SELF_SERVICE = [
  ...readOnly(EMPLOYEE),
  ...submitOnly(LEAVEREQUEST, ATTENDANCERECORD),
];

/**
 * Bir kliniğin tam yönetimi. Klinik sahibi (mesul müdür) ve bölge müdürü
 * **aynı** yetki setini taşır — aralarındaki fark yetkinin *kapsamıdır*, içeriği
 * değil: bölge müdürü birden çok kliniği yönetir, mesul müdür birini. Kapsam
 * `managedClinics` üzerinden policy katmanında zorlanır.
 *
 * (Aksi hâlde kıdemi yüksek rol daha az yetkili olurdu.)
 */
const CLINIC_MANAGEMENT = [
  ...BASELINE,
  ...readOnly(ORGANIZATION),
  ...manage(CLINIC, ...CLINIC_SETTINGS),
  ...fullAccess(USER),
  ...fullAccess(PROVIDER, ...SCHEDULING),
  ...fullAccess(PATIENT, PATIENTGROUP),
  ...readOnly(...CLINICAL_RECORDS),
  ...manage(CONSENTFORMTEMPLATE),
  ...manage(...TREATMENT_CATALOG),
  ...manage(...CRM, ...MARKETING),
  ...manage(...HEALTH_TOURISM),
  ...manage(CLINICHEALTHTOURISMCONFIG),
  ...fullAccess(...BILLING, ...COLLECTION, ...TREASURY),
  ...readOnly(...ACCOUNTING),
  ...manage(...FINANCE_SETTINGS),
  ...manage(...INVENTORY, ...PROCUREMENT),
  ...manage(...HR),
  ...manage(...PROJECT_MANAGEMENT),
  ...readOnly(AUDITLOG),
  FINANCE.read,
  FINANCE.update,
];

export const rolesCreateManyInputs = [
  {
    slug: ROLE_SLUGS.ADMIN,
    name: 'Sistem Yöneticisi',
    priority: 100,
    caps: getAllSystemCapabilities(),
    isSystemRole: true,
  },
  {
    // Tüm kliniklerin sahibi: operasyonun tamamı + finansın tamamı.
    // Platform kataloğu (plan/modül tanımı, sektör, dil) yalnız sistem yöneticisindedir.
    slug: ROLE_SLUGS.ORGANIZATION_OWNER,
    name: 'Organizasyon Sahibi',
    priority: 95,
    isSystemRole: true,
    caps: uniqueCapabilities([
      ...BASELINE,
      ...manage(ORGANIZATION, ORGANIZATIONFINANCESETTINGS),
      ...fullAccess(CLINIC, ...CLINIC_SETTINGS),
      ...fullAccess(USER),
      ...readOnly(ROLE),
      ...fullAccess(PROVIDER, ...SCHEDULING),
      ...fullAccess(PATIENT, PATIENTGROUP),
      ...fullAccess(...CLINICAL_RECORDS, CONSENTFORMTEMPLATE),
      ...fullAccess(...TREATMENT_CATALOG),
      ...fullAccess(...CRM, ...MARKETING),
      ...fullAccess(...HEALTH_TOURISM, CLINICHEALTHTOURISMCONFIG),
      ...fullAccess(...BILLING, ...COLLECTION, ...TREASURY, ...ACCOUNTING),
      ...manage(...FINANCE_SETTINGS),
      ...fullAccess(...INVENTORY, ...PROCUREMENT),
      ...fullAccess(...HR),
      ...fullAccess(...PROJECT_MANAGEMENT),
      ...manage(ADMINREQUEST),
      ...readOnly(AUDITLOG, SUBSCRIPTION, SUBSCRIPTIONCHARGE, PLAN, MODULE),
      FINANCE.read,
      FINANCE.update,
    ]),
  },
  {
    // Birden çok kliniği yönetir. Yetki *içeriği* klinik sahibiyle aynıdır;
    // fark kapsamdadır (managedClinics) ve policy katmanında zorlanır.
    slug: ROLE_SLUGS.BRANCH_MANAGER,
    name: 'Bölge / Şube Müdürü',
    priority: 85,
    isSystemRole: true,
    caps: uniqueCapabilities([...CLINIC_MANAGEMENT, ...readOnly(ADMINREQUEST)]),
  },
  {
    // Tek kliniğin mesul müdürü: kendi kliniğinin operasyonunun tamamı.
    slug: ROLE_SLUGS.CLINIC_OWNER,
    name: 'Klinik Sahibi / Mesul Müdür',
    priority: 80,
    isSystemRole: true,
    caps: uniqueCapabilities(CLINIC_MANAGEMENT),
  },
  {
    // Hekim: kendi hastası ve randevusu üzerinde tam; tıbbi kayıt asıl işidir.
    // Ticari/finansal alan yoktur.
    slug: ROLE_SLUGS.PROVIDER,
    name: 'Hizmet Veren',
    priority: 70,
    isSystemRole: true,
    caps: uniqueCapabilities([
      ...BASELINE,
      ...SELF_SERVICE,
      ...manage(PATIENT),
      ...readOnly(PATIENTGROUP),
      ...manage(...SCHEDULING),
      ...manage(...CLINICAL_RECORDS),
      ...readOnly(CONSENTFORMTEMPLATE),
      ...readOnly(...TREATMENT_CATALOG),
      ...readOnly(PROVIDER),
      ...submitOnly(PRODUCTUSAGE),
      ...readOnly(PRODUCT, PRODUCTBATCH),
      ...submitOnly(EXTERNALWORKORDER),
      ...readOnly(PROJECT, PROJECTTASK),
    ]),
  },
  {
    // Hemşire / asistan: hekimin yanında hasta hazırlığı, randevu akışı, sarf kullanımı.
    slug: ROLE_SLUGS.ASSISTANT,
    name: 'Hemşire / Asistan',
    priority: 60,
    isSystemRole: true,
    caps: uniqueCapabilities([
      ...BASELINE,
      ...SELF_SERVICE,
      ...manage(PATIENT),
      ...manage(APPOINTMENT),
      ...readOnly(RESOURCE, RESOURCEAVAILABILITY, PROVIDERAVAILABILITY),
      ...manage(...CLINICAL_RECORDS),
      ...readOnly(CONSENTFORMTEMPLATE),
      ...readOnly(...TREATMENT_CATALOG),
      ...readOnly(PROVIDER),
      ...submitOnly(PRODUCTUSAGE),
      ...readOnly(PRODUCT, PRODUCTBATCH, STOCKMOVEMENT),
    ]),
  },
  {
    // Muhasebe / finans: para akışının tamamı (fatura, tahsilat, kasa, banka,
    // muhasebe fişi) + bordro için özlük okuma. Tıbbi kayıt YOKTUR.
    // Finansal alan görünürlüğünün kapısı kıdem değil bu roldeki FINANCE yetkisidir.
    slug: ROLE_SLUGS.ACCOUNTANT,
    name: 'Muhasebe / Finans Sorumlusu',
    priority: 55,
    isSystemRole: true,
    caps: uniqueCapabilities([
      ...BASELINE,
      ...SELF_SERVICE,
      ...fullAccess(...BILLING),
      ...manage(...COLLECTION, ...TREASURY),
      ...fullAccess(...ACCOUNTING),
      ...readOnly(...FINANCE_SETTINGS),
      ...readOnly(ORGANIZATION, ORGANIZATIONFINANCESETTINGS, CLINIC),
      ...readOnly(PATIENT, APPOINTMENT, PROVIDER),
      ...readOnly(...TREATMENT_CATALOG),
      ...readOnly(...HEALTH_TOURISM),
      ...readOnly(...INVENTORY),
      ...manage(PURCHASEINVOICE),
      ...readOnly(...PROCUREMENT),
      ...readOnly(EMPLOYEE, EMPLOYEECONTRACT, ATTENDANCERECORD, LEAVEREQUEST),
      ...readOnly(PROJECT, PROJECTPHASE),
      ...manage(PROJECTCOST),
      ...readOnly(AUDITLOG),
      FINANCE.read,
      FINANCE.update,
    ]),
  },
  {
    // Ön büro: hasta kabul, randevu, lead karşılama ve kasa/tahsilat girişi.
    // Muhasebe fişi kesmez, kasa açıp kapatır ve tahsilat alır.
    slug: ROLE_SLUGS.RECEPTIONIST,
    name: 'Resepsiyonist / Ön Büro',
    priority: 50,
    isSystemRole: true,
    caps: uniqueCapabilities([
      ...BASELINE,
      ...SELF_SERVICE,
      ...fullAccess(PATIENT, PATIENTGROUP),
      ...fullAccess(...SCHEDULING),
      ...readOnly(PROVIDER),
      ...readOnly(...TREATMENT_CATALOG),
      ...manage(CONSENTFORMSUBMISSION),
      ...readOnly(CONSENTFORMTEMPLATE),
      ...manage(...CRM),
      ...manage(...HEALTH_TOURISM),
      ...manage(TREATMENTCHARGE),
      ...submitOnly(INVOICE),
      ...readOnly(PARTY, FINANCELEDGER),
      ...manage(...COLLECTION),
      ...manage(CASHREGISTER, CASHSESSION, CASHMOVEMENT),
    ]),
  },
  {
    // Depo / satın alma: stok ve tedarik zincirinin tamamı.
    // Tedarikçi fiyatlarını görür (FINANCE.read) ama muhasebe fişi kesmez.
    slug: ROLE_SLUGS.INVENTORY_MANAGER,
    name: 'Depo / Stok Sorumlusu',
    priority: 40,
    isSystemRole: true,
    caps: uniqueCapabilities([
      ...BASELINE,
      ...SELF_SERVICE,
      ...fullAccess(...INVENTORY),
      ...fullAccess(...PROCUREMENT),
      ...readOnly(PURCHASEINVOICE),
      ...readOnly(...TREATMENT_CATALOG),
      ...readOnly(PROVIDER, CLINIC),
      ...readOnly(PROJECT, PROJECTTASK),
      FINANCE.read,
    ]),
  },
  {
    // Destek personeli: yalnız kendi özlük işlemleri ve ortak katalog okuma.
    slug: ROLE_SLUGS.STAFF,
    name: 'Destek Personeli',
    priority: 10,
    isSystemRole: true,
    caps: uniqueCapabilities([
      ...BASELINE,
      ...SELF_SERVICE,
      ...readOnly(USER, CLINIC),
      ...readOnly(PROJECT, PROJECTTASK),
    ]),
  },
];
