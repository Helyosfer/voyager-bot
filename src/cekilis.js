// Çekilişler: /cekilis formuyla kanala düğmeli bir mesaj konur, üyeler düğmeyle katılır, süre dolunca
// kazananlar rastgele seçilip duyurulur. Yetkililer mesajın altındaki Bitir, Yeniden çek ve İptal
// düğmeleriyle çekilişi yönetir. Bot yeniden başlarsa bekleyen çekilişler kaldığı yerden sürer.
// Kayıt: cekilisler.json → [{ id (mesaj kimliği), sunucuId, kanalId, odul, kazananSayisi, bitis,
//   baslatanId, gerekenRol, katilanlar: [], bitti, kazananlar: [] }]
const crypto = require('node:crypto');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { oku, yaz } = require('./depo');
const { beklemeSayaci, hataMetni, yazabilirMi, logGonder, sureMetni } = require('./yardimci');
const { formMetni, formSecimi, sayi } = require('./ayarlar/arac');

const SUNUCU_BASI_SINIR = 10; // Aynı anda süren çekiliş
const KATILIMCI_SINIRI = 5000;
const EN_UZUN = 14 * 24 * 60; // dakika. setTimeout en fazla ~24 gün bekleyebilir; bu sınır onun altında kalır
const SAKLAMA = 7 * 24 * 60 * 60_000; // Biten çekiliş yeniden çekiliş için bu kadar saklanır
const DUGME = 'ck:katil';
const RENK = 0xeb459e;

const zamanlayicilar = new Map();
const tiklama = beklemeSayaci(1500);

const hepsi = () => oku('cekilisler', []);
const bul = (id) => hepsi().find((c) => c.id === id) ?? null;

// Kaydı değiştirip yazar; degistir(kayit) kaydı yerinde değiştirir. Kayıt yoksa null döner.
function guncelle(id, degistir) {
  const liste = hepsi();
  const kayit = liste.find((c) => c.id === id);
  if (!kayit) return null;
  degistir(kayit);
  yaz('cekilisler', liste);
  return kayit;
}

const suren = (sunucuId) => hepsi().filter((c) => c.sunucuId === sunucuId && !c.bitti);

function kart(c) {
  const embed = new EmbedBuilder()
    .setTitle(c.bitti ? '🎉 Çekiliş bitti' : '🎉 Çekiliş')
    .setColor(c.bitti ? 0x99aab5 : RENK)
    .setDescription(
      [
        `**Ödül:** ${c.odul}`,
        `**Kazanan sayısı:** ${c.kazananSayisi}`,
        c.gerekenRol && `**Katılma şartı:** <@&${c.gerekenRol}> rolü`,
        `**Başlatan:** <@${c.baslatanId}>`,
        c.bitti
          ? `**Kazananlar:** ${c.kazananlar.length ? c.kazananlar.map((k) => `<@${k}>`).join(', ') : 'Kimse katılmadı'}`
          : `**Bitiş:** <t:${Math.floor(c.bitis / 1000)}:R>`,
        c.bitti && `**Katılan:** ${c.katilanlar.length} kişi`,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .setFooter({ text: c.bitti ? 'Çekiliş sona erdi.' : 'Katılmak için düğmeye bas; yeniden basarsan çekilirsin.' });

  const satir = c.bitti
    ? new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ck:yeniden').setLabel('Yeniden çek').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
      )
    : new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(DUGME).setLabel('Katıl').setEmoji('🎉').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('ck:bitir').setLabel('Bitir').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ck:iptal').setLabel('İptal').setStyle(ButtonStyle.Danger),
      );
  return { embeds: [embed], components: [satir], allowedMentions: { parse: [] } };
}

// /cekilis komutu yazılınca açılan oluşturma formu
function baslatFormu() {
  return new ModalBuilder()
    .setCustomId('ck:baslat-form')
    .setTitle('Yeni çekiliş başlat')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Ödül')
        .setTextInputComponent(new TextInputBuilder().setCustomId('odul').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200).setPlaceholder('ör. Discord Nitro')),
      new LabelBuilder()
        .setLabel('Süre (dakika)')
        .setDescription(`1 ile ${EN_UZUN} (14 gün) arası. 1 saat = 60, 1 gün = 1440.`)
        .setTextInputComponent(new TextInputBuilder().setCustomId('dakika').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(5).setPlaceholder('ör. 1440')),
      new LabelBuilder()
        .setLabel('Kazanan sayısı')
        .setDescription('1 ile 20 arası; boş bırakırsan 1.')
        .setTextInputComponent(new TextInputBuilder().setCustomId('kazanan').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(2).setPlaceholder('1')),
      new LabelBuilder()
        .setLabel('Katılma şartı rolü (isteğe bağlı)')
        .setRoleSelectMenuComponent(new RoleSelectMenuBuilder().setCustomId('rol').setMaxValues(1).setRequired(false)),
      new LabelBuilder()
        .setLabel('Kanal (boşsa bu kanal)')
        .setChannelSelectMenuComponent(
          new ChannelSelectMenuBuilder().setCustomId('kanal').setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMaxValues(1).setRequired(false),
        ),
    );
}

// Adaylar arasından, hâlâ sunucuda olan en fazla `adet` kişiyi rastgele seçer
async function sec(guild, adaylar, adet) {
  const kalan = [...adaylar];
  const secilen = [];
  while (secilen.length < adet && kalan.length) {
    const [id] = kalan.splice(crypto.randomInt(kalan.length), 1);
    if (await guild.members.fetch(id).catch(() => null)) secilen.push(id);
  }
  return secilen;
}

async function mesajiBul(client, c) {
  const kanal = await client.channels.fetch(c.kanalId).catch(() => null);
  const mesaj = kanal?.isTextBased() ? await kanal.messages.fetch(c.id).catch(() => null) : null;
  return { kanal, mesaj };
}

async function duyur(kanal, c, kazananlar, yeniden = false) {
  if (!kanal) return;
  const icerik = kazananlar.length
    ? `🎉 ${yeniden ? 'Yeniden çekildi! ' : ''}Tebrikler ${kazananlar.map((k) => `<@${k}>`).join(', ')}! **${c.odul}** kazandın.`
    : `🎉 **${c.odul}** çekilişi bitti, ama ${yeniden ? 'seçilebilecek başka katılımcı kalmadı' : 'kimse katılmadı'}.`;
  await kanal.send({ content: icerik, allowedMentions: { users: kazananlar }, reply: { messageReference: c.id, failIfNotExists: false } }).catch(() => {});
}

// Çekilişi bitirir ve kazananları duyurur. Zaten bittiyse ya da yoksa null döndürür.
async function bitir(client, id) {
  clearTimeout(zamanlayicilar.get(id));
  zamanlayicilar.delete(id);
  // Süre dolması ile Bitir düğmesi aynı anda gelirse yalnızca biri sonuçlansın: önce işaretlenir
  let ilk = false;
  const kayit = guncelle(id, (c) => {
    ilk = !c.bitti;
    c.bitti = true;
  });
  if (!kayit || !ilk) return null;

  const guild = client.guilds.cache.get(kayit.sunucuId);
  const kazananlar = guild ? await sec(guild, kayit.katilanlar, kayit.kazananSayisi) : [];
  const son = guncelle(id, (c) => {
    c.kazananlar = kazananlar;
    c.bitis = Date.now();
  });
  const { kanal, mesaj } = await mesajiBul(client, son);
  await mesaj?.edit(kart(son)).catch(() => {});
  await duyur(kanal, son, kazananlar);
  return son;
}

// Biten çekilişte daha önce kazanmamış katılımcılar arasından yeniden seçer
async function yenidenCek(client, id, adet = 1) {
  const kayit = bul(id);
  if (!kayit?.bitti) return null;
  const guild = client.guilds.cache.get(kayit.sunucuId);
  const yeni = guild ? await sec(guild, kayit.katilanlar.filter((k) => !kayit.kazananlar.includes(k)), adet) : [];
  const son = guncelle(id, (c) => c.kazananlar.push(...yeni));
  const { kanal, mesaj } = await mesajiBul(client, son);
  await mesaj?.edit(kart(son)).catch(() => {});
  await duyur(kanal, son, yeni, true);
  return yeni;
}

async function iptal(client, id) {
  clearTimeout(zamanlayicilar.get(id));
  zamanlayicilar.delete(id);
  const kayit = bul(id);
  if (!kayit) return null;
  yaz('cekilisler', hepsi().filter((c) => c.id !== id));
  const { mesaj } = await mesajiBul(client, kayit);
  await mesaj?.edit({ embeds: [kart(kayit).embeds[0].setTitle('🚫 Çekiliş iptal edildi').setColor(0x99aab5).setFooter(null)], components: [] }).catch(() => {});
  return kayit;
}

function kur(client, c) {
  clearTimeout(zamanlayicilar.get(c.id));
  zamanlayicilar.set(
    c.id,
    setTimeout(() => {
      // Zamanlayıcının içinde yakalanmayan bir hata botu bütün sunucularda kapatır
      bitir(client, c.id).catch((hata) => console.error(`Çekiliş bitirilemedi (${c.id}):`, hataMetni(hata)));
    }, Math.max(c.bitis - Date.now(), 0)),
  );
}

// Saklama süresi geçen bitmiş çekilişler atılır
const guncelleri = (liste) => liste.filter((c) => !c.bitti || Date.now() - c.bitis < SAKLAMA);

function ekle(client, kayit) {
  yaz('cekilisler', [...guncelleri(hepsi()), kayit]);
  kur(client, kayit);
}

// Bot açıldığında süren çekilişleri yeniden kurar
function hepsiniYukle(client) {
  const liste = hepsi();
  const kalan = guncelleri(liste);
  if (kalan.length !== liste.length) yaz('cekilisler', kalan);
  for (const c of kalan) if (!c.bitti) kur(client, c);
}

// Başlatma formunun gönderimi
async function formdanBaslat(interaction) {
  const cevapla = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return cevapla('❌ Çekiliş başlatmak için Sunucuyu Yönet yetkin olmalı.');
  }
  const odul = formMetni(interaction, 'odul');
  if (!odul) return cevapla('❌ Çekiliş ödülünü yaz.');
  const dakika = sayi(formMetni(interaction, 'dakika'), 1, EN_UZUN);
  if (dakika === null) return cevapla(`❌ Süre 1 ile ${EN_UZUN} dakika (14 gün) arasında bir sayı olmalı.`);
  const yazilanKazanan = formMetni(interaction, 'kazanan');
  const kazananSayisi = yazilanKazanan === null ? 1 : sayi(yazilanKazanan, 1, 20);
  if (kazananSayisi === null) return cevapla('❌ Kazanan sayısı 1 ile 20 arasında bir sayı olmalı.');

  const gerekenRol = formSecimi(interaction, 'rol', 'rol');
  const kanal = formSecimi(interaction, 'kanal', 'kanal') ?? interaction.channel;

  if (suren(interaction.guildId).length >= SUNUCU_BASI_SINIR) {
    return cevapla(`❌ Aynı anda en fazla ${SUNUCU_BASI_SINIR} çekiliş sürebilir. Biri bitince yenisini başlatabilirsin.`);
  }
  if (gerekenRol?.id === interaction.guildId) return cevapla('❌ Herkes zaten @everyone rolünde; şart koymak istemiyorsan rol seçme.');
  if (!kanal?.isTextBased() || !yazabilirMi(kanal, [PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory])) {
    return cevapla(`❌ ${kanal ?? 'Bu kanal'} kanalına yazamıyorum. Bana Kanalı Gör, Mesaj Gönder, Bağlantı Yerleştir ve Mesaj Geçmişini Oku izinlerini ver.`);
  }

  const kayit = {
    sunucuId: interaction.guildId,
    kanalId: kanal.id,
    odul,
    kazananSayisi,
    bitis: Date.now() + dakika * 60_000,
    baslatanId: interaction.user.id,
    gerekenRol: gerekenRol?.id ?? null,
    katilanlar: [],
    bitti: false,
    kazananlar: [],
  };
  const mesaj = await kanal.send(kart(kayit));
  ekle(interaction.client, { id: mesaj.id, ...kayit });

  await cevapla(`✅ Çekiliş başladı: ${mesaj.url}\nErken bitirmek, iptal etmek ya da bittikten sonra yeniden çekmek için çekiliş mesajının altındaki düğmeleri kullan.`);
  await logGonder(interaction.guild, {
    baslik: 'Çekiliş başladı',
    renk: RENK,
    yetkili: interaction.user,
    ek: [
      { name: 'Ödül', value: kayit.odul },
      { name: 'Süre', value: sureMetni(dakika), inline: true },
      { name: 'Kazanan', value: String(kayit.kazananSayisi), inline: true },
      { name: 'Kanal', value: `${kanal} · [mesaja git](${mesaj.url})` },
    ],
  });
}

// index.js, customId'si "ck:" ile başlayan etkileşimleri buraya yönlendirir.
async function etkilesim(interaction) {
  if (interaction.isModalSubmit?.() && interaction.customId === 'ck:baslat-form') {
    return formdanBaslat(interaction);
  }
  if (!interaction.isButton()) return;
  const cevapla = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

  if (interaction.customId === DUGME) {
    const anahtar = `${interaction.guildId}:${interaction.user.id}`;
    if (tiklama.bekle(anahtar)) return cevapla('⏳ Biraz yavaş; bir saniye sonra yeniden dene.');
    tiklama.isaretle(anahtar);

    const kayit = bul(interaction.message.id);
    if (!kayit || kayit.bitti) return cevapla('❌ Bu çekiliş bitti.');
    if (kayit.gerekenRol && !interaction.member.roles.cache.has(kayit.gerekenRol)) {
      return cevapla(`❌ Bu çekilişe katılmak için <@&${kayit.gerekenRol}> rolün olmalı.`);
    }

    let durum;
    guncelle(kayit.id, (c) => {
      if (c.katilanlar.includes(interaction.user.id)) {
        c.katilanlar = c.katilanlar.filter((k) => k !== interaction.user.id);
        durum = 'cikti';
      } else if (c.katilanlar.length >= KATILIMCI_SINIRI) {
        durum = 'dolu';
      } else {
        c.katilanlar.push(interaction.user.id);
        durum = 'katildi';
      }
    });
    if (durum === 'dolu') return cevapla(`❌ Çekiliş dolu (en fazla ${KATILIMCI_SINIRI} kişi).`);
    return cevapla(durum === 'katildi' ? '🎉 Çekilişe katıldın. Bol şans!' : '👋 Çekilişten çekildin.');
  }

  // Yetkili düğmeleri: Bitir, Yeniden çek, İptal
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return cevapla('❌ Çekilişi yönetmek için Sunucuyu Yönet yetkin olmalı.');
  }
  const kayit = bul(interaction.message?.id);
  if (!kayit || kayit.sunucuId !== interaction.guildId) return cevapla('❌ Bu sunucuda böyle bir çekiliş yok.');

  if (interaction.customId === 'ck:bitir') {
    if (kayit.bitti) return cevapla('❌ Bu çekiliş zaten bitti.');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const son = await bitir(interaction.client, kayit.id);
    return interaction.editReply(son ? `✅ Çekiliş bitirildi; ${son.kazananlar.length} kazanan duyuruldu.` : '❌ Çekiliş az önce bitti.');
  }
  if (interaction.customId === 'ck:yeniden') {
    if (!kayit.bitti) return cevapla('❌ Çekiliş henüz bitmedi.');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const yeni = await yenidenCek(interaction.client, kayit.id, 1);
    return interaction.editReply(yeni?.length ? `✅ ${yeni.length} yeni kazanan duyuruldu.` : '❌ Seçilebilecek başka katılımcı kalmadı.');
  }
  if (interaction.customId === 'ck:iptal') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await iptal(interaction.client, kayit.id);
    await interaction.editReply('✅ Çekiliş iptal edildi; kimse seçilmedi.');
    await logGonder(interaction.guild, { baslik: 'Çekiliş iptal edildi', renk: 0x99aab5, yetkili: interaction.user, ek: { name: 'Ödül', value: kayit.odul } });
  }
}

module.exports = {
  SUNUCU_BASI_SINIR,
  KATILIMCI_SINIRI,
  EN_UZUN,
  kart,
  baslatFormu,
  bul,
  suren,
  ekle,
  bitir,
  yenidenCek,
  iptal,
  hepsiniYukle,
  etkilesim,
};
