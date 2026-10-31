const {
  SlashCommandBuilder,
  ApplicationCommandOptionType: T,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  PermissionsBitField,
} = require('discord.js');
const REHBER = require('../yardim-rehberi');
const { GOREVLER, BASLANGIC } = require('../yardim-gorevler');
const ISLEMLER = require('../yardim-islemler');
const panel = require('../komut-paneli');
const { hataMetni } = require('../yardimci');

const RENK = 0x5865f2;
const ACIK_KALMA = 10 * 60 * 1000; // Menüler bu süre boyunca çalışır
const FORM_SURESI = 15 * 60 * 1000; // Açılan form bu süre içinde gönderilebilir

// Yardım bölümleri. Bir komut hiçbir bölümde yoksa "Diğer" bölümüne düşer.
const BOLUMLER = [
  { id: 'genel', simge: '🧭', ad: 'Genel', ozet: 'Herkesin kullanabildiği komutlar', komutlar: ['sor', 'ozetle', 'hatirlat', 'yardim'] },
  {
    id: 'moderasyon',
    simge: '🛡️',
    ad: 'Moderasyon',
    ozet: 'Uyarma, susturma, atma, yasaklama, mesaj temizleme',
    ipucu: '🖱️ **Daha hızlısı:** üyeye ya da mesaja sağ tıkla → **Uygulamalar → Moderasyon**. Uyar, sustur, at, yasakla ve mesajı sil düğmeleri çıkar; üyeyi seçmen gerekmez.',
    komutlar: ['uyari', 'sustur', 'kick', 'ban', 'unban', 'temizle'],
  },
  { id: 'guvenlik', simge: '🚨', ad: 'Güvenlik', ozet: 'Spam, küfür ve dolandırıcılık filtresi; acil durum kilidi', komutlar: ['koruma', 'kilit'] },
  { id: 'bildirim', simge: '📣', ad: 'Bildirimler', ozet: 'Oyun fırsatları, canlı yayınlar, haberler', komutlar: ['oyun', 'yayin', 'haber', 'instagram'] },
  { id: 'topluluk', simge: '🎉', ad: 'Topluluk', ozet: 'Seviyeler, çekilişler, rol menüleri', komutlar: ['seviye', 'cekilis', 'rolmenu'] },
  {
    id: 'sunucu',
    simge: '⚙️',
    ad: 'Sunucu ayarları',
    ozet: 'Ayarlar paneli, günlük, hoş geldin, otomatik rol, hazır kurulum',
    ipucu: '⚙️ **Bütün ayarlar tek kartta:** {ayarlar} paneli koruma, günlük, karşılama, seviye ve bildirimleri düğmelerle açıp kapatır.',
    komutlar: ['ayarlar', 'ayarla', 'sunucukur', 'sunucusil'],
  },
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
const moderatorMu = (interaction) => Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers));

// Bölümdeki, üyenin panelden çalıştırabildiği işlemler: alt komutu olan komutta her alt komut bir işlem.
// deger: "komut" ya da "komut alt"; menü ve düğmelerde bu değer taşınır.
function islemler(interaction, bolum) {
  return bolum.komutlar
    .filter((k) => panel.calistirilabilir(interaction, interaction.client.komutlar?.get(k.name)))
    .flatMap((k) => {
      const altlar = altKomutlar(k);
      const liste = altlar.length ? altlar.map((a) => ({ alt: a.tamAd, aciklama: a.description })) : [{ alt: null, aciklama: k.description }];
      return liste.map(({ alt, aciklama }) => {
        const deger = alt ? `${k.name} ${alt}` : k.name;
        return { komut: k.name, alt, deger, aciklama, bolum: bolum.id, simge: '▶️', ad: `/${deger}`, ...ISLEMLER[deger] };
      });
    });
}

// Menüden ya da düğmeden gelen işlem değeri gerçekten bu üyenin yapabildiği bir işlem mi?
// Değer kullanıcıdan geldiği için yalnızca listede olan kabul edilir.
const islemBul = (interaction, bolumler, deger) => bolumler.flatMap((b) => islemler(interaction, b)).find((i) => i.deger === deger) ?? null;

// --- Sayfalar ---
function anaSayfa(interaction, bolumler, gorevler) {
  const gecikme = interaction.client.ws?.ping ?? -1; // Bağlantı yeni kurulduysa -1
  return new EmbedBuilder()
    .setTitle(`${interaction.client.user.username} · Yardım`)
    .setColor(RENK)
    .setThumbnail(interaction.client.user.displayAvatarURL())
    .setDescription(
      [
        interaction.guildId
          ? '**Komut yazmana gerek yok.** Aşağıdaki menüden bir bölüm seç, sonra yapmak istediğin işi seç (ör. 🚨 Güvenlik → 🔒 Kilitle). Gereken bilgiler form olarak sorulur.'
          : 'Aşağıdaki menüden seç:',
        '',
        yoneticiMi(interaction) ? '⚙️ **Ayarlar paneli** · koruma, günlük, karşılama, seviye, bildirimler; aç/kapat düğmeleriyle (aşağıdaki düğme ya da `/ayarlar`)' : null,
        moderatorMu(interaction) ? '🖱️ **Tıklayarak moderasyon** · üyeye ya da mesaja sağ tıkla → Uygulamalar → Moderasyon' : null,
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

function bolumSayfasi(bolum, bag, isler = []) {
  const satir = (komut) => {
    const altlar = altKomutlar(komut).map((s) => s.tamAd);
    return altlar.length
      ? `**/${komut.name}** · ${komut.description}\n-# ${altlar.map((ad) => bag(komut.name, ad)).join(' · ')}`
      : `${bag(komut.name)} · ${komut.description}`;
  };
  return new EmbedBuilder()
    .setTitle(`${bolum.simge} ${bolum.ad}`)
    .setColor(RENK)
    .setDescription(kisalt([bolum.ipucu ? baglantila(bolum.ipucu, bag) : null, ...bolum.komutlar.map(satir)].filter(Boolean).join('\n\n'), 4096))
    .setFooter({
      text: isler.length
        ? '⚡ Bir işi hemen yapmak için "Ne yapmak istiyorsun?" menüsünden seç · Komutun ayrıntısı için alttaki menüden.'
        : 'Ayrıntı için aşağıdaki ikinci menüden komutu seç.',
    });
}

// Komutun genel sayfası: ne işe yaradığı, kimin kullanabileceği, alt komutları (birer satır), örnekler.
// Alt komutların seçenekleri kendi sayfalarında; alt komutu olmayan komutun seçenekleri burada.
// panelli: sayfanın altında komutu çalıştıran düğmeler var
const PANEL_NOTU = 'Aşağıdaki düğmeye basınca gereken bilgiler form olarak sorulur; komutu yazmana gerek yok.';
function komutSayfasi(komut, kimlik, { panelli = false } = {}) {
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
  if (panelli) return embed.setFooter({ text: PANEL_NOTU });
  return embed.setFooter({ text: altlar.length ? 'Bir alt komutun seçenekleri ve örnekleri için alt komut menüsünden seç.' : 'Komutu yazarken Discord seçenekleri adım adım sorar; zorunlu olmayanları boş bırakabilirsin.' });
}

// Alt komutun ayrıntılı sayfası: açıklama, elle yazılmış anlatım, bütün seçenekleri, kendi örnekleri ve notları
function altKomutSayfasi(komut, altAd, kimlik, { panelli = false } = {}) {
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
  return embed.setFooter({ text: panelli ? PANEL_NOTU : `Komutun genel sayfası ve diğer alt komutlar: /yardim komut:${komut.name}` });
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
// İşlem menüsünde seçili değer gösterilmez: aynı işlem art arda seçilebilsin. surum her çizimde değişir;
// Discord, seçim kutusunu yalnızca kimliği değişince sıfırlar.
const islemMenusu = (isler, surum) =>
  menu(`yardim-islem:${surum}`, '⚡ Ne yapmak istiyorsun?', isler.map((i) => ({ label: kisalt(i.ad, 100), description: kisalt(i.aciklama, 100), value: i.deger, emoji: i.simge })));
const komutMenusu = (bolum, secili) =>
  menu('yardim-komut', '📖 Bir komutun ayrıntısına bak', bolum.komutlar.map((k) => ({ label: `/${k.name}`, description: kisalt(k.description, 100), value: k.name, default: k.name === secili })));
const altMenusu = (komut, secili) =>
  menu(
    'yardim-alt',
    '📖 Bir alt komutun ayrıntısına bak',
    altKomutlar(komut).map((a) => ({ label: `/${komut.name} ${a.tamAd}`, description: kisalt(a.description, 100), value: a.tamAd, default: a.tamAd === secili })),
  );

const dugme = (customId, etiket, stil, simge) => {
  const d = new ButtonBuilder().setCustomId(customId).setLabel(kisalt(etiket, 80)).setStyle(stil);
  return simge ? d.setEmoji(simge) : d;
};
const islemDugmesi = (i) => dugme(`yardim-calistir:${i.deger}`, i.ad, i.tehlikeli ? ButtonStyle.Danger : ButtonStyle.Primary, i.simge);
const vazgecDugmesi = () => dugme('yardim-vazgec', 'Vazgeç', ButtonStyle.Secondary);

// Komutun işlem düğmeleri (ör. /kilit sayfasında 🔒 Kilitle · 🔓 Kilidi aç). Bir satıra en fazla 5 düğme sığar;
// daha fazla alt komutu olan komutta yalnızca seçili alt komutun düğmesi gösterilir.
function dugmeSatiri(isler, alt) {
  const gosterilen = isler.length <= 5 ? isler : isler.filter((i) => i.alt === alt);
  return gosterilen.length ? new ActionRowBuilder().addComponents(gosterilen.map(islemDugmesi)) : null;
}

// Formu 5 alandan fazla olan işlem (ör. /oyun ayar): önce hangi seçeneklerin doldurulacağı seçilir.
// Zorunlu alanlar her zaman formdadır.
function alanSecimSatirlari(islem, alanlar) {
  const zorunlu = alanlar.filter((a) => a.zorunlu).length;
  const secmeli = alanlar.map((a, sira) => ({ a, sira })).filter(({ a }) => !a.zorunlu);
  const satirlar = [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`yardim-alanlar:${islem.deger}`)
        .setPlaceholder('Değiştirmek istediğin seçenekleri seç')
        .setMinValues(1)
        .setMaxValues(Math.min(panel.FORM_SINIRI - zorunlu, secmeli.length))
        .addOptions(secmeli.slice(0, 25).map(({ a, sira }) => ({ label: kisalt(a.etiket, 100), value: String(sira), ...(a.aciklama && { description: a.aciklama }) }))),
    ),
  ];
  const dugmeler = [vazgecDugmesi()];
  if (!zorunlu) dugmeler.unshift(dugme(`yardim-bos:${islem.deger}`, 'Seçeneksiz çalıştır', ButtonStyle.Primary, '▶️'));
  satirlar.push(new ActionRowBuilder().addComponents(dugmeler));
  return satirlar;
}

// İşlemin form alanları; komutun tanımından okunur
const islemAlanlari = (bolum, islem) => {
  const hedef = panel.hedefBul(bolum.komutlar.find((k) => k.name === islem.komut), islem.alt);
  return { hedef, alanlar: panel.alanlariHazirla(hedef.secenekler) };
};

// durum: { sayfa: 'ana' | 'baslangic' | 'gorevler' | bölüm kimliği, gorev, komut, alt, onay, alanSecimi, surum }
// onay: onay bekleyen işlemin değeri · alanSecimi: hangi seçeneklerin doldurulacağı sorulan işlemin değeri
function sayfa(interaction, bolumler, kimlik, durum) {
  const bag = baglayici(kimlik);
  const gorevler = gorevleriHazirla(bolumler, interaction.memberPermissions);
  const bolum = bolumler.find((b) => b.id === durum.sayfa);
  const komut = bolum && durum.komut ? bolum.komutlar.find((k) => k.name === durum.komut) : null;
  const alt = komut && durum.alt && altKomutlar(komut).some((a) => a.tamAd === durum.alt) ? durum.alt : null;
  const gorev = durum.sayfa === 'gorevler' ? gorevler.find((g) => g.id === durum.gorev) : null;
  const isler = bolum ? islemler(interaction, bolum) : [];
  const komutIsleri = komut ? isler.filter((i) => i.komut === komut.name) : [];
  const panelli = komutIsleri.length > 0;
  const onay = komutIsleri.find((i) => i.deger === durum.onay);
  const alanSecimi = komutIsleri.find((i) => i.deger === durum.alanSecimi);

  let embed;
  if (alt) embed = altKomutSayfasi(komut, alt, kimlik, { panelli });
  else if (komut) embed = komutSayfasi(komut, kimlik, { panelli });
  else if (bolum) embed = bolumSayfasi(bolum, bag, isler);
  else if (gorev) embed = gorevSayfasi(gorev, bag);
  else if (durum.sayfa === 'gorevler' && gorevler.length) embed = gorevlerSayfasi(gorevler);
  else if (durum.sayfa === 'baslangic') embed = baslangicSayfasi(interaction, bag);
  else embed = anaSayfa(interaction, bolumler, gorevler);

  const secili = bolum ? bolum.id : ['baslangic', 'gorevler'].includes(durum.sayfa) && (durum.sayfa !== 'gorevler' || gorevler.length) ? durum.sayfa : 'ana';
  const satirlar = [bolumMenusu(bolumler, gorevler, secili)];
  let content = null;
  if (secili === 'gorevler') satirlar.push(gorevMenusu(gorevler, gorev?.id));
  // Ana sayfa ve başlangıçta ayarlar paneline kısa yol. "ay:" düğmesini bu panel değil ayarlar paneli işler
  // (index.js); paneli yeni bir mesajda açar.
  if (['ana', 'baslangic'].includes(secili) && interaction.guildId && yoneticiMi(interaction)) {
    satirlar.push(new ActionRowBuilder().addComponents(dugme('ay:ac', 'Ayarlar paneli', ButtonStyle.Success, '⚙️')));
  }
  if (bolum) {
    if (isler.length) satirlar.push(islemMenusu(isler, durum.surum ?? 0));
    satirlar.push(komutMenusu(bolum, komut?.name));
  }
  if (alanSecimi) {
    const { alanlar } = islemAlanlari(bolum, alanSecimi);
    content = `${alanSecimi.simge} **${alanSecimi.ad}**: bu işlemin ${alanlar.length} seçeneği var, bir formda en fazla ${panel.FORM_SINIRI} tanesi sorulabilir. Değiştirmek istediklerini aşağıdan seç; seçmediklerin olduğu gibi kalır.`;
    satirlar.push(...alanSecimSatirlari(alanSecimi, alanlar));
  } else {
    if (komut && altKomutlar(komut).length) satirlar.push(altMenusu(komut, alt));
    if (onay) {
      content = `⚠️ **${onay.simge} ${onay.ad}**: geri alınması zor bir işlem. Emin misin?`;
      satirlar.push(new ActionRowBuilder().addComponents(dugme(`yardim-onay:${onay.deger}`, `Evet: ${onay.ad}`, ButtonStyle.Danger, onay.simge), vazgecDugmesi()));
    } else if (panelli) {
      const satir = dugmeSatiri(komutIsleri, alt);
      if (satir) satirlar.push(satir);
    }
  }
  return { embeds: [embed], components: satirlar, content };
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
    .setDescription('Komut paneli: işini menüden seçip komut yazmadan yap; rehberler ve başlangıç adımları')
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
    let surum = 0;
    const [istenen, istenenAlt] = komutAdi(interaction.options.getString('komut'));
    if (istenen) {
      const bolum = bolumler.find((b) => b.komutlar.some((k) => k.name === istenen));
      if (bolum) durum = { sayfa: bolum.id, komut: istenen, alt: istenenAlt ?? null };
      else uyari = `❌ \`/${istenen}\` diye kullanabileceğin bir komut yok. Aşağıdaki menüden bölüm bölüm bakabilirsin.`;
    }
    // content: null, varsa "böyle bir komut yok" uyarısını kaldırır
    const ciz = () => sayfa(interaction, bolumler, kimlik, { ...durum, surum: ++surum });

    const { content, ...ilk } = ciz();
    await interaction.reply({ ...ilk, ...((uyari ?? content) && { content: uyari ?? content }), flags: MessageFlags.Ephemeral });
    const mesaj = await interaction.fetchReply();
    // Yalnızca bu panelin düğmeleri; "ay:" gibi kalıcı düğmeleri kendi modülleri işler (index.js)
    const toplayici = mesaj.createMessageComponentCollector({ time: ACIK_KALMA, filter: (i) => i.customId.startsWith('yardim-') });
    // Paneli yeniden çizer (ör. işlem çalıştıktan sonra onay düğmelerini kaldırmak, işlem menüsünü sıfırlamak için).
    // Süre dolduysa çizilmez; menüler kaldırılmış kalır.
    const yenile = () => (toplayici.ended ? null : interaction.editReply(ciz()).catch(() => {}));

    // Formu açar, gönderilince komutu formdaki değerlerle çalıştırır
    async function formAc(secim, islem, modul, hedef, alanlar) {
      const customId = `yardim-form:${secim.id}`;
      const form = await panel.formKur({ interaction: secim, komut: modul, hedef, alanlar, customId, baslik: `${islem.simge} ${islem.ad}` });
      await secim.showModal(form);
      await yenile();
      // Form kapatılırsa hiçbir şey gelmez; süre dolunca bekleme biter
      const gonderim = await secim.awaitModalSubmit({ time: FORM_SURESI, filter: (m) => m.customId === customId && m.user.id === secim.user.id }).catch(() => null);
      if (!gonderim) return;
      const { degerler, hatalar } = panel.formuOku(gonderim, alanlar);
      if (hatalar.length) return gonderim.reply({ content: `❌ ${hatalar.join('\n')}\nDüğmeye yeniden basıp formu düzelterek gönder.`, flags: MessageFlags.Ephemeral });
      await panel.calistir(gonderim, modul, hedef, degerler);
    }

    // Menüden ya da düğmeden gelen işlem isteği
    async function islemYap(secim, tur, deger) {
      const islem = islemBul(secim, bolumler, deger);
      if (!islem) {
        durum = { ...durum, onay: null, alanSecimi: null };
        return secim.update(ciz());
      }
      const bolum = bolumler.find((b) => b.id === islem.bolum);
      const modul = interaction.client.komutlar.get(islem.komut);
      const { hedef, alanlar } = islemAlanlari(bolum, islem);
      durum = { sayfa: bolum.id, komut: islem.komut, alt: islem.alt };

      const calistirVeYenile = async (degerler) => {
        await panel.calistir(secim, modul, hedef, degerler);
        await yenile();
      };
      if (tur === 'yardim-onay' || tur === 'yardim-bos') return calistirVeYenile();
      if (tur === 'yardim-alanlar') {
        // Seçilen sıra numaraları da kullanıcıdan gelir; yalnızca bu işlemin seçmeli alanları kabul edilir
        const secilen = new Set((secim.values ?? []).map(Number));
        const formdakiler = alanlar.filter((a, sira) => a.zorunlu || secilen.has(sira)).slice(0, panel.FORM_SINIRI);
        return formAc(secim, islem, modul, hedef, formdakiler);
      }
      if (!alanlar.length) {
        // Seçeneği olmayan, geri alınması zor işlem (ör. kilitleme): önce onay
        if (islem.tehlikeli) {
          durum.onay = islem.deger;
          return secim.update(ciz());
        }
        return calistirVeYenile();
      }
      if (alanlar.length > panel.FORM_SINIRI) {
        durum.alanSecimi = islem.deger;
        return secim.update(ciz());
      }
      return formAc(secim, islem, modul, hedef, alanlar);
    }

    async function secildi(secim) {
      // customId "tür:değer" biçiminde; değer işlemin adıdır (ör. "yardim-calistir:kilit kapat")
      const [tur, ...kalan] = secim.customId.split(':');
      const ek = kalan.join(':');
      const deger = secim.values?.[0];
      if (tur === 'yardim-islem') return islemYap(secim, tur, deger);
      if (['yardim-calistir', 'yardim-onay', 'yardim-bos', 'yardim-alanlar'].includes(tur)) return islemYap(secim, tur, ek);
      if (tur === 'yardim-bolum') durum = { sayfa: deger };
      else if (tur === 'yardim-gorev') durum = { sayfa: 'gorevler', gorev: deger };
      else if (tur === 'yardim-komut') durum = { sayfa: durum.sayfa, komut: deger };
      else if (tur === 'yardim-alt') durum = { sayfa: durum.sayfa, komut: durum.komut, alt: deger };
      else if (tur === 'yardim-vazgec') durum = { ...durum, onay: null, alanSecimi: null };
      return secim.update(ciz());
    }

    toplayici.on('collect', (secim) => secildi(secim).catch((hata) => console.error('Yardım paneli:', hataMetni(hata))));
    // Süre dolunca menü kaldırılır; ortada çalışmayan bir menü kalmasın
    toplayici.on('end', () => interaction.editReply({ components: [] }).catch(() => {}));
  },
};
