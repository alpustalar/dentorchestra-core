# Finans — Tur 33 Kısa Devir (HANDOVER)

**Tarih:** 2026-10-20 · **Dal:** `main` · **Kapsam:** yıl sonu kapanışı + GRNI tahakkuku (§92–§93).
Ayrıntı: `09-guvence-denetimi.md` §92, genel devir: `12-durum-devri.md` §0.

## 1. Ne kuruldu

- `planYearEndClosing` (saf, `posting/domain/closing/`): GRNI tahakkuku → 7xx yansıtma → 6→690 → 590/591 → 1 Ocak ters kayıt. Önizleme ve kapanış aynı fonksiyon.
- `POST /accounting/periods/:id/closing-preview` (yazmaz; `blockers`, `warnings`, `expectedLastEntryNo`) ve `close` (gövde zorunlu, tazelik belirteci kilit altında).
- Kapılar: önceki yıl CLOSED, ertesi yıl OPEN (tahakkuk varsa), hesap planı eksiksiz, bayat önizleme reddi.
- Mal kabul günlüğü `purchase_order_receipts` (tarihli soru için), `JournalEntryKind.ADJUSTING`, tahakkuk karşı hesabı `329` yalnız bu akışa ayrılı.
- Alış faturası hesap kümesi `PURCHASE_INVOICE_LINE_ACCOUNT_CODES` (`@shared`) tek kaynak; `102` gibi hesaplar reddedilir.
- Gizli P0 düzeltmesi: `Prisma.Decimal` hidrasyon sınırında çevrilir (kural 21). P1: `GetJournalEntries` klinik kapsamı.

## 2. Kanıtlar

- `pnpm test`: 292/293 suite, **2237** test yeşil; kırmızı tek suite ilgisiz (`schedule-appointment.handler.spec.ts`).
- `tsc`: yalnız aynı ilgisiz hata.
- Gerçek DB (izole, 93 migration): 4 uçtan uca senaryo yeşil, hata yolunda claim geri sarıldı.
- `finans:degismezler`: 30 kontrol; 28 temiz, 2 çalıştırılamadı (günlük tabloları dev DB'de yok).

## 3. Sizde kalanlar

1. `pnpm migrate:dev`: `20261022100000_purchase_order_receipt_journal` (**30 Kasım'a kadar canlıda**), `20261023100000_journal_entry_kind_adjusting`.
2. `pnpm finans:degismezler` → 30/30.
3. Mevcut kliniklerde `POST chart-of-accounts/initialize` (622/631/632).
4. Commit (istenirse): tur 32 + 33 çalışma ağacında.

## 3b. Devam (2026-10-21): işletme biçimi + öz kaynak devri

Bkz. `09` §94. Üçüncü migration: `20261024100000_clinic_business_type`. Kayıt gövdesi artık `businessType` ister;
eski klinikler `PATCH /clinics/:id/business-type` ile seçilene kadar devir atlanır (önizleme uyarır).

## 4. Tur 34

✅ Yapıldı: iş paketi 23'ün büyük kısmı, bkz. `09` §95 ve `12-durum-devri.md` §0.3 (`pnpm test:db`; 1×P0 + 1×P1). Kalan: iade/iptal yolları. Bilinçli yapılmayanlar: §93.
