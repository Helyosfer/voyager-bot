const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  InteractionContextType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  escapeMarkdown,
} = require('discord.js');
const topluluk = require('../topluluk');

const { islemde } = topluluk;
const GEREKLI = [
  [PermissionFlagsBits.ManageChannels, 'Kanalları Yönet'],
  [PermissionFlagsBits.ManageRoles, 'Rolleri Yönet'],
];
const ONAY_SURESI = 120_000;

// Adları alan sınırına (1024) sığdırır; sığmayanlar sayıyla belirtilir
function adListesi(adlar) {
  const sigan = [];
  let uzunluk = 0;
  for (const ad of adlar) {
    if (uzunluk + ad.length + 2 > 960) break;
    sigan.push(ad);
    uzunluk += ad.length + 2;
  }
  const kalan = adlar.length - sigan.length;
  return sigan.join(', ') + (kalan ? ` … ve ${kalan} tane daha` : '');
}
const kanalAdi = (k) => `#${escapeMarkdown(k.name)}`;
const rolAdi = (r) => `@${escapeMarkdown(r.name)}`;

const DENETIM_UYARISI =
  'Denetim kaydını okuyamadım (bende **Denetim Kaydını Görüntüle** izni yok). Bu yüzden eski kurulumların oluşturduklarının bir kısmı listede olmayabilir; izni verip komutu yeniden çalıştırabilirsin.';

// "Emin misin?" kartı: silinecek her şey adıyla gösterilir
function onizleme(plan, buKanal) {
  const embed = new EmbedBuilder()
    .setTitle('⚠️ Kurulumu sil · Emin misin?')
    .setColor(0xed4245)
    .setDescription(
      [
        `\`/sunucukur\` ile oluşturduğum **${plan.toplam} öğe** silinecek. **Bu işlem geri alınamaz:** silinen kanallardaki bütün mesajlar da gider.`,
        '',
        '• Senin eklediğin kanal ve roller silinmez. Benim kurduğum bir kategorinin altına kendin kanal eklediysen o kanal kalır, kategorisiz olur.',
        '• Silinen kanal ve rollere bağlı bot ayarları (günlük kanalı, hoş geldin, bildirim rolleri…) temizlenir. Açılan özellikler (koruma, seviye) kapanmaz.',
        buKanal ? '• **Şu an yazdığın bu kanal da silinecek.**' : null,
      ]
        .filter((s) => s !== null)
        .join('\n'),
    );
  if (plan.kategoriler.length) embed.addFields({ name: `Kategoriler (${plan.kategoriler.length})`, value: adListesi(plan.kategoriler.map((k) => escapeMarkdown(k.name))) });
  if (plan.kanallar.length) embed.addFields({ name: `Kanallar (${plan.kanallar.length})`, value: adListesi(plan.kanallar.map(kanalAdi)) });
  if (plan.roller.length) embed.addFields({ name: `Roller (${plan.roller.length})`, value: adListesi(plan.roller.map(rolAdi)) });
  if (plan.dokunulamayan.length) {
    embed.addFields({
      name: '⚠️ Silemeyeceğim roller',
      value: `${adListesi(plan.dokunulamayan.map(rolAdi))}\n-# Bunlar benim rolümün üstünde. Silmemi istiyorsan Voyager rolünü rol listesinde üstlerine taşı.`.slice(0, 1024),
    });
  }
  if (plan.denetimOkunamadi) embed.addFields({ name: '⚠️ Eksik olabilir', value: DENETIM_UYARISI });
  return embed;
}

function sonucKarti(sonuc) {
  const embed = new EmbedBuilder()
    .setTitle(sonuc.hatalar.length ? '⚠️ Bir kısmı silinemedi' : '✅ Kurulum silindi')
    .setColor(sonuc.hatalar.length ? 0xfee75c : 0x57f287)
    .setDescription(`${sonuc.silinen} öğe silindi.${sonuc.hatalar.length ? ' Silinemeyenler kayıtta kaldı: komutu yeniden çalıştırınca yine listelenir.' : ''}`);
  if (sonuc.hatalar.length) {
    const ilk = sonuc.hatalar.slice(0, 8).map((h) => `• ${escapeMarkdown(h)}`);
    if (sonuc.hatalar.length > 8) ilk.push(`… ve ${sonuc.hatalar.length - 8} tane daha`);
    embed.addFields({ name: 'Silinemeyenler', value: ilk.join('\n').slice(0, 1024) });
  }
  if (sonuc.temizlenen.length) embed.addFields({ name: 'Temizlenen bot ayarları', value: sonuc.temizlenen.join(', ').slice(0, 1024) });
  return embed;
}

module.exports = {
  // Geri alınamaz: Yönetici yetkisini bot da denetler; komut sunucu ayarlarından başka rollere açılsa bile onlarda çalışmaz
  kesinYetki: true,

  data: new SlashCommandBuilder()
    .setName('sunucusil')
    .setDescription('/sunucukur ile kurduğum kanal, kategori ve rolleri siler (önce onay ister)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const { guild } = interaction;
    const eksik = GEREKLI.filter(([izin]) => !guild.members.me.permissions.has(izin)).map(([, ad]) => ad);
    if (eksik.length) {
      return interaction.reply({
        content: `❌ Silmek için bana şu izinleri vermen gerekiyor: **${eksik.join(', ')}**. Sunucu Ayarları → Roller → Voyager bölümünden açıp komutu yeniden çalıştır.`,
        flags: MessageFlags.Ephemeral,
      });
    }
    if (islemde.has(guild.id)) {
      return interaction.reply({ content: '⏳ Bu sunucuda şu an bir kurulum ya da silme sürüyor. Bitmesini bekle.', flags: MessageFlags.Ephemeral });
    }

    // Denetim kaydını okumak birkaç saniye sürebilir
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const plan = await topluluk.silmePlani(guild);
    if (!plan.toplam) {
      const metin = plan.dokunulamayan.length
        ? `Silebileceğim bir şey kalmadı. Şu roller benim rolümün üstünde olduğu için silemiyorum: ${adListesi(plan.dokunulamayan.map(rolAdi))}. Voyager rolünü üstlerine taşıyıp yeniden dene.`
        : '✅ Bu sunucuda `/sunucukur` ile oluşturduğum ve hâlâ duran bir kanal ya da rol yok.';
      return interaction.editReply({ content: plan.denetimOkunamadi ? `${metin}\n⚠️ ${DENETIM_UYARISI}` : metin });
    }

    const buKanal = plan.kanallar.some((k) => k.id === interaction.channelId);
    const dugmeler = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('sunucusil-onay').setLabel(`Evet, sil (${plan.toplam} öğe)`).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('sunucusil-vazgec').setLabel('Vazgeç').setStyle(ButtonStyle.Secondary),
    );
    const mesaj = await interaction.editReply({ embeds: [onizleme(plan, buKanal)], components: [dugmeler] });
    const secim = await mesaj.awaitMessageComponent({ filter: (i) => i.user.id === interaction.user.id, time: ONAY_SURESI }).catch(() => null);

    if (!secim || secim.customId === 'sunucusil-vazgec') {
      const metin = secim ? 'Vazgeçildi; hiçbir şey silinmedi.' : 'Süre doldu; hiçbir şey silinmedi.';
      return secim ? secim.update({ content: metin, embeds: [], components: [] }) : interaction.editReply({ content: metin, embeds: [], components: [] });
    }
    if (islemde.has(guild.id)) {
      return secim.update({ content: '⏳ Bu sunucuda şu an bir kurulum ya da silme sürüyor. Bitmesini bekle.', embeds: [], components: [] });
    }

    await secim.update({ content: '⏳ Siliniyor…', embeds: [], components: [] });
    // Onay beklenirken sunucu değişmiş olabilir; plan güncel haline göre yeniden çıkarılır
    const sonuc = await topluluk.sil(guild, await topluluk.silmePlani(guild), interaction.user.tag, {
      ilerleme: (metin) => secim.editReply({ content: metin }),
      sonaBirak: interaction.channelId,
    });
    // Komutun yazıldığı kanal silindiyse cevap artık güncellenemez
    return secim.editReply({ content: '', embeds: [sonucKarti(sonuc)] }).catch(() => {});
  },

  // Yalnızca testler kullanır
  onizleme,
  sonucKarti,
};
