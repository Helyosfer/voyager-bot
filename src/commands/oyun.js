const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  InteractionContextType,
  ChannelType,
  MessageFlags,
} = require('discord.js');
const { ayarlariGetir, ayarKaydet } = require('../depo');
const { yazabilirMi } = require('../yardimci');
const firsatlar = require('../firsatlar');

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
        `✅ Fırsatlar ${kanal} kanalına gönderilecek. Yalnızca bundan sonra çıkanlar bildirilir; şu an yayında olanlar için \`/oyun simdi\` kullan.`,
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
      ayarKaydet(sunucuId, 'oyunRol', rol.id);
      const etiketleyebilir =
        rol.mentionable || interaction.guild.members.me.permissions.has(PermissionFlagsBits.MentionEveryone);
      return cevapla(
        etiketleyebilir
          ? `✅ Fırsat geldiğinde ${rol} etiketlenecek.`
          : `⚠️ ${rol} kaydedildi ama bildirim gitmeyecek: rol ayarlarından "Bu rolden herkesin bahsetmesine izin ver" seçeneğini aç.`,
      );
    }

    if (alt === 'kapat') {
      ayarKaydet(sunucuId, 'oyunKanali', null);
      return cevapla('✅ Fırsat bildirimleri kapatıldı. Yeniden açmak için `/oyun kanal` kullan.');
    }

    const ayar = firsatlar.ayarCoz(ayarlariGetir(sunucuId));

    if (alt === 'simdi') {
      if (!ayar.kanal) return cevapla('❌ Önce `/oyun kanal` ile bir kanal seç.');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const sonuc = await firsatlar.simdiGonder(interaction.guild);
      return interaction.editReply(
        sonuc.bedava || sonuc.indirim
          ? `✅ <#${ayar.kanal}> kanalına ${sonuc.bedava} bedava oyun ve ${sonuc.indirim} indirim gönderildi.`
          : 'Şu an ayarlarına uyan bir fırsat yok.',
      );
    }

    // goster
    return cevapla(
      [
        `**Kanal:** ${ayar.kanal ? `<#${ayar.kanal}>` : 'ayarlanmadı (bildirimler kapalı)'}`,
        `**Bedava oyunlar:** ${ayar.bedava ? `açık · ${firsatlar.MAGAZALAR[ayar.magaza].ad}` : 'kapalı'}`,
        `**İndirimler:** ${ayar.indirim ? `açık · ${firsatlar.INDIRIM_SECENEKLERI[ayar.indirimMagaza].ad} · en az %${ayar.yuzde}` : 'kapalı'}`,
        `**Etiketlenecek rol:** ${ayar.rol ? `<@&${ayar.rol}>` : 'yok'}`,
      ].join('\n'),
    );
  },
};
