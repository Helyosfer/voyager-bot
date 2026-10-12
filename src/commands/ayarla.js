const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  InteractionContextType,
  ChannelType,
  MessageFlags,
} = require('discord.js');
const { ayarlariGetir, ayarKaydet } = require('../depo');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ayarla')
    .setDescription('Bot ayarlarını değiştirir')
    .addSubcommand((s) =>
      s
        .setName('log-kanali')
        .setDescription('Moderasyon işlemlerinin yazılacağı kanal')
        .addChannelOption((o) =>
          o.setName('kanal').setDescription('Log kanalı').addChannelTypes(ChannelType.GuildText).setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('hosgeldin-kanali')
        .setDescription('Yeni üyelere hoş geldin mesajının atılacağı kanal')
        .addChannelOption((o) =>
          o.setName('kanal').setDescription('Hoş geldin kanalı').addChannelTypes(ChannelType.GuildText).setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('oto-rol')
        .setDescription('Yeni üyelere otomatik verilecek rol')
        .addRoleOption((o) => o.setName('rol').setDescription('Verilecek rol').setRequired(true)),
    )
    .addSubcommand((s) => s.setName('goster').setDescription('Mevcut ayarları gösterir'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const alt = interaction.options.getSubcommand();
    const sunucuId = interaction.guildId;
    let mesaj;

    if (alt === 'log-kanali') {
      const kanal = interaction.options.getChannel('kanal', true);
      ayarKaydet(sunucuId, 'logKanali', kanal.id);
      mesaj = `✅ Log kanalı ${kanal} olarak ayarlandı.`;
    } else if (alt === 'hosgeldin-kanali') {
      const kanal = interaction.options.getChannel('kanal', true);
      ayarKaydet(sunucuId, 'hosgeldinKanali', kanal.id);
      mesaj = `✅ Hoş geldin kanalı ${kanal} olarak ayarlandı.`;
    } else if (alt === 'oto-rol') {
      const rol = interaction.options.getRole('rol', true);
      if (rol.managed || rol.id === interaction.guild.id) {
        mesaj = '❌ Bu rol otomatik verilemez.';
      } else if (rol.position >= interaction.guild.members.me.roles.highest.position) {
        mesaj = '❌ Bu rol benim rolümden yüksek. Bot rolünü rol listesinde bu rolün üstüne taşı.';
      } else {
        ayarKaydet(sunucuId, 'otoRol', rol.id);
        mesaj = `✅ Yeni üyelere ${rol} rolü verilecek.`;
      }
    } else {
      const a = ayarlariGetir(sunucuId);
      mesaj = [
        `**Log kanalı:** ${a.logKanali ? `<#${a.logKanali}>` : 'ayarlanmadı'}`,
        `**Hoş geldin kanalı:** ${a.hosgeldinKanali ? `<#${a.hosgeldinKanali}>` : 'ayarlanmadı'}`,
        `**Oto rol:** ${a.otoRol ? `<@&${a.otoRol}>` : 'ayarlanmadı'}`,
      ].join('\n');
    }

    await interaction.reply({ content: mesaj, flags: MessageFlags.Ephemeral });
  },
};
