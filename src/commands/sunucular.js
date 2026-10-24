const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  InteractionContextType,
  EmbedBuilder,
  MessageFlags,
  escapeMarkdown,
} = require('discord.js');

async function sahipMi(interaction) {
  const uygulama = await interaction.client.application.fetch();
  const sahip = uygulama.owner;
  // Uygulama bir takıma aitse takımın üyeleri de sahip sayılır
  return sahip?.members ? sahip.members.has(interaction.user.id) : sahip?.id === interaction.user.id;
}

module.exports = {
  // Yalnızca .env'deki GUILD_IDS sunucularına yüklenir; diğer sunucularda görünmez.
  sahipKomutu: true,

  data: new SlashCommandBuilder()
    .setName('sunucular')
    .setDescription('Botun bulunduğu sunucuları gösterir ve yönetir (yalnızca bot sahibi)')
    .addSubcommand((s) => s.setName('liste').setDescription('Botun bulunduğu sunucuları listeler'))
    .addSubcommand((s) =>
      s
        .setName('ayril')
        .setDescription('Botu bir sunucudan çıkarır')
        .addStringOption((o) =>
          o.setName('id').setDescription('Sunucu ID (listede yazıyor)').setRequired(true).setMaxLength(25),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const cevapla = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
    // Komut yanlışlıkla başka bir sunucuya yüklenmiş olsa bile sahibinden başkası kullanamasın
    if (!(await sahipMi(interaction))) return cevapla('❌ Bu komutu yalnızca botun sahibi kullanabilir.');

    const sunucular = interaction.client.guilds.cache;

    if (interaction.options.getSubcommand() === 'ayril') {
      const id = interaction.options.getString('id', true).trim();
      const sunucu = sunucular.get(id);
      if (!sunucu) return cevapla('❌ Bot bu ID ile bir sunucuda değil. `/sunucular liste` ile kontrol et.');
      if (id === interaction.guildId) return cevapla('❌ Bu, şu an içinde bulunduğun sunucu. Buradan çıkarmak için botu sunucudan at.');
      await sunucu.leave();
      return cevapla(`✅ Bot **${escapeMarkdown(sunucu.name)}** sunucusundan çıkarıldı.`);
    }

    // Liste: en eski eklenen sunucu en üstte
    const sirali = [...sunucular.values()].sort((a, b) => a.joinedTimestamp - b.joinedTimestamp);
    const satirlar = [];
    let uzunluk = 0;
    for (const s of sirali) {
      const satir = `**${escapeMarkdown(s.name)}** · ${s.memberCount} üye · eklendi: <t:${Math.floor(s.joinedTimestamp / 1000)}:R>\n\`${s.id}\``;
      if (uzunluk + satir.length > 3900) break; // Kart açıklaması en fazla 4096 karakter olabilir
      satirlar.push(satir);
      uzunluk += satir.length + 2;
    }
    const kalan = sirali.length - satirlar.length;
    const embed = new EmbedBuilder()
      .setTitle(`🌐 Voyager ${sirali.length} sunucuda`)
      .setColor(0x5865f2)
      .setDescription(satirlar.join('\n\n') + (kalan ? `\n\n…ve ${kalan} sunucu daha` : ''))
      .setFooter({ text: 'Bir sunucudan çıkarmak için: /sunucular ayril' });
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
