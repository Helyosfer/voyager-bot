const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');
const { ayarlariGetir } = require('../depo');
const { icerikOkunabilir } = require('../koruma');
const yapayzeka = require('../yapayzeka');

const MESAJ_SINIRI = 400; // karakter; tek mesajın dökümde kapladığı en fazla yer

// Mesajın modele giden hali: "Ad: içerik" tek satır. Etiketler adlara çevrilir (cleanContent).
function satir(mesaj) {
  const ad = mesaj.member?.displayName ?? mesaj.author.username;
  const metin = mesaj.cleanContent.replace(/\s+/g, ' ').trim();
  const kisa = metin.length > MESAJ_SINIRI ? `${metin.slice(0, MESAJ_SINIRI - 1)}…` : metin;
  return `${ad}: ${[kisa, mesaj.attachments.size ? '[ek dosya]' : null].filter(Boolean).join(' ')}`;
}

module.exports = {
  // Gemini anahtarı ve model adı .env'de yoksa komut yüklenmez
  etkin: () => yapayzeka.hazir(),

  data: new SlashCommandBuilder()
    .setName('ozetle')
    .setDescription('Bu kanaldaki son mesajları yapay zekâyla özetler (özet yanlış olabilir)')
    .addIntegerOption((o) => o.setName('adet').setDescription('Son kaç mesaj? (10-100, varsayılan 50)').setMinValue(10).setMaxValue(100))
    .addBooleanOption((o) => o.setName('paylas').setDescription('Özeti kanala yaz (varsayılan: yalnızca sen görürsün)'))
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const cevapla = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
    const { channel: kanal } = interaction;
    const paylas = interaction.options.getBoolean('paylas') ?? false;

    // Başkalarının mesajları Google'a gönderildiği için sunucu bunu bilerek açmalı
    if (!ayarlariGetir(interaction.guildId).ozetAcik) {
      return cevapla('Özetleme bu sunucuda kapalı. Yöneticiler `/ayarla ozet` ile açabilir.');
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
    const alinan = await kanal.messages.fetch({ limit: interaction.options.getInteger('adet') ?? 50 });
    const mesajlar = [...alinan.values()]
      .filter((m) => !m.author.bot && !m.system && (m.content.trim() || m.attachments.size))
      .reverse(); // Discord yeniden eskiye verir
    if (mesajlar.length < 3) return interaction.editReply('Özetlenecek kadar mesaj yok.');

    const sonuc = await yapayzeka.ozetle(interaction.guildId, interaction.user.id, mesajlar.map(satir), { gizli: !paylas });
    if (sonuc.hata) return interaction.editReply({ content: sonuc.hata, allowedMentions: { parse: [] } });

    return interaction.editReply({
      content: `📝 **${kanal} · son ${sonuc.adet} mesajın özeti**\n${sonuc.cevap}\n-# Yapay zekâ özetidir, yanlış olabilir · bugün kalan hakkın (/sor ile ortak): ${sonuc.kalan}`,
      // Modelin yazdığı hiçbir şey kimseyi etiketleyemez; bağlantı önizlemesi de çıkmaz
      allowedMentions: { parse: [] },
      flags: MessageFlags.SuppressEmbeds,
    });
  },
};
