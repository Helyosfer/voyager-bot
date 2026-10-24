const {
  SlashCommandBuilder,
  ApplicationCommandOptionType: T,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  PermissionsBitField,
} = require('discord.js');
const REHBER = require('../yardim-rehberi');
const { GOREVLER, BASLANGIC } = require('../yardim-gorevler');

const RENK = 0x5865f2;
const ACIK_KALMA = 10 * 60 * 1000; // Menüler bu süre boyunca çalışır

// Yardım bölümleri. Bir komut hiçbir bölümde yoksa "Diğer" bölümüne düşer.
const BOLUMLER = [
  { id: 'genel', simge: '🧭', ad: 'Genel', ozet: 'Herkesin kullanabildiği komutlar', komutlar: ['sor', 'ozetle', 'hatirlat', 'yardim'] },
  { id: 'moderasyon', simge: '🛡️', ad: 'Moderasyon', ozet: 'Uyarma, susturma, atma, yasaklama, mesaj temizleme', komutlar: ['uyari', 'sustur', 'kick', 'ban', 'unban', 'temizle'] },
  { id: 'guvenlik', simge: '🚨', ad: 'Güvenlik', ozet: 'Spam, küfür ve dolandırıcılık filtresi; acil durum kilidi', komutlar: ['koruma', 'kilit'] },
  { id: 'bildirim', simge: '📣', ad: 'Bildirimler', ozet: 'Oyun fırsatları, canlı yayınlar, haberler', komutlar: ['oyun', 'yayin', 'haber', 'instagram'] },
  { id: 'topluluk', simge: '🎉', ad: 'Topluluk', ozet: 'Seviyeler, çekilişler, rol menüleri', komutlar: ['seviye', 'cekilis', 'rolmenu'] },
  { id: 'sunucu', simge: '⚙️', ad: 'Sunucu ayarları', ozet: 'Günlük, hoş geldin, otomatik rol, hazır kurulum', komutlar: ['ayarla', 'sunucukur'] },
];
const DIGER = { id: 'diger', simge: '📦', ad: 'Diğer', ozet: 'Diğer komutlar', komutlar: [] };
// Bölüm menüsünün başındaki sayfalar
const OZEL_SAYFALAR = [
  { id: 'ana', simge: '🏠', ad: 'Ana sayfa', ozet: 'Yardımın başı' },
  { id: 'baslangic', simge: '🚀', ad: 'Başlangıç', ozet: 'İlk adımlar' },
  { id: 'gorevler', simge: '📖', ad: 'Nasıl yapılır?', ozet: 'Adım adım rehberler: bildirim kur, korumayı aç…' },
];

// Komutların istediği yetkilerin Discord'daki Türkçe adları
const YETKI_ADLARI = {
  Administrator: 'Yönetici',
  ManageGuild: 'Sunucuyu Yönet',
  ManageRoles: 'Rolleri Yönet',
  ManageChannels: 'Kanalları Yönet',
  ManageMessages: 'Mesajları Yönet',
  BanMembers: 'Üyeleri Yasakla',
  KickMembers: 'Üyeleri At',
  ModerateMembers: 'Üyelere Zaman Aşımı Uygula',
};
// Seçenek türlerinin okunur adları
const TUR = {
  [T.String]: 'metin',
  [T.Integer]: 'sayı',
  [T.Number]: 'sayı',
  [T.Boolean]: 'evet/hayır',
  [T.User]: 'kullanıcı',
  [T.Channel]: 'kanal',
  [T.Role]: 'rol',
  [T.Mentionable]: 'kullanıcı ya da rol',
  [T.Attachment]: 'dosya',
};

const kisalt = (metin, sinir) => (metin.length > sinir ? `${metin.slice(0, sinir - 1)}…` : metin);
const kucuk = (metin) => metin.toLocaleLowerCase('tr');

function yetkiMetni(bitler) {
  if (!bitler) return 'Herkes';
  // false: Yönetici yetkisi bütün yetkileri içeriyor sayılmasın, yalnızca istenen yazılsın
  const adlar = new PermissionsBitField(BigInt(bitler)).toArray(false).map((ad) => YETKI_ADLARI[ad] ?? ad);
  return `**${adlar.join(', ')}** yetkisi olanlar`;
}

// Alt komutlar (gruplardakiler "grup alt" adıyla)
const altKomutlar = (komut) =>
  (komut.options ?? []).flatMap((o) => {
    if (o.type === T.SubcommandGroup) return (o.options ?? []).map((a) => ({ ...a, tamAd: `${o.name} ${a.name}` }));
    return o.type === T.Subcommand ? [{ ...o, tamAd: o.name }] : [];
  });

function secenekSatiri(o) {
  // Seçmeli seçenekte üye yazmaz, listeden seçer
  const ek = [o.choices?.length ? 'seçim' : (TUR[o.type] ?? 'değer')];
  if (o.min_value != null && o.max_value != null) ek.push(`${o.min_value}-${o.max_value}`);
  else if (o.max_value != null) ek.push(`en fazla ${o.max_value}`);
  if (o.choices?.length) ek.push(o.choices.map((c) => c.name).join(' / '));
  return `› \`${o.name}\`${o.required ? ' **(zorunlu)**' : ''}: ${o.description} *(${ek.join(' · ')})*`;
}

// Komut adı → Discord'daki komut kimliği; tıklanabilir komut bağlantıları için
async function kimlikler(client) {
  if (!client.komutKimlikleri) {
    const yuklu = await client.application.commands.fetch().catch(() => null);
    if (!yuklu) return new Map(); // Alınamazsa düz yazı kullanılır, bir dahaki sefere yeniden denenir
    client.komutKimlikleri = new Map(yuklu.map((k) => [k.name, k.id]));
  }
  return client.komutKimlikleri;
}

// Komut yüklüyse tıklanabilir bağlantı, değilse düz yazı
const baglayici = (kimlik) => (komut, alt) => {
  const tam = alt ? `${komut} ${alt}` : komut;
  return kimlik.has(komut) ? `</${tam}:${kimlik.get(komut)}>` : `\`/${tam}\``;
};

// Rehber metnindeki {komut alt} yazımlarını komut bağlantısına çevirir
const BAGLANTI = /\{([a-z]+)(?: ([a-z-]+))?\}/g;
const baglantila = (metin, bag) => metin.replace(BAGLANTI, (_, komut, alt) => bag(komut, alt));
const anilanKomutlar = (metinler) => [...new Set(metinler.flatMap((m) => [...m.matchAll(BAGLANTI)].map((e) => e[1])))];

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

// Üyenin görebileceği rehberler: anlattığı bütün komutları ve rehberin istediği yetkiyi kullanabiliyor olmalı
function gorevleriHazirla(bolumler, izinler) {
  const kullanilabilir = new Set(bolumler.flatMap((b) => b.komutlar.map((k) => k.name)));
  return GOREVLER.filter(
    (g) =>
      (!g.yetki || izinler?.has(PermissionFlagsBits[g.yetki])) &&
      anilanKomutlar([...g.adimlar, ...(g.ipuclari ?? [])]).every((ad) => kullanilabilir.has(ad)),
  );
}

const yoneticiMi = (interaction) => Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));

// --- Sayfalar ---
function anaSayfa(interaction, bolumler, gorevler) {
  const gecikme = interaction.client.ws?.ping ?? -1; // Bağlantı yeni kurulduysa -1
  return new EmbedBuilder()
    .setTitle(`${interaction.client.user.username} · Yardım`)
    .setColor(RENK)
    .setThumbnail(interaction.client.user.displayAvatarURL())
    .setDescription(
      [
        'Aşağıdaki menüden seç:',
        '',
        '🚀 **Başlangıç** · ilk adımlar',
        gorevler.length ? `📖 **Nasıl yapılır?** · ${gorevler.length} adım adım rehber` : null,
        ...bolumler.map((b) => `${b.simge} **${b.ad}** · ${b.ozet}`),
        '',
        'Bir komuta doğrudan bak: `/yardim komut:ban` · alt komut için `/yardim komut:oyun ayar`',
      ]
        .filter((s) => s !== null)
        .join('\n'),
    )
    .setFooter({
      text: `${bolumler.some((b) => b.id !== 'genel') ? 'Yalnızca senin kullanabildiğin komutlar listelenir.' : 'Yönetim komutları yalnızca yetkililere görünür.'}${gecikme >= 0 ? ` · Gecikme: ${gecikme} ms` : ''}`,
    });
}

function baslangicSayfasi(interaction, bag) {
  const yonetici = yoneticiMi(interaction);
  const adimlar = yonetici ? BASLANGIC.yonetici : BASLANGIC.uye;
  return new EmbedBuilder()
    .setTitle(yonetici ? '🚀 Başlangıç · Sunucuna Voyager\'ı kur' : '🚀 Başlangıç')
    .setColor(RENK)
    .setDescription(adimlar.map((a, i) => `**${i + 1}.** ${baglantila(a, bag)}`).join('\n\n'))
    .setFooter({ text: 'Bir komuta dokununca yazı kutusuna gelir; Discord gereken bilgileri adım adım sorar.' });
}

function gorevlerSayfasi(gorevler) {
  return new EmbedBuilder()
    .setTitle('📖 Nasıl yapılır?')
    .setColor(RENK)
    .setDescription(
      [
        'Yapmak istediğin şeyi aşağıdaki menüden seç; adım adım anlatayım.',
        '',
        ...gorevler.map((g) => `${g.simge} ${g.ad}`),
      ].join('\n'),
    );
}

function gorevSayfasi(gorev, bag) {
  const embed = new EmbedBuilder()
    .setTitle(`${gorev.simge} ${gorev.ad}`)
    .setColor(RENK)
    .setDescription(gorev.adimlar.map((a, i) => `**${i + 1}.** ${baglantila(a, bag)}`).join('\n\n'));
  if (gorev.ipuclari?.length) embed.addFields({ name: '💡 İpuçları', value: gorev.ipuclari.map((i) => `• ${baglantila(i, bag)}`).join('\n') });
  return embed.setFooter({ text: 'Diğer rehberler için menüden seç · Komutların ayrıntısı bölüm sayfalarında' });
}

function bolumSayfasi(bolum, bag) {
  const satir = (komut) => {
    const altlar = altKomutlar(komut).map((s) => s.tamAd);
    return altlar.length
      ? `**/${komut.name}** · ${komut.description}\n-# ${altlar.map((ad) => bag(komut.name, ad)).join(' · ')}`
      : `${bag(komut.name)} · ${komut.description}`;
  };
  return new EmbedBuilder()
    .setTitle(`${bolum.simge} ${bolum.ad}`)
    .setColor(RENK)
    .setDescription(bolum.komutlar.map(satir).join('\n\n'))
    .setFooter({ text: 'Ayrıntı için aşağıdaki ikinci menüden komutu seç.' });
}

// Komutun genel sayfası: ne işe yaradığı, kimin kullanabileceği, alt komutları (birer satır), örnekler.
// Alt komutların seçenekleri kendi sayfalarında; alt komutu olmayan komutun seçenekleri burada.
function komutSayfasi(komut, kimlik) {
  const rehber = REHBER[komut.name] ?? {};
  const bag = baglayici(kimlik);
  const altlar = altKomutlar(komut);
  const embed = new EmbedBuilder()
    .setTitle(`/${komut.name}`)
    .setColor(RENK)
    .setDescription(kisalt([rehber.anlatim ?? komut.description, altlar.length ? null : `**Kullanım:** ${bag(komut.name)}`].filter(Boolean).join('\n\n'), 4096))
    .addFields({ name: '👤 Kim kullanabilir', value: kisalt(rehber.kim ?? yetkiMetni(komut.default_member_permissions), 1024) });

  if (altlar.length) {
    embed.addFields({ name: '▸ Alt komutlar', value: kisalt(altlar.map((a) => `${bag(komut.name, a.tamAd)} · ${a.description}`).join('\n'), 1024) });
  } else {
    const secenekler = (komut.options ?? []).map(secenekSatiri);
    embed.addFields({ name: '⚙️ Seçenekler', value: secenekler.length ? kisalt(secenekler.join('\n'), 1024) : 'Seçeneği yok; yazıp göndermen yeterli.' });
  }
  if (rehber.ornekler?.length) embed.addFields({ name: '💡 Örnekler', value: kisalt(rehber.ornekler.map((o) => `\`${o}\``).join('\n'), 1024) });
  if (rehber.notlar?.length) embed.addFields({ name: '📌 Bilmen gerekenler', value: kisalt(rehber.notlar.map((n) => `• ${n}`).join('\n'), 1024) });
  return embed.setFooter({ text: altlar.length ? 'Bir alt komutun seçenekleri ve örnekleri için üçüncü menüden seç.' : 'Komutu yazarken Discord seçenekleri adım adım sorar; zorunlu olmayanları boş bırakabilirsin.' });
}

// Alt komutun ayrıntılı sayfası: açıklama, elle yazılmış anlatım, bütün seçenekleri, kendi örnekleri ve notları
function altKomutSayfasi(komut, altAd, kimlik) {
  const alt = altKomutlar(komut).find((a) => a.tamAd === altAd);
  const rehber = REHBER[komut.name] ?? {};
  const ozel = rehber.altlar?.[altAd] ?? {};
  const bag = baglayici(kimlik);
  const ornekler = (rehber.ornekler ?? []).filter((o) => o === `/${komut.name} ${altAd}` || o.startsWith(`/${komut.name} ${altAd} `));
  const embed = new EmbedBuilder()
    .setTitle(`/${komut.name} ${altAd}`)
    .setColor(RENK)
    .setDescription(kisalt([alt.description, ozel.anlatim, `**Kullanım:** ${bag(komut.name, altAd)}`].filter(Boolean).join('\n\n'), 4096));
  const secenekler = (alt.options ?? []).map(secenekSatiri);
  embed.addFields({ name: '⚙️ Seçenekler', value: secenekler.length ? kisalt(secenekler.join('\n'), 1024) : 'Seçeneği yok; yazıp göndermen yeterli.' });
  if (ornekler.length) embed.addFields({ name: '💡 Örnekler', value: kisalt(ornekler.map((o) => `\`${o}\``).join('\n'), 1024) });
  if (ozel.notlar?.length) embed.addFields({ name: '📌 Bilmen gerekenler', value: kisalt(ozel.notlar.map((n) => `• ${n}`).join('\n'), 1024) });
  return embed.setFooter({ text: `Komutun genel sayfası ve diğer alt komutlar: /yardim komut:${komut.name}` });
}

// --- Menüler ---
const menu = (customId, yer, secenekler) =>
  new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(yer).addOptions(secenekler.slice(0, 25)));

const bolumMenusu = (bolumler, gorevler, secili) =>
  menu(
    'yardim-bolum',
    'Bir bölüm seç',
    [...OZEL_SAYFALAR.filter((s) => s.id !== 'gorevler' || gorevler.length), ...bolumler].map((b) => ({
      label: b.ad,
      description: kisalt(b.ozet, 100),
      value: b.id,
      emoji: b.simge,
      default: secili === b.id,
    })),
  );
const gorevMenusu = (gorevler, secili) =>
  menu('yardim-gorev', 'Ne yapmak istiyorsun?', gorevler.map((g) => ({ label: kisalt(g.ad, 100), value: g.id, emoji: g.simge, default: g.id === secili })));
const komutMenusu = (bolum, secili) =>
  menu('yardim-komut', 'Bir komutun ayrıntısına bak', bolum.komutlar.map((k) => ({ label: `/${k.name}`, description: kisalt(k.description, 100), value: k.name, default: k.name === secili })));
const altMenusu = (komut, secili) =>
  menu(
    'yardim-alt',
    'Bir alt komutun ayrıntısına bak',
    altKomutlar(komut).map((a) => ({ label: `/${komut.name} ${a.tamAd}`, description: kisalt(a.description, 100), value: a.tamAd, default: a.tamAd === secili })),
  );

// durum: { sayfa: 'ana' | 'baslangic' | 'gorevler' | bölüm kimliği, gorev, komut, alt }
function sayfa(interaction, bolumler, kimlik, durum) {
  const bag = baglayici(kimlik);
  const gorevler = gorevleriHazirla(bolumler, interaction.memberPermissions);
  const bolum = bolumler.find((b) => b.id === durum.sayfa);
  const komut = bolum && durum.komut ? bolum.komutlar.find((k) => k.name === durum.komut) : null;
  const alt = komut && durum.alt && altKomutlar(komut).some((a) => a.tamAd === durum.alt) ? durum.alt : null;
  const gorev = durum.sayfa === 'gorevler' ? gorevler.find((g) => g.id === durum.gorev) : null;

  let embed;
  if (alt) embed = altKomutSayfasi(komut, alt, kimlik);
  else if (komut) embed = komutSayfasi(komut, kimlik);
  else if (bolum) embed = bolumSayfasi(bolum, bag);
  else if (gorev) embed = gorevSayfasi(gorev, bag);
  else if (durum.sayfa === 'gorevler' && gorevler.length) embed = gorevlerSayfasi(gorevler);
  else if (durum.sayfa === 'baslangic') embed = baslangicSayfasi(interaction, bag);
  else embed = anaSayfa(interaction, bolumler, gorevler);

  const secili = bolum ? bolum.id : ['baslangic', 'gorevler'].includes(durum.sayfa) && (durum.sayfa !== 'gorevler' || gorevler.length) ? durum.sayfa : 'ana';
  const satirlar = [bolumMenusu(bolumler, gorevler, secili)];
  if (secili === 'gorevler') satirlar.push(gorevMenusu(gorevler, gorev?.id));
  if (bolum) satirlar.push(komutMenusu(bolum, komut?.name));
  if (komut && altKomutlar(komut).length) satirlar.push(altMenusu(komut, alt));
  return { embeds: [embed], components: satirlar };
}

// "/Ban", "ban" ya da "oyun ayar" yazılabilir; cevaba geri yazıldığı için yalnızca komut adında olabilecek harfler kalır
const komutAdi = (metin) =>
  kucuk(metin ?? '')
    .trim()
    .replace(/^\//, '')
    .replace(/[^a-z0-9çğıöşü\s-]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.slice(0, 32));

module.exports = {
  // Yalnızca testler kullanır
  BOLUMLER,
  bolumleriHazirla,
  gorevleriHazirla,
  komutSayfasi,
  altKomutSayfasi,
  sayfa,
  BAGLANTI,

  data: new SlashCommandBuilder()
    .setName('yardim')
    .setDescription('Komutları, adım adım rehberleri ve başlangıç adımlarını gösterir')
    .addStringOption((o) => o.setName('komut').setDescription('Ayrıntısını görmek istediğin komut ya da alt komut (ör. ban, oyun ayar)').setAutocomplete(true)),

  // komut seçeneğine yazarken, üyenin kullanabildiği komutlar ve alt komutlar önerilir; adı yazılanla başlayanlar önce
  async autocomplete(interaction) {
    const yazilan = kucuk(interaction.options.getFocused()).trim().replace(/^\//, '');
    const adaylar = bolumleriHazirla(interaction)
      .flatMap((b) => b.komutlar)
      .flatMap((k) => [
        { ad: k.name, aciklama: k.description },
        ...altKomutlar(k).map((a) => ({ ad: `${k.name} ${a.tamAd}`, aciklama: a.description })),
      ]);
    const eslesen = adaylar
      .filter((a) => a.ad.includes(yazilan) || kucuk(a.aciklama).includes(yazilan))
      // Önce adı yazılanla başlayanlar, sonra ana komutlar
      .sort((a, b) => Number(!a.ad.startsWith(yazilan)) - Number(!b.ad.startsWith(yazilan)) || Number(a.ad.includes(' ')) - Number(b.ad.includes(' ')))
      .slice(0, 25);
    await interaction.respond(eslesen.map((a) => ({ name: kisalt(`/${a.ad} · ${a.aciklama}`, 100), value: a.ad })));
  },

  async execute(interaction) {
    const bolumler = bolumleriHazirla(interaction);
    const kimlik = await kimlikler(interaction.client);
    let durum = { sayfa: 'ana' };
    let uyari = null;
    const [istenen, istenenAlt] = komutAdi(interaction.options.getString('komut'));
    if (istenen) {
      const bolum = bolumler.find((b) => b.komutlar.some((k) => k.name === istenen));
      if (bolum) durum = { sayfa: bolum.id, komut: istenen, alt: istenenAlt ?? null };
      else uyari = `❌ \`/${istenen}\` diye kullanabileceğin bir komut yok. Aşağıdaki menüden bölüm bölüm bakabilirsin.`;
    }

    await interaction.reply({ ...sayfa(interaction, bolumler, kimlik, durum), ...(uyari && { content: uyari }), flags: MessageFlags.Ephemeral });
    const mesaj = await interaction.fetchReply();
    const toplayici = mesaj.createMessageComponentCollector({ time: ACIK_KALMA });
    toplayici.on('collect', (secim) => {
      const deger = secim.values?.[0];
      if (secim.customId === 'yardim-bolum') durum = { sayfa: deger };
      else if (secim.customId === 'yardim-gorev') durum = { sayfa: 'gorevler', gorev: deger };
      else if (secim.customId === 'yardim-komut') durum = { sayfa: durum.sayfa, komut: deger };
      else if (secim.customId === 'yardim-alt') durum = { ...durum, alt: deger };
      // content: null, varsa "böyle bir komut yok" uyarısını kaldırır
      secim.update({ ...sayfa(interaction, bolumler, kimlik, durum), content: null }).catch((hata) => console.error('Yardım sayfası gösterilemedi:', hata.message));
    });
    // Süre dolunca menü kaldırılır; ortada çalışmayan bir menü kalmasın
    toplayici.on('end', () => interaction.editReply({ components: [] }).catch(() => {}));
  },
};
