import { BaseEvent } from '@common/interfaces';
import { IAuditLog } from '@common/interfaces/audit-log.interface';
import { POS_EVENTS } from '@src/domain/constants/events';
import { PosTransactionKindType } from '@input-type-schemas/PosTransactionKindSchema';

/**
 * Bir kart işleminin ters kaydı (VOID / REFUND) BAŞARIYLA tamamlandı.
 *
 * Neden ayrı bir olay: iptal ve iade yüksek etkili para hareketleridir ve
 * CLAUDE.md finans kuralı 7 bunlar için **kalıcı damga (event + kolon)** şart
 * koşar. Kolon tarafı `pos_transactions.initiated_by_id`; bu olay damganın
 * okunabilir yüzüdür — `LogAction.POS_TRANSACTION_*` sabitleri bugüne kadar
 * hiçbir yerde kullanılmıyordu, yani "bu satışı kim iptal etti" sorusu ne
 * ekranda ne audit log'da cevaplanabiliyordu.
 *
 * Yalnız SUCCESS'te fırlatılır: başarısız bir iptal denemesi parayı geri
 * getirmediği için "iptal edildi" izi bırakmamalıdır (teşhis için cihaz
 * yanıtı `rawResponse`'ta durur).
 *
 * `source` (WEB/MOBILE) **bilinçli taşınmıyor**: olay entity'den, çağrı
 * bağlamı bittikten sonra da (callback yolu) fırlatılabildiği için tetikleyici
 * kanal güvenilir biçimde bilinemez. Aktör kimliği kalıcı kolondan okunur,
 * dolayısıyla hesap verebilirlik için gereken bilgi her yolda eksiksizdir.
 */
export interface PosTransactionReversedEventPayload extends IAuditLog {
  readonly posTransactionId: string;
  readonly originalPosTransactionId: string | null;
  readonly clinicId: string;
  readonly kind: PosTransactionKindType;
  readonly paymentId: string | null;
  readonly externalRef: string | null;
  /** Tutar string taşınır: olay gövdesinde Decimal serileştirme kaybı olmasın. */
  readonly amount: string;
  readonly currency: string;
}

export class PosTransactionReversedEvent extends BaseEvent {
  static readonly NAME = POS_EVENTS.TRANSACTION_REVERSED;

  public readonly posTransactionId: string;
  public readonly originalPosTransactionId: string | null;
  public readonly clinicId: string;
  public readonly kind: PosTransactionKindType;
  public readonly paymentId: string | null;
  public readonly externalRef: string | null;
  public readonly amount: string;
  public readonly currency: string;

  constructor(payload: PosTransactionReversedEventPayload) {
    super({
      action: payload.action,
      type: payload.type,
      actorId: payload.actorId,
      details: payload.details,
      metadata: payload.metadata,
    });
    this.posTransactionId = payload.posTransactionId;
    this.originalPosTransactionId = payload.originalPosTransactionId;
    this.clinicId = payload.clinicId;
    this.kind = payload.kind;
    this.paymentId = payload.paymentId;
    this.externalRef = payload.externalRef;
    this.amount = payload.amount;
    this.currency = payload.currency;
  }
}
