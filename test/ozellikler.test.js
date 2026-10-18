// Uyarı, rol menüsü, çekiliş ve seviye özelliklerinin testleri. Çalıştırmak için: npm test
//
// guvenlik.test.js gibi: bot başlatılmaz, Discord'a bağlanılmaz. Komutlar sahte (elle yazılmış)
// Discord nesneleriyle çalıştırılır. Veri geçici bir klasöre yazılır.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const VERI = fs.mkdtempSync(path.join(os.tmpdir(), 'voyager-ozellik-'));
process.env.VERI_KLASORU = VERI;
after(() => fs.rmSync(VERI, { recursive: true, force: true }));

const { PermissionFlagsBits: P, PermissionsBitField } = require('discord.js');
const src = (dosya) => require(path.join(__dirname, '..', 'src', dosya));
const izinli = (...izinler) => new PermissionsBitField(izinler);

// Komut etkileşimi sahtesi. secenekler: seçenek adı → değer. Gönderilen cevaplar cevaplar[]'a düşer.
function etkilesim({ sunucu = 'g', alt, secenekler = {}, izinler = [], kim = 'mod', uyeler = {}, botIzinleri = [] }) {
  const cevaplar = [];
  const guild = {
    id: sunucu,
    name: 'Deneme',
    ownerId: 'sahip',
    members: {
      me: { permissions: izinli(...botIzinleri) },
      fetch: async (id) => uyeler[id] ?? Promise.reject(new Error('Unknown Member')),
      ban: async (id) => uyeler[id]?.islemler.push('yasakla'),
    },
    channels: { fetch: async () => null },
  };
  return {
    cevaplar,
    id: `etkilesim-${Math.random()}`,
    guildId: sunucu,
    guild,
    client: { user: { id: 'bot' } },
    user: { id: kim, tag: `${kim}#0` },
    member: { roles: { highest: { comparePositionTo: () => 1 } } },
    memberPermissions: izinli(...izinler),
    options: {
      getSubcommand: () => alt,
      getUser: (ad) => secenekler[ad] ?? null,
      getString: (ad) => secenekler[ad] ?? null,
      getInteger: (ad) => secenekler[ad] ?? null,
      getRole: (ad) => secenekler[ad] ?? null,
      getChannel: (ad) => secenekler[ad] ?? null,
    },
    reply: async (m) => cevaplar.push(typeof m === 'string' ? { content: m } : m),
    deferReply: async () => {},
    editReply: async (m) => cevaplar.push(typeof m === 'string' ? { content: m } : m),
  };
}

function sahteUye(id) {
  const islemler = [];
  const kullanici = { id, tag: `${id}#0`, bot: false, send: async () => {}, toString: () => `<@${id}>` };
  return {
    kullanici,
    uye: {
      id,
      user: kullanici,
      islemler,
      roles: { highest: {} },
      manageable: true,
      moderatable: true,
      kickable: true,
      bannable: true,
      timeout: async (ms) => islemler.push(`sustur:${ms / 60_000}`),
      kick: async () => islemler.push('at'),
    },
  };
}

// --- Uyarılar ---
const uyari = src('uyari');
const uyariKomutu = src('commands/uyari');

test('uyarı: kural eşiğe tam gelince bir kez uygulanır', async () => {
  const { kullanici, uye } = sahteUye('h1');
  const kural = etkilesim({ sunucu: 'u1', alt: 'kural-ekle', izinler: [P.ManageGuild, P.ModerateMembers], secenekler: { esik: 2, islem: 'sustur', dakika: 30 } });
  await uyariKomutu.execute(kural);
  assert.deepEqual(uyari.kurallar('u1'), [{ esik: 2, islem: 'sustur', dakika: 30 }]);

  for (let i = 0; i < 3; i++) {
    await uyariKomutu.execute(etkilesim({ sunucu: 'u1', alt: 'ver', izinler: [P.ModerateMembers], uyeler: { h1: uye }, secenekler: { kullanici, sebep: `sebep ${i}` } }));
  }
  assert.equal(uyari.uyarilar('u1', 'h1').length, 3);
  assert.deepEqual(uye.islemler, ['sustur:30'], 'yalnızca 2. uyarıda');
});

test('uyarı: kural yetki aşmaya yaramaz', async () => {
  const yalnizSusturma = etkilesim({ sunucu: 'u2', alt: 'kural-ekle', izinler: [P.ManageGuild, P.ModerateMembers], secenekler: { esik: 1, islem: 'yasakla' } });
  await uyariKomutu.execute(yalnizSusturma);
  assert.match(yalnizSusturma.cevaplar[0].content, /^❌/, 'yasaklayamayan yasaklama kuralı ekleyemez');

  const yonetimsiz = etkilesim({ sunucu: 'u2', alt: 'kural-ekle', izinler: [P.ModerateMembers, P.BanMembers], secenekler: { esik: 1, islem: 'yasakla' } });
  await uyariKomutu.execute(yonetimsiz);
  assert.match(yonetimsiz.cevaplar[0].content, /Sunucuyu Yönet/);
  assert.deepEqual(uyari.kurallar('u2'), []);

  await uyariKomutu.execute(etkilesim({ sunucu: 'u2', alt: 'kural-ekle', izinler: [P.ManageGuild, P.BanMembers], secenekler: { esik: 1, islem: 'yasakla' } }));
  assert.equal(uyari.kurallar('u2').length, 1);

  // Yalnızca susturma yetkisi olan moderatörün uyarısı yasaklamaya yol açmaz
  const a = sahteUye('h2');
  const ver = etkilesim({ sunucu: 'u2', alt: 'ver', izinler: [P.ModerateMembers], uyeler: { h2: a.uye }, secenekler: { kullanici: a.kullanici, sebep: 'x' } });
  await uyariKomutu.execute(ver);
  assert.deepEqual(a.uye.islemler, []);
  assert.match(ver.cevaplar.at(-1).content, /uygulanmadı/);

  const b = sahteUye('h3');
  await uyariKomutu.execute(etkilesim({ sunucu: 'u2', alt: 'ver', izinler: [P.ModerateMembers, P.BanMembers], uyeler: { h3: b.uye }, secenekler: { kullanici: b.kullanici, sebep: 'x' } }));
  assert.deepEqual(b.uye.islemler, ['yasakla']);
});

test('uyarı: üst roldeki üyeye ve botlara verilmez; silme numarayla yapılır', async () => {
  const { kullanici, uye } = sahteUye('h4');
  const ustRol = etkilesim({ sunucu: 'u3', alt: 'ver', izinler: [P.ModerateMembers], uyeler: { h4: uye }, secenekler: { kullanici, sebep: 'x' } });
  ustRol.member.roles.highest.comparePositionTo = () => 0;
  await uyariKomutu.execute(ustRol);
  assert.equal(uyari.uyarilar('u3', 'h4').length, 0);

  const bot = sahteUye('h5');
  bot.kullanici.bot = true;
  await uyariKomutu.execute(etkilesim({ sunucu: 'u3', alt: 'ver', izinler: [P.ModerateMembers], uyeler: { h5: bot.uye }, secenekler: { kullanici: bot.kullanici, sebep: 'x' } }));
  assert.equal(uyari.uyarilar('u3', 'h5').length, 0);

  for (const sebep of ['bir', 'iki', 'üç']) uyari.ekle('u3', 'h6', { id: sebep, sebep, yetkiliId: 'mod', zaman: Date.now() });
  assert.equal(uyari.sil('u3', 'h6', 2).sebep, 'iki');
  assert.deepEqual(uyari.uyarilar('u3', 'h6').map((k) => k.sebep), ['bir', 'üç']);
  assert.equal(uyari.sil('u3', 'h6', 9), null);
  assert.equal(uyari.temizle('u3', 'h6'), 2);
  assert.equal(src('depo').oku('uyarilar', {}).u3, undefined, 'boş sunucu kaydı kalmaz');
});

test('uyarı: kişi başı sınır aşılınca eskiler düşer', () => {
  for (let i = 0; i < uyari.KISI_BASI_SINIR + 5; i++) uyari.ekle('u4', 'h7', { id: String(i), sebep: String(i), yetkiliId: 'mod', zaman: i });
  const liste = uyari.uyarilar('u4', 'h7');
  assert.equal(liste.length, uyari.KISI_BASI_SINIR);
  assert.equal(liste[0].sebep, '5');
  assert.ok(uyari.ESIK_SINIRI < uyari.KISI_BASI_SINIR, 'sınırdaki üyede kural yeniden tetiklenmesin');
});
