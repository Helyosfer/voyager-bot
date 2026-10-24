// Rol menüsü: /rolmenu ile kanala düğmeli bir mesaj konur; üyeler düğmeye basarak rolü alır ya
// da bırakır. Ayrıca bir kayıt tutulmaz: hangi rollerin menüde olduğu mesajın düğmelerinden okunur.
// Düğme kimliği: "rm:<mod>:<rolId>"; mod "c" (çoklu seçim) ya da "t" (tek seçim: diğer roller bırakılır)
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');
const { yonetimRolu, beklemeSayaci } = require('./yardimci');

const ROL_SINIRI = 10;
const SIRA_BASI = 5; // Discord: bir satırda en fazla 5 düğme

// Aynı kişi düğmeye art arda basınca Discord'a gereksiz istek gitmesin
const tiklama = beklemeSayaci(1500);

function mesajHazirla({ baslik, aciklama, roller, tek }) {
  const mod = tek ? 't' : 'c';
  const satirlar = [];
  for (let i = 0; i < roller.length; i += SIRA_BASI) {
    satirlar.push(
      new ActionRowBuilder().addComponents(
        roller
          .slice(i, i + SIRA_BASI)
          .map((rol) => new ButtonBuilder().setCustomId(`rm:${mod}:${rol.id}`).setLabel(rol.name.slice(0, 80)).setStyle(ButtonStyle.Secondary)),
      ),
    );
  }
  const embed = new EmbedBuilder()
    .setTitle(baslik)
    .setColor(0x5865f2)
    .setDescription([aciklama, roller.map((r) => `• ${r}`).join('\n')].filter(Boolean).join('\n\n'))
    .setFooter({ text: tek ? 'Bir rol seçebilirsin; yenisini seçince eskisi bırakılır. Yeniden basınca bırakılır.' : 'Düğmeye basınca rol verilir, yeniden basınca bırakılır.' });
  return { embeds: [embed], components: satirlar, allowedMentions: { parse: [] } };
}

// Menüdeki bütün rol kimlikleri, mesajın düğmelerinden okunur
const menuRolleri = (mesaj) =>
  mesaj.components
    .flatMap((satir) => satir.components)
    .map((d) => d.customId)
    .filter((id) => id?.startsWith('rm:'))
    .map((id) => id.split(':')[2]);

// index.js, customId'si "rm:" ile başlayan etkileşimleri buraya yönlendirir.
async function etkilesim(interaction) {
  if (!interaction.isButton()) return;
  const cevapla = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
  const [, mod, rolId] = interaction.customId.split(':');
  const anahtar = `${interaction.guildId}:${interaction.user.id}`;
  if (tiklama.bekle(anahtar)) return cevapla('⏳ Biraz yavaş; bir saniye sonra yeniden dene.');
  tiklama.isaretle(anahtar);

  const { guild, member } = interaction;
  const rol = guild.roles.cache.get(rolId);
  if (!rol) return cevapla('❌ Bu rol artık yok. Yetkililere menüyü yenilemelerini söyle.');
  // Menü kurulduktan sonra role yönetim yetkisi eklenmiş ya da rol botun üstüne taşınmış olabilir
  if (rol.managed || yonetimRolu(rol) || rol.position >= guild.members.me.roles.highest.position) {
    return cevapla('❌ Bu rol şu an menüden verilemiyor. Yetkililere haber ver.');
  }

  if (member.roles.cache.has(rol.id)) {
    await member.roles.remove(rol, 'Rol menüsü');
    return cevapla(`➖ ${rol} rolünü bıraktın.`);
  }
  if (mod === 't') {
    const birakilacak = menuRolleri(interaction.message).filter((id) => id !== rol.id && member.roles.cache.has(id));
    if (birakilacak.length) await member.roles.remove(birakilacak, 'Rol menüsü (tek seçim)');
  }
  await member.roles.add(rol, 'Rol menüsü');
  return cevapla(`➕ ${rol} rolünü aldın.`);
}

module.exports = { ROL_SINIRI, mesajHazirla, menuRolleri, etkilesim };
