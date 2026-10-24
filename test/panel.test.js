// /yardim panelinden komut çalıştırma testleri: işlem menüsü, düğmeler, onay, formlar ve yetki.
// Çalıştırmak için: npm test
//
// Bot başlatılmaz, Discord'a bağlanılmaz. Komutların execute'u sahteyle değiştirilir; panelin komuta
// doğru alt komutu ve seçenekleri verip vermediği denetlenir.
const { test, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');

const VERI = fs.mkdtempSync(path.join(os.tmpdir(), 'voyager-panel-'));
process.env.VERI_KLASORU = VERI;
process.env.GEMINI_API_KEY = 'test-anahtari';
process.env.GEMINI_MODEL = 'test-modeli';
after(() => fs.rmSync(VERI, { recursive: true, force: true }));

const { ApplicationCommandOptionType: T, Collection, ComponentType, ButtonStyle, PermissionFlagsBits: P, PermissionsBitField } = require('discord.js');
const src = (dosya) => require(path.join(__dirname, '..', 'src', dosya));
const panel = src('komut-paneli');
const ISLEMLER = src('yardim-islemler');
const yardim = src('commands/yardim');

const KOMUT_KLASORU = path.join(__dirname, '..', 'src', 'commands');
const moduller = () =>
  new Collection(
    fs
      .readdirSync(KOMUT_KLASORU)
      .filter((d) => d.endsWith('.js'))
      .map((d) => require(path.join(KOMUT_KLASORU, d)))
      .map((k) => [k.data.name, k]),
  );
const tumYetkiler = () => new PermissionsBitField(PermissionsBitField.All);

// execute'u sahteyle değiştirilmiş komut listesi; çağrılar kayda geçer
function sahteKomutlar() {
  const cagrilar = [];
  const liste = new Collection(
    moduller().map((k, ad) => [
      ad,
      ad === 'yardim'
        ? k
        : {
            ...k,
            execute: async (etkilesim) => {
              cagrilar.push({ ad, etkilesim });
              await etkilesim.reply({ content: `${ad} çalıştı` });
            },
          },
    ]),
  );
  return { liste, cagrilar };
}

function panelAc({ izinler = tumYetkiler(), guildId = 'sunucu-1' } = {}) {
  const { liste, cagrilar } = sahteKomutlar();
  const cevaplar = [];
  const toplayici = Object.assign(new EventEmitter(), { ended: false });
  const client = {
    komutlar: liste,
    user: { username: 'Voyager', displayAvatarURL: () => 'https://cdn.discordapp.com/avatar.png' },
    application: { commands: { fetch: async () => new Collection() } },
  };
  const etkilesim = {
    cevaplar,
    cagrilar,
    toplayici,
    client,
    guildId,
    memberPermissions: izinler,
    options: { getString: () => null },
    reply: async (m) => cevaplar.push(m),
    editReply: async (m) => cevaplar.push(m),
    fetchReply: async () => ({ createMessageComponentCollector: () => toplayici }),
  };
  return etkilesim;
}

// Menü seçimi ya da düğme basışı. gonderim: form açılırsa gönderilecek form (yoksa form kapatılmış sayılır)
async function bas(e, customId, { values, gonderim = null, izinler } = {}) {
  const sonuc = { guncel: null, form: null, cevaplar: [] };
  const secim = {
    customId,
    values,
    id: `secim-${Math.random()}`,
    user: { id: 'uye-1' },
    guildId: e.guildId,
    client: e.client,
    memberPermissions: izinler ?? e.memberPermissions,
    replied: false,
    deferred: false,
    update: async (m) => (sonuc.guncel = m),
    showModal: async (m) => (sonuc.form = m.toJSON()),
    awaitModalSubmit: async ({ filter }) => {
      if (!gonderim) throw new Error('süre doldu');
      const g = { customId: sonuc.form.custom_id, user: { id: 'uye-1' }, guildId: e.guildId, client: e.client, memberPermissions: secim.memberPermissions, reply: async (m) => sonuc.cevaplar.push(m), ...gonderim };
      assert.ok(filter(g));
      return g;
    },
    reply: async (m) => sonuc.cevaplar.push(m),
  };
  e.toplayici.emit('collect', secim);
  for (let i = 0; i < 5; i++) await new Promise((coz) => setImmediate(coz));
  return sonuc;
}

const satirlar = (m) => m.components.map((r) => r.toJSON().components);
const islemMenusu = (m) => satirlar(m).flat().find((b) => b.custom_id?.startsWith('yardim-islem:'));
const dugmeler = (m) => satirlar(m).flat().filter((b) => b.type === ComponentType.Button);
const sonPanel = (e) => e.cevaplar.at(-1);

// Formdan gelen alanlar: { a0: { value } | { values, users|roles|channels } }
const formAlanlari = (alanlar) => ({ fields: { fields: new Collection(Object.entries(alanlar)) } });

test('panel işlem adları: her biri gerçek bir komuta ait; panelden çalışan her komutun bir adı var', () => {
  const liste = moduller();
  const gercek = new Set();
  for (const k of liste.values()) {
    if (k.sahipKomutu || k.data.name === 'yardim') continue;
    const veri = k.data.toJSON();
    const altlar = (veri.options ?? []).filter((o) => o.type === T.Subcommand).map((o) => `${veri.name} ${o.name}`);
    for (const ad of altlar.length ? altlar : [veri.name]) gercek.add(ad);
  }
  assert.deepEqual(Object.keys(ISLEMLER).sort(), [...gercek].sort());
  const adlar = new Set();
  for (const [anahtar, i] of Object.entries(ISLEMLER)) {
    assert.ok(i.simge && i.ad && i.ad.length <= 80, anahtar);
    assert.ok(!adlar.has(i.ad), `"${i.ad}" iki kez kullanılmış; menüde karışır`);
    adlar.add(i.ad);
  }
});

test('panel formları: her işlemin formu Discord sınırlarına uyar; zorunlu alanlar en fazla 5', async () => {
  const e = panelAc();
  const bolumler = yardim.bolumleriHazirla(e);
  let sayi = 0;
  for (const bolum of bolumler) {
    for (const k of bolum.komutlar) {
      const modul = e.client.komutlar.get(k.name);
      if (!panel.calistirilabilir(e, modul)) continue;
      const altlar = (k.options ?? []).filter((o) => o.type === T.Subcommand).map((o) => o.name);
      for (const alt of altlar.length ? altlar : [null]) {
        const hedef = panel.hedefBul(k, alt);
        const alanlar = panel.alanlariHazirla(hedef.secenekler);
        const zorunlu = alanlar.filter((a) => a.zorunlu);
        assert.ok(zorunlu.length <= panel.FORM_SINIRI, `/${k.name} ${alt ?? ''}`);
        if (!alanlar.length) continue;
        // Formda en çok 5 alan: zorunlular ve sığdığı kadar seçmeli
        const formdakiler = [...zorunlu, ...alanlar.filter((a) => !a.zorunlu)].slice(0, panel.FORM_SINIRI);
        const form = await panel.formKur({ interaction: { ...e, user: { id: 'uye-1' } }, komut: modul, hedef, alanlar: formdakiler, customId: 'yardim-form:1', baslik: '🔨 Deneme' });
        const json = form.toJSON(); // Geçersiz bir alan (uzun etiket, eksik seçenek) burada hata verir
        assert.ok(json.components.length >= 1 && json.components.length <= 5);
        sayi++;
      }
    }
  }
  assert.ok(sayi >= 30, `${sayi} form denendi`);

  // rol1 … rol10 tek bir çoklu rol seçimine dönüşür; /rolmenu formu 5 alana sığar
  const rolmenu = panel.alanlariHazirla(panel.hedefBul(e.client.komutlar.get('rolmenu').data.toJSON(), null).secenekler);
  assert.equal(rolmenu.length, 5);
  assert.equal(rolmenu[1].secenekler.length, 10);
  assert.ok(rolmenu[1].zorunlu);
});

test('panel formu okuma: kullanıcı, rol sırası, seçim, evet/hayır ve sayı sınırları', () => {
  const kullanici = { id: '11', tag: 'ali' };
  const rolA = { id: 'ra' };
  const rolB = { id: 'rb' };
  const secenekler = [
    { type: T.User, name: 'kullanici', description: 'Kişi', required: true },
    { type: T.String, name: 'sebep', description: 'Sebep' },
    { type: T.Integer, name: 'dakika', description: 'Dakika', min_value: 1, max_value: 60 },
    { type: T.Boolean, name: 'gizli', description: 'Gizli mi?' },
    { type: T.Role, name: 'rol1', description: 'Rol' },
    { type: T.Role, name: 'rol2', description: 'Rol' },
  ];
  const alanlar = panel.alanlariHazirla(secenekler);
  assert.equal(alanlar.length, 5);
  for (const [i, bilesen] of ['kullanici', 'yazi', 'yazi', 'liste', 'rol'].entries()) alanlar[i].bilesen = bilesen;

  const { degerler, hatalar } = panel.formuOku(
    formAlanlari({
      a0: { values: ['11'], users: new Collection([['11', kullanici]]) },
      a1: { value: '  spam  ' },
      a2: { value: '30' },
      a3: { values: ['evet'] },
      // Discord'un döndürdüğü koleksiyonun sırası değil, seçim sırası geçerli
      a4: { values: ['rb', 'ra'], roles: new Collection([['ra', rolA], ['rb', rolB]]) },
    }),
    alanlar,
  );
  assert.deepEqual(hatalar, []);
  assert.equal(degerler.get('kullanici'), kullanici);
  assert.equal(degerler.get('sebep'), 'spam');
  assert.equal(degerler.get('dakika'), 30);
  assert.equal(degerler.get('gizli'), true);
  assert.equal(degerler.get('rol1'), rolB);
  assert.equal(degerler.get('rol2'), rolA);

  // Aralık dışı ya da sayı olmayan değer kabul edilmez; boş zorunlu alan hata verir
  for (const yanlis of ['0', '61', '3.5', 'otuz']) {
    const { degerler: d, hatalar: h } = panel.formuOku(formAlanlari({ a0: { values: [] }, a2: { value: yanlis } }), alanlar);
    assert.ok(!d.has('dakika'), yanlis);
    assert.ok(h.some((m) => m.includes('1 ile 60 arasında')), yanlis);
    assert.ok(h.some((m) => m.includes('boş bırakılamaz')));
  }
});

test('panel: komut gibi davranan etkileşim; seçenekler formdan, cevaplar asıl etkileşime', async () => {
  const asil = { deferred: false, reply: async function (m) { this.cevap = m; } };
  const cozucu = panel.secenekCozucu({ grup: null, alt: 'kapat' }, new Map([['adet', 5]]));
  const sahte = panel.komutEtkilesimi(asil, 'kilit', cozucu);
  assert.equal(sahte.options.getSubcommand(), 'kapat');
  assert.equal(sahte.options.getInteger('adet'), 5);
  assert.equal(sahte.options.getString('sebep'), null);
  assert.throws(() => sahte.options.getUser('kullanici', true), /Zorunlu/);
  assert.equal(sahte.commandName, 'kilit');
  assert.equal(sahte.isChatInputCommand(), true);
  await sahte.reply({ content: 'tamam' });
  assert.equal(asil.cevap.content, 'tamam');
  sahte.deferred = true;
  assert.equal(asil.deferred, true);
});

test('/yardim paneli: Güvenlik bölümünde Kilitle ve Kilidi aç; kilitleme onay ister, sonra çalışır', async () => {
  const e = panelAc();
  await yardim.execute(e);
  const bolum = (await bas(e, 'yardim-bolum', { values: ['guvenlik'] })).guncel;
  const isler = islemMenusu(bolum).options.map((o) => o.value);
  assert.ok(isler.includes('kilit kapat') && isler.includes('kilit ac'));
  assert.equal(islemMenusu(bolum).options.find((o) => o.value === 'kilit kapat').label, 'Kilitle');
  assert.ok(islemMenusu(bolum).options.every((o) => !o.default), 'işlem menüsünde seçili değer kalmaz');

  // /kilit sayfasının altında iki düğme
  const sayfa = (await bas(e, 'yardim-komut', { values: ['kilit'] })).guncel;
  const [kilitle, ac] = dugmeler(sayfa);
  assert.equal(kilitle.custom_id, 'yardim-calistir:kilit kapat');
  assert.equal(kilitle.style, ButtonStyle.Danger);
  assert.equal(ac.custom_id, 'yardim-calistir:kilit ac');

  // Kilitle: önce onay; komut çalışmaz
  const onay = (await bas(e, kilitle.custom_id)).guncel;
  assert.match(onay.content, /Emin misin/);
  assert.deepEqual(dugmeler(onay).map((d) => d.custom_id), ['yardim-onay:kilit kapat', 'yardim-vazgec']);
  assert.equal(e.cagrilar.length, 0);
  // Vazgeç: düğmeler geri gelir
  const vazgec = (await bas(e, 'yardim-vazgec')).guncel;
  assert.equal(dugmeler(vazgec)[0].custom_id, 'yardim-calistir:kilit kapat');

  // Onaylanınca /kilit kapat çalışır; panel yeniden çizilir (onay kalkar, işlem menüsü sıfırlanır)
  const onceki = islemMenusu(vazgec).custom_id;
  const calisma = await bas(e, 'yardim-onay:kilit kapat');
  assert.equal(e.cagrilar.length, 1);
  assert.equal(e.cagrilar[0].ad, 'kilit');
  assert.equal(e.cagrilar[0].etkilesim.options.getSubcommand(), 'kapat');
  assert.equal(calisma.cevaplar[0].content, 'kilit çalıştı');
  assert.equal(sonPanel(e).content, null);
  assert.notEqual(islemMenusu(sonPanel(e)).custom_id, onceki);

  // Kilidi aç onaysız, menüden seçilince hemen çalışır
  await bas(e, 'yardim-islem:9', { values: ['kilit ac'] });
  assert.equal(e.cagrilar[1].etkilesim.options.getSubcommand(), 'ac');
});

test('/yardim paneli: seçenekli işlem form açar; gönderilen değerlerle komut çalışır', async () => {
  const e = panelAc();
  await yardim.execute(e);
  await bas(e, 'yardim-bolum', { values: ['moderasyon'] });
  const hedef = { id: '42', tag: 'kotu' };
  const sonuc = await bas(e, 'yardim-islem:1', {
    values: ['ban'],
    gonderim: formAlanlari({ a0: { values: ['42'], users: new Collection([['42', hedef]]) }, a1: { value: 'reklam' } }),
  });
  assert.equal(sonuc.form.title, '🔨 Yasakla');
  const [kisi, sebep] = sonuc.form.components;
  assert.equal(kisi.component.type, ComponentType.UserSelect);
  assert.equal(kisi.component.required, true);
  assert.equal(sebep.component.type, ComponentType.TextInput);
  assert.equal(sebep.component.required, false);
  assert.equal(e.cagrilar.length, 1);
  const { options } = e.cagrilar[0].etkilesim;
  assert.equal(options.getUser('kullanici', true), hedef);
  assert.equal(options.getString('sebep'), 'reklam');
  // Panel /ban sayfasına geçer
  assert.equal(sonPanel(e).embeds[0].toJSON().title, '/ban');

  // Hatalı değer: komut çalışmaz, ne yanlış olduğu söylenir
  const hatali = await bas(e, 'yardim-calistir:temizle', { gonderim: formAlanlari({ a0: { value: '500' } }) });
  assert.match(hatali.cevaplar[0].content, /1 ile 100 arasında/);
  assert.equal(e.cagrilar.length, 1);

  // Form kapatılırsa hiçbir şey olmaz
  await bas(e, 'yardim-calistir:temizle');
  assert.equal(e.cagrilar.length, 1);
});

test('/yardim paneli: 5ten fazla seçeneği olan işlemde önce doldurulacak seçenekler seçilir', async () => {
  const e = panelAc();
  await yardim.execute(e);
  const secim = (await bas(e, 'yardim-calistir:oyun ayar')).guncel;
  assert.match(secim.content, /en fazla 5/);
  const menu = satirlar(secim).flat().find((b) => b.custom_id === 'yardim-alanlar:oyun ayar');
  assert.equal(menu.max_values, 5);
  assert.ok(dugmeler(secim).some((d) => d.custom_id === 'yardim-bos:oyun ayar'), 'zorunlu alanı yoksa seçeneksiz çalıştırılabilir');

  // Seçilen iki alan formda; 99 gibi uydurma sıra numarası yok sayılır
  const indirim = (await bas(e, 'yardim-alanlar:oyun ayar', { values: ['0', '6', '99'] })).form;
  assert.equal(indirim.components.length, 2);
  assert.equal(indirim.components[0].component.type, ComponentType.ChannelSelect);

  await bas(e, 'yardim-bos:oyun ayar');
  assert.equal(e.cagrilar.at(-1).etkilesim.options.getSubcommand(), 'ayar');
  assert.equal(e.cagrilar.at(-1).etkilesim.options.getChannel('kanal'), null);
});

test('/yardim paneli: yetkisi olmayan işlemi göremez ve uydurma düğmeyle de çalıştıramaz', async () => {
  // Hiç yetkisi olmayan üye: yalnızca herkese açık işlemler
  const uye = panelAc({ izinler: new PermissionsBitField() });
  await yardim.execute(uye);
  const genel = (await bas(uye, 'yardim-bolum', { values: ['genel'] })).guncel;
  assert.deepEqual(islemMenusu(genel).options.map((o) => o.value), ['sor', 'ozetle', 'hatirlat']);
  for (const uydurma of ['yardim-calistir:ban', 'yardim-onay:kilit kapat', 'yardim-bos:oyun ayar', 'yardim-calistir:yardim', 'yardim-calistir:sunucular liste']) {
    await bas(uye, uydurma);
  }
  assert.equal(uye.cagrilar.length, 0);

  // Panel açıkken yetkisi alınan yetkili: düğme artık çalışmaz
  const yetkili = panelAc({ izinler: new PermissionsBitField([P.BanMembers]) });
  await yardim.execute(yetkili);
  await bas(yetkili, 'yardim-calistir:ban', { izinler: new PermissionsBitField(), gonderim: formAlanlari({}) });
  assert.equal(yetkili.cagrilar.length, 0);

  // Sunucu dışında (özel mesajda) panel komut çalıştırmaz, yalnızca yardım gösterir
  const dm = panelAc({ guildId: null });
  await yardim.execute(dm);
  assert.equal(islemMenusu((await bas(dm, 'yardim-bolum', { values: ['genel'] })).guncel), undefined);
  await bas(dm, 'yardim-calistir:sor', { gonderim: formAlanlari({ a0: { value: 'merhaba' } }) });
  assert.equal(dm.cagrilar.length, 0);
});
