const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js');
const moderasyon = require('../moderasyon');

// Moderasyon: üyeye sağ tıklayınca ("Moderasyon") ya da /mod uye ile açılan kartta uyar, sustur,
// at, yasakla ve uyarı silme düğmeleri vardır. Kanal temizleme, ID ile yasaklama ve yasak kaldırma
// ise doğrudan bu komutun alt komutlarıdır.
const ALT_KOMUTLAR = {
  uye: (interaction) => moderasyon.kartAc(interaction, interaction.options.getUser('kullanici', true)),
  temizle: moderasyon.temizleKomut,
  yasakla: moderasyon.yasaklaKomut,
  'yasak-kaldir': moderasyon.yasakKaldirKomut,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Moderasyon kartı, mesaj temizleme, kimlikle yasaklama ve yasak kaldırma')
    .addSubcommand((s) =>
      s
        .setName('uye')
        .setDescription('Üyenin moderasyon kartını açar (uyar, sustur, at, yasakla, uyarıları yönet)')
        .addUserOption((o) => o.setName('kullanici').setDescription('İşlem yapılacak üye').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('temizle')
        .setDescription('Bu kanaldaki son mesajları toplu siler')
        .addIntegerOption((o) => o.setName('adet').setDescription('Kaç mesaj silinsin? (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)),
    )
    .addSubcommand((s) =>
      s
        .setName('yasakla')
        .setDescription('Bir kullanıcıyı sunucudan yasaklar (sunucuda olmayanlar için ID yapıştırabilirsin)')
        .addUserOption((o) => o.setName('kullanici').setDescription('Yasaklanacak kullanıcı').setRequired(true))
        .addStringOption((o) => o.setName('sebep').setDescription('Yasaklama sebebi').setMaxLength(400)),
    )
    .addSubcommand((s) =>
      s
        .setName('yasak-kaldir')
        .setDescription('Bir kullanıcının yasağını kaldırır')
        .addUserOption((o) => o.setName('kullanici').setDescription('Yasağı kaldırılacak kullanıcı (ID yapıştırabilirsin)').setRequired(true))
        .addStringOption((o) => o.setName('sebep').setDescription('Yasağı kaldırma sebebi').setMaxLength(400)),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild),

  execute: (interaction) => ALT_KOMUTLAR[interaction.options.getSubcommand()](interaction),
};
