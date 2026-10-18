#!/usr/bin/env node
/**
 * Finans denetiminin **ertelenen kalemlerini** tek tek, düz bir listeye derler.
 *
 * Neden script: kalemler `09-guvence-denetimi.md` içindeki 25+ "Bilinçli
 * yapılmayanlar" tablosuna dağılmış durumda. Elle derlenen bir liste ilk turda
 * doğru, üçüncü turda bayat olur (bkz. §55 — erteleme listesinin kendisi
 * denetlendiğinde bir kalem CANLI HATA çıkmıştı). Bu yüzden düz liste
 * **türetilir**: kaynak hep §-bölümleridir, bu dosya her tur sonunda yeniden
 * üretilir ve elle düzenlenmez.
 *
 * Kullanım: `node scripts/finans-eksik-liste.cjs` (ya da `pnpm finans:eksik`)
 */
const fs = require('fs');
const path = require('path');

const DOCS = path.join(__dirname, '..', 'documents', 'finans');
const SOURCE = path.join(DOCS, '09-guvence-denetimi.md');
const TARGET = path.join(DOCS, '11-eksik-kalanlar.md');

const squash = (text) => text.replace(/\s+/g, ' ').trim();

/** Satırın gerekçesinden tetikleyiciyi çıkarır; yoksa "—". */
function extractTrigger(body) {
  const patterns = [
    /\*\*Tetikleyici:?\*\*:?\s*([^.|]*)/,
    /\*\*Tetikleyici:([^*]*)\*\*/,
    /Tetikleyici:?\s*\*{0,2}([^.|]*)/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(body);
    if (match) return squash(match[1]).replace(/^[*\s—-]+|[*\s.]+$/g, '') || '—';
  }
  return '—';
}

/** Kapanmış kalemler tabloda ✅ ya da üstü çizili (~~…~~) işaretlenir. */
const isClosed = (text) => text.includes('✅') || text.includes('~~');

function parse(markdown) {
  const sections = [];
  let current = null;

  for (const line of markdown.split('\n')) {
    const heading = /^## (\d+)\.\s+(.*)$/.exec(line);
    if (heading) {
      const title = heading[2];
      current = /yapılmayanlar/i.test(title)
        ? { no: Number(heading[1]), title, rows: [] }
        : null;
      if (current) sections.push(current);
      continue;
    }
    if (!current || !line.startsWith('|')) continue;

    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const isSeparator = [...cells[0]].every((ch) => '-: '.includes(ch));
    if (cells.length < 2 || isSeparator) continue;
    if (['Konu', 'Kalem', 'Madde', 'Başlık'].includes(cells[0])) continue;

    current.rows.push({ title: squash(cells[0]), body: cells.slice(1).join(' ') });
  }

  return sections;
}

function render(sections) {
  // Yerel (İstanbul) takvim günü — `toISOString()` UTC verir ve gece yarısından
  // sonraki üç saatte dosyaya **bir gün eski** tarih damgalıyordu; dokümanlardaki
  // diğer bütün tarihler yerel takvime göre yazılıyor.
  const today = new Date().toLocaleDateString('sv-SE', {
    timeZone: 'Europe/Istanbul',
  });
  const total = sections.reduce((sum, s) => sum + s.rows.length, 0);
  const open = sections.reduce(
    (sum, s) => sum + s.rows.filter((r) => !isClosed(r.title + r.body)).length,
    0
  );

  const lines = [
    '# Finans denetimi — ertelenen kalemlerin ham listesi',
    '',
    '> **ÜRETİLMİŞ DOSYA — elle düzenlenmez.**',
    '> Kaynak: `09-guvence-denetimi.md` içindeki "Bilinçli yapılmayanlar" tabloları.',
    '> Yeniden üretmek için: `node scripts/finans-eksik-liste.cjs`',
    '',
    `**${today} itibarıyla ${total} kalem; ${open} açık, ${total - open} kapandı.**`,
    '',
    'Bu dosya **tek tek** kalem listesidir (ne yapılacağına karar vermek için',
    'değil, hiçbir kalemin kaybolmadığını görmek için). Konu bazında gruplanmış,',
    'bağımlılık sırasına dizilmiş ve tetikleyicileri yorumlanmış hâli:',
    '`10-kalan-isler.md`. Bir kalemin **gerekçesinin tamamı** her zaman kendi',
    '§-bölümündedir — burada yalnız başlık, tetikleyici ve durum durur.',
    '',
    'Tetikleyici sütunundaki `—`, o kalemin §-bölümünde tetikleyicinin düz yazı',
    'içinde anlatıldığı (ayrıca etiketlenmediği) anlamına gelir.',
    '',
    '**Durum sütununun sınırı:** yalnız kaynak tabloda işaretlenmiş (`✅` /',
    'üstü çizili) kapanışları görür. Bir kalem kapandığında bunu kendi',
    '§-tablosuna yazmak bir alışkanlık meselesidir ve geçmiş turlarda düzenli',
    'yapılmamış — yani "açık" görünen kalemlerin bir kısmı kapanmış olabilir.',
    'Başlıktan otomatik çıkarım denenmedi: yanlış kapatılan bir kalem, listenin',
    'hiç olmamasından kötüdür (§55). Bkz. §70 — bu kalemin kendi ertelemesi.',
    '',
  ];

  let n = 0;
  for (const section of sections) {
    lines.push(`## §${section.no} — ${section.title.replace(/^Bilinçli yapılmayanlar — /, '')}`);
    lines.push('');
    lines.push('| # | Kalem | Tetikleyici | Durum |');
    lines.push('| --- | --- | --- | --- |');
    for (const row of section.rows) {
      n += 1;
      const closed = isClosed(row.title + row.body);
      lines.push(
        `| ${n} | ${row.title} | ${extractTrigger(row.body)} | ${closed ? '✅ kapandı' : 'açık'} |`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

const sections = parse(fs.readFileSync(SOURCE, 'utf8'));
fs.writeFileSync(TARGET, render(sections), 'utf8');

const total = sections.reduce((sum, s) => sum + s.rows.length, 0);
console.log(
  `[finans-eksik-liste] ${sections.length} erteleme bölümü, ${total} kalem → ${path.relative(process.cwd(), TARGET)}`
);
