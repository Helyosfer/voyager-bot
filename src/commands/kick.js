const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');
const { mudahaleEngeli, logGonder } = require('../yardimci');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Bir üyeyi sunucudan atar (tekrar katılabilir)')
    .addUserOption((o) => o.setName('kullanici').setDescription('Atılacak üye').setRequired(true))
    .addStringOption((o) => o.setName('sebep').setDescription('Atılma sebebi').setMaxLength(400))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const hedef = interaction.options.getUser('kullanici', true);
    const sebep = interaction.options.getString('sebep') ?? 'Sebep belirtilmedi';
    const uye = await interaction.guild.members.fetch(hedef.id).catch(() => null);

    if (!uye) return interaction.reply({ content: '❌ Bu kullanıcı sunucuda değil.', flags: MessageFlags.Ephemeral });
    const engel = mudahaleEngeli(interaction, uye);
    if (engel) return interaction.reply({ content: `❌ ${engel}`, flags: MessageFlags.Ephemeral });

    await uye.kick(`${interaction.user.tag}: ${sebep}`);
    await interaction.reply(`👢 **${hedef.tag}** sunucudan atıldı. Sebep: ${sebep}`);
    await logGonder(interaction.guild, {
      baslik: 'Üye atıldı',
      renk: 0xfee75c,
      hedef,
      yetkili: interaction.user,
      sebep,
    });
  },
};
