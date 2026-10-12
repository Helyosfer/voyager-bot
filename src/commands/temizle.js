const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');
const { logGonder } = require('../yardimci');
const { temizlemeBildir } = require('../gunluk');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('temizle')
    .setDescription('Bu kanaldaki son mesajları toplu siler')
    .addIntegerOption((o) =>
      o.setName('adet').setDescription('Kaç mesaj silinsin? (1-100)').setRequired(true).setMinValue(1).setMaxValue(100),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const adet = interaction.options.getInteger('adet', true);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // true: Discord 14 günden eski mesajların toplu silinmesine izin vermez, onları atla
    temizlemeBildir(interaction.channelId);
    const silinen = await interaction.channel.bulkDelete(adet, true);
    await interaction.editReply(`🧹 ${silinen.size} mesaj silindi.`);
    await logGonder(interaction.guild, {
      baslik: 'Mesajlar silindi',
      renk: 0x5865f2,
      yetkili: interaction.user,
      ek: [
        { name: 'Kanal', value: `${interaction.channel}` },
        { name: 'Adet', value: `${silinen.size} mesaj` },
      ],
    });
  },
};
