import { BaseEvent } from '@common/interfaces';
import { IAuditLog } from '@common/interfaces/audit-log.interface';
import { PAYMENT_GATEWAY_EVENTS } from '@src/domain/constants/events';

export interface ClinicPaymentGatewayRegisteredEventPayload extends IAuditLog {
  clinicId: string;
  /** iyzico alt üye işyeri anahtarı (kimlik — sır değil). */
  subMerchantKey: string;
  /** Yeni kayıt mı yoksa mevcut kaydın güncellenmesi mi. */
  isNew: boolean;
  /**
   * Hesabın **maskelenmiş** IBAN'ı (son 4 hane). Tam IBAN ve kimlik numarası
   * bilerek taşınmaz: denetim için "hangi hesaba döndü" sorusuna yanıt yeterli,
   * KVKK açısından tam veriyi log'a yazmak gereksiz risk.
   */
  maskedIban: string;
}

/**
 * Kliniğin ödeme altyapısı (iyzico alt üye işyeri) kuruldu/güncellendi.
 *
 * Bu, **paranın nereye yatacağını** belirleyen bir değişikliktir: IBAN
 * değiştirildiğinde klinik hak edişleri başka bir hesaba akar. Kayıt üzerinde
 * IBAN tutulmadığı (iyzico'ya iletilip saklanmadığı) için bu değişikliğin tek
 * kalıcı izi audit log'dur.
 */
export class ClinicPaymentGatewayRegisteredEvent extends BaseEvent {
  static readonly NAME = PAYMENT_GATEWAY_EVENTS.REGISTERED;

  public readonly clinicId: string;
  public readonly subMerchantKey: string;
  public readonly isNew: boolean;
  public readonly maskedIban: string;

  constructor(payload: ClinicPaymentGatewayRegisteredEventPayload) {
    super({
      action: payload.action,
      source: payload.source,
      details: payload.details,
      actorId: payload.actorId,
      type: payload.type,
    });
    this.clinicId = payload.clinicId;
    this.subMerchantKey = payload.subMerchantKey;
    this.isNew = payload.isNew;
    this.maskedIban = payload.maskedIban;
  }
}
