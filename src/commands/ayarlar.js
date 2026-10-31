const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js');
const ayarlarPaneli = require('../ayarlar-paneli');

// Botun sunucu ayarları tek kartta: koruma, günlük, karşılama, seviye, uyarı cezaları, bildirimler,
// kurulum. Her şey düğme ve menülerle yapılır; ayrıntı ayarlar-paneli.js'te. Ayarları komutla
// değiştirmek isteyenler için /koruma, /ayarla, /seviye gibi komutlar da yerinde durur.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ayarlar')
    .setDescription('Ayarlar paneli: koruma, günlük, karşılama, seviye ve bildirimler; komut yazmadan, tıklayarak')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  execute: (interaction) => ayarlarPaneli.ac(interaction),
};
