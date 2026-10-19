const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');
const kilit = require('../kilit');

module.exports = {
  // Yönetici yetkisini bot da denetler; komut sunucu ayarlarından başka rollere açılsa bile onlarda çalışmaz
  kesinYetki: true,

  data: new SlashCommandBuilder()
    .setName('kilidiac')
    .setDescription('/kitle ile kilitlenen kanalları kilitten önceki haline döndürür')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const { guild } = interaction;
    if (!kilit.kilitli(guild.id)) {
      return interaction.reply({ content: '🔓 Sunucu kilitli değil.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const sonuc = await kilit.ac(guild, interaction.user);
    if (!sonuc) return interaction.editReply('⏳ Şu an başka bir kilitleme ya da açma işlemi sürüyor. Bitince yeniden dene.');
    return interaction.editReply(
      sonuc.basarisiz
        ? `⚠️ ${sonuc.acilan} kanal eski haline döndü, **${sonuc.basarisiz} kanal açılamadı** (${sonuc.sebepler.join(', ')}). Sunucu hâlâ kilitli sayılıyor; \`/kilidiac\` komutunu yeniden çalıştır.`
        : `🔓 Kilit açıldı: ${sonuc.acilan} kanal kilitten önceki izinlerine döndü.`,
    );
  },
};
