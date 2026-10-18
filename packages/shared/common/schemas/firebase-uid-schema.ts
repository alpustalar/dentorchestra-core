import { z } from 'zod';

/**
 * Personel/kullanıcı kimliği — **UUID DEĞİL**.
 *
 * `User.id` bir Firebase UID'dir (alfanümerik, UUID formatında değil). Bu alanı
 * `z.uuid()` ile doğrulayan her kapı, gerçek bir personelle **hiç** çalışmıyordu:
 * istek 400 ile düşüyor ya da (daha kötüsü) kimlik sessizce `null`'a düşüyordu.
 * Aynı varsayım hatası dört ayrı modülde tekrarlandığı için kabul kümesi artık
 * tek yerde yaşıyor (CLAUDE.md finans kuralı 12).
 *
 * Kural: **personel/kullanıcı kimliği ham string, hasta/kayıt kimliği UUID.**
 *
 * Neden `FirebaseUid` VO'sundan (tam 28 karakter) daha gevşek: bu şema bir HTTP
 * kapısıdır ve kapı, kullanım yerinin kabul ettiğinden **daha dar olamaz** —
 * `performedById` / `openedById` gibi alanlar DB'de ham string kolonlardır ve
 * Firebase UID uzunluğu sağlayıcı tarafından garanti edilmez (dokümante edilen
 * üst sınır 128). Amaç biçim güzelliği değil: boş/aşırı uzun değeri ve
 * yanlışlıkla geçirilmiş başka tipleri durdurmak.
 */
export const FirebaseUidSchema = z
  .string()
  .min(20, { message: 'Geçersiz kullanıcı kimliği' })
  .max(128, { message: 'Geçersiz kullanıcı kimliği' });

export type FirebaseUidType = z.infer<typeof FirebaseUidSchema>;
