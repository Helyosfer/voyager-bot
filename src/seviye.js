// Seviye sistemi: üyeler mesaj yazdıkça XP kazanır, seviye atlayınca duyurulur ve sunucunun
// belirlediği ödül rolleri verilir. Sunucu başına /seviye ayar ile açılır; varsayılan olarak kapalıdır.
// Kayıt: seviyeler.json → { [sunucuId]: { [kullaniciId]: xp } }
// Ayarlar: seviyeAcik, seviyeKanali (boşsa mesajın yazıldığı kanal), seviyeOdulleri → [{ seviye, rolId }]
//
// Mesajın içeriği okunmaz, yalnızca yazıldığı bilinir; Message Content Intent gerekmez.
const crypto = require('node:crypto');
const { Events } = require('discord.js');
const { oku, yaz, ayarlariGetir } = require('./depo');
const { yonetimRolu, yazabilirMi, beklemeSayaci, hataMetni } = require('./yardimci');
const koruma = require('./koruma');

const BEKLEME = 60_000; // Kişi bu sürede en fazla bir kez XP kazanır; art arda yazmak işe yaramaz
const XP_EN_AZ = 15;
const XP_EN_COK = 25;
const ODUL_SINIRI = 10;
const KAYIT_ARALIGI = 60_000;

const bekleme = beklemeSayaci(BEKLEME);

// Her mesajda dosya yazılmasın diye XP bellekte tutulur, dakikada bir ve bot kapanırken kaydedilir.
// Bot çökerse en fazla son dakikanın XP'si kaybolur.
let veri = null;
let degisti = false;
const yukle = () => (veri ??= oku('seviyeler', {}));

function kaydet() {
  if (!degisti) return;
  degisti = false;
  try {
    yaz('seviyeler', veri);
  } catch (hata) {
    degisti = true; // Bir sonraki seferde yeniden denensin
    console.error('Seviye kayıtları yazılamadı:', hata.message);
  }
}

// Bir seviyeden sonrakine geçmek için gereken XP: seviye ilerledikçe artar (0→1: 100, 1→2: 155, 9→10: 1.005)
const gereken = (seviye) => 5 * seviye ** 2 + 50 * seviye + 100;

// Toplam XP → { seviye, ilerleme (bu seviyede kazanılan), sonraki (bu seviyeyi bitirmek için gereken) }
function seviyeBul(xp) {
  let seviye = 0;
  let kalan = xp;
  while (kalan >= gereken(seviye)) kalan -= gereken(seviye++);
  return { seviye, ilerleme: kalan, sonraki: gereken(seviye) };
}

const ayarCoz = (ayar) => ({ acik: ayar.seviyeAcik === true, kanal: ayar.seviyeKanali ?? null, oduller: ayar.seviyeOdulleri ?? [] });

const xp = (sunucuId, kullaniciId) => yukle()[sunucuId]?.[kullaniciId] ?? 0;

// XP'ye göre sıralanmış [kullaniciId, xp] listesi
const siralama = (sunucuId) => Object.entries(yukle()[sunucuId] ?? {}).sort((a, b) => b[1] - a[1]);

function sifirla(sunucuId, kullaniciId) {
  const sunucu = yukle()[sunucuId];
  if (!sunucu?.[kullaniciId]) return false;
  delete sunucu[kullaniciId];
  degisti = true;
  kaydet();
  return true;
}

// Üyenin ulaştığı seviyeye kadarki, henüz almadığı ödül rollerini verir. Ödül ayarlandıktan sonra
// role yönetim yetkisi eklenmiş ya da rol botun üstüne taşınmışsa vermez.
async function odulVer(uye, seviye, oduller) {
  const verilen = [];
  for (const odul of oduller) {
    if (odul.seviye > seviye || uye.roles.cache.has(odul.rolId)) continue;
    const rol = uye.guild.roles.cache.get(odul.rolId);
    if (!rol || rol.managed || yonetimRolu(rol) || rol.position >= uye.guild.members.me.roles.highest.position) continue;
    const oldu = await uye.roles.add(rol, `${odul.seviye}. seviye ödülü`).then(() => true, () => false);
    if (oldu) verilen.push(rol);
  }
  return verilen;
}

async function seviyeAtladi(mesaj, seviye, ayar) {
  const verilen = await odulVer(mesaj.member, seviye, ayar.oduller);
  const kanal = ayar.kanal ? await mesaj.guild.channels.fetch(ayar.kanal).catch(() => null) : mesaj.channel;
  if (!kanal?.isTextBased() || !yazabilirMi(kanal)) return;
  await kanal
    .send({
      content: `🎉 ${mesaj.author} **${seviye}. seviyeye** ulaştı!${verilen.length ? ` Yeni rol: ${verilen.join(' ')}` : ''}`,
      allowedMentions: { users: [mesaj.author.id] },
    })
    .catch(() => {});
}

async function mesajGeldi(mesaj) {
  if (!mesaj.guild || !mesaj.member || mesaj.author?.bot || mesaj.webhookId || mesaj.system) return;
  // Otomatik korumanın silmek üzere yakaladığı mesaj (spam, küfür, zararlı bağlantı) XP kazandırmaz
  if (koruma.yakalandi(mesaj)) return;
  const ayar = ayarCoz(ayarlariGetir(mesaj.guild.id));
  if (!ayar.acik) return;
  const anahtar = `${mesaj.guild.id}:${mesaj.author.id}`;
  if (bekleme.bekle(anahtar)) return;
  bekleme.isaretle(anahtar);

  const sunucu = (yukle()[mesaj.guild.id] ??= {});
  const onceki = sunucu[mesaj.author.id] ?? 0;
  sunucu[mesaj.author.id] = onceki + crypto.randomInt(XP_EN_AZ, XP_EN_COK + 1);
  degisti = true;
  const yeni = seviyeBul(sunucu[mesaj.author.id]).seviye;
  if (yeni > seviyeBul(onceki).seviye) await seviyeAtladi(mesaj, yeni, ayar);
}

function baslat(client) {
  client.on(Events.MessageCreate, (mesaj) => {
    // Bir tur sonra: otomatik koruma aynı olayda mesaj hakkındaki kararını o ana kadar vermiş olur.
    // Dinleyicilerin kayıt sırasına ya da korumanın içindeki beklemelere bağlı değildir.
    setImmediate(() => mesajGeldi(mesaj).catch((hata) => console.error('Seviye hatası:', hataMetni(hata))));
  });
  setInterval(kaydet, KAYIT_ARALIGI).unref();
  // systemd botu durdururken (güncelleme, yeniden başlatma) SIGTERM gönderir; bellekteki XP kaybolmasın
  for (const sinyal of ['SIGTERM', 'SIGINT']) {
    process.once(sinyal, () => {
      kaydet();
      process.exit(0);
    });
  }
}

module.exports = { ODUL_SINIRI, ayarCoz, gereken, seviyeBul, xp, siralama, sifirla, odulVer, mesajGeldi, kaydet, baslat };
