// Basit dosya tabanlı kayıt. Ayarlar ve hatırlatıcılar data/ klasöründe
// JSON olarak tutulur, böylece bot yeniden başlasa da kaybolmaz.
const fs = require('node:fs');
const path = require('node:path');

const KLASOR = path.join(__dirname, '..', 'data');

function oku(ad, varsayilan) {
  const dosya = path.join(KLASOR, `${ad}.json`);
  let icerik;
  try {
    icerik = fs.readFileSync(dosya, 'utf8');
  } catch (hata) {
    if (hata.code === 'ENOENT') return varsayilan; // Henüz hiç kaydedilmemiş
    throw hata;
  }

  try {
    return JSON.parse(icerik);
  } catch {
    // Bozuk dosyayı kenara al; yoksa bir sonraki kayıt üstüne yazıp içindekileri yok eder
    const yedek = `${dosya}.bozuk-${Date.now()}`;
    fs.renameSync(dosya, yedek);
    console.error(`${ad}.json okunamadı, varsayılan değerlerle devam ediliyor. Bozuk dosya: ${yedek}`);
    return varsayilan;
  }
}

function yaz(ad, veri) {
  fs.mkdirSync(KLASOR, { recursive: true });
  // Önce geçici dosyaya yaz, sonra yerine taşı: yazma yarıda kesilirse eski dosya sağlam kalır
  const dosya = path.join(KLASOR, `${ad}.json`);
  const gecici = `${dosya}.tmp`;
  fs.writeFileSync(gecici, JSON.stringify(veri, null, 2));
  fs.renameSync(gecici, dosya);
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
