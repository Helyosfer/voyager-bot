// /ayarlar → Acil kilit: saldırı anında bütün kanalları kilitler, sonra eski haline döndürür.
// Yalnızca Yönetici yetkisi olanlar görür ve kullanır. Saldırı anında hız önemli: onay sorulmaz.
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const kilit = require('../kilit');
const { dugme, satir, ButtonStyle } = require('./arac');

const ID = 'kilit';

function kart(sunucuId) {
  const kilitli = kilit.kilitli(sunucuId);
  return new EmbedBuilder()
    .setTitle(kilitli ? '🔒 Sunucu kilitli' : '🚨 Acil kilit')
    .setColor(kilitli ? 0xed4245 : 0x5865f2)
    .setDescription(
      (kilitli
        ? [
            'Sunucu sahibi dışındaki üyeler yazamaz, tepki ekleyemez, konu açamaz ve ses kanallarına giremez.',
            '• Sunucuya eklenen botlar kendiliğinden atılır.',
            '• **Yönetici** iznine sahip roller Discord kuralı gereği kilitten etkilenmez. Hesabı ele geçirilmiş bir yönetici varsa rolünü elle al.',
            '• Yeni üye girişini durdurmak için Sunucu Ayarları → Davetler bölümünden davetleri duraklat.',
            '',
            'Saldırı bitince **Kilidi aç**: bütün kanallar kilitten önceki haline döner.',
          ]
        : [
            'Saldırı (raid, ele geçirilmiş hesap, spam botları) anında **Sunucuyu kilitle** düğmesine bas:',
            '• Bütün kanallar kilitlenir; sunucu sahibi dışında kimse yazamaz ve sese giremez.',
            '• Ses kanallarındakiler çıkarılır, kilit boyunca eklenen botlar atılır.',
            '• Saldırı onay sorulmadan, hemen durdurulur. Kilit açılınca her şey eski haline döner.',
          ]
      ).join('\n'),
    );
}

async function kapat(interaction) {
  const { guild } = interaction;
  if (kilit.kilitli(guild.id)) return ['🔒 Sunucu zaten kilitli.'];
  const ben = guild.members.me;
  if (!ben.permissions.has(PermissionFlagsBits.ManageRoles) || !ben.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return ['❌ Kilitleyebilmem için bende **Rolleri Yönet** ve **Kanalları Yönet** izinleri olmalı. Sunucu Ayarları → Roller → Voyager bölümünden aç.'];
  }
  const sonuc = await kilit.kilitle(guild, interaction.user);
  if (!sonuc) return ['⏳ Şu an başka bir kilitleme ya da açma işlemi sürüyor (ya da sunucu az önce kilitlendi). Bitmesini bekle.'];
  return [
    `🔒 **${sonuc.kilitlenen} kanal** kilitlendi.`,
    sonuc.cikarilan ? `${sonuc.cikarilan} kişi ses kanallarından çıkarıldı.` : null,
    sonuc.gizlenen ? `${sonuc.gizlenen} kanal, izinleri tek tek kapatılamadığı için kilit boyunca gizlendi.` : null,
    sonuc.basarisiz ? `⚠️ ${sonuc.basarisiz} kanal kilitlenemedi: ${sonuc.sebepler.join(', ')}.` : null,
    sonuc.atlanan.length ? `⚠️ Bende olmadığı için şu izinleri kilitleyemedim: **${sonuc.atlanan.join(', ')}**. Bu izinleri Voyager rolüne verirsen bir sonraki kilit onları da kapsar.` : null,
  ].filter(Boolean);
}

async function ac(interaction) {
  const { guild } = interaction;
  if (!kilit.kilitli(guild.id)) return ['🔓 Sunucu kilitli değil.'];
  const sonuc = await kilit.ac(guild, interaction.user);
  if (!sonuc) return ['⏳ Şu an başka bir kilitleme ya da açma işlemi sürüyor. Bitince yeniden dene.'];
  return [
    sonuc.basarisiz
      ? `⚠️ ${sonuc.acilan} kanal eski haline döndü, **${sonuc.basarisiz} kanal açılamadı** (${sonuc.sebepler.join(', ')}). Sunucu hâlâ kilitli sayılıyor; **Kilidi aç** düğmesine yeniden bas.`
      : `🔓 Kilit açıldı: ${sonuc.acilan} kanal kilitten önceki izinlerine döndü.`,
  ];
}

module.exports = {
  id: ID,
  ad: 'Acil kilit',
  simge: '🚨',
  aciklama: 'Saldırı anında bütün kanalları kilitler (yalnızca Yönetici)',
  // Yönetici yetkisini bot da denetler; sunucu ayarlarından başka rollere açılamaz
  izin: PermissionFlagsBits.Administrator,
  izinAdi: 'Yönetici',
  ozet: (guild) => (kilit.kilitli(guild.id) ? '🔒 Sunucu kilitli' : '🔓 Kilitli değil'),
  ekran(interaction) {
    const kilitli = kilit.kilitli(interaction.guildId);
    return {
      embeds: [kart(interaction.guildId)],
      components: [satir(kilitli ? dugme(ID, 'ac', '🔓 Kilidi aç', ButtonStyle.Success) : dugme(ID, 'kapat', '🔒 Sunucuyu kilitle', ButtonStyle.Danger))],
    };
  },
  ertele: () => true,
  islem(interaction, islem) {
    if (islem === 'kapat') return kapat(interaction);
    if (islem === 'ac') return ac(interaction);
    return [];
  },
};
