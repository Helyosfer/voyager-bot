// Botun tanıtım sayfası: tek sayfa, ortasında "Sunucuna ekle" düğmesi.
// Ayrı bir web sunucusu gerekmesin diye botun HTTP sunucusu üzerinden verilir.
const fs = require('node:fs');
const path = require('node:path');
const instagram = require('./instagram');
const { SABLONLAR } = require('./sablonlar');
const { GOREVLER } = require('./yardim-gorevler');
// yayin/index.js değil platform dosyaları: index.js bu dosyayı yüklediği için döngü olmasın
const YAYIN_PLATFORMLARI = [
  { modul: require('./yayin/twitch'), ad: 'Twitch', anlik: true },
  { modul: require('./yayin/kick'), ad: 'Kick', anlik: true },
  { modul: require('./yayin/youtube'), ad: 'YouTube', anlik: false },
];

// Davet bağlantısı izinleri ve "bot" kapsamını açıkça taşır. Yalnızca client_id içeren kısa
// bağlantı Developer Portal'daki varsayılan kurulum ayarlarına bağlıdır; orada "bot"
// kapsamı seçili değilse komutlar eklenir ama botun kendisi sunucuya girmez.
// Sayfada tek davet var: bot bütün özellikleri için gereken izinlerle eklenir, kullanıcı izin seçmekle
// uğraşmaz. Yönetici (Administrator) bilerek istenmez: bot yalnızca kullandığı izinleri alır.
// İzinler: Kanalları Gör, Mesaj Gönder, Bağlantı Yerleştir, Dosya Ekle, Tepki Ekle, Mesaj Geçmişini Oku,
// Mesajları Yönet, Üyeleri At, Üyeleri Yasakla, Zaman Aşımı Uygula, Rolleri Yönet, Denetim Kaydını
// Görüntüle; /sunucukur için Kanalları Yönet; /oyun everyone ve etiketlenemeyen rolleri etiketlemek için
// @everyone, @here ve Tüm Rollerden Bahset. /kilit bir izni ancak botta da varsa kilitleyebildiği için
// ayrıca: konu izinleri, Bağlan, Konuş, Video, Üyeleri Taşı.
const IZINLER = '1477757365974';
const DAVET =
  'https://discord.com/oauth2/authorize' +
  `?client_id=${process.env.CLIENT_ID ?? ''}&scope=bot+applications.commands&permissions=${IZINLER}`;
// Sayfadaki <!--instagram--> ... <!--/instagram--> arası, bağlantısı kurulmamışsa çıkarılır:
// /instagram o durumda yüklenmez; sayfa da olmayan bir komutu tanıtmasın.
const INSTAGRAM_KISMI = /[ \t]*<!--instagram-->[\s\S]*?<!--\/instagram-->\r?\n?/g;

const html = (metin) => metin.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
// "A", "A ve B", "A, B ve C"
const birlestir = (adlar) => (adlar.length < 2 ? adlar.join('') : `${adlar.slice(0, -1).join(', ')} ve ${adlar.at(-1)}`);

// /sunucukur vitrini şablonlardan hesaplanır; şablon eklenince ya da değişince sayfa eskimez
function sablonBilgileri() {
  const sablonlar = Object.values(SABLONLAR);
  return {
    '{{SABLON_SAYISI}}': String(sablonlar.length),
    '{{EN_COK_ROL}}': String(Math.max(...sablonlar.map((s) => s.roller.length))),
    '{{EN_COK_KANAL}}': String(Math.max(...sablonlar.map((s) => s.kategoriler.reduce((t, k) => t + k.kanallar.length, 0)))),
    '{{SABLON_ADLARI}}': sablonlar.map((s) => `          <li>${html(s.ad)}</li>`).join('\n'),
  };
}

// Sayfa yalnızca bot sahibinin kurduğu yayın platformlarını anlatır (Twitch anahtarı yoksa Twitch geçmez).
// Hiçbiri kurulu değilse hepsi anlatılır: /yayin komutu yine yüklenir.
function yayinBilgileri() {
  const kurulu = YAYIN_PLATFORMLARI.filter((p) => p.modul.hazir());
  const platformlar = kurulu.length ? kurulu : YAYIN_PLATFORMLARI;
  const anlik = platformlar.filter((p) => p.anlik).map((p) => p.ad);
  const yavas = platformlar.filter((p) => !p.anlik).map((p) => p.ad);
  // Bütün adlar sessiz harfle bitiyor ve sonu ince sesli: Twitch'te, Kick'te; YouTube'da
  const hiz = [anlik.length ? `${birlestir(anlik)}'te anında` : null, yavas.length ? `${birlestir(yavas)}'da birkaç dakika içinde` : null];
  return {
    '{{YAYIN_ETIKET}}': platformlar.map((p) => p.ad).join(' · '),
    '{{YAYIN_LISTE}}': birlestir(platformlar.map((p) => p.ad)),
    '{{YAYIN_HIZ}}': hiz.filter(Boolean).join(', '),
  };
}

// Sunucularda görünen komut sayısı: sahibe özel ve yüklenmeyen (ör. kurulmamış /instagram) komutlar sayılmaz
function komutSayisi() {
  const klasor = path.join(__dirname, 'commands');
  return fs
    .readdirSync(klasor)
    .filter((d) => d.endsWith('.js'))
    .map((d) => require(path.join(klasor, d)))
    .filter((k) => !k.sahipKomutu && k.etkin?.() !== false).length;
}

function sayfaUret() {
  let sayfa = fs
    .readFileSync(path.join(__dirname, 'site', 'index.html'), 'utf8')
    .replace(INSTAGRAM_KISMI, (kisim) => (instagram.hazir() ? kisim : ''))
    .replaceAll('{{DAVET}}', DAVET.replaceAll('&', '&amp;'));
  const yardim = { '{{REHBER_SAYISI}}': String(GOREVLER.length), '{{KOMUT_SAYISI}}': String(komutSayisi()) };
  for (const [yer, deger] of Object.entries({ ...sablonBilgileri(), ...yayinBilgileri(), ...yardim })) sayfa = sayfa.replaceAll(yer, deger);
  return sayfa;
}
// İlk istekte üretilir: komut sayısı için komut dosyaları yüklenir, onlar da (ör. /yayin → yayin/index.js →
// bu dosya) yükleme sırasında bu dosyaya döner; açılışta üretilseydi döngü yarım modül verirdi.
let SAYFA = null;
const FILM_BETIGI = fs.readFileSync(path.join(__dirname, 'site', 'film.js'), 'utf8');

const BASLIKLAR = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-cache',
  // Yalnızca kendi betiğini çalıştırır; dışarıdan yalnızca yazı tipini yükler. Arka plan filmi
  // (/film.mp4, /film.jpg) aynı alan adından gelir; onları web sunucusu verir (README). film.js filmi
  // fetch ile indirip bellekten (blob:) oynatır; connect-src ve media-src'deki blob: bunun için

  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; media-src 'self' blob:; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  // Site bir kez https ile açıldıysa tarayıcı bir yıl boyunca bu alan adında http kullanmaz.
  // Yalnızca bu alan adı için geçerlidir (alt alan adlarını kapsamaz); http üzerinden gelen cevapta yok sayılır.
  'Strict-Transport-Security': 'max-age=31536000',
};

// yol: sondaki / işareti atılmış adres yolu ("" ana sayfadır)
function sun(istek, yanit, yol) {
  const okuma = istek.method === 'GET' || istek.method === 'HEAD';
  if (okuma && yol === '/film.js') {
    yanit
      .writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' })
      .end(istek.method === 'HEAD' ? undefined : FILM_BETIGI);
    return;
  }
  if (!okuma || (yol !== '' && yol !== '/index.html')) {
    yanit.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Bulunamadı');
    return;
  }
  SAYFA ??= sayfaUret();
  yanit.writeHead(200, BASLIKLAR).end(istek.method === 'HEAD' ? undefined : SAYFA);
}

module.exports = { sun, sayfaUret };
