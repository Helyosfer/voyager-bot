// Ağ ayarı ve ağ hatalarının kayda yazılan halinin testleri. Çalıştırmak için: npm test
//
// Hiçbir test dış ağa çıkmaz; bağlantı hatası bu makinede kapalı bir porta istek atılarak üretilir.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const path = require('node:path');

const { agAyarla, agHatasi, DENEME_SURESI } = require(path.join(__dirname, '..', 'src', 'ag'));

test('agAyarla: bağlantı denemesine 250 ms yerine daha uzun süre tanır', () => {
  const onceki = net.getDefaultAutoSelectFamilyAttemptTimeout();
  try {
    agAyarla();
    assert.equal(net.getDefaultAutoSelectFamilyAttemptTimeout(), DENEME_SURESI);
    assert.ok(DENEME_SURESI >= 1_000, 'gecikmesi yüksek ağlarda IPv4 denemesi yarıda kesilmesin');
    // Adresler arasında geçiş açık kalır; yalnızca her denemeye tanınan süre değişir
    assert.equal(net.getDefaultAutoSelectFamily(), true);
  } finally {
    net.setDefaultAutoSelectFamilyAttemptTimeout(onceki);
  }
});

test('agHatasi: fetch hatasının asıl sebebi kayda yazılır', async () => {
  // Boş bir port bulup kapat: oraya istek bağlantı reddiyle düşer
  const sunucu = net.createServer();
  await new Promise((r) => sunucu.listen(0, '127.0.0.1', r));
  const { port } = sunucu.address();
  await new Promise((r) => sunucu.close(r));

  const hata = await fetch(`http://127.0.0.1:${port}/`).then(() => null, (e) => e);
  assert.ok(hata, 'kapalı porta istek düşmeliydi');
  assert.equal(hata.message, 'fetch failed');
  const metin = agHatasi(hata);
  assert.match(metin, /^fetch failed ← /);
  assert.match(metin, /ECONNREFUSED/);
});

test('agHatasi: zaman aşımı ve denenen adresler görünür', () => {
  // Node'un fetch'inin bağlantı zaman aşımında verdiği hatanın biçimi
  const sebep = Object.assign(new Error('Connect Timeout Error (attempted addresses: 188.114.97.7:443, 2a06:98c1:3121::7:443, timeout: 10000ms)'), {
    code: 'UND_ERR_CONNECT_TIMEOUT',
  });
  const metin = agHatasi(new TypeError('fetch failed', { cause: sebep }));
  assert.equal(metin, `fetch failed ← UND_ERR_CONNECT_TIMEOUT: ${sebep.message}`);
});

test('agHatasi: birden çok adres denendiyse her birinin hatası yazılır', () => {
  const adresHatasi = (code, address) => Object.assign(new Error(code), { code, address, port: 443 });
  const toplu = new AggregateError([adresHatasi('ETIMEDOUT', '1.2.3.4'), adresHatasi('ENETUNREACH', '2001:db8::1')], '');
  toplu.code = 'ETIMEDOUT';
  const metin = agHatasi(new TypeError('fetch failed', { cause: toplu }));
  assert.equal(metin, 'fetch failed ← ETIMEDOUT: AggregateError [ETIMEDOUT 1.2.3.4:443, ENETUNREACH 2001:db8::1:443]');
});

test('agHatasi: sebebi olmayan hata ve döngülü sebep zinciri', () => {
  assert.equal(agHatasi(new Error('YouTube akışı HTTP 500')), 'YouTube akışı HTTP 500');
  assert.equal(agHatasi('düz metin'), 'düz metin');
  const a = new Error('a');
  const b = new Error('b', { cause: a });
  a.cause = b;
  assert.equal(agHatasi(a), 'a ← b');
});
