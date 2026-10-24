// Haber beslemelerini (RSS 2.0, RSS 1.0, Atom) ve site sayfalarını ayrıştırır.
//
// İçerik internetten, sunucu yöneticilerinin verdiği adreslerden gelir; yani güvenilmez.
// Buradaki düzenli ifadeler özel hazırlanmış bir sayfada çok uzun sürebilir (ör. hiç
// kapanmayan binlerce <title>). Bot tek iş parçacığında çalıştığı için o sırada
// bütün sunuculara cevap veremez hale gelir. Bu yüzden haber.js bu dosyayı ayrı bir
// iş parçacığında (worker) çalıştırır ve süre aşılırsa işi keser.
const { isMainThread, parentPort, workerData } = require('node:worker_threads');

// Bir beslemenin yalnızca en yeni bu kadar haberine bakılır. Bazı siteler yüzlerce
// haber listeler; hepsi hatırlanamayacağı için eskiler "yeni" sanılıp duyurulmasın.
const BAKILAN_HABER = 50;

// --- Besleme ayrıştırma (RSS 2.0, RSS 1.0 ve Atom) ---
const VARLIKLAR = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  hellip: '…', ndash: '–', mdash: '—', laquo: '«', raquo: '»', ouml: 'ö', Ouml: 'Ö', uuml: 'ü', Uuml: 'Ü',
  ccedil: 'ç', Ccedil: 'Ç', acirc: 'â', Acirc: 'Â', icirc: 'î', ucirc: 'û',
};

function varliklariCoz(metin) {
  return metin.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (tum, ad) => {
    if (ad[0] === '#') {
      const kod = ad[1].toLowerCase() === 'x' ? parseInt(ad.slice(2), 16) : parseInt(ad.slice(1), 10);
      return kod > 0 && kod <= 0x10ffff ? String.fromCodePoint(kod) : '';
    }
    return VARLIKLAR[ad] ?? tum;
  });
}

const cdataAc = (metin) => metin.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');

// Bir etiketin ham içeriği; yoksa ''
function ham(blok, ad) {
  const eslesme = new RegExp(`<${ad}(?:\\s[^>]*)?>([\\s\\S]*?)</${ad}>`, 'i').exec(blok);
  return eslesme ? eslesme[1].trim() : '';
}

const duzMetin = (hamMetin) => varliklariCoz(cdataAc(hamMetin)).replace(/\s+/g, ' ').trim();

// Açıklamalar çoğunlukla HTML içerir (bazen bir kez daha kodlanmış halde): etiketler atılır
function ozet(hamMetin) {
  const html = varliklariCoz(cdataAc(hamMetin));
  return varliklariCoz(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

const nitelik = (etiket, ad) => new RegExp(`\\s${ad}=["']([^"']+)["']`, 'i').exec(etiket)?.[1];

function resimBul(blok, hamAciklama) {
  for (const etiket of blok.match(/<(?:enclosure|media:content|media:thumbnail)\b[^>]*>/gi) ?? []) {
    const adres = nitelik(etiket, 'url');
    const tur = nitelik(etiket, 'type') ?? nitelik(etiket, 'medium') ?? '';
    const resimMi = /^media:thumbnail/i.test(etiket.slice(1)) || /image/i.test(tur) || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(adres ?? '');
    if (adres && resimMi) return varliklariCoz(adres);
  }
  const gomulu = /<img\b[^>]*\ssrc=["']([^"']+)["']/i.exec(varliklariCoz(cdataAc(hamAciklama)));
  return gomulu ? varliklariCoz(gomulu[1]) : null;
}

// Besleme değilse null döndürür.
function ayristir(xml, taban) {
  if (!/<(rss|feed|rdf:RDF)\b/i.test(xml)) return null;
  const atom = /<feed\b/i.test(xml) && !/<rss\b/i.test(xml);
  const bloklar = xml.match(atom ? /<entry\b[\s\S]*?<\/entry>/gi : /<item\b[\s\S]*?<\/item>/gi) ?? [];
  const ust = bloklar.length ? xml.slice(0, xml.indexOf(bloklar[0])) : xml;

  const mutlak = (adres) => {
    try {
      const u = new URL(adres, taban);
      return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
    } catch {
      return null;
    }
  };

  const haberler = bloklar.map((blok) => {
    let baglanti = duzMetin(ham(blok, 'link'));
    if (!baglanti) {
      // Atom: <link href="..."/>; birden fazlaysa rel="alternate" olan
      const linkler = blok.match(/<link\b[^>]*>/gi) ?? [];
      const secilen = linkler.find((l) => /rel=["']alternate["']/i.test(l)) ?? linkler.find((l) => !/\srel=/i.test(l)) ?? linkler[0];
      baglanti = secilen ? varliklariCoz(nitelik(secilen, 'href') ?? '') : '';
    }
    const hamAciklama = ham(blok, 'content:encoded') || ham(blok, 'description') || ham(blok, 'summary') || ham(blok, 'content');
    const tarih = Date.parse(duzMetin(ham(blok, 'pubDate') || ham(blok, 'published') || ham(blok, 'updated') || ham(blok, 'dc:date')));
    const url = mutlak(baglanti);
    const resim = resimBul(blok, hamAciklama);
    return {
      kimlik: duzMetin(ham(blok, 'guid') || ham(blok, 'id')) || url,
      baslik: duzMetin(ham(blok, 'title')),
      url,
      ozet: ozet(ham(blok, 'description') || ham(blok, 'summary') || hamAciklama),
      resim: resim ? mutlak(resim) : null,
      zaman: Number.isNaN(tarih) ? null : tarih,
    };
  });

  let gecerli = haberler.filter((h) => h.kimlik && h.baslik && h.url);
  // Çoğu besleme en yeniyi başa koyar; hepsinin tarihi varsa buna güvenilmez, tarihe göre sıralanır
  if (gecerli.length && gecerli.every((h) => h.zaman)) gecerli = gecerli.sort((a, b) => b.zaman - a.zaman);
  return {
    ad: duzMetin(ham(ust, 'title')) || new URL(taban).hostname.replace(/^www\./, ''),
    haberler: gecerli.slice(0, BAKILAN_HABER),
  };
}

// Besleme olmayan bir sayfanın duyurduğu besleme adresleri:
// <link rel="alternate" type="application/rss+xml" href="...">
function beslemeAdaylari(html, taban) {
  const adaylar = [];
  for (const etiket of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/rel=["']alternate["']/i.test(etiket) || !/type=["']application\/(rss|atom)\+xml["']/i.test(etiket)) continue;
    const href = nitelik(etiket, 'href');
    if (!href) continue;
    try {
      adaylar.push(new URL(varliklariCoz(href), taban).href);
    } catch {
      // Geçersiz adres: atlanır
    }
  }
  return adaylar;
}

// Sayfa besleme ise { besleme }, değilse içinde duyurduğu besleme adresleriyle { besleme: null, adaylar }
function incele(metin, taban) {
  const besleme = ayristir(metin, taban);
  return { besleme, adaylar: besleme ? [] : beslemeAdaylari(metin, taban) };
}

if (!isMainThread && parentPort) parentPort.postMessage(incele(workerData.metin, workerData.taban));

module.exports = { ayristir, beslemeAdaylari, incele, BAKILAN_HABER };
