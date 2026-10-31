// Tıklayarak yönetim testleri: /ayarlar paneli, sağ tıkla açılan moderasyon kartı, botun sunucuya
// eklenince attığı ilk mesaj ve /yardim'daki ayarlar kısa yolu. Çalıştırmak için: npm test
//
// Bot başlatılmaz, Discord'a bağlanılmaz. Çoğu testte komutların execute'u sahteyle değiştirilir; panelin
// doğru komutu doğru seçeneklerle çalıştırıp çalıştırmadığı denetlenir. Birkaç testte gerçek komut çalışır
// ve ayarın geçici veri klasörüne yazıldığına bakılır.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const VERI = fs.mkdtempSync(path.join(os.tmpdir(), 'voyager-ayarlar-'));
process.env.VERI_KLASORU = VERI;
process.env.GEMINI_API_KEY = 'test-anahtari';
process.env.GEMINI_MODEL = 'test-modeli';
after(() => fs.rmSync(VERI, { recursive: true, force: true }));

const { ApplicationCommandType, ButtonStyle, ChannelType, Collection, ComponentType, PermissionFlagsBits: P, PermissionsBitField } = require('discord.js');
const src = (dosya) => require(path.join(__dirname, '..', 'src', dosya));
const ayarlarPaneli = src('ayarlar-paneli');
const moderasyonKarti = src('moderasyon-karti');
const ilkMesaj = src('ilk-mesaj');
const ISLEMLER = src('yardim-islemler');
const { ayarlariGetir, ayarKaydet } = src('depo');

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
const yetkiler = (...bitler) => new PermissionsBitField(bitler);

// sahte: execute'u kayda geçen ve "<komut> çalıştı" diye cevap veren komutlar
function ortam({ sahte = true, sunucuId = `sunucu-${Math.random()}` } = {}) {
  const cagrilar = [];
  const komutlar = new Collection(
    moduller().map((k, ad) => [
      ad,
      !sahte || ad === 'yardim' || ad === 'ayarlar'
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
  const ben = { id: 'bot', permissions: tumYetkiler(), roles: { highest: { position: 100 } } };
  const guild = {
    id: sunucuId,
    name: 'Deneme',
    ownerId: 'sahip',
    channels: { cache: new Collection(), fetch: async () => null },
    roles: { cache: new Collection(), everyone: { id: sunucuId } },
    members: { me: ben, fetch: async () => null },
  };
  const kullanicilar = new Collection();
  const client = {
    komutlar,
    user: { id: 'bot', username: 'Voyager', displayAvatarURL: () => 'https://cdn.discordapp.com/avatar.png' },
    users: { fetch: async (id) => kullanicilar.get(id) ?? Promise.reject(new Error('yok')) },
    application: { commands: { fetch: async () => new Collection() } },
    ws: { ping: 20 },
    options: { intents: { has: () => true } },
  };
  return { client, guild, cagrilar, kullanicilar };
}

// Düğme, menü ya da form etkileşimi. Kartın son hali kayit.guncel'de, yeni mesajlar kayit.cevaplar'da.
function etkilesim(o, customId, { izinler = tumYetkiler(), values, channels, roles, fields } = {}) {
  const kayit = { guncel: null, cevaplar: [], form: null, takip: [] };
  const i = {
    id: `etkilesim-${Math.random()}`,
    customId,
    values,
    channels,
    roles,
    fields,
    client: o.client,
    guild: o.guild,
    guildId: o.guild.id,
    user: { id: 'yetkili', tag: 'yetkili' },
    member: { id: 'yetkili', roles: { highest: { position: 50 } }, permissions: izinler },
    memberPermissions: izinler,
    replied: false,
    deferred: false,
    kayit,
    update: async (m) => {
      kayit.guncel = m;
      i.replied = true;
    },
    deferUpdate: async () => {
      i.deferred = true;
    },
    editReply: async (m) => {
      kayit.guncel = m;
    },
    reply: async (m) => {
      kayit.cevaplar.push(m);
      i.replied = true;
    },
    followUp: async (m) => kayit.takip.push(m),
    fetchReply: async () => ({ createMessageComponentCollector: () => ({ on: () => {}, ended: false }) }),
    showModal: async (m) => {
      kayit.form = m.toJSON();
    },
    isModalSubmit: () => Boolean(fields),
    isFromMessage: () => true,
  };
  return i;
}

// Gönderilen form: { a0: { type, value | values … } }
const form = (alanlar) => ({ fields: new Collection(Object.entries(alanlar)) });
const yazi = (value) => ({ type: ComponentType.TextInput, value });
const liste = (...values) => ({ type: ComponentType.StringSelect, values });

const satirlar = (m) => m.components.map((r) => r.toJSON().components);
const bilesenler = (m) => satirlar(m).flat();
const dugmeler = (m) => bilesenler(m).filter((b) => b.type === ComponentType.Button);
const bul = (m, customId) => bilesenler(m).find((b) => b.custom_id === customId);

// Discord sınırları: en fazla 5 satır, satırda en fazla 5 düğme, customId en fazla 100 karakter
function sinirlariDenetle(mesaj, ad) {
  const s = satirlar(mesaj);
  assert.ok(s.length <= 5, `${ad}: ${s.length} satır`);
  for (const satir of s) {
    assert.ok(satir.length >= 1 && satir.length <= 5, `${ad}: satırda ${satir.length} bileşen`);
    for (const b of satir) {
      if (b.custom_id) assert.ok(b.custom_id.length <= 100, `${ad}: ${b.custom_id}`);
      if (b.options) assert.ok(b.options.length <= 25, `${ad}: ${b.options.length} seçenek`);
      if (b.label) assert.ok(b.label.length <= 80, `${ad}: ${b.label}`);
    }
  }
  for (const e of mesaj.embeds) e.toJSON?.(); // Geçersiz kart burada hata verir
  if (mesaj.content) assert.ok(mesaj.content.length <= 2000);
}

// --- /ayarlar ---

test('/ayarlar: genel bakış açılır; her bölüm Discord sınırlarına uyar ve işlemleri gerçek komutlardır', async () => {
  const o = ortam();
  const i = etkilesim(o, null);
  await o.client.komutlar.get('ayarlar').execute(i);
  const kart = i.kayit.cevaplar[0];
  assert.equal(kart.flags, 64, 'kart yalnızca açana görünür');
  assert.equal(kart.embeds[0].toJSON().title, '⚙️ Voyager ayarları');
  const menu = bul(kart, 'ay:b');
  const bolumler = menu.options.map((s) => s.value);
  assert.deepEqual(bolumler.slice(0, 4), ['genel', 'koruma', 'gunluk', 'karsilama']);
  assert.ok(!bolumler.includes('instagram'), 'Instagram bağlantısı kurulu değilken bölümü görünmez');
  sinirlariDenetle(kart, 'genel');

  for (const b of ayarlarPaneli.BOLUMLER) {
    for (const is of b.islemler) {
      assert.ok(ISLEMLER[is.deger], `${b.id}: ${is.deger} yardim-islemler.js'te yok`);
      assert.ok(o.client.komutlar.has(is.deger.split(' ')[0]), `${b.id}: ${is.deger}`);
    }
    if (b.gorunur && !b.gorunur()) continue;
    const secim = etkilesim(o, 'ay:b', { values: [b.id] });
    await ayarlarPaneli.etkilesim(secim);
    const ekran = secim.kayit.guncel;
    assert.equal(bul(ekran, 'ay:b').options.find((s) => s.default)?.value, b.id, b.id);
    sinirlariDenetle(ekran, b.id);
  }
});

test('/ayarlar: Sunucuyu Yönet yetkisi olmayan açamaz ve düğmeleri kullanamaz', async () => {
  const o = ortam();
  const uye = etkilesim(o, null, { izinler: yetkiler(P.ModerateMembers) });
  await o.client.komutlar.get('ayarlar').execute(uye);
  assert.match(uye.kayit.cevaplar[0].content, /Sunucuyu Yönet/);
  assert.equal(uye.kayit.cevaplar[0].embeds, undefined);

  const dugme = etkilesim(o, 'ay:h:koruma:spam', { izinler: yetkiler(P.ModerateMembers) });
  await ayarlarPaneli.etkilesim(dugme);
  assert.match(dugme.kayit.cevaplar[0].content, /Sunucuyu Yönet/);
  assert.equal(o.cagrilar.length, 0);
});

test('/ayarlar: spam düğmesi gerçek /koruma komutuyla açar, kapatır; kart yerinde güncellenir', async () => {
  const o = ortam({ sahte: false });
  const ac = etkilesim(o, 'ay:h:koruma:spam');
  await ayarlarPaneli.etkilesim(ac);
  assert.equal(ayarlariGetir(o.guild.id).korumaSpam, true);
  assert.match(ac.kayit.guncel.content, /Spam koruması açık/);
  assert.equal(ac.kayit.cevaplar.length, 0, 'yeni mesaj açılmaz, kart güncellenir');
  const spam = bul(ac.kayit.guncel, 'ay:h:koruma:spam');
  assert.equal(spam.label, 'Spam: Açık');
  assert.equal(spam.style, ButtonStyle.Success);
  // Kart komutun kendi ayar kartıdır
  assert.equal(ac.kayit.guncel.embeds[0].toJSON().title, '🛡️ Otomatik koruma');

  const kapat = etkilesim(o, 'ay:h:koruma:spam');
  await ayarlarPaneli.etkilesim(kapat);
  assert.equal(ayarlariGetir(o.guild.id).korumaSpam, false);
  assert.equal(bul(kapat.kayit.guncel, 'ay:h:koruma:spam').label, 'Spam: Kapalı');
});

test('/ayarlar: kanal ve rol menüleri ilgili komutu çalıştırır; menü boşaltılınca ayar kalkar', async () => {
  const o = ortam();
  const kanal = { id: 'k1', toString: () => '<#k1>' };
  const secim = etkilesim(o, 'ay:h:karsilama:kanal', { channels: new Collection([['k1', kanal]]) });
  await ayarlarPaneli.etkilesim(secim);
  const { etkilesim: e } = o.cagrilar.at(-1);
  assert.equal(o.cagrilar.at(-1).ad, 'ayarla');
  assert.equal(e.options.getSubcommand(), 'hosgeldin');
  assert.equal(e.options.getChannel('kanal'), kanal);
  assert.equal(secim.kayit.guncel.content, 'ayarla çalıştı');

  const rol = { id: 'r1' };
  await ayarlarPaneli.etkilesim(etkilesim(o, 'ay:h:karsilama:rol', { roles: new Collection([['r1', rol]]) }));
  assert.equal(o.cagrilar.at(-1).etkilesim.options.getRole('oto-rol'), rol);

  // Boşaltma: komut çalışmaz, ayar silinir
  ayarKaydet(o.guild.id, 'hosgeldinKanali', 'k1');
  const sayi = o.cagrilar.length;
  const bos = etkilesim(o, 'ay:h:karsilama:kanal', { channels: new Collection() });
  await ayarlarPaneli.etkilesim(bos);
  assert.equal(ayarlariGetir(o.guild.id).hosgeldinKanali, null);
  assert.equal(o.cagrilar.length, sayi);
  assert.match(bos.kayit.guncel.content, /kapatıldı/);
});

test('/ayarlar: günlük kategorileri menüden seçilir; seçilmeyenler kapanır', async () => {
  const o = ortam();
  const secim = etkilesim(o, 'ay:h:gunluk:kategori', { values: ['moderasyon', 'uyeler'] });
  await ayarlarPaneli.etkilesim(secim);
  assert.deepEqual(ayarlariGetir(o.guild.id).logKategorileri, { moderasyon: true, uyeler: true, mesajlar: false, ses: false, sunucu: false });
  assert.match(secim.kayit.guncel.content, /2\/5 açık[\s\S]*kanal seç/);
  const menu = bul(secim.kayit.guncel, 'ay:h:gunluk:kategori');
  assert.deepEqual(menu.options.filter((s) => s.default).map((s) => s.value), ['moderasyon', 'uyeler']);
});

test('/ayarlar: formlu işlem form açar; gönderilince komut çalışır ve sonuç kartta görünür', async () => {
  const o = ortam();
  const dugme = etkilesim(o, 'ay:i:koruma:koruma kelime');
  await ayarlarPaneli.etkilesim(dugme);
  assert.equal(dugme.kayit.form.custom_id, 'ay:f:koruma:koruma kelime:');
  assert.equal(dugme.kayit.form.components.length, 2);
  assert.equal(o.cagrilar.length, 0);

  const gonderim = etkilesim(o, 'ay:f:koruma:koruma kelime:', { fields: form({ a0: yazi('kelime'), a1: liste('cikar') }) });
  await ayarlarPaneli.etkilesim(gonderim);
  const { etkilesim: e } = o.cagrilar[0];
  assert.equal(e.options.getSubcommand(), 'kelime');
  assert.equal(e.options.getString('kelime'), 'kelime');
  assert.equal(e.options.getString('islem'), 'cikar');
  assert.equal(gonderim.kayit.guncel.content, 'koruma çalıştı');

  // Hatalı değer: komut çalışmaz, kartta ne yanlış olduğu yazar
  const hatali = etkilesim(o, 'ay:f:seviye:seviye odul:', { fields: form({ a0: yazi('900') }) });
  await ayarlarPaneli.etkilesim(hatali);
  assert.match(hatali.kayit.guncel.content, /1 ile 200 arasında/);
  assert.equal(o.cagrilar.length, 1);
});

test('/ayarlar: kilitleme önce onay ister ve yalnızca Yöneticiye görünür', async () => {
  const o = ortam();
  const koruma = etkilesim(o, 'ay:b', { values: ['koruma'] });
  await ayarlarPaneli.etkilesim(koruma);
  assert.ok(bul(koruma.kayit.guncel, 'ay:i:koruma:kilit kapat'));

  const onay = etkilesim(o, 'ay:i:koruma:kilit kapat');
  await ayarlarPaneli.etkilesim(onay);
  assert.match(onay.kayit.guncel.content, /Emin misin/);
  assert.deepEqual(dugmeler(onay.kayit.guncel).slice(-2).map((d) => d.custom_id), ['ay:o:koruma:kilit kapat', 'ay:g:koruma']);
  assert.equal(o.cagrilar.length, 0);

  await ayarlarPaneli.etkilesim(etkilesim(o, 'ay:o:koruma:kilit kapat'));
  assert.equal(o.cagrilar[0].etkilesim.options.getSubcommand(), 'kapat');

  // Sunucuyu Yönet'i olan ama Yönetici olmayan: kilit düğmesi yok, uydurma düğme de çalışmaz
  const izinler = yetkiler(P.ManageGuild);
  const yonetici = etkilesim(o, 'ay:b', { values: ['koruma'], izinler });
  await ayarlarPaneli.etkilesim(yonetici);
  assert.ok(!bul(yonetici.kayit.guncel, 'ay:i:koruma:kilit kapat'));
  await ayarlarPaneli.etkilesim(etkilesim(o, 'ay:o:koruma:kilit kapat', { izinler }));
  assert.equal(o.cagrilar.length, 1);
});

test('/ayarlar: 5ten fazla seçenekli işlemde önce alanlar seçilir; form seçilenlerle açılır', async () => {
  const o = ortam();
  const dugme = etkilesim(o, 'ay:i:oyun:oyun ayar');
  await ayarlarPaneli.etkilesim(dugme);
  assert.match(dugme.kayit.guncel.content, /en fazla 5/);
  assert.ok(bul(dugme.kayit.guncel, 'ay:a:oyun:oyun ayar'));

  // 99 gibi uydurma sıra numarası yok sayılır
  const secim = etkilesim(o, 'ay:a:oyun:oyun ayar', { values: ['0', '6', '99'] });
  await ayarlarPaneli.etkilesim(secim);
  assert.equal(secim.kayit.form.custom_id, 'ay:f:oyun:oyun ayar:0,6');
  assert.equal(secim.kayit.form.components.length, 2);

  const kanal = { id: 'k9' };
  const gonderim = etkilesim(o, 'ay:f:oyun:oyun ayar:0,6', {
    fields: form({ a0: { type: ComponentType.ChannelSelect, values: ['k9'], channels: new Collection([['k9', kanal]]) }, a1: yazi('70') }),
  });
  await ayarlarPaneli.etkilesim(gonderim);
  const { options } = o.cagrilar[0].etkilesim;
  assert.equal(options.getChannel('kanal'), kanal);
  assert.equal(options.getInteger('en-az-yuzde'), 70);
});

test('/ayarlar: kendi onay adımı olan kurulum komutu ayrı mesajda çalışır', async () => {
  const o = ortam();
  const dugme = etkilesim(o, 'ay:i:kurulum:sunucusil');
  await ayarlarPaneli.etkilesim(dugme);
  assert.equal(o.cagrilar[0].ad, 'sunucusil');
  assert.equal(dugme.kayit.guncel, null, 'kart değişmez');
  assert.equal(dugme.kayit.cevaplar[0].content, 'sunucusil çalıştı');
});

// --- Moderasyon kartı ---

const ali = (id = '123456789012345678') => ({
  id,
  username: 'ali',
  tag: 'ali',
  bot: false,
  createdTimestamp: Date.now() - 400 * 86_400_000,
  displayAvatarURL: () => 'https://cdn.discordapp.com/a.png',
  toString: () => `<@${id}>`,
});

test('moderasyon: sağ tık menüsünde üye ve mesaj için birer komut; yalnızca sunucularda', () => {
  const json = moderasyonKarti.KOMUTLAR.map((k) => k.toJSON());
  assert.deepEqual(json.map((k) => [k.name, k.type]), [['Moderasyon', ApplicationCommandType.User], ['Moderasyon', ApplicationCommandType.Message]]);
  for (const k of json) assert.deepEqual(k.contexts, [0]);
  // Komut yükleyici bunları da Discord'a yükler
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'src', 'komutlari-yukle.js'), 'utf8'), /moderasyon-karti'\)\.KOMUTLAR/);
});

test('moderasyon kartı: düğmeler yetkiye ve üyenin durumuna göre', () => {
  const o = ortam();
  const kisi = ali();
  const uye = { joinedTimestamp: Date.now() - 86_400_000, communicationDisabledUntilTimestamp: null };
  const hepsi = moderasyonKarti.kart(etkilesim(o, null), kisi, uye);
  assert.deepEqual(dugmeler(hepsi).map((d) => d.custom_id), [
    `md:i:uyari ver:${kisi.id}`,
    `md:i:sustur:${kisi.id}`,
    `md:i:kick:${kisi.id}`,
    `md:i:ban:${kisi.id}`,
  ]);
  sinirlariDenetle(hepsi, 'kart');

  // Yalnızca susturma yetkisi: atma ve yasaklama düğmesi yok
  const mod = moderasyonKarti.kart(etkilesim(o, null, { izinler: yetkiler(P.ModerateMembers) }), kisi, uye);
  assert.deepEqual(dugmeler(mod).map((d) => d.label), ['Uyar', 'Sustur']);

  // Susturulmuş üye: "Susturmayı kaldır"; uyarısı olan üye: uyarıları görme ve silme
  src('uyari').ekle(o.guild.id, kisi.id, { id: 'u1', sebep: 'spam', yetkiliId: 'yetkili', zaman: Date.now() });
  const susturulmus = moderasyonKarti.kart(etkilesim(o, null), kisi, { ...uye, communicationDisabledUntilTimestamp: Date.now() + 60_000 });
  const adlar = dugmeler(susturulmus).map((d) => d.custom_id);
  assert.ok(adlar.includes(`md:k:${kisi.id}`) && !adlar.includes(`md:i:sustur:${kisi.id}`));
  assert.ok(adlar.includes(`md:i:uyari liste:${kisi.id}`) && adlar.includes(`md:i:uyari sil:${kisi.id}`));
  assert.equal(susturulmus.embeds[0].toJSON().fields.find((f) => f.name === 'Uyarılar').value, '1');

  // Sunucuda olmayan: yalnızca yasaklama (ve uyarı kayıtları)
  const yok = moderasyonKarti.kart(etkilesim(o, null), kisi, null);
  assert.deepEqual(dugmeler(yok).map((d) => d.label), ['Yasakla', 'Uyarıları', 'Uyarı sil']);
});

test('moderasyon kartı: mesajdan açılınca mesaj gösterilir ve silme düğmesi gelir', () => {
  const o = ortam();
  const kisi = ali();
  const mesaj = {
    id: '222222222222222222',
    channelId: '333333333333333333',
    content: 'bedava **nitro** burada',
    url: 'https://discord.com/channels/1/3/2',
    attachments: new Collection(),
    channel: { permissionsFor: () => yetkiler(P.ManageMessages) },
  };
  const kart = moderasyonKarti.kart(etkilesim(o, null), kisi, { joinedTimestamp: Date.now() }, mesaj);
  const alan = kart.embeds[0].toJSON().fields.find((f) => f.name === 'Mesaj');
  assert.match(alan.value, /bedava \\\*\\\*nitro\\\*\\\* burada/, 'mesajdaki biçimlendirme kaçırılır');
  assert.ok(bul(kart, `md:s:${mesaj.channelId}:${mesaj.id}`));
});

test('moderasyon kartı: At düğmesi yalnızca sebebi sorar; gönderilince /kick seçili üyeyle çalışır', async () => {
  const o = ortam();
  const kisi = ali();
  o.kullanicilar.set(kisi.id, kisi);
  const dugme = etkilesim(o, `md:i:kick:${kisi.id}`);
  await moderasyonKarti.etkilesim(dugme);
  assert.equal(dugme.kayit.form.custom_id, `md:f:kick:${kisi.id}`);
  assert.match(dugme.kayit.form.title, /At: ali/);
  assert.equal(dugme.kayit.form.components.length, 1, 'üye sorulmaz, yalnızca sebep');
  assert.equal(dugme.kayit.form.components[0].component.type, ComponentType.TextInput);

  await moderasyonKarti.etkilesim(etkilesim(o, `md:f:kick:${kisi.id}`, { fields: form({ a0: yazi('reklam') }) }));
  const { ad, etkilesim: e } = o.cagrilar[0];
  assert.equal(ad, 'kick');
  assert.equal(e.options.getUser('kullanici', true), kisi);
  assert.equal(e.options.getString('sebep'), 'reklam');
});

test('moderasyon kartı: susturma süresi listeden seçilir; Susturmayı kaldır dakika 0 ile çalışır', async () => {
  const o = ortam();
  const kisi = ali();
  o.kullanicilar.set(kisi.id, kisi);
  const dugme = etkilesim(o, `md:i:sustur:${kisi.id}`);
  await moderasyonKarti.etkilesim(dugme);
  const [sure, sebep] = dugme.kayit.form.components;
  assert.equal(sure.component.type, ComponentType.StringSelect);
  assert.deepEqual(sure.component.options.map((s) => s.value), moderasyonKarti.SURELER.map((s) => String(s.value)));
  assert.equal(sebep.component.type, ComponentType.TextInput);

  await moderasyonKarti.etkilesim(etkilesim(o, `md:f:sustur:${kisi.id}`, { fields: form({ a0: liste('60'), a1: yazi('') }) }));
  assert.equal(o.cagrilar[0].etkilesim.options.getInteger('dakika'), 60);
  assert.equal(o.cagrilar[0].etkilesim.options.getString('sebep'), null);

  await moderasyonKarti.etkilesim(etkilesim(o, `md:k:${kisi.id}`));
  assert.equal(o.cagrilar[1].etkilesim.options.getInteger('dakika'), 0);
  assert.equal(o.cagrilar[1].etkilesim.options.getUser('kullanici', true), kisi);
});

test('moderasyon kartı: yetkisi olmayan düğmeyi kullanamaz; uydurma düğmeler çalışmaz', async () => {
  const o = ortam();
  const kisi = ali();
  o.kullanicilar.set(kisi.id, kisi);
  const izinler = yetkiler(P.ModerateMembers);
  const ban = etkilesim(o, `md:i:ban:${kisi.id}`, { izinler });
  await moderasyonKarti.etkilesim(ban);
  assert.equal(ban.kayit.form, null);
  assert.match(ban.kayit.cevaplar[0].content, /yetkin yok/);
  await moderasyonKarti.etkilesim(etkilesim(o, `md:f:ban:${kisi.id}`, { izinler, fields: form({ a0: yazi('x') }) }));
  for (const uydurma of [`md:i:kilit kapat:${kisi.id}`, 'md:i:ban:abc', `md:x:${kisi.id}`]) await moderasyonKarti.etkilesim(etkilesim(o, uydurma));
  assert.equal(o.cagrilar.length, 0);

  // Moderasyon yetkisi olmayan kartı açamaz
  const acis = etkilesim(o, null, { izinler: yetkiler() });
  acis.targetUser = kisi;
  await moderasyonKarti.ac(acis);
  assert.match(acis.kayit.cevaplar[0].content, /moderasyon yetkin/);
});

// --- İlk mesaj ---

function kanal(ad, { sira = 0, yazabilir = true, herkeseAcik = true } = {}) {
  return {
    id: `kanal-${ad}`,
    name: ad,
    type: ChannelType.GuildText,
    rawPosition: sira,
    parent: null,
    guild: null,
    permissionsFor: (kim) => (kim?.id === 'bot' ? (yazabilir ? tumYetkiler() : yetkiler()) : herkeseAcik ? yetkiler(P.ViewChannel) : yetkiler()),
    gonderilen: [],
    async send(m) {
      this.gonderilen.push(m);
      return m;
    },
  };
}
function sunucu(kanallar, sistem = null) {
  const o = ortam();
  const guild = { ...o.guild, client: o.client, systemChannel: sistem, channels: { cache: new Collection(kanallar.map((k) => [k.id, k])) } };
  for (const k of kanallar) k.guild = guild;
  if (sistem) sistem.guild = guild;
  return guild;
}

test('ilk mesaj: sistem kanalı, yoksa herkese açık "genel" kanalı seçilir; yazılamayan kanal seçilmez', () => {
  const sistem = kanal('karsilama');
  assert.equal(ilkMesaj.kanalSec(sunucu([kanal('genel')], sistem)), sistem);

  const genel = kanal('💬-genel-sohbet', { sira: 3 });
  const gizli = kanal('yonetim', { sira: 0, herkeseAcik: false });
  const kurallar = kanal('kurallar', { sira: 1 });
  assert.equal(ilkMesaj.kanalSec(sunucu([gizli, kurallar, genel], kanal('sistem', { yazabilir: false }))), genel);
  // Adı uymazsa herkese açık ilk kanal; gizli kanala yazılmaz
  assert.equal(ilkMesaj.kanalSec(sunucu([gizli, kanal('duyuru', { sira: 5 }), kurallar])), kurallar);
  assert.equal(ilkMesaj.kanalSec(sunucu([gizli, kanal('genel', { yazabilir: false })])), null);
});

test('ilk mesaj: /yardim ve /ayarlar düğmeleri; site düğmesi yalnızca https adreste', async () => {
  const eski = process.env.YAYIN_ADRESI;
  try {
    const genel = kanal('genel');
    const guild = sunucu([genel]);
    process.env.YAYIN_ADRESI = 'http://ornek.com';
    await ilkMesaj.gonder(guild);
    const [m] = genel.gonderilen;
    assert.deepEqual(dugmeler(m).map((d) => d.custom_id ?? d.url), ['bs:yardim', 'ay:ac']);
    const metin = JSON.stringify(m.embeds[0].toJSON());
    for (const parca of ['/yardim', '/ayarlar', 'Uygulamalar → Moderasyon', '/sunucukur']) assert.ok(metin.includes(parca), parca);
    sinirlariDenetle(m, 'ilk mesaj');

    process.env.YAYIN_ADRESI = 'https://voyager.ornek.com/yol';
    const site = dugmeler(ilkMesaj.mesaj(guild.client)).at(-1);
    assert.equal(site.style, ButtonStyle.Link);
    assert.equal(site.url, 'https://voyager.ornek.com');
  } finally {
    if (eski === undefined) delete process.env.YAYIN_ADRESI;
    else process.env.YAYIN_ADRESI = eski;
  }
});

test('ilk mesaj: Komut paneli düğmesi /yardim panelini basana açar; Ayarlar düğmesi yetki ister', async () => {
  const o = ortam();
  const dugme = etkilesim(o, 'bs:yardim', { izinler: yetkiler() });
  await ilkMesaj.etkilesim(dugme);
  const panel = dugme.kayit.cevaplar[0];
  assert.equal(panel.flags, 64);
  assert.match(panel.embeds[0].toJSON().title, /Yardım/);

  const ayarlar = etkilesim(o, 'ay:ac', { izinler: yetkiler() });
  await ayarlarPaneli.etkilesim(ayarlar);
  assert.match(ayarlar.kayit.cevaplar[0].content, /Sunucuyu Yönet/);
  const yonetici = etkilesim(o, 'ay:ac', { izinler: yetkiler(P.ManageGuild) });
  await ayarlarPaneli.etkilesim(yonetici);
  assert.equal(yonetici.kayit.cevaplar[0].embeds[0].toJSON().title, '⚙️ Voyager ayarları');
});

// --- /yardim kısa yolu ---

test('/yardim: ana sayfada yöneticilere Ayarlar paneli düğmesi; panelin toplayıcısı "ay:" düğmelerini almaz', async () => {
  const o = ortam();
  let filtre = null;
  const ac = (izinler) => {
    const i = etkilesim(o, null, { izinler });
    i.options = { getString: () => null };
    i.fetchReply = async () => ({
      createMessageComponentCollector: (secenek) => {
        filtre = secenek.filter;
        return { on: () => {}, ended: false };
      },
    });
    return i;
  };
  const yonetici = ac(yetkiler(P.ManageGuild, P.ModerateMembers));
  await o.client.komutlar.get('yardim').execute(yonetici);
  const ana = yonetici.kayit.cevaplar[0];
  assert.ok(bul(ana, 'ay:ac'));
  assert.match(ana.embeds[0].toJSON().description, /Uygulamalar → Moderasyon/);
  assert.equal(filtre({ customId: 'ay:ac' }), false);
  assert.equal(filtre({ customId: 'yardim-bolum' }), true);

  const uye = ac(yetkiler());
  await o.client.komutlar.get('yardim').execute(uye);
  assert.equal(bul(uye.kayit.cevaplar[0], 'ay:ac'), undefined);
});
