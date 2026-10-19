// Canlı yayın bildirimleri: takip edilen yayıncılar yayına geçince seçilen kanala haber verir.
// Ayarlar /yayin komutuyla yapılır. Twitch ve Kick haberi kendileri gönderir (webhook),
// bu yüzden bot küçük bir HTTP sunucusu açar; YouTube düzenli aralıklarla kontrol edilir.
const http = require('node:http');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, escapeMarkdown } = require('discord.js');
const { oku, yaz, ayarlariGetir } = require('../depo');
const { adAyikla } = require('./ortak');
const site = require('../site');

const PLATFORMLAR = {
  twitch: require('./twitch'),
  kick: require('./kick'),
  youtube: require('./youtube'),
};
// Webhook'ların geldiği platformlar ve yolları
const WEBHOOK_YOLLARI = { '/twitch': PLATFORMLAR.twitch, '/kick': PLATFORMLAR.kick };

const PORT = Number(process.env.YAYIN_PORT) || 8788;
// Bir sunucunun takip edebileceği yayıncı sayısı. Platformların sınırı (uygulama
// başına 10.000 abonelik) bütün sunucular arasında ortak olduğu için tek bir
// sunucu havuzu tüketemesin.
const SUNUCU_BASI_SINIR = 50;
// Bütün sunucuların bir platformda takip ettiği farklı yayıncı sayısı
const PLATFORM_BASI_SINIR = 9000;
const ESITLEME_ARALIGI = 6 * 60 * 60_000;

let client = null;

// Takip listesi: { [sunucuId]: [{ platform, id, giris, ad }] }
const liste = (sunucuId) => oku('yayincilar', {})[sunucuId] ?? [];

function takipEdilenler(platform) {
  const hepsi = Object.values(oku('yayincilar', {})).flat();
  return [...new Set(hepsi.filter((y) => y.platform === platform).map((y) => y.id))];
}

const esitle = (platform) => PLATFORMLAR[platform].esitle(takipEdilenler(platform));

// Başarılıysa { yayinci }, değilse { hata } döndürür.
async function ekle(sunucuId, platform, girdi) {
  const p = PLATFORMLAR[platform];
  if (!p.hazir()) return { hata: `${p.ad} bağlantısı henüz kurulmamış. Botun .env dosyasında şunlar dolu olmalı: ${p.gereken}.` };

  const yayinci = await p.bul(girdi);
  if (!yayinci) return { hata: `${p.ad} üzerinde "${girdi}" adında bir kanal bulamadım.` };

  const hepsi = oku('yayincilar', {});
  const kayitlar = (hepsi[sunucuId] ??= []);
  if (kayitlar.some((y) => y.platform === platform && y.id === yayinci.id)) return { hata: `**${yayinci.ad}** zaten listede.` };
  if (kayitlar.length >= SUNUCU_BASI_SINIR) return { hata: `Bir sunucu en fazla ${SUNUCU_BASI_SINIR} yayıncı takip edebilir.` };
  const takipte = takipEdilenler(platform);
  if (!takipte.includes(yayinci.id) && takipte.length >= PLATFORM_BASI_SINIR) {
    return { hata: `Botun ${p.ad} kapasitesi doldu; şu an yeni yayıncı eklenemiyor.` };
  }

  kayitlar.push({ platform, ...yayinci });
  yaz('yayincilar', hepsi);
  try {
    await esitle(platform);
  } catch (hata) {
    // Abonelik kurulamadıysa bildirim hiç gelmez; listede yanıltıcı bir kayıt bırakılmaz
    cikar(sunucuId, platform, yayinci.id);
    throw hata;
  }
  return { yayinci };
}

// girdi: kanal adı, adresi ya da kimliği. Çıkarılan kaydı ya da null döndürür.
function cikar(sunucuId, platform, girdi) {
  const aranan = adAyikla(girdi).toLowerCase();
  const hepsi = oku('yayincilar', {});
  const kayitlar = hepsi[sunucuId] ?? [];
  const sira = kayitlar.findIndex(
    (y) => y.platform === platform && [y.id, y.giris, y.ad].some((deger) => deger.toLowerCase() === aranan),
  );
  if (sira === -1) return null;
  const [silinen] = kayitlar.splice(sira, 1);
  yaz('yayincilar', hepsi);
  return silinen;
}

// Kanala gönderilecek bildirimin tamamı: üst satır, kart ve "Yayını izle" düğmesi
function bildirimMesaji(platform, bilgi, rol = null) {
  const p = PLATFORMLAR[platform];
  const embed = new EmbedBuilder()
    .setAuthor({ name: bilgi.ad, iconURL: bilgi.profil ?? undefined, url: bilgi.url })
    .setTitle((bilgi.baslik || 'Canlı yayın').slice(0, 256))
    .setURL(bilgi.url)
    .setColor(p.renk)
    .addFields({ name: 'Platform', value: `${p.simge} ${p.ad}`, inline: true })
    .setFooter({ text: 'Canlı yayın bildirimi' })
    .setTimestamp();
  if (bilgi.oyun) embed.addFields({ name: 'Kategori', value: bilgi.oyun, inline: true });
  if (Number.isFinite(bilgi.basladi)) {
    embed.addFields({ name: 'Başladı', value: `<t:${Math.floor(bilgi.basladi / 1000)}:R>`, inline: true });
  }
  if (bilgi.resim) embed.setImage(bilgi.resim);

  const dugme = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Yayını izle').setURL(bilgi.url);
  return {
    // Ad platformdan gelir; içindeki biçimlendirme ve bağlantı yazımı mesajda çalışmasın
    content: `${rol ? `<@&${rol}> ` : ''}🔴 **${escapeMarkdown(String(bilgi.ad), { maskedLink: true })}** yayında!`,
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(dugme)],
    allowedMentions: rol ? { roles: [rol] } : { parse: [] },
  };
}

async function kanalaGonder(sunucuId, platform, bilgi) {
  const ayar = ayarlariGetir(sunucuId);
  const guild = client.guilds.cache.get(sunucuId);
  if (!ayar.yayinKanali || !guild) return;
  const kanal = await guild.channels.fetch(ayar.yayinKanali).catch(() => null);
  if (!kanal?.isTextBased()) return;
  await kanal.send(bildirimMesaji(platform, bilgi, ayar.yayinRol));
}

// Platformlar yayın başladığında bunu çağırır. bilgi.anahtar o yayına özgüdür;
// aynı yayın için ikinci kez (yinelenen gönderim, yeniden başlatma) haber verilmez.
async function bildir(platform, id, bilgi) {
  const durum = oku('yayin-durum', {});
  const anahtar = `${platform}:${id}`;
  if (durum[anahtar] === bilgi.anahtar) return;
  durum[anahtar] = bilgi.anahtar;
  yaz('yayin-durum', durum);

  for (const [sunucuId, kayitlar] of Object.entries(oku('yayincilar', {}))) {
    if (!kayitlar.some((y) => y.platform === platform && y.id === id)) continue;
    await kanalaGonder(sunucuId, platform, bilgi).catch((hata) => {
      console.error(`Yayın bildirimi gönderilemedi (${sunucuId}):`, hata.message);
    });
  }

  // Gecikmenin nereden geldiği görülsün: platformun geç haber vermesinden mi, botun işlemesinden mi
  const sure = (ms) => (Number.isFinite(ms) ? `${(ms / 1000).toFixed(1)} sn` : 'bilinmiyor');
  console.log(
    `Yayın bildirildi: ${PLATFORMLAR[platform].ad} · ${bilgi.ad} · platform ${sure(bilgi.geldi - bilgi.basladi)} sonra haber verdi, bot ${sure(Date.now() - bilgi.geldi)} içinde gönderdi`,
  );
}

function webhookSunucusu() {
  const sunucu = http.createServer((istek, yanit) => {
    let yol;
    try {
      yol = new URL(istek.url, 'http://yerel').pathname.replace(/\/+$/, '');
    } catch {
      // "//" gibi ayrıştırılamayan adresler. Yakalanmazsa hata bütün botu kapatır;
      // bu adrese internetteki herkes istek atabilir.
      yanit.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Geçersiz istek');
      return;
    }
    // Bağlantısı kurulmamış platformun webhook'u işlenmez
    const platform = Object.hasOwn(WEBHOOK_YOLLARI, yol) && WEBHOOK_YOLLARI[yol].hazir() ? WEBHOOK_YOLLARI[yol] : null;
    if (istek.method !== 'POST' || !platform) {
      site.sun(istek, yanit, yol); // Webhook dışındaki her şey: tanıtım sayfası ya da 404
      return;
    }

    const parcalar = [];
    let boyut = 0;
    istek.on('data', (parca) => {
      boyut += parca.length;
      if (boyut > 1_000_000) istek.destroy();
      else parcalar.push(parca);
    });
    istek.on('end', async () => {
      try {
        const sonuc = await platform.webhook(istek.headers, Buffer.concat(parcalar));
        yanit.writeHead(sonuc.durum, sonuc.basliklar ?? {}).end(sonuc.govde ?? '');
      } catch (hata) {
        console.error(`${platform.ad} webhook hatası:`, hata.message);
        yanit.writeHead(500).end();
      }
    });
  });
  sunucu.on('error', (hata) => console.error('Webhook sunucusu hatası:', hata.message));
  // Yalnızca bu makineden erişilir; dışarıya web sunucusu (Caddy) üzerinden açılır
  sunucu.listen(PORT, '127.0.0.1', () => console.log(`Web sunucusu 127.0.0.1:${PORT} üzerinde (tanıtım sayfası ve yayın webhook'ları)`));
  return sunucu;
}

function hepsiniEsitle() {
  for (const [ad, p] of Object.entries(PLATFORMLAR)) {
    if (!p.hazir()) continue;
    esitle(ad).catch((hata) => console.error(`${p.ad} abonelikleri eşitlenemedi:`, hata.message));
  }
}

function baslat(discordClient) {
  client = discordClient;
  for (const [ad, p] of Object.entries(PLATFORMLAR)) {
    p.baslat({ bildir, takipEdilenler: () => takipEdilenler(ad) });
    console.log(`Yayın bildirimi · ${p.ad}: ${p.hazir() ? 'hazır' : `kapalı (eksik: ${p.gereken})`}`);
  }
  webhookSunucusu();
  // Açılışta ve düzenli aralıklarla iptal edilmiş ya da eksik kalmış abonelikler onarılır
  hepsiniEsitle();
  setInterval(hepsiniEsitle, ESITLEME_ARALIGI);
}

module.exports = { PLATFORMLAR, baslat, liste, ekle, cikar, esitle, bildir, bildirimMesaji, webhookSunucusu };
