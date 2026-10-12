const { PermissionFlagsBits, DiscordAPIError } = require('discord.js');
const { oku, yaz } = require('./depo');

// Bir kişinin aynı anda bekleyen en fazla hatırlatıcı sayısı
const KISI_BASI_SINIR = 5;

// Gönderim geçici bir hatayla (ağ kopması, Discord arızası) başarısız olursa
// bu aralıkla, en fazla bu kadar kez denenir.
const TEKRAR_BEKLEME = 60_000;
const EN_FAZLA_DENEME = 5;

// Hatırlatıcıyı kuran kişi hâlâ bu kanala yazabiliyor mu? Sunucudan ayrılmış,
// yasaklanmış veya susturulmuşsa mesajı bot üzerinden göndermesine izin verme.
async function halaYazabilir(kanal, kullaniciId) {
  if (!kanal.guild) return false;
  const uye = await kanal.guild.members.fetch(kullaniciId);
  if (uye.isCommunicationDisabled()) return false;
  const izin = kanal.isThread() ? PermissionFlagsBits.SendMessagesInThreads : PermissionFlagsBits.SendMessages;
  return kanal.permissionsFor(uye)?.has(izin) ?? false;
}

async function gonder(client, kayit) {
  const kanal = await client.channels.fetch(kayit.kanalId);
  if (!kanal?.isTextBased() || !(await halaYazabilir(kanal, kayit.kullaniciId))) return;
  await kanal.send({
    content: `⏰ <@${kayit.kullaniciId}> hatırlatma: ${kayit.mesaj}`,
    // Mesajın içine @everyone yazılsa bile sadece ilgili kişi etiketlenir
    allowedMentions: { users: [kayit.kullaniciId] },
  });
}

function kur(client, kayit, deneme = 1) {
  const kalan = deneme === 1 ? Math.max(kayit.zaman - Date.now(), 0) : TEKRAR_BEKLEME;
  setTimeout(async () => {
    try {
      await gonder(client, kayit);
    } catch (hata) {
      // Discord'un reddettiği istekler (kanal silinmiş, üye ayrılmış, yetki yok)
      // tekrar denenince düzelmez; diğerleri geçici olabilir.
      const kalici = hata instanceof DiscordAPIError && hata.status < 500;
      if (!kalici && deneme < EN_FAZLA_DENEME) return kur(client, kayit, deneme + 1);
      console.error(`Hatırlatma gönderilemedi (${kayit.id}):`, hata.message);
    }
    yaz('hatirlaticilar', oku('hatirlaticilar', []).filter((h) => h.id !== kayit.id));
  }, kalan);
}

// Kişi sınırı dolduysa eklemez ve false döndürür.
function ekle(client, kayit) {
  const hepsi = oku('hatirlaticilar', []);
  if (hepsi.filter((h) => h.kullaniciId === kayit.kullaniciId).length >= KISI_BASI_SINIR) return false;
  yaz('hatirlaticilar', [...hepsi, kayit]);
  kur(client, kayit);
  return true;
}

// Bot açıldığında, kapalıyken bekleyen hatırlatıcıları yeniden kurar.
function hepsiniYukle(client) {
  for (const kayit of oku('hatirlaticilar', [])) kur(client, kayit);
}

module.exports = { ekle, hepsiniYukle, KISI_BASI_SINIR };
