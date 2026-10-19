// YouTube: canlı yayın için anında bildirim servisi yok. Takip edilen kanalların
// video akışı düzenli aralıklarla okunur ve yeni videoların canlı olup olmadığı sorulur.
const { adAyikla } = require('./ortak');

const ANAHTAR = process.env.YOUTUBE_API_KEY;
const API = 'https://www.googleapis.com/youtube/v3';
const KONTROL_ARALIGI = 60_000;
const KANAL_BASI_VIDEO = 3; // Akıştaki en yeni kaç videoya bakılsın

let bildir = () => {};
let takipEdilenler = () => [];

async function api(yol) {
  const yanit = await fetch(`${API}${yol}&key=${ANAHTAR}`, { signal: AbortSignal.timeout(15_000) });
  const govde = await yanit.json().catch(() => null);
  if (!yanit.ok) throw new Error(`YouTube HTTP ${yanit.status}: ${govde?.error?.message ?? 'bilinmeyen hata'}`);
  return govde;
}

// "@kanal", kanal adresi ya da "UC..." ile başlayan kanal kimliği kabul eder
async function bul(girdi) {
  // Kanal adresinin sonundaki sekme adı atılır: youtube.com/@kanal/live
  const ad = adAyikla(girdi.trim().replace(/\/(live|streams|videos|featured)\/?$/, ''));
  if (!/^[\w.-]{3,64}$/.test(ad)) return null;
  const sorgu = /^UC[\w-]{22}$/.test(ad) ? `id=${ad}` : `forHandle=${encodeURIComponent(`@${ad}`)}`;
  const k = (await api(`/channels?part=snippet&${sorgu}`)).items?.[0];
  if (!k) return null;
  return { id: k.id, giris: (k.snippet.customUrl ?? k.id).replace(/^@/, ''), ad: k.snippet.title };
}

// Canlı olmadığı kesinleşen videolar (normal video ya da bitmiş yayın) bir daha
// canlıya dönmez; kota harcamamak için tekrar sorulmaz.
const bitenler = new Set();

async function kanalVideolari(kanalId) {
  // Bu akış ücretsizdir ve kota harcamaz
  const yanit = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${kanalId}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!yanit.ok) throw new Error(`YouTube akışı HTTP ${yanit.status}`);
  const idler = [...(await yanit.text()).matchAll(/<yt:videoId>([\w-]{11})<\/yt:videoId>/g)].map((e) => e[1]);
  return idler.slice(0, KANAL_BASI_VIDEO);
}

async function kontrolEt() {
  const adaylar = new Set();
  for (const kanalId of takipEdilenler()) {
    const idler = await kanalVideolari(kanalId).catch((hata) => {
      console.error(`YouTube kanalı okunamadı (${kanalId}):`, hata.message);
      return [];
    });
    for (const id of idler) if (!bitenler.has(id)) adaylar.add(id);
  }

  const liste = [...adaylar];
  for (let i = 0; i < liste.length; i += 50) {
    const yanit = await api(`/videos?part=snippet&id=${liste.slice(i, i + 50).join(',')}`);
    for (const v of yanit.items ?? []) {
      const durum = v.snippet.liveBroadcastContent; // 'live' | 'upcoming' | 'none'
      if (durum === 'upcoming') continue; // Planlanmış yayın: başlayana kadar sormaya devam edilir
      bitenler.add(v.id);
      if (durum !== 'live') continue;
      await bildir('youtube', v.snippet.channelId, {
        anahtar: v.id,
        ad: v.snippet.channelTitle,
        baslik: v.snippet.title,
        url: `https://www.youtube.com/watch?v=${v.id}`,
        resim: (v.snippet.thumbnails.maxres ?? v.snippet.thumbnails.high ?? v.snippet.thumbnails.default)?.url,
      });
    }
  }
  // Bellek sınırsız büyümesin
  if (bitenler.size > 5000) bitenler.clear();
}

function baslat(secenek) {
  ({ bildir, takipEdilenler } = secenek);
  if (!ANAHTAR) return;
  let calisiyor = false;
  setInterval(async () => {
    if (calisiyor) return;
    calisiyor = true;
    try {
      await kontrolEt();
    } catch (hata) {
      console.error('YouTube kontrolü başarısız:', hata.message);
    } finally {
      calisiyor = false;
    }
  }, KONTROL_ARALIGI);
}

module.exports = {
  ad: 'YouTube',
  simge: '🔴',
  renk: 0xff0000,
  kanalAdresi: (y) => `https://www.youtube.com/channel/${y.id}`,
  gereken: 'YOUTUBE_API_KEY',
  hazir: () => Boolean(ANAHTAR),
  baslat,
  bul,
  esitle: async () => {}, // Abonelik yok; kontrol her seferinde güncel listeyi okur
  kontrolEt,
};
