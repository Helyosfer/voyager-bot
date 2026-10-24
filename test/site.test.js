// Tanıtım sayfasının bottan hesaplanan kısımları (şablon sayıları, kurulu yayın platformları).
// Komut listesinin uyumunu test/site-komutlar.test.js denetler.
const test = require('node:test');
const assert = require('node:assert');

const site = require('../src/site');
const { SABLONLAR } = require('../src/sablonlar');
const platform = (ad) => require(`../src/yayin/${ad}`);

function platformlarla(kurulu, is) {
  const eski = {};
  for (const ad of ['twitch', 'kick', 'youtube']) {
    eski[ad] = platform(ad).hazir;
    platform(ad).hazir = () => kurulu.includes(ad);
  }
  try {
    return is(site.sayfaUret());
  } finally {
    for (const ad of Object.keys(eski)) platform(ad).hazir = eski[ad];
  }
}

test('sayfa: yer tutucu kalmaz', () => {
  assert.deepEqual(site.sayfaUret().match(/\{\{[A-Z_]+\}\}/g), null);
});

test('sayfa: /sunucukur vitrini şablonlardan hesaplanır', () => {
  const sayfa = site.sayfaUret();
  const sablonlar = Object.values(SABLONLAR);
  assert.ok(sayfa.includes(`<b>${sablonlar.length}</b>hazır şablon`));
  assert.ok(sayfa.includes(`<b>${Math.max(...sablonlar.map((s) => s.roller.length))}</b>role kadar`));
  for (const s of sablonlar) assert.ok(sayfa.includes(`<li>${s.ad}</li>`), s.ad);
});

test('sayfa: yalnızca kurulu yayın platformları anlatılır', () => {
  platformlarla(['kick', 'youtube'], (sayfa) => {
    assert.ok(!/Twitch/.test(sayfa), 'Twitch kurulu değilken sayfada geçmemeli');
    assert.ok(sayfa.includes("Kick'te anında, YouTube'da birkaç dakika içinde."));
    assert.ok(sayfa.includes('<span>Kick ve YouTube yayınlarını duyurur<span class="alt">'));
  });
  platformlarla(['twitch', 'kick', 'youtube'], (sayfa) => {
    assert.ok(sayfa.includes('/yayin · Twitch · Kick · YouTube'));
    assert.ok(sayfa.includes("Twitch ve Kick'te anında, YouTube'da birkaç dakika içinde."));
    assert.ok(sayfa.includes('<span>Twitch, Kick ve YouTube yayınlarını duyurur<span class="alt">'));
  });
  // Hiçbiri kurulu değilse /yayin yine yüklenir; sayfa hepsini anlatır
  platformlarla([], (sayfa) => assert.ok(sayfa.includes('/yayin · Twitch · Kick · YouTube')));
});
