// Bot bir sunucuya eklenince atılan tanışma mesajı: botun neler yaptığını ve nereden başlanacağını
// anlatır. Altındaki düğmeler herkes için çalışır ve açtığı paneli yalnızca basan kişi görür:
//   📋 Komut paneli → /yardim paneli (bs:yardim)
//   ⚙️ Ayarlar      → /ayarlar paneli (ay:ac; yetkisi olmayana nedenini söyler)
//   🌐 Site         → YAYIN_ADRESI ayarlıysa botun tanıtım sayfası
// Düğmeler kalıcıdır; mesaj aylar sonra da çalışır.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const panel = require('./komut-paneli');
const { yazabilirMi, hataMetni } = require('./yardimci');

// Sistem kanalı yazılamıyorsa bu adlara benzeyen herkese açık bir kanal seçilir
const ADAY_ADLAR = /genel|general|sohbet|chat|lobi|lobby|main|hosgeldin|hoş-?geldin|welcome/i;

// Mesajın atılacağı kanal: sunucunun sistem kanalı (yeni üye mesajlarının düştüğü kanal), o yoksa
// herkesin görebildiği, adı "genel" gibi olan ilk kanal, o da yoksa herkesin görebildiği ilk kanal.
// Bot yazamıyorsa hiçbiri seçilmez.
function kanalSec(guild) {
  const uygun = (k) => k?.type === ChannelType.GuildText && yazabilirMi(k, [PermissionFlagsBits.EmbedLinks]);
  const herkeseAcik = (k) => k.permissionsFor(guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel) ?? false;
  if (uygun(guild.systemChannel)) return guild.systemChannel;
  // Kanal listesindeki sıra: önce kategorinin, sonra kanalın sırası
  const sira = (k) => [k.parent?.rawPosition ?? -1, k.rawPosition ?? 0];
  const kanallar = [...guild.channels.cache.values()].filter(uygun).sort((a, b) => {
    const [ka, ia] = sira(a);
    const [kb, ib] = sira(b);
    return ka - kb || ia - ib;
  });
  return kanallar.find((k) => herkeseAcik(k) && ADAY_ADLAR.test(k.name)) ?? kanallar.find(herkeseAcik) ?? null;
}

// Komut adı → tıklanabilir komut bağlantısı (Discord'daki kimliği biliniyorsa)
const bagla = (kimlikler, ad) => (kimlikler.has(ad) ? `</${ad}:${kimlikler.get(ad)}>` : `\`/${ad}\``);

// Site adresi yalnızca https ise düğme olur
function siteAdresi() {
  try {
    const adres = new URL(process.env.YAYIN_ADRESI ?? '');
    return adres.protocol === 'https:' ? adres.origin : null;
  } catch {
    return null;
  }
}

function mesaj(client, kimlikler = new Map()) {
  const k = (ad) => bagla(kimlikler, ad);
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('👋 Merhaba, ben Voyager!')
    .setThumbnail(client.user?.displayAvatarURL?.() ?? null)
    .setDescription(
      [
        'Artık bu sunucudayım. Her şeyi menülerden, tıklayarak yapabilirsin; komut ezberlemene gerek yok.',
        '',
        `📋 **Komut paneli** · ${k('yardim')}`,
        'Bütün işler tek yerde: bir bölüm seç, yapmak istediğin işi seç, gerekirse açılan formu doldur.',
        '',
        `⚙️ **Ayarlar** · ${k('ayarlar')}`,
        'Koruma, günlük kanalı, hoş geldin mesajı, seviye sistemi ve bildirimler; aç/kapat düğmeleriyle.',
        '',
        '🛡️ **Tıklayarak moderasyon**',
        'Bir üyeye ya da mesaja sağ tıkla → **Uygulamalar → Moderasyon**: uyar, sustur, at, yasakla, mesajı sil.',
        '',
        `🏗️ **Boş bir sunucu mu?** · ${k('sunucukur')}`,
        'Roller, kanallar, izinler ve destek sistemi hazır şablonla tek seferde kurulur.',
      ].join('\n'),
    )
    .addFields({
      name: '🚀 Yöneticiler için ilk adımlar',
      value: [
        '**1.** Sunucu Ayarları → Roller: **Voyager** rolünü listenin üstlerine taşı.',
        '**2.** **⚙️ Ayarlar → 🛡️ Koruma**: spam ve zararlı bağlantı filtrelerini aç.',
        '**3.** **⚙️ Ayarlar → 📜 Günlük**: olayların yazılacağı bir kanal seç.',
      ].join('\n'),
    })
    .setFooter({ text: 'Komutla çalışmayı seviyorsan hepsi yerinde: / yaz, komutlar listelenir. Düğmelerin açtığı paneli yalnızca basan kişi görür.' });

  const dugmeler = [
    new ButtonBuilder().setCustomId('bs:yardim').setLabel('Komut paneli').setEmoji('📋').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ay:ac').setLabel('Ayarlar').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
  ];
  const site = siteAdresi();
  if (site) dugmeler.push(new ButtonBuilder().setURL(site).setLabel('Site').setEmoji('🌐').setStyle(ButtonStyle.Link));
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(dugmeler)], allowedMentions: { parse: [] } };
}

// Komut kimlikleri /yardim ile paylaşılır (client.komutKimlikleri); alınamazsa komutlar düz yazı olur
async function komutKimlikleri(client) {
  if (client.komutKimlikleri) return client.komutKimlikleri;
  const yuklu = await client.application?.commands.fetch().catch(() => null);
  if (!yuklu) return new Map();
  client.komutKimlikleri = new Map(yuklu.filter((c) => c.type === 1 || c.type === undefined).map((c) => [c.name, c.id]));
  return client.komutKimlikleri;
}

// Sunucuya eklenince (index.js çağırır). Yazacak kanal yoksa sessizce geçer; kayda yazılır.
async function gonder(guild) {
  try {
    const kanal = kanalSec(guild);
    if (!kanal) {
      console.log(`İlk mesaj gönderilmedi (${guild.id}): yazabileceğim herkese açık bir kanal yok`);
      return null;
    }
    return await kanal.send(mesaj(guild.client, await komutKimlikleri(guild.client)));
  } catch (hata) {
    console.error(`İlk mesaj gönderilemedi (${guild.id}):`, hataMetni(hata));
    return null;
  }
}

// "bs:" ile başlayan düğmeler (index.js yollar)
async function etkilesim(interaction) {
  if (interaction.customId === 'bs:yardim') {
    const yardim = interaction.client.komutlar.get('yardim');
    // Düğme, /yardim'ı seçeneksiz yazmış gibi çalışır; panel düğmeye cevap olarak yalnızca basana açılır
    const secenekler = panel.secenekCozucu({ grup: null, alt: null, secenekler: [] }, new Map());
    return yardim.execute(panel.komutEtkilesimi(interaction, 'yardim', secenekler));
  }
  return interaction.reply({ content: '❌ Bu düğme artık kullanılmıyor. `/yardim` yaz.', flags: MessageFlags.Ephemeral });
}

module.exports = { kanalSec, mesaj, gonder, etkilesim };
