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
const instagram = require('../instagram');

const hesapSecenegi = (o) =>
  o.setName('hesap').setDescription('Kullanıcı adı ya da profil adresi').setRequired(true).setMaxLength(200);

module.exports = {
  // Instagram bağlantısı kurulmamışsa komut Discord'a hiç yüklenmez
  etkin: () => instagram.hazir(),

  data: new SlashCommandBuilder()
    .setName('instagram')
    .setDescription('Instagram hesaplarının yeni gönderilerini bir kanala duyurur')
    .addSubcommand((s) =>
      s
        .setName('kanal')
        .setDescription('Gönderi bildirimlerinin gönderileceği kanalı seçer')
        .addChannelOption((o) =>
          o
            .setName('kanal')
            .setDescription('Bildirim kanalı')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) => s.setName('ekle').setDescription('Takip edilecek bir Instagram hesabı ekler').addStringOption(hesapSecenegi))
    .addSubcommand((s) => s.setName('cikar').setDescription('Bir hesabı takipten çıkarır').addStringOption(hesapSecenegi))
    .addSubcommand((s) => s.setName('liste').setDescription('Takip edilen hesapları ve ayarları gösterir'))
    .addSubcommand((s) =>
      s
        .setName('rol')
        .setDescription('Yeni gönderide etiketlenecek rolü seçer (boş bırakırsan etiketleme kalkar)')
        .addRoleOption((o) => o.setName('rol').setDescription('Etiketlenecek rol')),
    )
    .addSubcommand((s) => s.setName('test').setDescription('Bildirim kanalına örnek bir bildirim gönderir'))
    .addSubcommand((s) => s.setName('kapat').setDescription('Instagram bildirimlerini kapatır (liste silinmez)'))
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
      ayarKaydet(sunucuId, 'instagramKanali', kanal.id);
      return cevapla(`✅ Instagram gönderileri ${kanal} kanalına gönderilecek. Hesap eklemek için \`/instagram ekle\` kullan.`);
    }

    if (alt === 'ekle') {
      const girdi = interaction.options.getString('hesap', true);
      // Instagram'a sorulduğu için 3 saniyeyi aşabilir
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      let sonuc;
      try {
        sonuc = await instagram.ekle(sunucuId, girdi);
      } catch (hata) {
        console.error('/instagram ekle hatası:', hata.message);
        return interaction.editReply("❌ Eklenemedi: Instagram'a ulaşılamadı ya da botun Instagram bağlantısında sorun var. Biraz sonra yeniden dene; sürerse botun sahibine haber ver.");
      }
      if (sonuc.hata) return interaction.editReply(`❌ ${sonuc.hata}`);
      const kanalNotu = ayarlariGetir(sunucuId).instagramKanali ? '' : ' Bildirimlerin gelmesi için `/instagram kanal` ile bir kanal seç.';
      return interaction.editReply(
        `✅ **${duzAd(sonuc.hesap.ad)}** (@${sonuc.hesap.giris}) takibe alındı. Bundan sonraki gönderileri duyurulacak.${kanalNotu}`,
      );
    }

    if (alt === 'cikar') {
      const silinen = instagram.cikar(sunucuId, interaction.options.getString('hesap', true));
      if (!silinen) return cevapla('❌ Listede böyle bir hesap yok. `/instagram liste` ile kontrol et.');
      return cevapla(`✅ **${duzAd(silinen.ad)}** (@${silinen.giris}) takipten çıkarıldı.`);
    }

    if (alt === 'rol') {
      const rol = interaction.options.getRole('rol');
      if (!rol) {
        ayarKaydet(sunucuId, 'instagramRol', null);
        return cevapla('✅ Instagram bildirimlerinde artık rol etiketlenmeyecek.');
      }
      if (rol.id === interaction.guild.id) return cevapla('❌ @everyone seçilemez; ayrı bir rol oluştur.');
      const etiketlenemez = etiketEngeli(interaction, rol);
      if (etiketlenemez) return cevapla(`❌ ${etiketlenemez}`);
      ayarKaydet(sunucuId, 'instagramRol', rol.id);
      const etiketleyebilir =
        rol.mentionable || interaction.guild.members.me.permissions.has(PermissionFlagsBits.MentionEveryone);
      return cevapla(
        etiketleyebilir
          ? `✅ Yeni gönderide ${rol} etiketlenecek.`
          : `⚠️ ${rol} kaydedildi ama bildirim gitmeyecek: rol ayarlarından "Bu rolden herkesin bahsetmesine izin ver" seçeneğini aç.`,
      );
    }

    if (alt === 'kapat') {
      ayarKaydet(sunucuId, 'instagramKanali', null);
      return cevapla('✅ Instagram bildirimleri kapatıldı. Liste duruyor; yeniden açmak için `/instagram kanal` kullan.');
    }

    const ayar = ayarlariGetir(sunucuId);

    if (alt === 'test') {
      if (!ayar.instagramKanali) return cevapla('❌ Önce `/instagram kanal` ile bir kanal seç.');
      const kanal = await interaction.guild.channels.fetch(ayar.instagramKanali).catch(() => null);
      if (!kanal?.isTextBased()) return cevapla('❌ Bildirim kanalı bulunamadı; `/instagram kanal` ile yeniden seç.');
      await kanal.send(
        instagram.bildirimMesaji(
          { giris: 'ornekhesap', ad: 'Örnek Hesap' },
          { metin: 'Bu bir deneme bildirimidir. Gerçek bildirimlerde gönderinin açıklaması ve görseli burada görünür.', url: 'https://www.instagram.com/', zaman: Date.now() },
        ),
      );
      return cevapla(`✅ ${kanal} kanalına deneme bildirimi gönderildi.`);
    }

    // liste
    const hesaplar = instagram.liste(sunucuId);
    const dakika = Math.round(instagram.kontrolAraligi() / 60_000);
    const embed = new EmbedBuilder()
      .setTitle('📸 Instagram bildirimleri')
      .setColor(0xe1306c)
      .setDescription(
        [
          instagram.hazir() ? null : '⚠️ Instagram bağlantısı kurulmamış; bildirimler çalışmıyor.',
          `**Kanal:** ${ayar.instagramKanali ? `<#${ayar.instagramKanali}>` : 'ayarlanmadı (bildirimler kapalı)'}`,
          `**Etiketlenecek rol:** ${ayar.instagramRol ? `<@&${ayar.instagramRol}>` : 'yok'}`,
        ]
          .filter(Boolean)
          .join('\n'),
      )
      .addFields({
        name: `Takip edilen hesaplar · ${hesaplar.length}/${instagram.SUNUCU_BASI_SINIR}`,
        value:
          hesaplar.map((h) => `[${duzAd(h.ad)}](https://www.instagram.com/${h.giris}/)`).join(' · ').slice(0, 1000) ||
          'Henüz hesap eklenmemiş',
      })
      .setFooter({ text: `Hesaplar yaklaşık ${dakika} dakikada bir kontrol edilir` });
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
