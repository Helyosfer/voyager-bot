const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  InteractionContextType,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const { ayarlariGetir, ayarKaydet } = require('../depo');
const { yazabilirMi, etiketEngeli, beklemeSayaci, neZaman } = require('../yardimci');
const firsatlar = require('../firsatlar');

// /oyun simdi her çalıştırılışında dört mağazaya ve her oyun için Steam'e istek atar, rolü de etiketler.
// Art arda çalıştırılırsa bu servisler botu sınırlayabilir; bu yüzden her sunucuda en sık bu aralıkla çalışır.
const simdiSayaci = beklemeSayaci(5 * 60_000);

const DURUMLAR = [
  { name: 'Açık', value: 'acik' },
  { name: 'Kapalı', value: 'kapali' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('oyun')
    .setDescription('Bedava oyun ve indirim bildirimlerini ayarlar (Steam, Epic, GOG)')
    .addSubcommand((s) =>
      s
        .setName('kanal')
        .setDescription('Fırsatların gönderileceği kanalı seçer ve bildirimleri başlatır')
        .addChannelOption((o) =>
          o
            .setName('kanal')
            .setDescription('Fırsat kanalı')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('bedava')
        .setDescription('Bedava oyun bildirimlerini açar/kapatır ve mağazayı seçer')
        .addStringOption((o) => o.setName('durum').setDescription('Açık mı kapalı mı?').setRequired(true).addChoices(...DURUMLAR))
        .addStringOption((o) =>
          o
            .setName('magaza')
            .setDescription('Hangi mağazalardaki bedava oyunlar?')
            .addChoices(...Object.entries(firsatlar.MAGAZALAR).map(([value, m]) => ({ name: m.ad, value }))),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('indirim')
        .setDescription('İndirim bildirimlerini açar/kapatır; mağazayı ve en az indirim oranını belirler')
        .addStringOption((o) => o.setName('durum').setDescription('Açık mı kapalı mı?').setRequired(true).addChoices(...DURUMLAR))
        .addStringOption((o) =>
          o
            .setName('magaza')
            .setDescription('Hangi mağazalardaki indirimler?')
            .addChoices(...Object.entries(firsatlar.INDIRIM_SECENEKLERI).map(([value, m]) => ({ name: m.ad, value }))),
        )
        .addIntegerOption((o) =>
          o.setName('en-az-yuzde').setDescription('Bu orandan düşük indirimler gönderilmez (1-99)').setMinValue(1).setMaxValue(99),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('rol')
        .setDescription('Fırsat geldiğinde etiketlenecek rolü seçer (boş bırakırsan etiketleme kalkar)')
        .addRoleOption((o) => o.setName('rol').setDescription('Etiketlenecek rol')),
    )
    .addSubcommand((s) =>
      s
        .setName('everyone')
        .setDescription('Popüler oyunlardaki önemli fırsatlarda @everyone etiketlensin mi?')
        .addStringOption((o) => o.setName('durum').setDescription('Açık mı kapalı mı?').setRequired(true).addChoices(...DURUMLAR)),
    )
    .addSubcommand((s) => s.setName('goster').setDescription('Fırsat bildirimi ayarlarını gösterir'))
    .addSubcommand((s) => s.setName('simdi').setDescription('Ayarlara uyan güncel fırsatları hemen kanala gönderir'))
    .addSubcommand((s) => s.setName('kapat').setDescription('Fırsat bildirimlerini tamamen kapatır'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const alt = interaction.options.getSubcommand();
    const sunucuId = interaction.guildId;
    const cevapla = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

    if (alt === 'kanal') {
      const kanal = interaction.options.getChannel('kanal', true);
      if (!yazabilirMi(kanal, [PermissionFlagsBits.EmbedLinks])) {
        return cevapla(`❌ ${kanal} kanalına yazamıyorum. Bana orada Kanalı Görüntüle, Mesaj Gönder ve Bağlantı Yerleştir izinlerini ver.`);
      }
      ayarKaydet(sunucuId, 'oyunKanali', kanal.id);
      return cevapla(
        [
          `✅ Fırsatlar ${kanal} kanalına gönderilecek.`,
          '• Popüler ve yeni çıkmış oyunlardaki fırsatlar **bulunduğu anda**, kısa bir inceleme ve puanla gelir.',
          '• Diğer fırsatlar birikir ve **3 saatte bir** tek liste halinde gelir.',
          'Yalnızca bundan sonra çıkanlar bildirilir; şu an yayında olanlar için `/oyun simdi` kullan.',
        ].join('\n'),
      );
    }

    if (alt === 'bedava') {
      const acik = interaction.options.getString('durum', true) === 'acik';
      const magaza = interaction.options.getString('magaza');
      ayarKaydet(sunucuId, 'oyunBedava', acik);
      if (magaza) ayarKaydet(sunucuId, 'oyunMagaza', magaza);
      const ayar = firsatlar.ayarCoz(ayarlariGetir(sunucuId));
      return cevapla(
        acik
          ? `✅ Bedava oyun bildirimleri açık. Mağaza: ${firsatlar.MAGAZALAR[ayar.magaza].ad}.`
          : '✅ Bedava oyun bildirimleri kapatıldı.',
      );
    }

    if (alt === 'indirim') {
      const acik = interaction.options.getString('durum', true) === 'acik';
      const magaza = interaction.options.getString('magaza');
      const yuzde = interaction.options.getInteger('en-az-yuzde');
      ayarKaydet(sunucuId, 'oyunIndirim', acik);
      if (magaza) ayarKaydet(sunucuId, 'oyunIndirimMagaza', magaza);
      if (yuzde) ayarKaydet(sunucuId, 'oyunMinYuzde', yuzde);
      const ayar = firsatlar.ayarCoz(ayarlariGetir(sunucuId));
      return cevapla(
        acik
          ? `✅ İndirim bildirimleri açık. Mağaza: ${firsatlar.INDIRIM_SECENEKLERI[ayar.indirimMagaza].ad}. En az indirim: %${ayar.yuzde}.`
          : '✅ İndirim bildirimleri kapatıldı.',
      );
    }

    if (alt === 'rol') {
      const rol = interaction.options.getRole('rol');
      if (!rol) {
        ayarKaydet(sunucuId, 'oyunRol', null);
        return cevapla('✅ Fırsat bildirimlerinde artık rol etiketlenmeyecek.');
      }
      if (rol.id === interaction.guild.id) return cevapla('❌ @everyone seçilemez; ayrı bir rol oluştur.');
      const etiketlenemez = etiketEngeli(interaction, rol);
      if (etiketlenemez) return cevapla(`❌ ${etiketlenemez}`);
      ayarKaydet(sunucuId, 'oyunRol', rol.id);
      const etiketleyebilir =
        rol.mentionable || interaction.guild.members.me.permissions.has(PermissionFlagsBits.MentionEveryone);
      return cevapla(
        etiketleyebilir
          ? `✅ Fırsat geldiğinde ${rol} etiketlenecek.`
          : `⚠️ ${rol} kaydedildi ama bildirim gitmeyecek: rol ayarlarından "Bu rolden herkesin bahsetmesine izin ver" seçeneğini aç.`,
      );
    }

    if (alt === 'everyone') {
      const acik = interaction.options.getString('durum', true) === 'acik';
      ayarKaydet(sunucuId, 'oyunEveryone', acik);
      if (!acik) return cevapla('✅ Önemli fırsatlarda artık @everyone atılmayacak.');
      // Fırsat kanalı seçiliyse izin o kanalda, değilse sunucu genelinde denetlenir
      const ben = interaction.guild.members.me;
      const kanalId = firsatlar.ayarCoz(ayarlariGetir(sunucuId)).kanal;
      const kanal = kanalId ? interaction.guild.channels.cache.get(kanalId) : null;
      const atabilir = (kanal ? kanal.permissionsFor(ben) : ben.permissions)?.has(PermissionFlagsBits.MentionEveryone);
      const saat = firsatlar.EVERYONE_ARALIGI / 3_600_000;
      return cevapla(
        [
          `✅ Popüler ve yeni çıkmış oyunlardaki fırsatlarda @everyone atılacak. Kanalı boğmasın diye en fazla ${saat} saatte bir; arada gelenlerde seçtiğin rol etiketlenir.`,
          atabilir ? null : '⚠️ Bende **@everyone, @here ve Tüm Rollerden Bahset** izni yok. Bu izni Voyager rolüne (ya da fırsat kanalında bana) vermezsen etiket atılmaz.',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }

    if (alt === 'kapat') {
      ayarKaydet(sunucuId, 'oyunKanali', null);
      return cevapla('✅ Fırsat bildirimleri kapatıldı. Yeniden açmak için `/oyun kanal` kullan.');
    }

    const ayar = firsatlar.ayarCoz(ayarlariGetir(sunucuId));

    if (alt === 'simdi') {
      if (!ayar.kanal) return cevapla('❌ Önce `/oyun kanal` ile bir kanal seç.');
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
    }

    // goster alt komutu
    const durum = (acik, ayrinti) => (acik ? `🟢 Açık\n${ayrinti}` : '⚫ Kapalı');
    const embed = new EmbedBuilder()
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
      .setFooter({ text: 'Mevcut fırsatları görmek için /oyun simdi' });
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
