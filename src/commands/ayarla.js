const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  InteractionContextType,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const { ayarlariGetir, ayarKaydet } = require('../depo');
const { yazabilirMi, otoRolEngeli } = require('../yardimci');
const { KATEGORILER, kategoriAcik } = require('../gunluk');
const { icerikOkunabilir } = require('../koruma');
const yapayzeka = require('../yapayzeka');

// /ayarla sifirla seçenekleri: görünen ad → depodaki anahtar
const AYARLAR = {
  'log-kanali': 'logKanali',
  'hosgeldin-kanali': 'hosgeldinKanali',
  'oto-rol': 'otoRol',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ayarla')
    .setDescription('Bot ayarlarını değiştirir')
    .addSubcommand((s) =>
      s
        .setName('log-kanali')
        .setDescription('Moderasyon işlemlerinin yazılacağı kanal')
        .addChannelOption((o) =>
          o.setName('kanal').setDescription('Log kanalı').addChannelTypes(ChannelType.GuildText).setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('hosgeldin-kanali')
        .setDescription('Yeni üyelere hoş geldin mesajının atılacağı kanal')
        .addChannelOption((o) =>
          o.setName('kanal').setDescription('Hoş geldin kanalı').addChannelTypes(ChannelType.GuildText).setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('oto-rol')
        .setDescription('Yeni üyelere otomatik verilecek rol')
        .addRoleOption((o) => o.setName('rol').setDescription('Verilecek rol').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('sifirla')
        .setDescription('Bir ayarı kaldırır')
        .addStringOption((o) =>
          o
            .setName('ayar')
            .setDescription('Kaldırılacak ayar')
            .setRequired(true)
            .addChoices(
              { name: 'Log kanalı', value: 'log-kanali' },
              { name: 'Hoş geldin kanalı', value: 'hosgeldin-kanali' },
              { name: 'Oto rol', value: 'oto-rol' },
            ),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('log-kategori')
        .setDescription('Log kanalına hangi tür olayların yazılacağını seçer')
        .addStringOption((o) =>
          o
            .setName('kategori')
            .setDescription('Olay türü')
            .setRequired(true)
            .addChoices(
              { name: 'Hepsi', value: 'hepsi' },
              ...Object.entries(KATEGORILER).map(([value, name]) => ({ name, value })),
            ),
        )
        .addStringOption((o) =>
          o
            .setName('durum')
            .setDescription('Açık mı kapalı mı?')
            .setRequired(true)
            .addChoices({ name: 'Açık', value: 'acik' }, { name: 'Kapalı', value: 'kapali' }),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('ozet')
        .setDescription('/ozetle ile kanal özetlerini açar (mesajlar özetlenmek için Google\'a gönderilir)')
        .addStringOption((o) =>
          o
            .setName('durum')
            .setDescription('Açık mı kapalı mı?')
            .setRequired(true)
            .addChoices({ name: 'Açık', value: 'acik' }, { name: 'Kapalı', value: 'kapali' }),
        ),
    )
    .addSubcommand((s) => s.setName('goster').setDescription('Mevcut ayarları gösterir'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const alt = interaction.options.getSubcommand();
    const sunucuId = interaction.guildId;
    let mesaj;

    if (alt === 'log-kanali') {
      const kanal = interaction.options.getChannel('kanal', true);
      if (!yazabilirMi(kanal, [PermissionFlagsBits.EmbedLinks])) {
        mesaj = `❌ ${kanal} kanalına yazamıyorum. Bana orada Kanalı Görüntüle, Mesaj Gönder ve Bağlantı Yerleştir izinlerini ver.`;
      } else {
        ayarKaydet(sunucuId, 'logKanali', kanal.id);
        mesaj = `✅ Log kanalı ${kanal} olarak ayarlandı.`;
      }
    } else if (alt === 'hosgeldin-kanali') {
      const kanal = interaction.options.getChannel('kanal', true);
      if (!yazabilirMi(kanal)) {
        mesaj = `❌ ${kanal} kanalına yazamıyorum. Bana orada Kanalı Görüntüle ve Mesaj Gönder izinlerini ver.`;
      } else {
        ayarKaydet(sunucuId, 'hosgeldinKanali', kanal.id);
        mesaj = `✅ Hoş geldin kanalı ${kanal} olarak ayarlandı.`;
      }
    } else if (alt === 'log-kategori') {
      const kategori = interaction.options.getString('kategori', true);
      const acik = interaction.options.getString('durum', true) === 'acik';
      const secilenler = kategori === 'hepsi' ? Object.keys(KATEGORILER) : [kategori];
      const kategoriler = { ...ayarlariGetir(sunucuId).logKategorileri };
      for (const k of secilenler) kategoriler[k] = acik;
      ayarKaydet(sunucuId, 'logKategorileri', kategoriler);
      const ad = kategori === 'hepsi' ? 'Tüm kategoriler' : KATEGORILER[kategori];
      mesaj = `✅ ${ad}: ${acik ? 'açık' : 'kapalı'}.`;
      if (acik && !ayarlariGetir(sunucuId).logKanali) {
        mesaj += ' Kayıtların yazılması için `/ayarla log-kanali` ile bir kanal seç.';
      }
    } else if (alt === 'sifirla') {
      const ayar = interaction.options.getString('ayar', true);
      ayarKaydet(sunucuId, AYARLAR[ayar], null);
      mesaj = `✅ ${ayar} ayarı kaldırıldı.`;
    } else if (alt === 'ozet') {
      const acik = interaction.options.getString('durum', true) === 'acik';
      if (acik && !yapayzeka.hazir()) {
        mesaj = '❌ Özetleme yapay zekâ ister, ama bu botta yapay zekâ kurulu değil (botun sahibi .env içinde GEMINI_API_KEY ve GEMINI_MODEL girmeli).';
      } else if (acik && !icerikOkunabilir(interaction.client)) {
        mesaj = '❌ Özetleme mesajların metnini okuyabilmeli, ama botta "Message Content Intent" açık değil. Botun sahibi bunu açmalı.';
      } else {
        ayarKaydet(sunucuId, 'ozetAcik', acik);
        mesaj = acik
          ? [
              '✅ Özetleme açık. Üyeler `/ozetle` ile bulundukları kanalın son mesajlarını özetletebilir.',
              'ℹ️ Özetlenen mesajlar Google\'ın yapay zekâsına gönderilir; bot mesajları saklamaz. Yalnızca kanalın mesaj geçmişini okuyabilenler özet alabilir. Özet varsayılan olarak yalnızca isteyene görünür.',
              'Her özet, kişinin günlük `/sor` hakkından bir tane kullanır.',
            ].join('\n')
          : '✅ Özetleme kapatıldı.';
      }
    } else if (alt === 'oto-rol') {
      const rol = interaction.options.getRole('rol', true);
      const engel = otoRolEngeli(interaction, rol);
      if (engel) {
        mesaj = `❌ ${engel}`;
      } else {
        ayarKaydet(sunucuId, 'otoRol', rol.id);
        mesaj = `✅ Yeni üyelere ${rol} rolü verilecek.`;
      }
    } else {
      const a = ayarlariGetir(sunucuId);
      const embed = new EmbedBuilder()
        .setTitle('⚙️ Sunucu ayarları')
        .setColor(0x5865f2)
        .addFields(
          { name: 'Log kanalı', value: a.logKanali ? `<#${a.logKanali}>` : 'Ayarlanmadı', inline: true },
          { name: 'Hoş geldin kanalı', value: a.hosgeldinKanali ? `<#${a.hosgeldinKanali}>` : 'Ayarlanmadı', inline: true },
          { name: 'Oto rol', value: a.otoRol ? `<@&${a.otoRol}>` : 'Ayarlanmadı', inline: true },
          { name: 'Kanal özetleri (/ozetle)', value: a.ozetAcik ? '🟢 Açık' : '⚫ Kapalı', inline: true },
          {
            name: 'Log kategorileri',
            value: Object.entries(KATEGORILER)
              .map(([k, ad]) => `${kategoriAcik(a, k) ? '🟢' : '⚫'} ${ad}`)
              .join('\n'),
          },
        )
        .setFooter({ text: 'Diğer ayarlar: /oyun goster · /yayin liste' });
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    await interaction.reply({ content: mesaj, flags: MessageFlags.Ephemeral });
  },
};
