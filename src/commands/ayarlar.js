const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js');
const ayarlar = require('../ayarlar');

// Botun bütün sunucu ayarları tek komutta: bildirimler, koruma, günlük, karşılama, seviye, uyarı
// kuralları, acil kilit ve kurulum. Ayrıntı ayarlar/index.js'te.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ayarlar')
    .setDescription('Botun bütün ayarları tek kartta: bildirimler, koruma, günlük, seviye, kilit, kurulum')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  execute: (interaction) => ayarlar.ac(interaction),
};
