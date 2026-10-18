/**
 * Hassas alanların **tek** maskeleme kapısı.
 *
 * ## Neden tek yerde
 *
 * İki ayrı tüketicisi var ve ikisi de aynı soruyu soruyor ("bu veri bir
 * credential mi?"):
 *
 *   1. **Log**: HTTP gövdeleri log'a yazılırken,
 *   2. **Sağlayıcı ham yanıtı**: ödeme/e-belge sağlayıcısının yanıtı tanı
 *      amacıyla `raw_response` kolonuna saklanırken.
 *
 * İkisi ayrı listelerle yazılsaydı biri güncellenip diğeri bayatlardı
 * (CLAUDE.md finans kuralı 12'nin aynı mantığı: kabul/ret kümesi tek sabitte
 * yaşar). Nitekim log tarafındaki liste tek seviyeliydi ve `cardToken` gibi
 * **iç içe** gelen anahtarları hiç görmüyordu.
 *
 * ## Neden sağlayıcı yanıtında da
 *
 * Saklanan ham yanıt, çoğu zaman sadece "tanı verisi" sanılır. Oysa iyzico
 * checkout yanıtı `cardToken` + `cardUserKey` taşıyor ve bu ikisi **non-3DS
 * çekim yapmaya yeten** bir kimlik bilgisidir (abonelik yenilemesi tam olarak
 * bunu kullanıyor). Yani blob, kontrollü saklama yerinin (kart saklama tablosu)
 * yanında **ikinci, denetlenmeyen** bir kopya üretiyordu: kimse onu
 * döndürmeyecek, kimse arayıp bulamayacak, saklama süresi olmayacak.
 *
 * Maskeleme **yazma sınırında** yapılır, serileştirme sınırında değil: DTO'da
 * saklamak tek bir okuyucuyu korur (HTTP), yazma sınırında maskelemek **her**
 * okuyucuyu korur (DB'ye bakan operatör, yedek, ileride eklenecek rapor).
 */

/**
 * **Credential** anahtarları: taşıdıkları değer bir yetki/erişim aracıdır.
 * Hiçbir yerde görünmemeleri gerekir — ne log'da, ne saklanan sağlayıcı
 * yanıtında, ne de bir HTTP yanıtında (grup kısıtı bile yeterli değildir:
 * gruba giren aktör için hâlâ ham bir şifredir).
 *
 * Geniş parçalar (`card`, `number`, `key`) bilerek **yok**: `maskedCardNumber`,
 * `lastFourDigits`, `iyzicoSubMerchantKey` tanı/gösterim için gerekli ve
 * credential değil — hepsini maskelemek log'u ve ekranı işe yaramaz yapar.
 */
const CREDENTIAL_EXACT_KEYS: ReadonlySet<string> = new Set([
  'token',
  'cardtoken',
  'carduserkey',
  'cardnumber',
  'cvc',
  'cvv',
  'pin',
  'password',
  'passwordconfirm',
  'oldpassword',
  'signature',
  'authorization',
  'cookie',
]);

/**
 * **Kişisel veri** anahtarları: credential değil ama log'a yazılmamalı
 * (KVKK veri minimizasyonu). Kendi ekranında gösterilmeleri meşrudur — bir
 * banka hesabı kartı IBAN'ı göstermek zorundadır — bu yüzden `isCredentialKey`
 * bunları kapsamaz ve HTTP yanıtı taraması bunlara takılmaz.
 */
const PERSONAL_DATA_EXACT_KEYS: ReadonlySet<string> = new Set([
  'identitynumber',
  'iban',
]);

/**
 * Bu eklerle **biten** anahtarlar da maskelenir: `iyzicoToken`, `fbToken`,
 * `clientSecret`, `webhookSecret`, `stripeApiKey`, `refreshToken`…
 * Sağlayıcı adını önceden bilmek imkânsız olduğu için ek bazlı eşleşme gerekli.
 */
const SENSITIVE_KEY_SUFFIXES: readonly string[] = [
  'token',
  'secret',
  'password',
  'apikey',
  'privatekey',
];

export const REDACTED = '[REDACTED]';

/** Kendini tekrarlayan/aşırı derin yapılarda sonsuz işi keser. */
const MAX_DEPTH = 8;

const normalizeKey = (key: string): string =>
  key.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Anahtar bir **credential** mı? HTTP yanıtı taraması bunu kullanır: kişisel
 * veri gösterilebilir, credential gösterilemez.
 */
export const isCredentialKey = (key: string): boolean => {
  const normalized = normalizeKey(key);
  if (CREDENTIAL_EXACT_KEYS.has(normalized)) return true;
  return SENSITIVE_KEY_SUFFIXES.some(
    (suffix) => normalized.length > suffix.length && normalized.endsWith(suffix)
  );
};

/** Log ve saklanan sağlayıcı yanıtı için: credential **veya** kişisel veri. */
export const isSensitiveKey = (key: string): boolean =>
  isCredentialKey(key) || PERSONAL_DATA_EXACT_KEYS.has(normalizeKey(key));

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);

/**
 * Hassas anahtarların değerini `[REDACTED]` ile değiştirmiş **yeni** bir kopya
 * döner. Girdi mutasyona uğramaz: aynı nesne başka bir amaçla (ör. kart
 * saklama token'larını çıkarmak) hâlâ okunuyor olabilir.
 *
 * Yalnız düz nesnelere ve dizilere iner; sınıf örnekleri (Date, Decimal,
 * Buffer) olduğu gibi geçer — içlerine girmek hem anlamsız hem de
 * serileştirmeyi bozar.
 */
export function redactSensitive<T>(value: T, depth = 0): T {
  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) return value;
    return value.map((item) => redactSensitive(item, depth + 1)) as unknown as T;
  }

  if (!isPlainObject(value)) return value;
  if (depth >= MAX_DEPTH) return value;

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = isSensitiveKey(key)
      ? REDACTED
      : redactSensitive(item, depth + 1);
  }
  return result as unknown as T;
}
