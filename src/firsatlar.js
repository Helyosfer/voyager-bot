// Bedava oyunları ve mağaza indirimlerini düzenli aralıklarla kontrol eder,
// sunucuların seçtiği kanala gönderir. Ayarlar /oyun komutuyla yapılır.
//
// Önemli fırsatlar (popüler ya da yeni çıkmış ve ilgi gören oyunlar) bulunduğu anda, resimli
// kartla ve yapay zekâ incelemesiyle gönderilir. Diğerleri birikir ve OZET_ARALIGI'nda bir
// toplu liste olarak gönderilir.
const { EmbedBuilder, PermissionFlagsBits, embedLength, escapeMarkdown } = require('discord.js');
const { oku, yaz, ayarlariGetir } = require('./depo');
const inceleme = require('./inceleme');

const KONTROL_ARALIGI = 15 * 60_000;
const OZET_ARALIGI = 3 * 60 * 60_000; // Önemli olmayan fırsatlar en fazla bu sıklıkta toplu gönderilir
// Bir sunucuda en sık bu aralıkla @everyone atılır; arada gelen önemli fırsatlarda seçilen rol etiketlenir
const EVERYONE_ARALIGI = 6 * 60 * 60_000;
// Bir gönderimde en fazla bu kadar oyun için yeni inceleme yazılır (saklananlar sayılmaz)
const YENI_INCELEME_SINIRI = 5;
// Bir gönderimde en fazla bu kadar fırsat büyük kartla gösterilir; kalan önemli fırsatlar listeye girer
const KART_SINIRI = 5;
const BOLGE = 'TR'; // Fiyatların gösterileceği mağaza bölgesi
const VARSAYILAN_YUZDE = 50;
// GOG'da o an en çok ilgi gören indirimlerden kaç tanesi alınsın
const GOG_INDIRIM_SAYISI = 15;
// Steam'de en az bu kadar incelemesi olan oyun "popüler" sayılır ve resimli
// büyük kartla duyurulur; diğerleri toplu listede gösterilir.
const POPULER_ESIK = 20_000;
// Son YENI_SURE içinde çıkmış ve en az YENI_ESIK incelemesi olan oyun da önemli sayılır
const YENI_ESIK = 2_000;
const YENI_SURE = 180 * 24 * 60 * 60_000;
// Bir oyunun Steam'deki inceleme sayısı bu kadar süre saklanır, sonra yeniden sorulur
const POPULERLIK_OMRU = 7 * 24 * 60 * 60_000;
// Bir fırsat bu kadar süre sonra "görüldü" listesinden silinir
const UNUTMA_SURESI = 90 * 24 * 60 * 60_000;

// /oyun bedava "magaza" seçenekleri -> GamerPower'ın platform adları
const MAGAZALAR = {
  buyuk: { ad: 'Steam, Epic ve GOG', platformlar: ['Steam', 'Epic Games Store', 'GOG'] },
  steam: { ad: 'Steam', platformlar: ['Steam'] },
  epic: { ad: 'Epic Games', platformlar: ['Epic Games Store'] },
  gog: { ad: 'GOG', platformlar: ['GOG'] },
  hepsi: { ad: 'Tüm PC mağazaları', platformlar: ['PC'] },
};

// İndirim takip edilen mağazalar. Hepsi mağazanın kendi servisinden, BOLGE fiyatıyla alınır.
const INDIRIM_MAGAZALARI = {
  steam: { ad: 'Steam', renk: 0x1b2838, getir: steamIndirimleri },
  epic: { ad: 'Epic Games', renk: 0x2f2d2e, getir: epicIndirimleri },
  gog: { ad: 'GOG', renk: 0x86328a, getir: gogIndirimleri },
};

// /oyun indirim "magaza" seçenekleri
const INDIRIM_SECENEKLERI = {
  buyuk: { ad: 'Steam, Epic ve GOG', magazalar: ['steam', 'epic', 'gog'] },
  steam: { ad: 'Steam', magazalar: ['steam'] },
  epic: { ad: 'Epic Games', magazalar: ['epic'] },
  gog: { ad: 'GOG', magazalar: ['gog'] },
};

// Kayıtlı ayarları varsayılanlarla tamamlar
function ayarCoz(ayar) {
  return {
    kanal: ayar.oyunKanali ?? null,
    rol: ayar.oyunRol ?? null,
    bedava: ayar.oyunBedava !== false,
    magaza: MAGAZALAR[ayar.oyunMagaza] ? ayar.oyunMagaza : 'buyuk',
    indirim: ayar.oyunIndirim !== false,
    indirimMagaza: INDIRIM_SECENEKLERI[ayar.oyunIndirimMagaza] ? ayar.oyunIndirimMagaza : 'buyuk',
    yuzde: ayar.oyunMinYuzde ?? VARSAYILAN_YUZDE,
    everyone: ayar.oyunEveryone === true,
  };
}

async function jsonGetir(url) {
  const yanit = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { 'User-Agent': 'voyager-bot' },
  });
  if (!yanit.ok) throw new Error(`${new URL(url).hostname} HTTP ${yanit.status}`);
  return yanit.json();
}

// Dış servisten gelen adres bağlantı ya da resim olarak kullanılmadan önce denetlenir: yalnızca
// http(s). Geçersiz bir adres kartın tamamını (ve o turdaki gönderimi) düşürür. Parantezler
// kodlanır; yoksa [ad](adres) yazımında bağlantı erken kapanır.
function httpAdresi(adres) {
  try {
    const u = new URL(adres);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.href.replace(/\(/g, '%28').replace(/\)/g, '%29');
  } catch {
    return null;
  }
}

async function bedavalariGetir() {
  const veri = await jsonGetir('https://www.gamerpower.com/api/giveaways?type=game');
  if (!Array.isArray(veri)) return []; // Etkin çekiliş yokken servis dizi yerine bir durum nesnesi döndürür
  return veri
    .filter((o) => o.status === 'Active')
    .map((o) => {
      const bitis = Date.parse(`${String(o.end_date).replace(' ', 'T')}Z`);
      return {
        anahtar: String(o.id),
        // "Pony Island (Steam) Giveaway" → "Pony Island"; mağaza zaten platform alanında yazıyor
        ad: String(o.title).replace(/\s*(Key )?Giveaway$/i, '').replace(/\s*\([^)]*\)$/, ''),
        platformlar: String(o.platforms).split(',').map((p) => p.trim()),
        deger: o.worth && o.worth !== 'N/A' ? o.worth : null,
        bitis: Number.isNaN(bitis) ? null : bitis,
        aciklama: o.description ?? '',
        resim: httpAdresi(o.image),
        url: httpAdresi(o.open_giveaway_url),
      };
    })
    .filter((o) => o.url);
}

const STEAM_TURLERI = { 0: 'app', 1: 'sub', 2: 'bundle' };

function fiyat(kurus, birim) {
  const tutar = (kurus / 100).toFixed(2);
  return birim === 'USD' ? `$${tutar}` : `${tutar} ${birim}`;
}

async function steamIndirimleri() {
  const veri = await jsonGetir(`https://store.steampowered.com/api/featuredcategories?cc=${BOLGE.toLowerCase()}&l=turkish`);
  return (veri.specials?.items ?? [])
    .filter((o) => o.discounted)
    .map((o) => ({
      // Aynı oyun ileride yeniden indirime girerse tekrar haber verilsin diye bitiş tarihi de anahtara katılır
      anahtar: `${o.id}:${o.discount_expiration ?? 0}`,
      ad: o.name,
      steamId: o.type === 0 ? o.id : null,
      yuzde: o.discount_percent,
      eski: fiyat(o.original_price, o.currency),
      yeni: fiyat(o.final_price, o.currency),
      bitis: o.discount_expiration ? o.discount_expiration * 1000 : null,
      resim: httpAdresi(o.header_image),
      url: `https://store.steampowered.com/${STEAM_TURLERI[o.type] ?? 'app'}/${o.id}`,
    }));
}

// Epic'in arama servisi sunuculardan gelen istekleri engelliyor; bu yüzden
// mağaza vitrininin verisi okunur ve içindeki indirimli teklifler toplanır.
async function epicIndirimleri() {
  const veri = await jsonGetir(
    `https://store-site-backend-static-ipv4.ak.epicgames.com/storefrontLayout?locale=tr&country=${BOLGE}`,
  );
  const bulunan = new Map();
  const gez = (dugum) => {
    if (!dugum || typeof dugum !== 'object') return;
    if (dugum.id && dugum.title && dugum.price?.totalPrice) bulunan.set(dugum.id, dugum);
    for (const alt of Object.values(dugum)) gez(alt);
  };
  gez(veri.data?.Storefront?.storefrontModulesPaginated?.modules);

  const sonuc = [];
  for (const o of bulunan.values()) {
    const f = o.price.totalPrice;
    const sayfa = o.offerMappings?.[0]?.pageSlug ?? o.catalogNs?.mappings?.[0]?.pageSlug ?? o.productSlug;
    // Yalnızca ana oyunlar: DLC, ek paket ve özel sürümler listeyi doldurmasın
    if (o.offerType !== 'BASE_GAME') continue;
    if (!sayfa || !(f.originalPrice > 0) || f.discountPrice >= f.originalPrice) continue;
    const bitis = Date.parse(o.price.lineOffers?.[0]?.appliedRules?.[0]?.endDate);
    sonuc.push({
      anahtar: `${o.id}:${Number.isNaN(bitis) ? 0 : bitis}`,
      ad: o.title,
      yuzde: Math.round((1 - f.discountPrice / f.originalPrice) * 100),
      eski: f.fmtPrice.originalPrice,
      yeni: f.fmtPrice.discountPrice,
      bitis: Number.isNaN(bitis) ? null : bitis,
      resim: httpAdresi(o.keyImages?.find((r) => r.type === 'OfferImageWide')?.url ?? o.keyImages?.[0]?.url),
      url: `https://store.epicgames.com/tr/p/${sayfa}`,
    });
  }
  return sonuc.sort((a, b) => b.yuzde - a.yuzde);
}

async function gogIndirimleri() {
  const veri = await jsonGetir(
    `https://catalog.gog.com/v1/catalog?limit=${GOG_INDIRIM_SAYISI}&order=desc:trending&productType=in:game,pack&discounted=eq:true&countryCode=${BOLGE}&currencyCode=USD&locale=en-US`,
  );
  return (veri.products ?? [])
    .filter((o) => o.price?.final && o.price.base)
    .map((o) => ({
      anahtar: `${o.id}:${o.price.final}`, // Fiyat değişirse yeniden haber verilsin
      ad: o.title,
      yuzde: Math.abs(parseInt(o.price.discount, 10)) || 0,
      eski: o.price.base,
      yeni: o.price.final,
      bitis: null,
      resim: httpAdresi(o.coverHorizontal),
      url: httpAdresi(o.storeLink),
    }))
    .filter((o) => o.url);
}

// Kaynaklardan biri çalışmasa da diğerleri işlensin; çalışmayan kaynak null döner.
async function hepsiniGetir() {
  const guvenli = (ad, soz) =>
    soz.catch((hata) => {
      console.error(`${ad} alınamadı:`, hata.message);
      return null;
    });
  const magazalar = Object.entries(INDIRIM_MAGAZALARI);
  const [bedava, ...indirimler] = await Promise.all([
    guvenli('Bedava oyunlar', bedavalariGetir()),
    ...magazalar.map(([, m]) => guvenli(`${m.ad} indirimleri`, m.getir())),
  ]);
  return { bedava, indirim: Object.fromEntries(magazalar.map(([ad], i) => [ad, indirimler[i]])) };
}

const indirimTuru = (magaza) => `indirim-${magaza}`;

// Sunucunun ayarlarına uyan fırsatlar, türe göre: { bedava, 'indirim-steam', ... }
// Kapalı ya da kaynağına ulaşılamayan tür null olur.
function sec(ayar, veri) {
  const { platformlar } = MAGAZALAR[ayar.magaza];
  const sonuc = {
    bedava: ayar.bedava && veri.bedava ? veri.bedava.filter((o) => o.platformlar.some((p) => platformlar.includes(p))) : null,
  };
  for (const magaza of Object.keys(INDIRIM_MAGAZALARI)) {
    const istenen = ayar.indirim && INDIRIM_SECENEKLERI[ayar.indirimMagaza].magazalar.includes(magaza);
    const liste = veri.indirim[magaza];
    // Tamamen bedava olanlar bedava oyun bildiriminde duyurulur
    sonuc[indirimTuru(magaza)] = istenen && liste ? liste.filter((o) => o.yuzde >= ayar.yuzde && o.yuzde < 100) : null;
  }
  return sonuc;
}

// Oyun adlarını karşılaştırmak için: küçük harf, yalnızca harf ve rakam
const sade = (ad) =>
  ad
    .toLowerCase()
    .replace(/&/g, ' and ')
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Oyunun Steam'deki inceleme sayısını (popülerlik ölçüsü) ve Steam kimliğini döndürür.
// Sonuç data/populerlik.json içinde saklanır; Steam'de bulunamayan oyunun inceleme sayısı 0 sayılır.
async function populerlik(ad, steamId = null) {
  const anahtar = steamId ? `app:${steamId}` : sade(ad);
  if (!anahtar) return { steamId: null, yorum: 0 };
  const kayit = oku('populerlik', {})[anahtar];
  // Tür bilgisi eklenmeden önce saklanmış kayıtlar, oyun önemli sayılabilecekse yenilenir
  const eksik = kayit && kayit.yorum >= YENI_ESIK && !('tur' in kayit);
  if (kayit && !eksik && Date.now() - kayit.zaman < POPULERLIK_OMRU) return kayit;

  try {
    if (!steamId) {
      const arama = await jsonGetir(
        `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(ad)}&l=english&cc=${BOLGE.toLowerCase()}`,
      );
      steamId = (arama.items ?? []).find((o) => o.type === 'app' && sade(o.name) === anahtar)?.id ?? null;
    }
    let yorum = 0;
    if (steamId) {
      const inceleme = await jsonGetir(
        `https://store.steampowered.com/appreviews/${steamId}?json=1&language=all&purchase_type=all&num_per_page=0`,
      );
      yorum = inceleme.query_summary?.total_reviews ?? 0;
    }
    // Önemli sayılabilecek oyunlar için türü (oyun mu, DLC mi) ve çıkış tarihi de sorulur
    let tur = null;
    let cikis = null;
    if (steamId && yorum >= YENI_ESIK) {
      const detay = (await jsonGetir(`https://store.steampowered.com/api/appdetails?appids=${steamId}&filters=basic,release_date`))?.[steamId]?.data;
      tur = detay?.type ?? null;
      const tarih = Date.parse(detay?.release_date?.date);
      cikis = Number.isNaN(tarih) ? null : tarih;
    }

    const sonuc = { steamId, yorum, tur, cikis, zaman: Date.now() };
    const onbellek = oku('populerlik', {});
    onbellek[anahtar] = sonuc;
    for (const [k, v] of Object.entries(onbellek)) {
      if (Date.now() - v.zaman > POPULERLIK_OMRU) delete onbellek[k];
    }
    yaz('populerlik', onbellek);
    return sonuc;
  } catch (hata) {
    // Ulaşılamazsa oyun popüler sayılmaz ama sonuç saklanmaz; bir dahaki sefere yeniden denensin
    console.error(`Popülerlik alınamadı (${ad}):`, hata.message);
    return { steamId, yorum: 0 };
  }
}

const zaman = (ms) => `<t:${Math.floor(ms / 1000)}:R>`;
const kisalt = (metin, sinir) => (metin.length > sinir ? `${metin.slice(0, sinir - 1)}…` : metin);

function bedavaEmbed(o) {
  const embed = new EmbedBuilder()
    .setTitle(kisalt(`🎁 ${o.ad}`, 256))
    .setURL(o.url)
    .setColor(0x57f287)
    .addFields({ name: 'Platform', value: o.platformlar.join(', '), inline: true })
    .setFooter({ text: 'Kaynak: GamerPower' });
  if (o.aciklama) embed.setDescription(kisalt(o.aciklama, 300));
  if (o.deger) embed.addFields({ name: 'Fiyat', value: `~~${o.deger}~~ Bedava`, inline: true });
  if (o.bitis) embed.addFields({ name: 'Bitiş', value: zaman(o.bitis), inline: true });
  if (o.resim) embed.setImage(o.resim);
  return embed;
}

function bedavaSatiri(o) {
  const fiyat = o.deger ? `~~${o.deger}~~ **Bedava**` : '**Bedava**';
  const bitis = o.bitis ? ` · bitiş: ${zaman(o.bitis)}` : '';
  const platform = o.platformlar.filter((p) => p !== 'PC').join(', ') || 'PC';
  return `[${escapeMarkdown(o.ad)}](${o.url}) · ${platform} · ${fiyat}${bitis}`;
}

const fiyatMetni = (t) => `**-%${t.yuzde}** ~~${t.eski}~~ **${t.yeni}**`;

// oyun: { ad, teklifler: [{ magaza, yuzde, eski, yeni, bitis, resim, url }] }
function indirimKarti(oyun) {
  const ilk = oyun.teklifler[0];
  const embed = new EmbedBuilder()
    .setTitle(kisalt(`🏷️ ${oyun.ad}`, 256))
    .setURL(ilk.url)
    .setColor(INDIRIM_MAGAZALARI[ilk.magaza].renk)
    .addFields(
      oyun.teklifler.map((t) => ({
        name: INDIRIM_MAGAZALARI[t.magaza].ad,
        value: [fiyatMetni(t), t.bitis ? `bitiş: ${zaman(t.bitis)}` : null, `[Mağazada aç](${t.url})`].filter(Boolean).join('\n'),
        inline: true,
      })),
    )
    .setFooter({ text: 'Türkiye fiyatları' });
  const resim = oyun.teklifler.find((t) => t.resim)?.resim;
  if (resim) embed.setImage(resim);
  return embed;
}

function indirimSatiri(oyun) {
  const metin = (t) => `${fiyatMetni(t)}${t.bitis ? ` · bitiş: ${zaman(t.bitis)}` : ''}`;
  if (oyun.teklifler.length === 1) {
    const t = oyun.teklifler[0];
    return `[${escapeMarkdown(oyun.ad)}](${t.url}) · ${INDIRIM_MAGAZALARI[t.magaza].ad} · ${metin(t)}`;
  }
  // Aynı oyun birden fazla mağazada indirimdeyse tek satırda toplanır
  const teklifler = oyun.teklifler.map((t) => `[${INDIRIM_MAGAZALARI[t.magaza].ad}](${t.url}) ${metin(t)}`);
  return `**${escapeMarkdown(oyun.ad)}** · ${teklifler.join(' · ')}`;
}

// Satırları, açıklama sınırını (4096 karakter) aşmayacak şekilde bir ya da daha fazla liste kartına böler
function listeEmbedleri(baslik, renk, satirlar, altBilgi) {
  const parcalar = [];
  for (const satir of satirlar) {
    const son = parcalar.at(-1);
    if (son && son.length + satir.length + 1 <= 4000) parcalar[parcalar.length - 1] = `${son}\n${satir}`;
    else parcalar.push(satir);
  }
  return parcalar.map((parca, i) =>
    new EmbedBuilder()
      .setTitle(i === 0 ? baslik : `${baslik} (devam)`)
      .setColor(renk)
      .setDescription(parca)
      .setFooter({ text: altBilgi }),
  );
}

const onemliMi = (p) => p.yorum >= POPULER_ESIK || (p.yorum >= YENI_ESIK && p.cikis && Date.now() - p.cikis <= YENI_SURE);

// Fırsatları önemli olanlar ve diğerleri diye ikiye ayırır (ikisi de sec() biçiminde).
// Her fırsata Steam'deki popülerliği eklenir: { ...firsat, steamId, yorum }
async function ayir(liste) {
  const onemli = {};
  const diger = {};
  for (const [tur, firsatlar] of Object.entries(liste)) {
    if (!firsatlar) continue;
    onemli[tur] = [];
    diger[tur] = [];
    for (const o of firsatlar) {
      const p = await populerlik(o.ad, o.steamId);
      if (p.tur && p.tur !== 'game') continue; // Steam'in DLC ve ek paket olarak bildirdikleri gösterilmez
      (onemliMi(p) ? onemli : diger)[tur].push({ ...o, steamId: p.steamId ?? o.steamId ?? null, yorum: p.yorum });
    }
  }
  return { onemli, diger };
}

// Aynı oyunun farklı mağazalardaki indirimleri tek kayıtta toplanır
function indirimleriTopla(liste) {
  const oyunlar = new Map();
  for (const magaza of Object.keys(INDIRIM_MAGAZALARI)) {
    for (const o of liste[indirimTuru(magaza)] ?? []) {
      const anahtar = o.steamId ? `app:${o.steamId}` : sade(o.ad) || `${magaza}:${o.anahtar}`;
      const oyun = oyunlar.get(anahtar) ?? { ad: o.ad, steamId: o.steamId, yorum: o.yorum, teklifler: [] };
      oyun.teklifler.push({ ...o, magaza });
      oyunlar.set(anahtar, oyun);
    }
  }
  return [...oyunlar.values()];
}

// Önemli fırsatlar resimli büyük kartla (varsa incelemesiyle), diğerleri toplu listede gösterilir.
async function embedleriHazirla(onemli, diger) {
  let yeniInceleme = 0;
  const incelemeli = async (embed, steamId) => {
    if (!steamId || !inceleme.hazir()) return embed;
    // Saklanmış inceleme hemen kullanılır; yenisi yazılacaksa gönderim başına sınır uygulanır
    const saklanan = inceleme.saklanan(steamId);
    if (!saklanan && yeniInceleme >= YENI_INCELEME_SINIRI) return embed;
    if (!saklanan) yeniInceleme++;
    const sonuc = await inceleme.incele(steamId);
    return sonuc ? inceleme.karta(embed, sonuc) : embed;
  };

  // En popüler KART_SINIRI fırsat kartla gösterilir; önemli olup sığmayanlar kartların altında kısa bir listede
  const sirali = [
    ...[...(onemli.bedava ?? [])].sort((a, b) => b.yorum - a.yorum).map((o) => ({ kart: () => bedavaEmbed(o), satir: () => bedavaSatiri(o), steamId: o.steamId })),
    ...indirimleriTopla(onemli).sort((a, b) => b.yorum - a.yorum).map((oyun) => ({ kart: () => indirimKarti(oyun), satir: () => indirimSatiri(oyun), steamId: oyun.steamId })),
  ];
  // İncelemeler aynı anda yazılır: yavaş bir model (ör. Gemma) kartları sırayla bekletmesin
  const kartlar = await Promise.all(sirali.slice(0, KART_SINIRI).map((f) => incelemeli(f.kart(), f.steamId)));
  const tasan = sirali.slice(KART_SINIRI).map((f) => f.satir());

  const enYuksek = (oyun) => Math.max(...oyun.teklifler.map((t) => t.yuzde));
  const digerIndirim = indirimleriTopla(diger).sort((a, b) => enYuksek(b) - enYuksek(a));
  return {
    kartlar,
    listeler: [
      ...listeEmbedleri('🔥 Diğer popüler fırsatlar', 0xed4245, tasan, 'Türkiye fiyatları'),
      ...listeEmbedleri('🎁 Bedava oyunlar', 0x57f287, (diger.bedava ?? []).map(bedavaSatiri), 'Kaynak: GamerPower'),
      ...listeEmbedleri('🏷️ İndirimler', 0x5865f2, digerIndirim.map(indirimSatiri), 'Türkiye fiyatları'),
    ],
  };
}

// Kartları Discord sınırlarına göre mesajlara böler: mesaj başına en fazla 10 kart ve 6000 karakter
function mesajlaraBol(embedler) {
  const mesajlar = [];
  let uzunluk = 0;
  for (const embed of embedler) {
    const boy = embedLength(embed.data);
    const son = mesajlar.at(-1);
    if (!son || son.length === 10 || uzunluk + boy > 6000) {
      mesajlar.push([embed]);
      uzunluk = boy;
    } else {
      son.push(embed);
      uzunluk += boy;
    }
  }
  return mesajlar;
}

// Sunucunun zaman kayıtları: { ozet: son toplu liste, everyone: son @everyone }
const zamanlar = (sunucuId) => oku('firsat-zaman', {})[sunucuId] ?? {};
function zamanKaydet(sunucuId, ad) {
  const hepsi = oku('firsat-zaman', {});
  (hepsi[sunucuId] ??= {})[ad] = Date.now();
  yaz('firsat-zaman', hepsi);
}

// Önemli fırsatlarda kimin etiketleneceği: @everyone açıksa, bot kanalda @everyone atabiliyorsa ve son
// @everyone'dan bu yana EVERYONE_ARALIGI geçtiyse herkes; değilse seçilen rol.
function etiketSec(guild, kanal, ayar, onemli) {
  if (onemli && ayar.everyone && Date.now() - (zamanlar(guild.id).everyone ?? 0) >= EVERYONE_ARALIGI) {
    if (kanal.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.MentionEveryone)) return { everyone: true };
  }
  return ayar.rol ? { rol: ayar.rol } : null;
}

// onemli, diger: sec() biçiminde, türe göre diziler (ayir() ile popülerlik eklenmiş)
async function gonder(guild, ayar, onemli, diger) {
  const kanal = await guild.channels.fetch(ayar.kanal);
  if (!kanal?.isTextBased()) throw new Error('Fırsat kanalı bulunamadı');

  const { kartlar, listeler } = await embedleriHazirla(onemli, diger);
  const etiket = etiketSec(guild, kanal, ayar, kartlar.length > 0);
  for (const [i, embeds] of mesajlaraBol([...kartlar, ...listeler]).entries()) {
    const ilk = i === 0 && etiket;
    await kanal.send({
      content: ilk ? (etiket.everyone ? '@everyone 🔥 Kaçırılmayacak bir fırsat var!' : `<@&${etiket.rol}>`) : undefined,
      embeds,
      allowedMentions: ilk ? (etiket.everyone ? { parse: ['everyone'] } : { roles: [etiket.rol] }) : { parse: [] },
    });
  }
  if (etiket?.everyone) zamanKaydet(guild.id, 'everyone');
}

// Görülen fırsatlar: { [sunucuId]: { [tur]: { [anahtar]: zaman } } }
// Bir türün kaydı hiç yoksa o tür bu sunucuda ilk kez kontrol ediliyor demektir.
function gorulenler(sunucuId) {
  return oku('firsatlar', {})[sunucuId] ?? {};
}

// liste: türe göre diziler; null olan türlere dokunulmaz
function isaretle(sunucuId, liste) {
  const hepsi = oku('firsatlar', {});
  const sunucu = (hepsi[sunucuId] ??= {});
  const simdi = Date.now();
  for (const [tur, firsatlar] of Object.entries(liste)) {
    if (!firsatlar) continue;
    const kayit = (sunucu[tur] ??= {});
    for (const o of firsatlar) kayit[o.anahtar] ??= simdi;
    for (const [anahtar, ne] of Object.entries(kayit)) {
      if (simdi - ne > UNUTMA_SURESI) delete kayit[anahtar];
    }
  }
  yaz('firsatlar', hepsi);
}

const say = (liste) => Object.values(liste).reduce((toplam, l) => toplam + (l?.length ?? 0), 0);

async function sunucuyuIsle(guild, veri) {
  const ayar = ayarCoz(ayarlariGetir(guild.id));
  if (!ayar.kanal) return;

  const uygun = sec(ayar, veri);
  const gorulen = gorulenler(guild.id);
  const ilk = {};
  const yeni = {};

  for (const [tur, firsatlar] of Object.entries(uygun)) {
    if (!firsatlar) continue;
    if (!gorulen[tur]) {
      // İlk kontrol: o an yayında olanlar sessizce "görüldü" sayılır, kanal doldurulmaz.
      // O anki fırsatlar /oyun simdi ile istenebilir.
      ilk[tur] = firsatlar;
    } else {
      yeni[tur] = firsatlar.filter((o) => !gorulen[tur][o.anahtar]);
    }
  }

  isaretle(guild.id, ilk);
  if (!say(yeni)) return;
  const { onemli, diger } = await ayir(yeni);

  // Önemli fırsatlar hemen gider. Gönderim başarılıysa işaretlenir; değilse bir sonraki kontrolde yeniden denenir.
  if (say(onemli)) {
    await gonder(guild, ayar, onemli, {});
    isaretle(guild.id, onemli);
  }
  // Diğerleri işaretlenmeden bekler; OZET_ARALIGI dolunca o an hâlâ geçerli olanlar toplu gönderilir.
  // Bu arada süresi dolan fırsat listeye girmez.
  if (say(diger) && Date.now() - (zamanlar(guild.id).ozet ?? 0) >= OZET_ARALIGI) {
    await gonder(guild, ayar, {}, diger);
    isaretle(guild.id, diger);
    zamanKaydet(guild.id, 'ozet');
  }
}

async function kontrolEt(client) {
  const veri = await hepsiniGetir();
  for (const guild of client.guilds.cache.values()) {
    await sunucuyuIsle(guild, veri).catch((hata) => {
      console.error(`Fırsatlar gönderilemedi (${guild.id}):`, hata.message);
    });
  }
}

// /oyun simdi: ayarlara uyan güncel fırsatların hepsini, daha önce gönderilmiş olsa da gönderir.
async function simdiGonder(guild) {
  const ayar = ayarCoz(ayarlariGetir(guild.id));
  const veri = await hepsiniGetir();
  if (!veri.bedava && Object.values(veri.indirim).every((l) => !l)) throw new Error('Kaynaklara ulaşılamadı');

  const uygun = sec(ayar, veri);
  if (say(uygun)) {
    const { onemli, diger } = await ayir(uygun);
    await gonder(guild, { ...ayar, everyone: false }, onemli, diger); // Elle istenen gönderimde @everyone kullanılmaz
  }
  isaretle(guild.id, uygun);
  return { bedava: uygun.bedava?.length ?? 0, indirim: say(uygun) - (uygun.bedava?.length ?? 0) };
}

function baslat(client) {
  let calisiyor = false;
  const calistir = async () => {
    if (calisiyor) return;
    calisiyor = true;
    try {
      await kontrolEt(client);
    } catch (hata) {
      console.error('Fırsat kontrolü başarısız:', hata?.stack ?? hata);
    } finally {
      calisiyor = false;
    }
  };
  setTimeout(calistir, 30_000);
  setInterval(calistir, KONTROL_ARALIGI);
}

module.exports = {
  baslat, kontrolEt, simdiGonder, ayarCoz, MAGAZALAR, INDIRIM_SECENEKLERI, OZET_ARALIGI, EVERYONE_ARALIGI,
  // Yalnızca testler kullanır
  httpAdresi, sunucuyuIsle,
};
