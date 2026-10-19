const { SlashCommandBuilder, ApplicationCommandOptionType, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

const RENK = 0x5865f2;
const ACIK_KALMA = 5 * 60 * 1000; // Menü bu süre boyunca çalışır

// Yardım sayfaları. Bir komut hiçbir bölümde yoksa "Diğer" sayfasına düşer.
// ilkAdim: alt komutları olan komutlarda nereden başlanacağını gösterir.
const BOLUMLER = [
  {
    id: 'genel',
    simge: '🧭',
    ad: 'Genel',
    ozet: 'Herkesin kullanabildiği komutlar',
    komutlar: ['sor', 'ozetle', 'hatirlat', 'ping', 'yardim'],
  },
  {
    id: 'moderasyon',
    simge: '🛡️',
    ad: 'Moderasyon',
    ozet: 'Üyeleri uyarma, susturma, atma, yasaklama ve mesaj temizleme',
    komutlar: ['uyari', 'sustur', 'kick', 'ban', 'unban', 'temizle'],
    ilkAdim: { uyari: 'ver' },
  },
  {
    id: 'guvenlik',
    simge: '🚨',
    ad: 'Güvenlik',
    ozet: 'Spam ve küfür filtresi, saldırı anında sunucuyu kilitleme',
    komutlar: ['koruma', 'kitle', 'kilidiac'],
    ilkAdim: { koruma: 'spam' },
  },
  {
    id: 'bildirim',
    simge: '📣',
    ad: 'Bildirimler',
    ozet: 'Oyun fırsatları, canlı yayınlar ve haberler kanalına gelsin',
    komutlar: ['oyun', 'yayin', 'haber', 'instagram'],
    ilkAdim: { oyun: 'kanal', yayin: 'kanal', haber: 'kanal', instagram: 'kanal' },
  },
  {
    id: 'topluluk',
    simge: '🎉',
    ad: 'Topluluk',
    ozet: 'Seviyeler ve sıralama, çekilişler, düğmeyle rol alma menüleri',
    komutlar: ['seviye', 'cekilis', 'rolmenu'],
    ilkAdim: { seviye: 'goster', cekilis: 'baslat' },
  },
  {
    id: 'sunucu',
    simge: '⚙️',
    ad: 'Sunucu ayarları',
    ozet: 'Kayıt kanalı, hoş geldin mesajı, otomatik rol ve hazır sunucu kurulumu',
    komutlar: ['ayarla', 'sunucukur'],
    ilkAdim: { ayarla: 'goster' },
  },
];
const DIGER = { id: 'diger', simge: '📦', ad: 'Diğer', ozet: 'Diğer komutlar', komutlar: [] };

// Komut adından Discord kimliğine: tıklanabilir komut bağlantıları için
async function kimlikler(client) {
  if (!client.komutKimlikleri) {
    const yuklu = await client.application.commands.fetch().catch(() => null);
    if (!yuklu) return new Map(); // Alınamazsa düz yazıya dönülür, bir sonraki sefer yeniden denenir
    client.komutKimlikleri = new Map(yuklu.map((k) => [k.name, k.id]));
  }
  return client.komutKimlikleri;
}

// Üyenin kullanabildiği komutlar, bölümlere ayrılmış halde
function bolumleriHazirla(interaction) {
  const komutlar = new Map(
    interaction.client.komutlar
      .filter((k) => !k.sahipKomutu && k.etkin?.() !== false) // Sahibe özel ve kapalı komutlar listelenmez
      .map((k) => k.data.toJSON())
      .filter((k) => !k.default_member_permissions || interaction.memberPermissions?.has(BigInt(k.default_member_permissions)))
      .map((k) => [k.name, k]),
  );
  const yerlesen = new Set(BOLUMLER.flatMap((b) => b.komutlar));
  const diger = { ...DIGER, komutlar: [...komutlar.keys()].filter((ad) => !yerlesen.has(ad)).sort((a, b) => a.localeCompare(b, 'tr')) };
  return [...BOLUMLER, diger]
    .map((b) => ({ ...b, komutlar: b.komutlar.map((ad) => komutlar.get(ad)).filter(Boolean) }))
    .filter((b) => b.komutlar.length);
}

function anaSayfa(interaction, bolumler) {
  const yetkili = bolumler.some((b) => b.id !== 'genel');
  return new EmbedBuilder()
    .setTitle(`${interaction.client.user.username} · Yardım`)
    .setColor(RENK)
    .setThumbnail(interaction.client.user.displayAvatarURL())
    .setDescription(
      [
        'Aşağıdaki menüden bir bölüm seç; o bölümdeki komutları ve ne işe yaradıklarını gösteririm.',
        ...bolumler.map((b) => `${b.simge} **${b.ad}**\n${b.ozet}`),
      ].join('\n\n'),
    )
    .setFooter({ text: yetkili ? 'Yalnızca senin kullanabildiğin komutlar listelenir.' : 'Yönetim komutları yalnızca yetkililere görünür.' });
}

function bolumSayfasi(bolum, kimlik) {
  // Komut yüklüyse tıklanabilir bağlantı, değilse düz yazı
  const bag = (komut, alt) => {
    const tam = alt ? `${komut} ${alt}` : komut;
    return kimlik.has(komut) ? `</${tam}:${kimlik.get(komut)}>` : `\`/${tam}\``;
  };
  const bloklar = bolum.komutlar.map((komut) => {
    const altlar = (komut.options ?? []).filter((s) => s.type === ApplicationCommandOptionType.Subcommand).map((s) => s.name);
    if (!altlar.length) return `${bag(komut.name)}\n${komut.description}`;
    const ilk = altlar.includes(bolum.ilkAdim?.[komut.name]) ? bolum.ilkAdim[komut.name] : altlar[0];
    const kalan = altlar.filter((ad) => ad !== ilk);
    return [
      `**/${komut.name}**`,
      komut.description,
      `Buradan başla: ${bag(komut.name, ilk)}`,
      kalan.length ? `Diğerleri: ${kalan.map((ad) => bag(komut.name, ad)).join(' · ')}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  });
  return new EmbedBuilder()
    .setTitle(`${bolum.simge} ${bolum.ad}`)
    .setColor(RENK)
    .setDescription(bloklar.join('\n\n'))
    .setFooter({ text: 'Bir komuta dokununca yazı kutusuna gelir; Discord gereken bilgileri adım adım sorar.' });
}

const menu = (bolumler, secili) =>
  new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('yardim-bolum')
      .setPlaceholder('Bir bölüm seç')
      .addOptions(
        { label: 'Ana sayfa', value: 'ana', emoji: '🏠', default: secili === 'ana' },
        ...bolumler.map((b) => ({ label: b.ad, description: b.ozet.slice(0, 100), value: b.id, emoji: b.simge, default: secili === b.id })),
      ),
  );

module.exports = {
  // Test için
  BOLUMLER,
  bolumleriHazirla,

  data: new SlashCommandBuilder().setName('yardim').setDescription('Komutları bölüm bölüm gösterir ve ne işe yaradıklarını anlatır'),

  async execute(interaction) {
    const bolumler = bolumleriHazirla(interaction);
    const kimlik = await kimlikler(interaction.client);
    const sayfa = (secili) => ({
      embeds: [secili === 'ana' ? anaSayfa(interaction, bolumler) : bolumSayfasi(bolumler.find((b) => b.id === secili), kimlik)],
      components: [menu(bolumler, secili)],
    });

    await interaction.reply({ ...sayfa('ana'), flags: MessageFlags.Ephemeral });
    const mesaj = await interaction.fetchReply();
    const toplayici = mesaj.createMessageComponentCollector({ time: ACIK_KALMA });
    toplayici.on('collect', (secim) => {
      const secili = bolumler.some((b) => b.id === secim.values[0]) ? secim.values[0] : 'ana';
      secim.update(sayfa(secili)).catch((hata) => console.error('Yardım sayfası gösterilemedi:', hata.message));
    });
    // Süre dolunca menü kaldırılır; çalışmayan bir menü kalmasın
    toplayici.on('end', () => interaction.editReply({ components: [] }).catch(() => {}));
  },
};
