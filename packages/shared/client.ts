/**
 * Tarayıcı-güvenli giriş noktası — `@dentorchestra/shared/client`.
 *
 * Kök barrel (`./index.ts`) backend içindir ve `dto/` üzerinden `nestjs-zod`
 * çeker (164 dosya); frontend onu import ettiği an NestJS bağımlılıkları tarayıcı
 * bundle'ına girer. Bu dosya yalnız üç şeyi dışa açar:
 *
 *   - `modules/<ad>/schemas`     elle yazılmış saf Zod — runtime güvenli
 *   - `modules/<ad>/interfaces`  response sözleşmeleri + exception meta arayüzleri
 *   - `modules/<ad>/types`       yalnız `export type` — derlemede tamamen silinir
 *
 * `dto/` buraya ASLA girmez. `generated-zod` şemaları da girmez; ondan yalnız
 * **tip** alınır (aşağıya bak).
 *
 * Bu liste elle değil, klasör yapısından üretildi; yeni modül eklendiğinde
 * buraya da satırı ekle.
 */

// ── Runtime: şemalar + response/meta sözleşmeleri ──────────────────────────
export * from './modules/activity/schemas';
export * from './modules/activity/interfaces';
export * from './modules/admin-request/schemas';
export * from './modules/admin-request/interfaces';
export * from './modules/appointment/schemas';
export * from './modules/appointment/interfaces';
export * from './modules/appointment/contracts';
export * from './modules/attendance/schemas';
export * from './modules/bank/schemas';
export * from './modules/cash-register/schemas';
export * from './modules/clinic/schemas';
export * from './modules/clinic/interfaces';
export * from './modules/consent-form/schemas';
export * from './modules/employee/schemas';
export * from './modules/finance-ledger/schemas';
export * from './modules/finance-ledger/interfaces';
export * from './modules/finance-ledger/contracts';
export * from './modules/governance/schemas';
export * from './modules/health-tourism/schemas';
export * from './modules/health-tourism/interfaces';
export * from './modules/inventory/schemas';
export * from './modules/invoice/schemas';
export * from './modules/invoice/interfaces';
export * from './modules/invoice/contracts';
export * from './modules/lead/schemas';
export * from './modules/lead/interfaces';
export * from './modules/lead/contracts';
export * from './modules/leave/schemas';
export * from './modules/messaging/schemas';
export * from './modules/messaging/interfaces';
export * from './modules/messaging/contracts';
export * from './modules/meta-ads/schemas';
export * from './modules/meta-ads/interfaces';
export * from './modules/meta-ads/contracts';
export * from './modules/organization/schemas';
export * from './modules/organization/interfaces';
export * from './modules/patients/schemas';
export * from './modules/patients/interfaces';
export * from './modules/patients/contracts';
export * from './modules/payment/schemas';
export * from './modules/payment/interfaces';
export * from './modules/payroll/schemas';
export * from './modules/pipeline/schemas';
export * from './modules/pipeline/interfaces';
export * from './modules/pos/schemas';
export * from './modules/pos/interfaces';
export * from './modules/project/schemas';
export * from './modules/project/interfaces';
export * from './modules/provider/schemas';
export * from './modules/provider/interfaces';
export * from './modules/purchase-invoice/schemas';
export * from './modules/purchasing/schemas';
export * from './modules/registration/schemas';
export * from './modules/subscription/interfaces';
export * from './modules/tax/schemas';
export * from './modules/treatment-package/schemas';
export * from './modules/treatment-package/interfaces';
export * from './modules/user/schemas';
export * from './modules/user/interfaces';
export * from './modules/user/contracts';
export * from './modules/work-order/schemas';
export * from './modules/work-order/interfaces';

// ── Yalnız tip: z.infer çıkarımları (derlemede silinir) ────────────────────
export type * from './modules/activity/types';
export type * from './modules/admin-request/types';
export type * from './modules/appointment/types';
export type * from './modules/bank/types';
export type * from './modules/cash-register/types';
export type * from './modules/clinic/types';
export type * from './modules/finance-ledger/types';
export type * from './modules/governance/types';
export type * from './modules/health-tourism/types';
export type * from './modules/inventory/types';
export type * from './modules/invoice/types';
export type * from './modules/lead/types';
export type * from './modules/messaging/types';
export type * from './modules/meta-ads/types';
export type * from './modules/organization/types';
export type * from './modules/patients/types';
export type * from './modules/payment/types';
export type * from './modules/payroll/types';
export type * from './modules/pipeline/types';
export type * from './modules/pos/types';
export type * from './modules/project/types';
export type * from './modules/provider/types';
export type * from './modules/purchase-invoice/types';
export type * from './modules/purchasing/types';
export type * from './modules/registration/types';
export type * from './modules/tax/types';
export type * from './modules/treatment-package/types';
export type * from './modules/user/types';
export type * from './modules/work-order/types';

// ── Ortak ─────────────────────────────────────────────────────────────────
export * from './common/response/response.interface';
// Endpoint sözleşme katmanı (`defineEndpoint`) — yalnız zod'a bağlı, çerçeveden
// bağımsız. Endpoint kayıtları burada yaşar ki URL/metod bilgisi de tek kaynakta
// dursun (bkz. frontend-architecture.md §4).
export * from './common/contracts';
// DİKKAT: `./common/pagination` barrel'ı DEĞİL — o barrel `pagination.dto`'yu da
// yeniden dışa açıyor ve nestjs-zod'un runtime kodunu tarayıcıya sokuyor
// (ölçüldü: bundle'da `createZodDto`/`isZodDto` çıktı). Şema ve tip doğrudan
// alınır.
export * from './common/pagination/pagination.schema';
export * from './common/pagination/pagination.type';

// ── Üretilmiş Prisma modelleri: YALNIZ TİP ────────────────────────────────
// Runtime şema (LeadSchema vb.) buradan alınmaz — 1.3 MB'lık generated-zod
// bundle'a girer. Tipler ise derlemede silindiği için bedava.
export type * from './generated-zod/modelSchema';
//
// NOT: `generated-zod/inputTypeSchemas` barrel'ı buraya EKLENMEZ. İki sebep:
// (1) yalnız şema *değerlerini* yeniden dışa açıyor (`export { LeadStatusSchema }`),
//     `...Type` takma adlarını değil — yani aradığın enum tipini zaten vermez;
// (2) elle yazılmış modül şemalarıyla isim çakışıyor (`MetaLeadStatusSchema`,
//     `PipelineStageTypeSchema`) ve barrel'ı belirsizleştiriyor.
// Enum tipi lazımsa modelden türet: `Lead['status']`, `Lead['source']`. Böylece
// tip modelle her zaman senkron kalır.
