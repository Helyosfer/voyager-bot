// Haber bildirimleri: haber sitelerinin RSS/Atom beslemelerini düzenli aralıklarla
// okur, yeni haberleri seçilen kanala gönderir. Ayarlar /haber komutuyla yapılır.
const dns = require('node:dns').promises;
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const path = require('node:path');
const zlib = require('node:zlib');
const { Worker } = require('node:worker_threads');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { oku, yaz, ayarlariGetir } = require('./depo');
const { ayristir } = require('./haber-ayristir');
const { baglantisiz, sahibinToplami } = require('./yardimci');

const KONTROL_ARALIGI = 10 * 60_000;
const SUNUCU_BASI_SINIR = 15;
// Bütün sunucuların takip ettiği farklı besleme sayısı. Yayın bildirimlerindeki oranla aynıdır
// (orada 9000 / 50): havuz 180 sunucunun kendi sınırı kadardır, yani tek bir sunucu havuzun
// en fazla %0,6'sını kullanabilir. Havuz büyük olduğu için kontrol döngüsü kaynakları birkaçı
// aynı anda okur ve sorun çıkaranları seyrekleştirir (aşağıda, kontrolEt).
const TOPLAM_SINIR = 180 * SUNUCU_BASI_SINIR;
// Aynı kişinin sahip olduğu sunucuların toplamı; tek kişi TOPLAM_SINIR'ı dolduramasın
const SAHIP_BASI_SINIR = 2 * SUNUCU_BASI_SINIR;
const KONTROL_BASI_HABER = 3; // Bir beslemeden tek seferde en fazla kaç haber duyurulsun
const GORULEN_SINIRI = 300; // Besleme başına hatırlanan haber sayısı (BAKILAN_HABER'den büyük olmalı)
const EN_FAZLA_BOYUT = 3_000_000;
// Bir sayfanın indirilmesi en fazla bu kadar sürer. Bağlantıyı açık tutup veriyi damla
// damla gönderen bir site, kontrol döngüsünü (ve diğer bütün kaynakları) bekletemesin.
const INDIRME_SURESI = 20_000;
const AYRISTIRMA_SURESI = 5_000;

let client = null;

// --- Güvenli indirme ---
// Adresi sunucu yöneticileri verir, isteği bot kendi sunucusundan yapar. Botun
// bulunduğu makinenin iç servislerine ya da özel ağlara istek attırılamasın diye
// yalnızca herkese açık adreslere, standart portlardan bağlanılır.
const yasakli = new net.BlockList();
for (const [ag, onek] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3],
  // Belgeleme ağları ve eski 6to4 aktarıcısı
  ['192.0.2.0', 24], ['198.51.100.0', 24], ['203.0.113.0', 24], ['192.88.99.0', 24],
]) yasakli.addSubnet(ag, onek, 'ipv4');
for (const [ag, onek] of [
  ['::', 127], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['64:ff9b::', 96],
  // İçine IPv4 adresi gömülen geçiş adresleri (NAT64, 6to4, Teredo): gömülü adres iç ağı
  // gösterebilir. Ayrıca belgeleme ve çöp ağları.
  ['64:ff9b:1::', 48], ['2002::', 16], ['2001::', 32], ['2001:db8::', 32], ['100::', 64],
  // Kullanımdan kalkmış ama bazı sistemlerde hâlâ yönlendirilebilen aralıklar: IPv4 uyumlu
  // adresler (::a.b.c.d, ::/127'yi de kapsar) ve eski site-local ağı
  ['::', 96], ['fec0::', 10],
]) {
  yasakli.addSubnet(ag, onek, 'ipv6');
}

function herkeseAcik(adres, aile) {
  if (aile === 6) {
    const esli = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(adres); // IPv4'ün IPv6 içine gömülmüş hali
    if (esli) return !yasakli.check(esli[1], 'ipv4');
    return !yasakli.check(adres, 'ipv6');
  }
  return !yasakli.check(adres, 'ipv4');
}

// Başarılıysa { govde: Buffer, tur, adres } döndürür; adres yönlendirmelerden sonraki son adrestir.
async function indir(adres, kalanYonlendirme = 3) {
  const u = new URL(adres);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Yalnızca http ve https adresleri kabul edilir');
  if (u.port || u.username || u.password) throw new Error('Port ya da kullanıcı bilgisi içeren adresler kabul edilmez');

  const kayitlar = await dns.lookup(u.hostname, { all: true });
  if (!kayitlar.length || !kayitlar.every((k) => herkeseAcik(k.address, k.family))) {
    throw new Error('Bu adrese bağlanılamıyor');
  }
  const hedef = kayitlar[0];

  // Bağlantı, cevap ve gövdenin tamamı için tek bir süre sınırı (aşağıdaki "timeout"
  // yalnızca bağlantının sessiz kaldığı süreyi ölçer)
  let istek;
  const sure = setTimeout(() => istek?.destroy(new Error('Zaman aşımı')), INDIRME_SURESI);
  try {
    return await tekIstek();
  } finally {
    clearTimeout(sure);
  }

  async function tekIstek() {
    const yanit = await new Promise((coz, reddet) => {
      istek = (u.protocol === 'https:' ? https : http).request(u, {
        // Doğrulanan IP'ye bağlan; aradaki sürede alan adı başka bir yere çevrilemesin
        lookup: (_ad, secenek, geri) =>
          secenek?.all ? geri(null, [{ address: hedef.address, family: hedef.family }]) : geri(null, hedef.address, hedef.family),
        headers: {
          'User-Agent': 'VoyagerBot/1.0 (Discord haber botu; RSS okuyucu)',
          Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, text/html;q=0.7, */*;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        timeout: 15_000,
      });
      istek.on('timeout', () => istek.destroy(new Error('Zaman aşımı')));
      istek.on('error', reddet);
      istek.on('response', coz);
      istek.end();
    });

    if ([301, 302, 303, 307, 308].includes(yanit.statusCode) && yanit.headers.location) {
      // Gövde okunmaz, bağlantı kapatılır: sonu gelmeyen bir gövde arka planda akmaya devam etmesin
      yanit.destroy();
      if (!kalanYonlendirme) throw new Error('Çok fazla yönlendirme');
      clearTimeout(sure); // Yönlendirilen yeni adresin kendi süre sınırı var
      return indir(new URL(yanit.headers.location, u).href, kalanYonlendirme - 1);
    }
    if (yanit.statusCode !== 200) {
      yanit.destroy();
      throw new Error(`HTTP ${yanit.statusCode}`);
    }

    const govde = await new Promise((coz, reddet) => {
      const kodlama = yanit.headers['content-encoding'];
      const akis =
        kodlama === 'gzip' ? yanit.pipe(zlib.createGunzip())
        : kodlama === 'deflate' ? yanit.pipe(zlib.createInflate())
        : kodlama === 'br' ? yanit.pipe(zlib.createBrotliDecompress())
        : yanit;
      const parcalar = [];
      let boyut = 0;
      akis.on('data', (parca) => {
        boyut += parca.length;
        if (boyut > EN_FAZLA_BOYUT) {
          yanit.destroy();
          reddet(new Error('Sayfa çok büyük'));
        } else parcalar.push(parca);
      });
      akis.on('end', () => coz(Buffer.concat(parcalar)));
      akis.on('error', reddet);
      // Sıkıştırılmış cevapta bağlantı hatası açıcıya (akis) ulaşmaz; burada yakalanmazsa istek beklemede kalır
      yanit.on('error', reddet);
      yanit.on('close', () => {
        if (!yanit.complete) reddet(new Error('Bağlantı yarıda kesildi'));
      });
    });
    return { govde, tur: yanit.headers['content-type'] ?? '', adres: u.href };
  }
}

// Türkçe sitelerde hâlâ rastlanan eski kodlamalar (windows-1254, iso-8859-9) doğru okunsun
function metneCevir({ govde, tur }) {
  const karakterSeti =
    /charset=["']?([\w-]+)/i.exec(tur)?.[1] ?? /<\?xml[^>]*encoding=["']([\w-]+)/i.exec(govde.subarray(0, 300).toString('latin1'))?.[1] ?? 'utf-8';
  try {
    return new TextDecoder(karakterSeti).decode(govde);
  } catch {
    return govde.toString('utf8');
  }
}

// İndirilen sayfayı ayrı bir iş parçacığında ayrıştırır (sebebi haber-ayristir.js'in başında).
// Süre aşılırsa iş kesilir; böylece özel hazırlanmış bir sayfa botu kilitleyemez.
function incele(metin, taban) {
  return new Promise((coz, reddet) => {
    const isci = new Worker(path.join(__dirname, 'haber-ayristir.js'), {
      workerData: { metin, taban },
      resourceLimits: { maxOldGenerationSizeMb: 128 },
    });
    const sure = setTimeout(() => {
      isci.terminate();
      reddet(new Error('Sayfa işlenemedi (çok uzun sürdü)'));
    }, AYRISTIRMA_SURESI);
    const bitir = (islem, deger) => {
      clearTimeout(sure);
      islem(deger);
    };
    isci.once('message', (sonuc) => bitir(coz, sonuc));
    isci.once('error', (hata) => bitir(reddet, hata));
    isci.once('exit', (kod) => bitir(reddet, new Error(`Sayfa işlenemedi (çıkış ${kod})`)));
  });
}

// { besleme, adaylar, yanit } döndürür; sayfa besleme değilse besleme null olur.
async function beslemeOku(adres) {
  const yanit = await indir(adres);
  return { ...(await incele(metneCevir(yanit), yanit.adres)), yanit };
}

// Verilen adres bir besleme değil de site ise beslemesini bulur.
// { adres, besleme } döndürür; bulunamazsa null.
async function beslemeBul(girdi) {
  const adres = /^https?:\/\//i.test(girdi) ? girdi : `https://${girdi}`;
  const { besleme, adaylar, yanit } = await beslemeOku(adres);
  if (besleme) return { adres: yanit.adres, besleme };

  // Sayfa beslemesini <link rel="alternate" type="application/rss+xml"> ile duyurur (adaylar).
  // Duyurmuyorsa yaygın besleme adresleri denenir
  for (const yol of ['/rss', '/feed', '/rss.xml', '/feed.xml', '/atom.xml']) adaylar.push(new URL(yol, yanit.adres).href);

  for (const aday of [...new Set(adaylar)].slice(0, 6)) {
    const sonuc = await beslemeOku(aday).catch(() => null);
    if (sonuc?.besleme?.haberler.length) return { adres: sonuc.yanit.adres, besleme: sonuc.besleme };
  }
  return null;
}

// Ağ hatalarını kullanıcıya gösterilecek kısa bir açıklamaya çevirir
function hataAciklamasi(hata) {
  if (['ENOTFOUND', 'EAI_AGAIN', 'ERR_INVALID_URL'].includes(hata.code)) return 'böyle bir site bulunamadı.';
  if (/certificate|altnames|CERT_/i.test(`${hata.code} ${hata.message}`)) return 'sitenin güvenlik sertifikası geçersiz.';
  if (['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH'].includes(hata.code) || hata.message === 'Zaman aşımı') {
    return 'site cevap vermedi ya da bağlantıyı kesti.';
  }
  return hata.message;
}

// --- Takip listesi: { [sunucuId]: [{ adres, ad }] } ---
const liste = (sunucuId) => oku('haber', {})[sunucuId] ?? [];
const takipEdilenler = () => [...new Set(Object.values(oku('haber', {})).flat().map((b) => b.adres))];

function gorulduIsaretle(adres, haberler) {
  const durum = oku('haber-durum', {});
  durum[adres] = [...new Set([...haberler.map((h) => h.kimlik), ...(durum[adres] ?? [])])].slice(0, GORULEN_SINIRI);
  yaz('haber-durum', durum);
}

// Başarılıysa { besleme: { adres, ad } }, değilse { hata } döndürür.
async function ekle(sunucuId, girdi) {
  const dolu = { hata: `Bir sunucu en fazla ${SUNUCU_BASI_SINIR} haber kaynağı takip edebilir.` };
  const sahipDolu = { hata: `Bu sunucunun sahibine ait sunucular toplamda en fazla ${SAHIP_BASI_SINIR} haber kaynağı takip edebilir.` };
  if (liste(sunucuId).length >= SUNUCU_BASI_SINIR) return dolu;
  if (sahibinToplami(client, oku('haber', {}), sunucuId) >= SAHIP_BASI_SINIR) return sahipDolu;

  let bulunan;
  try {
    bulunan = await beslemeBul(girdi.trim());
  } catch (hata) {
    return { hata: `Adrese ulaşılamadı: ${hataAciklamasi(hata)}` };
  }
  if (!bulunan) return { hata: 'Bu adreste bir haber beslemesi (RSS) bulamadım. Sitenin RSS adresini biliyorsan doğrudan onu yaz.' };

  // Liste, site okunurken geçen sürede değişmiş olabilir (başka bir sunucu da kaynak eklemiş
  // olabilir). Baştaki kopyayı yazmak o değişiklikleri siler; bu yüzden şimdi yeniden okunur.
  const hepsi = oku('haber', {});
  const kayitlar = (hepsi[sunucuId] ??= []);
  if (kayitlar.length >= SUNUCU_BASI_SINIR) return dolu;
  if (sahibinToplami(client, hepsi, sunucuId) >= SAHIP_BASI_SINIR) return sahipDolu;
  if (kayitlar.some((b) => b.adres === bulunan.adres)) return { hata: `**${bulunan.besleme.ad}** zaten listede.` };
  const takipte = takipEdilenler();
  if (!takipte.includes(bulunan.adres) && takipte.length >= TOPLAM_SINIR) return { hata: 'Botun haber kapasitesi doldu; şu an yeni kaynak eklenemiyor.' };

  const kayit = { adres: bulunan.adres, ad: bulunan.besleme.ad.slice(0, 80) };
  kayitlar.push(kayit);
  yaz('haber', hepsi);
  // Yalnızca bundan sonra çıkan haberler duyurulsun
  gorulduIsaretle(bulunan.adres, bulunan.besleme.haberler);
  return { besleme: kayit, adet: bulunan.besleme.haberler.length };
}

// girdi: listedeki sıra numarası, kaynağın adı ya da adresinin bir parçası
function cikar(sunucuId, girdi) {
  const aranan = girdi.trim().toLocaleLowerCase('tr');
  const hepsi = oku('haber', {});
  const kayitlar = hepsi[sunucuId] ?? [];
  let sira = /^\d+$/.test(aranan) ? Number(aranan) - 1 : -1;
  if (!kayitlar[sira]) {
    sira = kayitlar.findIndex((b) => b.ad.toLocaleLowerCase('tr').includes(aranan) || b.adres.toLowerCase().includes(aranan));
  }
  if (sira === -1 || !kayitlar[sira]) return null;
  const [silinen] = kayitlar.splice(sira, 1);
  yaz('haber', hepsi);
  return silinen;
}

const kisalt = (metin, sinir) => (metin.length > sinir ? `${metin.slice(0, sinir - 1)}…` : metin);

function bildirimMesaji(kaynakAdi, haber, rol = null) {
  const embed = new EmbedBuilder()
    .setAuthor({ name: kisalt(kaynakAdi, 256) })
    .setTitle(kisalt(haber.baslik, 256))
    .setURL(haber.url)
    .setColor(0x3b82f6)
    .setFooter({ text: new URL(haber.url).hostname.replace(/^www\./, '') });
  // Özet, başlığın tekrarıysa gösterilmez
  if (haber.ozet && haber.ozet !== haber.baslik) embed.setDescription(baglantisiz(kisalt(haber.ozet, 350)));
  if (haber.resim) embed.setImage(haber.resim);
  if (haber.zaman) embed.setTimestamp(haber.zaman);

  const dugme = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Haberi oku').setURL(haber.url);
  return {
    content: rol ? `<@&${rol}>` : undefined,
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(dugme)],
    allowedMentions: rol ? { roles: [rol] } : { parse: [] },
  };
}

async function duyur(adres, haber) {
  for (const [sunucuId, kayitlar] of Object.entries(oku('haber', {}))) {
    const kayit = kayitlar.find((b) => b.adres === adres);
    if (!kayit) continue;
    const ayar = ayarlariGetir(sunucuId);
    const guild = client.guilds.cache.get(sunucuId);
    if (!ayar.haberKanali || !guild) continue;
    try {
      const kanal = await guild.channels.fetch(ayar.haberKanali);
      if (kanal?.isTextBased()) await kanal.send(bildirimMesaji(kayit.ad, haber, ayar.haberRol));
    } catch (hata) {
      console.error(`Haber gönderilemedi (${sunucuId}):`, hata.message);
    }
  }
}

// --- Kontrol döngüsü ---
// Kaynakların birkaçı aynı anda okunur; yoksa kaynak sayısı arttığında ya da biri yavaş cevap
// verdiğinde bütün sunucuların haberleri gecikir. Art arda sorun çıkaran (hata veren ya da yavaş
// kalan) kaynak daha seyrek okunur: bilerek yavaş cevap veren bir kaynak herkesin sırasını uzatamasın.
const AYNI_ANDA = 4; // Aynı anda okunan kaynak sayısı (her biri ayrıştırma için bir iş parçacığı da açar)
const YAVAS_SURE = 5_000; // Okuması bundan uzun süren kaynak "yavaş" sayılır
const SORUN_ESIGI = 3; // Art arda bu kadar sorunlu okumadan sonra kaynak seyrekleşir
const SEYREK_TUR = 6; // Seyrekleşen kaynak bu kadar turda bir okunur (10 dakikalık turla saatte bir)
const sorunSayisi = new Map(); // adres -> art arda sorunlu okuma sayısı
let tur = 0;

async function kaynagiIsle(adres, okuyucu) {
  const basladi = Date.now();
  let besleme;
  try {
    ({ besleme } = await okuyucu(adres));
    if (!besleme) throw new Error('Adres artık bir besleme döndürmüyor');
  } catch (hata) {
    const sayi = (sorunSayisi.get(adres) ?? 0) + 1;
    sorunSayisi.set(adres, sayi);
    // Sürekli çalışmayan bir kaynak kayıtları doldurmasın: ilk hatada, sonra da seyrek yazılır
    if (sayi === 1 || sayi % 36 === 0) console.error(`Haber kaynağı okunamadı (${adres}, ${sayi}. kez):`, hata.message);
    return;
  }
  if (Date.now() - basladi > YAVAS_SURE) sorunSayisi.set(adres, (sorunSayisi.get(adres) ?? 0) + 1);
  else sorunSayisi.delete(adres);

  const gorulen = oku('haber-durum', {})[adres];
  // Besleme en yeniyi başa koyar; duyurulurken eskiden yeniye sıralanır
  const yeniler = gorulen ? besleme.haberler.filter((h) => !gorulen.includes(h.kimlik)).slice(0, KONTROL_BASI_HABER).reverse() : [];
  // Önce işaretlenir: gönderim sırasında bot kapanırsa aynı haber iki kez duyurulmasın
  gorulduIsaretle(adres, besleme.haberler);
  for (const haber of yeniler) await duyur(adres, haber);
}

// okuyucu: testlerde beslemeOku yerine onun sahtesi verilir
async function kontrolEt(okuyucu = beslemeOku) {
  tur++;
  const takipte = takipEdilenler();
  // Takipten çıkan kaynakların sayacı birikmesin
  const takipKumesi = new Set(takipte);
  for (const adres of sorunSayisi.keys()) if (!takipKumesi.has(adres)) sorunSayisi.delete(adres);

  const sira = takipte.filter((adres) => (sorunSayisi.get(adres) ?? 0) < SORUN_ESIGI || tur % SEYREK_TUR === 0);
  let siradaki = 0;
  const isci = async () => {
    while (siradaki < sira.length) {
      const adres = sira[siradaki++];
      // Bir kaynaktaki beklenmedik hata diğerlerinin okunmasını durdurmasın
      await kaynagiIsle(adres, okuyucu).catch((hata) => console.error(`Haber kaynağı işlenemedi (${adres}):`, hata.message));
    }
  };
  await Promise.all(Array.from({ length: AYNI_ANDA }, isci));
}

function baslat(discordClient) {
  client = discordClient;
  let calisiyor = false;
  const calistir = async () => {
    if (calisiyor) return;
    calisiyor = true;
    try {
      await kontrolEt();
    } catch (hata) {
      console.error('Haber kontrolü başarısız:', hata.message);
    } finally {
      calisiyor = false;
    }
  };
  setTimeout(calistir, 45_000);
  setInterval(calistir, KONTROL_ARALIGI);
}

module.exports = {
  baslat, liste, ekle, cikar, kontrolEt, bildirimMesaji, SUNUCU_BASI_SINIR, SAHIP_BASI_SINIR, TOPLAM_SINIR, KONTROL_ARALIGI,
  // Yalnızca testler kullanır
  indir, ayristir, incele, beslemeBul, herkeseAcik,
};
