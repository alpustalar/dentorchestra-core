import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { FinancialEvent, FinancialEventTypeSchema } from '@shared';
import { ACCOUNTING_RULES } from '@modules/finance/shared/domain/constants/accounting-rules.constant';
import { DraftJournalEntry, PostingRule } from '../posting-rule.interface';
import { PlatformBookingSettledEventPayload } from '../event-payloads';
import {
  PlatformBookingAmountsMismatchException,
  PlatformBookingBelowCostException,
} from '../../exceptions/posting.exceptions';

/** Komisyon geliri — Yurtdışı Satışlar (Sağlık Turizmi). */
const COMMISSION_REVENUE_601 = '601';
/** Tedarikçiye (HotelBeds) borç. */
const SUPPLIERS_320 = '320';

/**
 * Sağlık turizmi rezervasyon tahsilatı — PLATFORM_BOOKING_SETTLED.
 *
 * **Platform defterine** yazılır, kliniğe değil: klinik bu işleme finansal
 * olarak taraf değildir (müşteri platforma öder, platform HotelBeds'e öder).
 *
 * Platform aracı (acente) konumundadır, bu yüzden **net/aracı yaklaşımı**
 * uygulanır — hasılat olarak yalnız komisyon yazılır, tedarikçi payı borçtur:
 *
 *   B 108 Diğer Hazır Değerler   saleAmount      (tahsilat sağlayıcıda yolda)
 *       A 601 Yurtdışı Satışlar      commission      (platform geliri)
 *       A 320 Satıcılar              supplierAmount  (HotelBeds'e borç)
 *
 * Brüt (principal) yaklaşımı seçilseydi hasılat `saleAmount`, maliyet 740'a
 * yazılırdı ve ciro tedarikçi payı kadar şişerdi; aracılıkta doğru olan net
 * yaklaşımdır. Değiştirmek gerekirse tek dosya burasıdır.
 *
 * Tedarikçiye ödeme yapıldığında 320 ayrıca kapatılır (bu kuralın dışında).
 * 108 → 102 aktarımı sağlayıcı hesap kapaması ile olur.
 */
@Injectable()
export class PlatformBookingSettledRule implements PostingRule {
  readonly eventType = FinancialEventTypeSchema.enum.PLATFORM_BOOKING_SETTLED;

  build(event: FinancialEvent): DraftJournalEntry {
    const payload =
      event.payload as unknown as PlatformBookingSettledEventPayload;

    const sale = new Decimal(payload.saleAmount);
    const supplier = new Decimal(payload.supplierAmount);
    const commission = new Decimal(payload.commission);

    // Fişin denk olmasının tek koşulu bu eşitlik. Kaynak tarafta bir yuvarlama
    // hatası olursa burada durur — dengesiz fiş yazıp mizanı bozmaktansa,
    // olayı postlanmamış bırakıp sesli hata vermek yeğdir.
    if (!commission.plus(supplier).equals(sale)) {
      throw new PlatformBookingAmountsMismatchException({
        saleAmount: payload.saleAmount,
        supplierAmount: payload.supplierAmount,
        commission: payload.commission,
      });
    }

    // Negatif komisyon denklemi BOZMAZ (sale − supplier her zaman denk gelir),
    // bu yüzden üstteki kontrol onu yakalamaz: 601'e negatif alacak yazılır ve
    // hasılat ters işaretle görünür. Maliyetin altında satış istisnai bir
    // olaydır ve zararın hangi hesapta tanınacağı muhasebe kararıdır → fiş
    // yazılmaz, olay postlanmamış kalır.
    if (commission.isNegative()) {
      throw new PlatformBookingBelowCostException({
        saleAmount: payload.saleAmount,
        supplierAmount: payload.supplierAmount,
        commission: payload.commission,
      });
    }

    const description = `Sağlık turizmi tahsilatı (${payload.bookingType})`;

    return {
      date: event.occurredAt,
      description,
      // Yabancı para ise posting handler fonksiyonel paraya çevirir (Model A).
      currency: payload.currency,
      lines: [
        {
          accountCode: ACCOUNTING_RULES.TARGET_ACCOUNTS.POS_108,
          debit: sale.toFixed(2),
          desc: `Tahsilat (${payload.provider})`,
        },
        {
          accountCode: COMMISSION_REVENUE_601,
          credit: commission.toFixed(2),
          desc: 'Platform komisyon geliri',
        },
        {
          // 320 `requiresParty` taşır: cari olmadan fiş reddedilir ve tahsilat
          // defteri HİÇ yazılmaz (satır kuralı posting handler'da zorlanıyor,
          // bu yüzden kuralın birim testi yeşil kalıyordu).
          accountCode: SUPPLIERS_320,
          partyId: payload.supplierPartyId,
          credit: supplier.toFixed(2),
          desc: 'Tedarikçiye borç (rezervasyon)',
          // Para TRY girdi (iyzico) ama borç sağlayıcıya **kendi cinsinden**
          // doğdu: orijinal tutar + kilitli kur satıra iliştirilir, yoksa
          // tedarikçi mutabakatı EUR cinsinden yapılamaz. Gövde temeli
          // eksiksiz gelir ya hiç gelmez (yazma-anı şeması zorluyor).
          ...(payload.originalCurrency
            ? {
                originalCredit: payload.supplierOriginalAmount,
                originalCurrency: payload.originalCurrency,
                fxRate: payload.fxRate,
              }
            : {}),
        },
      ],
    };
  }
}
