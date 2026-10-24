// Twitch ve Kick aynı giriş yöntemini kullanır: uygulama kimliği + gizli anahtar
// ile kısa ömürlü bir jeton alınır ve isteklere eklenir.
function apiIstemcisi({ ad, taban, jetonAdresi, kimlik, gizli, ekBasliklar = {} }) {
  let jeton = null;
  let bitis = 0;

  async function jetonAl() {
    if (jeton && Date.now() < bitis) return jeton;
    const yanit = await fetch(jetonAdresi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: kimlik, client_secret: gizli }),
      signal: AbortSignal.timeout(15_000),
    });
    const govde = await yanit.json().catch(() => null);
    if (!yanit.ok || !govde?.access_token) {
      throw new Error(`${ad} girişi başarısız (HTTP ${yanit.status}). .env içindeki kimlik ve gizli anahtar doğru mu?`);
    }
    jeton = govde.access_token;
    // Süresi dolmadan 5 dakika önce yenilenir
    bitis = Date.now() + Math.max((govde.expires_in ?? 3600) - 300, 60) * 1000;
    return jeton;
  }

  // Başarılıysa JSON gövdeyi (gövde yoksa null) döndürür, değilse hata fırlatır.
  return async function iste(yol, secenek = {}, yenidenDene = true) {
    const yanit = await fetch(taban + yol, {
      ...secenek,
      headers: {
        Authorization: `Bearer ${await jetonAl()}`,
        'Content-Type': 'application/json',
        ...ekBasliklar,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (yanit.status === 401 && yenidenDene) {
      jeton = null; // Jeton vaktinden önce iptal edilmiş olabilir; bir kez yenisiyle denenir
      return iste(yol, secenek, false);
    }
    const govde = await yanit.json().catch(() => null);
    if (!yanit.ok) throw new Error(`${ad} HTTP ${yanit.status}: ${govde?.message ?? govde?.error ?? 'bilinmeyen hata'}`);
    return govde;
  };
}

// "https://site.com/kanal/", "@kanal" ya da "kanal" → "kanal"
function adAyikla(girdi) {
  return girdi.trim().replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop().replace(/^@/, '');
}

const webhookAdresi = (yol) => (process.env.YAYIN_ADRESI ? `${process.env.YAYIN_ADRESI.replace(/\/+$/, '')}${yol}` : null);

module.exports = { apiIstemcisi, adAyikla, webhookAdresi };
