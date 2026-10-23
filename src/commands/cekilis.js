const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js');
const cekilis = require('../cekilis');

// /cekilis seçeneksizdir: yazılınca çekiliş başlatma formunu açar. Erken bitirme, yeniden çekme
// ve iptal etme çekiliş mesajının altındaki düğmelerden yapılır.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('cekilis')
    .setDescription('Düğmeyle katılınan çekiliş başlatır; süre dolunca kazananları seçip duyurur')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  execute: (interaction) => interaction.showModal(cekilis.baslatFormu()),
};
