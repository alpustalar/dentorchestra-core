/** Checkout form'da müşteri kartını sakladıysa iyzico'nun döndürdüğü kart saklama token'ları. */
export interface RetrieveCheckoutFormSavedCard {
  cardUserKey: string;
  cardToken: string;
  binNumber?: string;
  lastFourDigits?: string;
  cardAssociation?: string;
  cardFamily?: string;
}

/** Checkout form retrieve'de dönen alıcı bilgisi (gönderilen buyer'ın yankısı). */
export interface RetrieveCheckoutFormBuyer {
  id?: string;
  name?: string;
  surname?: string;
  email?: string;
  gsmNumber?: string;
  ip?: string;
  city?: string;
  address?: string;
}

export interface RetrieveCheckoutFormResult {
  isSuccess: boolean;
  paymentId: string;
  paymentTransactionId: string | undefined;
  errorCode: string | undefined;
  errorMessage: string | undefined;
  /**
   * iyzico'nun **yankıladığı** `conversationId` — ödemeyi başlatırken gönderdiğimiz
   * korelasyon anahtarı (bizde: `bookingPaymentId` / abonelik `externalId`).
   *
   * Neden kritik: callback uçları `@Public` ve güncellenecek kaydı **çağıranın
   * gövdesindeki** `conversationId` belirliyor. Sonuç ise `token` ile iyzico'dan
   * okunuyor. İkisi bağlanmazsa BAŞKA bir ödemeye ait geçerli bir token,
   * bekleyen bir kaydı "ödendi" yapmaya yeter. Bu alan o bağın **doğrulanabilir**
   * tarafıdır: gövdeden değil sağlayıcının yanıtından gelir.
   */
  conversationId: string | undefined;
  /**
   * Sepet tutarı — **bizim istediğimiz** tutar (`price`), tahsil edilen değil.
   * `paidPrice`'tan ayrı taşınır: taksitte komisyon nedeniyle ikisi farklıdır.
   * Kaydın beklediği tutarla karşılaştırılarak "bu token bizim oluşturduğumuz
   * ödeme formuna mı ait" sorusu yanıtlanır.
   */
  price: string | undefined;
  /** Ödemenin para birimi (iyzico yankısı) — tutar karşılaştırmasının yarısı. */
  currency: string | undefined;
  /**
   * Sağlayıcının **fiilen tahsil ettiğini bildirdiği** tutar (iyzico `paidPrice`).
   * Taksitli ödemede komisyon nedeniyle istediğimiz tutardan (`price`) BÜYÜK
   * olabilir; bu yüzden kendi beyanımızla karıştırılmaz, ayrı taşınır ve
   * mutabakatta karşılaştırılır. String: ondalık kayıp olmasın.
   */
  paidPrice?: string;
  /** Müşteri kartını sakladıysa dolu — recurring auto-charge için token'lar. */
  savedCard?: RetrieveCheckoutFormSavedCard;
  /** Ödemedeki alıcı bilgisi — yenileme snapshot'ı için. */
  buyer?: RetrieveCheckoutFormBuyer;
  rawResponse: unknown;
}
