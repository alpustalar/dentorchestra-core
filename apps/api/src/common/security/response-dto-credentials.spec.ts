import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { isCredentialKey } from '@common/utils';

const MODULES_ROOT = join(__dirname, '..', '..', 'modules');

const collectResponseDtos = (dir: string, found: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectResponseDtos(full, found);
      continue;
    }
    if (entry.endsWith('-response.dto.ts')) found.push(full);
  }
  return found;
};

/**
 * `@Expose()` edilmiş alan adlarını kaba ama **yanlış tarafa düşmeyen** bir
 * taramayla çıkarır: dekoratörün hemen ardından gelen ilk alan bildirimi.
 * Alanı kaçırmak taramayı sessizce zayıflatır, bu yüzden bulunan alan sayısı da
 * ayrıca iddia ediliyor (aşağıdaki "tarama çalışıyor" testi).
 */
const exposedFields = (file: string): string[] => {
  const lines = readFileSync(file, 'utf8').split('\n');
  const fields: string[] = [];

  lines.forEach((line, index) => {
    if (!line.includes('@Expose')) return;
    for (let i = index + 1; i < Math.min(index + 6, lines.length); i++) {
      const match =
        /^\s*(?:readonly\s+)?([A-Za-z_][A-Za-z0-9_]*)\??\s*[:?]/.exec(lines[i]);
      if (match && !lines[i].trimStart().startsWith('@')) {
        fields.push(match[1]);
        return;
      }
    }
  });

  return fields;
};

/**
 * **HTTP yanıtı hiçbir credential taşımaz.**
 *
 * Bu tarama bir listeyi elle tutmaz: `isCredentialKey` zaten log ve sağlayıcı
 * ham yanıtı maskelemesi için var olan **tek** kuraldır, tarama onu yeniden
 * kullanır (kural 12 — kabul/ret kümesi tek sabitte yaşar).
 *
 * Neden grup kısıtı yeterli değil: `@Expose({ groups: [MANAGEMENT] })` ile
 * korunan bir alan, o gruba giren aktör için **hâlâ ham bir şifredir** ve
 * serileştirme interceptor'ı `@Serialize` yoksa **fail-open** çalışıyor (DTO
 * hiç uygulanmaz, ham veri gider). Yani grup, yanlış yere konmuş bir güvencedir.
 *
 * Tarandığında bulunanlar (hepsi bu turda temizlendi): kliniğin USS şifresi
 * (canlı bir uçta `@Serialize` ile yayınlanıyordu), iyzico checkout token'ı
 * (§73'teki callback bağının yerel kanıtı), Meta reklam hesabı erişim token'ı,
 * fiziksel POS terminal `clientSecret`/`password`.
 */
describe('HTTP yanıt DTO’ları credential taşımaz', () => {
  const files = collectResponseDtos(MODULES_ROOT);

  it('tarama çalışıyor: yanıt DTO’ları ve alanları bulunuyor', () => {
    // Tarama sessizce boş dönerse test "yeşil" olur ve güvence kaybolur.
    expect(files.length).toBeGreaterThan(30);
    const totalFields = files.reduce(
      (sum, file) => sum + exposedFields(file).length,
      0
    );
    expect(totalFields).toBeGreaterThan(200);
  });

  it('hiçbir @Expose alanı credential adı taşımıyor', () => {
    const offenders = files.flatMap((file) =>
      exposedFields(file)
        .filter((field) => isCredentialKey(field))
        .map((field) => `${file.replace(MODULES_ROOT, 'modules')}: ${field}`)
    );

    expect(offenders).toEqual([]);
  });

  it('kural ayırt ediyor: kişisel veri ve tanı alanları serbest', () => {
    // Fazla hassas bir kural, ekranın çalışması için gereken alanları
    // (IBAN, maskeli kart, alt üye işyeri anahtarı) yasaklayıp taramayı
    // kullanılamaz hâle getirirdi.
    [
      'iban',
      'maskedCardNumber',
      'lastFourDigits',
      'iyzicoSubMerchantKey',
      'dedupeKey',
      'tokenExpiresAt',
    ].forEach((field) => expect(isCredentialKey(field)).toBe(false));
    ['ussPassword', 'iyzicoToken', 'accessToken', 'clientSecret'].forEach(
      (field) => expect(isCredentialKey(field)).toBe(true)
    );
  });
});
