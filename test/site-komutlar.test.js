// Tanıtım sayfasındaki komut listesinin botun gerçek komutlarıyla uyumu. Çalıştırmak için: npm test
//
// Sayfa öne çıkan komutları listeler; listelenen her komut botta olmalı ve geri kalanlar için /yardim anılmalı.
// Bir komut kaldırılır ya da adı değişirse bu test sayfanın unutulmasını yakalar. Bot başlatılmaz, hiçbir şey ağa çıkmaz.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Yapay zekâ komutları (/sor, /ozetle) anahtar yoksa yüklenmez; liste onlarla birlikte denensin
process.env.GEMINI_API_KEY = 'test-anahtari';
process.env.GEMINI_MODEL = 'test-modeli';

const KOMUT_KLASORU = path.join(__dirname, '..', 'src', 'commands');
const komutlar = fs
  .readdirSync(KOMUT_KLASORU)
  .filter((d) => d.endsWith('.js'))
  .map((d) => require(path.join(KOMUT_KLASORU, d)))
  // Sahibe özel komutlar (/sunucular) sayfada tanıtılmaz; /yardim da göstermez
  .filter((k) => !k.sahipKomutu);

const SAYFA = fs.readFileSync(path.join(__dirname, '..', 'src', 'site', 'index.html'), 'utf8');
const BOLUM = SAYFA.slice(SAYFA.indexOf('<section id="komutlar">'), SAYFA.indexOf('<section class="son">'));

// Sayfadaki her satır: komut adı ve (varsa) alt komut yazısı
const listelenenler = new Map(
  [...BOLUM.matchAll(/<li><code>\/([a-z]+)<\/code><span>.*?(?:<span class="alt">([^<]*)<\/span>)?<\/span><\/li>/g)].map((m) => [
    m[1],
    (m[2] ?? '').split('·').map((a) => a.trim()).filter(Boolean),
  ]),
);

// Sayfa bütün komutları değil öne çıkanları listeler; geri kalanına /yardim ulaştırır
test('sayfadaki her komut botta var', () => {
  const gercek = new Set(komutlar.map((k) => k.data.name));
  assert.ok(listelenenler.size >= 5, 'öne çıkan komutlar listelenmeli');
  for (const ad of listelenenler.keys()) assert.ok(gercek.has(ad), `/${ad} botta yok`);
});

test('sayfada alt komut yazılmışsa botunkilerle aynı sırada', () => {
  for (const komut of komutlar) {
    const ad = komut.data.name;
    if (!listelenenler.get(ad)?.length) continue;
    const gercek = komut.data.toJSON().options?.filter((o) => o.type === 1).map((o) => o.name) ?? [];
    assert.deepEqual(listelenenler.get(ad), gercek, `/${ad} alt komutları sayfada farklı`);
  }
});

test('her komut bir kez listelenir', () => {
  const tum = [...BOLUM.matchAll(/<li><code>\/([a-z]+)<\/code>/g)].map((m) => m[1]);
  assert.equal(new Set(tum).size, tum.length);
});

test('sayfa geri kalan komutlar için /yardim\'a yönlendirir', () => {
  assert.ok(BOLUM.includes('<code>/yardim</code>'));
});
