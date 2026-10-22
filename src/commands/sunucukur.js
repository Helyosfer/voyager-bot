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
// Olmazsa kurulum yine çalışır ama ilgili izin kuralları eksik kalır
const ONERILEN = [
  [PermissionFlagsBits.Connect, 'Bağlan'],
  [PermissionFlagsBits.Speak, 'Konuş'],
  [PermissionFlagsBits.Stream, 'Video'],
  [PermissionFlagsBits.AttachFiles, 'Dosya Ekle'],
];
const SECIM_SURESI = 180_000;
const KALDIR = 'kaldir'; // Şablon menüsündeki "kurulu şablonu kaldır" seçeneği

const kurulan = new Set(); // Kurulumu süren sunucular

// Şablonların karşılaştırması: hangisi ne kurar
function sablonListesi(kurulu = false) {
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
  if (kurulu) {
    embed.addFields({ name: '🗑️ Kurulu şablonu kaldır', value: 'Beğenmediysen kurulumla oluşan kanal ve rolleri siler, değişen bot ayarlarını eski haline getirir. Sunucunun kendi kanal ve rollerine dokunmaz; önce ne silineceğini gösterir.' });
  }
  return embed;
}

// kurulu: sunucuda kaldırılabilecek bir kurulum varsa menüye "kaldır" seçeneği de girer
const sablonMenusu = (kurulu = false) =>
  new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('sunucukur-sablon')
      .setPlaceholder('Bir şablon seç')
      .addOptions(
        ...Object.entries(SABLONLAR).map(([value, s]) => ({ label: s.ad.replace(/^\S+\s/, ''), emoji: s.ad.split(' ')[0], value, description: s.aciklama.slice(0, 100) })),
        ...(kurulu ? [{ label: 'Kurulu şablonu kaldır', emoji: '🗑️', value: KALDIR, description: 'Kurulumla oluşan kanal ve rolleri siler; mevcut olanlara dokunmaz' }] : []),
      ),
  );

// Silinecekler: kurulumun oluşturduğu rol ve kanallar; kalacaklar: sunucunun kendi eklediği kanallar
function kaldirOnizleme(plan) {
  const ad = (oge) => oge.name;
  const liste = (ogeler) => ogeler.map(ad).join('\n').slice(0, 1024);
  const embed = new EmbedBuilder()
    .setTitle('🗑️ Kurulu şablonu kaldır')
    .setColor(0xed4245)
    .setDescription(
      [
        'Aşağıdakiler **kalıcı olarak silinir**. Kurulumdan önce sunucuda olan ya da sonradan senin eklediğin kanal, rol ve mesajlara dokunulmaz.',
        '',
        `**Roller (${plan.roller.length})**`,
        plan.roller.length ? plan.roller.map(ad).join(' · ').slice(0, 1500) : '*Silinecek rol yok*',
      ].join('\n'),
    );
  const gorulen = new Set();
  for (const { kategori, kalan } of plan.kategoriler) {
    const kanallar = plan.kanallar.filter((k) => k.parentId === kategori.id);
    kanallar.forEach((k) => gorulen.add(k.id));
    embed.addFields({
      name: `${kalan.length ? '📁' : '🗑️'} ${kategori.name}`.slice(0, 256),
      value: [liste(kanallar) || '*Kanal yok*', kalan.length ? `*Senin eklediğin ${kalan.length} kanal olduğu için kategori kalır*` : null].filter(Boolean).join('\n').slice(0, 1024),
      inline: true,
    });
  }
  const daginiklar = plan.kanallar.filter((k) => !gorulen.has(k.id));
  if (daginiklar.length) embed.addFields({ name: 'Diğer kanallar', value: liste(daginiklar), inline: true });
  embed.addFields({
    name: 'Bilmen gerekenler',
    value: [
      `• Toplam **${plan.toplam} öğe** silinir. Bu işlem geri alınamaz.`,
      plan.odalar.length ? `• **${plan.odalar.length} destek odası** içindeki konuşmalarla birlikte silinir.` : null,
      plan.roller.length ? '• Silinen rolleri taşıyan üyeler o rolleri kaybeder.' : null,
      plan.ayarlar.length ? `• Kurulumun değiştirdiği ayarlar eski haline döner: ${plan.ayarlar.map((a) => topluluk.ayarAdi(a.anahtar)).join(', ')}. Sonradan kendin değiştirdiklerine dokunulmaz.` : null,
      plan.yetmeyenRoller.length ? `• ⚠️ Şu roller benim rolümün üstünde olduğu için silinemez: ${plan.yetmeyenRoller.map(ad).join(', ')}. Voyager rolünü yukarı taşıyıp yeniden dene.` : null,
      plan.eski
        ? '• ⚠️ Bu kurulum, neyin oluşturulduğunun kaydı tutulmadan önce yapıldı; öğeler şablondaki adlarıyla bulundu. Aynı adda **kendi oluşturduğun** bir kanal ya da rol varsa o da listede olabilir; listeyi kontrol et.'
        : null,
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, 1024),
  });
  return embed;
}

function kaldirSonucu(sonuc) {
  const sorunlu = sonuc.basarisiz.length > 0;
  const embed = new EmbedBuilder()
    .setTitle(sorunlu ? '⚠️ Kaldırma yarıda kaldı' : '✅ Şablon kaldırıldı')
    .setColor(sorunlu ? 0xfee75c : 0x57f287)
    .setDescription(
      [
        `${sonuc.kanallar} kanal, ${sonuc.kategoriler} kategori ve ${sonuc.roller} rol silindi.`,
        ...sonuc.kalanKategoriler.map((k) => `📁 **${k.ad}** kategorisinde senin eklediğin ${k.adet} kanal olduğu için kategori kaldı.`),
        sonuc.geriAlinan.length ? `Eski haline dönen ayarlar: ${sonuc.geriAlinan.join(', ')}.` : null,
        sorunlu ? `\n**Silinemeyenler:**\n${sonuc.basarisiz.map((b) => `• ${b}`).join('\n').slice(0, 900)}\nKomutu yeniden çalıştırırsan kalanlar silinir.` : null,
        ...sonuc.uyarilar.map((u) => `⚠️ ${u}`),
      ]
        .filter(Boolean)
        .join('\n'),
    );
  if (!sorunlu) embed.setFooter({ text: 'İstersen /sunucukur ile başka bir şablon kurabilirsin.' });
  return embed;
}

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
  // Alan değeri 1024 karakterle sınırlı: her kategori kendi alanında
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

// Kaldırma: önce ne silineceği gösterilir, onaydan sonra silinir. Onay beklenirken sunucu değişmiş
// olabilir; silmeden önce plan güncel haliyle yeniden çıkarılır.
async function kaldirAkisi(interaction, cevap, sahibinSecimi) {
  const { guild } = interaction;
  const goster = (icerik) => (cevap ? cevap.update(icerik) : interaction.reply({ ...icerik, flags: MessageFlags.Ephemeral }));
  const plan = topluluk.kaldirmaPlani(guild);
  if (!plan) return goster({ content: 'Bu sunucuda Voyager şablonuyla kurulmuş bir şey bulunamadı.', embeds: [], components: [] });
  if (!plan.toplam && !plan.ayarlar.length) {
    // Kurulumdan geriye bir şey kalmamış (elle silinmiş); yalnızca kayıt temizlenir
    await topluluk.kaldir(guild, plan, interaction.user.tag);
    return goster({ content: '✅ Kurulumdan kalan bir kanal ya da rol bulunamadı; kurulum kaydı temizlendi.', embeds: [], components: [] });
  }

  const dugmeler = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sunucukur-kaldir-onay').setLabel(`Sil (${plan.toplam} öğe)`).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('sunucukur-vazgec').setLabel('Vazgeç').setStyle(ButtonStyle.Secondary),
  );
  await goster({ embeds: [kaldirOnizleme(plan)], components: [dugmeler] });
  const secim = await sahibinSecimi(await interaction.fetchReply());
  if (!secim || secim.customId !== 'sunucukur-kaldir-onay') {
    const metin = secim ? 'Vazgeçildi; hiçbir şey silinmedi.' : 'Süre doldu; hiçbir şey silinmedi.';
    return secim ? secim.update({ content: metin, embeds: [], components: [] }) : interaction.editReply({ content: metin, embeds: [], components: [] });
  }

  // Aynı anda kurulum ve kaldırma birbirinin işini bozar
  if (kurulan.has(guild.id)) {
    return secim.update({ content: '⏳ Bu sunucuda şu an başka bir kurulum ya da kaldırma sürüyor. Bitmesini bekle.', embeds: [], components: [] });
  }
  kurulan.add(guild.id);
  await secim.update({ content: '⏳ Kaldırılıyor…', embeds: [], components: [] });
  const sonuc = await topluluk
    .kaldir(guild, topluluk.kaldirmaPlani(guild) ?? plan, interaction.user.tag, (metin) => secim.editReply({ content: metin }))
    .finally(() => kurulan.delete(guild.id));
  const kart = kaldirSonucu(sonuc);
  // Komutun yazıldığı kanal da silinmiş olabilir; cevap gönderilemezse özel mesajla iletilir
  await secim.editReply({ content: '', embeds: [kart] }).catch(() => interaction.user.send({ embeds: [kart] }).catch(() => {}));
}

module.exports = {
  // Yönetici yetkisini bot da denetler; sunucu ayarlarından başka rollere açılamaz
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
      const kurulu = topluluk.kuruluMu(guild.id);
      await interaction.reply({ embeds: [sablonListesi(kurulu)], components: [sablonMenusu(kurulu)], flags: MessageFlags.Ephemeral });
      cevap = await sahibinSecimi(await interaction.fetchReply());
      if (!cevap) return interaction.editReply({ content: 'Süre doldu; hiçbir şey değiştirilmedi.', embeds: [], components: [] });
      sablonAdi = cevap.values[0];
    }
    if (sablonAdi === KALDIR) return kaldirAkisi(interaction, cevap, sahibinSecimi);

    const plan = topluluk.planla(guild, sablonAdi);
    const goster = (icerik) => (cevap ? cevap.update(icerik) : interaction.reply({ ...icerik, flags: MessageFlags.Ephemeral }));
    if (!plan.yeni) return goster({ content: '✅ Şablondaki her şey sunucuda zaten var; oluşturulacak bir şey yok.', embeds: [], components: [] });

    // Onlarca kanal ve rol oluşturan bir işlem: önce ne yapılacağını göster, onay iste
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

    // Aynı anda iki kurulum her şeyi çift oluşturur
    if (kurulan.has(guild.id)) {
      return secim.update({ content: '⏳ Bu sunucuda şu an başka bir kurulum sürüyor. Bitmesini bekle.', embeds: [], components: [] });
    }
    kurulan.add(guild.id);
    await secim.update({ content: '⏳ Kuruluyor…', embeds: [], components: [] });
    // Onay beklenirken sunucu değişmiş olabilir; planı güncel haliyle yeniden çıkar
    const sonuc = await topluluk
      .kur(guild, topluluk.planla(guild, sablonAdi), interaction.user.tag, (metin) => secim.editReply({ content: metin }))
      .finally(() => kurulan.delete(guild.id));
    return secim.editReply({ content: '', embeds: [sonucKarti(sonuc, SABLONLAR[sablonAdi])] });
  },

  // Test için
  onizleme,
  sablonListesi,
  sablonMenusu,
  sonucKarti,
  kaldirOnizleme,
  kaldirSonucu,
};
