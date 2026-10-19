const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');
const { logGonder } = require('../yardimci');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Bir kullanıcının yasağını kaldırır')
    .addUserOption((o) =>
      o.setName('kullanici').setDescription('Yasağı kaldırılacak kullanıcı (ID yapıştırabilirsin)').setRequired(true),
    )
    .addStringOption((o) => o.setName('sebep').setDescription('Yasağı kaldırma sebebi').setMaxLength(400))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const hedef = interaction.options.getUser('kullanici', true);
    const sebep = interaction.options.getString('sebep') ?? 'Sebep belirtilmedi';

    const yasak = await interaction.guild.bans.fetch(hedef.id).catch(() => null);
    if (!yasak) return interaction.reply({ content: '❌ Bu kullanıcı yasaklı değil.', flags: MessageFlags.Ephemeral });

    // Discord yanıtı 3 saniye içinde bekler; işlem uzun sürerse "Uygulama yanıt vermedi" hatası çıkmasın
    await interaction.deferReply();
    await interaction.guild.members.unban(hedef.id, `${interaction.user.tag}: ${sebep}`);
    await interaction.editReply(`🔓 **${hedef.tag}** kullanıcısının yasağı kaldırıldı. Sebep: ${sebep}`);
    await logGonder(interaction.guild, {
      baslik: 'Yasak kaldırıldı',
      renk: 0x57f287,
      hedef,
      yetkili: interaction.user,
      sebep,
    });
  },
};
