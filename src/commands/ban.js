const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags, RESTJSONErrorCodes } = require('discord.js');
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
    // Yalnızca "üye yok" cevabı sunucuda olmayan kullanıcı sayılır (kimlikle yasaklama; rol denetimi gerekmez).
    // Başka bir hatada (Discord arızası, zaman aşımı) rol denetimi atlanıp üstteki biri yasaklanmasın.
    const uye = await interaction.guild.members
      .fetch(hedef.id)
      .catch((hata) => (hata.code === RESTJSONErrorCodes.UnknownMember ? null : Promise.reject(hata)));

    const engel = mudahaleEngeli(interaction, uye);
    if (engel) return interaction.reply({ content: `❌ ${engel}`, flags: MessageFlags.Ephemeral });

    // Discord 3 saniye içinde cevap bekler; işlem uzarsa "yanıt vermedi" demesin
    await interaction.deferReply();
    await interaction.guild.members.ban(hedef.id, { reason: `${interaction.user.tag}: ${sebep}` });
    await interaction.editReply(`🔨 **${hedef.tag}** yasaklandı. Sebep: ${sebep}`);
    await logGonder(interaction.guild, {
      baslik: 'Üye yasaklandı',
      renk: 0xed4245,
      hedef,
      yetkili: interaction.user,
      sebep,
    });
  },
};
