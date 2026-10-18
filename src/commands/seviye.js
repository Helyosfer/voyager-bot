const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType, EmbedBuilder, MessageFlags } = require('discord.js');
const { ayarlariGetir, ayarKaydet } = require('../depo');
const { rolVermeEngeli, yazabilirMi } = require('../yardimci');
const seviye = require('../seviye');

const RENK = 0x57f287;
const SIRALAMA_SINIRI = 10;

const cubuk = (oran) => {
  const dolu = Math.round(oran * 10);
  return `${'▰'.repeat(dolu)}${'▱'.repeat(10 - dolu)}`;
};

function goster(interaction, ayar) {
  const hedef = interaction.options.getUser('kullanici') ?? interaction.user;
  const toplam = seviye.xp(interaction.guildId, hedef.id);
  const { seviye: sv, ilerleme, sonraki } = seviye.seviyeBul(toplam);
  const sira = seviye.siralama(interaction.guildId).findIndex(([id]) => id === hedef.id) + 1;
  const siradaki = ayar.oduller.find((o) => o.seviye > sv);
  const embed = new EmbedBuilder()
    .setAuthor({ name: hedef.username, iconURL: hedef.displayAvatarURL() })
    .setColor(RENK)
    .addFields(
      { name: 'Seviye', value: String(sv), inline: true },
      { name: 'Sıra', value: sira ? `#${sira}` : '-', inline: true },
      { name: 'Toplam XP', value: toplam.toLocaleString('tr'), inline: true },
      { name: 'Sonraki seviye', value: `${cubuk(ilerleme / sonraki)} ${ilerleme}/${sonraki} XP` },
    );
  if (siradaki) embed.setFooter({ text: `${siradaki.seviye}. seviyede bir rol ödülü var.` });
  return interaction.reply({ embeds: [embed] });
}

function siralama(interaction) {
  const liste = seviye.siralama(interaction.guildId).slice(0, SIRALAMA_SINIRI);
  if (!liste.length) return interaction.reply({ content: 'Henüz kimse XP kazanmadı.', flags: MessageFlags.Ephemeral });
  const madalya = ['🥇', '🥈', '🥉'];
  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${interaction.guild.name} · Sıralama`)
    .setColor(RENK)
    .setDescription(liste.map(([id, xp], i) => `${madalya[i] ?? `**${i + 1}.**`} <@${id}> · Seviye ${seviye.seviyeBul(xp).seviye} (${xp.toLocaleString('tr')} XP)`).join('\n'));
  return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
}

function ayarla(interaction) {
  const acik = interaction.options.getString('durum', true) === 'acik';
  const kanal = interaction.options.getChannel('kanal');
  ayarKaydet(interaction.guildId, 'seviyeAcik', acik);
  if (kanal) ayarKaydet(interaction.guildId, 'seviyeKanali', kanal.id);
  if (!acik) return interaction.reply({ content: '✅ Seviye sistemi kapatıldı. Kazanılmış XP silinmez; yeniden açınca kaldığı yerden sürer.', flags: MessageFlags.Ephemeral });
  const duyuruKanali = kanal?.id ?? ayarlariGetir(interaction.guildId).seviyeKanali;
  const duyuru = duyuruKanali && `<#${duyuruKanali}>`;
  return interaction.reply({
    content: [
      '✅ Seviye sistemi açık. Üyeler mesaj yazdıkça XP kazanır (dakikada en fazla bir kez, mesaj başı 15-25 XP).',
      duyuru ? `Seviye atlayanlar ${duyuru} kanalında duyurulur.` : 'Seviye atlayanlar mesajı yazdıkları kanalda duyurulur. Ayrı bir kanal için `kanal` seçeneğini kullan.',
      kanal && !yazabilirMi(kanal) ? `⚠️ ${kanal} kanalına yazamıyorum; bana Kanalı Gör ve Mesaj Gönder izni ver.` : null,
      'Rol ödülleri için `/seviye odul-ekle`.',
    ]
      .filter(Boolean)
      .join('\n'),
    flags: MessageFlags.Ephemeral,
  });
}

function odulEkle(interaction, ayar) {
  const sv = interaction.options.getInteger('seviye', true);
  const rol = interaction.options.getRole('rol', true);
  const engel = rolVermeEngeli(interaction, rol, { kime: 'Bu seviyeye ulaşan herkese', amac: 'Rolü ödül yapabilmen' });
  if (engel) return interaction.reply({ content: `❌ ${engel}`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
  const diger = ayar.oduller.filter((o) => o.seviye !== sv);
  if (diger.length >= seviye.ODUL_SINIRI) {
    return interaction.reply({ content: `❌ En fazla ${seviye.ODUL_SINIRI} ödül olabilir. Önce \`/seviye odul-sil\` ile birini kaldır.`, flags: MessageFlags.Ephemeral });
  }
  ayarKaydet(interaction.guildId, 'seviyeOdulleri', [...diger, { seviye: sv, rolId: rol.id }].sort((a, b) => a.seviye - b.seviye));
  return interaction.reply({
    content: [
      `✅ ${sv}. seviyeye ulaşanlara ${rol} rolü verilecek.`,
      'Bu seviyeyi zaten geçmiş üyeler rolü bir sonraki seviye atlayışlarında alır.',
      interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles) ? null : '⚠️ Rol verebilmem için bana Rolleri Yönet iznini ver.',
    ]
      .filter(Boolean)
      .join('\n'),
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
}

function odulSil(interaction, ayar) {
  const sv = interaction.options.getInteger('seviye', true);
  const kalan = ayar.oduller.filter((o) => o.seviye !== sv);
  if (kalan.length === ayar.oduller.length) return interaction.reply({ content: `❌ ${sv}. seviye için bir ödül yok.`, flags: MessageFlags.Ephemeral });
  ayarKaydet(interaction.guildId, 'seviyeOdulleri', kalan);
  return interaction.reply({ content: `✅ ${sv}. seviye ödülü kaldırıldı. Rolü almış olanlardan geri alınmaz.`, flags: MessageFlags.Ephemeral });
}

function sifirla(interaction) {
  const hedef = interaction.options.getUser('kullanici', true);
  const oldu = seviye.sifirla(interaction.guildId, hedef.id);
  return interaction.reply({ content: oldu ? `✅ **${hedef.tag}** kişisinin XP'si sıfırlandı.` : `❌ **${hedef.tag}** henüz XP kazanmamış.`, flags: MessageFlags.Ephemeral });
}

const ALT_KOMUTLAR = { goster, siralama, ayar: ayarla, 'odul-ekle': odulEkle, 'odul-sil': odulSil, sifirla };
const YONETIM = new Set(['ayar', 'odul-ekle', 'odul-sil', 'sifirla']);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('seviye')
    .setDescription('Mesaj yazdıkça kazanılan seviyeler, sıralama ve seviye ödülü rolleri')
    .addSubcommand((s) =>
      s
        .setName('goster')
        .setDescription('Seviyeni ya da başka bir üyenin seviyesini gösterir')
        .addUserOption((o) => o.setName('kullanici').setDescription('Kimin seviyesi? (varsayılan: sen)')),
    )
    .addSubcommand((s) => s.setName('siralama').setDescription(`En yüksek seviyedeki ${SIRALAMA_SINIRI} üyeyi gösterir`))
    .addSubcommand((s) =>
      s
        .setName('ayar')
        .setDescription('Seviye sistemini açar ya da kapatır (Sunucuyu Yönet gerekir)')
        .addStringOption((o) =>
          o.setName('durum').setDescription('Açık mı kapalı mı?').setRequired(true).addChoices({ name: 'Açık', value: 'acik' }, { name: 'Kapalı', value: 'kapali' }),
        )
        .addChannelOption((o) =>
          o.setName('kanal').setDescription('Seviye atlayanların duyurulacağı kanal (varsayılan: mesajın yazıldığı kanal)').addChannelTypes(ChannelType.GuildText),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('odul-ekle')
        .setDescription('Bir seviyeye ulaşanlara verilecek rolü belirler (Sunucuyu Yönet gerekir)')
        .addIntegerOption((o) => o.setName('seviye').setDescription('Kaçıncı seviyede?').setRequired(true).setMinValue(1).setMaxValue(200))
        .addRoleOption((o) => o.setName('rol').setDescription('Verilecek rol').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('odul-sil')
        .setDescription('Bir seviye ödülünü kaldırır (Sunucuyu Yönet gerekir)')
        .addIntegerOption((o) => o.setName('seviye').setDescription('Ödülü kaldırılacak seviye').setRequired(true).setMinValue(1).setMaxValue(200)),
    )
    .addSubcommand((s) =>
      s
        .setName('sifirla')
        .setDescription('Bir üyenin XP\'sini sıfırlar (Sunucuyu Yönet gerekir)')
        .addUserOption((o) => o.setName('kullanici').setDescription('XP\'si sıfırlanacak üye').setRequired(true)),
    )
    .setContexts(InteractionContextType.Guild),

  execute(interaction) {
    const alt = interaction.options.getSubcommand();
    if (YONETIM.has(alt) && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: '❌ Bunun için Sunucuyu Yönet yetkin olmalı.', flags: MessageFlags.Ephemeral });
    }
    const ayar = seviye.ayarCoz(ayarlariGetir(interaction.guildId));
    if (!YONETIM.has(alt) && !ayar.acik) {
      return interaction.reply({ content: 'Seviye sistemi bu sunucuda kapalı. Yöneticiler `/seviye ayar` ile açabilir.', flags: MessageFlags.Ephemeral });
    }
    return ALT_KOMUTLAR[alt](interaction, ayar);
  },
};
