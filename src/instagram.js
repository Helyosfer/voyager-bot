// Instagram gönderi bildirimleri: takip edilen hesaplar yeni gönderi paylaşınca
// seçilen kanala haber verir. Ayarlar /instagram komutuyla yapılır.
//
// Instagram'ın başka hesapları okumaya izin veren tek resmi yolu "Business Discovery"dir:
// kendi profesyonel hesabın üzerinden, başka profesyonel (işletme / içerik üreticisi)
// hesapların herkese açık gönderileri sorulur. Anında bildirim yoktur; hesaplar
// düzenli aralıklarla kontrol edilir.
const crypto = require('node:crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, escapeMarkdown } = require('discord.js');
const { oku, yaz, ayarlariGetir } = require('./depo');
const { adAyikla } = require('./yayin/ortak');
const { baglantisiz, sahibinToplami } = require('./yardimci');

const { META_APP_ID: UYGULAMA, META_APP_SECRET: GIZLI, INSTAGRAM_TOKEN: ILK_JETON } = process.env;
const API = 'https://graph.facebook.com';

const SUNUCU_BASI_SINIR = 20;
const TOPLAM_SINIR = 100; // Bütün sunucuların takip ettiği farklı hesap sayısı
// Aynı kişinin sahip olduğu sunucuların toplamı; tek kişi TOPLAM_SINIR'ı dolduramasın
const SAHIP_BASI_SINIR = 2 * SUNUCU_BASI_SINIR;
const EN_KISA_ARALIK = 5 * 60_000;
// Meta saatlik istek sayısını sınırlar; hesap sayısı arttıkça kontrol aralığı uzar
const SAATLIK_ISTEK = 120;
const KONTROL_BASI_GONDERI = 3; // Bir hesap için tek seferde en fazla kaç yeni gönderi duyurulsun
// Uzun ömürlü jeton 60 gün geçerlidir; süresi dolmadan yenilenir
const JETON_YENILEME = 30 * 24 * 60 * 60_000;

let client = null;
const hazir = () => Boolean(UYGULAMA && GIZLI && ILK_JETON);

// Instagram'da havuzu Meta'nın saatlik istek sınırı belirler ve bütün sunucular paylaşır; büyütülemez.
// Yabancı sunucular dolduramasın diye özellik yalnızca izin verilen sunucularda açılır:
// .env içindeki INSTAGRAM_SUNUCULAR ve GUILD_IDS. İkisi de boşsa (tek sunuculuk kurulum) her sunucuda açıktır.
function izinListesi(ortam = process.env) {
  return new Set([ortam.INSTAGRAM_SUNUCULAR, ortam.GUILD_IDS].flatMap((deger) => (deger ?? '').split(',')).map((s) => s.trim()).filter(Boolean));
}
const IZINLILER = izinListesi();
const izinli = (sunucuId, liste = IZINLILER) => liste.size === 0 || liste.has(sunucuId);

async function jsonIste(adres) {
  const yanit = await fetch(adres, { signal: AbortSignal.timeout(20_000) });
  const govde = await yanit.json().catch(() => null);
  if (!yanit.ok || govde?.error) {
    const hata = new Error(govde?.error?.message ?? `Instagram HTTP ${yanit.status}`);
    hata.kod = govde?.error?.code;
    throw hata;
  }
  return govde;
}

// .env'deki jeton kısa ömürlü olabilir (1 saat). İlk kullanımda uzun ömürlüsüyle
// değiştirilir, data/ altında saklanır ve süresi dolmadan yenilenir. .env'e yeni
// bir jeton yazılırsa (özeti değişir) saklanan atılıp baştan alınır.
async function jetonAl() {
  const kaynak = crypto.createHash('sha256').update(ILK_JETON).digest('hex').slice(0, 16);
  const kayit = oku('instagram-jeton', null);
  const gecerli = kayit?.kaynak === kaynak;
  if (gecerli && Date.now() - kayit.alindi < JETON_YENILEME) return kayit;

  try {
    const sorgu = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: UYGULAMA,
      client_secret: GIZLI,
      fb_exchange_token: gecerli ? kayit.jeton : ILK_JETON,
    });
    const yeni = await jsonIste(`${API}/oauth/access_token?${sorgu}`);
    const sonuc = { jeton: yeni.access_token, alindi: Date.now(), kaynak, hesap: gecerli ? kayit.hesap : null };
    yaz('instagram-jeton', sonuc);
    return sonuc;
  } catch (hata) {
    // Yenileme başarısız ama eldeki jeton hâlâ çalışıyor olabilir
    if (gecerli) return kayit;
    throw new Error(`Instagram jetonu alınamadı: ${hata.message}. .env içindeki INSTAGRAM_TOKEN süresi dolmuş olabilir; yenisini üret.`);
  }
}

async function iste(yol) {
  const { jeton } = await jetonAl();
  return jsonIste(`${API}${yol}${yol.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(jeton)}`);
}

// Sorguların üzerinden yapılacağı, jetona bağlı profesyonel Instagram hesabının kimliği
async function kendiHesabim() {
  const kayit = await jetonAl();
  if (kayit.hesap) return kayit.hesap;
  const sayfalar = await iste('/me/accounts?fields=instagram_business_account&limit=50');
  const hesap = sayfalar.data?.find((s) => s.instagram_business_account)?.instagram_business_account.id;
  if (!hesap) {
    throw new Error('Jetona bağlı bir profesyonel Instagram hesabı bulunamadı. Hesap bir Facebook Sayfasına bağlı mı ve jeton üretilirken o Sayfa seçildi mi?');
  }
  yaz('instagram-jeton', { ...kayit, hesap });
  return hesap;
}

// Bir hesabın profilini ve son gönderilerini getirir.
async function hesapGetir(kullaniciAdi, adet = 5) {
  const alanlar = `business_discovery.username(${kullaniciAdi}){username,name,profile_picture_url,media.limit(${adet}){id,caption,media_type,media_url,thumbnail_url,permalink,timestamp}}`;
  const yanit = await iste(`/${await kendiHesabim()}?fields=${encodeURIComponent(alanlar)}`);
  const h = yanit.business_discovery;
  return {
    giris: h.username,
    ad: h.name || h.username,
    profil: h.profile_picture_url,
    gonderiler: (h.media?.data ?? []).map((g) => ({
      id: g.id,
      metin: g.caption ?? '',
      // Videolarda media_url videonun kendisidir; kartta kapak resmi gösterilir
      resim: g.media_type === 'VIDEO' ? g.thumbnail_url : g.media_url,
      video: g.media_type === 'VIDEO',
      url: g.permalink,
      // "2026-01-02T03:04:05+0000" -> ayrıştırılabilir biçim
      zaman: Date.parse(String(g.timestamp).replace(/([+-]\d{2})(\d{2})$/, '$1:$2')),
    })),
  };
}

// Takip listesi: { [sunucuId]: [{ giris, ad }] }
const liste = (sunucuId) => oku('instagram', {})[sunucuId] ?? [];
const takipEdilenler = () => [...new Set(Object.values(oku('instagram', {})).flat().map((h) => h.giris))];

const enYeni = (gonderiler) => gonderiler.reduce((en, g) => Math.max(en, g.zaman || 0), 0);

// Başarılıysa { hesap }, değilse { hata } döndürür.
async function ekle(sunucuId, girdi) {
  if (!hazir()) return { hata: 'Instagram bağlantısı henüz kurulmamış. Botun .env dosyasında şunlar dolu olmalı: META_APP_ID, META_APP_SECRET ve INSTAGRAM_TOKEN.' };
  if (!izinli(sunucuId)) return { hata: 'Instagram bildirimleri bu sunucuda açık değil. Botun sahibi sunucuyu izin listesine eklemeli.' };
  const kullaniciAdi = adAyikla(girdi).toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(kullaniciAdi)) return { hata: 'Geçerli bir Instagram kullanıcı adı ya da profil adresi yaz.' };

  const zatenVar = { hata: `**@${kullaniciAdi}** zaten listede.` };
  const dolu = { hata: `Bir sunucu en fazla ${SUNUCU_BASI_SINIR} Instagram hesabı takip edebilir.` };
  const onceki = liste(sunucuId);
  if (onceki.some((h) => h.giris === kullaniciAdi)) return zatenVar;
  if (onceki.length >= SUNUCU_BASI_SINIR) return dolu;
  const sahipDolu = { hata: `Bu sunucunun sahibine ait sunucular toplamda en fazla ${SAHIP_BASI_SINIR} Instagram hesabı takip edebilir.` };
  if (sahibinToplami(client, oku('instagram', {}), sunucuId) >= SAHIP_BASI_SINIR) return sahipDolu;
  const takipte = takipEdilenler();
  if (!takipte.includes(kullaniciAdi) && takipte.length >= TOPLAM_SINIR) return { hata: 'Botun Instagram kapasitesi doldu; şu an yeni hesap eklenemiyor.' };

  let hesap;
  try {
    hesap = await hesapGetir(kullaniciAdi);
  } catch (hata) {
    // Meta, bulunamayan ve profesyonel olmayan hesaplar için aynı türden hata döndürür
    if (hata.kod === 110 || hata.kod === 100 || hata.kod === 803) {
      return { hata: `**@${kullaniciAdi}** bulunamadı ya da profesyonel (işletme / içerik üreticisi) bir hesap değil. Kişisel ve gizli hesaplar takip edilemez.` };
    }
    throw hata;
  }

  // Liste, Instagram'a sorulurken geçen sürede değişmiş olabilir (başka bir sunucu da hesap
  // eklemiş olabilir). Baştaki kopyayı yazmak o değişiklikleri siler; bu yüzden yeniden okunur.
  const hepsi = oku('instagram', {});
  const kayitlar = (hepsi[sunucuId] ??= []);
  if (kayitlar.some((h) => h.giris === hesap.giris)) return zatenVar;
  if (kayitlar.length >= SUNUCU_BASI_SINIR) return dolu;
  if (sahibinToplami(client, hepsi, sunucuId) >= SAHIP_BASI_SINIR) return sahipDolu;
  kayitlar.push({ giris: hesap.giris, ad: hesap.ad });
  yaz('instagram', hepsi);
  // Yalnızca bundan sonraki gönderiler duyurulsun
  const durum = oku('instagram-durum', {});
  durum[hesap.giris] ??= enYeni(hesap.gonderiler) || Date.now();
  yaz('instagram-durum', durum);
  return { hesap };
}

function cikar(sunucuId, girdi) {
  const aranan = adAyikla(girdi).toLowerCase();
  const hepsi = oku('instagram', {});
  const kayitlar = hepsi[sunucuId] ?? [];
  const sira = kayitlar.findIndex((h) => h.giris === aranan || h.ad.toLowerCase() === aranan);
  if (sira === -1) return null;
  const [silinen] = kayitlar.splice(sira, 1);
  yaz('instagram', hepsi);
  return silinen;
}

const kisalt = (metin, sinir) => (metin.length > sinir ? `${metin.slice(0, sinir - 1)}…` : metin);

function bildirimMesaji(hesap, gonderi, rol = null) {
  const embed = new EmbedBuilder()
    .setAuthor({ name: `${hesap.ad} (@${hesap.giris})`, iconURL: hesap.profil ?? undefined, url: `https://www.instagram.com/${hesap.giris}/` })
    .setURL(gonderi.url)
    .setColor(0xe1306c)
    .setFooter({ text: gonderi.video ? 'Instagram · Video' : 'Instagram' });
  if (gonderi.metin) embed.setDescription(baglantisiz(kisalt(gonderi.metin, 700)));
  if (gonderi.resim) embed.setImage(gonderi.resim);
  if (gonderi.zaman) embed.setTimestamp(gonderi.zaman);

  const dugme = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Instagram'da aç").setURL(gonderi.url);
  return {
    // Ad Instagram'dan gelir; içindeki biçimlendirme ve bağlantı yazımı mesajda çalışmasın
    content: `${rol ? `<@&${rol}> ` : ''}📸 **${escapeMarkdown(String(hesap.ad), { maskedLink: true })}** yeni bir gönderi paylaştı`,
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(dugme)],
    allowedMentions: rol ? { roles: [rol] } : { parse: [] },
  };
}

async function duyur(hesap, gonderi) {
  for (const [sunucuId, kayitlar] of Object.entries(oku('instagram', {}))) {
    if (!kayitlar.some((h) => h.giris === hesap.giris)) continue;
    const ayar = ayarlariGetir(sunucuId);
    const guild = client.guilds.cache.get(sunucuId);
    if (!ayar.instagramKanali || !guild) continue;
    try {
      const kanal = await guild.channels.fetch(ayar.instagramKanali);
      if (kanal?.isTextBased()) await kanal.send(bildirimMesaji(hesap, gonderi, ayar.instagramRol));
    } catch (hata) {
      console.error(`Instagram bildirimi gönderilemedi (${sunucuId}):`, hata.message);
    }
  }
}

async function kontrolEt() {
  for (const kullaniciAdi of takipEdilenler()) {
    let hesap;
    try {
      hesap = await hesapGetir(kullaniciAdi);
    } catch (hata) {
      console.error(`Instagram hesabı okunamadı (@${kullaniciAdi}):`, hata.message);
      continue;
    }
    const durum = oku('instagram-durum', {});
    const son = durum[kullaniciAdi];
    const yeniler = hesap.gonderiler
      .filter((g) => g.zaman && son && g.zaman > son)
      .sort((a, b) => a.zaman - b.zaman)
      .slice(-KONTROL_BASI_GONDERI);
    // Önce işaretle: gönderim sırasında bot kapanırsa aynı gönderi iki kez duyurulmasın
    durum[kullaniciAdi] = Math.max(son ?? 0, enYeni(hesap.gonderiler)) || Date.now();
    yaz('instagram-durum', durum);
    for (const gonderi of yeniler) await duyur(hesap, gonderi);
  }
}

// Hesap sayısına göre: saatlik istek sınırını aşmayacak en kısa aralık
const kontrolAraligi = () => Math.max(EN_KISA_ARALIK, (takipEdilenler().length * 3_600_000) / SAATLIK_ISTEK);

function baslat(discordClient) {
  client = discordClient;
  console.log(`Instagram bildirimi: ${hazir() ? 'hazır' : 'kapalı (eksik: META_APP_ID, META_APP_SECRET ve INSTAGRAM_TOKEN)'}`);
  if (!hazir()) return;
  const dongu = async () => {
    try {
      await kontrolEt();
    } catch (hata) {
      console.error('Instagram kontrolü başarısız:', hata.message);
    }
    setTimeout(dongu, kontrolAraligi());
  };
  // Açılışta jetonu ve bağlı hesabı doğrula; sorun varsa kayıtlarda hemen görünsün
  kendiHesabim()
    .then((hesap) => console.log(`Instagram bağlandı (hesap ${hesap})`))
    .catch((hata) => console.error('Instagram bağlanamadı:', hata.message))
    .finally(() => setTimeout(dongu, 60_000));
}

module.exports = { baslat, hazir, liste, ekle, cikar, kontrolEt, bildirimMesaji, kontrolAraligi, izinListesi, izinli, SUNUCU_BASI_SINIR };
