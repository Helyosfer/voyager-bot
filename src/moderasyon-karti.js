// Tıklayarak moderasyon: bir üyeye ya da mesaja sağ tıklayıp Uygulamalar → Moderasyon seçilince
// yalnızca seçene görünen bir kart açılır. Kartta üyenin özeti (hesap yaşı, katılma tarihi, uyarıları,
// susturulmuşsa ne zaman biteceği) ve işlem düğmeleri vardır: uyar, sustur, at, yasakla, uyarılarına
// bak; mesajdan açıldıysa mesajı sil.
//
// Düğmeler işi kendileri yapmaz: ilgili komutu (/uyari ver, /sustur, /kick, /ban…) üye seçilmiş olarak
// çalıştırır; sebep ve süre gibi kalan bilgiler form olarak sorulur. Böylece sağ tıklayarak ve yazarak
// yapmak aynı denetimlerden geçer, aynı günlüğe yazılır. Düğme yalnızca o komutu kullanabilene görünür.
//
// Kart kalıcıdır, durum customId'de taşınır:
//   md:i:<işlem>:<kullanıcı>         komut düğmesi; işlem "komut" ya da "komut alt"
//   md:f:<işlem>:<kullanıcı>         gönderilen form
//   md:k:<kullanıcı>                 susturmayı kaldır
//   md:s:<kanal>:<mesaj>             mesajı sil
const {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ContextMenuCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  escapeMarkdown,
} = require('discord.js');
const panel = require('./komut-paneli');
const uyari = require('./uyari');
const { logGonder, hataMetni } = require('./yardimci');

const RENK = 0xeb459e;
const kisalt = (metin, sinir) => (metin.length > sinir ? `${metin.slice(0, sinir - 1)}…` : metin);
const zaman = (ms) => `<t:${Math.floor(ms / 1000)}:R>`;

// Sağ tık menüsündeki komutlar. Ad iki türde aynı olabilir (Discord türe göre ayırır).
const KOMUTLAR = [
  new ContextMenuCommandBuilder()
    .setName('Moderasyon')
    .setType(ApplicationCommandType.User)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild),
  new ContextMenuCommandBuilder()
    .setName('Moderasyon')
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setContexts(InteractionContextType.Guild),
];

// Kart düğmeleri: işlem → komut. uye: üye sunucuda değilse gösterilmez. Etiket ve simge düğmede görünür.
const ISLEMLER = {
  'uyari ver': { simge: '⚠️', ad: 'Uyar', stil: ButtonStyle.Primary, uye: true },
  sustur: { simge: '🔇', ad: 'Sustur', stil: ButtonStyle.Primary, uye: true },
  kick: { simge: '👢', ad: 'At', stil: ButtonStyle.Danger, uye: true },
  ban: { simge: '🔨', ad: 'Yasakla', stil: ButtonStyle.Danger },
  'uyari liste': { simge: '📋', ad: 'Uyarıları', stil: ButtonStyle.Secondary },
  'uyari sil': { simge: '🗑️', ad: 'Uyarı sil', stil: ButtonStyle.Secondary },
};

// Susturma süresi formda yazılmaz, listeden seçilir
const SURELER = [
  { name: '5 dakika', value: 5 },
  { name: '10 dakika', value: 10 },
  { name: '30 dakika', value: 30 },
  { name: '1 saat', value: 60 },
  { name: '3 saat', value: 180 },
  { name: '12 saat', value: 720 },
  { name: '1 gün', value: 1440 },
  { name: '3 gün', value: 4320 },
  { name: '1 hafta', value: 10080 },
  { name: '28 gün (en uzun)', value: 40320 },
];

// İşlemin komutu, alt komutu ve formda sorulacak alanlar (üye zaten seçili olduğundan sorulmaz)
function islemHazirla(client, deger) {
  if (!ISLEMLER[deger]) return null;
  const [komut, alt = null] = deger.split(' ');
  const modul = client.komutlar?.get(komut);
  if (!modul) return null;
  const hedef = panel.hedefBul(modul.data.toJSON(), alt);
  const secenekler = hedef.secenekler
    .filter((o) => o.name !== 'kullanici')
    .map((o) => (komut === 'sustur' && o.name === 'dakika' ? { ...o, description: 'Ne kadar süre susturulsun?', choices: SURELER } : o));
  return { ...ISLEMLER[deger], deger, modul, hedef, alanlar: panel.alanlariHazirla(secenekler) };
}

const dugme = (customId, etiket, stil, simge) => new ButtonBuilder().setCustomId(customId).setLabel(etiket).setStyle(stil).setEmoji(simge);

// Bu kişi kartı açabilir mi? Moderasyon yetkilerinden en az biri gerekir.
const MOD_YETKILERI = [PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers, PermissionFlagsBits.ManageMessages];
const moderatorMu = (interaction) => MOD_YETKILERI.some((y) => interaction.memberPermissions?.has(y));

function kart(interaction, kullanici, uye, mesaj = null) {
  const uyariSayisi = uyari.uyarilar(interaction.guildId, kullanici.id).length;
  const susturmaBitis = uye?.communicationDisabledUntilTimestamp ?? 0;
  const susturulmus = susturmaBitis > Date.now();
  const embed = new EmbedBuilder()
    .setColor(RENK)
    .setAuthor({ name: `${kullanici.tag ?? kullanici.username} · Moderasyon`, iconURL: kullanici.displayAvatarURL?.() })
    .setDescription(
      [
        `${kullanici} · \`${kullanici.id}\`${kullanici.bot ? ' · 🤖 bot' : ''}`,
        uye ? null : '⚠️ Bu kullanıcı sunucuda değil; yalnızca yasaklanabilir.',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .addFields(
      { name: 'Hesap açılışı', value: kullanici.createdTimestamp ? zaman(kullanici.createdTimestamp) : '-', inline: true },
      { name: 'Sunucuya katılış', value: uye?.joinedTimestamp ? zaman(uye.joinedTimestamp) : '-', inline: true },
      { name: 'Uyarılar', value: String(uyariSayisi), inline: true },
    );
  if (susturulmus) embed.addFields({ name: 'Susturma', value: `🔇 Susturulmuş · ${zaman(susturmaBitis)} bitiyor` });
  if (mesaj) {
    const metin = mesaj.content ? `> ${kisalt(escapeMarkdown(mesaj.content), 400).replace(/\n/g, '\n> ')}` : '*Metin yok ya da görünmüyor.*';
    const ekler = mesaj.attachments?.size ? `\n📎 ${mesaj.attachments.size} ek` : '';
    embed.addFields({ name: 'Mesaj', value: kisalt(`${metin}${ekler}\n[Mesaja git](${mesaj.url})`, 1024) });
  }
  embed.setFooter({ text: 'Bir düğmeye bas; sebep ve süre form olarak sorulur. Yaptıkların günlüğe yazılır.' });

  // Düğmeler: yalnızca bu kişinin kullanabildiği komutlar
  const komutlar = interaction.client.komutlar;
  const kullanabilir = (deger) => panel.calistirilabilir(interaction, komutlar?.get(deger.split(' ')[0]));
  const goster = (deger) => (!ISLEMLER[deger].uye || uye) && kullanabilir(deger);
  const isDugmesi = (deger) => dugme(`md:i:${deger}:${kullanici.id}`, ISLEMLER[deger].ad, ISLEMLER[deger].stil, ISLEMLER[deger].simge);

  const ust = [];
  if (!kullanici.bot && goster('uyari ver')) ust.push(isDugmesi('uyari ver'));
  if (goster('sustur')) ust.push(susturulmus ? dugme(`md:k:${kullanici.id}`, 'Susturmayı kaldır', ButtonStyle.Success, '🔊') : isDugmesi('sustur'));
  for (const d of ['kick', 'ban']) if (goster(d)) ust.push(isDugmesi(d));
  const alt = [];
  if (uyariSayisi && goster('uyari liste')) alt.push(isDugmesi('uyari liste'));
  if (uyariSayisi && goster('uyari sil')) alt.push(isDugmesi('uyari sil'));
  if (mesaj && mesaj.channel?.permissionsFor?.(interaction.member)?.has(PermissionFlagsBits.ManageMessages)) {
    alt.push(dugme(`md:s:${mesaj.channelId}:${mesaj.id}`, 'Mesajı sil', ButtonStyle.Danger, '🗑️'));
  }
  const components = [ust, alt].filter((s) => s.length).map((s) => new ActionRowBuilder().addComponents(s));
  return { embeds: [embed], components, allowedMentions: { parse: [] } };
}

// Sağ tık menüsünden açılış
async function ac(interaction) {
  if (!moderatorMu(interaction)) {
    return interaction.reply({ content: '❌ Bunun için moderasyon yetkin olmalı.', flags: MessageFlags.Ephemeral });
  }
  const mesaj = interaction.isMessageContextMenuCommand?.() ? interaction.targetMessage : null;
  const kullanici = mesaj ? mesaj.author : interaction.targetUser;
  // Web kancasıyla gelen mesajın yazarı gerçek bir üye değildir; yalnızca mesaj silinebilir
  const uye = mesaj?.webhookId ? null : await interaction.guild.members.fetch(kullanici.id).catch(() => null);
  const icerik = kart(interaction, kullanici, uye, mesaj);
  if (!icerik.components.length) icerik.content = 'ℹ️ Bu kişiye yapabileceğin bir işlem yok.';
  return interaction.reply({ ...icerik, flags: MessageFlags.Ephemeral });
}

const gizli = (interaction, content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

async function mesajSil(interaction, kanalId, mesajId) {
  const kanal = interaction.guild.channels.cache.get(kanalId) ?? (await interaction.guild.channels.fetch(kanalId).catch(() => null));
  if (!kanal?.isTextBased?.()) return gizli(interaction, '❌ Kanal bulunamadı.');
  if (!kanal.permissionsFor(interaction.member)?.has(PermissionFlagsBits.ManageMessages)) return gizli(interaction, '❌ Bu kanalda mesaj silme yetkin yok.');
  const mesaj = await kanal.messages.fetch(mesajId).catch(() => null);
  if (!mesaj) return gizli(interaction, '❌ Mesaj bulunamadı; silinmiş olabilir.');
  if (!mesaj.deletable) return gizli(interaction, `❌ Bu mesajı silemiyorum. Bana ${kanal} kanalında Mesajları Yönet izni ver.`);
  await mesaj.delete();
  await gizli(interaction, '🗑️ Mesaj silindi.');
  await logGonder(interaction.guild, {
    baslik: 'Mesaj silindi',
    renk: 0x5865f2,
    hedef: mesaj.author,
    yetkili: interaction.user,
    // Mesajın metni burada yazılmaz; sunucu silinen mesajların günlüğünü kapattıysa bu yoldan da görünmesin
    ek: [{ name: 'Kanal', value: `${kanal}` }],
  });
}

// "md:" ile başlayan düğmeler ve formlar (index.js yollar)
async function etkilesim(interaction) {
  const [, tur, ...kalan] = interaction.customId.split(':');
  if (tur === 's') return mesajSil(interaction, kalan[0], kalan[1]);

  const kullaniciId = kalan.at(-1);
  if (!/^\d{15,22}$/.test(kullaniciId ?? '')) return gizli(interaction, '❌ Bu kart eski. Üyeye yeniden sağ tıkla.');
  const kullanici = await interaction.client.users.fetch(kullaniciId).catch(() => null);
  if (!kullanici) return gizli(interaction, '❌ Kullanıcı bulunamadı.');

  if (tur === 'k') {
    const islem = islemHazirla(interaction.client, 'sustur');
    return panel.calistir(interaction, islem.modul, islem.hedef, new Map([['kullanici', kullanici], ['dakika', 0]]));
  }

  const islem = islemHazirla(interaction.client, kalan.slice(0, -1).join(':'));
  if (!islem) return gizli(interaction, '❌ Bu kart eski. Üyeye yeniden sağ tıkla.');
  // Yetki panel.calistir'da da denetlenir; form açılmadan önce de bakılır ki boşuna doldurulmasın
  if (!panel.calistirilabilir(interaction, islem.modul)) return gizli(interaction, '❌ Bunu yapmak için gereken yetkin yok.');

  if (tur === 'i') {
    if (!islem.alanlar.length) return panel.calistir(interaction, islem.modul, islem.hedef, new Map([['kullanici', kullanici]]));
    const baslik = `${islem.simge} ${islem.ad}: ${kullanici.username}`;
    const form = await panel.formKur({ interaction, komut: islem.modul, hedef: islem.hedef, alanlar: islem.alanlar, customId: `md:f:${islem.deger}:${kullanici.id}`, baslik });
    return interaction.showModal(form);
  }
  if (tur === 'f') {
    const { degerler, hatalar } = panel.formuOku(interaction, islem.alanlar);
    if (hatalar.length) return gizli(interaction, `❌ ${hatalar.join('\n')}\nDüğmeye yeniden basıp formu düzelterek gönder.`);
    degerler.set('kullanici', kullanici);
    return panel.calistir(interaction, islem.modul, islem.hedef, degerler);
  }
  console.error('Moderasyon kartı: bilinmeyen işlem', hataMetni(interaction.customId));
  return gizli(interaction, '❌ Bu kart eski. Üyeye yeniden sağ tıkla.');
}

module.exports = { KOMUTLAR, ISLEMLER, SURELER, kart, ac, etkilesim };
