// Dış servislere bağlanırken kullanılan ağ ayarları ve ağ hatalarının kayda yazılacak hali.
//
// Node bir adrese bağlanırken DNS'ten gelen IPv4 ve IPv6 adreslerini sırayla dener ("happy
// eyeballs"); her denemeye varsayılan olarak yalnızca 250 ms tanır, cevap gelmezse onu bırakıp
// sıradakine geçer. Bağlantı gecikmesi bazen 250 ms'yi aşan bir sunucuda IPv4 denemeleri yarıda
// kesilir; IPv6 çalışmıyorsa sıra oraya gelince istek takılır ve 10 sn sonra "fetch failed" ile
// düşer. Denemeye daha uzun süre tanınınca yavaş da olsa cevap veren IPv4 adresi kullanılır.
const dns = require('node:dns');
const net = require('node:net');
const { Agent, setGlobalDispatcher } = require('undici');

const DENEME_SURESI = 1_200;

function agAyarla() {
  dns.setDefaultResultOrder('ipv4first');
  net.setDefaultAutoSelectFamilyAttemptTimeout(DENEME_SURESI);
  // Undici varsayılan olarak 4 sn sonra HTTPS bağlantılarını kapatır; etkileşimlerde her seferinde
  // sıfırdan TCP+TLS el sıkışması yapmamak için bağlantılar 60 sn açık tutulur.
  setGlobalDispatcher(new Agent({ keepAliveTimeout: 60_000, keepAliveMaxTimeout: 600_000 }));
}

// fetch her bağlantı hatasında yalnızca "fetch failed" der; asıl sebep hata.cause içindedir
// (ör. UND_ERR_CONNECT_TIMEOUT, ECONNRESET, ENOTFOUND). Birden çok adres denendiyse sebep
// AggregateError olur, her adresin hatası errors[] içindedir.
function agHatasi(hata) {
  const parcalar = [hata?.message ?? String(hata)];
  const gorulen = new Set([hata]);
  let sebep = hata?.cause;
  while (sebep && !gorulen.has(sebep) && parcalar.length < 5) {
    gorulen.add(sebep);
    const kod = sebep.code ? `${sebep.code}: ` : '';
    const alt = Array.isArray(sebep.errors)
      ? ` [${sebep.errors.map((e) => [e.code, e.address && `${e.address}:${e.port}`].filter(Boolean).join(' ')).join(', ')}]`
      : '';
    parcalar.push(`${kod}${sebep.message || sebep.name || String(sebep)}${alt}`);
    sebep = sebep.cause;
  }
  return parcalar.join(' ← ');
}

module.exports = { agAyarla, agHatasi, DENEME_SURESI };
