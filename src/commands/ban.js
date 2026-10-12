const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');
const { mudahaleEngeli, logGonder } = require('../yardimci');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bir kullanıcıyı sunucudan yasaklar')
    .addUserOption((o) => o.setName('kullanici').setDescription('Yasaklanacak kullanıcı').setRequired(true))
    .addStringOption((o) => o.setName('sebep').setDescription('Yasaklama sebebi').setMaxLength(400))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const hedef = interaction.options.getUser('kullanici', true);
    const sebep = interaction.options.getString('sebep') ?? 'Sebep belirtilmedi';
    const uye = await interaction.guild.members.fetch(hedef.id).catch(() => null);

    const engel = mudahaleEngeli(interaction, uye);
    if (engel) return interaction.reply({ content: `❌ ${engel}`, flags: MessageFlags.Ephemeral });

    await interaction.guild.members.ban(hedef.id, { reason: `${interaction.user.tag}: ${sebep}` });
    await interaction.reply(`🔨 **${hedef.tag}** yasaklandı. Sebep: ${sebep}`);
    await logGonder(interaction.guild, {
      baslik: 'Üye yasaklandı',
      renk: 0xed4245,
      hedef,
      yetkili: interaction.user,
      sebep,
    });
  },
};
