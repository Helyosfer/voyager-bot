// Kanal özeti: bir mesaja sağ tıklayıp "Buradan özetle" seçilince kanaldaki son mesajlar
// (varsa seçilen mesajdan itibaren, en fazla 50 mesaj) yapay zekâyla özetlenir.
const { ApplicationCommandType, ContextMenuCommandBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { ayarlariGetir } = require('./depo');
const { icerikOkunabilir } = require('./koruma');
const yapayzeka = require('./yapayzeka');

const MESAJ_SINIRI = 400; // karakter; tek mesajın dökümde kapladığı en fazla yer
const VARSAYILAN_ADET = 50;

// Mesajın modele giden hali: "Ad: içerik" tek satır. Etiketler adlara çevrilir (cleanContent).
function satir(mesaj) {
  const ad = mesaj.member?.displayName ?? mesaj.author.username;
  const metin = mesaj.cleanContent.replace(/\s+/g, ' ').trim();
  const kisa = metin.length > MESAJ_SINIRI ? `${metin.slice(0, MESAJ_SINIRI - 1)}…` : metin;
  return `${ad}: ${[kisa, mesaj.attachments.size ? '[ek dosya]' : null].filter(Boolean).join(' ')}`;
}

async function calistir(interaction) {
  const cevapla = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
  const { channel: kanal } = interaction;
  const paylas = interaction.options?.getBoolean?.('paylas') ?? false;

  // Başkalarının mesajları Google'a gönderildiği için sunucu bunu bilerek açmalı
  if (!ayarlariGetir(interaction.guildId).ozetAcik) {
    return cevapla('Özetleme bu sunucuda kapalı. Yöneticiler `/ayarlar` → Günlük bölümünden açabilir.');
  }
  if (!icerikOkunabilir(interaction.client)) {
    return cevapla('❌ Özetleme mesajların metnini okuyabilmeli, ama botta "Message Content Intent" açık değil. Botun sahibi bunu açmalı.');
  }
  if (!kanal?.isTextBased()) return cevapla('❌ Bu kanal özetlenemez.');
  // Kanalda geçmişi okuyamayan, göremediği mesajların özetini bu yoldan alamasın
  const okuma = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory];
  if (!kanal.permissionsFor(interaction.member)?.has(okuma)) {
    return cevapla('❌ Bu kanalın mesaj geçmişini okuma yetkin yok.');
  }
  if (!kanal.permissionsFor(interaction.guild.members.me)?.has(okuma)) {
    return cevapla('❌ Bu kanalın mesaj geçmişini okuyamıyorum. Bana Kanalı Gör ve Mesaj Geçmişini Oku izinlerini ver.');
  }

  // Model birkaç saniyede cevap verir; Discord 3 saniye içinde yanıt bekler
  await interaction.deferReply(paylas ? {} : { flags: MessageFlags.Ephemeral });
  const adet = interaction.options?.getInteger?.('adet') ?? VARSAYILAN_ADET;
  const alinan = await kanal.messages.fetch({ limit: adet });
  let mesajlar = [...alinan.values()]
    .filter((m) => !m.author.bot && !m.system && (m.content.trim() || m.attachments.size))
    .reverse(); // Discord yeniden eskiye verir

  // Sağ tıklanan bir mesaj varsa ve alınan pencerede bulunuyorsa o mesajdan itibaren özetlenir
  const baslangicId = interaction.targetMessage?.id;
  if (baslangicId) {
    const sira = mesajlar.findIndex((m) => m.id === baslangicId);
    if (sira > 0) mesajlar = mesajlar.slice(sira);
  }
  if (mesajlar.length < 3) return interaction.editReply('Özetlenecek kadar mesaj yok.');

  const sonuc = await yapayzeka.ozetle(interaction.guildId, interaction.user.id, mesajlar.map(satir), { gizli: !paylas });
  if (sonuc.hata) return interaction.editReply({ content: sonuc.hata, allowedMentions: { parse: [] } });

  return interaction.editReply({
    content: `📝 **${kanal} · son ${sonuc.adet} mesajın özeti**\n${sonuc.cevap}\n-# Yapay zekâ özetidir, yanlış olabilir · bugün kalan hakkın (/sor ile ortak): ${sonuc.kalan}`,
    // Modelin yazdığı hiçbir şey kimseyi etiketleyemez; bağlantı önizlemesi de çıkmaz
    allowedMentions: { parse: [] },
    flags: MessageFlags.SuppressEmbeds,
  });
}

// Mesaja sağ tık menüsü ("Uygulamalar → Buradan özetle"). Gemini kurulu değilse yüklenmez.
const sagTikKomutu = {
  etkin: () => yapayzeka.hazir(),
  data: new ContextMenuCommandBuilder().setName('Buradan özetle').setType(ApplicationCommandType.Message).setContexts(InteractionContextType.Guild),
  execute: calistir,
};

module.exports = { satir, calistir, execute: calistir, sagTikKomutu };
