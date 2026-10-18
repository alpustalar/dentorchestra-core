import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Dinleyici kapısının taraması.
 *
 * `@OnDomainEvent` olmadan yazılan bir dinleyici **sessizce** iki garantiyi
 * kaybeder: `emitAsync` onu beklemez (kayıt teslim edilmeden "işlendi" olur) ve
 * hatası çağırana ulaşmaz (yeniden deneme imkânsızlaşır). Kaybın hiçbir
 * belirtisi yoktur — test de geçer, log da sessizdir. Bu yüzden kural elle
 * değil **taramayla** korunur: yeni bir dinleyici çıplak `@OnEvent` ile
 * yazıldığı anda bu test kırmızıya düşer.
 *
 * Tek istisna, framework'ün varsayılan davranışını ölçen sözleşme testidir
 * (`event-delivery-contract.spec.ts`): çıplak `@OnEvent`'i kasten kullanır.
 */
const ROOTS = [
  join(__dirname, '..', '..', '..', '..'), // apps/api/src
  join(__dirname, '..', '..', '..', '..', '..', '..', 'messaging', 'src'),
];

/** Çıplak `@OnEvent` kullanmasına izin verilen tek dosya ve gerekçesi. */
const ALLOWED = ['outbox/event-delivery-contract.spec.ts'];

/**
 * Aranan dizgeler parça parça kurulur: aksi hâlde bu dosya **kendi** taramasına
 * yakalanır ve istisna listesi, tarayıcının kendisi için şişer.
 */
const BARE = '@' + 'OnEvent(';
const GUARDED = '@' + 'OnDomainEvent(';

interface Hit {
  file: string;
  line: number;
}

const collectTsFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectTsFiles(full));
      continue;
    }
    if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
};

const scan = () => {
  const files: string[] = [];
  const bare: Hit[] = [];
  const guarded: Hit[] = [];

  for (const root of ROOTS) {
    for (const file of collectTsFiles(root)) {
      const content = readFileSync(file, 'utf8');
      if (!content.includes(BARE) && !content.includes(GUARDED)) continue;

      files.push(file);
      content.split('\n').forEach((line, index) => {
        const where = { file: relative(root, file), line: index + 1 };
        if (line.includes(GUARDED)) guarded.push(where);
        else if (line.includes(BARE)) bare.push(where);
      });
    }
  }

  return { files, bare, guarded };
};

describe('event dinleyici kapısı', () => {
  const { files, bare, guarded } = scan();

  it('taramanın kendisi çalışıyor (boş tarama sessizce geçmesin)', () => {
    expect(files.length).toBeGreaterThanOrEqual(50);
    expect(guarded.length).toBeGreaterThanOrEqual(70);
  });

  it('hiçbir dinleyici çıplak @OnEvent kullanmıyor', () => {
    const offenders = bare.filter(
      (hit) => !ALLOWED.some((allowed) => hit.file.endsWith(allowed))
    );

    expect(offenders.map((hit) => `${hit.file}:${hit.line}`)).toEqual<string[]>(
      []
    );
  });

  it('istisna listesi gerçekten kullanılıyor (ölü istisna bırakılmasın)', () => {
    for (const allowed of ALLOWED) {
      expect(bare.some((hit) => hit.file.endsWith(allowed))).toBe(true);
    }
  });
});
