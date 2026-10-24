// Twitch: yayın açıldığında Twitch'in kendisi haber verir (EventSub webhook).
const crypto = require('node:crypto');
const { oku, yaz } = require('../depo');
const { apiIstemcisi, adAyikla, webhookAdresi } = require('./ortak');

const { TWITCH_CLIENT_ID: KIMLIK, TWITCH_CLIENT_SECRET: GIZLI } = process.env;
const GERI_ARAMA = webhookAdresi('/twitch');

const api = apiIstemcisi({
  ad: 'Twitch',
  taban: 'https://api.twitch.tv/helix',
  jetonAdresi: 'https://id.twitch.tv/oauth2/token',
  kimlik: KIMLIK,
  gizli: GIZLI,
  ekBasliklar: { 'Client-Id': KIMLIK },
});

let bildir = () => {};

// Twitch'in gönderdiği mesajları imzalarken kullanacağı anahtar. İlk seferde üretilip saklanır.
function imzaAnahtari() {
  const kayit = oku('yayin-gizli', {});
  if (!kayit.twitch) {
    kayit.twitch = crypto.randomBytes(32).toString('hex');
    yaz('yayin-gizli', kayit);
  }
  return kayit.twitch;
}

async function bul(girdi) {
  const giris = adAyikla(girdi).toLowerCase();
  if (!/^[a-z0-9_]{2,25}$/.test(giris)) return null;
  const k = (await api(`/users?login=${giris}`)).data[0];
  return k ? { id: k.id, giris: k.login, ad: k.display_name } : null;
}

async function abonelikler() {
  const hepsi = [];
  let imlec = '';
  do {
    const sayfa = await api(`/eventsub/subscriptions?type=stream.online${imlec && `&after=${imlec}`}`);
    hepsi.push(...sayfa.data);
    imlec = sayfa.pagination?.cursor ?? '';
  } while (imlec);
  return hepsi.filter((a) => a.transport.callback === GERI_ARAMA);
}

// Twitch'teki abonelikleri takip listesine uygun hale getirir.
async function esitle(idler) {
  const istenen = new Set(idler);
  const saglam = new Set();
  for (const a of await abonelikler()) {
    const id = a.condition.broadcaster_user_id;
    const calisiyor = a.status === 'enabled' || a.status === 'webhook_callback_verification_pending';
    if (istenen.has(id) && calisiyor && !saglam.has(id)) saglam.add(id);
    else await api(`/eventsub/subscriptions?id=${a.id}`, { method: 'DELETE' });
  }
  for (const id of istenen) {
    if (saglam.has(id)) continue;
    await api('/eventsub/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        type: 'stream.online',
        version: '1',
        condition: { broadcaster_user_id: id },
        transport: { method: 'webhook', callback: GERI_ARAMA, secret: imzaAnahtari() },
      }),
    });
  }
}

async function yayinBasladi(olay) {
  if (olay.type !== 'live') return; // Tekrar yayını (rerun) gibi canlı olmayan yayınlar atlanır
  const geldi = Date.now();
  // Başlık ve oyun; alınamazsa bildirim yine de gitsin
  const [kanal, kullanici] = await Promise.all([
    api(`/channels?broadcaster_id=${olay.broadcaster_user_id}`).then((y) => y.data[0]).catch(() => null),
    api(`/users?id=${olay.broadcaster_user_id}`).then((y) => y.data[0]).catch(() => null),
  ]);
  await bildir('twitch', olay.broadcaster_user_id, {
    anahtar: olay.id,
    basladi: Date.parse(olay.started_at),
    geldi,
    ad: olay.broadcaster_user_name,
    baslik: kanal?.title,
    oyun: kanal?.game_name,
    url: `https://www.twitch.tv/${olay.broadcaster_user_login}`,
    resim: `https://static-cdn.jtvnw.net/previews-ttv/live_user_${olay.broadcaster_user_login}-640x360.jpg?t=${Date.now()}`,
    profil: kullanici?.profile_image_url,
  });
}

// Gelen isteğin gerçekten Twitch'ten geldiğini imzasıyla doğrular, sonra işler.
function webhook(basliklar, govde) {
  const kimlik = basliklar['twitch-eventsub-message-id'];
  const zaman = basliklar['twitch-eventsub-message-timestamp'];
  const imza = basliklar['twitch-eventsub-message-signature'];
  if (!kimlik || !zaman || !imza) return { durum: 400 };

  const beklenen = `sha256=${crypto.createHmac('sha256', imzaAnahtari()).update(kimlik + zaman).update(govde).digest('hex')}`;
  // Uzunluk bayt olarak karşılaştırılır: timingSafeEqual uzunluklar farklıysa hata fırlatır
  const [gelen, olmasiGereken] = [Buffer.from(imza), Buffer.from(beklenen)];
  const gecerli = gelen.length === olmasiGereken.length && crypto.timingSafeEqual(gelen, olmasiGereken);
  // Eski bir mesajın yeniden gönderilmesine karşı: 10 dakikadan eski mesajlar reddedilir
  if (!gecerli || Math.abs(Date.now() - Date.parse(zaman)) > 10 * 60_000) return { durum: 403 };

  const mesaj = JSON.parse(govde.toString('utf8'));
  const tur = basliklar['twitch-eventsub-message-type'];
  if (tur === 'webhook_callback_verification') {
    return { durum: 200, basliklar: { 'Content-Type': 'text/plain' }, govde: mesaj.challenge };
  }
  if (tur === 'notification' && mesaj.subscription.type === 'stream.online') {
    yayinBasladi(mesaj.event).catch((hata) => console.error('Twitch bildirimi işlenemedi:', hata.message));
  } else if (tur === 'revocation') {
    console.error(`Twitch aboneliği iptal edildi (${mesaj.subscription.condition.broadcaster_user_id}): ${mesaj.subscription.status}`);
  }
  return { durum: 204 };
}

module.exports = {
  ad: 'Twitch',
  simge: '🟣',
  renk: 0x9146ff,
  kanalAdresi: (y) => `https://www.twitch.tv/${y.giris}`,
  gereken: 'TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET ve YAYIN_ADRESI',
  hazir: () => Boolean(KIMLIK && GIZLI && GERI_ARAMA),
  baslat: (secenek) => {
    bildir = secenek.bildir;
  },
  bul,
  esitle,
  webhook,
};
