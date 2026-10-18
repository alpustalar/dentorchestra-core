import { Money } from '@src/domain/value-objects/money.vo';

export const BILLING_ADAPTER = Symbol('IBillingAdapter');

export interface SubscriptionBuyerInfo {
  id: string;
  name: string;
  surname: string;
  email: string;
  gsmNumber: string;
  ip: string;
  city?: string;
  address?: string;
}

export interface InitSubscriptionPaymentInput {
  organizationId: string;
  amount: Money;
  label: string;
  buyer: SubscriptionBuyerInfo;
}

/** iyzico kart saklama token'ları — sonraki dönemlerde otomatik tahsilat için. */
export interface SavedCardRef {
  cardUserKey: string;
  cardToken: string;
}

/** İlk ödemede müşteri kartını sakladıysa yakalanan token + alıcı snapshot + görüntüleme metadata'sı. */
export interface CapturedSavedCard extends SavedCardRef {
  maskedNumber?: string;
  cardAssociation?: string;
  cardFamily?: string;
  buyer: SubscriptionBuyerInfo;
}

export interface PaymentResult {
  success: boolean;
  iyzicoPaymentId?: string;
  errorMessage?: string;
  /**
   * Sağlayıcının tahsil ettiğini bildirdiği tutar — **checkout yolunda** dolu
   * (müşteri taksit seçebilir → bizim tutarımızdan büyük olabilir). Kayıtlı
   * kartla yenilemede sağlayıcıya `installments: 1` ve `paidPrice = price`
   * gönderildiği için karşılaştıracak bir fark yoktur; yenileme taksitlendirilmeye
   * başlarsa bu alan orada da okunmalıdır.
   */
  paidAmount?: string;
  /**
   * Sağlayıcının **yankıladığı** korelasyon anahtarı (abonelikte `externalId`).
   *
   * Callback ucu `@Public` ve güncellenecek aboneliği **çağıranın gövdesindeki**
   * `conversationId` belirliyor; sonuç ise `token` ile sağlayıcıdan okunuyor.
   * İkisi bağlanmazsa başka bir ödemeye ait geçerli bir token, bekleyen bir
   * aboneliği "ödendi" yapmaya yeter (bkz. `checkIyzicoCallbackBinding`).
   */
  conversationId?: string;
  /** Müşteri kartını sakladıysa dolu — recurring auto-charge için persist edilir. */
  savedCard?: CapturedSavedCard;
}

/** Kayıtlı kartla otomatik tahsilat girişi (yenileme). */
export interface ChargeSavedCardInput {
  organizationId: string;
  amount: Money;
  label: string;
  savedCard: SavedCardRef;
  buyer: SubscriptionBuyerInfo;
}

export interface IBillingAdapter {
  initializePayment(
    input: InitSubscriptionPaymentInput
  ): Promise<{ checkoutUrl: string; conversationId: string }>;
  handlePaymentResult(token: string): Promise<PaymentResult>;
  /** Kayıtlı kartla (kart saklama) non-3DS otomatik tahsilat — abonelik yenilemesi. */
  chargeSavedCard(input: ChargeSavedCardInput): Promise<PaymentResult>;
  cancelPayment(iyzicoPaymentId: string, ip: string): Promise<void>;
}
