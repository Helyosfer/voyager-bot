const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType, MessageFlags } = require('discord.js');
const { yazabilirMi, rolVermeEngeli, logGonder } = require('../yardimci');
const rolmenu = require('../rolmenu');

const komut = new SlashCommandBuilder()
  .setName('rolmenu')
  .setDescription('Üyelerin düğmeye basarak rol alıp bırakabildiği bir menü mesajı kurar')
  .addStringOption((o) => o.setName('baslik').setDescription('Menünün başlığı (ör. Bildirim rolleri)').setRequired(true).setMaxLength(100))
  .addRoleOption((o) => o.setName('rol1').setDescription('Menüdeki rol').setRequired(true));
for (let i = 2; i <= rolmenu.ROL_SINIRI; i++) komut.addRoleOption((o) => o.setName(`rol${i}`).setDescription('Menüdeki rol (isteğe bağlı)'));
komut
  .addStringOption((o) => o.setName('aciklama').setDescription('Başlığın altına yazılacak açıklama').setMaxLength(1000))
  .addBooleanOption((o) => o.setName('tek-secim').setDescription('Üye bu menüden yalnızca bir rol alabilsin mi? (varsayılan: hayır)'))
  .addChannelOption((o) =>
    o.setName('kanal').setDescription('Menünün konacağı kanal (varsayılan: bu kanal)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .setContexts(InteractionContextType.Guild);

module.exports = {
  data: komut,

  async execute(interaction) {
    const cevapla = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    const kanal = interaction.options.getChannel('kanal') ?? interaction.channel;

    const roller = [];
    for (let i = 1; i <= rolmenu.ROL_SINIRI; i++) {
      const rol = interaction.options.getRole(`rol${i}`);
      if (rol && !roller.some((r) => r.id === rol.id)) roller.push(rol);
    }
    for (const rol of roller) {
      const engel = rolVermeEngeli(interaction, rol, { kime: 'İsteyen herkese', amac: 'Rolü menüye ekleyebilmen' });
      if (engel) return cevapla(`❌ ${rol}: ${engel}`);
    }
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return cevapla('❌ Rol verebilmem için bana Rolleri Yönet iznini ver.');
    }
    if (!kanal?.isTextBased() || !yazabilirMi(kanal, [PermissionFlagsBits.EmbedLinks])) {
      return cevapla(`❌ ${kanal ?? 'Bu kanal'} kanalına yazamıyorum. Bana Kanalı Gör, Mesaj Gönder ve Bağlantı Yerleştir izinlerini ver.`);
    }

    const mesaj = await kanal.send(
      rolmenu.mesajHazirla({
        baslik: interaction.options.getString('baslik', true),
        aciklama: interaction.options.getString('aciklama'),
        roller,
        tek: interaction.options.getBoolean('tek-secim') === true,
      }),
    );
    await cevapla(`✅ Rol menüsü kuruldu: ${mesaj.url}\nKaldırmak için mesajı silmen yeterli.`);
    await logGonder(interaction.guild, {
      baslik: 'Rol menüsü kuruldu',
      renk: 0x5865f2,
      yetkili: interaction.user,
      ek: [
        { name: 'Kanal', value: `${kanal} · [mesaja git](${mesaj.url})` },
        { name: 'Roller', value: roller.map((r) => `${r}`).join(' ') },
      ],
    });
  },
};
