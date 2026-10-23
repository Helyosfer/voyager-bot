const { PermissionFlagsBits, EmbedBuilder, ButtonStyle } = require('discord.js');
const { ayarlariGetir, ayarKaydet } = require('../depo');
const { beklemeSayaci, neZaman } = require('../yardimci');
const firsatlar = require('../firsatlar');
const ortak = require('../bildirim-ayar');

// "Şimdi gönder" her basışta dört mağazaya ve oyun başına Steam'e istek atar, rolü de etiketler.
// Art arda kullanılırsa botun adresi bu servislerde sınırlanabilir; sunucu başına bu aralıkla çalışır.
const simdiSayaci = beklemeSayaci(5 * 60_000);

// Mevcut ayarlar
function kart(sunucuId) {
  const ayar = firsatlar.ayarCoz(ayarlariGetir(sunucuId));
  return new EmbedBuilder()
    .setTitle('🎮 Oyun fırsatları')
    .setColor(0x5865f2)
    .setDescription(
      [
        `**Kanal:** ${ayar.kanal ? `<#${ayar.kanal}>` : 'ayarlanmadı (bildirimler kapalı)'}`,
        `**Etiketlenecek rol:** ${ayar.rol ? `<@&${ayar.rol}>` : 'yok'}`,
        `**Bedava oyunlar:** ${ayar.bedava ? 'açık' : 'kapalı'} · **İndirimler:** ${ayar.indirim ? `açık (en az %${ayar.yuzde})` : 'kapalı'}`,
        `**Önemli fırsatlarda @everyone:** ${ayar.everyone ? 'açık' : 'kapalı'}`,
        '',
        'Steam, Epic Games ve GOG takip edilir. 🔥 Popüler ve yeni çıkmış oyunlar anında, inceleme ve puanla gelir; diğerleri 3 saatte bir toplu liste olarak gelir.',
      ].join('\n'),
    )
    .setFooter({ text: 'Her şeyi aşağıdan değiştirebilirsin · Şimdi gönder: şu an yayında olan fırsatları hemen gönderir' });
}

// @everyone açılınca: bot o kanalda atabiliyor mu?
function everyoneSatirlari(interaction, ayar) {
  const ben = interaction.guild.members.me;
  const kanal = ayar.kanal ? interaction.guild.channels.cache.get(ayar.kanal) : null;
  const atabilir = (kanal ? kanal.permissionsFor(ben) : ben.permissions)?.has(PermissionFlagsBits.MentionEveryone);
  const saat = firsatlar.EVERYONE_ARALIGI / 3_600_000;
  const satirlar = [`✅ Popüler ve yeni çıkmış oyunlardaki fırsatlarda @everyone atılacak. Kanalı boğmasın diye en fazla ${saat} saatte bir; arada gelenlerde seçtiğin rol etiketlenir.`];
  if (!atabilir) {
    satirlar.push('⚠️ Bende **@everyone, @here ve Tüm Rollerden Bahset** izni yok. Bu izni Voyager rolüne (ya da fırsat kanalında bana) vermezsen etiket atılmaz.');
  }
  return satirlar;
}

// Şu an yayında olan fırsatları hemen gönderir
async function simdi(interaction) {
  const sunucuId = interaction.guildId;
  const ayar = firsatlar.ayarCoz(ayarlariGetir(sunucuId));
  if (!ayar.kanal) return ['❌ Önce yukarıdan bir kanal seç.'];
  const kalan = simdiSayaci.bekle(sunucuId);
  if (kalan) return [`⏳ Fırsatlar az önce gönderildi. Yeniden gönderebileceğin zaman: ${neZaman(kalan)}`];
  simdiSayaci.isaretle(sunucuId);
  let sonuc;
  try {
    sonuc = await firsatlar.simdiGonder(interaction.guild);
  } catch (hata) {
    console.error('Oyun fırsatları gönderilemedi:', hata.message);
    return ['❌ Fırsatlar şu an alınamadı ya da kanala gönderilemedi. Biraz sonra yeniden dene.'];
  }
  return [
    sonuc.bedava || sonuc.indirim
      ? `✅ <#${ayar.kanal}> kanalına ${sonuc.bedava} bedava oyun ve ${sonuc.indirim} indirim gönderildi.`
      : 'Şu an ayarlarına uyan bir fırsat yok.',
  ];
}

// Kartın düğmeleri: bedava oyunlar, indirimler ve @everyone açılıp kapatılır; fırsatlar hemen gönderilir
const ANAHTARLAR = { bedava: 'oyunBedava', indirim: 'oyunIndirim', everyone: 'oyunEveryone' };
const panel = {
  komut: 'oyun',
  ad: 'Oyun fırsatları',
  simge: '🎮',
  aciklama: 'Bedava oyun ve indirim bildirimleri (Steam, Epic, GOG)',
  anahtarlar: { kanal: 'oyunKanali', rol: 'oyunRol' },
  kanalNotu: 'ℹ️ Yalnızca bundan sonra çıkan fırsatlar bildirilir; şu an yayında olanlar için **Şimdi gönder** düğmesine bas.',
  kart,
  dugmeler(sunucuId) {
    const ayar = firsatlar.ayarCoz(ayarlariGetir(sunucuId));
    return [
      ortak.acKapat(panel, 'bedava', '🎁 Bedava oyunlar', ayar.bedava),
      ortak.acKapat(panel, 'indirim', '🏷️ İndirimler', ayar.indirim),
      ortak.acKapat(panel, 'everyone', '📢 @everyone', ayar.everyone),
    ];
  },
  altDugmeler: (sunucuId) => (ayarlariGetir(sunucuId).oyunKanali ? [ortak.dugme(panel, 'simdi', 'Şimdi gönder', ButtonStyle.Primary)] : []),
  async islem(interaction, islem) {
    if (islem === 'simdi') return simdi(interaction);
    if (!ANAHTARLAR[islem]) return [];
    const sunucuId = interaction.guildId;
    const acik = !firsatlar.ayarCoz(ayarlariGetir(sunucuId))[islem];
    ayarKaydet(sunucuId, ANAHTARLAR[islem], acik);
    const ayar = firsatlar.ayarCoz(ayarlariGetir(sunucuId));
    if (islem === 'everyone') return acik ? everyoneSatirlari(interaction, ayar) : ['✅ Önemli fırsatlarda artık @everyone atılmayacak.'];
    const ad = islem === 'bedava' ? 'Bedava oyun' : 'İndirim';
    return [`✅ ${ad} bildirimleri ${acik ? 'açıldı' : 'kapatıldı'}.`];
  },
};

module.exports = { ...ortak.bolum(panel), panel };
