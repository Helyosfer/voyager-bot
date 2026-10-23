// Zararlı bağlantı denetimi (/ayarlar → Koruma → Bağlantı): mesajdaki bağlantıların alan adlarına bakar.
// Hiçbir bağlantı açılmaz ve dışarı gönderilmez; karar yalnızca adresin kendisinden verilir.
//
// Yakalananlar:
// - Bilinen sitelerin taklitleri: harf benzerliği (dlscord, steamcommunlty, Kiril "о"), tek harf
//   oynatma (dicsord), "discord-nitro" gibi marka + hediye kelimesi, steamcommunity.com.kotu.ru gibi
//   gerçek adresi alt alan adına gizleme
// - Yanıltıcı bağlantılar: [discord.com](https://kotu.site) ve https://discord.com@kotu.site
// - Bedava Nitro / hediye alanları (free-nitro.xyz)
// - İsteğe bağlı: kısaltılmış bağlantılar (bit.ly vb.) ve sunucunun kendi engellediği alanlar
//
// Meşru sitelere takılmamak için kurallar bilerek dardır: markanın adını taşıyan ama hediye
// kelimesi içermeyen siteler (discordbotlist.com, discord.js.org) yakalanmaz. Yanlış alarmda
// sunucu alanı /ayarlar → Koruma → Alanlar ile izin listesine ekler.
const { domainToUnicode } = require('node:url');

// Resmî alanlar ve alt alan adları güvenlidir
const MARKALAR = [
  { ad: 'Discord', kelime: 'discord', alanlar: ['discord.com', 'discord.gg', 'discord.gift', 'discord.media', 'discord.new', 'discord.dev', 'discord.co', 'discord.me', 'discordapp.com', 'discordapp.net', 'discordstatus.com', 'dis.gd'] },
  { ad: 'Steam', kelime: 'steamcommunity', alanlar: ['steamcommunity.com', 'steampowered.com', 'steamstatic.com', 'steamgames.com', 'steam.tv', 's.team'] },
  { ad: 'Steam', kelime: 'steampowered', alanlar: ['steampowered.com'] },
  { ad: 'Epic Games', kelime: 'epicgames', alanlar: ['epicgames.com', 'unrealengine.com'] },
  { ad: 'Roblox', kelime: 'roblox', alanlar: ['roblox.com', 'rbxcdn.com'] },
  { ad: 'Twitch', kelime: 'twitch', alanlar: ['twitch.tv'] },
];
const RESMI = MARKALAR.flatMap((m) => m.alanlar);

// Dolandırıcılık alanlarında markanın yanına eklenen kelimeler
const HEDIYE = ['nitro', 'gift', 'free', 'claim', 'drop', 'promo', 'bonus', 'giveaway', 'reward', 'hediye', 'bedava', 'cekilis'];

// Markaya bir harf uzaklıktaki gerçek kelimeler ve bilinen siteler; taklit sayılmaz
const ZARARSIZ = new Set(['discard', 'discos', 'discords']);

const KISALTICILAR = [
  'bit.ly', 'tinyurl.com', 'cutt.ly', 'is.gd', 'v.gd', 'shorturl.at', 'rb.gy', 'tiny.cc', 'ow.ly', 't.ly', 'rebrand.ly',
  's.id', 'goo.su', 'clck.ru', 'shorturl.asia', 'bl.ink', 'short.io', 'tny.im', 'u.to', 'qr.ae', 'lnkd.in', 'adf.ly', 'shorte.st',
];

// Birbirine benzeyen harfler aynı iskelete indirgenir: "dlscord", "disc0rd", "dіscord" (Kiril і) → "discord"
const BENZER = {
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x', і: 'i', ј: 'j', ѕ: 's', ԁ: 'd', ӏ: 'l', ɡ: 'g', ı: 'i', ο: 'o', α: 'a', ν: 'v', τ: 't', κ: 'k', ρ: 'p',
  0: 'o', 1: 'l', 3: 'e', 4: 'a', 5: 's', 7: 't',
};
function iskelet(metin) {
  return metin
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/./gu, (k) => BENZER[k] ?? k)
    .replace(/[^a-z]/g, '')
    .replace(/rn/g, 'm')
    .replace(/vv/g, 'w')
    .replace(/cl/g, 'd')
    .replace(/l/g, 'i');
}

// İki metin arasındaki düzenleme uzaklığı (ekleme, silme, değiştirme, yan yana iki harfin yer değiştirmesi)
function uzaklik(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

const altAlanMi = (alan, liste) => liste.some((d) => alan === d || alan.endsWith(`.${d}`));

// Alanın kayıtlı (satın alınan) kısmının adı: "kotu.com.tr" → "kotu", "a.b.kotu.ru" → "kotu"
const IKILI_UZANTI = new Set(['com', 'net', 'org', 'co', 'gov', 'edu', 'gen', 'web', 'biz', 'bel', 'k12']);
function kayitliAd(parcalar) {
  const n = parcalar.length;
  if (n >= 3 && parcalar[n - 1].length === 2 && IKILI_UZANTI.has(parcalar[n - 2])) return n - 3;
  return n - 2;
}

// Bir alanı inceler; zararlıysa sebebini döndürür, değilse null
function alanSebebi(alan) {
  if (altAlanMi(alan, RESMI)) return null;
  const unicode = domainToUnicode(alan) || alan;
  const parcalar = unicode.split('.');
  if (parcalar.length < 2) return null;
  const kayitli = kayitliAd(parcalar);
  const hediyeVar = parcalar.some((p) => HEDIYE.some((h) => iskelet(p).includes(iskelet(h))));

  // Gerçek adresi alt alan adına gizleme: steamcommunity.com.kotu.ru
  const gizlenen = RESMI.find((d) => alan.startsWith(`${d}.`) || alan.includes(`.${d}.`));
  if (gizlenen) return `Gerçek bir adresi (${gizlenen}) taklit eden alan`;

  for (const marka of MARKALAR) {
    const mIskelet = iskelet(marka.kelime);
    for (const [i, parca] of parcalar.entries()) {
      if (i === parcalar.length - 1) continue; // Uzantı (.com, .ru)
      const pIskelet = iskelet(parca);
      if (!pIskelet || ZARARSIZ.has(parca)) continue;
      // Harf benzerliğiyle ya da bir harf oynatılarak yazılmış marka adı
      const benzer = pIskelet === mIskelet || (mIskelet.length >= 7 && uzaklik(pIskelet, mIskelet) <= 1);
      if (parca !== marka.kelime && benzer) return `${marka.ad} sitesini taklit eden alan`;
      // Marka adı ya kayıtlı adın kendisi (discord.ru), ya da yanında hediye kelimesi var (discord-nitro.com)
      if (pIskelet.includes(mIskelet) && ((i === kayitli && parca === marka.kelime) || hediyeVar)) return `${marka.ad} sitesini taklit eden alan`;
    }
  }

  const nitro = parcalar.some((p) => {
    const s = iskelet(p);
    return s.includes('nitro') && HEDIYE.some((h) => h !== 'nitro' && s.includes(iskelet(h)));
  });
  if (nitro) return 'Bedava Nitro ya da hediye dolandırıcılığı';
  return null;
}

// Metindeki tıklanabilir bağlantılar. Dönen her öğe: { adres, alan, kullanici, gorunen }
// gorunen: [yazı](adres) biçiminde gizli bağlantının görünen yazısı
const ADRES = /https?:\/\/[^\s<>"'`)\]]+/gi;
const GIZLI = /\[([^\]]{1,200})\]\(\s*<?(https?:\/\/[^\s)>]+)>?\s*\)/gi;
function baglantilar(metin) {
  const gorunenler = new Map();
  for (const [, gorunen, adres] of metin.matchAll(GIZLI)) gorunenler.set(adres, gorunen);
  const sonuc = [];
  for (const [adres] of metin.matchAll(ADRES)) {
    let url;
    try {
      url = new URL(adres);
    } catch {
      continue;
    }
    const alan = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!alan) continue;
    sonuc.push({ adres, alan, kullanici: decodeURIComponent(url.username), gorunen: gorunenler.get(adres) ?? null });
  }
  return sonuc;
}

const ALAN_YAZISI = /(?:[a-z0-9-]+\.)+[a-z]{2,}/i;

// Gizli bağlantının görünen yazısı bir adres gibi mi? Öyleyse alan adını döndürür. "README.md" ya da
// "sürüm 1.2" gibi yazılar adres sayılmasın diye yazının tamamı adres olmalı; http(s):// ya da www.
// ile başlamıyorsa uzantı bilinen bir uzantı olmalı.
const BILINEN_UZANTI = new Set(['com', 'net', 'org', 'gg', 'gift', 'tv', 'io', 'me', 'co', 'ru', 'xyz', 'site', 'link', 'app', 'tr']);
function gorunenAlan(yazi) {
  const eslesme = yazi.trim().match(/^(https?:\/\/)?(www\.)?((?:[a-z0-9-]+\.)+([a-z]{2,}))(?:[/?#]\S*)?$/i);
  if (!eslesme) return null;
  const [, sema, www, alan, uzanti] = eslesme;
  return sema || www || BILINEN_UZANTI.has(uzanti.toLowerCase()) ? alan.toLowerCase() : null;
}
const wwwsuz = (alan) => alan.replace(/^www\./, '');
const ayniSite = (a, b) => a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);

// Mesajdaki ilk zararlı bağlantıyı { alan, sebep } olarak döndürür, yoksa null.
// secenekler: { kisaltici: bool, engel: [alan], izin: [alan] }
function denetle(metin, { kisaltici = false, engel = [], izin = [] } = {}) {
  for (const b of baglantilar(metin)) {
    if (altAlanMi(b.alan, izin)) continue;
    if (altAlanMi(b.alan, engel)) return { alan: b.alan, sebep: 'Sunucunun engellediği alan' };
    // https://discord.com@kotu.site: tarayıcı kotu.site'ye gider
    if (ALAN_YAZISI.test(b.kullanici)) return { alan: b.alan, sebep: 'Başka bir sitenin adını gizleyen bağlantı' };
    // [discord.com](https://kotu.site): görünen adresle gidilen adres farklı
    const gorunen = b.gorunen && gorunenAlan(b.gorunen);
    if (gorunen && !ayniSite(wwwsuz(gorunen), wwwsuz(b.alan))) {
      return { alan: b.alan, sebep: `Görünen adresle (${gorunen}) gittiği adres farklı bağlantı` };
    }
    const sebep = alanSebebi(b.alan);
    if (sebep) return { alan: b.alan, sebep };
    if (kisaltici && altAlanMi(b.alan, KISALTICILAR)) return { alan: b.alan, sebep: 'Kısaltılmış bağlantı (gittiği yer görünmüyor)' };
  }
  return null;
}

// Alan listeleri için: "https://Kotu.site/x" ya da "kotu.site" → "kotu.site". Geçersizse null.
function alanBicimi(girdi) {
  try {
    const alan = new URL(/^[a-z]+:\/\//i.test(girdi.trim()) ? girdi.trim() : `http://${girdi.trim()}`).hostname.toLowerCase().replace(/\.$/, '');
    return /^(?:[a-z0-9-]+\.)+[a-z0-9-]{2,}$/.test(alan) ? alan : null;
  } catch {
    return null;
  }
}

module.exports = { denetle, alanSebebi, alanBicimi, baglantilar, iskelet };
