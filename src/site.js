// Botun tanıtım sayfası: tek sayfa, ortasında "Sunucuna ekle" düğmesi.
// Ayrı bir web sunucusu gerekmesin diye botun HTTP sunucusu üzerinden verilir.
const fs = require('node:fs');
const path = require('node:path');
const instagram = require('./instagram');

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
const SAYFA = fs
  .readFileSync(path.join(__dirname, 'site', 'index.html'), 'utf8')
  .replace(INSTAGRAM_KISMI, (kisim) => (instagram.hazir() ? kisim : ''))
  .replaceAll('{{DAVET}}', DAVET.replaceAll('&', '&amp;'));
// Sayfanın kendi betikleri: adres → içerik
const BETIKLER = new Map(
  ['film.js', 'kaydir.js'].map((ad) => [`/${ad}`, fs.readFileSync(path.join(__dirname, 'site', ad), 'utf8')]),
);

const BASLIKLAR = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-cache',
  // Yalnızca kendi betiklerini çalıştırır; dışarıdan yalnızca yazı tipini yükler. Arka plan filmi
  // (/film.mp4, /film.jpg) aynı alan adından gelir; onları web sunucusu verir (README). film.js filmi
  // fetch ile indirip bellekten (blob:) oynatır; connect-src ve media-src'deki blob: bunun için gerekli.
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
  if (okuma && BETIKLER.has(yol)) {
    yanit
      .writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' })
      .end(istek.method === 'HEAD' ? undefined : BETIKLER.get(yol));
    return;
  }
  if (!okuma || (yol !== '' && yol !== '/index.html')) {
    yanit.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Bulunamadı');
    return;
  }
  yanit.writeHead(200, BASLIKLAR).end(istek.method === 'HEAD' ? undefined : SAYFA);
}

module.exports = { sun };
