// Moderasyon: üyeye sağ tıklayınca ("Moderasyon") ya da /mod uye ile açılan kart ve /mod alt komutları.
//
// Kart yalnızca açan yetkiliye görünür. Kartta üyenin susturma durumu ve uyarıları yazar; yetkili kendi
// izinlerine göre Uyar, Sustur, Susturmayı kaldır, At, Yasakla düğmelerini ve uyarı silme menüsünü görür.
// Cezalar kanala da duyurulur ve günlüğe yazılır. customId: "md:<işlem>:<kullanıcıId>".
const {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ContextMenuCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  RESTJSONErrorCodes,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { mudahaleEngeli, logGonder, sureMetni } = require('./yardimci');
const { temizlemeBildir } = require('./gunluk');
const uyari = require('./uyari');
const { formMetni, sayi } = require('./ayarlar/arac');

const RENK = 0xfee75c;
const LISTE_SINIRI = 15; // Kartta en son bu kadar uyarı gösterilir
const SEBEP_SINIRI = 200; // Listede sebebin gösterilen kısmı (tamamı günlükte)
const MODERASYON_IZINLERI = [
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.ManageMessages,
];

const kimlik = (islem, hedefId) => `md:${islem}:${hedefId}`;
const gizli = (interaction, icerik) =>
  interaction.reply({ ...(typeof icerik === 'string' ? { content: icerik } : icerik), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

// Kanala herkese açık ceza bildirimi gönderir (etkileşim kartın kendisi olduğu için kanala ayrıca yazılır)
async function kanalaDuyur(interaction, content) {
  if (!interaction.channel?.send) return;
  await interaction.channel.send({ content, allowedMentions: { parse: [] } }).catch(() => {});
}

// Sunucu üyesini alır; yalnızca "üye yok" cevabı sunucuda olmayan kullanıcı sayılır.
// Başka bir hatada (Discord arızası, zaman aşımı) rol denetimi atlanıp üstteki biri yasaklanmasın.
const uyeGetir = (guild, id) =>
  guild.members.fetch(id).catch((hata) => (hata.code === RESTJSONErrorCodes.UnknownMember ? null : Promise.reject(hata)));

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

// --- Moderasyon kartı ---
function uyariSatirlari(kayitlar) {
  if (!kayitlar.length) return 'Uyarı kaydı yok.';
  const satirlar = [];
  let uzunluk = 0;
  for (let i = kayitlar.length - 1; i >= 0 && satirlar.length < LISTE_SINIRI; i--) {
    const k = kayitlar[i];
    const sebep = k.sebep.length > SEBEP_SINIRI ? `${k.sebep.slice(0, SEBEP_SINIRI - 1)}…` : k.sebep;
    const satir = `**${i + 1}.** ${sebep}\n-# <@${k.yetkiliId}> · <t:${Math.floor(k.zaman / 1000)}:R>`;
    if (uzunluk + satir.length + 1 > 3500) break;
    satirlar.unshift(satir);
    uzunluk += satir.length + 1;
  }
  return satirlar.join('\n');
}

function kart(interaction, hedef, uye, satirlar = []) {
  const kayitlar = uyari.uyarilar(interaction.guildId, hedef.id);
  const izinler = interaction.memberPermissions;
  const susturmaSonu = uye?.communicationDisabledUntilTimestamp;
  const susturulmus = Boolean(susturmaSonu && susturmaSonu > Date.now());
  const durum = [
    uye ? 'Sunucuda' : 'Sunucuda değil',
    susturulmus ? `🔇 Susturulmuş (<t:${Math.floor(susturmaSonu / 1000)}:R> biter)` : null,
    `${kayitlar.length} uyarı`,
  ]
    .filter(Boolean)
    .join(' · ');

  const embed = new EmbedBuilder()
    .setTitle(`🛡️ ${hedef.tag ?? hedef.username ?? hedef.id}`)
    .setColor(RENK)
    .setDescription([`**Kullanıcı:** <@${hedef.id}> (\`${hedef.id}\`) · ${durum}`, '', uyariSatirlari(kayitlar)].join('\n'));
  if (kayitlar.length > LISTE_SINIRI) embed.setFooter({ text: `Son ${LISTE_SINIRI} uyarı gösteriliyor.` });

  const bilesenler = [];
  const dugmeler = [
    uye && !hedef.bot && izinler?.has(PermissionFlagsBits.ModerateMembers) &&
      new ButtonBuilder().setCustomId(kimlik('uyar', hedef.id)).setLabel('⚠️ Uyar').setStyle(ButtonStyle.Primary),
    uye && izinler?.has(PermissionFlagsBits.ModerateMembers) &&
      new ButtonBuilder().setCustomId(kimlik('sustur', hedef.id)).setLabel('🔇 Sustur').setStyle(ButtonStyle.Secondary),
    susturulmus && izinler?.has(PermissionFlagsBits.ModerateMembers) &&
      new ButtonBuilder().setCustomId(kimlik('sustur-ac', hedef.id)).setLabel('🔊 Susturmayı kaldır').setStyle(ButtonStyle.Success),
    uye && izinler?.has(PermissionFlagsBits.KickMembers) &&
      new ButtonBuilder().setCustomId(kimlik('at', hedef.id)).setLabel('👢 At').setStyle(ButtonStyle.Secondary),
    izinler?.has(PermissionFlagsBits.BanMembers) &&
      new ButtonBuilder().setCustomId(kimlik('yasakla', hedef.id)).setLabel('🔨 Yasakla').setStyle(ButtonStyle.Danger),
  ].filter(Boolean);
  if (dugmeler.length) bilesenler.push(new ActionRowBuilder().addComponents(dugmeler));

  if (kayitlar.length && izinler?.has(PermissionFlagsBits.ModerateMembers)) {
    const secenekler = kayitlar
      .map((k, i) => ({
        value: String(i + 1),
        label: `${i + 1}. uyarı: ${k.sebep}`.slice(0, 100),
      }))
      .slice(-25);
    bilesenler.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId(kimlik('uyari-sil', hedef.id)).setPlaceholder('Silmek için bir uyarı seç').addOptions(secenekler),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(kimlik('uyari-temizle', hedef.id)).setLabel(`🗑️ Tüm uyarıları sil (${kayitlar.length})`).setStyle(ButtonStyle.Secondary),
      ),
    );
  }

  const content = satirlar.filter(Boolean).join('\n').slice(0, 2000) || null;
  return { content, embeds: [embed], components: bilesenler, allowedMentions: { parse: [] } };
}

// Sağ tık menüsü ya da /mod uye: moderasyon kartını açar
async function kartAc(interaction, hedef) {
  if (!interaction.memberPermissions?.any(MODERASYON_IZINLERI)) {
    return gizli(interaction, '❌ Moderasyon kartını açmak için susturma, atma ya da yasaklama yetkin olmalı.');
  }
  const uye = await uyeGetir(interaction.guild, hedef.id);
  const m = kart(interaction, hedef, uye);
  return interaction.reply({ ...m, content: undefined, flags: MessageFlags.Ephemeral });
}

// --- Formlar ---
function sebepAlani(etiket, zorunlu = false) {
  const kutu = new TextInputBuilder().setCustomId('sebep').setStyle(TextInputStyle.Short).setRequired(zorunlu).setMaxLength(400);
  return new LabelBuilder().setLabel(etiket).setTextInputComponent(kutu);
}

function islemFormu(islem, hedefId) {
  if (islem === 'uyar') {
    return new ModalBuilder()
      .setCustomId(kimlik('uyar-form', hedefId))
      .setTitle('Üyeyi uyar')
      .addLabelComponents(sebepAlani('Uyarı sebebi (üyeye de gönderilir)', true));
  }
  if (islem === 'sustur') {
    const sure = new TextInputBuilder().setCustomId('dakika').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(5).setPlaceholder('ör. 60 (0 = kaldır)');
    return new ModalBuilder()
      .setCustomId(kimlik('sustur-form', hedefId))
      .setTitle('Üyeyi sustur')
      .addLabelComponents(
        new LabelBuilder().setLabel('Süre (dakika)').setDescription('1 ile 40320 (28 gün) arası; 0 susturmayı kaldırır.').setTextInputComponent(sure),
        sebepAlani('Sebep (isteğe bağlı)'),
      );
  }
  if (islem === 'at') {
    return new ModalBuilder().setCustomId(kimlik('at-form', hedefId)).setTitle('Üyeyi sunucudan at').addLabelComponents(sebepAlani('Atılma sebebi (isteğe bağlı)'));
  }
  if (islem === 'yasakla') {
    return new ModalBuilder().setCustomId(kimlik('yasakla-form', hedefId)).setTitle('Kullanıcıyı yasakla').addLabelComponents(sebepAlani('Yasaklama sebebi (isteğe bağlı)'));
  }
  return null;
}

// --- Moderasyon işlemleri (hem karttan hem /mod ve doğrudan çağrılardan kullanılır) ---
async function uyarIslem(interaction, hedef, sebep, { kanala = false } = {}) {
  const uye = await uyeGetir(interaction.guild, hedef.id);
  if (!uye) return { hata: '❌ Bu kullanıcı sunucuda değil.' };
  if (hedef.bot || uye.user?.bot) return { hata: '❌ Botlara uyarı verilmez.' };
  const engel = mudahaleEngeli(interaction, uye);
  if (engel) return { hata: `❌ ${engel}` };

  const kullanici = uye.user ?? hedef;
  const liste = uyari.ekle(interaction.guildId, kullanici.id, { id: interaction.id, sebep, yetkiliId: interaction.user.id, zaman: Date.now() });
  const adet = liste.length;

  // Atılmadan ya da yasaklanmadan önce haber verilir; sonra sunucuyla ortak kanalı kalmaz.
  const ulasti = await kullanici
    .send?.({ content: `⚠️ **${interaction.guild.name}** sunucusunda uyarı aldın (toplam ${adet}).\nSebep: ${sebep}`, allowedMentions: { parse: [] } })
    .then(() => true, () => false);

  const kural = uyari.tetiklenen(interaction.guildId, adet);
  const sonuc = kural ? await kuraliUygula(interaction, uye, kural) : null;

  const duyuru = [
    `⚠️ **${kullanici.tag}** uyarıldı (toplam ${adet} uyarı). Sebep: ${sebep}`,
    sonuc && `🤖 Otomatik işlem (${uyari.kuralMetni(kural)}): ${sonuc}`,
  ]
    .filter(Boolean)
    .join('\n');
  if (kanala) await kanalaDuyur(interaction, duyuru);

  const satirlar = [duyuru, ulasti === false && 'ℹ️ Üyeye özel mesaj gönderilemedi (özel mesajları kapalı olabilir).'].filter(Boolean);
  await logGonder(interaction.guild, {
    baslik: 'Üye uyarıldı',
    renk: RENK,
    hedef: kullanici,
    yetkili: interaction.user,
    sebep,
    ek: [{ name: 'Uyarı sayısı', value: String(adet) }, ...(sonuc ? [{ name: 'Otomatik işlem', value: sonuc }] : [])],
  });
  return { satirlar, uye: kural && (kural.islem === 'at' || kural.islem === 'yasakla') ? null : uye };
}

async function susturIslem(interaction, hedef, dakika, sebep = 'Sebep belirtilmedi', { kanala = false } = {}) {
  const uye = await uyeGetir(interaction.guild, hedef.id);
  if (!uye) return { hata: '❌ Bu kullanıcı sunucuda değil.' };
  const engel = mudahaleEngeli(interaction, uye);
  if (engel) return { hata: `❌ ${engel}` };
  if (!uye.moderatable) return { hata: '❌ Bu üyeyi susturamıyorum (yönetici olabilir).' };

  const kullanici = uye.user ?? hedef;
  await uye.timeout(dakika === 0 ? null : dakika * 60_000, `${interaction.user.tag}: ${sebep}`);
  const metin = dakika === 0 ? `🔊 **${kullanici.tag}** artık susturulmuş değil.` : `🔇 **${kullanici.tag}** ${dakika} dakika susturuldu. Sebep: ${sebep}`;
  if (kanala) await kanalaDuyur(interaction, metin);
  await logGonder(interaction.guild, {
    baslik: dakika === 0 ? 'Susturma kaldırıldı' : 'Üye susturuldu',
    renk: 0xeb459e,
    hedef: kullanici,
    yetkili: interaction.user,
    sebep,
    ek: dakika === 0 ? null : { name: 'Süre', value: `${dakika} dakika` },
  });
  return { satirlar: [metin], uye };
}

async function atIslem(interaction, hedef, sebep = 'Sebep belirtilmedi', { kanala = false } = {}) {
  const uye = await uyeGetir(interaction.guild, hedef.id);
  if (!uye) return { hata: '❌ Bu kullanıcı sunucuda değil.' };
  const engel = mudahaleEngeli(interaction, uye);
  if (engel) return { hata: `❌ ${engel}` };

  const kullanici = uye.user ?? hedef;
  await uye.kick(`${interaction.user.tag}: ${sebep}`);
  const metin = `👢 **${kullanici.tag}** sunucudan atıldı. Sebep: ${sebep}`;
  if (kanala) await kanalaDuyur(interaction, metin);
  await logGonder(interaction.guild, { baslik: 'Üye atıldı', renk: RENK, hedef: kullanici, yetkili: interaction.user, sebep });
  return { satirlar: [metin], uye: null };
}

async function yasaklaIslem(interaction, hedef, sebep = 'Sebep belirtilmedi', { kanala = false } = {}) {
  const uye = await uyeGetir(interaction.guild, hedef.id);
  const engel = mudahaleEngeli(interaction, uye);
  if (engel) return { hata: `❌ ${engel}` };

  const kullanici = uye?.user ?? hedef;
  await interaction.guild.members.ban(hedef.id, { reason: `${interaction.user.tag}: ${sebep}` });
  const metin = `🔨 **${kullanici.tag ?? hedef.id}** yasaklandı. Sebep: ${sebep}`;
  if (kanala) await kanalaDuyur(interaction, metin);
  await logGonder(interaction.guild, { baslik: 'Üye yasaklandı', renk: 0xed4245, hedef: kullanici, yetkili: interaction.user, sebep });
  return { satirlar: [metin], uye: null };
}

// --- /mod alt komutları ---
async function yasaklaKomut(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
    return gizli(interaction, '❌ Yasaklamak için Üyeleri Yasakla yetkin olmalı.');
  }
  const hedef = interaction.options.getUser('kullanici', true);
  const sebep = interaction.options.getString('sebep') ?? 'Sebep belirtilmedi';
  const uye = await uyeGetir(interaction.guild, hedef.id);
  const engel = mudahaleEngeli(interaction, uye);
  if (engel) return gizli(interaction, `❌ ${engel}`);

  await interaction.deferReply();
  await interaction.guild.members.ban(hedef.id, { reason: `${interaction.user.tag}: ${sebep}` });
  await interaction.editReply(`🔨 **${hedef.tag}** yasaklandı. Sebep: ${sebep}`);
  await logGonder(interaction.guild, { baslik: 'Üye yasaklandı', renk: 0xed4245, hedef, yetkili: interaction.user, sebep });
}

async function yasakKaldirKomut(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
    return gizli(interaction, '❌ Yasağı kaldırmak için Üyeleri Yasakla yetkin olmalı.');
  }
  const hedef = interaction.options.getUser('kullanici', true);
  const sebep = interaction.options.getString('sebep') ?? 'Sebep belirtilmedi';
  const yasak = await interaction.guild.bans.fetch(hedef.id).catch(() => null);
  if (!yasak) return gizli(interaction, '❌ Bu kullanıcı yasaklı değil.');

  await interaction.deferReply();
  await interaction.guild.members.unban(hedef.id, `${interaction.user.tag}: ${sebep}`);
  await interaction.editReply(`🔓 **${hedef.tag}** kullanıcısının yasağı kaldırıldı. Sebep: ${sebep}`);
  await logGonder(interaction.guild, { baslik: 'Yasak kaldırıldı', renk: 0x57f287, hedef, yetkili: interaction.user, sebep });
}

async function temizleKomut(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
    return gizli(interaction, '❌ Mesajları temizlemek için Mesajları Yönet yetkin olmalı.');
  }
  const adet = interaction.options.getInteger('adet', true);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  // true: Discord 14 günden eski mesajların toplu silinmesine izin vermez, onları atla
  temizlemeBildir(interaction.channelId);
  const silinen = await interaction.channel.bulkDelete(adet, true);
  await interaction.editReply(`🧹 ${silinen.size} mesaj silindi.`);
  await logGonder(interaction.guild, {
    baslik: 'Mesajlar silindi',
    renk: 0x5865f2,
    yetkili: interaction.user,
    ek: [
      { name: 'Kanal', value: `${interaction.channel}` },
      { name: 'Adet', value: `${silinen.size} mesaj` },
    ],
  });
}

// --- Kart etkileşimleri ("md:" öneki) ---
const GEREKEN_IZIN = {
  uyar: [PermissionFlagsBits.ModerateMembers, 'Üyelere Zaman Aşımı Uygula'],
  'uyar-form': [PermissionFlagsBits.ModerateMembers, 'Üyelere Zaman Aşımı Uygula'],
  sustur: [PermissionFlagsBits.ModerateMembers, 'Üyelere Zaman Aşımı Uygula'],
  'sustur-form': [PermissionFlagsBits.ModerateMembers, 'Üyelere Zaman Aşımı Uygula'],
  'sustur-ac': [PermissionFlagsBits.ModerateMembers, 'Üyelere Zaman Aşımı Uygula'],
  'uyari-sil': [PermissionFlagsBits.ModerateMembers, 'Üyelere Zaman Aşımı Uygula'],
  'uyari-temizle': [PermissionFlagsBits.ModerateMembers, 'Üyelere Zaman Aşımı Uygula'],
  at: [PermissionFlagsBits.KickMembers, 'Üyeleri At'],
  'at-form': [PermissionFlagsBits.KickMembers, 'Üyeleri At'],
  yasakla: [PermissionFlagsBits.BanMembers, 'Üyeleri Yasakla'],
  'yasakla-form': [PermissionFlagsBits.BanMembers, 'Üyeleri Yasakla'],
};

async function hedefKullanici(interaction, id) {
  const uye = await uyeGetir(interaction.guild, id);
  if (uye?.user) return { hedef: uye.user, uye };
  const kullanici = await interaction.client.users?.fetch?.(id).catch(() => null);
  return { hedef: kullanici ?? { id, tag: id, toString: () => `<@${id}>` }, uye };
}

async function etkilesim(interaction) {
  const [, islem, hedefId] = interaction.customId.split(':');
  const gereken = GEREKEN_IZIN[islem];
  if (!gereken || !hedefId) return;
  if (!interaction.memberPermissions?.has(gereken[0])) {
    return gizli(interaction, `❌ Bu işlem için **${gereken[1]}** yetkin olmalı.`);
  }

  // Form açacak düğmeler: önce müdahale engeli kontrol edilir, sorun yoksa form açılır
  if (!interaction.isModalSubmit() && ['uyar', 'sustur', 'at', 'yasakla'].includes(islem)) {
    const uye = await uyeGetir(interaction.guild, hedefId);
    if (islem !== 'yasakla' && !uye) return gizli(interaction, '❌ Bu kullanıcı sunucuda değil.');
    if (islem === 'uyar' && uye.user?.bot) return gizli(interaction, '❌ Botlara uyarı verilmez.');
    const engel = mudahaleEngeli(interaction, uye);
    if (engel) return gizli(interaction, `❌ ${engel}`);
    if (islem === 'sustur' && !uye.moderatable) return gizli(interaction, '❌ Bu üyeyi susturamıyorum (yönetici olabilir).');
    return interaction.showModal(islemFormu(islem, hedefId));
  }

  if (interaction.isModalSubmit() && !interaction.isFromMessage()) await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  else await interaction.deferUpdate();

  const { hedef, uye } = await hedefKullanici(interaction, hedefId);
  const guncelle = (satirlar, guncelUye = uye) => interaction.editReply(kart(interaction, hedef, guncelUye, satirlar));

  if (islem === 'uyar-form') {
    const sebep = formMetni(interaction, 'sebep');
    if (!sebep) return guncelle(['❌ Uyarı sebebi yaz.']);
    const sonuc = await uyarIslem(interaction, hedef, sebep, { kanala: true });
    return guncelle(sonuc.hata ? [sonuc.hata] : sonuc.satirlar, sonuc.uye ?? uye);
  }
  if (islem === 'sustur-form') {
    const dakika = sayi(formMetni(interaction, 'dakika'), 0, 40320);
    if (dakika === null) return guncelle(['❌ Süre 0 ile 40320 dakika (28 gün) arasında olmalı.']);
    const sebep = formMetni(interaction, 'sebep') ?? 'Sebep belirtilmedi';
    const sonuc = await susturIslem(interaction, hedef, dakika, sebep, { kanala: true });
    return guncelle(sonuc.hata ? [sonuc.hata] : sonuc.satirlar, sonuc.uye ?? uye);
  }
  if (islem === 'sustur-ac') {
    const sonuc = await susturIslem(interaction, hedef, 0, 'Sebep belirtilmedi', { kanala: true });
    return guncelle(sonuc.hata ? [sonuc.hata] : sonuc.satirlar, sonuc.uye ?? uye);
  }
  if (islem === 'at-form') {
    const sebep = formMetni(interaction, 'sebep') ?? 'Sebep belirtilmedi';
    const sonuc = await atIslem(interaction, hedef, sebep, { kanala: true });
    return guncelle(sonuc.hata ? [sonuc.hata] : sonuc.satirlar, sonuc.hata ? uye : null);
  }
  if (islem === 'yasakla-form') {
    const sebep = formMetni(interaction, 'sebep') ?? 'Sebep belirtilmedi';
    const sonuc = await yasaklaIslem(interaction, hedef, sebep, { kanala: true });
    return guncelle(sonuc.hata ? [sonuc.hata] : sonuc.satirlar, sonuc.hata ? uye : null);
  }
  if (islem === 'uyari-sil') {
    const numara = Number(interaction.values[0]);
    const silinen = uyari.sil(interaction.guildId, hedef.id, numara);
    if (!silinen) return guncelle([`❌ **${hedef.tag}** için ${numara} numaralı uyarı yok.`]);
    await logGonder(interaction.guild, { baslik: 'Uyarı silindi', renk: RENK, hedef, yetkili: interaction.user, sebep: silinen.sebep });
    return guncelle([`🗑️ **${hedef.tag}** kişisinin ${numara}. uyarısı silindi.`]);
  }
  if (islem === 'uyari-temizle') {
    const adet = uyari.temizle(interaction.guildId, hedef.id);
    if (!adet) return guncelle([`✅ **${hedef.tag}** zaten hiç uyarı almamış.`]);
    await logGonder(interaction.guild, {
      baslik: 'Uyarılar temizlendi',
      renk: RENK,
      hedef,
      yetkili: interaction.user,
      ek: { name: 'Silinen', value: `${adet} uyarı` },
    });
    return guncelle([`🗑️ **${hedef.tag}** kişisinin ${adet} uyarısı silindi.`]);
  }
}

// Üyeye sağ tık menüsü ("Uygulamalar → Moderasyon")
const sagTikKomutu = {
  data: new ContextMenuCommandBuilder()
    .setName('Moderasyon')
    .setType(ApplicationCommandType.User)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild),
  execute: (interaction) => kartAc(interaction, interaction.targetUser),
};

module.exports = {
  MODERASYON_IZINLERI,
  kart,
  kartAc,
  uyarIslem,
  susturIslem,
  atIslem,
  yasaklaIslem,
  yasaklaKomut,
  yasakKaldirKomut,
  temizleKomut,
  etkilesim,
  sagTikKomutu,
};
