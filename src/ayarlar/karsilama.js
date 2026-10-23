// /ayarlar → Karşılama: yeni üyelere hoş geldin mesajının atılacağı kanal ve otomatik verilecek rol
const { ChannelSelectMenuBuilder, ChannelType, EmbedBuilder, RoleSelectMenuBuilder } = require('discord.js');
const { ayarlariGetir, ayarKaydet } = require('../depo');
const { yazabilirMi, otoRolEngeli } = require('../yardimci');
const { kimlik, satir } = require('./arac');

const ID = 'karsilama';

function kart(sunucuId) {
  const a = ayarlariGetir(sunucuId);
  return new EmbedBuilder()
    .setTitle('👋 Karşılama')
    .setColor(0x5865f2)
    .setDescription(
      [
        `**Hoş geldin kanalı:** ${a.hosgeldinKanali ? `<#${a.hosgeldinKanali}>` : 'ayarlanmadı (mesaj atılmaz)'}`,
        `**Oto rol:** ${a.otoRol ? `<@&${a.otoRol}>` : 'yok'}`,
        '',
        'Yeni üye katılınca hoş geldin kanalına bir karşılama mesajı atılır ve oto rol verilir.',
      ].join('\n'),
    )
    .setFooter({ text: 'Bir menüyü boşaltırsan o ayar kalkar' });
}

module.exports = {
  id: ID,
  ad: 'Karşılama',
  simge: '👋',
  aciklama: 'Yeni üyelere hoş geldin mesajı ve otomatik rol',
  ozet(guild) {
    const a = ayarlariGetir(guild.id);
    const parca = [a.hosgeldinKanali && `<#${a.hosgeldinKanali}>`, a.otoRol && `<@&${a.otoRol}>`].filter(Boolean);
    return parca.length ? `🟢 ${parca.join(' · ')}` : '⚫ Kapalı';
  },
  ekran(interaction) {
    const { guild } = interaction;
    const a = ayarlariGetir(guild.id);
    const kanal = new ChannelSelectMenuBuilder()
      .setCustomId(kimlik(ID, 'kanal'))
      .setPlaceholder('Hoş geldin kanalı (boş: mesaj atılmaz)')
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(0)
      .setMaxValues(1);
    if (a.hosgeldinKanali && guild.channels?.cache?.has(a.hosgeldinKanali)) kanal.setDefaultChannels(a.hosgeldinKanali);
    const rol = new RoleSelectMenuBuilder().setCustomId(kimlik(ID, 'rol')).setPlaceholder('Yeni üyelere verilecek rol (boş: yok)').setMinValues(0).setMaxValues(1);
    if (a.otoRol && guild.roles?.cache?.has(a.otoRol)) rol.setDefaultRoles(a.otoRol);
    return { embeds: [kart(guild.id)], components: [satir(kanal), satir(rol)] };
  },
  islem(interaction, islem) {
    const sunucuId = interaction.guildId;
    if (islem === 'kanal') {
      const kanal = interaction.channels?.first();
      if (!kanal) {
        ayarKaydet(sunucuId, 'hosgeldinKanali', null);
        return ['✅ Hoş geldin mesajı kapatıldı.'];
      }
      if (!yazabilirMi(kanal)) return [`❌ ${kanal} kanalına yazamıyorum. Bana orada Kanalı Görüntüle ve Mesaj Gönder izinlerini ver.`];
      ayarKaydet(sunucuId, 'hosgeldinKanali', kanal.id);
      return [`✅ Hoş geldin kanalı ${kanal} olarak ayarlandı.`];
    }
    if (islem === 'rol') {
      const rol = interaction.roles?.first();
      if (!rol) {
        ayarKaydet(sunucuId, 'otoRol', null);
        return ['✅ Oto rol kaldırıldı.'];
      }
      const engel = otoRolEngeli(interaction, rol);
      if (engel) return [`❌ ${engel}`];
      ayarKaydet(sunucuId, 'otoRol', rol.id);
      return [`✅ Yeni üyelere ${rol} rolü verilecek.`];
    }
    return [];
  },
};
