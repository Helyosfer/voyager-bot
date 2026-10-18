const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, EmbedBuilder, MessageFlags } = require('discord.js');
const { mudahaleEngeli, logGonder, sureMetni } = require('../yardimci');
const uyari = require('../uyari');

const RENK = 0xfee75c;
const LISTE_SINIRI = 15; // /uyari liste en son bu kadar uyarıyı gösterir
const SEBEP_SINIRI = 200; // Listede sebebin gösterilen kısmı (tamamı günlükte)

const kullaniciSecenegi = (aciklama) => (o) => o.setName('kullanici').setDescription(aciklama).setRequired(true);

// Kural eşiğe gelince uygulanan işlem. Sonucu okunur metin olarak döndürür.
async function kuraliUygula(interaction, uye, kural) {
  const { ad, yetki } = uyari.ISLEMLER[kural.islem];
  if (!interaction.memberPermissions?.has(yetki)) {
    return `${ad} uygulanmadı: bunun için senin de bu yetkiye sahip olman gerekir. Yetkisi olan biri elle uygulamalı.`;
  }
  const sebep = `${interaction.user.tag}: ${kural.esik}. uyarı (otomatik)`;
  try {
    if (kural.islem === 'sustur') {
      if (!uye.moderatable) return 'Susturma uygulanamadı: bu üyeyi susturamıyorum.';
      await uye.timeout(kural.dakika * 60_000, sebep);
      return `Üye ${sureMetni(kural.dakika)} susturuldu.`;
    }
    if (kural.islem === 'at') {
      if (!uye.kickable) return 'Atma uygulanamadı: bu üyeyi atamıyorum.';
      await uye.kick(sebep);
      return 'Üye sunucudan atıldı.';
    }
    if (!uye.bannable) return 'Yasaklama uygulanamadı: bu üyeyi yasaklayamıyorum.';
    await interaction.guild.members.ban(uye.id, { reason: sebep });
    return 'Üye yasaklandı.';
  } catch (hata) {
    console.error(`Uyarı kuralı uygulanamadı (${interaction.guildId}):`, hata.message);
    return `${ad} uygulanamadı (Discord isteği reddetti).`;
  }
}

async function ver(interaction) {
  const hedef = interaction.options.getUser('kullanici', true);
  const sebep = interaction.options.getString('sebep', true);
  const uye = await interaction.guild.members.fetch(hedef.id).catch(() => null);
  if (!uye) return interaction.reply({ content: '❌ Bu kullanıcı sunucuda değil.', flags: MessageFlags.Ephemeral });
  if (hedef.bot) return interaction.reply({ content: '❌ Botlara uyarı verilmez.', flags: MessageFlags.Ephemeral });
  const engel = mudahaleEngeli(interaction, uye);
  if (engel) return interaction.reply({ content: `❌ ${engel}`, flags: MessageFlags.Ephemeral });

  // Discord 3 saniye içinde cevap bekler; işlem uzarsa "yanıt vermedi" demesin
  await interaction.deferReply();
  const liste = uyari.ekle(interaction.guildId, hedef.id, { id: interaction.id, sebep, yetkiliId: interaction.user.id, zaman: Date.now() });
  const sayi = liste.length;

  // Atılmadan ya da yasaklanmadan önce haber verilir; sonra sunucuyla ortak kanalı kalmaz.
  // Üye özel mesajları kapatmışsa gönderilemez.
  const ulasti = await hedef
    .send({ content: `⚠️ **${interaction.guild.name}** sunucusunda uyarı aldın (toplam ${sayi}).\nSebep: ${sebep}`, allowedMentions: { parse: [] } })
    .then(() => true, () => false);

  const kural = uyari.tetiklenen(interaction.guildId, sayi);
  const sonuc = kural ? await kuraliUygula(interaction, uye, kural) : null;

  await interaction.editReply(
    [
      `⚠️ **${hedef.tag}** uyarıldı (toplam ${sayi} uyarı). Sebep: ${sebep}`,
      sonuc && `🤖 Otomatik işlem (${uyari.kuralMetni(kural)}): ${sonuc}`,
      !ulasti && 'ℹ️ Üyeye özel mesaj gönderilemedi (özel mesajları kapalı olabilir).',
    ]
      .filter(Boolean)
      .join('\n'),
  );
  await logGonder(interaction.guild, {
    baslik: 'Üye uyarıldı',
    renk: RENK,
    hedef,
    yetkili: interaction.user,
    sebep,
    ek: [{ name: 'Uyarı sayısı', value: String(sayi) }, ...(sonuc ? [{ name: 'Otomatik işlem', value: sonuc }] : [])],
  });
}

function liste(interaction) {
  const hedef = interaction.options.getUser('kullanici', true);
  const kayitlar = uyari.uyarilar(interaction.guildId, hedef.id);
  if (!kayitlar.length) return interaction.reply({ content: `✅ **${hedef.tag}** hiç uyarı almamış.`, flags: MessageFlags.Ephemeral });

  // En yeniden geriye: en fazla LISTE_SINIRI uyarı, Discord'un kutu açıklaması sınırına (4096) sığdığı kadar
  const satirlar = [];
  let uzunluk = 0;
  for (let i = kayitlar.length - 1; i >= 0 && satirlar.length < LISTE_SINIRI; i--) {
    const k = kayitlar[i];
    const sebep = k.sebep.length > SEBEP_SINIRI ? `${k.sebep.slice(0, SEBEP_SINIRI - 1)}…` : k.sebep;
    const satir = `**${i + 1}.** ${sebep}\n-# <@${k.yetkiliId}> · <t:${Math.floor(k.zaman / 1000)}:R>`;
    if (uzunluk + satir.length + 1 > 4000) break;
    satirlar.unshift(satir);
    uzunluk += satir.length + 1;
  }
  const embed = new EmbedBuilder()
    .setTitle(`⚠️ ${hedef.tag} · ${kayitlar.length} uyarı`)
    .setColor(RENK)
    .setDescription(satirlar.join('\n'))
    .setFooter({ text: satirlar.length < kayitlar.length ? `Son ${satirlar.length} uyarı gösteriliyor. Silmek için /uyari sil.` : 'Silmek için /uyari sil.' });
  return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
}

async function sil(interaction) {
  const hedef = interaction.options.getUser('kullanici', true);
  const numara = interaction.options.getInteger('numara', true);
  const silinen = uyari.sil(interaction.guildId, hedef.id, numara);
  if (!silinen) return interaction.reply({ content: `❌ **${hedef.tag}** için ${numara} numaralı uyarı yok. Numaraları \`/uyari liste\` gösterir.`, flags: MessageFlags.Ephemeral });
  await interaction.reply({ content: `🗑️ **${hedef.tag}** kişisinin ${numara}. uyarısı silindi.`, flags: MessageFlags.Ephemeral });
  await logGonder(interaction.guild, { baslik: 'Uyarı silindi', renk: RENK, hedef, yetkili: interaction.user, sebep: silinen.sebep });
}

async function temizle(interaction) {
  const hedef = interaction.options.getUser('kullanici', true);
  const adet = uyari.temizle(interaction.guildId, hedef.id);
  if (!adet) return interaction.reply({ content: `✅ **${hedef.tag}** zaten hiç uyarı almamış.`, flags: MessageFlags.Ephemeral });
  await interaction.reply({ content: `🗑️ **${hedef.tag}** kişisinin ${adet} uyarısı silindi.`, flags: MessageFlags.Ephemeral });
  await logGonder(interaction.guild, {
    baslik: 'Uyarılar temizlendi',
    renk: RENK,
    hedef,
    yetkili: interaction.user,
    ek: { name: 'Silinen', value: `${adet} uyarı` },
  });
}

// Kurallar sunucunun ceza düzenini değiştirdiği için Sunucuyu Yönet ister. Kuralı ekleyen,
// kuralın uyguladığı işlemi kendisi de yapabiliyor olmalı.
function kuralEkle(interaction) {
  const esik = interaction.options.getInteger('esik', true);
  const islem = interaction.options.getString('islem', true);
  const dakika = interaction.options.getInteger('dakika') ?? 60;
  const { ad, yetki } = uyari.ISLEMLER[islem];
  if (!interaction.memberPermissions?.has(yetki)) {
    return interaction.reply({ content: `❌ ${ad} kuralı ekleyebilmek için bu işlemi senin de yapabiliyor olman gerekir.`, flags: MessageFlags.Ephemeral });
  }
  const kural = { esik, islem, ...(islem === 'sustur' ? { dakika } : {}) };
  if (!uyari.kuralEkle(interaction.guildId, kural)) {
    return interaction.reply({ content: `❌ En fazla ${uyari.KURAL_SINIRI} kural olabilir. Önce \`/uyari kural-sil\` ile birini kaldır.`, flags: MessageFlags.Ephemeral });
  }
  const izin = { sustur: 'Üyelere Zaman Aşımı Uygula', at: 'Üyeleri At', yasakla: 'Üyeleri Yasakla' }[islem];
  return interaction.reply({
    content: [
      `✅ Kural kaydedildi: ${uyari.kuralMetni(kural)}.`,
      'Kural, üyenin uyarı sayısı tam bu sayıya geldiğinde bir kez uygulanır. Uyarıyı veren yetkili bu işlemi kendisi yapamıyorsa işlem uygulanmaz ve günlüğe yazılır.',
      interaction.guild.members.me.permissions.has(yetki) ? null : `⚠️ Bunun çalışması için bana ${izin} iznini ver.`,
    ]
      .filter(Boolean)
      .join('\n'),
    flags: MessageFlags.Ephemeral,
  });
}

function kuralSil(interaction) {
  const esik = interaction.options.getInteger('esik', true);
  const silindi = uyari.kuralSil(interaction.guildId, esik);
  return interaction.reply({ content: silindi ? `✅ ${esik} uyarı kuralı kaldırıldı.` : `❌ ${esik} uyarı için bir kural yok.`, flags: MessageFlags.Ephemeral });
}

function kurallar(interaction) {
  const liste = uyari.kurallar(interaction.guildId);
  return interaction.reply({
    content: liste.length
      ? `📋 **Uyarı kuralları**\n${liste.map((k) => `• ${uyari.kuralMetni(k)}`).join('\n')}`
      : '📋 Henüz kural yok. Uyarılar yalnızca kaydedilir. Otomatik işlem için `/uyari kural-ekle` kullan.',
    flags: MessageFlags.Ephemeral,
  });
}

const ALT_KOMUTLAR = { ver, liste, sil, temizle, 'kural-ekle': kuralEkle, 'kural-sil': kuralSil, kurallar };
const YONETIM = new Set(['kural-ekle', 'kural-sil']);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('uyari')
    .setDescription('Üyelere kalıcı uyarı verir; uyarı sayısına göre otomatik susturma, atma ya da yasaklama')
    .addSubcommand((s) =>
      s
        .setName('ver')
        .setDescription('Bir üyeye uyarı verir')
        .addUserOption(kullaniciSecenegi('Uyarılacak üye'))
        .addStringOption((o) => o.setName('sebep').setDescription('Uyarı sebebi (üyeye de gönderilir)').setRequired(true).setMaxLength(400)),
    )
    .addSubcommand((s) => s.setName('liste').setDescription('Bir üyenin uyarılarını gösterir').addUserOption(kullaniciSecenegi('Uyarıları gösterilecek üye')))
    .addSubcommand((s) =>
      s
        .setName('sil')
        .setDescription('Bir uyarıyı siler')
        .addUserOption(kullaniciSecenegi('Uyarısı silinecek üye'))
        .addIntegerOption((o) => o.setName('numara').setDescription('/uyari liste\'deki numara').setRequired(true).setMinValue(1).setMaxValue(uyari.KISI_BASI_SINIR)),
    )
    .addSubcommand((s) => s.setName('temizle').setDescription('Bir üyenin bütün uyarılarını siler').addUserOption(kullaniciSecenegi('Uyarıları silinecek üye')))
    .addSubcommand((s) =>
      s
        .setName('kural-ekle')
        .setDescription('Uyarı sayısı eşiğe gelince uygulanacak işlemi belirler (Sunucuyu Yönet gerekir)')
        .addIntegerOption((o) => o.setName('esik').setDescription('Kaçıncı uyarıda?').setRequired(true).setMinValue(1).setMaxValue(uyari.ESIK_SINIRI))
        .addStringOption((o) =>
          o
            .setName('islem')
            .setDescription('Ne yapılsın?')
            .setRequired(true)
            .addChoices({ name: 'Sustur', value: 'sustur' }, { name: 'At', value: 'at' }, { name: 'Yasakla', value: 'yasakla' }),
        )
        .addIntegerOption((o) => o.setName('dakika').setDescription('Susturma kaç dakika? (varsayılan 60)').setMinValue(1).setMaxValue(40320)),
    )
    .addSubcommand((s) =>
      s
        .setName('kural-sil')
        .setDescription('Bir uyarı kuralını kaldırır (Sunucuyu Yönet gerekir)')
        .addIntegerOption((o) => o.setName('esik').setDescription('Kaldırılacak kuralın eşiği').setRequired(true).setMinValue(1).setMaxValue(uyari.ESIK_SINIRI)),
    )
    .addSubcommand((s) => s.setName('kurallar').setDescription('Uyarı kurallarını gösterir'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const alt = interaction.options.getSubcommand();
    if (YONETIM.has(alt) && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: '❌ Kuralları değiştirmek için Sunucuyu Yönet yetkin olmalı.', flags: MessageFlags.Ephemeral });
    }
    return ALT_KOMUTLAR[alt](interaction);
  },
};
