// Çekilişler: /cekilis ile kanala düğmeli bir mesaj konur, üyeler düğmeyle katılır, süre dolunca
// kazananlar rastgele seçilip duyurulur. Bot yeniden başlarsa bekleyen çekilişler kaldığı yerden sürer.
// Kayıt: cekilisler.json → [{ id (mesaj kimliği), sunucuId, kanalId, odul, kazananSayisi, bitis,
//   baslatanId, gerekenRol, katilanlar: [], bitti, kazananlar: [] }]
const crypto = require('node:crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');
const { oku, yaz } = require('./depo');
const { beklemeSayaci, hataMetni } = require('./yardimci');

const SUNUCU_BASI_SINIR = 10; // Bir sunucuda aynı anda sürebilecek en fazla çekiliş
const KATILIMCI_SINIRI = 5000;
const EN_UZUN = 14 * 24 * 60; // dakika. setTimeout en fazla ~24 gün bekleyebilir; bu sınır onun altında kalır
const SAKLAMA = 7 * 24 * 60 * 60_000; // Biten çekiliş, kazanan yeniden seçilebilsin diye bu kadar süre saklanır
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
  const dugme = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(DUGME).setLabel('Katıl').setEmoji('🎉').setStyle(ButtonStyle.Primary));
  return { embeds: [embed], components: c.bitti ? [] : [dugme], allowedMentions: { parse: [] } };
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
  // Süre dolarken aynı anda /cekilis bitir de gelirse yalnızca biri sonuçlansın: çekiliş önce işaretlenir
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
async function yenidenCek(client, id, adet) {
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

// index.js, customId'si "ck:" ile başlayan etkileşimleri buraya yönlendirir.
async function etkilesim(interaction) {
  if (!interaction.isButton() || interaction.customId !== DUGME) return;
  const cevapla = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
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

module.exports = { SUNUCU_BASI_SINIR, KATILIMCI_SINIRI, EN_UZUN, kart, bul, suren, ekle, bitir, yenidenCek, iptal, hepsiniYukle, etkilesim };
