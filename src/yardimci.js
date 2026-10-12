const { EmbedBuilder } = require('discord.js');
const { ayarlariGetir } = require('./depo');

// Komutu kullanan kişi bu üyeye işlem yapabilir mi? Yapamazsa sebebini döndürür.
function mudahaleEngeli(interaction, uye) {
  if (!uye) return null; // Sunucuda değil (ör. ID ile ban), rol kontrolü gerekmez
  if (uye.id === interaction.user.id) return 'Kendine işlem yapamazsın.';
  if (uye.id === interaction.client.user.id) return 'Bana işlem yapamazsın.';
  if (uye.id === interaction.guild.ownerId) return 'Sunucu sahibine işlem yapılamaz.';

  const sahipMi = interaction.user.id === interaction.guild.ownerId;
  if (!sahipMi && interaction.member.roles.highest.comparePositionTo(uye.roles.highest) <= 0) {
    return 'Bu üyenin rolü seninkiyle aynı veya daha yüksek.';
  }
  if (!uye.manageable) {
    return 'Bu üyenin rolü benim rolümden yüksek. Bot rolünü rol listesinde yukarı taşı.';
  }
  return null;
}

// Moderasyon işlemini log kanalına yazar (ayarlanmışsa).
// hedef ve sebep isteğe bağlıdır (ör. /temizle'de ikisi de yok).
async function logGonder(guild, { baslik, renk, hedef, yetkili, sebep, ek }) {
  const { logKanali } = ayarlariGetir(guild.id);
  if (!logKanali) return;
  const kanal = await guild.channels.fetch(logKanali).catch(() => null);
  if (!kanal?.isTextBased()) return;

  const embed = new EmbedBuilder().setTitle(baslik).setColor(renk).setTimestamp();
  if (hedef) embed.addFields({ name: 'Kullanıcı', value: `${hedef} (${hedef.id})` });
  embed.addFields({ name: 'Yetkili', value: `${yetkili}` });
  if (sebep) embed.addFields({ name: 'Sebep', value: sebep });
  if (ek) embed.addFields(ek);

  await kanal.send({ embeds: [embed] }).catch(() => {});
}

module.exports = { mudahaleEngeli, logGonder };
