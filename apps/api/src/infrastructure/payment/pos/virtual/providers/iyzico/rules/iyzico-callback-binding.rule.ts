/**
 * iyzico callback'inin **hangi kayda ait olduğunun** doğrulanması.
 *
 * ## Neden bir kural, neden tek yerde
 *
 * iyzico ödeme formu tamamlandığında `{ token, conversationId }` gönderir ve bu
 * uçlar **kimlik doğrulaması olmadan** (`@Public`) çağrılır: çağıran iyzico'nun
 * sunucusu olabilir, başka biri de olabilir. Akışın yapısı şudur:
 *
 *   - ödemenin **sonucu** `retrieveCheckoutForm(token)` ile iyzico'dan okunur →
 *     bu taraf **güvenilir** (token gerçek bir ödemeye ait olmak zorunda),
 *   - güncellenecek **kayıt** ise gövdedeki `conversationId` ile bulunur →
 *     bu taraf **güvenilmez** (çağıranın yazdığı değer).
 *
 * İkisi birbirine bağlanmazsa, **başka bir ödemeye ait geçerli bir token**
 * bekleyen herhangi bir kaydı "ödendi" yapmaya yeter: saldırgan 10 TL'lik kendi
 * ödemesinin token'ını alır, gövdeye pahalı bir rezervasyonun kimliğini yazar
 * ve o rezervasyon tedarikçide açılır. Hiçbir tutar kontrolü bunu yakalamaz,
 * çünkü deftere yazılan tutar **yerel kayıttan** okunur — sistem kendi kendine
 * tutarlı görünür.
 *
 * Bu yüzden kontrol tek bir saf fonksiyonda durur: üç ayrı callback (sanal POS
 * taksiti, sağlık turizmi rezervasyonu, platform aboneliği) **aynı** sağlayıcı
 * hesabından gelen token'ları işliyor, yani birinde açık kalan kapı diğerlerinin
 * kayıtlarını da açar (token'lar akışlar arasında taşınabilir).
 *
 * ## İki bağımsız kanıt
 *
 * | Kanıt | Nasıl | Gücü |
 * | --- | --- | --- |
 * | **Yerel token** | Kayıt ödeme formunu açarken token'ı sakladıysa, gövdedeki token'la karşılaştırılır | Kesin — sağlayıcının davranışına bağlı değil |
 * | **Sağlayıcı yankısı** | iyzico yanıtında `conversationId`'i yankılar; gövdedekiyle karşılaştırılır | Kesin ama alanın gelmesine bağlı |
 *
 * Biri yeterlidir; **ikisinden biri çelişirse** istek reddedilir. Hiçbiri
 * yoksa da reddedilir (**fail-closed**): kanıtsız kabul, kontrolün hiç
 * olmamasıyla aynı şeydir.
 */

export type IyzicoCallbackBindingFailure =
  /** Kayıtta saklanan token ile gövdedeki token farklı → başka ödemenin token'ı. */
  | 'TOKEN_MISMATCH'
  /** Sağlayıcının yankıladığı conversationId, gövdedekinden farklı. */
  | 'CONVERSATION_MISMATCH'
  /** Ne yerel token ne sağlayıcı yankısı var → bağ kanıtlanamıyor. */
  | 'NO_BINDING_EVIDENCE';

export type IyzicoCallbackBinding =
  | { readonly bound: true }
  | { readonly bound: false; readonly reason: IyzicoCallbackBindingFailure };

export interface IyzicoCallbackBindingInput {
  /** Gövdeden gelen korelasyon anahtarı — **güvenilmez**. */
  readonly claimedConversationId: string;
  /** Gövdeden gelen token. */
  readonly token: string;
  /** Kaydın ödeme formu açılırken sakladığı token (varsa). */
  readonly storedToken?: string | null;
  /** iyzico'nun `retrieveCheckoutForm` yanıtında yankıladığı conversationId. */
  readonly retrievedConversationId?: string | null;
}

export function checkIyzicoCallbackBinding(
  input: IyzicoCallbackBindingInput
): IyzicoCallbackBinding {
  const { claimedConversationId, token, storedToken, retrievedConversationId } =
    input;

  // Çelişkiler önce: bir kanıt "hayır" diyorsa diğerinin "evet" demesi
  // kurtarmaz (saldırgan iki alandan birini kontrol edebiliyor olabilir).
  if (storedToken && storedToken !== token) {
    return { bound: false, reason: 'TOKEN_MISMATCH' };
  }

  if (
    retrievedConversationId &&
    retrievedConversationId !== claimedConversationId
  ) {
    return { bound: false, reason: 'CONVERSATION_MISMATCH' };
  }

  const hasTokenProof = Boolean(storedToken) && storedToken === token;
  const hasEchoProof =
    Boolean(retrievedConversationId) &&
    retrievedConversationId === claimedConversationId;

  if (!hasTokenProof && !hasEchoProof) {
    return { bound: false, reason: 'NO_BINDING_EVIDENCE' };
  }

  return { bound: true };
}
