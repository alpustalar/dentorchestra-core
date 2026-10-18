import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { FinancialEvent, FinancialEventTypeSchema } from '@shared';
import { ACCOUNTING_RULES } from '@modules/finance/shared/domain/constants/accounting-rules.constant';
import {
  DraftJournalEntry,
  DraftJournalLine,
  PostingRule,
} from '../posting-rule.interface';
import { PlatformBookingRefundedEventPayload } from '../event-payloads';
import { PlatformBookingRefundAmountsMismatchException } from '../../exceptions/posting.exceptions';

/** Satıştan İadeler (-) — geri alınan komisyon geliri. */
const SALES_RETURNS_610 = '610';
/** Tedarikçiye (HotelBeds/Duffel) borç. */
const SUPPLIERS_320 = '320';
/** Diğer Olağandışı Gider ve Zararlar — üstlenilen iptal cezası. */
const OTHER_LOSS_689 = '689';

/**
 * Sağlık turizmi rezervasyon iadesi — PLATFORM_BOOKING_REFUNDED.
 *
 * Tahsilat fişi (`PLATFORM_BOOKING_SETTLED`) şunu yazmıştı:
 *
 *   B 108 Diğer Hazır Değerler   sale
 *       A 601 Yurtdışı Satışlar      commission
 *       A 320 Satıcılar              supplier
 *
 * İptal + iade bunun **devamıdır**:
 *
 *   B 610 Satıştan İadeler (-)   commission        (kazanılmamış komisyon geri alınır)
 *   B 320 Satıcılar              supplierReleased  (serbest kalan tedarikçi borcu)
 *   B 689 Diğer Gider ve Zararlar retainedLoss     (sağlayıcının alıkoyduğu ceza)
 *       A 108 Diğer Hazır Değerler   refundAmount     (müşteriye geri giden para)
 *
 * **Neden storno değil.** `reverse-journal-entry` tahsilat fişini ters kaydedip
 * `REVERSED` işaretlerdi; para o gün gerçekten alınmış olduğu için bu, tahsilatı
 * alındığı günden silmek olurdu (o günün 108 bakiyesi yanlış) ve iade aylar
 * sonra gelirse **kapanmış dönemi** yeniden yorumlardı. Storno "bu kayıt hiç
 * olmamalıydı" demek içindir (§47); iade kendi tarihi olan yeni bir olaydır
 * (aynı gerekçe: {@link PaymentRefundedRule}).
 *
 * **Neden 601 değil 610.** Komisyonu 601'in borcuna yazmak, iade sonraki döneme
 * düştüğünde o dönemin brüt hasılatını eksiye çekerdi. 610 bu iş için var:
 * gelir tablosunda brüt satış ile satıştan iadeler ayrı görünür ve net satış
 * doğru hesaplanır (`IncomeStatementCalculator` 61x'i "satış indirimleri"
 * bölümüne alır).
 *
 * **Neden ceza 689'da.** Müşteriye tam iade yapıldığı için sağlayıcının
 * alıkoyduğu tutarın karşılığında bir hizmet yok — hasılatla ilişkilendirilemez,
 * satışların maliyeti de değildir. Hesap planı şablonunda hazır olan tek uygun
 * hesap 689; 659'a (Diğer Olağan Gider ve Zararlar) taşımak tek satırlık bir
 * değişiklik ama şablona yeni hesap eklemek mevcut kiracılarda yok olduğu için
 * bir sapma kararıdır (kural 11).
 *
 * **Satır varlığı:** 610 her zaman yazılır (tahsilat fişindeki 601'in aynası —
 * iki fiş satır satır karşılaştırılabilsin, komisyon sıfır olsa bile). 320 ve
 * 689 ise **koşulludur**: sıfır tutarla yazılsalardı olmayan bir tedarikçi
 * hareketini ya da olmayan bir zararı beyan ederlerdi.
 */
@Injectable()
export class PlatformBookingRefundedRule implements PostingRule {
  readonly eventType = FinancialEventTypeSchema.enum.PLATFORM_BOOKING_REFUNDED;

  build(event: FinancialEvent): DraftJournalEntry {
    const payload =
      event.payload as unknown as PlatformBookingRefundedEventPayload;

    const refund = new Decimal(payload.refundAmount);
    const commission = new Decimal(payload.commission);
    const released = new Decimal(payload.supplierReleased);
    const retained = new Decimal(payload.retainedLoss);

    // Fişin denk olmasının tek koşulu bu eşitlik. Kaynakta bir yuvarlama/mantık
    // hatası olursa burada durur — dengesiz fiş yazıp mizanı bozmaktansa olayı
    // postlanmamış bırakıp sesli hata vermek yeğdir.
    if (!commission.plus(released).plus(retained).equals(refund)) {
      throw new PlatformBookingRefundAmountsMismatchException({
        refundAmount: payload.refundAmount,
        commission: payload.commission,
        supplierReleased: payload.supplierReleased,
        retainedLoss: payload.retainedLoss,
      });
    }

    const lines: DraftJournalLine[] = [
      {
        accountCode: SALES_RETURNS_610,
        debit: commission.toFixed(2),
        desc: 'Komisyon iadesi (rezervasyon iptali)',
      },
    ];

    if (!released.isZero()) {
      lines.push({
        // 320 `requiresParty`: tahsilat satırıyla aynı cari, yoksa borç
        // alt defterde kapanmaz.
        accountCode: SUPPLIERS_320,
        partyId: payload.supplierPartyId,
        debit: released.toFixed(2),
        desc: 'Tedarikçi borcu düşümü (iptal)',
        // Tahsilat satırıyla aynı gerekçe: düşen borç sağlayıcının kendi
        // cinsindendir, TRY tutarı tek başına mutabakata yetmez.
        ...(payload.originalCurrency
          ? {
              originalDebit: payload.supplierReleasedOriginalAmount,
              originalCurrency: payload.originalCurrency,
              fxRate: payload.fxRate,
            }
          : {}),
      });
    }

    if (!retained.isZero()) {
      lines.push({
        accountCode: OTHER_LOSS_689,
        debit: retained.toFixed(2),
        desc: 'Sağlayıcı iptal cezası',
        // Ceza da sağlayıcının cinsinden alıkoyulur.
        ...(payload.originalCurrency
          ? {
              originalDebit: payload.retainedLossOriginalAmount,
              originalCurrency: payload.originalCurrency,
              fxRate: payload.fxRate,
            }
          : {}),
      });
    }

    lines.push({
      accountCode: ACCOUNTING_RULES.TARGET_ACCOUNTS.POS_108,
      credit: refund.toFixed(2),
      desc: `İade (${payload.provider})`,
    });

    return {
      date: event.occurredAt,
      description: `Sağlık turizmi iadesi (${payload.bookingType})`,
      // Yabancı para ise posting handler fonksiyonel paraya çevirir (Model A).
      currency: payload.currency,
      lines,
    };
  }
}
