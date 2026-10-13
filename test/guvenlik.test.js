// Güvenlik kontrollerinin testleri. Çalıştırmak için: npm test
//
// Bot başlatılmaz; Discord'a ya da başka bir servise bağlanılmaz. Modüller yüklenir, sahte
// (elle yazılmış) Discord nesneleriyle denenir. Veri geçici bir klasöre yazılır, gerçek data/
// klasörüne dokunulmaz. fetch sahtesiyle değiştirildiği için hiçbir test ağa çıkmaz.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const util = require('node:util');

const VERI = fs.mkdtempSync(path.join(os.tmpdir(), 'voyager-test-'));
const PORT = 20000 + Math.floor(Math.random() * 20000);
process.env.VERI_KLASORU = VERI;
process.env.YAYIN_PORT = String(PORT);
process.env.CLIENT_ID = '0';
// Bağlantı anahtarları boş: platformlar ve Instagram "kurulmamış" sayılır
for (const ad of ['TWITCH_CLIENT_ID', 'KICK_CLIENT_ID', 'YOUTUBE_API_KEY', 'META_APP_ID', 'YAYIN_ADRESI']) delete process.env[ad];

let fetchSayisi = 0;
let sahteAnahtar = null;
global.fetch = async () => {
  fetchSayisi++;
  return { ok: true, status: 200, json: async () => ({ data: { public_key: sahteAnahtar } }) };
};

const { Collection, DiscordAPIError, PermissionFlagsBits: P, PermissionsBitField, SnowflakeUtil } = require('discord.js');
const src = (dosya) => require(path.join(__dirname, '..', 'src', dosya));
const depo = src('depo');
const yardimci = src('yardimci');
const yayin = src('yayin');
const haber = src('haber');

after(() => fs.rmSync(VERI, { recursive: true, force: true }));

// --- Tanıtım sayfası ve webhook sunucusu ---
let sunucu;
before(async () => {
  sunucu = yayin.webhookSunucusu();
  await new Promise((coz) => sunucu.once('listening', coz));
});
after(() => sunucu.close());

// http modülü adresi düzeltebildiği için istek ham olarak gönderilir
function hamIstek(yontem, yol) {
  return new Promise((coz) => {
    let veri = '';
    const s = net.connect(PORT, '127.0.0.1', () => s.write(`${yontem} ${yol} HTTP/1.1\r\nHost: yerel\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`));
    s.on('data', (d) => (veri += d));
    s.on('close', () => coz(veri));
    s.on('error', (h) => coz(`HATA ${h.code}`));
  });
}
const durum = (cevap) => Number(cevap.split(' ')[1]);

test('ayrıştırılamayan istek adresi botu kapatmaz, 400 döner', async () => {
  assert.equal(durum(await hamIstek('GET', '//')), 400);
  assert.equal(durum(await hamIstek('GET', '/\\')), 400);
  // Sunucu hâlâ ayakta
  assert.equal(durum(await hamIstek('GET', '/')), 200);
});

test('tanıtım sayfası güvenlik başlıklarını taşır', async () => {
  const cevap = (await hamIstek('GET', '/')).toLowerCase();
  for (const baslik of ['content-security-policy:', 'x-content-type-options: nosniff', 'referrer-policy: no-referrer', 'strict-transport-security: max-age=']) {
    assert.ok(cevap.includes(baslik), baslik);
  }
});

test('bağlantısı kurulmamış platformun webhook yolu işlenmez', async () => {
  fetchSayisi = 0;
  assert.equal(durum(await hamIstek('POST', '/twitch')), 404);
  assert.equal(durum(await hamIstek('POST', '/kick')), 404);
  assert.equal(fetchSayisi, 0);
});

// --- Webhook imzaları ---
test('Twitch: yalnızca geçerli ve güncel imza kabul edilir', () => {
  const twitch = src('yayin/twitch');
  const govde = Buffer.from(JSON.stringify({ challenge: 'cevap', subscription: { type: 'stream.online' } }));
  const baslik = (imza, zaman) => ({
    'twitch-eventsub-message-id': 'k1',
    'twitch-eventsub-message-timestamp': zaman,
    'twitch-eventsub-message-signature': imza,
    'twitch-eventsub-message-type': 'webhook_callback_verification',
  });
  const simdi = new Date().toISOString();
  // 71 karakter ama 142 bayt: eskiden hata fırlatıyordu
  assert.equal(twitch.webhook(baslik('ş'.repeat(71), simdi), govde).durum, 403);

  const anahtar = depo.oku('yayin-gizli', {}).twitch;
  const imzala = (zaman) => `sha256=${crypto.createHmac('sha256', anahtar).update(`k1${zaman}`).update(govde).digest('hex')}`;
  const gecerli = twitch.webhook(baslik(imzala(simdi), simdi), govde);
  assert.deepEqual([gecerli.durum, gecerli.govde], [200, 'cevap']);

  const yanlis = imzala(simdi).replace(/.$/, (k) => (k === '0' ? '1' : '0'));
  assert.equal(twitch.webhook(baslik(yanlis, simdi), govde).durum, 403);

  const eski = new Date(Date.now() - 11 * 60_000).toISOString();
  assert.equal(twitch.webhook(baslik(imzala(eski), eski), govde).durum, 403, 'tekrar oynatılan eski mesaj');
});

test('Kick: geçerli imza kabul edilir; sahte istekler anahtarı yeniden indirtmez', async () => {
  const kick = src('yayin/kick');
  const cift = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  sahteAnahtar = cift.publicKey.export({ type: 'spki', format: 'pem' });
  const zaman = new Date().toISOString();
  const govde = Buffer.from('{}');
  const baslik = (imza) => ({
    'kick-event-message-id': 'k1',
    'kick-event-message-timestamp': zaman,
    'kick-event-signature': imza,
    'kick-event-type': 'baska.olay',
  });
  fetchSayisi = 0;
  const imza = crypto.createSign('RSA-SHA256').update(`k1.${zaman}.`).update(govde).sign(cift.privateKey, 'base64');
  assert.equal((await kick.webhook(baslik(imza), govde)).durum, 200);
  for (let i = 0; i < 20; i++) {
    assert.equal((await kick.webhook(baslik(Buffer.from(`sahte-${i}`).toString('base64')), govde)).durum, 403);
  }
  assert.equal(fetchSayisi, 1, 'açık anahtar yalnızca bir kez indirilmeli');
});

// --- Haber: iç ağ koruması ve ayrıştırma ---
test('haber indirici iç ağ adreslerine bağlanmaz', async () => {
  for (const adres of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '192.168.1.1', '100.64.0.1']) assert.equal(haber.herkeseAcik(adres, 4), false, adres);
  for (const adres of ['::1', '::ffff:127.0.0.1', '::ffff:7f00:1', 'fd00::1', 'fe80::1', '2002:7f00:1::', '64:ff9b::7f00:1', '2001:0:1::1']) {
    assert.equal(haber.herkeseAcik(adres, 6), false, adres);
  }
  assert.equal(haber.herkeseAcik('8.8.8.8', 4), true);
  assert.equal(haber.herkeseAcik('2606:4700::1111', 6), true);
  // Hepsi bağlantı kurulmadan reddedilir
  for (const url of ['http://127.0.0.1/', 'http://localhost/', 'http://2130706433/', 'http://[::1]/', 'http://169.254.169.254/latest', 'https://ornek.invalid:8443/', 'https://kullanici:sifre@ornek.invalid/', 'file:///etc/passwd']) {
    await assert.rejects(haber.indir(url), url);
  }
});

test('haber ayrıştırma ayrı iş parçacığında çalışır ve uzun süren iş kesilir', async () => {
  const besleme =
    '<?xml version="1.0"?><rss><channel><title>Deneme</title><item><title>Bir haber</title><link>https://ornek.com/a</link><guid>1</guid><description>Özet</description></item></channel></rss>';
  const iyi = await haber.incele(besleme, 'https://ornek.com/rss');
  assert.equal(iyi.besleme.ad, 'Deneme');
  assert.equal(iyi.besleme.haberler[0].url, 'https://ornek.com/a');

  const sayfa = await haber.incele('<html><head><link rel="alternate" type="application/rss+xml" href="/feed"></head></html>', 'https://ornek.com/');
  assert.deepEqual(sayfa, { besleme: null, adaylar: ['https://ornek.com/feed'] });

  // Kapanışı olmayan yüz binlerce etiket: ana iş parçacığında dakikalarca sürer
  let tik = 0;
  const sayac = setInterval(() => tik++, 50);
  await assert.rejects(haber.incele(`<rss>${'<title>'.repeat(400_000)}`, 'https://ornek.com/'), /çok uzun sürdü/);
  clearInterval(sayac);
  assert.ok(tik > 20, `ana iş parçacığı bu sürede çalışmaya devam etmeli (${tik})`);
});

// --- Yetki denetimleri ---
const izinli = (...izinler) => new PermissionsBitField(izinler);
function otoRolEtkilesimi({ kim = 'u', izinler = [], enYuksek = 3 } = {}) {
  return {
    guild: { id: 'g', ownerId: 'sahip', members: { me: { roles: { highest: { position: 10 } } } } },
    user: { id: kim },
    member: { permissions: izinli(...izinler), roles: { highest: { position: enYuksek } } },
  };
}
const rol = (position, ek = {}) => ({ id: 'r', managed: false, position, permissions: izinli(), toString: () => '<@&r>', ...ek });

test('/ayarla oto-rol: komutu kullanan rolü kendisi de verebiliyor olmalı', () => {
  const { otoRolEngeli } = yardimci;
  assert.ok(otoRolEngeli(otoRolEtkilesimi({ izinler: [P.ManageGuild], enYuksek: 9 }), rol(5)), 'Rolleri Yönet yetkisi yok');
  assert.ok(otoRolEngeli(otoRolEtkilesimi({ izinler: [P.ManageRoles], enYuksek: 5 }), rol(5)), 'rol kendi rolüne eşit');
  assert.equal(otoRolEngeli(otoRolEtkilesimi({ izinler: [P.ManageRoles], enYuksek: 6 }), rol(5)), null);
  assert.equal(otoRolEngeli(otoRolEtkilesimi({ kim: 'sahip', enYuksek: 0 }), rol(5)), null, 'sunucu sahibi');
  assert.ok(otoRolEngeli(otoRolEtkilesimi({ kim: 'sahip' }), rol(11)), 'botun rolünden yüksek');
  assert.ok(otoRolEngeli(otoRolEtkilesimi({ kim: 'sahip' }), rol(1, { managed: true })), 'entegrasyon rolü');
  assert.ok(otoRolEngeli(otoRolEtkilesimi({ kim: 'sahip' }), rol(0, { id: 'g' })), '@everyone');
});

test('yönetim yetkisi taşıyan rol oto rol yapılamaz ve yeni gelene verilmez', async () => {
  const { otoRolEngeli, otoRolVer } = yardimci;
  for (const izin of [P.Administrator, P.KickMembers, P.ManageMessages, P.ManageRoles, P.MentionEveryone]) {
    assert.ok(otoRolEngeli(otoRolEtkilesimi({ kim: 'sahip' }), rol(5, { permissions: izinli(izin) })));
  }
  assert.equal(otoRolEngeli(otoRolEtkilesimi({ kim: 'sahip' }), rol(5, { permissions: izinli(P.SendMessages, P.ViewChannel) })), null);

  const verilen = [];
  const uye = (r) => ({
    guild: { id: 'oto-rol-sunucusu', roles: { cache: new Collection([[r.id, r]]) }, channels: { fetch: async () => null } },
    roles: { add: async (eklenen) => verilen.push(eklenen.id) },
  });
  await otoRolVer(uye(rol(5, { id: 'normal' })), 'normal');
  await otoRolVer(uye(rol(5, { id: 'yetkili', permissions: izinli(P.BanMembers) })), 'yetkili');
  await otoRolVer(uye(rol(5, { id: 'var' })), 'silinmis-rol');
  assert.deepEqual(verilen, ['normal']);
});

test('kesinYetki: /kitle, /kilidiac ve /sunucukur yetkiyi bot tarafında da ister', () => {
  const { komutYetkisiVar } = yardimci;
  const komutlar = ['kitle', 'kilidiac', 'sunucukur'].map((ad) => src(`commands/${ad}`));
  for (const komut of komutlar) {
    assert.equal(komut.kesinYetki, true, komut.data.name);
    assert.equal(komutYetkisiVar({ memberPermissions: izinli(P.ManageGuild, P.ManageChannels) }, komut), false);
    assert.equal(komutYetkisiVar({ memberPermissions: izinli(P.Administrator) }, komut), true);
    assert.equal(komutYetkisiVar({ memberPermissions: null }, komut), false);
  }
  // Yetki bildirmeyen komut herkese açıktır
  assert.equal(komutYetkisiVar({ memberPermissions: izinli() }, src('commands/ping')), true);
});

test('etiketlenecek rolü seçen o rolü etiketleyebiliyor olmalı', () => {
  const { etiketEngeli } = yardimci;
  const r = (mentionable) => ({ mentionable, toString: () => '<@&r>' });
  assert.ok(etiketEngeli({ memberPermissions: izinli(P.ManageGuild) }, r(false)));
  assert.equal(etiketEngeli({ memberPermissions: izinli(P.ManageGuild) }, r(true)), null);
  assert.equal(etiketEngeli({ memberPermissions: izinli(P.MentionEveryone) }, r(false)), null);
});

// --- Acil durum kilidi ---
test('üst üste binen /kitle ve /kilidiac: yalnızca biri çalışır, yedek ezilmez', async () => {
  const kilit = src('kilit');
  const guild = {
    id: 'kilit-sunucusu',
    ownerId: 'sahip',
    members: { me: { id: 'bot', permissions: izinli() } },
    channels: { cache: new Collection() },
    roles: { everyone: { id: 'kilit-sunucusu' }, cache: new Collection() },
    voiceStates: { cache: new Collection() },
  };
  const yapan = { id: 'u', tag: 'deneme', toString: () => '<@u>' };
  const [ilk, ikinci] = await Promise.all([kilit.kilitle(guild, yapan), kilit.kilitle(guild, yapan)]);
  assert.ok(ilk);
  assert.equal(ikinci, null);
  assert.equal(await kilit.kilitle(guild, yapan), null, 'kilitliyken yeniden kilitlenmez');
  assert.equal(kilit.kilitli(guild.id), true);
  const [ac1, ac2] = await Promise.all([kilit.ac(guild, yapan), kilit.ac(guild, yapan)]);
  assert.ok(ac1);
  assert.equal(ac2, null);
  assert.equal(kilit.kilitli(guild.id), false);
});

// --- Destek talepleri ---
const KATEGORI = 'kat';
const zamanKimligi = (ms) => String(SnowflakeUtil.generate({ timestamp: ms }));
function talepOrtami(sunucuId, odalar) {
  const silinen = [];
  const cache = new Collection([[KATEGORI, { id: KATEGORI, name: 'DESTEK TALEPLERİ', parentId: null }]]);
  odalar.forEach((oda, i) => {
    const kanal = { id: `oda${i}`, parentId: KATEGORI, createdTimestamp: 0, delete: async () => silinen.push(kanal.name), ...oda };
    cache.set(kanal.id, kanal);
  });
  depo.ayarKaydet(sunucuId, 'topluluk', { roller: {}, kanallar: {}, kategoriler: { talepler: KATEGORI } });
  const olusan = [];
  const guild = {
    id: sunucuId,
    roles: { everyone: { id: sunucuId }, cache: new Collection() },
    members: { me: { id: 'bot', permissions: izinli(P.ViewChannel, P.SendMessages) } },
    channels: {
      cache,
      create: async (secenek) => {
        olusan.push(secenek);
        return { send: async () => {}, toString: () => '<#yeni>' };
      },
    },
  };
  return { guild, silinen, olusan };
}
function etkilesim(customId, guild, uyeId, ek = {}) {
  const cagri = [];
  return {
    cagri,
    customId,
    inCachedGuild: () => true,
    guildId: guild.id,
    guild,
    user: { id: uyeId },
    member: { id: uyeId, user: { tag: 'deneme' }, toString: () => `<@${uyeId}>` },
    fields: { getTextInputValue: () => 'Deneme konusu' },
    reply: async (c) => cagri.push(['cevap', c.content]),
    showModal: async () => cagri.push(['form']),
    deferReply: async () => {},
    editReply: async (c) => cagri.push(['sonuc', c]),
    ...ek,
  };
}

test('destek talebi: konuya başkasının kimliğini yazmak onu engellemez', async () => {
  const topluluk = src('topluluk');
  const { guild } = talepOrtami('talep-1', [{ name: 'talep-x-0999', topic: 'sahip=999; konu=sahip=111; deneme' }]);
  const kurban = etkilesim('tp:talep', guild, '111');
  await topluluk.etkilesim(kurban);
  assert.deepEqual(kurban.cagri, [['form']]);

  const { guild: g2 } = talepOrtami('talep-2', [{ name: 'talep-y-0222', topic: 'sahip=222; konu=yardim' }]);
  const sahibi = etkilesim('tp:talep', g2, '222');
  await topluluk.etkilesim(sahibi);
  assert.equal(sahibi.cagri[0][0], 'cevap', 'açık odası olan ikinci odayı açamaz');
});

test('destek talebi: bekleme süresi uygulanır, eski kapalı odalar silinir', async () => {
  const topluluk = src('topluluk');
  const gun = 24 * 60 * 60_000;
  const once = (g) => zamanKimligi(Date.now() - g * gun);
  const { guild, silinen, olusan } = talepOrtami('talep-3', [
    // Bu üyenin dört kapalı odası: en yeni üçü kalır, en eskisi silinir
    { name: 'kapalı-a', topic: 'sahip=333; konu=a', lastMessageId: once(1) },
    { name: 'kapalı-b', topic: 'sahip=333; konu=b', lastMessageId: once(2) },
    { name: 'kapalı-c', topic: 'sahip=333; konu=c', lastMessageId: once(3) },
    { name: 'kapalı-d', topic: 'sahip=333; konu=d', lastMessageId: once(4) },
    // Başkasının odaları: süresi dolan silinir, yenisi kalır; açık oda süresine bakılmadan kalır
    { name: 'kapalı-eski', topic: 'sahip=444; konu=e', lastMessageId: once(31) },
    { name: 'kapalı-yeni', topic: 'sahip=444; konu=f', lastMessageId: once(29) },
    { name: 'talep-acik-0555', topic: 'sahip=555; konu=g', lastMessageId: once(90) },
  ]);
  const ilk = etkilesim('tp:talep-form', guild, '333');
  await topluluk.etkilesim(ilk);
  assert.equal(olusan.length, 1);
  assert.equal(olusan[0].topic, 'sahip=333; konu=Deneme konusu');
  assert.deepEqual(silinen.sort(), ['kapalı-d', 'kapalı-eski']);

  // Hemen ardından ikinci talep: form da gönderim de reddedilir
  const form = etkilesim('tp:talep', guild, '333');
  await topluluk.etkilesim(form);
  assert.match(form.cagri[0][1], /Az önce bir destek talebi açtın/);
  const ikinci = etkilesim('tp:talep-form', guild, '333');
  await topluluk.etkilesim(ikinci);
  assert.equal(olusan.length, 1, 'ikinci oda oluşmamalı');
});

test('destek talebi: sunucu geneli saatlik sınır ve dolmaya yakın kategoride yer açma', async () => {
  const topluluk = src('topluluk');
  const gun = 24 * 60 * 60_000;
  // 11 açık ve 30 kapalı oda: kategori eşiği (40) aşılmış. Kapalıların hepsi yeni ve başkalarına ait.
  const odalar = [];
  for (let i = 0; i < 11; i++) odalar.push({ name: `talep-acik-${i}`, topic: `sahip=9${i}; konu=x` });
  for (let i = 0; i < 30; i++) odalar.push({ name: `kapalı-${String(i).padStart(2, '0')}`, topic: `sahip=8${i}; konu=x`, lastMessageId: zamanKimligi(Date.now() - (i + 1) * gun * 0.5) });
  const { guild, silinen, olusan } = talepOrtami('talep-4', odalar);
  await topluluk.etkilesim(etkilesim('tp:talep-form', guild, '1000'));
  assert.equal(olusan.length, 1);
  // 41 oda vardı; yeni odayla birlikte eşiğin altında kalmak için en eski iki kapalı oda silinir
  assert.deepEqual(silinen.sort(), ['kapalı-28', 'kapalı-29']);

  // Farklı hesaplarla art arda talep: sınıra (15) kadar açılır, sonrası reddedilir
  for (let i = 1; i < 15; i++) await topluluk.etkilesim(etkilesim('tp:talep-form', guild, String(1000 + i)));
  assert.equal(olusan.length, 15);
  const fazla = etkilesim('tp:talep-form', guild, '2000');
  await topluluk.etkilesim(fazla);
  assert.equal(olusan.length, 15, 'saatlik sınırdan sonra oda oluşmamalı');
  assert.match(fazla.cagri[0][1], /çok fazla destek talebi/);
  const form = etkilesim('tp:talep', guild, '2001');
  await topluluk.etkilesim(form);
  assert.equal(form.cagri[0][0], 'cevap', 'form da açılmamalı');
});

// --- Haber: indirme sınırları ve kontrol döngüsü ---
// İndirici yalnızca herkese açık adreslere bağlanır. Sınırlarını denemek için DNS cevabı ve
// bağlantı sahtesiyle değiştirilir: "ornek.test" herkese açık bir adres gibi çözülür, bağlantı
// ise bu makinedeki geçici sunucuya gider. Gerçek ağa istek atılmaz.
async function yerelSunucuyla(isleyici, calistir) {
  const dns = require('node:dns');
  const http = require('node:http');
  const yerel = http.createServer(isleyici);
  await new Promise((coz) => yerel.listen(0, '127.0.0.1', coz));
  const { port } = yerel.address();
  const asil = { lookup: dns.promises.lookup, request: http.request };
  dns.promises.lookup = async (ad) => (net.isIP(ad) ? [{ address: ad, family: net.isIP(ad) }] : [{ address: '93.184.216.34', family: 4 }]);
  http.request = (u, secenek) => asil.request({ host: '127.0.0.1', port, path: u.pathname + u.search, headers: secenek.headers, timeout: secenek.timeout });
  try {
    return await calistir();
  } finally {
    dns.promises.lookup = asil.lookup;
    http.request = asil.request;
    yerel.closeAllConnections();
    yerel.close();
  }
}

test('haber indirici: normal cevap, yönlendirme, boyut ve yarıda kesilen bağlantı', { timeout: 30_000 }, async () => {
  const zlib = require('node:zlib');
  const isleyici = (istek, yanit) => {
    if (istek.url === '/iyi') return yanit.writeHead(200, { 'Content-Type': 'application/rss+xml' }).end('<rss></rss>');
    if (istek.url === '/ic-aga') return yanit.writeHead(302, { Location: 'http://127.0.0.1/gizli' }).end();
    if (istek.url === '/buyuk') return yanit.writeHead(200).end(Buffer.alloc(3_500_000, 'a'));
    // Sıkıştırılmış cevabın başı gönderilir, sonra bağlantı kesilir
    yanit.writeHead(200, { 'Content-Encoding': 'gzip' });
    yanit.write(zlib.gzipSync(Buffer.alloc(200_000, 'a')).subarray(0, 100));
    return setTimeout(() => istek.socket.destroy(), 50);
  };
  await yerelSunucuyla(isleyici, async () => {
    const iyi = await haber.indir('http://ornek.test/iyi');
    assert.equal(iyi.govde.toString(), '<rss></rss>');
    await assert.rejects(haber.indir('http://ornek.test/ic-aga'), /Bu adrese bağlanılamıyor/, 'yönlendirme iç ağa gidemez');
    await assert.rejects(haber.indir('http://ornek.test/buyuk'), /çok büyük/);
    // Eskiden bu istek hiç sonuçlanmıyor, kontrol döngüsünü kilitliyordu
    const basladi = Date.now();
    await assert.rejects(haber.indir('http://ornek.test/kesilen'));
    assert.ok(Date.now() - basladi < 5_000);
  });
});

test('haber indirici: veriyi damla damla gönderen site toplam süre sınırında kesilir', { timeout: 40_000 }, async () => {
  const isleyici = (istek, yanit) => {
    yanit.writeHead(200, { 'Content-Type': 'application/rss+xml' });
    const damla = setInterval(() => yanit.write('x'), 300);
    istek.on('close', () => clearInterval(damla));
  };
  await yerelSunucuyla(isleyici, async () => {
    const basladi = Date.now();
    await assert.rejects(haber.indir('http://ornek.test/yavas'));
    const sure = Date.now() - basladi;
    assert.ok(sure > 18_000 && sure < 25_000, `20 saniyede kesilmeli (${sure} ms)`);
  });
});

test('haber kontrol döngüsü: kaynaklar birkaçı aynı anda okunur, sorunlu kaynak seyrekleşir', async () => {
  const adresler = Array.from({ length: 12 }, (_, i) => `https://kaynak${i}.test/rss`);
  const bozuk = adresler[0];
  depo.yaz('haber', { 'haber-sunucusu': adresler.map((adres) => ({ adres, ad: adres })) });
  let ayniAnda = 0;
  let enCok = 0;
  const okunma = new Map();
  const okuyucu = async (adres) => {
    okunma.set(adres, (okunma.get(adres) ?? 0) + 1);
    enCok = Math.max(enCok, ++ayniAnda);
    await new Promise((coz) => setTimeout(coz, 15));
    ayniAnda--;
    if (adres === bozuk) throw new Error('okunamadı');
    return { besleme: { ad: 'x', haberler: [] } };
  };
  const sessiz = console.error;
  console.error = () => {};
  try {
    for (let i = 0; i < 6; i++) await haber.kontrolEt(okuyucu);
  } finally {
    console.error = sessiz;
  }
  assert.equal(enCok, 4, 'aynı anda en fazla dört kaynak');
  assert.equal(okunma.get(adresler[1]), 6, 'sağlam kaynak her turda okunur');
  // Üç hatadan sonra 4. ve 5. turda atlanır, 6. turda yeniden denenir
  assert.equal(okunma.get(bozuk), 4);
  depo.yaz('haber', {});
});

test('haber havuzu yayın bildirimleriyle aynı oranda: tek sunucu havuzu dolduramaz', () => {
  assert.equal(haber.TOPLAM_SINIR / haber.SUNUCU_BASI_SINIR, 180);
  assert.ok(haber.SAHIP_BASI_SINIR < haber.TOPLAM_SINIR / 10);
});

// --- Tanıtım sayfası: davet linkleri ---
test('ana düğme temel izinlerle, ikinci bağlantı tam izinlerle ekler', async () => {
  const govde = await hamIstek('GET', '/');
  const izinler = [...govde.matchAll(/discord\.com\/oauth2\/authorize\?client_id=0&amp;scope=bot\+applications\.commands&amp;permissions=(\d+)/g)].map((e) => e[1]);
  const temel = new PermissionsBitField(BigInt('1099780156550'));
  assert.equal(izinler.filter((i) => i === '1099780156550').length, 3, 'üç ana düğme');
  assert.equal(izinler.filter((i) => i === '1477757234902').length, 2, 'iki "tam izin" bağlantısı');
  assert.ok(!govde.includes('{{'), 'doldurulmamış yer tutucu kalmamalı');
  // Temel küme kanal yönetimi içermez; moderasyon ve rol yönetimi içerir
  assert.equal(temel.has(P.ManageChannels), false);
  assert.ok(temel.has([P.BanMembers, P.KickMembers, P.ModerateMembers, P.ManageMessages, P.ManageRoles, P.ViewAuditLog]));
});

// --- Sınırlar ve yardımcılar ---
test('ortak kapasite: aynı sahibin sunucuları birlikte sayılır', () => {
  const { sahibinToplami } = yardimci;
  const client = { guilds: { cache: new Collection([['a', { ownerId: 's1' }], ['b', { ownerId: 's1' }], ['c', { ownerId: 's2' }]]) } };
  const hepsi = { a: [1, 2, 3], b: [4, 5], c: [6], ayrilmis: [7, 8] };
  assert.equal(sahibinToplami(client, hepsi, 'a'), 5);
  assert.equal(sahibinToplami(client, hepsi, 'c'), 1);
  assert.equal(sahibinToplami(client, hepsi, 'ayrilmis'), 0, 'botun artık bulunmadığı sunucu');
  assert.equal(sahibinToplami(null, hepsi, 'a'), 0);
});

test('bekleme sayacı', () => {
  const sayac = yardimci.beklemeSayaci(60_000);
  assert.equal(sayac.bekle('x'), 0);
  sayac.isaretle('x');
  assert.ok(sayac.bekle('x') > 59_000);
  assert.equal(sayac.bekle('y'), 0);
});

test('dış kaynaktan gelen metin bağlantı ve biçimlendirme oluşturamaz', () => {
  assert.equal(yardimci.baglantisiz('[tıkla](https://ornek.com)'), '[tıkla]\\(https://ornek.com)');
  const mesaj = yayin.bildirimMesaji('twitch', { ad: '[bedava](https://ornek.com) **x**', url: 'https://www.twitch.tv/a', baslik: 'b' });
  assert.ok(mesaj.content.includes('\\[bedava]'));
  assert.ok(mesaj.content.includes('\\*\\*x\\*\\*'));
  assert.deepEqual(mesaj.allowedMentions, { parse: [] });
});

test('mağaza servislerinden gelen adresler denetlenir', () => {
  const { httpAdresi } = src('firsatlar');
  assert.equal(httpAdresi('https://ornek.com/oyun'), 'https://ornek.com/oyun');
  assert.equal(httpAdresi('https://ornek.com/a_(b)'), 'https://ornek.com/a_%28b%29');
  for (const kotu of ['javascript:alert(1)', 'discord://x', 'ornek.com', '', undefined, null]) assert.equal(httpAdresi(kotu), null, String(kotu));
});

test('kayda yazılan hata metni kullanıcının yazdığı metni içermez', () => {
  const hata = new DiscordAPIError({ message: 'Missing Permissions', code: 50013 }, 50013, 403, 'PUT', 'https://discord.com/api/v10/guilds/1/bans/2', {
    body: { reason: 'KULLANICI-METNI' },
    files: [],
  });
  assert.ok(util.inspect(hata).includes('KULLANICI-METNI'), 'hata nesnesinin tamamı istek gövdesini taşır');
  const metin = yardimci.hataMetni(hata);
  assert.ok(!metin.includes('KULLANICI-METNI'));
  assert.ok(metin.includes('Missing Permissions'));
  assert.equal(yardimci.hataMetni('düz metin'), 'düz metin');
});
