// Bütün komutların yapısı, moderasyon komutları (/ban, /kick, /sustur, /unban, /temizle) ve
// hatırlatıcıların testleri. Çalıştırmak için: npm test
//
// guvenlik.test.js gibi: bot başlatılmaz, Discord'a bağlanılmaz. Komutlar sahte (elle yazılmış)
// Discord nesneleriyle çalıştırılır. Veri geçici bir klasöre yazılır; hiçbir test ağa çıkmaz.
const { test, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const VERI = fs.mkdtempSync(path.join(os.tmpdir(), 'voyager-komut-'));
process.env.VERI_KLASORU = VERI;
// /sor ve /ozetle de yüklensin
process.env.GEMINI_API_KEY = 'test-anahtari';
process.env.GEMINI_MODEL = 'test-modeli';
after(() => fs.rmSync(VERI, { recursive: true, force: true }));

const { ApplicationCommandOptionType: T, DiscordAPIError, PermissionFlagsBits: P, PermissionsBitField } = require('discord.js');
const src = (dosya) => require(path.join(__dirname, '..', 'src', dosya));
const depo = src('depo');

const KOMUT_KLASORU = path.join(__dirname, '..', 'src', 'commands');
const komutlar = fs
  .readdirSync(KOMUT_KLASORU)
  .filter((d) => d.endsWith('.js'))
  .map((d) => ({ dosya: d, komut: require(path.join(KOMUT_KLASORU, d)) }));

// --- Komutların yapısı ---
// Discord bir komutun adı, açıklaması ve bütün seçeneklerinin ad, açıklama ve seçim metinleri için
// toplam 4000 karakter kabul eder. discord.js bunu denetlemez; aşılırsa bütün komutların yüklenmesi
// (npm run komutlar) hata verir.
function karakterSayisi(veri) {
  return (
    (veri.name?.length ?? 0) +
    (veri.description?.length ?? 0) +
    (veri.choices ?? []).reduce((t, s) => t + s.name.length + String(s.value).length, 0) +
    (veri.options ?? []).reduce((t, o) => t + karakterSayisi(o), 0)
  );
}

test('komutlar: hepsi yüklenir, adlar tekil, Discord sınırlarına sığar, yalnızca sunucuda çalışır', () => {
  assert.ok(komutlar.length >= 20, `${komutlar.length} komut bulundu`);
  const adlar = new Set();
  for (const { dosya, komut } of komutlar) {
    assert.equal(typeof komut.execute, 'function', `${dosya}: execute yok`);
    const veri = komut.data.toJSON();
    assert.equal(`${veri.name}.js`, dosya, 'komut adı dosya adıyla aynı');
    assert.ok(!adlar.has(veri.name), `/${veri.name} iki kez tanımlı`);
    adlar.add(veri.name);
    assert.ok(karakterSayisi(veri) <= 4000, `/${veri.name}: ${karakterSayisi(veri)} karakter`);
    // Komutlar sunucu üyelerine, kanallarına ve rollerine eriştiği için özel mesajda çalışamaz.
    // /ping ve /yardim sunucuya dokunmaz, her yerde çalışabilir.
    if (!['ping', 'yardim'].includes(veri.name)) assert.deepEqual(veri.contexts, [0], `/${veri.name} yalnızca sunucuda kullanılabilmeli`);
  }
  // 100'den fazla genel komut Discord'a yüklenemez
  assert.ok(adlar.size <= 100);
});

test('komutlar: yönetim komutları Discord tarafında yetki ister', () => {
  const gereken = {
    ban: P.BanMembers,
    unban: P.BanMembers,
    kick: P.KickMembers,
    sustur: P.ModerateMembers,
    temizle: P.ManageMessages,
    uyari: P.ModerateMembers,
  };
  const veri = Object.fromEntries(komutlar.map(({ komut }) => [komut.data.name, komut.data.toJSON()]));
  for (const [ad, izin] of Object.entries(gereken)) {
    assert.equal(veri[ad].default_member_permissions, String(izin), `/${ad}`);
  }
  // Herkese açık komutlar bilerek yetkisiz: listede olmayan yeni bir komut yetkisiz eklenirse test bunu söyler
  const herkeseAcik = Object.values(veri).filter((v) => !v.default_member_permissions).map((v) => v.name).sort();
  assert.deepEqual(herkeseAcik, ['hatirlat', 'ozetle', 'ping', 'seviye', 'sor', 'yardim']);
});

test('/yardim: bölümlerdeki her ad gerçek bir komut; sahibe özel olmayan her komut bir bölümde', () => {
  const yardim = komutlar.find(({ komut }) => komut.data.name === 'yardim').komut;
  const { Collection } = require('discord.js');
  const hepsi = new Collection(komutlar.map(({ komut }) => [komut.data.name, komut]));
  const etkilesim = { client: { komutlar: hepsi }, memberPermissions: new PermissionsBitField(PermissionsBitField.All) };
  const bolumler = yardim.bolumleriHazirla(etkilesim);
  const diger = bolumler.find((b) => b.id === 'diger');
  assert.equal(diger, undefined, `bölümü olmayan komutlar: ${diger?.komutlar.map((k) => k.name).join(', ')}`);
  const listelenen = bolumler.flatMap((b) => b.komutlar.map((k) => k.name));
  const beklenen = komutlar.filter(({ komut }) => !komut.sahipKomutu && komut.etkin?.() !== false).map(({ komut }) => komut.data.name);
  assert.deepEqual([...listelenen].sort(), [...beklenen].sort());
  for (const ad of yardim.BOLUMLER.flatMap((b) => b.komutlar)) assert.ok(hepsi.has(ad), `/yardim'daki /${ad} diye bir komut yok`);

  // Yetkisi olmayan üye yönetim komutlarını görmez
  const uye = yardim.bolumleriHazirla({ client: { komutlar: hepsi }, memberPermissions: new PermissionsBitField() });
  assert.deepEqual(uye.map((b) => b.id), ['genel', 'topluluk']);
});

// --- Moderasyon komutları ---
const bilinmeyenUye = () => new DiscordAPIError({ code: 10007, message: 'Unknown Member' }, 10007, 404, 'GET', '/guilds/g/members/x', {});
const sira = (konum) => ({ position: konum, comparePositionTo: (diger) => konum - diger.position });

// Sahte sunucu üyesi. konum: en yüksek rolünün sırası
function sahteUye(id, { konum = 1, yonetilebilir = true, susturulabilir = true } = {}) {
  const islemler = [];
  return {
    id,
    user: { id, tag: `${id}#0`, toString: () => `<@${id}>` },
    roles: { highest: sira(konum) },
    manageable: yonetilebilir,
    moderatable: susturulabilir,
    islemler,
    kick: async (sebep) => islemler.push(['at', sebep]),
    timeout: async (ms, sebep) => islemler.push(['sustur', ms, sebep]),
  };
}

// Komut etkileşimi sahtesi. Gönderilen cevaplar cevaplar[]'a, sunucu işlemleri islemler[]'e,
// günlük kanalına gidenler gunluk[]'e düşer.
function etkilesim({ sunucu = 'g', secenekler = {}, kim = 'mod', konum = 5, uyeler = {}, yasaklilar = [], uyeHatasi = null, silinecek = 0 }) {
  const cevaplar = [];
  const islemler = [];
  const gunluk = [];
  const gunlukKanali = { isTextBased: () => true, send: async (m) => gunluk.push(m) };
  const kanal = {
    id: 'kanal',
    toString: () => '<#kanal>',
    bulkDelete: async (adet, eskileriAtla) => (islemler.push(['temizle', adet, eskileriAtla]), { size: Math.min(adet, silinecek) }),
  };
  const guild = {
    id: sunucu,
    ownerId: 'sahip',
    members: {
      fetch: async (id) => {
        if (uyeHatasi) throw uyeHatasi;
        return uyeler[id] ?? Promise.reject(bilinmeyenUye());
      },
      ban: async (id, secenek) => islemler.push(['yasakla', id, secenek.reason]),
      unban: async (id, sebep) => islemler.push(['yasak-kaldir', id, sebep]),
    },
    bans: { fetch: async (id) => (yasaklilar.includes(id) ? { user: { id } } : Promise.reject(new Error('Unknown Ban'))) },
    channels: { fetch: async (id) => (id === 'gunluk' ? gunlukKanali : null) },
  };
  return {
    cevaplar,
    islemler,
    gunluk,
    guild,
    guildId: sunucu,
    channel: kanal,
    channelId: kanal.id,
    client: { user: { id: 'bot' } },
    user: { id: kim, tag: `${kim}#0`, toString: () => `<@${kim}>` },
    member: { roles: { highest: sira(konum) } },
    options: {
      getUser: (ad) => secenekler[ad] ?? null,
      getString: (ad) => secenekler[ad] ?? null,
      getInteger: (ad) => secenekler[ad] ?? null,
    },
    reply: async (m) => cevaplar.push(typeof m === 'string' ? { content: m } : m),
    deferReply: async () => {},
    editReply: async (m) => cevaplar.push(typeof m === 'string' ? { content: m } : m),
  };
}
const komut = (ad) => komutlar.find(({ komut: k }) => k.data.name === ad).komut;
const kullanici = (id) => ({ id, tag: `${id}#0`, toString: () => `<@${id}>` });
depo.ayarKaydet('g', 'logKanali', 'gunluk');

test('/ban, /kick, /sustur: kendine, bota, sahibe, eşit ya da üst role ve botun üstündekine işlem yapılmaz', async () => {
  const durumlar = [
    ['mod', {}, /Kendine/],
    ['bot', {}, /Bana/],
    ['sahip', {}, /Sunucu sahibine/],
    ['esit', { konum: 5 }, /aynı veya daha yüksek/],
    ['ust', { konum: 9 }, /aynı veya daha yüksek/],
    ['botun-ustu', { konum: 2, yonetilebilir: false }, /Bot rolünü/],
  ];
  for (const ad of ['ban', 'kick', 'sustur']) {
    for (const [hedef, ozellik, beklenen] of durumlar) {
      const uye = sahteUye(hedef, ozellik);
      const e = etkilesim({ secenekler: { kullanici: kullanici(hedef), dakika: 10 }, uyeler: { [hedef]: uye } });
      await komut(ad).execute(e);
      assert.match(e.cevaplar[0].content, beklenen, `/${ad} → ${hedef}`);
      assert.deepEqual([...e.islemler, ...uye.islemler], [], `/${ad} → ${hedef}: işlem yapılmamalı`);
    }
  }
});

test('/ban: üye bilgisi alınamazsa (geçici Discord hatası) rol denetimi atlanıp yasaklanmaz', async () => {
  const e = etkilesim({
    secenekler: { kullanici: kullanici('ust') },
    uyeHatasi: new DiscordAPIError({ code: 0, message: 'Internal Server Error' }, 0, 500, 'GET', '/guilds/g/members/ust', {}),
  });
  await assert.rejects(komut('ban').execute(e)); // index.js kullanıcıya "Komut çalışırken bir hata oluştu" der
  assert.deepEqual(e.islemler, []);
});

test('/ban: sunucuda olmayan kullanıcı kimlikle yasaklanır; sebep yetkiliyle kayda ve günlüğe geçer', async () => {
  const e = etkilesim({ secenekler: { kullanici: kullanici('yabanci'), sebep: 'reklam' } });
  await komut('ban').execute(e);
  assert.deepEqual(e.islemler, [['yasakla', 'yabanci', 'mod#0: reklam']]);
  assert.match(e.cevaplar.at(-1).content, /yabanci#0\*\* yasaklandı\. Sebep: reklam/);
  const alanlar = e.gunluk[0].embeds[0].data.fields;
  assert.deepEqual(alanlar.map((a) => a.name), ['Kullanıcı', 'Yetkili', 'Sebep']);
  assert.deepEqual(e.gunluk[0].allowedMentions, { parse: [] }, 'günlükteki etiketler bildirim göndermez');
});

test('/kick ve /sustur: sunucuda olmayan üyeye işlem yapılmaz; alttaki üyeye yapılır', async () => {
  for (const ad of ['kick', 'sustur']) {
    const yok = etkilesim({ secenekler: { kullanici: kullanici('yok'), dakika: 5 } });
    await komut(ad).execute(yok);
    assert.match(yok.cevaplar[0].content, /sunucuda değil/);
  }
  const uye = sahteUye('alt');
  const at = etkilesim({ secenekler: { kullanici: kullanici('alt') }, uyeler: { alt: uye } });
  await komut('kick').execute(at);
  assert.deepEqual(uye.islemler, [['at', 'mod#0: Sebep belirtilmedi']]);
  assert.match(at.gunluk[0].embeds[0].data.title, /atıldı/);
});

test('/sustur: dakika süreye çevrilir, 0 susturmayı kaldırır; susturulamayan üyeye dokunulmaz', async () => {
  const uye = sahteUye('alt');
  const sustur = etkilesim({ secenekler: { kullanici: kullanici('alt'), dakika: 15, sebep: 'spam' }, uyeler: { alt: uye } });
  await komut('sustur').execute(sustur);
  const kaldir = etkilesim({ secenekler: { kullanici: kullanici('alt'), dakika: 0 }, uyeler: { alt: uye } });
  await komut('sustur').execute(kaldir);
  assert.deepEqual(uye.islemler, [
    ['sustur', 15 * 60_000, 'mod#0: spam'],
    ['sustur', null, 'mod#0: Sebep belirtilmedi'],
  ]);
  assert.match(sustur.cevaplar.at(-1).content, /15 dakika susturuldu/);
  assert.match(kaldir.cevaplar.at(-1).content, /artık susturulmuş değil/);
  assert.equal(kaldir.gunluk[0].embeds[0].data.title, 'Susturma kaldırıldı');

  const yonetici = sahteUye('yonetici', { susturulabilir: false });
  const e = etkilesim({ secenekler: { kullanici: kullanici('yonetici'), dakika: 5 }, uyeler: { yonetici } });
  await komut('sustur').execute(e);
  assert.match(e.cevaplar[0].content, /susturamıyorum/);
  assert.deepEqual(yonetici.islemler, []);
});

test('/unban: yalnızca yasaklı kullanıcının yasağı kaldırılır', async () => {
  const degil = etkilesim({ secenekler: { kullanici: kullanici('temiz') } });
  await komut('unban').execute(degil);
  assert.match(degil.cevaplar[0].content, /yasaklı değil/);
  assert.deepEqual(degil.islemler, []);

  const e = etkilesim({ secenekler: { kullanici: kullanici('eski'), sebep: 'af' }, yasaklilar: ['eski'] });
  await komut('unban').execute(e);
  assert.deepEqual(e.islemler, [['yasak-kaldir', 'eski', 'mod#0: af']]);
});

test('/temizle: 14 günden eski mesajlar atlanır, silinen sayı söylenir, günlükte "toplu silme" ayrıca çıkmaz', async () => {
  const gunlukModulu = src('gunluk');
  const e = etkilesim({ secenekler: { adet: 50 }, silinecek: 12 });
  // temizlemeBildir'in 10 saniyelik zamanlayıcısı testi bekletmesin
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    await komut('temizle').execute(e);
    assert.deepEqual(e.islemler, [['temizle', 50, true]]);
    assert.match(e.cevaplar.at(-1).content, /12 mesaj silindi/);
    // Botun kendi temizliği günlüğe ikinci kez "toplu mesaj silindi" diye düşmez; 10 saniye sonra başkasınınki düşer
    const kanal = { id: 'kanal', guild: e.guild, toString: () => '<#kanal>' };
    await gunlukModulu.olaylar.topluSilindi(new Map(), kanal);
    assert.equal(e.gunluk.length, 1);
    mock.timers.tick(10_000);
    await gunlukModulu.olaylar.topluSilindi(new Map(), kanal);
    assert.equal(e.gunluk.length, 2);
  } finally {
    mock.timers.reset();
  }
  assert.deepEqual(e.gunluk[0].embeds[0].data.fields.map((a) => a.value), ['<@mod>', '<#kanal>', '12 mesaj']);
});

// --- Hatırlatıcılar ---
const hatirlatici = src('hatirlatici');
const bekleyenler = () => depo.oku('hatirlaticilar', []);
const turBekle = () => new Promise((coz) => setImmediate(coz));

// Sahte istemci: kanaldaki üye izinleri ve gönderilen mesajlar
function hatirlaticiIstemcisi({ yazabilir = true, susturulmus = false, gonderimHatasi = null } = {}) {
  const gonderilen = [];
  const kanal = {
    isTextBased: () => true,
    isThread: () => false,
    guild: { members: { fetch: async (id) => ({ id, isCommunicationDisabled: () => susturulmus }) } },
    permissionsFor: () => new PermissionsBitField(yazabilir ? [P.SendMessages] : []),
    send: async (m) => {
      const hata = gonderimHatasi?.();
      if (hata) throw hata;
      gonderilen.push(m);
    },
  };
  return { gonderilen, client: { channels: { fetch: async () => kanal } } };
}

async function hatirlat(istemci, { kisi = 'k', mesaj = 'çay demle', dakika = 5 } = {}) {
  const e = {
    id: `h-${Math.random()}`,
    client: istemci.client,
    user: { id: kisi },
    channelId: 'kanal',
    options: { getInteger: () => dakika, getString: () => mesaj },
    cevaplar: [],
    reply: async (m) => e.cevaplar.push(m),
  };
  await komut('hatirlat').execute(e);
  return e;
}

test('/hatirlat: süre dolunca yalnızca kuran kişi etiketlenir, kayıt silinir; kişi başı sınır uygulanır', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  try {
    const istemci = hatirlaticiIstemcisi();
    const e = await hatirlat(istemci, { kisi: 'ayse', mesaj: '@everyone toplantı' });
    assert.match(e.cevaplar[0].content, /hatırlatacağım: <t:\d+:R>/);
    assert.equal(bekleyenler().length, 1);

    mock.timers.tick(5 * 60_000 - 1);
    await turBekle();
    assert.equal(istemci.gonderilen.length, 0, 'süre dolmadan gönderilmez');
    mock.timers.tick(1);
    for (let i = 0; i < 5; i++) await turBekle();
    assert.equal(istemci.gonderilen.length, 1);
    assert.equal(istemci.gonderilen[0].content, '⏰ <@ayse> hatırlatma: @everyone toplantı');
    assert.deepEqual(istemci.gonderilen[0].allowedMentions, { users: ['ayse'] });
    assert.equal(bekleyenler().length, 0);

    for (let i = 0; i < hatirlatici.KISI_BASI_SINIR; i++) await hatirlat(istemci, { kisi: 'ali' });
    const fazla = await hatirlat(istemci, { kisi: 'ali' });
    assert.match(fazla.cevaplar[0].content, /en fazla 5 hatırlatıcın/);
    assert.equal(bekleyenler().length, hatirlatici.KISI_BASI_SINIR);
    // Başkasının sınırı ayrı sayılır
    assert.match((await hatirlat(istemci, { kisi: 'veli' })).cevaplar[0].content, /hatırlatacağım/);

    mock.timers.tick(5 * 60_000);
    for (let i = 0; i < 10; i++) await turBekle();
    assert.equal(bekleyenler().length, 0);
  } finally {
    mock.timers.reset();
  }
});

test('/hatirlat: kuran kişi artık kanala yazamıyorsa ya da susturulmuşsa mesaj gönderilmez', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  try {
    for (const durum of [{ yazabilir: false }, { susturulmus: true }]) {
      const istemci = hatirlaticiIstemcisi(durum);
      await hatirlat(istemci, { kisi: `k-${Object.keys(durum)[0]}` });
      mock.timers.tick(5 * 60_000);
      for (let i = 0; i < 5; i++) await turBekle();
      assert.equal(istemci.gonderilen.length, 0, JSON.stringify(durum));
    }
    assert.equal(bekleyenler().length, 0, 'gönderilmeyen hatırlatıcı da silinir');
  } finally {
    mock.timers.reset();
  }
});

test('/hatirlat: geçici hata dakikada bir yeniden denenir; Discord reddederse denenmez', async () => {
  const asilHata = console.error;
  const hatalar = [];
  console.error = (...a) => hatalar.push(a.join(' '));
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  try {
    let deneme = 0;
    // İlk iki deneme hata verir, üçüncüsü gider
    const gecici = hatirlaticiIstemcisi({ gonderimHatasi: () => (deneme++ < 2 ? new Error('ECONNRESET') : null) });
    await hatirlat(gecici, { kisi: 'gecici' });
    mock.timers.tick(5 * 60_000);
    for (let i = 0; i < 5; i++) await turBekle();
    assert.equal(gecici.gonderilen.length, 0);
    assert.equal(bekleyenler().length, 1, 'yeniden denenecek kayıt durur');
    for (let tur = 0; tur < 2; tur++) {
      mock.timers.tick(60_000);
      for (let i = 0; i < 5; i++) await turBekle();
    }
    assert.equal(gecici.gonderilen.length, 1);
    assert.equal(bekleyenler().length, 0);

    const reddedilen = hatirlaticiIstemcisi({
      gonderimHatasi: () => new DiscordAPIError({ code: 50013, message: 'Missing Permissions' }, 50013, 403, 'POST', '/channels/kanal/messages', {}),
    });
    await hatirlat(reddedilen, { kisi: 'red' });
    mock.timers.tick(5 * 60_000);
    for (let i = 0; i < 5; i++) await turBekle();
    assert.equal(bekleyenler().length, 0, 'kalıcı hatada yeniden denenmez');
    assert.ok(hatalar.some((h) => h.includes('Hatırlatma gönderilemedi')));
  } finally {
    mock.timers.reset();
    console.error = asilHata;
  }
});

test('hatırlatıcılar bot yeniden başlayınca kaldığı yerden kurulur; süresi geçmiş olan hemen gönderilir', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  try {
    const istemci = hatirlaticiIstemcisi();
    depo.yaz('hatirlaticilar', [
      { id: 'gecmis', kullaniciId: 'a', kanalId: 'kanal', zaman: Date.now() - 60_000, mesaj: 'kaçırılan' },
      { id: 'gelecek', kullaniciId: 'b', kanalId: 'kanal', zaman: Date.now() + 60_000, mesaj: 'sonra' },
    ]);
    hatirlatici.hepsiniYukle(istemci.client);
    mock.timers.tick(1); // setTimeout en az 1 ms bekler
    for (let i = 0; i < 5; i++) await turBekle();
    assert.deepEqual(istemci.gonderilen.map((m) => m.content), ['⏰ <@a> hatırlatma: kaçırılan']);
    mock.timers.tick(60_000);
    for (let i = 0; i < 5; i++) await turBekle();
    assert.equal(istemci.gonderilen.length, 2);
    assert.equal(bekleyenler().length, 0);
  } finally {
    mock.timers.reset();
  }
});
