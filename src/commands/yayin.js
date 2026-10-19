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
const yayin = require('../yayin');

const platformSecenegi = (o) =>
  o
    .setName('platform')
    .setDescription('Yayın platformu')
    .setRequired(true)
    .addChoices(...Object.entries(yayin.PLATFORMLAR).map(([value, p]) => ({ name: p.ad, value })));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('yayin')
    .setDescription('Canlı yayın bildirimlerini ayarlar (Twitch, Kick, YouTube)')
    .addSubcommand((s) =>
      s
        .setName('kanal')
        .setDescription('Yayın bildirimlerinin gönderileceği kanalı seçer')
        .addChannelOption((o) =>
          o
            .setName('kanal')
            .setDescription('Bildirim kanalı')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('ekle')
        .setDescription('Takip edilecek bir yayıncı ekler')
        .addStringOption(platformSecenegi)
        .addStringOption((o) =>
          o.setName('yayinci').setDescription('Kanal adı ya da kanal adresi').setRequired(true).setMaxLength(200),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('cikar')
        .setDescription('Bir yayıncıyı takipten çıkarır')
        .addStringOption(platformSecenegi)
        .addStringOption((o) =>
          o.setName('yayinci').setDescription('Kanal adı ya da kanal adresi').setRequired(true).setMaxLength(200),
        ),
    )
    .addSubcommand((s) => s.setName('liste').setDescription('Takip edilen yayıncıları ve ayarları gösterir'))
    .addSubcommand((s) =>
      s
        .setName('rol')
        .setDescription('Yayın başlayınca etiketlenecek rolü seçer (boş bırakırsan etiketleme kalkar)')
        .addRoleOption((o) => o.setName('rol').setDescription('Etiketlenecek rol')),
    )
    .addSubcommand((s) => s.setName('test').setDescription('Bildirim kanalına örnek bir bildirim gönderir'))
    .addSubcommand((s) => s.setName('kapat').setDescription('Yayın bildirimlerini kapatır (liste silinmez)'))
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
      ayarKaydet(sunucuId, 'yayinKanali', kanal.id);
      return cevapla(`✅ Yayın bildirimleri ${kanal} kanalına gönderilecek. Yayıncı eklemek için \`/yayin ekle\` kullan.`);
    }

    if (alt === 'ekle') {
      const platform = interaction.options.getString('platform', true);
      const girdi = interaction.options.getString('yayinci', true);
      // Platforma sorulduğu için 3 saniyeyi aşabilir
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      let sonuc;
      try {
        sonuc = await yayin.ekle(sunucuId, platform, girdi);
      } catch (hata) {
        console.error('/yayin ekle hatası:', hata.message);
        return interaction.editReply('❌ Eklenemedi: platforma ulaşılamadı ya da botun bu platformla bağlantısında sorun var. Biraz sonra yeniden dene; sürerse botun sahibine haber ver.');
      }
      if (sonuc.hata) return interaction.editReply(`❌ ${sonuc.hata}`);
      const kanalNotu = ayarlariGetir(sunucuId).yayinKanali ? '' : ' Bildirimlerin gelmesi için `/yayin kanal` ile bir kanal seç.';
      return interaction.editReply(
        `✅ **${duzAd(sonuc.yayinci.ad)}** (${yayin.PLATFORMLAR[platform].ad}) takibe alındı.${kanalNotu}`,
      );
    }

    if (alt === 'cikar') {
      const platform = interaction.options.getString('platform', true);
      const silinen = yayin.cikar(sunucuId, platform, interaction.options.getString('yayinci', true));
      if (!silinen) return cevapla('❌ Listede böyle bir yayıncı yok. `/yayin liste` ile kontrol et.');
      // Başka sunucu da takip etmiyorsa platformdaki abonelik de kaldırılır
      yayin.esitle(platform).catch((hata) => console.error('Abonelik kaldırılamadı:', hata.message));
      return cevapla(`✅ **${duzAd(silinen.ad)}** (${yayin.PLATFORMLAR[platform].ad}) takipten çıkarıldı.`);
    }

    if (alt === 'rol') {
      const rol = interaction.options.getRole('rol');
      if (!rol) {
        ayarKaydet(sunucuId, 'yayinRol', null);
        return cevapla('✅ Yayın bildirimlerinde artık rol etiketlenmeyecek.');
      }
      if (rol.id === interaction.guild.id) return cevapla('❌ @everyone seçilemez; ayrı bir rol oluştur.');
      const etiketlenemez = etiketEngeli(interaction, rol);
      if (etiketlenemez) return cevapla(`❌ ${etiketlenemez}`);
      ayarKaydet(sunucuId, 'yayinRol', rol.id);
      const etiketleyebilir =
        rol.mentionable || interaction.guild.members.me.permissions.has(PermissionFlagsBits.MentionEveryone);
      return cevapla(
        etiketleyebilir
          ? `✅ Yayın başlayınca ${rol} etiketlenecek.`
          : `⚠️ ${rol} kaydedildi ama bildirim gitmeyecek: rol ayarlarından "Bu rolden herkesin bahsetmesine izin ver" seçeneğini aç.`,
      );
    }

    if (alt === 'kapat') {
      ayarKaydet(sunucuId, 'yayinKanali', null);
      return cevapla('✅ Yayın bildirimleri kapatıldı. Liste duruyor; yeniden açmak için `/yayin kanal` kullan.');
    }

    const ayar = ayarlariGetir(sunucuId);

    if (alt === 'test') {
      if (!ayar.yayinKanali) return cevapla('❌ Önce `/yayin kanal` ile bir kanal seç.');
      const kanal = await interaction.guild.channels.fetch(ayar.yayinKanali).catch(() => null);
      if (!kanal?.isTextBased()) return cevapla('❌ Bildirim kanalı bulunamadı; `/yayin kanal` ile yeniden seç.');
      await kanal.send(
        yayin.bildirimMesaji('twitch', {
          ad: 'Örnek Yayıncı',
          baslik: 'Bu bir deneme bildirimidir',
          oyun: 'Just Chatting',
          url: 'https://www.twitch.tv',
          basladi: Date.now(),
        }),
      );
      return cevapla(`✅ ${kanal} kanalına deneme bildirimi gönderildi.`);
    }

    // liste alt komutu
    const kayitlar = yayin.liste(sunucuId);
    const alanlar = Object.entries(yayin.PLATFORMLAR).map(([anahtar, p]) => {
      const yayincilar = kayitlar.filter((y) => y.platform === anahtar);
      // Bir alanın değeri en fazla 1024 karakter olabilir; sığmayanların yalnızca sayısı yazılır
      const sigan = [];
      let uzunluk = 0;
      for (const y of yayincilar) {
        const baglanti = `[${duzAd(y.ad)}](${p.kanalAdresi(y)})`;
        if (uzunluk + baglanti.length > 900) break;
        sigan.push(baglanti);
        uzunluk += baglanti.length + 3;
      }
      const kalan = yayincilar.length - sigan.length;
      const satirlar = [];
      if (!p.hazir()) satirlar.push('⚠️ Bağlantı kurulmamış');
      if (sigan.length) satirlar.push(sigan.join(' · ') + (kalan ? ` · +${kalan} daha` : ''));
      else if (p.hazir()) satirlar.push('Henüz yayıncı eklenmemiş');
      return { name: `${p.simge} ${p.ad} · ${yayincilar.length}`, value: satirlar.join('\n') };
    });
    const embed = new EmbedBuilder()
      .setTitle('📡 Yayın bildirimleri')
      .setColor(0x5865f2)
      .setDescription(
        [
          `**Kanal:** ${ayar.yayinKanali ? `<#${ayar.yayinKanali}>` : 'ayarlanmadı (bildirimler kapalı)'}`,
          `**Etiketlenecek rol:** ${ayar.yayinRol ? `<@&${ayar.yayinRol}>` : 'yok'}`,
        ].join('\n'),
      )
      .addFields(alanlar)
      .setFooter({ text: `${kayitlar.length} yayıncı takip ediliyor` });
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
