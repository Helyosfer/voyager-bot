const { SlashCommandBuilder, ApplicationCommandOptionType, EmbedBuilder, MessageFlags } = require('discord.js');

// Komutun satırı ve varsa alt komutları
function satirlar(komut) {
  const liste = [`**/${komut.name}** · ${komut.description}`];
  for (const secenek of komut.options ?? []) {
    if (secenek.type === ApplicationCommandOptionType.Subcommand) {
      liste.push(`↳ \`/${komut.name} ${secenek.name}\` · ${secenek.description}`);
    }
  }
  return liste.join('\n');
}

module.exports = {
  data: new SlashCommandBuilder().setName('yardim').setDescription('Tüm komutları ve ne işe yaradıklarını listeler'),

  async execute(interaction) {
    // Liste yüklü komutlardan üretilir; yeni komut eklenince kendiliğinden güncellenir
    const komutlar = interaction.client.komutlar
      .map((k) => k.data.toJSON())
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    const herkes = komutlar.filter((k) => !k.default_member_permissions);
    const yetkili = komutlar.filter((k) => k.default_member_permissions);

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.client.user.username} komutları`)
      .setColor(0x5865f2)
      .setDescription(
        [
          '### Herkes kullanabilir',
          ...herkes.map(satirlar),
          '',
          '### Yetki gerektirir',
          ...yetkili.map(satirlar),
        ].join('\n'),
      )
      .setFooter({ text: 'Yetki gerektiren komutlar yalnızca ilgili yetkisi olanlara görünür.' });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
