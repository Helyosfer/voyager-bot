// Tanıtım sayfasındaki komut listesinin botun gerçek komutlarıyla uyumu. Çalıştırmak için: npm test
//
// Yeni bir komut eklenir ya da bir komutun alt komutları değişirse sayfadaki liste de güncellenmeli;
// bu test unutulmasını yakalar. Bot başlatılmaz, hiçbir şey ağa çıkmaz.
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

test('sayfadaki komutlar ile botun komutları aynı', () => {
  const gercek = komutlar.map((k) => k.data.name).sort();
  assert.deepEqual([...listelenenler.keys()].sort(), gercek);
});

test('sayfadaki alt komutlar botunkilerle aynı sırada', () => {
  for (const komut of komutlar) {
    const ad = komut.data.name;
    const gercek = komut.data.toJSON().options?.filter((o) => o.type === 1).map((o) => o.name) ?? [];
    assert.deepEqual(listelenenler.get(ad), gercek, `/${ad} alt komutları sayfada farklı`);
  }
});

test('her komut bir kez listelenir', () => {
  const tum = [...BOLUM.matchAll(/<li><code>\/([a-z]+)<\/code>/g)].map((m) => m[1]);
  assert.equal(new Set(tum).size, tum.length);
});
