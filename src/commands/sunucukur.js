const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  InteractionContextType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
} = require('discord.js');
const topluluk = require('../topluluk');

const { SABLONLAR } = topluluk;

// Kurulumun eksiksiz çalışması için botta olması gereken izinler
const GEREKLI = [
  [PermissionFlagsBits.ManageChannels, 'Kanalları Yönet'],
  [PermissionFlagsBits.ManageRoles, 'Rolleri Yönet'],
];
// Bunlar olmasa da kurulum çalışır, ama ilgili izin kuralları eksik kalır
const ONERILEN = [
  [PermissionFlagsBits.Connect, 'Bağlan'],
  [PermissionFlagsBits.Speak, 'Konuş'],
  [PermissionFlagsBits.Stream, 'Video'],
  [PermissionFlagsBits.AttachFiles, 'Dosya Ekle'],
];
const SECIM_SURESI = 180_000;

const { islemde } = topluluk; // Kurulumu ya da silmesi şu an süren sunucular

// Şablonların karşılaştırması: hangisi ne kurar
function sablonListesi() {
  const embed = new EmbedBuilder()
    .setTitle('🛠️ Sunucu kurulumu · Şablon seç')
    .setColor(0x5865f2)
    .setDescription('Sunucunun kullanım amacına uyan şablonu aşağıdaki menüden seç. Seçince ne kurulacağını gösteririm; onaylamadan hiçbir şey değişmez.');
  for (const sablon of Object.values(SABLONLAR)) {
    const kanal = sablon.kategoriler.reduce((t, k) => t + k.kanallar.length, 0);
    const ozellikler = [sablon.onay ? 'üyelik onayı' : 'onaysız', sablon.kategoriler.some((k) => k.anahtar === 'talepler') ? 'destek talepleri' : null]
      .filter(Boolean)
      .join(', ');
    embed.addFields({ name: sablon.ad, value: `${sablon.aciklama}\n-# ${sablon.roller.length} rol · ${sablon.kategoriler.length} kategori · ${kanal} kanal · ${ozellikler}` });
  }
  return embed;
}

const sablonMenusu = () =>
  new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('sunucukur-sablon')
      .setPlaceholder('Bir şablon seç')
      .addOptions(Object.entries(SABLONLAR).map(([value, s]) => ({ label: s.ad.replace(/^\S+\s/, ''), emoji: s.ad.split(' ')[0], value, description: s.aciklama.slice(0, 100) }))),
  );

function onizleme(plan, eksikOnerilen) {
  const sablon = SABLONLAR[plan.sablon];
  const isaret = (oge) => (oge.mevcut ? '▫️' : '🟢');
  const embed = new EmbedBuilder()
    .setTitle(`🛠️ Sunucu kurulumu · ${sablon.ad}`)
    .setColor(0x5865f2)
    .setDescription(
      [
        sablon.aciklama,
        '🟢 oluşturulacak · ▫️ zaten var, dokunulmayacak',
        '',
        `**Roller (${plan.roller.length})**`,
        plan.roller.map((r) => `${isaret(r)} ${r.ad}`).join(' · '),
      ].join('\n'),
    );
  // Bir alanın değeri en fazla 1024 karakter olabilir: her kategori kendi alanında gösterilir
  for (const kategori of plan.kategoriler) {
    embed.addFields({
      name: `${isaret(kategori)} ${kategori.ad}`,
      value: kategori.kanallar.map((k) => `${isaret(k)} ${k.ad}`).join('\n').slice(0, 1024) || '*Talep açıldıkça odalar burada oluşur*',
      inline: true,
    });
  }
  embed.addFields({
    name: 'Bilmen gerekenler',
    value: [
      `• **${plan.yeni} yeni öğe** oluşturulacak; yaklaşık ${plan.yeni > 40 ? '1-2 dakika' : 'yarım dakika'} sürer.`,
      '• Mevcut kanal ve rollerin hiçbiri silinmez ya da değiştirilmez.',
      sablon.onay
        ? '• Yeni gelenler **Yeni Gelen** rolüyle başlar; onay düğmesine basınca **Üye** olur ve topluluk kanalları açılır.'
        : '• Üyelik onayı yok: sunucuya katılan herkes kanalları hemen görür.',
      '• Günlük, hoş geldin ve bildirim kanalları botun ayarlarına kendiliğinden bağlanır.',
      plan.ayarlar.length ? `• Açılacak: **${plan.ayarlar.map((a) => a.ad).join(', ')}**. Sonradan ilgili komutla kapatabilirsin.` : null,
      plan.atlanan.length
        ? `• Açılmayacak: ${plan.atlanan.map((a) => a.ad).join(', ')}. Bunlar mesaj metnini okumayı ister, ama botta Message Content Intent kapalı.`
        : null,
      eksikOnerilen.length ? `• ⚠️ Bende şu izinler yok: **${eksikOnerilen.join(', ')}**. Kurulum çalışır ama bu izinlere dayanan kurallar (özellikle ses kanalları) eksik kalır.` : null,
    ]
      .filter(Boolean)
      .join('\n'),
  });
  return embed;
}

function sonucKarti(sonuc, sablon) {
  const embed = new EmbedBuilder()
    .setTitle(sonuc.hata ? '⚠️ Kurulum yarıda kaldı' : '✅ Kurulum tamamlandı')
    .setColor(sonuc.hata ? 0xfee75c : 0x57f287)
    .setDescription(
      [
        `${sablon.ad} şablonu: ${sonuc.olusturulan} öğe oluşturuldu.`,
        sonuc.hata ? `Hata: ${sonuc.hata}\nOluşturulanlar yerinde duruyor; komutu yeniden çalıştırırsan kaldığı yerden devam eder.` : null,
        ...sonuc.uyarilar.map((u) => `⚠️ ${u}`),
      ]
        .filter(Boolean)
        .join('\n'),
    );
  if (sonuc.baglanan.length) embed.addFields({ name: 'Bota bağlananlar', value: sonuc.baglanan.join('\n').slice(0, 1024) });
  if (sonuc.acilan.length) embed.addFields({ name: 'Açılan özellikler', value: sonuc.acilan.map((a) => `• ${a}`).join('\n') });
  if (!sonuc.hata) {
    embed.addFields({
      name: 'Sıradaki adımlar',
      value: [
        '• **Voyager rolünü** rol listesinde yeni rollerin üstüne taşı; yoksa rol verme işleri çalışmaz.',
        '• Ekibine yetkili rollerini ver.',
        ...(sablon.sonraki ?? []).map((s) => `• ${s}`),
        '• Koruma ayarları: `/koruma goster` · Saldırı anında: `/kilit kapat`.',
      ]
        .join('\n')
        .slice(0, 1024),
    });
  }
  return embed;
}

module.exports = {
  // Yönetici yetkisini bot da denetler; komut sunucu ayarlarından başka rollere açılsa bile onlarda çalışmaz
  kesinYetki: true,

  data: new SlashCommandBuilder()
    .setName('sunucukur')
    .setDescription('Hazır şablonla sunucu kurar: roller, kategoriler, kanallar, izinler ve bot ayarları')
    .addStringOption((o) =>
      o
        .setName('sablon')
        .setDescription('Kurulum şablonu (boş bırakırsan açıklamalarıyla listelenir)')
        .addChoices(...Object.entries(SABLONLAR).map(([value, s]) => ({ name: s.ad, value }))),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const { guild } = interaction;
    const ben = guild.members.me;
    const eksik = GEREKLI.filter(([izin]) => !ben.permissions.has(izin)).map(([, ad]) => ad);
    if (eksik.length) {
      return interaction.reply({
        content: `❌ Kurulum için bana şu izinleri vermen gerekiyor: **${eksik.join(', ')}**. Sunucu Ayarları → Roller → Voyager bölümünden açıp komutu yeniden çalıştır.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Şablon seçilmediyse önce şablonlar açıklamalarıyla gösterilir
    let sablonAdi = interaction.options.getString('sablon');
    let cevap; // Sonraki adımlar bu etkileşimle güncellenir
    const sahibinSecimi = (mesaj) =>
      mesaj.awaitMessageComponent({ filter: (i) => i.user.id === interaction.user.id, time: SECIM_SURESI }).catch(() => null);
    if (!sablonAdi) {
      await interaction.reply({ embeds: [sablonListesi()], components: [sablonMenusu()], flags: MessageFlags.Ephemeral });
      cevap = await sahibinSecimi(await interaction.fetchReply());
      if (!cevap) return interaction.editReply({ content: 'Süre doldu; hiçbir şey değiştirilmedi.', embeds: [], components: [] });
      sablonAdi = cevap.values[0];
    }

    const plan = topluluk.planla(guild, sablonAdi);
    const goster = (icerik) => (cevap ? cevap.update(icerik) : interaction.reply({ ...icerik, flags: MessageFlags.Ephemeral }));
    if (!plan.yeni) return goster({ content: '✅ Şablondaki her şey sunucuda zaten var; oluşturulacak bir şey yok.', embeds: [], components: [] });

    // Onlarca kanal ve rol oluşturan bir işlem: önce ne yapılacağı gösterilir, onay istenir
    const dugmeler = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('sunucukur-onay').setLabel(`Kur (${plan.yeni} öğe)`).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('sunucukur-vazgec').setLabel('Vazgeç').setStyle(ButtonStyle.Secondary),
    );
    const eksikOnerilen = ONERILEN.filter(([izin]) => !ben.permissions.has(izin)).map(([, ad]) => ad);
    await goster({ embeds: [onizleme(plan, eksikOnerilen)], components: [dugmeler] });
    const secim = await sahibinSecimi(await interaction.fetchReply());

    if (!secim || secim.customId === 'sunucukur-vazgec') {
      const metin = secim ? 'Kurulumdan vazgeçildi; hiçbir şey değiştirilmedi.' : 'Süre doldu; hiçbir şey değiştirilmedi.';
      return secim ? secim.update({ content: metin, embeds: [], components: [] }) : interaction.editReply({ content: metin, embeds: [], components: [] });
    }

    // Aynı anda iki kurulum yapılırsa her şey iki kez oluşturulur
    if (islemde.has(guild.id)) {
      return secim.update({ content: '⏳ Bu sunucuda şu an başka bir kurulum ya da silme sürüyor. Bitmesini bekle.', embeds: [], components: [] });
    }
    islemde.add(guild.id);
    await secim.update({ content: '⏳ Kuruluyor…', embeds: [], components: [] });
    // Onay beklenirken sunucu değişmiş olabilir; plan sunucunun güncel haline göre yeniden çıkarılır
    const sonuc = await topluluk
      .kur(guild, topluluk.planla(guild, sablonAdi), interaction.user.tag, (metin) => secim.editReply({ content: metin }))
      .finally(() => islemde.delete(guild.id));
    return secim.editReply({ content: '', embeds: [sonucKarti(sonuc, SABLONLAR[sablonAdi])] });
  },

  // Yalnızca testler kullanır
  onizleme,
  sablonListesi,
  sonucKarti,
};
