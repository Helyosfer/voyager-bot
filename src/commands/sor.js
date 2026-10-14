const { SlashCommandBuilder, InteractionContextType, MessageFlags, escapeMarkdown } = require('discord.js');
const yapayzeka = require('../yapayzeka');

// Sorunun cevabın üstünde gösterilen hali: tek satır, kısa, biçimlendirmesi kaçırılmış
function alinti(soru) {
  const tekSatir = soru.replace(/\s+/g, ' ').trim();
  return escapeMarkdown(tekSatir.length > 150 ? `${tekSatir.slice(0, 149)}…` : tekSatir, { maskedLink: true });
}

module.exports = {
  // Gemini anahtarı ve model adı .env'de yoksa komut yüklenmez
  etkin: () => yapayzeka.hazir(),

  data: new SlashCommandBuilder()
    .setName('sor')
    .setDescription('Yapay zekâya bir soru sorar (cevaplar yanlış olabilir)')
    .addStringOption((o) => o.setName('soru').setDescription('Sorun').setRequired(true).setMaxLength(yapayzeka.SORU_SINIRI))
    .addBooleanOption((o) => o.setName('gizli').setDescription('Cevabı yalnızca sen gör'))
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const soru = interaction.options.getString('soru', true);
    const gizli = interaction.options.getBoolean('gizli') ?? false;

    // Model birkaç saniyede cevap verir; Discord 3 saniye içinde yanıt bekler
    await interaction.deferReply(gizli ? { flags: MessageFlags.Ephemeral } : {});
    const sonuc = await yapayzeka.sor(interaction.guildId, interaction.user.id, soru, { gizli });
    if (sonuc.hata) return interaction.editReply({ content: sonuc.hata, allowedMentions: { parse: [] } });

    return interaction.editReply({
      content: `> **${alinti(soru)}**\n${sonuc.cevap}\n-# Yapay zekâ cevabı; yanlış olabilir · bugün kalan soru hakkın: ${sonuc.kalan}`,
      // Modelin yazdığı hiçbir şey kimseyi etiketleyemez; bağlantı önizlemesi de çıkmaz
      allowedMentions: { parse: [] },
      flags: MessageFlags.SuppressEmbeds,
    });
  },
};
