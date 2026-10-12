// Botun tanıtım sayfası: tek sayfa, ortasında "Sunucuna ekle" düğmesi.
// Ayrı bir web sunucusu gerekmesin diye botun HTTP sunucusu üzerinden verilir.
const fs = require('node:fs');
const path = require('node:path');

// Davet linki izinleri ve "bot" kapsamını açıkça taşır. Yalnızca client_id içeren kısa
// link Developer Portal'daki varsayılan kurulum ayarlarına bağlıdır; orada "bot"
// kapsamı seçili değilse komutlar eklenir ama botun kendisi sunucuya girmez.
// İzinler: Kanalları Gör, Mesaj Gönder, Bağlantı Yerleştir, Mesaj Geçmişini Oku,
// Mesajları Yönet, Üyeleri At, Üyeleri Yasakla, Zaman Aşımı Uygula, Rolleri Yönet,
// Denetim Kaydını Görüntüle.
const DAVET_IZINLERI = '1099780156550';
const DAVET =
  'https://discord.com/oauth2/authorize' +
  `?client_id=${process.env.CLIENT_ID ?? ''}&scope=bot+applications.commands&permissions=${DAVET_IZINLERI}`;
const SAYFA = fs.readFileSync(path.join(__dirname, 'site', 'index.html'), 'utf8').replaceAll('{{DAVET}}', DAVET.replaceAll('&', '&amp;'));
const FILM_BETIGI = fs.readFileSync(path.join(__dirname, 'site', 'film.js'), 'utf8');

const BASLIKLAR = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-cache',
  // Yalnızca kendi betiğini çalıştırır; dışarıdan yalnızca yazı tipi ve NASA'nın arka plan filmini yükler
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; media-src https://svs.gsfc.nasa.gov; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

// yol: sondaki / atılmış adres yolu ("" ana sayfadır)
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
  yanit.writeHead(200, BASLIKLAR).end(istek.method === 'HEAD' ? undefined : SAYFA);
}

module.exports = { sun };
