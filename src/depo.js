// Basit dosya tabanlı kayıt. Ayarlar ve hatırlatıcılar data/ klasöründe
// JSON olarak tutulur, böylece bot yeniden başlasa da kaybolmaz.
const fs = require('node:fs');
const path = require('node:path');

// VERI_KLASORU yalnızca testler içindir: gerçek data/ klasörüne dokunmadan geçici bir klasöre yazarlar
const KLASOR = process.env.VERI_KLASORU || path.join(__dirname, '..', 'data');

// Kayıtları yalnızca botun kendi kullanıcısı okuyabilsin (ayarlar, imza anahtarı).
// Klasör henüz yoksa yaz() onu doğru izinle oluşturur.
try {
  fs.chmodSync(KLASOR, 0o700);
} catch {
  // Klasör yok
}

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

// Windows'ta virüs tarayıcısı ya da dizin oluşturucu yeni yazılan dosyayı kısa bir süre açık
// tutabilir; o sırada üzerine taşıma EPERM/EACCES/EBUSY verir. Birkaç kez kısa beklemeyle denenir.
// (Linux'ta bu hatalar oluşmaz.)
const TASIMA_DENEMESI = 5;
const kisaBekle = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function tasi(kaynak, hedef) {
  for (let deneme = 1; ; deneme++) {
    try {
      return fs.renameSync(kaynak, hedef);
    } catch (hata) {
      if (deneme >= TASIMA_DENEMESI || !['EPERM', 'EACCES', 'EBUSY'].includes(hata.code)) throw hata;
      kisaBekle(20 * deneme);
    }
  }
}

function yaz(ad, veri) {
  fs.mkdirSync(KLASOR, { recursive: true, mode: 0o700 });
  // Önce geçici dosyaya yaz, sonra yerine taşı: yazma yarıda kesilirse eski dosya sağlam kalır
  const dosya = path.join(KLASOR, `${ad}.json`);
  const gecici = `${dosya}.tmp`;
  fs.writeFileSync(gecici, JSON.stringify(veri, null, 2), { mode: 0o600 });
  tasi(gecici, dosya);
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

// Bir ayarı hiç kaydedilmemiş haline döndürür (ayarKaydet(..., null) "seçildi, boş" anlamına gelir)
function ayarSil(sunucuId, anahtar) {
  const hepsi = oku('ayarlar', {});
  if (!hepsi[sunucuId] || !(anahtar in hepsi[sunucuId])) return;
  delete hepsi[sunucuId][anahtar];
  yaz('ayarlar', hepsi);
}

module.exports = { oku, yaz, ayarlariGetir, ayarKaydet, ayarSil };
