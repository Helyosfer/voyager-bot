const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  InteractionContextType,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const { ayarlariGetir, ayarKaydet } = require('../depo');
const { yazabilirMi, etiketEngeli, duzAd } = require('../yardimci');
const haber = require('../haber');

const eklenen = new Set(); // Şu an kaynak eklemekte olan sunucular

module.exports = {
  data: new SlashCommandBuilder()
    .setName('haber')
    .setDescription('Haber sitelerinin yeni haberlerini bir kanala duyurur (RSS)')
    .addSubcommand((s) =>
      s
        .setName('kanal')
        .setDescription('Haberlerin gönderileceği kanalı seçer')
        .addChannelOption((o) =>
          o
            .setName('kanal')
            .setDescription('Haber kanalı')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('ekle')
        .setDescription('Takip edilecek bir haber kaynağı ekler')
        .addStringOption((o) =>
          o.setName('adres').setDescription('Sitenin adresi ya da RSS adresi (ör. webtekno.com)').setRequired(true).setMaxLength(300),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('cikar')
        .setDescription('Bir haber kaynağını takipten çıkarır')
        .addStringOption((o) =>
          o.setName('kaynak').setDescription('Listedeki sıra numarası ya da kaynağın adı').setRequired(true).setMaxLength(300),
        ),
    )
    .addSubcommand((s) => s.setName('liste').setDescription('Takip edilen haber kaynaklarını ve ayarları gösterir'))
    .addSubcommand((s) =>
      s
        .setName('rol')
        .setDescription('Yeni haberde etiketlenecek rolü seçer (boş bırakırsan etiketleme kalkar)')
        .addRoleOption((o) => o.setName('rol').setDescription('Etiketlenecek rol')),
    )
    .addSubcommand((s) => s.setName('kapat').setDescription('Haber bildirimlerini kapatır (liste silinmez)'))
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
      ayarKaydet(sunucuId, 'haberKanali', kanal.id);
      return cevapla(`✅ Haberler ${kanal} kanalına gönderilecek. Kaynak eklemek için \`/haber ekle\` kullan.`);
    }

    if (alt === 'ekle') {
      // Her ekleme birkaç sayfa indirir; aynı sunucudan üst üste gelen istekler sıraya alınmaz, reddedilir
      if (eklenen.has(sunucuId)) return cevapla('⏳ Bu sunucuda şu an başka bir kaynak ekleniyor. Bitmesini bekle.');
      eklenen.add(sunucuId);
      let sonuc;
      try {
        // Siteye bağlanıldığı için 3 saniyeyi aşabilir. Yanıtı ertelemek de başarısız olabilir (etkileşim zaman
        // aşımına uğradıysa); o durumda da sunucu, bot yeniden başlayana kadar kilitli kalmamalı.
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        sonuc = await haber.ekle(sunucuId, interaction.options.getString('adres', true)).catch((hata) => {
          console.error('/haber ekle hatası:', hata.message);
          return null;
        });
      } finally {
        eklenen.delete(sunucuId);
      }
      if (!sonuc) return interaction.editReply('❌ Kaynak eklenirken bir hata oluştu.');
      if (sonuc.hata) return interaction.editReply(`❌ ${sonuc.hata}`);
      const kanalNotu = ayarlariGetir(sunucuId).haberKanali ? '' : ' Haberlerin gelmesi için `/haber kanal` ile bir kanal seç.';
      return interaction.editReply(
        `✅ **${duzAd(sonuc.besleme.ad)}** takibe alındı. Bundan sonra yayınlanan haberler duyurulacak.${kanalNotu}`,
      );
    }

    if (alt === 'cikar') {
      const silinen = haber.cikar(sunucuId, interaction.options.getString('kaynak', true));
      if (!silinen) return cevapla('❌ Listede böyle bir kaynak yok. `/haber liste` ile sıra numarasına bak.');
      return cevapla(`✅ **${duzAd(silinen.ad)}** takipten çıkarıldı.`);
    }

    if (alt === 'rol') {
      const rol = interaction.options.getRole('rol');
      if (!rol) {
        ayarKaydet(sunucuId, 'haberRol', null);
        return cevapla('✅ Haber bildirimlerinde artık rol etiketlenmeyecek.');
      }
      if (rol.id === interaction.guild.id) return cevapla('❌ @everyone seçilemez; ayrı bir rol oluştur.');
      const etiketlenemez = etiketEngeli(interaction, rol);
      if (etiketlenemez) return cevapla(`❌ ${etiketlenemez}`);
      ayarKaydet(sunucuId, 'haberRol', rol.id);
      const etiketleyebilir =
        rol.mentionable || interaction.guild.members.me.permissions.has(PermissionFlagsBits.MentionEveryone);
      return cevapla(
        etiketleyebilir
          ? `✅ Yeni haberde ${rol} etiketlenecek.`
          : `⚠️ ${rol} kaydedildi ama bildirim gitmeyecek: rol ayarlarından "Bu rolden herkesin bahsetmesine izin ver" seçeneğini aç.`,
      );
    }

    if (alt === 'kapat') {
      ayarKaydet(sunucuId, 'haberKanali', null);
      return cevapla('✅ Haber bildirimleri kapatıldı. Liste duruyor; yeniden açmak için `/haber kanal` kullan.');
    }

    // liste alt komutu
    const ayar = ayarlariGetir(sunucuId);
    const kaynaklar = haber.liste(sunucuId);
    const embed = new EmbedBuilder()
      .setTitle('📰 Haber bildirimleri')
      .setColor(0x3b82f6)
      .setDescription(
        [
          `**Kanal:** ${ayar.haberKanali ? `<#${ayar.haberKanali}>` : 'ayarlanmadı (bildirimler kapalı)'}`,
          `**Etiketlenecek rol:** ${ayar.haberRol ? `<@&${ayar.haberRol}>` : 'yok'}`,
        ].join('\n'),
      )
      .addFields({
        name: `Kaynaklar · ${kaynaklar.length}/${haber.SUNUCU_BASI_SINIR}`,
        value:
          kaynaklar
            .map((k, i) => `**${i + 1}.** [${duzAd(k.ad.slice(0, 40))}](${new URL(k.adres).origin})`)
            .join('\n')
            .slice(0, 1000) || 'Henüz kaynak eklenmemiş',
      })
      .setFooter({ text: `Kaynaklar ${haber.KONTROL_ARALIGI / 60_000} dakikada bir kontrol edilir` });
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
