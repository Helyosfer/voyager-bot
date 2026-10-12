const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');
const { mudahaleEngeli, logGonder } = require('../yardimci');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sustur')
    .setDescription('Bir üyeyi belirli süre susturur (zaman aşımı)')
    .addUserOption((o) => o.setName('kullanici').setDescription('Susturulacak üye').setRequired(true))
    .addIntegerOption((o) =>
      o
        .setName('dakika')
        .setDescription('Kaç dakika? 0 yazarsan susturma kalkar')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(40320), // Discord sınırı: 28 gün
    )
    .addStringOption((o) => o.setName('sebep').setDescription('Susturma sebebi').setMaxLength(400))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const hedef = interaction.options.getUser('kullanici', true);
    const dakika = interaction.options.getInteger('dakika', true);
    const sebep = interaction.options.getString('sebep') ?? 'Sebep belirtilmedi';
    const uye = await interaction.guild.members.fetch(hedef.id).catch(() => null);

    if (!uye) return interaction.reply({ content: '❌ Bu kullanıcı sunucuda değil.', flags: MessageFlags.Ephemeral });
    const engel = mudahaleEngeli(interaction, uye);
    if (engel) return interaction.reply({ content: `❌ ${engel}`, flags: MessageFlags.Ephemeral });
    if (!uye.moderatable) {
      return interaction.reply({ content: '❌ Bu üyeyi susturamıyorum (yönetici olabilir).', flags: MessageFlags.Ephemeral });
    }

    await uye.timeout(dakika === 0 ? null : dakika * 60_000, `${interaction.user.tag}: ${sebep}`);
    await interaction.reply(
      dakika === 0
        ? `🔊 **${hedef.tag}** artık susturulmuş değil.`
        : `🔇 **${hedef.tag}** ${dakika} dakika susturuldu. Sebep: ${sebep}`,
    );
    await logGonder(interaction.guild, {
      baslik: dakika === 0 ? 'Susturma kaldırıldı' : 'Üye susturuldu',
      renk: 0xeb459e,
      hedef,
      yetkili: interaction.user,
      sebep,
      ek: dakika === 0 ? null : { name: 'Süre', value: `${dakika} dakika` },
    });
  },
};
