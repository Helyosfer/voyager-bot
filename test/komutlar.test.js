// Bütün komutların yapısı, sağ tık menüleri, moderasyon kartı ve /mod komutu,
// hatırlatıcılar ve /yardim sayfalarının testleri. Çalıştırmak için: npm test
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
// /sor ve sağ tık özetleme de yüklensin
process.env.GEMINI_API_KEY = 'test-anahtari';
process.env.GEMINI_MODEL = 'test-modeli';
after(() => fs.rmSync(VERI, { recursive: true, force: true }));

const { ApplicationCommandOptionType: T, ApplicationCommandType, Collection, DiscordAPIError, MessageFlags, PermissionFlagsBits: P, PermissionsBitField } = require('discord.js');
const src = (dosya) => require(path.join(__dirname, '..', 'src', dosya));
const depo = src('depo');
const moderasyon = src('moderasyon');
const hatirlatici = src('hatirlatici');
const ozet = src('ozet');

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

test('komutlar: 5 genel slash komutu + 1 sahip komutu + 3 sağ tık menüsü; adlar tekil, Discord sınırlarına sığar', () => {
  const genelSlash = komutlar.filter(({ komut: k }) => !k.sahipKomutu).map(({ komut: k }) => k.data.name).sort();
  assert.deepEqual(genelSlash, ['ayarlar', 'cekilis', 'mod', 'sor', 'yardim']);
  const adlar = new Set();
  for (const { dosya, komut: k } of komutlar) {
    assert.equal(typeof k.execute, 'function', `${dosya}: execute yok`);
    const veri = k.data.toJSON();
    assert.equal(`${veri.name}.js`, dosya, 'komut adı dosya adıyla aynı');
    assert.ok(!adlar.has(veri.name), `/${veri.name} iki kez tanımlı`);
    adlar.add(veri.name);
    assert.ok(karakterSayisi(veri) <= 4000, `/${veri.name}: ${karakterSayisi(veri)} karakter`);
    if (veri.name !== 'yardim') assert.deepEqual(veri.contexts, [0], `/${veri.name} yalnızca sunucuda kullanılabilmeli`);
  }
  // Sağ tık menüleri: Moderasyon (üye), Hatırlat (mesaj), Buradan özetle (mesaj)
  const sagTiklar = [moderasyon.sagTikKomutu, hatirlatici.sagTikKomutu, ozet.sagTikKomutu];
  assert.deepEqual(
    sagTiklar.map((k) => [k.data.name, k.data.type]),
    [
      ['Moderasyon', ApplicationCommandType.User],
      ['Hatırlat', ApplicationCommandType.Message],
      ['Buradan özetle', ApplicationCommandType.Message],
    ],
  );
  for (const k of sagTiklar) {
    const veri = k.data.toJSON();
    assert.deepEqual(veri.contexts, [0], `${veri.name} yalnızca sunucuda kullanılabilmeli`);
  }
});

test('komutlar: yönetim komutları Discord tarafında yetki ister', () => {
  const gereken = {
    mod: P.ModerateMembers,
    cekilis: P.ManageGuild,
    ayarlar: P.ManageGuild,
  };
  const veri = Object.fromEntries(komutlar.map(({ komut: k }) => [k.data.name, k.data.toJSON()]));
  for (const [ad, izin] of Object.entries(gereken)) {
    assert.equal(veri[ad].default_member_permissions, String(izin), `/${ad}`);
  }
  assert.equal(moderasyon.sagTikKomutu.data.toJSON().default_member_permissions, String(P.ModerateMembers));
  // Herkese açık komutlar bilerek yetkisiz: yalnızca /sor ve /yardim
  const herkeseAcik = Object.values(veri).filter((v) => !v.default_member_permissions).map((v) => v.name).sort();
  assert.deepEqual(herkeseAcik, ['sor', 'yardim']);
});

test('/yardim: bölümlerdeki her ad gerçek bir komut; sahibe özel olmayan her komut bir bölümde', () => {
  const yardim = komutlar.find(({ komut: k }) => k.data.name === 'yardim').komut;
  const hepsi = new Collection(komutlar.map(({ komut: k }) => [k.data.name, k]));
  const etkilesim = { client: { komutlar: hepsi }, memberPermissions: new PermissionsBitField(PermissionsBitField.All) };
  const bolumler = yardim.bolumleriHazirla(etkilesim);
  const diger = bolumler.find((b) => b.id === 'diger');
  assert.equal(diger, undefined, `bölümü olmayan komutlar: ${diger?.komutlar.map((k) => k.name).join(', ')}`);
  const listelenen = bolumler.flatMap((b) => b.komutlar.map((k) => k.name));
  const beklenen = komutlar.filter(({ komut: k }) => !k.sahipKomutu && k.etkin?.() !== false).map(({ komut: k }) => k.data.name);
  assert.deepEqual([...listelenen].sort(), [...beklenen].sort());
  for (const ad of yardim.BOLUMLER.flatMap((b) => b.komutlar)) assert.ok(hepsi.has(ad), `/yardim'daki /${ad} diye bir komut yok`);

  // Yetkisi olmayan üye yönetim komutlarını görmez
  const uye = yardim.bolumleriHazirla({ client: { komutlar: hepsi }, memberPermissions: new PermissionsBitField() });
  assert.deepEqual(uye.map((b) => b.id), ['genel']);
});

// --- Moderasyon (sağ tık kartı ve /mod) ---
const bilinmeyenUye = () => new DiscordAPIError({ code: 10007, message: 'Unknown Member' }, 10007, 404, 'GET', '/guilds/g/members/x', {});
const sira = (konum) => ({ position: konum, comparePositionTo: (diger) => konum - diger.position });

// Sahte sunucu üyesi. konum: en yüksek rolünün sırası
function sahteUye(id, { konum = 1, yonetilebilir = true, susturulabilir = true, susturmaSonu = null } = {}) {
  const islemler = [];
  return {
    id,
    user: { id, tag: `${id}#0`, bot: false, send: async () => {}, toString: () => `<@${id}>` },
    roles: { highest: sira(konum) },
    manageable: yonetilebilir,
    moderatable: susturulabilir,
    kickable: yonetilebilir,
    bannable: yonetilebilir,
    communicationDisabledUntilTimestamp: susturmaSonu,
    islemler,
    kick: async (sebep) => islemler.push(['at', sebep]),
    timeout: async (ms, sebep) => islemler.push(['sustur', ms, sebep]),
  };
}

// Komut ya da kart etkileşimi sahtesi. Gönderilen cevaplar cevaplar[]'a, kanal duyuruları duyurular[]'a,
// sunucu işlemleri islemler[]'e, günlük kanalına gidenler gunluk[]'e düşer.
function etkilesim({
  sunucu = 'g',
  alt = null,
  secenekler = {},
  kim = 'mod',
  konum = 5,
  izinler = [P.ModerateMembers, P.KickMembers, P.BanMembers, P.ManageMessages],
  uyeler = {},
  yasaklilar = [],
  uyeHatasi = null,
  silinecek = 0,
} = {}) {
  const cevaplar = [];
  const duyurular = [];
  const islemler = [];
  const gunluk = [];
  const gunlukKanali = { isTextBased: () => true, send: async (m) => gunluk.push(m) };
  const kanal = {
    id: 'kanal',
    toString: () => '<#kanal>',
    send: async (m) => duyurular.push(m),
    bulkDelete: async (adet, eskileriAtla) => (islemler.push(['temizle', adet, eskileriAtla]), { size: Math.min(adet, silinecek) }),
  };
  const guild = {
    id: sunucu,
    name: 'Deneme',
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
    id: `e-${Math.random()}`,
    cevaplar,
    duyurular,
    islemler,
    gunluk,
    guild,
    guildId: sunucu,
    channel: kanal,
    channelId: kanal.id,
    client: { user: { id: 'bot' }, users: { fetch: async (id) => ({ id, tag: `${id}#0`, toString: () => `<@${id}>` }) } },
    user: { id: kim, tag: `${kim}#0`, toString: () => `<@${kim}>` },
    member: { roles: { highest: sira(konum) } },
    memberPermissions: new PermissionsBitField(izinler),
    options: {
      getSubcommand: () => alt,
      getUser: (ad) => secenekler[ad] ?? null,
      getString: (ad) => secenekler[ad] ?? null,
      getInteger: (ad) => secenekler[ad] ?? null,
    },
    reply: async (m) => cevaplar.push(typeof m === 'string' ? { content: m } : m),
    deferReply: async () => {},
    deferUpdate: async () => {},
    editReply: async (m) => cevaplar.push(typeof m === 'string' ? { content: m } : m),
    showModal: async (m) => cevaplar.push({ form: m.toJSON() }),
  };
}

// Moderasyon kartındaki bir düğmeye basar ya da form gönderir
async function modKartta(islem, hedefId, { alanlar = null, values = [], ...ayarlar } = {}) {
  const e = etkilesim(ayarlar);
  Object.assign(e, {
    customId: `md:${islem}:${hedefId}`,
    values,
    isButton: () => !alanlar && !values.length,
    isModalSubmit: () => Boolean(alanlar),
    isFromMessage: () => true,
    fields: alanlar && { getTextInputValue: (id) => alanlar[id] ?? '' },
  });
  await moderasyon.etkilesim(e);
  return e;
}

const komut = (ad) => komutlar.find(({ komut: k }) => k.data.name === ad).komut;
const kullanici = (id) => ({ id, tag: `${id}#0`, toString: () => `<@${id}>` });
depo.ayarKaydet('g', 'logKanali', 'gunluk');

test('moderasyon: sağ tık ve /mod uye kartı açar; kendine, bota, sahibe, eşit/üst role ve botun üstündekine işlem yapılmaz', async () => {
  const uye = sahteUye('alt', { susturmaSonu: Date.now() + 60_000 });
  const sagTik = etkilesim({ uyeler: { alt: uye } });
  sagTik.targetUser = kullanici('alt');
  await moderasyon.sagTikKomutu.execute(sagTik);
  const kart = sagTik.cevaplar[0];
  assert.equal(kart.flags, MessageFlags.Ephemeral);
  assert.match(kart.embeds[0].data.title, /alt#0/);
  const dugmeler = kart.components[0].toJSON().components.map((d) => d.custom_id);
  assert.deepEqual(dugmeler, ['md:uyar:alt', 'md:sustur:alt', 'md:sustur-ac:alt', 'md:at:alt', 'md:yasakla:alt']);

  const durumlar = [
    ['mod', {}, /Kendine/],
    ['bot', {}, /Bana/],
    ['sahip', {}, /Sunucu sahibine/],
    ['esit', { konum: 5 }, /aynı veya daha yüksek/],
    ['ust', { konum: 9 }, /aynı veya daha yüksek/],
    ['botun-ustu', { konum: 2, yonetilebilir: false }, /Bot rolünü/],
  ];
  for (const islem of ['uyar', 'sustur', 'at', 'yasakla']) {
    for (const [hedef, ozellik, beklenen] of durumlar) {
      const hUye = sahteUye(hedef, ozellik);
      const e = await modKartta(islem, hedef, { uyeler: { [hedef]: hUye } });
      assert.match(e.cevaplar[0].content, beklenen, `${islem} → ${hedef}`);
      assert.deepEqual([...e.islemler, ...hUye.islemler], [], `${islem} → ${hedef}: işlem yapılmamalı`);
    }
  }
});

test('/mod yasakla: üye bilgisi alınamazsa (geçici Discord hatası) rol denetimi atlanıp yasaklanmaz', async () => {
  const e = etkilesim({
    alt: 'yasakla',
    secenekler: { kullanici: kullanici('ust') },
    uyeHatasi: new DiscordAPIError({ code: 0, message: 'Internal Server Error' }, 0, 500, 'GET', '/guilds/g/members/ust', {}),
  });
  await assert.rejects(komut('mod').execute(e));
  assert.deepEqual(e.islemler, []);
});

test('/mod yasakla ve karttan yasaklama: sunucuda olmayan kullanıcı kimlikle yasaklanır; sebep yetkiliyle kayda ve günlüğe geçer', async () => {
  const e = etkilesim({ alt: 'yasakla', secenekler: { kullanici: kullanici('yabanci'), sebep: 'reklam' } });
  await komut('mod').execute(e);
  assert.deepEqual(e.islemler, [['yasakla', 'yabanci', 'mod#0: reklam']]);
  assert.match(e.cevaplar.at(-1).content, /yabanci#0\*\* yasaklandı\. Sebep: reklam/);
  const alanlar = e.gunluk[0].embeds[0].data.fields;
  assert.deepEqual(alanlar.map((a) => a.name), ['Kullanıcı', 'Yetkili', 'Sebep']);
  assert.deepEqual(e.gunluk[0].allowedMentions, { parse: [] }, 'günlükteki etiketler bildirim göndermez');

  // Kart üzerinden yasaklama: önce düğme formu açar, form gönderilince yasaklar ve kanala duyurur
  const dugme = await modKartta('yasakla', 'yabanci2');
  assert.equal(dugme.cevaplar[0].form.custom_id, 'md:yasakla-form:yabanci2');
  const form = await modKartta('yasakla-form', 'yabanci2', { alanlar: { sebep: 'dolandırıcılık' } });
  assert.deepEqual(form.islemler, [['yasakla', 'yabanci2', 'mod#0: dolandırıcılık']]);
  assert.match(form.duyurular[0].content, /yasaklandı/);
});

test('moderasyon kartı: sunucuda olmayan üyeye atma ve susturma yapılmaz; alttaki üyeye yapılır', async () => {
  for (const islem of ['at', 'sustur']) {
    const yok = await modKartta(islem, 'yok');
    assert.match(yok.cevaplar[0].content, /sunucuda değil/);
  }
  const uye = sahteUye('alt');
  const at = await modKartta('at-form', 'alt', { uyeler: { alt: uye }, alanlar: { sebep: '' } });
  assert.deepEqual(uye.islemler, [['at', 'mod#0: Sebep belirtilmedi']]);
  assert.match(at.gunluk[0].embeds[0].data.title, /atıldı/);
});

test('moderasyon kartı susturma: dakika süreye çevrilir, sustur-ac kaldırır; susturulamayan üyeye dokunulmaz', async () => {
  const uye = sahteUye('alt');
  const sustur = await modKartta('sustur-form', 'alt', { uyeler: { alt: uye }, alanlar: { dakika: '15', sebep: 'spam' } });
  const kaldir = await modKartta('sustur-ac', 'alt', { uyeler: { alt: uye } });
  assert.deepEqual(uye.islemler, [
    ['sustur', 15 * 60_000, 'mod#0: spam'],
    ['sustur', null, 'mod#0: Sebep belirtilmedi'],
  ]);
  assert.match(sustur.cevaplar.at(-1).content, /15 dakika susturuldu/);
  assert.match(kaldir.cevaplar.at(-1).content, /artık susturulmuş değil/);
  assert.equal(kaldir.gunluk[0].embeds[0].data.title, 'Susturma kaldırıldı');

  const yonetici = sahteUye('yonetici', { susturulabilir: false });
  const e = await modKartta('sustur', 'yonetici', { uyeler: { yonetici } });
  assert.match(e.cevaplar[0].content, /susturamıyorum/);
  assert.deepEqual(yonetici.islemler, []);
});

test('/mod yasak-kaldir: yalnızca yasaklı kullanıcının yasağı kaldırılır', async () => {
  const degil = etkilesim({ alt: 'yasak-kaldir', secenekler: { kullanici: kullanici('temiz') } });
  await komut('mod').execute(degil);
  assert.match(degil.cevaplar[0].content, /yasaklı değil/);
  assert.deepEqual(degil.islemler, []);

  const e = etkilesim({ alt: 'yasak-kaldir', secenekler: { kullanici: kullanici('eski'), sebep: 'af' }, yasaklilar: ['eski'] });
  await komut('mod').execute(e);
  assert.deepEqual(e.islemler, [['yasak-kaldir', 'eski', 'mod#0: af']]);
});

test('/mod temizle: 14 günden eski mesajlar atlanır, silinen sayı söylenir, günlükte "toplu silme" ayrıca çıkmaz', async () => {
  const gunlukModulu = src('gunluk');
  const e = etkilesim({ alt: 'temizle', secenekler: { adet: 50 }, silinecek: 12 });
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    await komut('mod').execute(e);
    assert.deepEqual(e.islemler, [['temizle', 50, true]]);
    assert.match(e.cevaplar.at(-1).content, /12 mesaj silindi/);
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

// --- Hatırlatıcılar (mesaja sağ tık → Hatırlat) ---
const bekleyenler = () => depo.oku('hatirlaticilar', []);
const turBekle = () => new Promise((coz) => setImmediate(coz));

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
    customId: 'ht:form:kanal',
    isModalSubmit: () => true,
    client: istemci.client,
    user: { id: kisi },
    channelId: 'kanal',
    fields: { getTextInputValue: (id) => (id === 'dakika' ? String(dakika) : mesaj) },
    cevaplar: [],
    reply: async (m) => e.cevaplar.push(m),
  };
  await hatirlatici.etkilesim(e);
  return e;
}

test('sağ tık → Hatırlat: mesaj metniyle formu açar; süre dolunca yalnızca kuran kişi etiketlenir, kişi başı sınır uygulanır', async () => {
  // Sağ tık komutu tıklanan mesajın metnini formda hazır doldurur
  let acilanForm;
  await hatirlatici.sagTikKomutu.execute({
    channelId: 'kanal',
    targetMessage: { cleanContent: 'Toplantı notlarını gönder' },
    showModal: async (m) => (acilanForm = m.toJSON()),
  });
  assert.equal(acilanForm.custom_id, 'ht:form:kanal');
  assert.equal(acilanForm.components[1].component.value, 'Toplantı notlarını gönder');

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
    assert.match((await hatirlat(istemci, { kisi: 'veli' })).cevaplar[0].content, /hatırlatacağım/);

    mock.timers.tick(5 * 60_000);
    for (let i = 0; i < 10; i++) await turBekle();
    assert.equal(bekleyenler().length, 0);
  } finally {
    mock.timers.reset();
  }
});

test('hatırlatıcı: kuran kişi artık kanala yazamıyorsa ya da susturulmuşsa mesaj gönderilmez', async () => {
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

test('hatırlatıcı: geçici hata dakikada bir yeniden denenir; Discord reddederse denenmez', async () => {
  const asilHata = console.error;
  const hatalar = [];
  console.error = (...a) => hatalar.push(a.join(' '));
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  try {
    let deneme = 0;
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
    mock.timers.tick(1);
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

// --- /yardim komut sayfaları ve seviye sayfası ---
const { EventEmitter } = require('node:events');
const yardimKomutu = () => komut('yardim');
const REHBER = src('yardim-rehberi');
const butunKomutlar = () => new Collection(komutlar.map(({ komut: k }) => [k.data.name, k]));
const tumYetkiler = () => new PermissionsBitField(PermissionsBitField.All);
const veriAl = (ad) => komut(ad).data.toJSON();

function ornegiAyir(ornek) {
  const eslesme = /^\/(\S+)(?: ([a-z0-9-]+)(?=\s|$))?/.exec(ornek);
  const parcalar = [...ornek.matchAll(/(?:^|\s)([a-z0-9-]+):/g)];
  const secenekler = parcalar.map((p, i) => ({
    ad: p[1],
    deger: ornek.slice(p.index + p[0].length, parcalar[i + 1]?.index ?? ornek.length).trim(),
  }));
  return { komutAdi: eslesme[1], alt: eslesme[2] ?? null, secenekler };
}

test('/yardim rehberi: her komutun anlatımı ve örneği var; örneklerdeki alt komut, seçenek ve değerler gerçek', () => {
  const veri = Object.fromEntries(komutlar.map(({ komut: k }) => [k.data.name, k.data.toJSON()]));
  assert.deepEqual(Object.keys(REHBER).sort(), Object.keys(veri).sort(), 'rehberde her komut bir kez olmalı');
  for (const [ad, rehber] of Object.entries(REHBER)) {
    assert.ok(rehber.anlatim?.length > 40, `/${ad}: anlatım yok ya da çok kısa`);
    assert.ok(rehber.ornekler?.length, `/${ad}: örnek yok`);
    for (const ornek of rehber.ornekler) {
      const { komutAdi, alt, secenekler } = ornegiAyir(ornek);
      assert.equal(komutAdi, ad, `${ornek}: başka komutun örneği`);
      const altlar = (veri[ad].options ?? []).filter((o) => o.type === T.Subcommand);
      let tanim = veri[ad];
      if (altlar.length) {
        tanim = altlar.find((o) => o.name === alt);
        assert.ok(tanim, `${ornek}: "${alt}" diye alt komut yok`);
      }
      const tanimli = tanim.options ?? [];
      for (const { ad: secenekAdi, deger } of secenekler) {
        const s = tanimli.find((o) => o.name === secenekAdi);
        assert.ok(s, `${ornek}: "${secenekAdi}" diye seçenek yok`);
        assert.ok(deger, `${ornek}: ${secenekAdi} boş`);
        if (s.choices) assert.ok(s.choices.some((c) => c.name === deger), `${ornek}: ${secenekAdi} için "${deger}" seçeneklerde yok`);
        if (s.type === T.Boolean) assert.match(deger, /^(True|False)$/, `${ornek}: ${secenekAdi}`);
        if (s.type === T.Integer) {
          const sayi = Number(deger);
          assert.ok(Number.isInteger(sayi) && sayi >= (s.min_value ?? -Infinity) && sayi <= (s.max_value ?? Infinity), `${ornek}: ${secenekAdi}=${deger} aralık dışı`);
        }
      }
      for (const zorunlu of tanimli.filter((o) => o.required)) {
        assert.ok(secenekler.some((s) => s.ad === zorunlu.name), `${ornek}: zorunlu "${zorunlu.name}" eksik`);
      }
    }
  }
});

const gomuluUzunluk = (e) =>
  (e.title?.length ?? 0) +
  (e.description?.length ?? 0) +
  (e.footer?.text.length ?? 0) +
  (e.fields ?? []).reduce((t, f) => t + f.name.length + f.value.length, 0);

test('/yardim komut sayfaları Discord sınırlarına kısaltılmadan sığar; yetki, seçenek ve örnekler yazar', () => {
  const yardim = yardimKomutu();
  const kimlik = new Map(komutlar.map(({ komut: k }) => [k.data.name, '123456789012345678']));
  const sigar = (e, ad) => {
    assert.ok(gomuluUzunluk(e) <= 6000, `/${ad}: ${gomuluUzunluk(e)} karakter`);
    assert.ok(e.fields.length <= 25 && e.description.length <= 4096, `/${ad}`);
    for (const f of e.fields) assert.ok(f.value.length <= 1024 && !f.value.endsWith('…'), `/${ad} · ${f.name} kısaltıldı`);
  };
  for (const { komut: k } of komutlar) {
    const veri = k.data.toJSON();
    sigar(yardim.komutSayfasi(veri, kimlik).toJSON(), veri.name);
    for (const alt of (veri.options ?? []).filter((o) => o.type === T.Subcommand)) {
      sigar(yardim.altKomutSayfasi(veri, alt.name, kimlik).toJSON(), `${veri.name} ${alt.name}`);
    }
  }

  // Komut sayfası alt komutları birer satırla listeler; seçenekler alt komut sayfasında
  const mod = yardim.komutSayfasi(veriAl('mod'), new Map()).toJSON();
  const altlar = mod.fields.find((f) => f.name === '▸ Alt komutlar').value;
  assert.ok(altlar.startsWith('`/mod uye` · '), 'komut yüklü değilse düz yazı');
  assert.equal(altlar.split('\n').length, 4);
  const temizleSayfasi = yardim.altKomutSayfasi(veriAl('mod'), 'temizle', new Map()).toJSON();
  assert.equal(temizleSayfasi.title, '/mod temizle');
  assert.match(temizleSayfasi.fields.find((f) => f.name === '⚙️ Seçenekler').value, /`adet` \*\*\(zorunlu\)\*\*/);
  assert.equal(yardim.komutSayfasi(veriAl('sunucular'), kimlik).toJSON().fields[0].value, '**Yönetici** yetkisi olanlar');
  assert.match(yardim.komutSayfasi(veriAl('ayarlar'), kimlik).toJSON().fields.find((f) => f.name.includes('Seçenekler')).value, /Seçeneği yok/);
});

function yardimEtkilesimi({ izinler = tumYetkiler(), komut: istenen = null, sunucu = 'yardim-g', kim = 'uye' } = {}) {
  const cevaplar = [];
  const toplayici = new EventEmitter();
  return {
    cevaplar,
    toplayici,
    guildId: sunucu,
    guild: { id: sunucu, name: 'Deneme' },
    user: { id: kim, username: kim },
    client: {
      komutlar: butunKomutlar(),
      user: { username: 'Voyager', displayAvatarURL: () => 'https://cdn.discordapp.com/avatar.png' },
      application: { commands: { fetch: async () => new Collection([['1', { name: 'mod', id: '1' }]]) } },
    },
    memberPermissions: izinler,
    options: { getString: () => istenen },
    reply: async (m) => cevaplar.push(m),
    editReply: async (m) => cevaplar.push(m),
    fetchReply: async () => ({ createMessageComponentCollector: () => toplayici }),
  };
}
async function secimYap(e, customId, deger) {
  let guncel;
  e.toplayici.emit('collect', { customId, values: [deger], update: async (m) => (guncel = m) });
  await new Promise((coz) => setImmediate(coz));
  return guncel;
}
const menuler = (m) => m.components.map((r) => r.toJSON().components[0]);
const baslik = (m) => m.embeds[0].toJSON().title;

test('/yardim: bölüm seçince komut menüsü çıkar, komut seçince ayrıntı sayfası açılır; seviye sayfası çalışır', async () => {
  const yardim = yardimKomutu();
  const e = yardimEtkilesimi();
  await yardim.execute(e);
  assert.equal(menuler(e.cevaplar[0]).length, 1, 'ana sayfada yalnızca bölüm menüsü');
  assert.ok(e.cevaplar[0].embeds[0].toJSON().description.includes('/yardim komut:mod'));

  // Seviye ve sıralama sayfası: kapalıyken bilgi verir, açıkken üyenin seviyesini ve ilk 10'u gösterir
  const kapaliSeviye = await secimYap(e, 'yardim-bolum', 'seviye');
  assert.match(kapaliSeviye.embeds[0].toJSON().description, /kapalı/);
  depo.ayarKaydet('yardim-g', 'seviyeAcik', true);
  const acikSeviye = await secimYap(e, 'yardim-bolum', 'seviye');
  assert.match(baslik(acikSeviye), /Seviye ve sıralama/);
  assert.deepEqual(acikSeviye.embeds[0].toJSON().fields.map((f) => f.name), ['Seviyen', 'Sıran', 'Toplam XP', 'Sonraki seviye', '🏆 İlk 10']);

  const bolum = await secimYap(e, 'yardim-bolum', 'moderasyon');
  const [bolumMenusu, komutMenusu] = menuler(bolum);
  assert.equal(bolumMenusu.options.find((o) => o.default).value, 'moderasyon');
  assert.deepEqual(komutMenusu.options.map((o) => o.value), ['mod']);

  const sayfa = await secimYap(e, 'yardim-komut', 'mod');
  assert.equal(baslik(sayfa), '/mod');
  assert.equal(menuler(sayfa)[1].options.find((o) => o.default).value, 'mod');
  assert.equal(sayfa.content, null);

  assert.equal(baslik(await secimYap(e, 'yardim-bolum', 'genel')), '🧭 Genel');
  assert.equal(menuler(await secimYap(e, 'yardim-bolum', 'uydurma')).length, 1);

  const dogrudan = yardimEtkilesimi({ komut: '/Mod' });
  await yardim.execute(dogrudan);
  assert.equal(baslik(dogrudan.cevaplar[0]), '/mod');
  assert.equal(dogrudan.cevaplar[0].content, undefined);
});

test('/yardim: yetkisi olmayan yönetim komutunun sayfasını açamaz; yazdığı ad cevapta biçimlendirme yapamaz', async () => {
  const yardim = yardimKomutu();
  const uye = yardimEtkilesimi({ izinler: new PermissionsBitField(), komut: 'mod' });
  await yardim.execute(uye);
  assert.ok(uye.cevaplar[0].content.includes('`/mod` diye kullanabileceğin bir komut yok'));
  assert.notEqual(baslik(uye.cevaplar[0]), '/mod');
  await secimYap(uye, 'yardim-bolum', 'genel');
  assert.equal(baslik(await secimYap(uye, 'yardim-komut', 'mod')), '🧭 Genel');

  const garip = yardimEtkilesimi({ komut: '`@everyone` **x**' });
  await yardim.execute(garip);
  assert.ok(garip.cevaplar[0].content.startsWith('❌ `/everyone` diye'));
});

test('/yardim komut önerileri: kullanabildiği komutlardan, adı yazılanla başlayanlar önce', async () => {
  const yardim = yardimKomutu();
  const oner = async (yazilan, izinler = tumYetkiler()) => {
    let cevap;
    await yardim.autocomplete({
      client: { komutlar: butunKomutlar() },
      memberPermissions: izinler,
      options: { getFocused: () => yazilan },
      respond: async (c) => (cevap = c),
    });
    return cevap;
  };
  const mo = await oner('mo');
  assert.equal(mo[0].value, 'mod');
  assert.ok(mo.every((s) => s.name.length <= 100));
  assert.ok((await oner('')).length <= 25);
  assert.ok((await oner('/MOD')).some((s) => s.value === 'mod'));
  assert.ok((await oner('çekiliş')).some((s) => s.value === 'cekilis'));
  assert.ok(!(await oner('mo', new PermissionsBitField())).some((s) => s.value === 'mod'));
  assert.deepEqual((await oner('mod t')).map((s) => s.value), ['mod temizle']);
});

const GOREVLER = src('yardim-gorevler');

test('/yardim rehberleri: her {komut alt} gerçek; alt komut notları gerçek alt komutlara ait', () => {
  const veri = Object.fromEntries(komutlar.map(({ komut: k }) => [k.data.name, k.data.toJSON()]));
  const yardim = yardimKomutu();
  const denetle = (metin, nerede) => {
    for (const [, ad, alt] of metin.matchAll(yardim.BAGLANTI)) {
      assert.ok(veri[ad], `${nerede}: /${ad} diye komut yok`);
      const altlar = (veri[ad].options ?? []).filter((o) => o.type === T.Subcommand).map((o) => o.name);
      if (alt) assert.ok(altlar.includes(alt), `${nerede}: /${ad} ${alt} diye alt komut yok`);
      else assert.equal(altlar.length, 0, `${nerede}: /${ad} alt komutsuz yazılmış ama alt komutları var (${altlar.join(', ')})`);
    }
    assert.doesNotMatch(metin.replace(yardim.BAGLANTI, ''), /[{}]/, `${nerede}: kapanmamış {…}`);
  };
  const kimlikler = new Set();
  for (const g of GOREVLER.GOREVLER) {
    assert.ok(!kimlikler.has(g.id), `${g.id} iki kez`);
    kimlikler.add(g.id);
    assert.ok(g.ad.length <= 100 && g.simge && g.adimlar.length, g.id);
    for (const m of [...g.adimlar, ...(g.ipuclari ?? [])]) denetle(m, `rehber ${g.id}`);
  }
  assert.ok(GOREVLER.GOREVLER.length <= 25, 'rehber menüsü en fazla 25 seçenek');
  for (const m of [...GOREVLER.BASLANGIC.yonetici, ...GOREVLER.BASLANGIC.uye]) denetle(m, 'başlangıç');

  for (const [ad, r] of Object.entries(REHBER)) {
    for (const alt of Object.keys(r.altlar ?? {})) {
      assert.ok((veri[ad].options ?? []).some((o) => o.type === T.Subcommand && o.name === alt), `/${ad} ${alt}: rehberde var, komutta yok`);
      assert.ok(r.altlar[alt].anlatim?.length > 20, `/${ad} ${alt}: anlatım`);
    }
  }
});

test('/yardim rehberleri: üye yalnızca kullanabildiği komutları anlatan rehberleri görür; rehber adım adım açılır', async () => {
  const yardim = yardimKomutu();
  const hazirla = (izinler) => yardim.gorevleriHazirla(yardim.bolumleriHazirla({ client: { komutlar: butunKomutlar() }, memberPermissions: izinler }), izinler);
  const uyeRehberleri = hazirla(new PermissionsBitField());
  assert.deepEqual(uyeRehberleri.map((g) => g.id), ['sor', 'hatirlat', 'ozetle', 'seviye']);
  assert.equal(hazirla(tumYetkiler()).length, GOREVLER.GOREVLER.length);
  assert.ok(!hazirla(new PermissionsBitField([P.ModerateMembers])).some((g) => g.id === 'uyari'));

  const e = yardimEtkilesimi();
  await yardim.execute(e);
  const liste = await secimYap(e, 'yardim-bolum', 'gorevler');
  assert.equal(baslik(liste), '📖 Nasıl yapılır?');
  const [, gorevMenusu] = menuler(liste);
  assert.ok(gorevMenusu.options.some((o) => o.value === 'haber'));
  const haber = await secimYap(e, 'yardim-gorev', 'haber');
  const sayfa = haber.embeds[0].toJSON();
  assert.equal(sayfa.title, '📰 Haberleri konusuna göre etiketle');
  assert.match(sayfa.description, /^\*\*1\.\*\* /);
  assert.ok(sayfa.description.includes('`/ayarlar`'), 'komut yüklü değilse düz yazı');
  assert.ok(!sayfa.description.includes('{'), 'yer tutucular çevrilir');
  assert.equal(menuler(haber)[1].options.find((o) => o.default).value, 'haber');
});

test('/yardim başlangıç: yöneticiye kurulum, üyeye kullanım adımları', async () => {
  const yardim = yardimKomutu();
  const yonetici = yardimEtkilesimi();
  await yardim.execute(yonetici);
  const kurulum = (await secimYap(yonetici, 'yardim-bolum', 'baslangic')).embeds[0].toJSON();
  assert.match(kurulum.title, /Sunucuna Voyager'ı kur/);
  assert.ok(kurulum.description.includes('`/ayarlar`'));

  const uye = yardimEtkilesimi({ izinler: new PermissionsBitField() });
  await yardim.execute(uye);
  const baslangic = (await secimYap(uye, 'yardim-bolum', 'baslangic')).embeds[0].toJSON();
  assert.equal(baslangic.title, '🚀 Başlangıç');
  assert.ok(baslangic.description.includes('`/sor`') && !baslangic.description.includes('/ayarlar'));
});

test('/yardim alt komut sayfaları: komut seçince üçüncü menü çıkar; /yardim komut:mod temizle doğrudan açar', async () => {
  const yardim = yardimKomutu();
  const e = yardimEtkilesimi();
  await yardim.execute(e);
  await secimYap(e, 'yardim-bolum', 'moderasyon');
  const mod = await secimYap(e, 'yardim-komut', 'mod');
  assert.equal(menuler(mod).length, 3);
  assert.deepEqual(menuler(mod)[2].options.map((o) => o.value), ['uye', 'temizle', 'yasakla', 'yasak-kaldir']);
  const temizle = await secimYap(e, 'yardim-alt', 'temizle');
  assert.equal(baslik(temizle), '/mod temizle');
  assert.equal(menuler(temizle)[2].options.find((o) => o.default).value, 'temizle');
  await secimYap(e, 'yardim-bolum', 'sunucu');
  assert.equal(menuler(await secimYap(e, 'yardim-komut', 'ayarlar')).length, 2);

  const dogrudan = yardimEtkilesimi({ komut: '/Mod Temizle' });
  await yardim.execute(dogrudan);
  assert.equal(baslik(dogrudan.cevaplar[0]), '/mod temizle');
  const yanlis = yardimEtkilesimi({ komut: 'mod kanal' });
  await yardim.execute(yanlis);
  assert.equal(baslik(yanlis.cevaplar[0]), '/mod');
});
