const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, EmbedBuilder, MessageFlags } = require('discord.js');
const { ayarlariGetir, ayarKaydet } = require('../depo');
const { beklemeSayaci, neZaman } = require('../yardimci');
const firsatlar = require('../firsatlar');
const ortak = require('../bildirim-ayar');

// /oyun simdi her çalıştırılışında dört mağazaya ve her oyun için Steam'e istek atar, rolü de etiketler.
// Art arda çalıştırılırsa bu servisler botu sınırlayabilir; bu yüzden her sunucuda en sık bu aralıkla çalışır.
const simdiSayaci = beklemeSayaci(5 * 60_000);

const ANAHTARLAR = { kanal: 'oyunKanali', rol: 'oyunRol' };
const DURUMLAR = [
  { name: 'Açık', value: 'acik' },
  { name: 'Kapalı', value: 'kapali' },
];
const durumSecenegi = (ad, aciklama) => (o) => o.setName(ad).setDescription(aciklama).addChoices(...DURUMLAR);

// Mevcut ayarlar
function kart(sunucuId) {
  const ayar = firsatlar.ayarCoz(ayarlariGetir(sunucuId));
  const durum = (acik, ayrinti) => (acik ? `🟢 Açık\n${ayrinti}` : '⚫ Kapalı');
  return new EmbedBuilder()
    .setTitle('🎮 Oyun fırsatları')
    .setColor(0x5865f2)
    .setDescription(
      [
        `**Kanal:** ${ayar.kanal ? `<#${ayar.kanal}>` : 'ayarlanmadı (bildirimler kapalı)'}`,
        `**Etiketlenecek rol:** ${ayar.rol ? `<@&${ayar.rol}>` : 'yok'}`,
        `**Önemli fırsatlarda @everyone:** ${ayar.everyone ? 'açık' : 'kapalı'}`,
        '',
        '🔥 Popüler ve yeni çıkmış oyunlar anında, inceleme ve puanla gelir. Diğerleri 3 saatte bir toplu liste olarak gelir.',
      ].join('\n'),
    )
    .addFields(
      { name: '🎁 Bedava oyunlar', value: durum(ayar.bedava, firsatlar.MAGAZALAR[ayar.magaza].ad), inline: true },
      {
        name: '🏷️ İndirimler',
        value: durum(ayar.indirim, `${firsatlar.INDIRIM_SECENEKLERI[ayar.indirimMagaza].ad}\nEn az %${ayar.yuzde}`),
        inline: true,
      },
    )
    .setFooter({ text: 'Değiştirmek için: /oyun ayar · Mevcut fırsatlar için: /oyun simdi' });
}

// Kanal ve rol dışındaki ayarlar. Değişiklik satırlarını döndürür.
function firsatAyarlari(interaction) {
  const sunucuId = interaction.guildId;
  const secim = (ad) => interaction.options.getString(ad);
  const satirlar = [];
  const bedava = secim('bedava');
  const bedavaMagaza = secim('bedava-magaza');
  const indirim = secim('indirim');
  const indirimMagaza = secim('indirim-magaza');
  const yuzde = interaction.options.getInteger('en-az-yuzde');
  const everyone = secim('everyone');

  if (bedava) ayarKaydet(sunucuId, 'oyunBedava', bedava === 'acik');
  if (bedavaMagaza) ayarKaydet(sunucuId, 'oyunMagaza', bedavaMagaza);
  if (indirim) ayarKaydet(sunucuId, 'oyunIndirim', indirim === 'acik');
  if (indirimMagaza) ayarKaydet(sunucuId, 'oyunIndirimMagaza', indirimMagaza);
  if (yuzde) ayarKaydet(sunucuId, 'oyunMinYuzde', yuzde);
  if (everyone) ayarKaydet(sunucuId, 'oyunEveryone', everyone === 'acik');

  const ayar = firsatlar.ayarCoz(ayarlariGetir(sunucuId));
  if (bedava || bedavaMagaza) {
    satirlar.push(ayar.bedava ? `✅ Bedava oyun bildirimleri açık. Mağaza: ${firsatlar.MAGAZALAR[ayar.magaza].ad}.` : '✅ Bedava oyun bildirimleri kapalı.');
  }
  if (indirim || indirimMagaza || yuzde) {
    satirlar.push(
      ayar.indirim
        ? `✅ İndirim bildirimleri açık. Mağaza: ${firsatlar.INDIRIM_SECENEKLERI[ayar.indirimMagaza].ad}. En az indirim: %${ayar.yuzde}.`
        : '✅ İndirim bildirimleri kapalı.',
    );
  }
  if (everyone === 'kapali') satirlar.push('✅ Önemli fırsatlarda artık @everyone atılmayacak.');
  if (everyone === 'acik') {
    // Fırsat kanalı seçiliyse izin o kanalda, değilse sunucu genelinde denetlenir
    const ben = interaction.guild.members.me;
    const kanal = ayar.kanal ? interaction.guild.channels.cache.get(ayar.kanal) : null;
    const atabilir = (kanal ? kanal.permissionsFor(ben) : ben.permissions)?.has(PermissionFlagsBits.MentionEveryone);
    const saat = firsatlar.EVERYONE_ARALIGI / 3_600_000;
    satirlar.push(
      `✅ Popüler ve yeni çıkmış oyunlardaki fırsatlarda @everyone atılacak. Kanalı boğmasın diye en fazla ${saat} saatte bir; arada gelenlerde seçtiğin rol etiketlenir.`,
    );
    if (!atabilir) {
      satirlar.push('⚠️ Bende **@everyone, @here ve Tüm Rollerden Bahset** izni yok. Bu izni Voyager rolüne (ya da fırsat kanalında bana) vermezsen etiket atılmaz.');
    }
  }
  return satirlar;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('oyun')
    .setDescription('Bedava oyun ve indirim bildirimlerini ayarlar (Steam, Epic, GOG)')
    .addSubcommand((s) =>
      s
        .setName('ayar')
        .setDescription('Ayarları gösterir; seçenek verirsen yalnızca onları değiştirir (gerisi varsayılan kalır)')
        .addChannelOption(ortak.kanalSecenegi('Fırsatların gönderileceği kanal (seçince bildirimler başlar)'))
        .addRoleOption(ortak.rolSecenegi('Fırsat geldiğinde etiketlenecek rol'))
        .addStringOption(durumSecenegi('bedava', 'Bedava oyun bildirimleri (varsayılan: açık)'))
        .addStringOption((o) =>
          o
            .setName('bedava-magaza')
            .setDescription('Hangi mağazalardaki bedava oyunlar? (varsayılan: Steam, Epic ve GOG)')
            .addChoices(...Object.entries(firsatlar.MAGAZALAR).map(([value, m]) => ({ name: m.ad, value }))),
        )
        .addStringOption(durumSecenegi('indirim', 'İndirim bildirimleri (varsayılan: açık)'))
        .addStringOption((o) =>
          o
            .setName('indirim-magaza')
            .setDescription('Hangi mağazalardaki indirimler? (varsayılan: Steam, Epic ve GOG)')
            .addChoices(...Object.entries(firsatlar.INDIRIM_SECENEKLERI).map(([value, m]) => ({ name: m.ad, value }))),
        )
        .addIntegerOption((o) =>
          o.setName('en-az-yuzde').setDescription('Bu orandan düşük indirimler gönderilmez (1-99)').setMinValue(1).setMaxValue(99),
        )
        .addStringOption(durumSecenegi('everyone', 'Popüler oyunlardaki önemli fırsatlarda @everyone (varsayılan: kapalı)'))
        .addStringOption(ortak.kaldirSecenegi),
    )
    .addSubcommand((s) => s.setName('simdi').setDescription('Ayarlara uyan güncel fırsatları hemen kanala gönderir'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const sunucuId = interaction.guildId;
    const cevapla = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

    if (interaction.options.getSubcommand() === 'ayar') {
      const oncekiKanal = ayarlariGetir(sunucuId).oyunKanali;
      const { hata, satirlar } = ortak.kanalVeRol(interaction, ANAHTARLAR, 'Oyun fırsatları');
      if (hata) return cevapla(`❌ ${hata}`);
      satirlar.push(...firsatAyarlari(interaction));
      // Kanal ilk kez seçildiyse nasıl çalıştığı anlatılır
      if (!oncekiKanal && interaction.options.getChannel('kanal')) {
        satirlar.push('ℹ️ Yalnızca bundan sonra çıkan fırsatlar bildirilir; şu an yayında olanlar için `/oyun simdi` kullan.');
      }
      return ortak.ayarCevabi(interaction, satirlar, kart(sunucuId));
    }

    // simdi
    const ayar = firsatlar.ayarCoz(ayarlariGetir(sunucuId));
    if (!ayar.kanal) return cevapla('❌ Önce `/oyun ayar kanal:` ile bir kanal seç.');
    const kalan = simdiSayaci.bekle(sunucuId);
    if (kalan) return cevapla(`⏳ Fırsatlar az önce gönderildi. Yeniden gönderebileceğin zaman: ${neZaman(kalan)}`);
    simdiSayaci.isaretle(sunucuId);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const sonuc = await firsatlar.simdiGonder(interaction.guild);
    return interaction.editReply(
      sonuc.bedava || sonuc.indirim
        ? `✅ <#${ayar.kanal}> kanalına ${sonuc.bedava} bedava oyun ve ${sonuc.indirim} indirim gönderildi.`
        : 'Şu an ayarlarına uyan bir fırsat yok.',
    );
  },
};
