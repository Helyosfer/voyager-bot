// Basit dosya tabanlı kayıt. Ayarlar ve hatırlatıcılar data/ klasöründe
// JSON olarak tutulur, böylece bot yeniden başlasa da kaybolmaz.
const fs = require('node:fs');
const path = require('node:path');

const KLASOR = path.join(__dirname, '..', 'data');

function oku(ad, varsayilan) {
  try {
    return JSON.parse(fs.readFileSync(path.join(KLASOR, `${ad}.json`), 'utf8'));
  } catch {
    return varsayilan;
  }
}

function yaz(ad, veri) {
  fs.mkdirSync(KLASOR, { recursive: true });
  fs.writeFileSync(path.join(KLASOR, `${ad}.json`), JSON.stringify(veri, null, 2));
}

// Sunucu başına ayarlar: { [sunucuId]: { logKanali, hosgeldinKanali, otoRol } }
function ayarlariGetir(sunucuId) {
  return oku('ayarlar', {})[sunucuId] ?? {};
}

function ayarKaydet(sunucuId, anahtar, deger) {
  const hepsi = oku('ayarlar', {});
  hepsi[sunucuId] = { ...hepsi[sunucuId], [anahtar]: deger };
  yaz('ayarlar', hepsi);
}

module.exports = { oku, yaz, ayarlariGetir, ayarKaydet };
