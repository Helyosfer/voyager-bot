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

// --- Rol menüsü ---
const rolmenu = src('rolmenu');
const rolmenuKomutu = src('commands/rolmenu');

const sahteRol = (id, position, izinler = []) => ({ id, name: `Rol ${id}`, managed: false, position, permissions: izinli(...izinler), toString: () => `<@&${id}>` });

test('rol menüsü: yönetim yetkili, botun üstündeki ve kurucunun veremeyeceği rol eklenemez', async () => {
  const gonderilen = [];
  const kanal = { guild: { members: { me: {} } }, isTextBased: () => true, permissionsFor: () => izinli(P.ViewChannel, P.SendMessages, P.EmbedLinks), send: async (m) => (gonderilen.push(m), { url: 'https://discord.com/x' }) };
  const dene = async (roller, { kim = 'mod', enYuksek = 8 } = {}) => {
    const e = etkilesim({ sunucu: 'r1', kim, izinler: [P.ManageRoles], botIzinleri: [P.ManageRoles], secenekler: { baslik: 'Roller', kanal } });
    e.options.getRole = (ad) => roller[Number(ad.slice(3)) - 1] ?? null;
    e.options.getBoolean = () => null;
    e.guild.members.me.roles = { highest: { position: 10 } };
    e.member.permissions = izinli(P.ManageRoles);
    e.member.roles.highest.position = enYuksek;
    await rolmenuKomutu.execute(e);
    return e.cevaplar[0].content;
  };
  assert.match(await dene([sahteRol('a', 3), sahteRol('yetkili', 2, [P.KickMembers])]), /yönetim yetkisi/);
  assert.match(await dene([sahteRol('ust', 11)]), /benim rolümden yüksek/);
  assert.match(await dene([sahteRol('esit', 8)]), /sen de veremiyorsun/);
  assert.equal(gonderilen.length, 0);

  assert.match(await dene([sahteRol('a', 3), sahteRol('a', 3), sahteRol('b', 4)]), /^✅/);
  const dugmeler = gonderilen[0].components.flatMap((s) => s.toJSON().components.map((d) => d.custom_id));
  assert.deepEqual(dugmeler, ['rm:c:a', 'rm:c:b'], 'aynı rol iki kez eklenmez');
});

function rolTiklamasi({ customId, uyeRolleri = [], sunucuRolleri, kim = `k-${Math.random()}` }) {
  const roller = new Set(uyeRolleri);
  const cevaplar = [];
  const dugmeler = [...sunucuRolleri.keys()].map((id) => ({ customId: `${customId.slice(0, 5)}${id}` }));
  return {
    roller,
    cevaplar,
    customId,
    guildId: 'r2',
    user: { id: kim },
    isButton: () => true,
    message: { components: [{ components: dugmeler }] },
    guild: { roles: { cache: sunucuRolleri }, members: { me: { roles: { highest: { position: 10 } } } } },
    member: {
      roles: {
        cache: { has: (id) => roller.has(id) },
        add: async (r) => roller.add(r.id),
        remove: async (r) => [r].flat().forEach((x) => roller.delete(x.id ?? x)),
      },
    },
    reply: async (m) => cevaplar.push(m.content),
  };
}

test('rol menüsü: düğme rolü verir ve bırakır; tek seçimde diğeri bırakılır; sonradan yetki alan rol verilmez', async () => {
  const sunucuRolleri = new Map([['a', sahteRol('a', 3)], ['b', sahteRol('b', 4)], ['y', sahteRol('y', 5)]]);
  const al = rolTiklamasi({ customId: 'rm:c:a', sunucuRolleri, uyeRolleri: ['b'] });
  await rolmenu.etkilesim(al);
  assert.deepEqual([...al.roller].sort(), ['a', 'b'], 'çoklu seçimde diğeri kalır');

  const birak = rolTiklamasi({ customId: 'rm:c:a', sunucuRolleri, uyeRolleri: ['a'] });
  await rolmenu.etkilesim(birak);
  assert.deepEqual([...birak.roller], []);

  const tek = rolTiklamasi({ customId: 'rm:t:a', sunucuRolleri, uyeRolleri: ['b', 'baska'] });
  await rolmenu.etkilesim(tek);
  assert.deepEqual([...tek.roller].sort(), ['a', 'baska'], 'menü dışındaki rol bırakılmaz');

  sunucuRolleri.get('y').permissions = izinli(P.BanMembers);
  const yetkili = rolTiklamasi({ customId: 'rm:c:y', sunucuRolleri });
  await rolmenu.etkilesim(yetkili);
  assert.deepEqual([...yetkili.roller], []);
  assert.match(yetkili.cevaplar[0], /^❌/);
});

test('rol menüsü: art arda basmak beklemeye takılır', async () => {
  const sunucuRolleri = new Map([['a', sahteRol('a', 3)]]);
  const ilk = rolTiklamasi({ customId: 'rm:c:a', sunucuRolleri, kim: 'hizli' });
  await rolmenu.etkilesim(ilk);
  const ikinci = rolTiklamasi({ customId: 'rm:c:a', sunucuRolleri, kim: 'hizli', uyeRolleri: ['a'] });
  await rolmenu.etkilesim(ikinci);
  assert.deepEqual([...ikinci.roller], ['a'], 'ikinci basış işlenmez');
  assert.match(ikinci.cevaplar[0], /yavaş/);
});

// --- Çekiliş ---
const cekilis = src('cekilis');
const cekilisKomutu = src('commands/cekilis');

function cekilisOrtami(sunucuId, uyeler) {
  const gonderilen = [];
  const duzenlenen = [];
  const kanal = { isTextBased: () => true, messages: { fetch: async () => ({ edit: async (m) => duzenlenen.push(m) }) }, send: async (m) => gonderilen.push(m) };
  const guild = { members: { fetch: async (id) => (uyeler.includes(id) ? { id } : Promise.reject(new Error('Unknown Member'))) } };
  const client = { guilds: { cache: new Map([[sunucuId, guild]]) }, channels: { fetch: async () => kanal } };
  return { client, gonderilen, duzenlenen };
}

const yeniCekilis = (id, sunucuId, ek = {}) => ({
  id, sunucuId, kanalId: 'k', odul: 'Nitro', kazananSayisi: 1, bitis: Date.now() + 3_600_000, baslatanId: 'mod', gerekenRol: null, katilanlar: [], bitti: false, kazananlar: [], ...ek,
});

function katilmaTiklamasi(mesajId, kim, roller = []) {
  const cevaplar = [];
  return {
    cevaplar,
    customId: 'ck:katil',
    guildId: 'c1',
    user: { id: kim },
    isButton: () => true,
    message: { id: mesajId },
    member: { roles: { cache: { has: (id) => roller.includes(id) } } },
    reply: async (m) => cevaplar.push(m.content),
  };
}

test('çekiliş: düğmeyle katılınır ve çekilinir; rol şartı uygulanır', async () => {
  const { client } = cekilisOrtami('c1', []);
  cekilis.ekle(client, yeniCekilis('100000000000000001', 'c1', { gerekenRol: 'vip' }));
  await cekilis.etkilesim(katilmaTiklamasi('100000000000000001', 'a', ['vip']));
  await cekilis.etkilesim(katilmaTiklamasi('100000000000000001', 'b'));
  assert.deepEqual(cekilis.bul('100000000000000001').katilanlar, ['a'], 'rolü olmayan katılamaz');

  // Aynı kişi beklemeye takılmasın diye farklı sunucu anahtarıyla tekrar basar
  const cik = katilmaTiklamasi('100000000000000001', 'a', ['vip']);
  cik.guildId = 'c1-ikinci';
  await cekilis.etkilesim(cik);
  assert.deepEqual(cekilis.bul('100000000000000001').katilanlar, []);
  await cekilis.iptal(client, '100000000000000001');
  assert.equal(cekilis.bul('100000000000000001'), null);
});

test('çekiliş: kazanan yalnızca hâlâ sunucudakilerden seçilir; aynı anda iki bitirme tek sonuç verir', async () => {
  const { client, gonderilen } = cekilisOrtami('c2', ['kalan1', 'kalan2']);
  cekilis.ekle(client, yeniCekilis('100000000000000002', 'c2', { kazananSayisi: 3, katilanlar: ['ayrilan', 'kalan1', 'kalan2'] }));
  const [ilk, ikinci] = await Promise.all([cekilis.bitir(client, '100000000000000002'), cekilis.bitir(client, '100000000000000002')]);
  assert.ok(ilk);
  assert.equal(ikinci, null);
  assert.deepEqual([...ilk.kazananlar].sort(), ['kalan1', 'kalan2']);
  assert.equal(gonderilen.length, 1, 'tek duyuru');
  assert.deepEqual([...gonderilen[0].allowedMentions.users].sort(), ['kalan1', 'kalan2'], 'yalnızca kazananlar etiketlenir');
});

test('çekiliş: yeniden çekilişte önceki kazananlar seçilmez', async () => {
  const { client } = cekilisOrtami('c3', ['a', 'b']);
  cekilis.ekle(client, yeniCekilis('100000000000000003', 'c3', { katilanlar: ['a', 'b'] }));
  const { kazananlar } = await cekilis.bitir(client, '100000000000000003');
  const yeni = await cekilis.yenidenCek(client, '100000000000000003', 5);
  assert.deepEqual([...kazananlar, ...yeni].sort(), ['a', 'b']);
  assert.deepEqual(await cekilis.yenidenCek(client, '100000000000000003', 1), [], 'aday kalmadı');
});

test('çekiliş: başka sunucunun çekilişi komutla yönetilemez', async () => {
  const { client } = cekilisOrtami('c4', []);
  cekilis.ekle(client, yeniCekilis('100000000000000004', 'c4'));
  const e = etkilesim({ sunucu: 'baska', alt: 'iptal', secenekler: { mesaj: 'https://discord.com/channels/c4/k/100000000000000004' } });
  await cekilisKomutu.execute(e);
  assert.match(e.cevaplar[0].content, /^❌/);
  assert.ok(cekilis.bul('100000000000000004'));

  const sahibi = etkilesim({ sunucu: 'c4', alt: 'iptal', secenekler: { mesaj: 'https://discord.com/channels/c4/k/100000000000000004' } });
  sahibi.client = client;
  await cekilisKomutu.execute(sahibi);
  assert.equal(cekilis.bul('100000000000000004'), null);
});
