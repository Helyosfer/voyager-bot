// Sunucu kurulumu (/ayarlar → Kurulum → Hazır sunucu şablonu) ve kurulan sunucudaki akışlar: üyelik onayı, ilgi ve bildirim
// rolleri, destek talepleri. Şablonlar (roller, kategoriler, kanallar, izinler) sablonlar.js'te.
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits: P,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  SnowflakeUtil,
  escapeMarkdown,
} = require('discord.js');
const { ayarlariGetir, ayarKaydet } = require('./depo');
const { beklemeSayaci, neZaman } = require('./yardimci');
const { icerikOkunabilir } = require('./koruma');
const { SABLONLAR, POLITIKALAR, ERISIMLER, DESTEK, GOR, YAZ, BOT, rolleri } = require('./sablonlar');

// Bir şablonun üyelerin kendisi seçtiği (ilgi ve bildirim) rolleri
const ilgiRolleri = (sablon) => rolleri(sablon).filter((r) => r.ilgi);
// Kurulum bilgisi şablon adı taşımıyorsa (eski kurulum) topluluk şablonudur
const kurulumSablonu = (t) => SABLONLAR[t?.sablon] ?? SABLONLAR.topluluk;
const RENK = 0x5865f2;
const turu = (kanal) => (kanal.ses ? ChannelType.GuildVoice : ChannelType.GuildText);

// Şablonu sunucunun mevcut haliyle karşılaştırır. Aynı adda olan öğeler "mevcut" sayılır
// ve onlara dokunulmaz. ayarlar: kurulumla açılacak varsayılanlar (zaten ayarlı olanlar ve
// botun kullanamayacakları atlanır).
function planla(guild, sablonAdi = 'topluluk') {
  const sablon = SABLONLAR[sablonAdi];
  const kanallar = [...guild.channels.cache.values()];
  const roller = [...guild.roles.cache.values()];
  const plan = { sablon: sablonAdi, roller: [], kategoriler: [], ayarlar: [], atlanan: [], yeni: 0, mevcut: 0 };
  const say = (bulunan) => (bulunan ? plan.mevcut++ : plan.yeni++);

  for (const rol of rolleri(sablon)) {
    const mevcut = roller.find((r) => r.name === rol.ad) ?? null;
    say(mevcut);
    plan.roller.push({ ...rol, mevcut });
  }
  for (const kategori of sablon.kategoriler) {
    const mevcut = kanallar.find((k) => k.type === ChannelType.GuildCategory && k.name === kategori.ad) ?? null;
    say(mevcut);
    const alt = kategori.kanallar.map((kanal) => {
      const bulunan = kanallar.find((k) => k.type === turu(kanal) && k.name === kanal.ad) ?? null;
      say(bulunan);
      return { ...kanal, mevcut: bulunan };
    });
    plan.kategoriler.push({ ...kategori, mevcut, kanallar: alt });
  }

  const ayar = ayarlariGetir(guild.id);
  for (const varsayilan of sablon.ayarlar ?? []) {
    // Sunucu bu ayarı daha önce (açık ya da kapalı) seçtiyse ona dokunulmaz
    if (ayar[varsayilan.anahtar] !== undefined) continue;
    if (varsayilan.icerik && !icerikOkunabilir(guild.client)) plan.atlanan.push(varsayilan);
    else plan.ayarlar.push(varsayilan);
  }
  return plan;
}

// Planı uygular. ilerleme(metin) varsa her kategoriden sonra çağrılır.
async function kur(guild, plan, yapan, ilerleme = async () => {}) {
  const sablon = SABLONLAR[plan.sablon];
  const sebep = `Voyager sunucu kurulumu (${yapan})`;
  const ben = guild.members.me;
  const sonuc = { olusturulan: 0, baglanan: [], acilan: [], uyarilar: [], hata: null };
  const roller = {};
  // Bot yalnızca kendisinde olan izinleri verebilir ya da yasaklayabilir
  const suz = (izinler) => izinler.filter((izin) => ben.permissions.has(izin));

  // Şablonda olmayan rollerin kuralları atlanır
  const izinListesi = (kurallar) => [
    ...kurallar
      .map(({ rol, izin, yasak }) => ({
        id: rol === 'herkes' ? guild.roles.everyone.id : roller[rol]?.id,
        allow: suz(izin),
        deny: suz(yasak),
      }))
      .filter((k) => k.id),
    { id: ben.id, allow: suz(BOT) },
  ];

  try {
    for (const rol of plan.roller) {
      roller[rol.k] =
        rol.mevcut ??
        (await guild.roles.create({
          name: rol.ad,
          colors: { primaryColor: rol.renk },
          hoist: Boolean(rol.ayri),
          // Bildirim rolleri etiketlenebilir: bot ve yöneticiler duyurularda kullanır
          mentionable: Boolean(rol.bildirim),
          permissions: suz(rol.izinler ?? []),
          reason: sebep,
        }));
      if (!rol.mevcut) sonuc.olusturulan++;
    }

    // Yeni rolleri hiyerarşiye diz: listenin başındaki en üstte. Yalnızca bu kurulumda
    // oluşturulanlar taşınır; mevcut rollerin sırasına dokunulmaz.
    const yeniRoller = plan.roller.filter((r) => !r.mevcut).map((r) => roller[r.k]);
    if (yeniRoller.length) {
      await guild.roles
        .setPositions(yeniRoller.map((rol, i) => ({ role: rol.id, position: yeniRoller.length - i })))
        .catch(() => sonuc.uyarilar.push('Roller sıralanamadı; Sunucu Ayarları → Roller bölümünden elle sıralaman gerekebilir.'));
    }

    const kanallar = {};
    const kategoriler = {};
    for (const kategori of plan.kategoriler) {
      const ust =
        kategori.mevcut ??
        (await guild.channels.create({
          name: kategori.ad,
          type: ChannelType.GuildCategory,
          permissionOverwrites: izinListesi(POLITIKALAR[kategori.politika]),
          reason: sebep,
        }));
      if (!kategori.mevcut) sonuc.olusturulan++;
      if (kategori.anahtar) kategoriler[kategori.anahtar] = ust.id;

      for (const kanal of kategori.kanallar) {
        const olusan =
          kanal.mevcut ??
          (await guild.channels.create({
            name: kanal.ad,
            type: turu(kanal),
            parent: ust.id,
            topic: kanal.ses ? undefined : kanal.konu,
            rateLimitPerUser: kanal.ses ? undefined : kanal.yavas,
            // İzin verilmezse kanal kategorisiyle eşitlenmiş (senkron) oluşur
            permissionOverwrites: kanal.erisim ? izinListesi(ERISIMLER[kanal.erisim]) : undefined,
            reason: sebep,
          }));
        if (!kanal.mevcut) sonuc.olusturulan++;
        if (kanal.anahtar) kanallar[kanal.anahtar] = { id: olusan.id, yeni: !kanal.mevcut, kanal: olusan };
        if (kanal.ayar) {
          ayarKaydet(guild.id, kanal.ayar, olusan.id);
          sonuc.baglanan.push(`${olusan} → ${AYAR_ADLARI[kanal.ayar]}`);
        }
      }
      await ilerleme(`⏳ Kuruluyor… **${kategori.ad}** tamam (${sonuc.olusturulan} öğe)`).catch(() => {});
    }

    // Akışların (onay, roller, destek) kullanacağı kimlikleri sakla
    ayarKaydet(guild.id, 'topluluk', {
      sablon: plan.sablon,
      roller: Object.fromEntries(Object.entries(roller).map(([k, r]) => [k, r.id])),
      kanallar: Object.fromEntries(Object.entries(kanallar).map(([k, v]) => [k, v.id])),
      kategoriler,
    });

    // Yeni gelenler "Yeni Gelen" rolüyle başlar; onay düğmesi "Üye"ye çevirir
    if (sablon.onay && roller.yeni) {
      if (roller.yeni.position < ben.roles.highest.position) {
        ayarKaydet(guild.id, 'otoRol', roller.yeni.id);
        sonuc.baglanan.push(`Yeni gelenlere ${roller.yeni} rolü verilecek`);
      } else {
        sonuc.uyarilar.push('"Yeni Gelen" rolü benim rolümün üstünde olduğu için otomatik veremiyorum. Voyager rolünü yukarı taşı.');
      }
    }

    // Varsayılan ayarlar ve bildirimlerde etiketlenecek roller (önceden seçilmiş olanlara dokunulmaz)
    for (const { anahtar, deger, ad } of plan.ayarlar) {
      ayarKaydet(guild.id, anahtar, deger);
      sonuc.acilan.push(ad);
    }
    const mevcutAyar = ayarlariGetir(guild.id);
    for (const [anahtar, rolAnahtari] of Object.entries(sablon.rolAyarlari ?? {})) {
      if (mevcutAyar[anahtar] || !roller[rolAnahtari]) continue;
      ayarKaydet(guild.id, anahtar, roller[rolAnahtari].id);
      sonuc.baglanan.push(`${AYAR_ADLARI[anahtar]} → ${roller[rolAnahtari]} etiketlenecek`);
    }

    // Tanıtım mesajları yalnızca bu kurulumda oluşturulan kanallara atılır
    for (const [anahtar, hazirla] of Object.entries(MESAJLAR)) {
      if (kanallar[anahtar]?.yeni) await kanallar[anahtar].kanal.send(hazirla(kanallar, sablon)).catch(() => {});
    }
  } catch (hata) {
    sonuc.hata = hata.message;
  }
  return sonuc;
}

const AYAR_ADLARI = {
  logKanali: 'sunucu günlüğü',
  hosgeldinKanali: 'hoş geldin mesajları',
  oyunKanali: 'oyun fırsatları',
  yayinKanali: 'yayın bildirimleri',
  haberKanali: 'haber bildirimleri',
  oyunRol: 'Oyun fırsatlarında',
  yayinRol: 'Yayın bildirimlerinde',
  haberRol: 'Haber bildirimlerinde',
};

const etiket = (kanallar, anahtar) => (kanallar[anahtar] ? `<#${kanallar[anahtar].id}>` : `#${anahtar}`);
const kart = (baslik, aciklama) => new EmbedBuilder().setTitle(baslik).setColor(RENK).setDescription(aciklama);

// Kanallara atılan ilk mesajlar. k: bu kurulumdaki anahtarlı kanallar
const MESAJLAR = {
  hosgeldin: (k) => {
    // Şablonda olmayan kanallar (ör. onaysız sunucuda üyelik onayı) atlanır
    const adimlar = [
      k.kurallar && `${etiket(k, 'kurallar')} kanalını oku.`,
      k.onay && `${etiket(k, 'onay')} kanalındaki düğmeye basarak üye ol.`,
      k.rol && `${etiket(k, 'rol')} kanalından ilgi alanlarını ve bildirim rollerini seç.`,
      k.destek && `Yardıma ihtiyacın olursa ${etiket(k, 'destek')} kanalından özel destek odası aç.`,
    ].filter(Boolean);
    return {
      embeds: [
        kart(
          '👋 Hoş geldin!',
          [...adimlar.map((a, i) => `**${i + 1}.** ${a}`), adimlar.length ? '' : null, 'Güvenliğin için şifre, token ya da adres gibi özel bilgilerini kimseyle paylaşma.']
            .filter((s) => s !== null)
            .join('\n'),
        ),
      ],
    };
  },
  kurallar: () => ({
    embeds: [
      kart(
        '📜 Sunucu kuralları',
        [
          '**1.** Herkese saygılı davran. Taciz, nefret söylemi ve hedef gösterme yasaktır.',
          '**2.** Spam, flood, izinsiz reklam ve davet bağlantısı paylaşma.',
          '**3.** Kişisel bilgileri, şifreleri, API anahtarlarını ya da tokenları paylaşma.',
          '**4.** Telif ihlali, dolandırıcılık, zararlı yazılım ve izinsiz erişim yönlendirmesi paylaşma.',
          '**5.** Tartışmalarda konuya odaklan; sürprizbozan ve hassas içerikleri belirt.',
          '**6.** Yönetimin kararlarına itirazını saygılı biçimde, özelden ilet.',
          '**7.** Yetkililer senden asla şifre ya da token istemez. Şüpheli bir durumu bildir.',
          '',
          'Sunucuda bulunmak bu kurallara uymayı kabul ettiğin anlamına gelir.',
        ].join('\n'),
      ).setFooter({ text: 'Bu metni sunucuna göre düzenleyebilirsin.' }),
    ],
  }),
  // Rehber, şablondaki kategorilerin açıklamalarından oluşur
  rehber: (k, sablon) => ({
    embeds: [kart('🧭 Sunucu rehberi', sablon.kategoriler.filter((c) => c.rehber).map((c) => `**${c.ad.replace('・', ' ')}** · ${c.rehber}`).join('\n'))],
  }),
  onay: () => ({
    embeds: [kart('✅ Üyeliğini etkinleştir', 'Kuralları okuyup kabul ettikten sonra aşağıdaki düğmeye bas. **Üye** rolünü alırsın ve topluluk kanalları açılır.')],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tp:onay').setLabel('Kuralları okudum, üye ol').setEmoji('✅').setStyle(ButtonStyle.Success))],
  }),
  rol: (k, sablon) => {
    const secenekler = ilgiRolleri(sablon);
    return {
      embeds: [
        kart(
          '🎭 Roller',
          'Aşağıdaki menüden ilgi alanlarını ve bildirim rollerini seç. Bildirim rolü aldığın konuda (ör. oyun fırsatları, yayınlar, haberler) bir bildirim gelince etiketlenirsin; almadığın konularda rahatsız edilmezsin. Birden fazla seçebilir, istediğin zaman değiştirebilirsin; seçmediklerin kaldırılır.',
        ),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('tp:rol')
            .setPlaceholder('Rollerini seç')
            .setMinValues(0)
            .setMaxValues(secenekler.length)
            .addOptions(
              secenekler.map((r) => ({
                label: r.ad.replace(/^\S+\s/, ''),
                value: r.k,
                description: r.ilgi,
                emoji: r.ad.split(' ')[0],
              })),
            ),
        ),
      ],
    };
  },
  destek: () => ({
    embeds: [kart('🆘 Özel destek talebi', 'Düğmeye basıp konuyu kısaca yaz. Yalnızca senin ve destek ekibinin görebildiği bir oda açılır. İşin bitince odadaki **Talebi kapat** düğmesini kullan.')],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tp:talep').setLabel('Destek talebi aç').setEmoji('🎫').setStyle(ButtonStyle.Primary))],
  }),
};

// ---------------------------------------------------------------------------
// Akışlar: düğme, menü ve form etkileşimleri (customId "tp:" ile başlar)
// ---------------------------------------------------------------------------
// Rol işlemleri Discord'un 3 saniyelik cevap süresini aşabilir; o yüzden önce ertelenir (beklet)
// ve cevap sonradan yazılır
const gizli = (interaction, content) =>
  interaction.deferred ? interaction.editReply({ content }) : interaction.reply({ content, flags: MessageFlags.Ephemeral });
const beklet = (interaction) => interaction.deferReply({ flags: MessageFlags.Ephemeral });

async function uyeOl(interaction, t) {
  const { member, guild } = interaction;
  const uye = guild.roles.cache.get(t.roller.uye);
  if (!uye) return gizli(interaction, '❌ Üye rolü bulunamadı. Bir yöneticiye haber ver.');
  if (member.roles.cache.has(uye.id)) return gizli(interaction, 'Üye rolün zaten var. Hoş geldin!');
  await beklet(interaction);
  try {
    await member.roles.add(uye, 'Üyelik onayı');
    if (member.roles.cache.has(t.roller.yeni)) await member.roles.remove(t.roller.yeni, 'Üyelik onayı tamamlandı');
  } catch {
    return gizli(interaction, '❌ Rol veremedim. Bir yönetici Voyager rolünü rol listesinde yukarı taşımalı.');
  }
  return gizli(interaction, `✅ Üyeliğin etkinleştirildi! ${t.kanallar.rol ? `<#${t.kanallar.rol}> kanalından ilgi alanlarını seçebilirsin.` : ''}`);
}

async function rolSec(interaction, t) {
  const { member } = interaction;
  // Üyelik onayı olmayan şablonlarda (Üye rolü yok) herkes seçebilir
  if (t.roller.uye && !member.roles.cache.has(t.roller.uye)) {
    return gizli(interaction, `❌ Önce ${t.kanallar.onay ? `<#${t.kanallar.onay}>` : 'üyelik onayı'} kanalından üye ol.`);
  }
  const secilen = new Set(interaction.values);
  const verilen = [];
  await beklet(interaction);
  try {
    for (const rol of ilgiRolleri(kurulumSablonu(t))) {
      const id = t.roller[rol.k];
      if (!id) continue;
      if (secilen.has(rol.k)) {
        if (!member.roles.cache.has(id)) await member.roles.add(id, 'İlgi rolü seçimi');
        verilen.push(rol.ad);
      } else if (member.roles.cache.has(id)) await member.roles.remove(id, 'İlgi rolü seçimi');
    }
  } catch {
    return gizli(interaction, '❌ Rolleri güncelleyemedim. Bir yönetici Voyager rolünü rol listesinde yukarı taşımalı.');
  }
  return gizli(interaction, verilen.length ? `✅ Rollerin güncellendi: ${verilen.join(', ')}` : '✅ Bütün ilgi rollerin kaldırıldı.');
}

// Konu "sahip=<kimlik>; konu=<üyenin yazdığı metin>" biçimindedir. Sahip yalnızca baştan
// okunur: üye konuya başkasının kimliğini yazarak onun talep açmasını engelleyemesin.
const acikTalep = (guild, t, uyeId) =>
  guild.channels.cache.find((k) => k.parentId === t.kategoriler.talepler && k.topic?.startsWith(`sahip=${uyeId};`) && !k.name.startsWith('kapalı-'));

// --- Destek odalarının sınırları ---
// Kapatılan oda hemen silinmez, ama süresiz de durmaz. Yoksa bir üye aç-kapat yaparak kategoriyi
// doldurur (Discord bir kategoride en fazla 50 kanala izin verir) ve kimse talep açamaz.
const TALEP_ARALIGI = 10 * 60_000; // Bir üye bu aralıktan sık talep açamaz
const KAPALI_ODA_OMRU = 30 * 24 * 60 * 60_000; // Kapalı oda bu kadar süre sonra silinir
const UYE_BASI_KAPALI_ODA = 3; // Bir üyenin saklanan kapalı oda sayısı; fazlası en eskiden başlayarak silinir
// Yukarıdakiler hesap başınadır; çok sayıda hesap kullanan biri için ayrıca sunucu geneli sınırlar:
const SUNUCU_SAATLIK_TALEP = 15; // Bir sunucuda bir saatte açılabilen talep sayısı
const KATEGORI_ESIGI = 40; // Kategori bu kadar kanala ulaşınca en eski kapalı odalar silinir (Discord sınırı 50)
// Aynı anda açık oda sayısı. Eşikten küçük olduğu için kategori açık odalarla doldurulamaz:
// kapalı odalar eşikte silinir, açık odalar bu sınırı geçemez.
const ACIK_ODA_SINIRI = 25;
const UYELIK_BEKLEMESI = 10 * 60_000; // Sunucuya yeni katılan bu süre dolmadan talep açamaz
const SAAT = 60 * 60_000;
const talepSayaci = beklemeSayaci(TALEP_ARALIGI);
const sinirUyarisi = beklemeSayaci(SAAT);
const sonTalepler = new Map(); // sunucuId -> son bir saatte açılan taleplerin zamanları

function sonSaattekiler(sunucuId) {
  const liste = (sonTalepler.get(sunucuId) ?? []).filter((zaman) => Date.now() - zaman < SAAT);
  sonTalepler.set(sunucuId, liste);
  return liste;
}

// Talep açılamıyorsa üyeye gösterilecek mesajı döndürür, açılabiliyorsa null.
// Ekibe destek kayıt kanalından haber verir; aynı türden uyarı en sık saatte bir yazılır
async function ekibeHaber(interaction, t, tur, metin) {
  const anahtar = `${interaction.guildId}:${tur}`;
  if (sinirUyarisi.bekle(anahtar)) return;
  sinirUyarisi.isaretle(anahtar);
  await kayitYaz(interaction.guild, t, metin);
}

async function talepBeklemesi(interaction, t) {
  // Yeni açılmış hesaplarla sunucuya girip hemen oda açmaya karşı
  const katildi = interaction.member?.joinedTimestamp;
  if (katildi && Date.now() - katildi < UYELIK_BEKLEMESI) {
    return `⏳ Sunucuya yeni katıldın. Destek talebi açabileceğin zaman: ${neZaman(katildi + UYELIK_BEKLEMESI - Date.now())}`;
  }
  const kalan = talepSayaci.bekle(`${interaction.guildId}:${interaction.user.id}`);
  if (kalan) return `⏳ Az önce bir destek talebi açtın. Yenisini açabileceğin zaman: ${neZaman(kalan)}`;

  const acik = interaction.guild.channels.cache.filter((k) => k.parentId === t.kategoriler.talepler && !k.name.startsWith('kapalı-')).size;
  if (acik >= ACIK_ODA_SINIRI) {
    await ekibeHaber(interaction, t, 'acik', `⚠️ Aynı anda ${ACIK_ODA_SINIRI} destek odası açık; biri kapanana kadar yeni talep açılamaz. Biten talepleri kapat; kötüye kullanım varsa hesapları sunucudan at.`);
    return '⏳ Destek ekibi şu an çok yoğun, yeni talep açılamıyor. Biraz sonra yeniden dene.';
  }
  if (sonSaattekiler(interaction.guildId).length >= SUNUCU_SAATLIK_TALEP) {
    await ekibeHaber(interaction, t, 'saatlik', `⚠️ Son bir saatte ${SUNUCU_SAATLIK_TALEP} destek talebi açıldı; yenileri bir süre reddedilecek. Kötüye kullanım olabilir: açılan odalara bak.`);
    return '⏳ Şu an çok fazla destek talebi açılıyor. Biraz sonra yeniden dene.';
  }
  return null;
}

const odaSahibi = (kanal) => /^sahip=(\d+);/.exec(kanal.topic ?? '')?.[1] ?? null;
// Kapanma zamanı ayrıca saklanmaz: odadaki son mesajın (çoğunlukla "kapatıldı" mesajı) zamanı kullanılır
const sonHareket = (kanal) => (kanal.lastMessageId ? SnowflakeUtil.timestampFrom(kanal.lastMessageId) : kanal.createdTimestamp);

// Süresi dolan kapalı odaları ve bu üyenin fazla kapalı odalarını siler; kategori dolmaya
// yaklaştıysa yeni odaya yer açar. Yeni talep açılırken çağrılır.
async function eskiOdalariSil(guild, t, uyeId) {
  const odalar = [...guild.channels.cache.values()].filter((k) => k.parentId === t.kategoriler.talepler);
  const kapali = odalar.filter((k) => k.name.startsWith('kapalı-')).sort((a, b) => sonHareket(b) - sonHareket(a)); // En yeni başta
  const silinecek = new Set([
    ...kapali.filter((k) => Date.now() - sonHareket(k) > KAPALI_ODA_OMRU),
    ...kapali.filter((k) => odaSahibi(k) === uyeId).slice(UYE_BASI_KAPALI_ODA),
  ]);
  // Kategori eşiğe ulaştıysa: sahibine ve yaşına bakmadan en eski kapalı odalar da silinir
  let fazla = odalar.length - silinecek.size - KATEGORI_ESIGI + 1;
  for (const kanal of [...kapali].reverse()) {
    if (fazla <= 0) break;
    if (silinecek.has(kanal)) continue;
    silinecek.add(kanal);
    fazla--;
  }
  for (const kanal of silinecek) {
    const ad = kanal.name;
    const silindi = await kanal.delete('Eski kapalı destek odası').then(() => true, () => false);
    if (silindi) await kayitYaz(guild, t, `🗑️ Eski kapalı destek odası silindi: #${ad}`);
  }
}

async function talepFormu(interaction, t) {
  const mevcut = acikTalep(interaction.guild, t, interaction.user.id);
  if (mevcut) return gizli(interaction, `Zaten açık bir destek odan var: ${mevcut}`);
  const bekleme = await talepBeklemesi(interaction, t);
  if (bekleme) return gizli(interaction, bekleme);
  const konu = new TextInputBuilder()
    .setCustomId('konu')
    .setLabel('Konu')
    .setPlaceholder('Sorununu birkaç kelimeyle yaz')
    .setStyle(TextInputStyle.Short)
    .setMinLength(3)
    .setMaxLength(80)
    .setRequired(true);
  return interaction.showModal(new ModalBuilder().setCustomId('tp:talep-form').setTitle('Destek talebi').addComponents(new ActionRowBuilder().addComponents(konu)));
}

// "Giriş yapamıyorum!" -> "giris-yapamiyorum"
function kisaAd(metin) {
  const sade = metin
    .toLocaleLowerCase('tr')
    .replace(/[ıİ]/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sade.slice(0, 28).replace(/-+$/, '') || 'destek';
}

async function talepAc(interaction, t) {
  const { guild, member } = interaction;
  if (!guild.channels.cache.has(t.kategoriler.talepler)) return gizli(interaction, '❌ Destek talepleri kategorisi bulunamadı. Bir yöneticiye haber ver.');
  const mevcut = acikTalep(guild, t, member.id);
  if (mevcut) return gizli(interaction, `Zaten açık bir destek odan var: ${mevcut}`);
  const bekleme = await talepBeklemesi(interaction, t);
  if (bekleme) return gizli(interaction, bekleme);
  // Oda oluşmadan önce işaretle: form art arda gönderilirse ikincisi buraya takılır
  talepSayaci.isaretle(`${guild.id}:${member.id}`);
  sonSaattekiler(guild.id).push(Date.now());

  const konu = interaction.fields.getTextInputValue('konu').trim();
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await eskiOdalariSil(guild, t, member.id);
  const ben = guild.members.me;
  const suz = (izinler) => izinler.filter((izin) => ben.permissions.has(izin));
  const oda = await guild.channels.create({
    name: `talep-${kisaAd(konu)}-${member.id.slice(-4)}`,
    type: ChannelType.GuildText,
    parent: t.kategoriler.talepler,
    topic: `sahip=${member.id}; konu=${konu}`,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: suz([P.ViewChannel]) },
      { id: member.id, allow: suz([...GOR, ...YAZ, P.AttachFiles, P.EmbedLinks]) },
      ...DESTEK.filter((k) => guild.roles.cache.has(t.roller[k])).map((k) => ({ id: t.roller[k], allow: suz([...GOR, ...YAZ]) })),
      { id: ben.id, allow: suz(BOT) },
    ],
    reason: `Destek talebi: ${member.user.tag}`,
  });
  await oda.send({
    content: `${member}`,
    embeds: [
      kart('🎫 Destek talebin açıldı', `**Konu:** ${escapeMarkdown(konu)}\n\nSorunu, aldığın hata mesajını ve denediğin adımları yaz. Şifre, token ya da kişisel bilgi gönderme.`),
    ],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tp:kapat').setLabel('Talebi kapat').setEmoji('🔒').setStyle(ButtonStyle.Secondary))],
    allowedMentions: { users: [member.id] },
  });
  await kayitYaz(guild, t, `🎫 ${oda} açıldı · ${member} · konu: ${escapeMarkdown(konu)}`);
  return interaction.editReply(`✅ Özel destek odan oluşturuldu: ${oda}`);
}

async function talepKapat(interaction, t) {
  const { channel, member, guild } = interaction;
  if (channel.parentId !== t.kategoriler.talepler) return gizli(interaction, '❌ Bu düğme yalnızca destek odalarında çalışır.');
  if (channel.name.startsWith('kapalı-')) return gizli(interaction, 'Bu destek odası zaten kapalı.');
  const sahip = odaSahibi(channel);
  const ekipten = DESTEK.some((k) => member.roles.cache.has(t.roller[k])) || member.permissions.has(P.ManageChannels);
  if (member.id !== sahip && !ekipten) return gizli(interaction, '❌ Bu odayı yalnızca talep sahibi ya da destek ekibi kapatabilir.');

  await interaction.reply({
    content: `🔒 Destek odası ${member} tarafından kapatıldı. Oda bir süre daha okunabilir; en geç ${KAPALI_ODA_OMRU / 86_400_000} gün sonra silinir.`,
    allowedMentions: { parse: [] },
  });
  // Oda hemen silinmez: talep sahibi okuyabilir ama yazamaz (silinme kuralı: eskiOdalariSil)
  if (sahip) await channel.permissionOverwrites.edit(sahip, { SendMessages: false }, { reason: 'Destek odası kapatıldı' }).catch(() => {});
  await channel.setName(`kapalı-${channel.name}`.slice(0, 100), 'Destek odası kapatıldı').catch(() => {});
  await kayitYaz(guild, t, `🔒 ${channel} kapatıldı · kapatan: ${member}`);
}

async function kayitYaz(guild, t, metin) {
  const kanal = guild.channels.cache.get(t.kanallar.destekKayit);
  if (kanal?.isTextBased()) await kanal.send({ content: metin, allowedMentions: { parse: [] } }).catch(() => {});
}

const ISLEMLER = { 'tp:onay': uyeOl, 'tp:rol': rolSec, 'tp:talep': talepFormu, 'tp:talep-form': talepAc, 'tp:kapat': talepKapat };

// index.js, customId'si "tp:" ile başlayan etkileşimleri buraya yönlendirir.
async function etkilesim(interaction) {
  const islem = ISLEMLER[interaction.customId];
  if (!islem || !interaction.inCachedGuild()) return;
  const t = ayarlariGetir(interaction.guildId).topluluk;
  if (!t) return gizli(interaction, '❌ Bu sunucuda kurulum bilgisi bulunamadı. Bir yönetici `/ayarlar` → Kurulum → Hazır sunucu şablonu ile kurmalı.');
  return islem(interaction, t);
}

module.exports = { SABLONLAR, planla, kur, etkilesim, kisaAd, ilgiRolleri };
