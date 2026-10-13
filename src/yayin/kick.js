// Kick: yayın açıldığında Kick'in kendisi haber verir (resmi webhook servisi).
// Webhook adresi Kick geliştirici uygulamasının ayarlarına yazılır: YAYIN_ADRESI + /kick
const crypto = require('node:crypto');
const { apiIstemcisi, adAyikla, webhookAdresi } = require('./ortak');

const { KICK_CLIENT_ID: KIMLIK, KICK_CLIENT_SECRET: GIZLI } = process.env;
const TABAN = 'https://api.kick.com/public/v1';
const OLAY = 'livestream.status.updated';

const api = apiIstemcisi({
  ad: 'Kick',
  taban: TABAN,
  jetonAdresi: 'https://id.kick.com/oauth/token',
  kimlik: KIMLIK,
  gizli: GIZLI,
});

let bildir = () => {};

async function bul(girdi) {
  const slug = adAyikla(girdi).toLowerCase();
  if (!/^[a-z0-9_-]{1,25}$/.test(slug)) return null;
  const k = (await api(`/channels?slug=${slug}`)).data?.[0];
  if (!k) return null;
  // Görünen ad kanal bilgisinde yok; alınamazsa adres adı kullanılır
  const kullanici = await api(`/users?id=${k.broadcaster_user_id}`).then((y) => y.data?.[0]).catch(() => null);
  return { id: String(k.broadcaster_user_id), giris: k.slug, ad: kullanici?.name ?? k.slug };
}

// Kick'teki abonelikleri takip listesiyle aynı hale getirir.
async function esitle(idler) {
  const istenen = new Set(idler);
  const mevcut = new Set();
  const silinecek = [];
  for (const a of (await api('/events/subscriptions')).data ?? []) {
    if (a.event !== OLAY) continue;
    const id = String(a.broadcaster_user_id);
    if (istenen.has(id) && !mevcut.has(id)) mevcut.add(id);
    else silinecek.push(a.id);
  }
  if (silinecek.length) {
    await api(`/events/subscriptions?${silinecek.map((id) => `id=${id}`).join('&')}`, { method: 'DELETE' });
  }
  for (const id of istenen) {
    if (mevcut.has(id)) continue;
    const sonuc = await api('/events/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ broadcaster_user_id: Number(id), events: [{ name: OLAY, version: 1 }], method: 'webhook' }),
    });
    const hata = sonuc?.data?.find((s) => s.error)?.error;
    if (hata) throw new Error(`Kick aboneliği oluşturulamadı: ${hata}`);
  }
}

// Kick mesajlarını kendi özel anahtarıyla imzalar; açık anahtarı servisinden alınır.
let acikAnahtar = null;
let anahtarDenendi = 0;
// Anahtar en sık bu aralıkla indirilir. Webhook adresine herkes istek atabilir; imzası
// tutmayan her istek Kick'e yeni bir istek attıramasın.
const ANAHTAR_ARALIGI = 60_000;
async function acikAnahtariAl(yenile = false) {
  if ((!acikAnahtar || yenile) && Date.now() - anahtarDenendi > ANAHTAR_ARALIGI) {
    anahtarDenendi = Date.now();
    const yanit = await fetch(`${TABAN}/public-key`, { signal: AbortSignal.timeout(15_000) });
    const anahtar = (await yanit.json().catch(() => null))?.data?.public_key;
    if (yanit.ok && typeof anahtar === 'string') acikAnahtar = anahtar;
  }
  return acikAnahtar;
}

async function imzaGecerli(basliklar, govde) {
  const kimlik = basliklar['kick-event-message-id'];
  const zaman = basliklar['kick-event-message-timestamp'];
  const imza = basliklar['kick-event-signature'];
  if (!kimlik || !zaman || !imza) return false;
  // Eski bir mesajın yeniden gönderilmesine karşı: 10 dakikadan eski olanları reddet
  if (!(Math.abs(Date.now() - Date.parse(zaman)) <= 10 * 60_000)) return false;
  const dogrula = (anahtar) =>
    Boolean(anahtar) && crypto.createVerify('RSA-SHA256').update(`${kimlik}.${zaman}.`).update(govde).verify(anahtar, imza, 'base64');
  const eldeki = await acikAnahtariAl();
  if (dogrula(eldeki)) return true;
  // Kick anahtarını değiştirmiş olabilir; tutmazsa güncel anahtarla dene
  const guncel = await acikAnahtariAl(true);
  return guncel !== eldeki && dogrula(guncel);
}

async function yayinBasladi(olay) {
  const geldi = Date.now();
  const y = olay.broadcaster;
  // Kategori ve önizleme resmi; alınamazsa bildirim yine de gitsin
  const kanal = await api(`/channels?broadcaster_user_id=${y.user_id}`).then((s) => s.data?.[0]).catch(() => null);
  await bildir('kick', String(y.user_id), {
    anahtar: olay.started_at,
    basladi: Date.parse(olay.started_at),
    geldi,
    ad: y.username,
    baslik: olay.title,
    oyun: kanal?.category?.name,
    url: `https://kick.com/${y.channel_slug}`,
    resim: kanal?.stream?.thumbnail,
    profil: y.profile_picture,
  });
}

async function webhook(basliklar, govde) {
  if (!(await imzaGecerli(basliklar, govde))) return { durum: 403 };
  if (basliklar['kick-event-type'] === OLAY) {
    const olay = JSON.parse(govde.toString('utf8'));
    if (olay.is_live) yayinBasladi(olay).catch((hata) => console.error('Kick bildirimi işlenemedi:', hata.message));
  }
  return { durum: 200 };
}

module.exports = {
  ad: 'Kick',
  simge: '🟢',
  renk: 0x53fc18,
  kanalAdresi: (y) => `https://kick.com/${y.giris}`,
  gereken: 'KICK_CLIENT_ID, KICK_CLIENT_SECRET ve YAYIN_ADRESI',
  hazir: () => Boolean(KIMLIK && GIZLI && webhookAdresi('/kick')),
  baslat: (secenek) => {
    bildir = secenek.bildir;
  },
  bul,
  esitle,
  webhook,
};
