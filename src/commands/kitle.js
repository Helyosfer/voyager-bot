const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, EmbedBuilder, MessageFlags } = require('discord.js');
const kilit = require('../kilit');

module.exports = {
  // Yönetici yetkisini bot da denetler; sunucu ayarlarından başka rollere açılamaz
  kesinYetki: true,

  data: new SlashCommandBuilder()
    .setName('kitle')
    .setDescription('Acil durum: bütün kanalları kilitler; sunucu sahibi dışında kimse yazamaz ve sese giremez')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const { guild } = interaction;
    const cevapla = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
    if (kilit.kilitli(guild.id)) return cevapla('🔒 Sunucu zaten kilitli. Açmak için `/kilidiac` kullan.');

    const ben = guild.members.me;
    if (!ben.permissions.has(PermissionFlagsBits.ManageRoles) || !ben.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return cevapla('❌ Kilitleyebilmem için bende **Rolleri Yönet** ve **Kanalları Yönet** izinleri olmalı. Sunucu Ayarları → Roller → Voyager bölümünden aç.');
    }

    // Saldırı anında hız önemli: onay sorulmaz. /kilidiac her şeyi geri alır.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const sonuc = await kilit.kilitle(guild, interaction.user);
    if (!sonuc) return interaction.editReply('⏳ Şu an başka bir kilitleme ya da açma işlemi sürüyor (ya da sunucu az önce kilitlendi). Bitmesini bekle.');

    const embed = new EmbedBuilder()
      .setTitle('🔒 Sunucu kilitlendi')
      .setColor(0xed4245)
      .setDescription(
        [
          `**${sonuc.kilitlenen} kanal** kilitlendi. Sunucu sahibi dışındaki üyeler yazamaz, tepki ekleyemez, konu açamaz ve ses kanallarına giremez.`,
          sonuc.cikarilan ? `${sonuc.cikarilan} kişi ses kanallarından çıkarıldı.` : null,
          sonuc.gizlenen ? `${sonuc.gizlenen} kanal, izinleri tek tek kapatılamadığı için kilit boyunca gizlendi.` : null,
          sonuc.basarisiz ? `⚠️ ${sonuc.basarisiz} kanal kilitlenemedi: ${sonuc.sebepler.join(', ')}.` : null,
          sonuc.atlanan.length ? `⚠️ Bende olmadığı için şu izinleri kilitleyemedim: **${sonuc.atlanan.join(', ')}**. Bu izinleri Voyager rolüne verirsen bir sonraki kilit onları da kapsar.` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      )
      .addFields(
        {
          name: 'Kilit sırasında',
          value: [
            '• Sunucuya eklenen botlar kendiliğinden atılır.',
            '• **Yönetici** iznine sahip roller Discord kuralı gereği kilitten etkilenmez. Hesabı ele geçirilmiş bir yönetici varsa rolünü elle al.',
            '• Yeni üye girişini durdurmak için Sunucu Ayarları → Davetler bölümünden davetleri duraklat.',
          ].join('\n'),
        },
        { name: 'Saldırı bitince', value: '`/kilidiac` bütün kanalları kilitten önceki haline döndürür.' },
      );
    return interaction.editReply({ embeds: [embed] });
  },
};
