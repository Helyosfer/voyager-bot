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

// /ayarla sifirla seçenekleri: seçim değeri -> depodaki anahtar
const AYARLAR = {
  'log-kanali': 'logKanali',
  'hosgeldin-kanali': 'hosgeldinKanali',
  'oto-rol': 'otoRol',
};
const DURUMLAR = [
  { name: 'Açık', value: 'acik' },
  { name: 'Kapalı', value: 'kapali' },
];

// Bütün ayarlar
function ayarKarti(sunucuId) {
  const a = ayarlariGetir(sunucuId);
  return new EmbedBuilder()
    .setTitle('⚙️ Sunucu ayarları')
    .setColor(0x5865f2)
    .addFields(
      { name: 'Günlük kanalı', value: a.logKanali ? `<#${a.logKanali}>` : 'Ayarlanmadı', inline: true },
      { name: 'Hoş geldin kanalı', value: a.hosgeldinKanali ? `<#${a.hosgeldinKanali}>` : 'Ayarlanmadı', inline: true },
      { name: 'Oto rol', value: a.otoRol ? `<@&${a.otoRol}>` : 'Ayarlanmadı', inline: true },
      { name: 'Kanal özetleri (/ozetle)', value: a.ozetAcik ? '🟢 Açık' : '⚫ Kapalı', inline: true },
      {
        name: 'Günlük kategorileri',
        value: Object.entries(KATEGORILER)
          .map(([k, ad]) => `${kategoriAcik(a, k) ? '🟢' : '⚫'} ${ad}`)
          .join('\n'),
      },
    )
    .setFooter({ text: 'Diğer ayarlar: /oyun ayar · /yayin ayar · /haber ayar · /koruma goster' });
}

// /ayarla gunluk: kanal ve kategoriler. Seçeneksiz ayarları gösterir.
function gunluk(interaction) {
  const sunucuId = interaction.guildId;
  const kanal = interaction.options.getChannel('kanal');
  const kategori = interaction.options.getString('kategori');
  const durum = interaction.options.getString('durum');
  if (!kanal && !kategori && !durum) return null;
  if (kategori && !durum) return { hata: 'Kategoriyi açmak ya da kapatmak için `durum` da seç.' };
  if (kanal && !yazabilirMi(kanal, [PermissionFlagsBits.EmbedLinks])) {
    return { hata: `${kanal} kanalına yazamıyorum. Bana orada Kanalı Görüntüle, Mesaj Gönder ve Bağlantı Yerleştir izinlerini ver.` };
  }
  const satirlar = [];
  if (kanal) {
    ayarKaydet(sunucuId, 'logKanali', kanal.id);
    satirlar.push(`✅ Günlük kanalı ${kanal} olarak ayarlandı.`);
  }
  if (durum) {
    // Kategori seçilmeden verilen durum bütün kategorilere uygulanır
    const acik = durum === 'acik';
    const secilenler = !kategori || kategori === 'hepsi' ? Object.keys(KATEGORILER) : [kategori];
    const kategoriler = { ...ayarlariGetir(sunucuId).logKategorileri };
    for (const k of secilenler) kategoriler[k] = acik;
    ayarKaydet(sunucuId, 'logKategorileri', kategoriler);
    const ad = secilenler.length > 1 ? 'Tüm kategoriler' : KATEGORILER[kategori];
    satirlar.push(`✅ ${ad}: ${acik ? 'açık' : 'kapalı'}.`);
    if (acik && !ayarlariGetir(sunucuId).logKanali) satirlar.push('Kayıtların yazılması için `/ayarla gunluk kanal:` ile bir kanal seç.');
  }
  return { satirlar };
}

// /ayarla hosgeldin: hoş geldin kanalı ve yeni gelene verilecek rol. Seçeneksiz ayarları gösterir.
function hosgeldin(interaction) {
  const sunucuId = interaction.guildId;
  const kanal = interaction.options.getChannel('kanal');
  const rol = interaction.options.getRole('oto-rol');
  if (!kanal && !rol) return null;
  if (kanal && !yazabilirMi(kanal)) return { hata: `${kanal} kanalına yazamıyorum. Bana orada Kanalı Görüntüle ve Mesaj Gönder izinlerini ver.` };
  const engel = rol && otoRolEngeli(interaction, rol);
  if (engel) return { hata: engel };
  const satirlar = [];
  if (kanal) {
    ayarKaydet(sunucuId, 'hosgeldinKanali', kanal.id);
    satirlar.push(`✅ Hoş geldin kanalı ${kanal} olarak ayarlandı.`);
  }
  if (rol) {
    ayarKaydet(sunucuId, 'otoRol', rol.id);
    satirlar.push(`✅ Yeni üyelere ${rol} rolü verilecek.`);
  }
  return { satirlar };
}

function ozet(interaction) {
  const sunucuId = interaction.guildId;
  const acik = interaction.options.getString('durum', true) === 'acik';
  if (acik && !yapayzeka.hazir()) {
    return { hata: 'Özetleme yapay zekâ ister, ama bu botta yapay zekâ kurulu değil (botun sahibi .env içinde GEMINI_API_KEY ve GEMINI_MODEL girmeli).' };
  }
  if (acik && !icerikOkunabilir(interaction.client)) {
    return { hata: 'Özetleme mesajların metnini okuyabilmeli, ama botta "Message Content Intent" açık değil. Botun sahibi bunu açmalı.' };
  }
  ayarKaydet(sunucuId, 'ozetAcik', acik);
  return {
    satirlar: acik
      ? [
          '✅ Özetleme açık. Üyeler `/ozetle` ile bulundukları kanalın son mesajlarını özetletebilir.',
          'ℹ️ Özetlenen mesajlar Google\'ın yapay zekâsına gönderilir; bot mesajları saklamaz. Yalnızca kanalın mesaj geçmişini okuyabilenler özet alabilir. Özet varsayılan olarak yalnızca isteyene görünür.',
          'Her özet, kişinin günlük `/sor` hakkından bir tane kullanır.',
        ]
      : ['✅ Özetleme kapatıldı.'],
  };
}

function sifirla(interaction) {
  const ayar = interaction.options.getString('ayar', true);
  ayarKaydet(interaction.guildId, AYARLAR[ayar], null);
  return { satirlar: [`✅ ${ayar} ayarı kaldırıldı.`] };
}

const ALT_KOMUTLAR = { gunluk, hosgeldin, ozet, sifirla, goster: () => null };

module.exports = {
  // /ayarlar paneli de bu kartı gösterir
  ayarKarti,

  data: new SlashCommandBuilder()
    .setName('ayarla')
    .setDescription('Sunucu ayarları: günlük kanalı, hoş geldin, otomatik rol, kanal özetleri')
    .addSubcommand((s) =>
      s
        .setName('gunluk')
        .setDescription('Üye, mesaj, ses ve yönetim olaylarının yazılacağı günlük kanalı ve kategorileri')
        .addChannelOption((o) => o.setName('kanal').setDescription('Günlük kanalı').addChannelTypes(ChannelType.GuildText))
        .addStringOption((o) =>
          o
            .setName('kategori')
            .setDescription('Açılıp kapatılacak olay türü (boş: hepsi)')
            .addChoices({ name: 'Hepsi', value: 'hepsi' }, ...Object.entries(KATEGORILER).map(([value, name]) => ({ name, value }))),
        )
        .addStringOption((o) => o.setName('durum').setDescription('Kategori açık mı kapalı mı?').addChoices(...DURUMLAR)),
    )
    .addSubcommand((s) =>
      s
        .setName('hosgeldin')
        .setDescription('Yeni üyelere hoş geldin mesajının atılacağı kanal ve otomatik verilecek rol')
        .addChannelOption((o) => o.setName('kanal').setDescription('Hoş geldin kanalı').addChannelTypes(ChannelType.GuildText))
        .addRoleOption((o) => o.setName('oto-rol').setDescription('Yeni üyelere otomatik verilecek rol')),
    )
    .addSubcommand((s) =>
      s
        .setName('ozet')
        .setDescription('/ozetle ile kanal özetlerini açar (mesajlar özetlenmek için Google\'a gönderilir)')
        .addStringOption((o) => o.setName('durum').setDescription('Açık mı kapalı mı?').setRequired(true).addChoices(...DURUMLAR)),
    )
    .addSubcommand((s) => s.setName('goster').setDescription('Mevcut ayarları gösterir'))
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
              { name: 'Günlük kanalı', value: 'log-kanali' },
              { name: 'Hoş geldin kanalı', value: 'hosgeldin-kanali' },
              { name: 'Oto rol', value: 'oto-rol' },
            ),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    // Alt komut null döndürürse (seçenek verilmedi) yalnızca ayarlar gösterilir
    const sonuc = ALT_KOMUTLAR[interaction.options.getSubcommand()](interaction);
    if (sonuc?.hata) return interaction.reply({ content: `❌ ${sonuc.hata}`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    return interaction.reply({
      content: sonuc?.satirlar.join('\n') || undefined,
      embeds: [ayarKarti(interaction.guildId)],
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  },
};
