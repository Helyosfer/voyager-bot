// /ayarlar → Seviye: sistemi aç/kapat, duyuru kanalı, seviye ödülü rolleri, üye XP'si sıfırlama
const { ChannelSelectMenuBuilder, ChannelType, EmbedBuilder, LabelBuilder, PermissionFlagsBits, RoleSelectMenuBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder } = require('discord.js');
const { ayarlariGetir, ayarKaydet } = require('../depo');
const { rolVermeEngeli, yazabilirMi } = require('../yardimci');
const seviye = require('../seviye');
const { kimlik, dugme, acKapat, satir, form, metinAlani, formMetni, formSecimi, sayi, ButtonStyle } = require('./arac');

const ID = 'seviye';
const ayarCoz = (sunucuId) => seviye.ayarCoz(ayarlariGetir(sunucuId));

function kart(sunucuId) {
  const ayar = ayarCoz(sunucuId);
  return new EmbedBuilder()
    .setTitle('📈 Seviye sistemi')
    .setColor(0x57f287)
    .setDescription(
      [
        `**Durum:** ${ayar.acik ? '🟢 Açık' : '⚫ Kapalı'}`,
        `**Duyuru kanalı:** ${ayar.kanal ? `<#${ayar.kanal}>` : 'mesajın yazıldığı kanal'}`,
        `**Rol ödülleri:** ${ayar.oduller.length ? ayar.oduller.map((o) => `${o.seviye}. seviye → <@&${o.rolId}>`).join(' · ') : 'yok'}`,
        '',
        'Üyeler mesaj yazdıkça XP kazanır (dakikada en fazla bir kez, mesaj başı 15-25 XP). Kazanılan XP sistem kapatılınca silinmez.',
      ].join('\n'),
    );
}

const formlar = {
  odul: () =>
    form(
      ID,
      'odul-form',
      'Seviye ödülü ekle',
      metinAlani('seviye', 'Kaçıncı seviyede?', { enFazla: 3, yerTutucu: 'ör. 10', aciklama: '1 ile 200 arası. O seviyede ödül varsa yenisiyle değişir.' }),
      new LabelBuilder().setLabel('Verilecek rol').setRoleSelectMenuComponent(new RoleSelectMenuBuilder().setCustomId('rol').setMaxValues(1)),
    ),
  sifirla: () =>
    form(
      ID,
      'sifirla-form',
      "Üyenin XP'sini sıfırla",
      new LabelBuilder()
        .setLabel('Üye')
        .setDescription("Seçilen üyenin bütün XP'si silinir.")
        .setUserSelectMenuComponent(new UserSelectMenuBuilder().setCustomId('uye').setMaxValues(1)),
    ),
};

function acKapatIslem(interaction) {
  const sunucuId = interaction.guildId;
  const acik = !ayarCoz(sunucuId).acik;
  ayarKaydet(sunucuId, 'seviyeAcik', acik);
  if (!acik) return ['✅ Seviye sistemi kapatıldı. Kazanılmış XP silinmez; yeniden açınca kaldığı yerden sürer.'];
  const kanal = ayarlariGetir(sunucuId).seviyeKanali;
  return [
    '✅ Seviye sistemi açık. Üyeler mesaj yazdıkça XP kazanır.',
    kanal ? `Seviye atlayanlar <#${kanal}> kanalında duyurulur.` : 'Seviye atlayanlar mesajı yazdıkları kanalda duyurulur; ayrı bir kanal için menüden seç.',
  ];
}

function odulEkle(interaction) {
  const sv = sayi(formMetni(interaction, 'seviye'), 1, 200);
  if (sv === null) return ['❌ Seviye 1 ile 200 arasında bir sayı olmalı.'];
  const rol = formSecimi(interaction, 'rol', 'rol');
  if (!rol) return ['❌ Bir rol seç.'];
  const engel = rolVermeEngeli(interaction, rol, { kime: 'Bu seviyeye ulaşan herkese', amac: 'Rolü ödül yapabilmen' });
  if (engel) return [`❌ ${engel}`];
  const ayar = ayarCoz(interaction.guildId);
  const diger = ayar.oduller.filter((o) => o.seviye !== sv);
  if (diger.length >= seviye.ODUL_SINIRI) return [`❌ En fazla ${seviye.ODUL_SINIRI} ödül olabilir. Önce listeden birini kaldır.`];
  ayarKaydet(interaction.guildId, 'seviyeOdulleri', [...diger, { seviye: sv, rolId: rol.id }].sort((a, b) => a.seviye - b.seviye));
  return [
    `✅ ${sv}. seviyeye ulaşanlara ${rol} rolü verilecek.`,
    'Bu seviyeyi zaten geçmiş üyeler rolü bir sonraki seviye atlayışlarında alır.',
    interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles) ? null : '⚠️ Rol verebilmem için bana Rolleri Yönet iznini ver.',
  ].filter(Boolean);
}

module.exports = {
  id: ID,
  ad: 'Seviye',
  simge: '📈',
  aciklama: 'Mesaj yazdıkça XP, seviye duyurusu ve ödül rolleri',
  ozet(guild) {
    const ayar = ayarCoz(guild.id);
    return ayar.acik ? `🟢 Açık · ${ayar.oduller.length} ödül` : '⚫ Kapalı';
  },
  ekran(interaction) {
    const { guild } = interaction;
    const ayar = ayarCoz(guild.id);
    const kanal = new ChannelSelectMenuBuilder()
      .setCustomId(kimlik(ID, 'kanal'))
      .setPlaceholder('Seviye duyuru kanalı (boş: mesajın yazıldığı kanal)')
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(0)
      .setMaxValues(1);
    if (ayar.kanal && guild.channels?.cache?.has(ayar.kanal)) kanal.setDefaultChannels(ayar.kanal);
    const satirlar = [satir(acKapat(ID, 'durum', '📈 Seviye sistemi', ayar.acik)), satir(kanal)];
    if (ayar.oduller.length) {
      satirlar.push(
        satir(
          new StringSelectMenuBuilder()
            .setCustomId(kimlik(ID, 'odul-sil'))
            .setPlaceholder('Kaldırmak için bir ödül seç')
            .addOptions(ayar.oduller.map((o) => ({ value: String(o.seviye), label: `${o.seviye}. seviye → ${guild.roles?.cache?.get(o.rolId)?.name ?? 'silinmiş rol'}`.slice(0, 100) }))),
        ),
      );
    }
    satirlar.push(satir(dugme(ID, 'odul', '🏅 Ödül ekle', ButtonStyle.Primary), dugme(ID, 'sifirla', "Üyenin XP'sini sıfırla")));
    return { embeds: [kart(guild.id)], components: satirlar };
  },
  form: (interaction, islem) => formlar[islem]?.() ?? null,
  islem(interaction, islem) {
    const sunucuId = interaction.guildId;
    if (islem === 'durum') return acKapatIslem(interaction);
    if (islem === 'kanal') {
      const kanal = interaction.channels?.first();
      ayarKaydet(sunucuId, 'seviyeKanali', kanal?.id ?? null);
      if (!kanal) return ['✅ Seviye atlayanlar artık mesajı yazdıkları kanalda duyurulur.'];
      return [`✅ Seviye atlayanlar ${kanal} kanalında duyurulacak.`, yazabilirMi(kanal) ? null : `⚠️ ${kanal} kanalına yazamıyorum; bana Kanalı Gör ve Mesaj Gönder izni ver.`].filter(Boolean);
    }
    if (islem === 'odul-sil') {
      const sv = Number(interaction.values[0]);
      const ayar = ayarCoz(sunucuId);
      const kalan = ayar.oduller.filter((o) => o.seviye !== sv);
      if (kalan.length === ayar.oduller.length) return [`❌ ${sv}. seviye için bir ödül yok.`];
      ayarKaydet(sunucuId, 'seviyeOdulleri', kalan);
      return [`✅ ${sv}. seviye ödülü kaldırıldı. Rolü almış olanlardan geri alınmaz.`];
    }
    if (islem === 'odul-form') return odulEkle(interaction);
    if (islem === 'sifirla-form') {
      const uye = formSecimi(interaction, 'uye', 'uye');
      if (!uye) return ['❌ Bir üye seç.'];
      return [seviye.sifirla(sunucuId, uye.id) ? `✅ **${uye.tag}** kişisinin XP'si sıfırlandı.` : `❌ **${uye.tag}** henüz XP kazanmamış.`];
    }
    return [];
  },
};
