const { SlashCommandBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const hatirlatici = require('../hatirlatici');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hatirlat')
    .setDescription('Belirttiğin süre sonra bu kanalda seni etiketleyerek hatırlatır')
    .addIntegerOption((o) =>
      o
        .setName('dakika')
        .setDescription('Kaç dakika sonra? (en fazla 7 gün = 10080)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(10080),
    )
    .addStringOption((o) => o.setName('mesaj').setDescription('Ne hatırlatayım?').setRequired(true).setMaxLength(500))
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const dakika = interaction.options.getInteger('dakika', true);
    const mesaj = interaction.options.getString('mesaj', true);
    const zaman = Date.now() + dakika * 60_000;

    hatirlatici.ekle(interaction.client, {
      id: interaction.id,
      kullaniciId: interaction.user.id,
      kanalId: interaction.channelId,
      zaman,
      mesaj,
    });

    // <t:...:R> Discord'da "5 dakika içinde" gibi canlı bir sayaç gösterir
    await interaction.reply({
      content: `⏰ Tamam, <t:${Math.floor(zaman / 1000)}:R> hatırlatacağım.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
