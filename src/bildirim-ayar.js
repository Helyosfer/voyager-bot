// /oyun, /yayin, /haber ve /instagram komutlarının ortak parçaları.
//
// Her bildirim komutunda tek bir "ayar" alt komutu vardır: seçeneksiz yazılırsa mevcut ayarları
// gösterir, seçenek verilirse yalnızca verilenleri değiştirir. Kanal, rol ve "kaldır" seçenekleri
// ile bunların denetimi burada; komuta özel seçenekler komutun kendi dosyasında.
const { ChannelType, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { ayarKaydet, ayarlariGetir } = require('./depo');
const { yazabilirMi, etiketEngeli } = require('./yardimci');

const kanalSecenegi = (aciklama) => (o) =>
  o.setName('kanal').setDescription(aciklama).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);
const rolSecenegi = (aciklama) => (o) => o.setName('rol').setDescription(aciklama);
const kaldirSecenegi = (o) =>
  o
    .setName('kaldir')
    .setDescription('Bir ayarı kaldırır')
    .addChoices({ name: 'Rol etiketlemesini kaldır', value: 'rol' }, { name: 'Bildirimleri kapat (kanalı kaldır)', value: 'kanal' });

// Bot bu kanala bildirim kartı gönderebilir mi? Gönderemiyorsa sebebi
function kanalEngeli(kanal) {
  if (yazabilirMi(kanal, [PermissionFlagsBits.EmbedLinks])) return null;
  return `${kanal} kanalına yazamıyorum. Bana orada Kanalı Görüntüle, Mesaj Gönder ve Bağlantı Yerleştir izinlerini ver.`;
}

// Rol bildirimlerde etiketlenebilir mi? engel: seçilemez. uyari: seçilir ama etiket bildirim göndermez.
function rolDenetle(interaction, rol) {
  if (rol.id === interaction.guild.id) return { engel: '@everyone seçilemez; ayrı bir rol oluştur.' };
  const engel = etiketEngeli(interaction, rol);
  if (engel) return { engel };
  const etiketleyebilir = rol.mentionable || interaction.guild.members.me.permissions.has(PermissionFlagsBits.MentionEveryone);
  return {
    uyari: etiketleyebilir ? null : `${rol} kaydedildi ama bildirim gitmeyecek: rol ayarlarından "Bu rolden herkesin bahsetmesine izin ver" seçeneğini aç.`,
  };
}

// "ayar" alt komutunun kanal, rol ve kaldır seçenekleri. Önce hepsi denetlenir, sorun yoksa kaydedilir;
// böylece hatalı bir seçenek yüzünden ayarların yarısı değişmiş kalmaz.
// anahtarlar: { kanal, rol } depodaki ayar adları. ad: bildirimlerin adı (ör. "Haber bildirimleri").
// Dönen: { hata } ya da { satirlar } (yapılan değişiklikler; hiçbir şey verilmediyse boş)
function kanalVeRol(interaction, anahtarlar, ad) {
  const kanal = interaction.options.getChannel('kanal');
  const rol = interaction.options.getRole('rol');
  const kaldir = interaction.options.getString('kaldir');
  if (kanal && kaldir === 'kanal') return { hata: 'Aynı anda hem kanal seçip hem kanalı kaldıramazsın.' };
  if (rol && kaldir === 'rol') return { hata: 'Aynı anda hem rol seçip hem rolü kaldıramazsın.' };
  const kanalSorunu = kanal && kanalEngeli(kanal);
  if (kanalSorunu) return { hata: kanalSorunu };
  const rolDurumu = rol ? rolDenetle(interaction, rol) : {};
  if (rolDurumu.engel) return { hata: rolDurumu.engel };

  const sunucuId = interaction.guildId;
  const satirlar = [];
  if (kanal) {
    ayarKaydet(sunucuId, anahtarlar.kanal, kanal.id);
    satirlar.push(`✅ ${ad} ${kanal} kanalına gönderilecek.`);
  }
  if (kaldir === 'kanal') {
    ayarKaydet(sunucuId, anahtarlar.kanal, null);
    satirlar.push(`✅ ${ad} kapatıldı. Ayarlar ve liste duruyor; yeniden açmak için \`kanal\` seçeneğiyle bir kanal seç.`);
  }
  if (rol) {
    ayarKaydet(sunucuId, anahtarlar.rol, rol.id);
    satirlar.push(rolDurumu.uyari ? `⚠️ ${rolDurumu.uyari}` : `✅ Bildirimlerde ${rol} etiketlenecek.`);
  }
  if (kaldir === 'rol') {
    ayarKaydet(sunucuId, anahtarlar.rol, null);
    satirlar.push('✅ Bildirimlerde artık rol etiketlenmeyecek.');
  }
  return { satirlar };
}

// Bildirim kanalı hiç seçilmemişse, komutun yazıldığı kanal (bot oraya kart gönderebiliyorsa)
// kendiliğinden bildirim kanalı olur. Yapılanı anlatan satır ya da null döner.
function kanalVarsay(interaction, anahtar, komutAdi) {
  const sunucuId = interaction.guildId;
  if (ayarlariGetir(sunucuId)[anahtar]) return null;
  const kanal = interaction.channel;
  if (!kanal || kanal.isThread?.() || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(kanal.type) || kanalEngeli(kanal)) {
    return `ℹ️ Bildirimlerin gelmesi için \`/${komutAdi} ayar kanal:\` ile bir kanal seç.`;
  }
  ayarKaydet(sunucuId, anahtar, kanal.id);
  return `ℹ️ Henüz bildirim kanalı seçilmemişti; bildirimler bu kanala (${kanal}) gelecek. Değiştirmek için \`/${komutAdi} ayar kanal:\`.`;
}

// "ayar" cevabı: yapılan değişiklikler (varsa) ve mevcut ayarların kartı, yalnızca komutu kullanana görünür
const ayarCevabi = (interaction, satirlar, kart) =>
  interaction.reply({ content: satirlar.join('\n') || undefined, embeds: [kart], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

// Rol satırı: kendi rolü olan kayıtta o rol, yoksa genel rol kullanıldığı söylenir
const rolEtiketi = (kayitRolu) => (kayitRolu ? ` → <@&${kayitRolu}>` : '');

module.exports = { kanalSecenegi, rolSecenegi, kaldirSecenegi, kanalEngeli, rolDenetle, kanalVeRol, kanalVarsay, ayarCevabi, rolEtiketi };
