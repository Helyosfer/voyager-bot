// Sunucu günlüğü (gunluk.js), /ayarla, acil durum kilidi (/kitle, /kilidiac) ve bildirim
// komutlarının (/oyun, /yayin, /haber, /instagram) testleri. Çalıştırmak için: npm test
//
// komutlar.test.js gibi: bot başlatılmaz, Discord'a bağlanılmaz. Komutlar sahte (elle yazılmış)
// Discord nesneleriyle çalıştırılır. Veri geçici bir klasöre yazılır; hiçbir test ağa çıkmaz.
const { test, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const VERI = fs.mkdtempSync(path.join(os.tmpdir(), 'voyager-komut2-'));
process.env.VERI_KLASORU = VERI;
// Yapay zekâ ve bildirim platformlarının bağlantısı bilerek kurulmaz: "kurulu değil" davranışı
// denenir, hiçbir istek dışarı çıkmaz
for (const ad of [
  'GEMINI_API_KEY', 'GEMINI_MODEL', 'TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'KICK_CLIENT_ID', 'KICK_CLIENT_SECRET',
  'YOUTUBE_API_KEY', 'YAYIN_ADRESI', 'META_APP_ID', 'META_APP_SECRET', 'INSTAGRAM_TOKEN',
]) delete process.env[ad];
after(() => fs.rmSync(VERI, { recursive: true, force: true }));

const {
  AuditLogEvent, Collection, Events, GatewayIntentBits, IntentsBitField, MessageFlags, OverwriteType,
  PermissionFlagsBits: P, PermissionsBitField,
} = require('discord.js');
const { EventEmitter } = require('node:events');
const src = (dosya) => require(path.join(__dirname, '..', 'src', dosya));
const depo = src('depo');
const gunluk = src('gunluk');
const komut = (ad) => src(`commands/${ad}`);
const izinli = (...izinler) => new PermissionsBitField(izinler);
const turBekle = () => new Promise((coz) => setImmediate(coz));

// --- Sahte Discord nesneleri ---
const kullanici = (id, ek = {}) => ({ id, tag: `${id}#0`, bot: false, createdTimestamp: 1_600_000_000_000, toString: () => `<@${id}>`, ...ek });
const rol = (id, ek = {}) => ({ id, mentionable: false, toString: () => `<@&${id}>`, ...ek });
// Botun izinleri: yazabilirMi() kanal.permissionsFor(kanal.guild.members.me) ile bakar
function sahteKanal(id, izinler = [P.ViewChannel, P.SendMessages, P.EmbedLinks]) {
  const gonderilen = [];
  return {
    id,
    gonderilen,
    guild: { members: { me: { id: 'bot' } } },
    toString: () => `<#${id}>`,
    isTextBased: () => true,
    permissionsFor: () => izinli(...izinler),
    send: async (m) => gonderilen.push(m),
  };
}

// Alt komutlu komut etkileşimi sahtesi. secenekler: seçenek adı → değer.
// Cevaplar cevaplar[]'a düşer; ilk cevabın gizli (yalnızca komutu kullanana görünür) olup olmadığı da tutulur.
function etkilesim({ sunucu = 'g', alt, secenekler = {}, izinler = [P.ManageGuild], botIzinleri = [], kanallar = {}, intents = [], ertele } = {}) {
  const cevaplar = [];
  const guild = {
    id: sunucu,
    ownerId: 'sahip',
    members: { me: { id: 'bot', permissions: izinli(...botIzinleri) } },
    channels: {
      cache: new Collection(Object.entries(kanallar)),
      fetch: async (id) => kanallar[id] ?? Promise.reject(new Error('Unknown Channel')),
    },
  };
  const kaydet = (m) => cevaplar.push(typeof m === 'string' ? { content: m } : m);
  return {
    cevaplar,
    guild,
    guildId: sunucu,
    client: { user: { id: 'bot' }, options: { intents: new IntentsBitField(intents) } },
    user: kullanici('mod'),
    memberPermissions: izinli(...izinler),
    options: {
      getSubcommand: () => alt,
      getChannel: (ad) => secenekler[ad] ?? null,
      getRole: (ad) => secenekler[ad] ?? null,
      getString: (ad) => secenekler[ad] ?? null,
      getInteger: (ad) => secenekler[ad] ?? null,
    },
    reply: async (m) => kaydet(m),
    deferReply: ertele ?? (async (m) => cevaplar.push({ ertelendi: true, ...m })),
    editReply: async (m) => kaydet(m),
  };
}
const son = (e) => e.cevaplar.at(-1);
const ayar = (sunucu = 'g') => depo.ayarlariGetir(sunucu);

// --- Sunucu günlüğü ---
// Günlük kanalı 'log' olan sahte sunucu; kanala gidenler giden[]'e düşer
function gunlukSunucusu(id) {
  const giden = [];
  const kanal = { isTextBased: () => true, send: async (m) => giden.push(m) };
  depo.ayarKaydet(id, 'logKanali', 'log');
  const guild = {
    id,
    memberCount: 42,
    client: { user: { id: 'bot' } },
    channels: { fetch: async (k) => (k === 'log' ? kanal : Promise.reject(new Error('Unknown Channel'))) },
  };
  return { guild, kanal, giden };
}
const alanlar = (mesaj) => Object.fromEntries(mesaj.embeds[0].data.fields.map((a) => [a.name, a.value]));
const baslik = (mesaj) => mesaj.embeds[0].data.title;
const roller = (...idler) => new Collection(idler.map((id) => [id, rol(id)]));

test('günlük: kanal ayarlı değilse, kategori kapalıysa ya da kanal alınamazsa hiçbir şey yazılmaz', async () => {
  const { guild, giden } = gunlukSunucusu('gunluk-1');
  const uye = { guild, user: kullanici('yeni') };

  depo.ayarKaydet(guild.id, 'logKategorileri', { uyeler: false });
  await gunluk.olaylar.uyeKatildi(uye);
  assert.equal(giden.length, 0, 'kapalı kategori');

  // Başka bir kategoriyi kapatmak bunu etkilemez; açıkça kapatılmamış kategori açıktır
  depo.ayarKaydet(guild.id, 'logKategorileri', { ses: false });
  await gunluk.olaylar.uyeKatildi(uye);
  assert.equal(giden.length, 1);

  depo.ayarKaydet(guild.id, 'logKanali', 'silinmis-kanal');
  await gunluk.olaylar.uyeKatildi(uye); // Hata fırlatmaz
  depo.ayarKaydet(guild.id, 'logKanali', null);
  await gunluk.olaylar.uyeKatildi(uye);
  assert.equal(giden.length, 1);
});

test('günlük: üye katıldı/ayrıldı kaydı; etiketler bildirim göndermez, @everyone rol sayılmaz', async () => {
  const { guild, giden } = gunlukSunucusu('gunluk-2');
  await gunluk.olaylar.uyeKatildi({ guild, user: kullanici('ayse') });
  assert.equal(baslik(giden[0]), 'Üye katıldı');
  assert.deepEqual(alanlar(giden[0]), {
    'Kullanıcı': '<@ayse> (ayse#0)',
    'Hesap açılışı': '<t:1600000000:R>',
    'Üye sayısı': '42',
  });
  assert.deepEqual(giden[0].allowedMentions, { parse: [] });
  assert.ok(giden[0].embeds[0].data.timestamp, 'kayıt zamanı yazılır');

  await gunluk.olaylar.uyeAyrildi({
    guild,
    id: 'ayse',
    user: kullanici('ayse'),
    joinedTimestamp: 1_700_000_000_000,
    roles: { cache: roller(guild.id, 'uye', 'oyuncu') },
  });
  assert.equal(baslik(giden[1]), 'Üye ayrıldı');
  assert.deepEqual(alanlar(giden[1]), {
    'Kullanıcı': '<@ayse> (ayse#0) · ayse',
    'Katılma': '<t:1700000000:R>',
    'Rolleri': '<@&uye> <@&oyuncu>',
  });
  assert.deepEqual(giden[1].allowedMentions, { parse: [] }, 'rol etiketleri de bildirim göndermez');

  // Bilgisi eksik (önbellekte olmayan) üye: bilinmeyen alanlar boş bırakılmaz, atlanır
  await gunluk.olaylar.uyeAyrildi({ guild, id: 'eski', user: kullanici('eski'), joinedTimestamp: null });
  assert.deepEqual(Object.keys(alanlar(giden[2])), ['Kullanıcı']);
});

test('günlük: takma ad ve rol değişikliği ayrı kaydedilir; önceki hali bilinmeyen üye atlanır', async () => {
  const { guild, giden } = gunlukSunucusu('gunluk-3');
  const uye = (nickname, ...rolIdleri) => ({ guild, user: kullanici('ali'), nickname, roles: { cache: roller(...rolIdleri) } });

  await gunluk.olaylar.uyeGuncellendi({ ...uye(null), partial: true }, uye('yeni ad', 'a'));
  await gunluk.olaylar.uyeGuncellendi(uye('ad', 'a'), uye('ad', 'a'));
  assert.equal(giden.length, 0);

  await gunluk.olaylar.uyeGuncellendi(uye(null, 'a', 'b'), uye('Ali', 'b', 'c'));
  assert.deepEqual(giden.map(baslik), ['Takma ad değişti', 'Roller değişti']);
  assert.deepEqual(alanlar(giden[0]), { 'Kullanıcı': '<@ali> (ali#0)', 'Önce': '(yok)', 'Sonra': 'Ali' });
  assert.deepEqual(alanlar(giden[1]), { 'Kullanıcı': '<@ali> (ali#0)', 'Verilen': '<@&c>', 'Alınan': '<@&a>' });

  // Yalnızca rol alındıysa "Verilen" alanı boş bırakılmaz
  await gunluk.olaylar.uyeGuncellendi(uye('Ali', 'b'), uye('Ali'));
  assert.deepEqual(Object.keys(alanlar(giden[2])), ['Kullanıcı', 'Alınan']);
});

test('günlük: silinen mesaj; bot ve özel mesajlar yazılmaz, uzun içerik kısaltılır', async () => {
  const { guild, giden } = gunlukSunucusu('gunluk-4');
  const kanal = { toString: () => '<#genel>' };
  await gunluk.olaylar.mesajSilindi({ guild: null, author: kullanici('a'), content: 'özel' });
  await gunluk.olaylar.mesajSilindi({ guild, author: kullanici('b', { bot: true }), channel: kanal, content: 'bot' });
  assert.equal(giden.length, 0);

  await gunluk.olaylar.mesajSilindi({ guild, author: kullanici('a'), channel: kanal, content: 'x'.repeat(1500), attachments: new Collection([['1', {}], ['2', {}]]) });
  const a = alanlar(giden[0]);
  assert.equal(baslik(giden[0]), 'Mesaj silindi');
  assert.equal(a['İçerik'].length, 1000, 'kart alanı 1024 karakter sınırına sığar');
  assert.ok(a['İçerik'].endsWith('…'));
  assert.equal(a['Ek dosya'], '2 adet');

  // Bot açılmadan önceki mesajların yazarı ve içeriği bilinmez
  await gunluk.olaylar.mesajSilindi({ guild, author: null, channel: kanal, content: null });
  assert.deepEqual(alanlar(giden[1]), { 'Yazan': 'Bilinmiyor (eski mesaj)', 'Kanal': '<#genel>' });
});

test('günlük: düzenlenen mesaj yalnızca içerik gerçekten değiştiyse yazılır', async () => {
  const { guild, giden } = gunlukSunucusu('gunluk-5');
  const mesaj = (content, ek = {}) => ({
    guild,
    author: kullanici('a'),
    channel: { toString: () => '<#genel>' },
    url: 'https://discord.com/channels/g/genel/1',
    content,
    ...ek,
  });
  await gunluk.olaylar.mesajDuzenlendi(mesaj('aynı'), mesaj('aynı')); // Bağlantı önizlemesi eklenince de olay gelir
  await gunluk.olaylar.mesajDuzenlendi(mesaj(null, { partial: true }), mesaj('yeni'));
  await gunluk.olaylar.mesajDuzenlendi(mesaj(''), mesaj('yeni')); // Message Content Intent kapalı
  await gunluk.olaylar.mesajDuzenlendi(mesaj('a', { author: kullanici('b', { bot: true }) }), mesaj('b', { author: kullanici('b', { bot: true }) }));
  assert.equal(giden.length, 0);

  await gunluk.olaylar.mesajDuzenlendi(mesaj('ilk'), mesaj('ikinci'));
  assert.deepEqual(alanlar(giden[0]), {
    'Yazan': '<@a> (a#0)',
    'Kanal': '<#genel> · [mesaja git](https://discord.com/channels/g/genel/1)',
    'Önce': 'ilk',
    'Sonra': 'ikinci',
  });
});

test('günlük: ses kanalına girme, çıkma ve değiştirme; susturma gibi değişiklikler yazılmaz', async () => {
  const { guild, giden } = gunlukSunucusu('gunluk-6');
  const member = { user: kullanici('a') };
  const ses = (channelId, ek = {}) => ({ guild, member, channelId, channel: channelId && { toString: () => `<#${channelId}>` }, ...ek });

  await gunluk.olaylar.sesDegisti(ses('s1'), ses('s1', { selfMute: true }));
  await gunluk.olaylar.sesDegisti(ses(null, { member: null }), ses('s1', { member: null }));
  assert.equal(giden.length, 0);

  await gunluk.olaylar.sesDegisti(ses(null), ses('s1'));
  await gunluk.olaylar.sesDegisti(ses('s1'), ses('s2'));
  await gunluk.olaylar.sesDegisti(ses('s2'), ses(null, { member: null })); // Çıkışta üye eski durumdan alınır
  assert.deepEqual(giden.map(baslik), ['Ses kanalına girdi', 'Ses kanalı değiştirdi', 'Ses kanalından çıktı']);
  assert.deepEqual(alanlar(giden[1]), { 'Kullanıcı': '<@a> (a#0)', 'Önce': '<#s1>', 'Sonra': '<#s2>' });

  depo.ayarKaydet(guild.id, 'logKategorileri', { ses: false });
  await gunluk.olaylar.sesDegisti(ses(null), ses('s1'));
  assert.equal(giden.length, 3);
});

test('günlük: denetim kaydı; botun kendi işlemi ve izlenmeyen işlemler yazılmaz', async () => {
  const { guild, giden } = gunlukSunucusu('gunluk-7');
  const kayit = (action, ek = {}) => ({ action, executorId: 'yetkili', targetId: 'hedef', reason: null, changes: [], ...ek });

  await gunluk.olaylar.denetimKaydi(kayit(AuditLogEvent.MemberBanAdd, { executorId: 'bot' }), guild);
  await gunluk.olaylar.denetimKaydi(kayit(AuditLogEvent.MessagePin), guild);
  await gunluk.olaylar.denetimKaydi(kayit(AuditLogEvent.MemberUpdate, { changes: [{ key: 'nick', old: 'a', new: 'b' }] }), guild);
  assert.equal(giden.length, 0);

  await gunluk.olaylar.denetimKaydi(kayit(AuditLogEvent.MemberBanAdd, { reason: 'reklam' }), guild);
  assert.equal(baslik(giden[0]), 'Üye yasaklandı');
  assert.deepEqual(alanlar(giden[0]), { 'Kullanıcı': '<@hedef> · hedef', 'Yetkili': '<@yetkili>', 'Sebep': 'reklam' });

  const bitis = '2030-01-01T00:00:00.000Z';
  await gunluk.olaylar.denetimKaydi(kayit(AuditLogEvent.MemberUpdate, { changes: [{ key: 'communication_disabled_until', new: bitis }] }), guild);
  await gunluk.olaylar.denetimKaydi(kayit(AuditLogEvent.MemberUpdate, { changes: [{ key: 'communication_disabled_until', old: bitis }] }), guild);
  assert.deepEqual(giden.slice(1).map(baslik), ['Üye susturuldu', 'Susturma kaldırıldı']);
  assert.equal(alanlar(giden[1])['Bitiş'], `<t:${Date.parse(bitis) / 1000}:R>`);
  assert.equal(alanlar(giden[2])['Bitiş'], undefined);

  // Silinen kanalın adı eski değerden okunur
  await gunluk.olaylar.denetimKaydi(kayit(AuditLogEvent.ChannelDelete, { changes: [{ key: 'name', old: 'duyurular' }] }), guild);
  assert.deepEqual(alanlar(giden[3]), { 'Ad': 'duyurular', 'Yetkili': '<@yetkili>' });

  // Kategoriler ayrı: moderasyon kapalıyken sunucu olayları yazılmaya devam eder
  depo.ayarKaydet(guild.id, 'logKategorileri', { moderasyon: false });
  await gunluk.olaylar.denetimKaydi(kayit(AuditLogEvent.MemberKick), guild);
  await gunluk.olaylar.denetimKaydi(kayit(AuditLogEvent.RoleCreate, { changes: [{ key: 'name', new: 'yeni rol' }] }), guild);
  assert.deepEqual(giden.slice(4).map(baslik), ['Rol oluşturuldu']);
});

test('günlük: kanala dosya eklenemiyorsa kayıt eksiz gönderilir; gönderim hatası dışarı sızmaz', async () => {
  const { guild, kanal, giden } = gunlukSunucusu('gunluk-8');
  const embed = () => new (require('discord.js').EmbedBuilder)().setTitle('Kanıt');
  kanal.send = async (m) => {
    if (m.files) throw new Error('Missing Permissions');
    giden.push(m);
  };
  await gunluk.gunlukGonder(guild, 'moderasyon', embed(), [{ attachment: Buffer.from('x'), name: 'kanit.png' }]);
  assert.equal(giden.length, 1);
  assert.equal(giden[0].files, undefined);

  kanal.send = async () => {
    throw new Error('Missing Access');
  };
  await gunluk.gunlukGonder(guild, 'moderasyon', embed());
});

test('günlük: olay işlenirken çıkan hata yakalanır, bot kapanmaz', async () => {
  const istemci = new EventEmitter();
  gunluk.baslat(istemci);
  const asilHata = console.error;
  const hatalar = [];
  console.error = (...a) => hatalar.push(a.join(' '));
  try {
    istemci.emit(Events.GuildMemberAdd, { guild: { id: 'gunluk-9' } }); // user yok: TypeError
    for (let i = 0; i < 3; i++) await turBekle();
  } finally {
    console.error = asilHata;
  }
  assert.equal(hatalar.length, 1);
  assert.match(hatalar[0], /Günlük hatası \(guildMemberAdd\)/);
  assert.deepEqual(
    [Events.GuildMemberAdd, Events.GuildMemberRemove, Events.GuildMemberUpdate, Events.MessageDelete, Events.MessageBulkDelete, Events.MessageUpdate, Events.VoiceStateUpdate, Events.GuildAuditLogEntryCreate].map((o) => istemci.listenerCount(o)),
    [1, 1, 1, 1, 1, 1, 1, 1],
  );
});

// --- /ayarla ---
test('/ayarla log-kanali ve hosgeldin-kanali: bot yazamadığı kanalı kabul etmez', async () => {
  const ayarla = komut('ayarla');
  // Günlük kart (embed) gönderir; Bağlantı Yerleştir izni olmadan kart görünmez
  const kartsiz = sahteKanal('kartsiz', [P.ViewChannel, P.SendMessages]);
  const e = etkilesim({ sunucu: 'ayar-1', alt: 'log-kanali', secenekler: { kanal: kartsiz } });
  await ayarla.execute(e);
  assert.match(son(e).content, /^❌ <#kartsiz> kanalına yazamıyorum.*Bağlantı Yerleştir/);
  assert.equal(son(e).flags, MessageFlags.Ephemeral);
  assert.equal(ayar('ayar-1').logKanali, undefined);

  await ayarla.execute(etkilesim({ sunucu: 'ayar-1', alt: 'log-kanali', secenekler: { kanal: sahteKanal('log') } }));
  assert.equal(ayar('ayar-1').logKanali, 'log');

  // Hoş geldin mesajı düz metindir: Bağlantı Yerleştir gerekmez, görme ve yazma gerekir
  await ayarla.execute(etkilesim({ sunucu: 'ayar-1', alt: 'hosgeldin-kanali', secenekler: { kanal: kartsiz } }));
  assert.equal(ayar('ayar-1').hosgeldinKanali, 'kartsiz');
  const gorunmez = etkilesim({ sunucu: 'ayar-1', alt: 'hosgeldin-kanali', secenekler: { kanal: sahteKanal('gizli', [P.SendMessages]) } });
  await ayarla.execute(gorunmez);
  assert.match(son(gorunmez).content, /^❌/);
  assert.equal(ayar('ayar-1').hosgeldinKanali, 'kartsiz');
});

test('/ayarla log-kategori: tek kategori ya da hepsi açılıp kapanır; günlük buna uyar', async () => {
  const ayarla = komut('ayarla');
  const kategori = (kategori, durum, sunucu = 'ayar-2') => {
    const e = etkilesim({ sunucu, alt: 'log-kategori', secenekler: { kategori, durum } });
    return ayarla.execute(e).then(() => son(e).content);
  };
  // Kanal seçilmeden açılırsa kayıtların neden gelmediği söylenir
  assert.match(await kategori('ses', 'acik', 'ayar-2b'), /`\/ayarla log-kanali` ile bir kanal seç/);

  const { guild, giden } = gunlukSunucusu('ayar-2');
  assert.equal(await kategori('mesajlar', 'kapali'), '✅ Mesajlar (silinen ve düzenlenen mesajlar): kapalı.');
  assert.deepEqual(ayar('ayar-2').logKategorileri, { mesajlar: false });
  await gunluk.olaylar.mesajSilindi({ guild, author: kullanici('a'), channel: '<#genel>', content: 'gizli' });
  await gunluk.olaylar.uyeKatildi({ guild, user: kullanici('a') });
  assert.deepEqual(giden.map(baslik), ['Üye katıldı']);

  assert.match(await kategori('hepsi', 'kapali'), /^✅ Tüm kategoriler: kapalı\.$/);
  assert.ok(Object.keys(gunluk.KATEGORILER).every((k) => !gunluk.kategoriAcik(ayar('ayar-2'), k)));
  assert.doesNotMatch(await kategori('hepsi', 'acik'), /log-kanali/, 'kanal seçiliyken uyarı yok');
  assert.ok(Object.keys(gunluk.KATEGORILER).every((k) => gunluk.kategoriAcik(ayar('ayar-2'), k)));
});

test('/ayarla sifirla: seçilen ayar kaldırılır, diğerleri kalır', async () => {
  const ayarla = komut('ayarla');
  for (const [anahtar, deger] of [['logKanali', 'l'], ['hosgeldinKanali', 'h'], ['otoRol', 'r']]) depo.ayarKaydet('ayar-3', anahtar, deger);
  for (const [secim, anahtar] of [['log-kanali', 'logKanali'], ['hosgeldin-kanali', 'hosgeldinKanali'], ['oto-rol', 'otoRol']]) {
    const e = etkilesim({ sunucu: 'ayar-3', alt: 'sifirla', secenekler: { ayar: secim } });
    await ayarla.execute(e);
    assert.equal(son(e).content, `✅ ${secim} ayarı kaldırıldı.`);
    assert.equal(ayar('ayar-3')[anahtar], null);
  }
});

test('/ayarla ozet: yapay zekâ kurulu değilse ya da mesaj içeriği okunamıyorsa açılmaz', async () => {
  const ayarla = komut('ayarla');
  const yapayzeka = src('yapayzeka');
  const ozet = async (durum, intents = [GatewayIntentBits.MessageContent]) => {
    const e = etkilesim({ sunucu: 'ayar-4', alt: 'ozet', secenekler: { durum }, intents });
    await ayarla.execute(e);
    return son(e).content;
  };
  assert.equal(yapayzeka.hazir(), false);
  assert.match(await ozet('acik'), /yapay zekâ kurulu değil/);
  assert.equal(ayar('ayar-4').ozetAcik, undefined);

  const hazir = mock.method(yapayzeka, 'hazir', () => true);
  try {
    assert.match(await ozet('acik', []), /Message Content Intent/);
    assert.equal(ayar('ayar-4').ozetAcik, undefined);
    const acik = await ozet('acik');
    assert.match(acik, /^✅ Özetleme açık/);
    assert.match(acik, /Google'ın yapay zekâsına gönderilir/, 'mesajların dışarı gittiği söylenir');
    assert.equal(ayar('ayar-4').ozetAcik, true);
  } finally {
    hazir.mock.restore();
  }
  // Kapatmak her zaman serbest
  assert.equal(await ozet('kapali', []), '✅ Özetleme kapatıldı.');
  assert.equal(ayar('ayar-4').ozetAcik, false);
});

test('/ayarla goster: ayarlar ve günlük kategorileri gizli kartla gösterilir', async () => {
  const ayarla = komut('ayarla');
  const bos = etkilesim({ sunucu: 'ayar-5', alt: 'goster' });
  await ayarla.execute(bos);
  const alan = (e, ad) => son(e).embeds[0].data.fields.find((a) => a.name === ad).value;
  assert.equal(son(bos).flags, MessageFlags.Ephemeral);
  assert.equal(alan(bos, 'Log kanalı'), 'Ayarlanmadı');
  assert.equal(alan(bos, 'Kanal özetleri (/ozetle)'), '⚫ Kapalı');
  assert.ok(alan(bos, 'Log kategorileri').split('\n').every((s) => s.startsWith('🟢')));

  depo.ayarKaydet('ayar-5', 'logKanali', 'l');
  depo.ayarKaydet('ayar-5', 'otoRol', 'r');
  depo.ayarKaydet('ayar-5', 'logKategorileri', { ses: false });
  const dolu = etkilesim({ sunucu: 'ayar-5', alt: 'goster' });
  await ayarla.execute(dolu);
  assert.equal(alan(dolu, 'Log kanalı'), '<#l>');
  assert.equal(alan(dolu, 'Oto rol'), '<@&r>');
  assert.match(alan(dolu, 'Log kategorileri'), /⚫ Ses kanalları/);
  assert.match(alan(dolu, 'Log kategorileri'), /🟢 Moderasyon/);
});

// --- Acil durum kilidi: /kitle ve /kilidiac ---
// İzin satırı listesini karşılaştırılabilir hale getirir
const satirlar = (kanal) =>
  [...kanal.permissionOverwrites.cache.values()]
    .map((i) => ({ id: i.id, type: i.type, allow: i.allow.bitfield, deny: i.deny.bitfield }))
    .sort((a, b) => a.id.localeCompare(b.id));

// Sahte kanal: permissionOverwrites.set Discord gibi listenin tamamını yazar. hatalar: set'in sırayla fırlatacağı hatalar
function kilitKanali(id, type, satirListesi, { hatalar = [] } = {}) {
  const yap = (i) => ({ id: i.id, type: i.type, allow: new PermissionsBitField(i.allow ?? 0n), deny: new PermissionsBitField(i.deny ?? 0n) });
  const kanal = {
    id,
    name: id,
    type,
    isThread: () => false,
    permissionsFor: () => izinli(P.ViewChannel, P.SendMessages, P.ManageRoles),
    permissionOverwrites: {
      cache: new Collection(satirListesi.map((i) => [i.id, yap(i)])),
      edit: async () => {},
      set: async (liste) => {
        const hata = hatalar.shift();
        if (hata) throw hata;
        kanal.permissionOverwrites.cache = new Collection(liste.map((i) => [i.id, yap(i)]));
      },
    },
  };
  return kanal;
}

function kilitSunucusu(id, { botIzinleri = [P.ManageRoles, P.ManageChannels, P.MoveMembers], hatalar = [] } = {}) {
  const kategori = kilitKanali('kategori', 4, [{ id, type: OverwriteType.Role, deny: P.ViewChannel }]);
  const genel = kilitKanali('genel', 0, [
    { id, type: OverwriteType.Role, allow: P.SendMessages | P.AddReactions },
    { id: 'uyeler', type: OverwriteType.Role, allow: P.ViewChannel, deny: P.AttachFiles },
    { id: 'ozel-kisi', type: OverwriteType.Member, allow: P.ManageMessages },
  ], { hatalar });
  const ses = kilitKanali('ses', 2, []);
  const konu = { ...kilitKanali('konu', 11, []), isThread: () => true };
  const sesteki = [];
  const gunlukKanali = { isTextBased: () => true, send: async (m) => gunlukKaydi.push(m) };
  const gunlukKaydi = [];
  depo.ayarKaydet(id, 'logKanali', 'log');
  const kanallar = new Collection([kategori, genel, ses, konu].map((k) => [k.id, k]));
  const guild = {
    id,
    ownerId: 'sahip',
    members: { me: { id: 'bot', permissions: izinli(...botIzinleri) } },
    channels: { cache: kanallar, fetch: async (k) => (k === 'log' ? gunlukKanali : null) },
    roles: { everyone: { id }, cache: new Collection([[id, {}], ['uyeler', {}]]) },
    voiceStates: {
      cache: new Collection(['sahip', 'bot', 'saldirgan', 'izleyici'].map((u) => [u, { id: u, channelId: u === 'izleyici' ? null : 'ses', disconnect: async () => sesteki.push(u) }])),
    },
  };
  return { guild, kanallar: { kategori, genel, ses, konu }, sesteki, gunlukKaydi };
}

const kilitEtkilesimi = (guild, ek = {}) => ({ ...etkilesim({ sunucu: guild.id, ...ek }), guild, user: kullanici('yonetici') });
// kilit.js her işlemde konsola özet yazar; test çıktısını kirletmesin
async function sessizce(islem) {
  const [log, hata] = [console.log, console.error];
  console.log = console.error = () => {};
  try {
    return await islem();
  } finally {
    [console.log, console.error] = [log, hata];
  }
}

test('/kitle ve /kilidiac: kanallar kilitlenir, kilit açılınca izinler aynen geri gelir', async () => {
  const kitle = komut('kitle');
  const kilidiac = komut('kilidiac');
  const kilit = src('kilit');
  const { guild, kanallar, sesteki, gunlukKaydi } = kilitSunucusu('kilit-a');
  const once = Object.fromEntries(Object.entries(kanallar).map(([ad, k]) => [ad, satirlar(k)]));

  const acik = kilitEtkilesimi(guild);
  await kilidiac.execute(acik);
  assert.equal(son(acik).content, '🔓 Sunucu kilitli değil.');

  const e = kilitEtkilesimi(guild);
  await sessizce(() => kitle.execute(e));
  assert.equal(e.cevaplar[0].flags, MessageFlags.Ephemeral, 'kilit sonucu yalnızca kilitleyene görünür');
  const aciklama = son(e).embeds[0].data.description;
  assert.match(aciklama, /\*\*3 kanal\*\* kilitlendi/, 'konular (thread) ayrıca kilitlenmez');
  assert.match(aciklama, /1 kişi ses kanallarından çıkarıldı/);
  assert.deepEqual(sesteki, ['saldirgan'], 'sahip ve bot sesten atılmaz');
  assert.equal(kilit.kilitli(guild.id), true);

  // Kilitliyken: @everyone ve diğer satırlar yazamaz, bot yazabilir; kişiye özel ek izinler korunur
  const satir = (kanal, id) => satirlar(kanal).find((s) => s.id === id);
  for (const id of [guild.id, 'uyeler', 'ozel-kisi']) {
    assert.ok(satir(kanallar.genel, id).deny & P.SendMessages, id);
    assert.equal(satir(kanallar.genel, id).allow & P.SendMessages, 0n, id);
  }
  assert.ok(satir(kanallar.genel, 'ozel-kisi').allow & P.ManageMessages);
  assert.ok(satir(kanallar.genel, 'bot').allow & P.SendMessages);
  assert.ok(satir(kanallar.ses, guild.id).deny & P.Connect, 'boş izinli ses kanalına da @everyone yasağı yazılır');
  assert.deepEqual(satirlar(kanallar.konu), once.konu);
  assert.equal(baslik(gunlukKaydi[0]), '🔒 Sunucu kilitlendi');

  const tekrar = kilitEtkilesimi(guild);
  await kitle.execute(tekrar);
  assert.match(son(tekrar).content, /zaten kilitli/);

  const ac = kilitEtkilesimi(guild);
  await sessizce(() => kilidiac.execute(ac));
  assert.equal(son(ac).content, '🔓 Kilit açıldı: 3 kanal kilitten önceki izinlerine döndü.');
  for (const [ad, kanal] of Object.entries(kanallar)) assert.deepEqual(satirlar(kanal), once[ad], ad);
  assert.equal(kilit.kilitli(guild.id), false);
  assert.equal(depo.oku('kilit', {})[guild.id], undefined, 'yedek silinir');
  assert.equal(baslik(gunlukKaydi[1]), '🔓 Sunucunun kilidi açıldı');
});

test('/kitle: bot izinleri yetmiyorsa hiçbir kanala dokunulmaz', async () => {
  const { guild, kanallar } = kilitSunucusu('kilit-b', { botIzinleri: [P.ManageChannels] });
  const once = satirlar(kanallar.genel);
  const e = kilitEtkilesimi(guild);
  await komut('kitle').execute(e);
  assert.match(son(e).content, /Rolleri Yönet.*Kanalları Yönet/);
  assert.deepEqual(satirlar(kanallar.genel), once);
  assert.equal(src('kilit').kilitli(guild.id), false);
});

test('/kitle: aynı anda iki kez çalıştırılırsa ikincisi beklemesini söyler', async () => {
  const { guild } = kilitSunucusu('kilit-c');
  const [ilk, ikinci] = [kilitEtkilesimi(guild), kilitEtkilesimi(guild)];
  await sessizce(() => Promise.all([komut('kitle').execute(ilk), komut('kitle').execute(ikinci)]));
  assert.ok(son(ilk).embeds, 'ilki kilitler');
  assert.match(son(ikinci).content, /^⏳/);
  await sessizce(() => komut('kilidiac').execute(kilitEtkilesimi(guild)));
});

test('/kilidiac: açılamayan kanal kalırsa sunucu kilitli sayılır, yeniden çalıştırınca kalanlar açılır', async () => {
  const yetkiYok = Object.assign(new Error('Missing Permissions'), { code: 50013 });
  // genel kanalın 1. set çağrısı (kilitleme) geçer, 2.si (açma) reddedilir
  const { guild, kanallar } = kilitSunucusu('kilit-d', { hatalar: [null, yetkiYok] });
  const once = Object.fromEntries(Object.entries(kanallar).map(([ad, k]) => [ad, satirlar(k)]));
  await sessizce(() => komut('kitle').execute(kilitEtkilesimi(guild)));

  // Kilit sırasında bir rol ve bir kanal silindi: geri yüklenemezler, işlemi de bozmazlar
  guild.roles.cache.delete('uyeler');
  guild.channels.cache.delete('ses');

  const ilk = kilitEtkilesimi(guild);
  await sessizce(() => komut('kilidiac').execute(ilk));
  assert.equal(son(ilk).content, '⚠️ 1 kanal eski haline döndü, **1 kanal açılamadı** (Yetkim yetmedi (1 kanal)). Sunucu hâlâ kilitli sayılıyor; `/kilidiac` komutunu yeniden çalıştır.');
  assert.equal(src('kilit').kilitli(guild.id), true);
  assert.deepEqual(Object.keys(depo.oku('kilit', {})[guild.id]), ['genel'], 'yalnızca açılamayanın yedeği kalır');
  assert.deepEqual(satirlar(kanallar.kategori), once.kategori);

  const ikinci = kilitEtkilesimi(guild);
  await sessizce(() => komut('kilidiac').execute(ikinci));
  assert.match(son(ikinci).content, /^🔓 Kilit açıldı: 1 kanal/);
  assert.deepEqual(satirlar(kanallar.genel), once.genel.filter((s) => s.id !== 'uyeler'), 'silinen rolün satırı geri yazılmaz');
  assert.equal(src('kilit').kilitli(guild.id), false);
});

// --- Bildirim komutları: /oyun, /yayin, /haber, /instagram ---
const firsatlar = src('firsatlar');
const yayin = src('yayin');
const haber = src('haber');
const instagram = src('instagram');

const BILDIRIM_KOMUTLARI = [
  { ad: 'oyun', kanalAyari: 'oyunKanali', rolAyari: 'oyunRol' },
  { ad: 'yayin', kanalAyari: 'yayinKanali', rolAyari: 'yayinRol' },
  { ad: 'haber', kanalAyari: 'haberKanali', rolAyari: 'haberRol' },
  { ad: 'instagram', kanalAyari: 'instagramKanali', rolAyari: 'instagramRol' },
];

test('bildirim komutları: kanal yalnızca bot oraya kart gönderebiliyorsa kaydedilir; kapat kanalı kaldırır', async () => {
  for (const { ad, kanalAyari } of BILDIRIM_KOMUTLARI) {
    const sunucu = `kanal-${ad}`;
    const kartsiz = etkilesim({ sunucu, alt: 'kanal', secenekler: { kanal: sahteKanal('k', [P.ViewChannel, P.SendMessages]) } });
    await komut(ad).execute(kartsiz);
    assert.match(son(kartsiz).content, /^❌ <#k> kanalına yazamıyorum/, ad);
    assert.equal(ayar(sunucu)[kanalAyari], undefined, ad);

    const e = etkilesim({ sunucu, alt: 'kanal', secenekler: { kanal: sahteKanal('k') } });
    await komut(ad).execute(e);
    assert.match(son(e).content, /^✅/, ad);
    assert.equal(son(e).flags, MessageFlags.Ephemeral, ad);
    assert.equal(ayar(sunucu)[kanalAyari], 'k', ad);

    const kapat = etkilesim({ sunucu, alt: 'kapat' });
    await komut(ad).execute(kapat);
    assert.match(son(kapat).content, /^✅ .*kapatıldı/, ad);
    assert.equal(ayar(sunucu)[kanalAyari], null, ad);
  }
});

test('bildirim komutları: rolü yalnızca etiketleyebilen seçer; @everyone seçilemez; bot etiketleyemiyorsa uyarılır', async () => {
  for (const { ad, rolAyari } of BILDIRIM_KOMUTLARI) {
    const sunucu = `rol-${ad}`;
    const rolSec = async (secilen, { izinler = [P.ManageGuild], botIzinleri = [] } = {}) => {
      const e = etkilesim({ sunucu, alt: 'rol', secenekler: { rol: secilen }, izinler, botIzinleri });
      await komut(ad).execute(e);
      return son(e).content;
    };

    assert.match(await rolSec(rol(sunucu, { mentionable: true })), /@everyone seçilemez/, ad);
    assert.match(await rolSec(rol('gizli')), /etiketleme yetkin yok/, ad);
    assert.equal(ayar(sunucu)[rolAyari], undefined, `${ad}: etiketleyemediği rol kaydedilmez`);

    assert.match(await rolSec(rol('acik', { mentionable: true })), /^✅ .*<@&acik> etiketlenecek/, ad);
    assert.equal(ayar(sunucu)[rolAyari], 'acik', ad);

    // Herkesi etiketleyebilen yetkili kapalı rolü seçebilir; bot etiketleyemiyorsa bildirim gitmeyeceği söylenir
    assert.match(await rolSec(rol('kapali'), { izinler: [P.ManageGuild, P.MentionEveryone] }), /^⚠️ <@&kapali> kaydedildi ama bildirim gitmeyecek/, ad);
    assert.equal(ayar(sunucu)[rolAyari], 'kapali', ad);
    assert.match(await rolSec(rol('kapali'), { izinler: [P.MentionEveryone], botIzinleri: [P.MentionEveryone] }), /^✅/, ad);

    assert.match(await rolSec(null), /artık rol etiketlenmeyecek/, ad);
    assert.equal(ayar(sunucu)[rolAyari], null, ad);
  }
});

test('/oyun bedava ve indirim: durum, mağaza ve en az indirim oranı kaydedilir', async () => {
  const oyun = komut('oyun');
  const calistir = async (alt, secenekler) => {
    const e = etkilesim({ sunucu: 'oyun-1', alt, secenekler });
    await oyun.execute(e);
    return son(e).content;
  };
  assert.equal(await calistir('bedava', { durum: 'acik', magaza: 'epic' }), '✅ Bedava oyun bildirimleri açık. Mağaza: Epic Games.');
  // Mağaza seçilmezse önceki seçim kalır
  assert.equal(await calistir('bedava', { durum: 'acik' }), '✅ Bedava oyun bildirimleri açık. Mağaza: Epic Games.');
  assert.equal(await calistir('bedava', { durum: 'kapali' }), '✅ Bedava oyun bildirimleri kapatıldı.');

  assert.equal(await calistir('indirim', { durum: 'acik', magaza: 'gog', 'en-az-yuzde': 75 }), '✅ İndirim bildirimleri açık. Mağaza: GOG. En az indirim: %75.');
  assert.equal(await calistir('indirim', { durum: 'kapali' }), '✅ İndirim bildirimleri kapatıldı.');
  assert.deepEqual(
    (({ bedava, magaza, indirim, indirimMagaza, yuzde }) => ({ bedava, magaza, indirim, indirimMagaza, yuzde }))(firsatlar.ayarCoz(ayar('oyun-1'))),
    { bedava: false, magaza: 'epic', indirim: false, indirimMagaza: 'gog', yuzde: 75 },
  );
});

test('/oyun everyone: bot o kanalda @everyone atamıyorsa uyarılır', async () => {
  const oyun = komut('oyun');
  const everyone = async (durum, { kanalIzinleri, botIzinleri = [] } = {}) => {
    const kanallar = kanalIzinleri ? { firsat: sahteKanal('firsat', kanalIzinleri) } : {};
    depo.ayarKaydet('oyun-2', 'oyunKanali', kanalIzinleri ? 'firsat' : null);
    const e = etkilesim({ sunucu: 'oyun-2', alt: 'everyone', secenekler: { durum }, kanallar, botIzinleri });
    await oyun.execute(e);
    return son(e).content;
  };
  // Kanal seçilmemişse sunucu geneli izne bakılır
  assert.match(await everyone('acik'), /Tüm Rollerden Bahset\*\* izni yok/);
  assert.doesNotMatch(await everyone('acik', { botIzinleri: [P.MentionEveryone] }), /izni yok/);
  // Kanal seçiliyse o kanaldaki izne: sunucu genelinde izin olsa da kanalda kapalıysa uyarılır
  assert.match(await everyone('acik', { kanalIzinleri: [P.SendMessages], botIzinleri: [P.MentionEveryone] }), /izni yok/);
  assert.match(await everyone('acik', { kanalIzinleri: [P.MentionEveryone] }), /en fazla 6 saatte bir/);
  assert.equal(ayar('oyun-2').oyunEveryone, true);
  assert.equal(await everyone('kapali'), '✅ Önemli fırsatlarda artık @everyone atılmayacak.');
  assert.equal(ayar('oyun-2').oyunEveryone, false);
});

test('/oyun simdi: kanal ister, sunucu başına 5 dakikada bir çalışır; goster ayarları özetler', async () => {
  const oyun = komut('oyun');
  const gonder = mock.method(firsatlar, 'simdiGonder', async () => ({ bedava: 2, indirim: 0 }));
  mock.timers.enable({ apis: ['Date'], now: 5_000_000 });
  try {
    const simdi = async () => {
      const e = etkilesim({ sunucu: 'oyun-3', alt: 'simdi' });
      await oyun.execute(e);
      return son(e).content;
    };
    assert.equal(await simdi(), '❌ Önce `/oyun kanal` ile bir kanal seç.');
    depo.ayarKaydet('oyun-3', 'oyunKanali', 'firsat');
    assert.equal(await simdi(), '✅ <#firsat> kanalına 2 bedava oyun ve 0 indirim gönderildi.');
    assert.match(await simdi(), /^⏳ Fırsatlar az önce gönderildi/);
    assert.equal(gonder.mock.callCount(), 1, 'beklerken mağazalara yeniden istek atılmaz');
    mock.timers.tick(5 * 60_000);
    gonder.mock.mockImplementation(async () => ({ bedava: 0, indirim: 0 }));
    assert.equal(await simdi(), 'Şu an ayarlarına uyan bir fırsat yok.');
  } finally {
    mock.timers.reset();
    gonder.mock.restore();
  }

  depo.ayarKaydet('oyun-3', 'oyunBedava', false);
  const e = etkilesim({ sunucu: 'oyun-3', alt: 'goster' });
  await oyun.execute(e);
  const kart = son(e).embeds[0].data;
  assert.match(kart.description, /\*\*Kanal:\*\* <#firsat>/);
  assert.equal(kart.fields[0].value, '⚫ Kapalı');
  assert.match(kart.fields[1].value, /^🟢 Açık\nSteam, Epic ve GOG\nEn az %/);
});

test('/yayin: bağlantısı kurulmamış platform eklenmez, liste bunu gösterir', async () => {
  const yayinKomutu = komut('yayin');
  for (const platform of Object.keys(yayin.PLATFORMLAR)) {
    assert.equal(yayin.PLATFORMLAR[platform].hazir(), false, platform);
    const e = etkilesim({ sunucu: 'yayin-1', alt: 'ekle', secenekler: { platform, yayinci: 'deneme' } });
    await yayinKomutu.execute(e);
    assert.equal(e.cevaplar[0].ertelendi, true, 'platforma sorulacağı için önce ertelenir');
    assert.match(son(e).content, /^❌ .*bağlantısı henüz kurulmamış/, platform);
  }
  assert.deepEqual(yayin.liste('yayin-1'), []);

  const e = etkilesim({ sunucu: 'yayin-1', alt: 'liste' });
  await yayinKomutu.execute(e);
  const kart = son(e).embeds[0].data;
  assert.ok(kart.fields.every((a) => a.value === '⚠️ Bağlantı kurulmamış'));
  assert.match(kart.description, /ayarlanmadı \(bildirimler kapalı\)/);
});

test('/yayin ekle ve cikar: platform hatası kullanıcıya genel bir mesajla söylenir; çıkarılınca abonelik eşitlenir', async () => {
  const yayinKomutu = komut('yayin');
  const ekle = async (sonuc) => {
    const sahte = mock.method(yayin, 'ekle', async () => (sonuc instanceof Error ? Promise.reject(sonuc) : sonuc));
    const e = etkilesim({ sunucu: 'yayin-2', alt: 'ekle', secenekler: { platform: 'twitch', yayinci: 'deneme' } });
    const asilHata = console.error;
    console.error = () => {};
    try {
      await yayinKomutu.execute(e);
    } finally {
      console.error = asilHata;
      sahte.mock.restore();
    }
    return son(e).content;
  };
  assert.match(await ekle(new Error('ETIMEDOUT')), /^❌ Eklenemedi: platforma ulaşılamadı/);
  assert.equal(await ekle({ hata: 'Twitch üzerinde "x" adında bir kanal bulamadım.' }), '❌ Twitch üzerinde "x" adında bir kanal bulamadım.');
  assert.match(await ekle({ yayinci: { ad: 'Yayıncı' } }), /^✅ \*\*Yayıncı\*\* \(Twitch\) takibe alındı\. .*`\/yayin kanal`/);
  depo.ayarKaydet('yayin-2', 'yayinKanali', 'k');
  assert.equal(await ekle({ yayinci: { ad: 'Yayıncı' } }), '✅ **Yayıncı** (Twitch) takibe alındı.');
  // Kanal adı platformdan gelir (YouTube'da serbest metin): biçimlendirme ve gizli bağlantı oluşturmaz
  assert.equal(await ekle({ yayinci: { ad: '[tıkla](https://kotu.example) **' } }), '✅ **[tıkla]\\(https://kotu.example) \\*\\*** (Twitch) takibe alındı.');

  depo.yaz('yayincilar', { 'yayin-2': [{ platform: 'kick', id: '7', giris: 'ornek', ad: 'Örnek' }] });
  const esitle = mock.method(yayin, 'esitle', async () => {});
  try {
    const yok = etkilesim({ sunucu: 'yayin-2', alt: 'cikar', secenekler: { platform: 'twitch', yayinci: 'ornek' } });
    await yayinKomutu.execute(yok);
    assert.match(son(yok).content, /Listede böyle bir yayıncı yok/, 'başka platformdaki aynı ad çıkarılmaz');
    const e = etkilesim({ sunucu: 'yayin-2', alt: 'cikar', secenekler: { platform: 'kick', yayinci: 'https://kick.com/ornek' } });
    await yayinKomutu.execute(e);
    assert.equal(son(e).content, '✅ **Örnek** (Kick) takipten çıkarıldı.');
    assert.deepEqual(esitle.mock.calls.map((c) => c.arguments), [['kick']]);
    assert.deepEqual(yayin.liste('yayin-2'), []);
  } finally {
    esitle.mock.restore();
  }
});

test('/yayin test: deneme bildirimi kimseyi etiketlemez; liste uzun olunca kısaltılır', async () => {
  const yayinKomutu = komut('yayin');
  const test_ = async (kanallar) => {
    const e = etkilesim({ sunucu: 'yayin-3', alt: 'test', kanallar });
    await yayinKomutu.execute(e);
    return son(e).content;
  };
  assert.match(await test_({}), /Önce `\/yayin kanal`/);
  depo.ayarKaydet('yayin-3', 'yayinKanali', 'bildirim');
  assert.match(await test_({}), /Bildirim kanalı bulunamadı/);
  const kanal = sahteKanal('bildirim');
  assert.equal(await test_({ bildirim: kanal }), '✅ <#bildirim> kanalına deneme bildirimi gönderildi.');
  assert.equal(kanal.gonderilen.length, 1);
  assert.deepEqual(kanal.gonderilen[0].allowedMentions, { parse: [] });

  // 50 Twitch yayıncısı: kart alanı 1024 karakteri aşmaz, sığmayanlar sayıyla söylenir. Adlar biçimlendirme taşımaz.
  depo.yaz('yayincilar', {
    'yayin-3': [
      ...Array.from({ length: 50 }, (_, i) => ({ platform: 'twitch', id: String(i), giris: `yayinci_${i}`, ad: `*Yayıncı ${i}*` })),
      { platform: 'youtube', id: 'UC1', giris: 'tuzak', ad: 'x](https://kotu.example) [y' },
    ],
  });
  const e = etkilesim({ sunucu: 'yayin-3', alt: 'liste' });
  await yayinKomutu.execute(e);
  const twitch = son(e).embeds[0].data.fields[0];
  assert.equal(twitch.name, '🟣 Twitch · 50');
  assert.ok(twitch.value.length <= 1024, `${twitch.value.length} karakter`);
  assert.match(twitch.value, / · \+\d+ daha$/);
  assert.match(twitch.value, /\[\\\*Yayıncı 0\\\*\]\(https:\/\/www\.twitch\.tv\/yayinci_0\)/);
  assert.equal(son(e).embeds[0].data.footer.text, '51 yayıncı takip ediliyor');
  const youtube = son(e).embeds[0].data.fields.find((a) => a.name.includes('YouTube'));
  assert.equal(youtube.value, '⚠️ Bağlantı kurulmamış\n[x]\\(https://kotu.example) [y](https://www.youtube.com/channel/UC1)');
});

test('/haber ekle: aynı sunucuda üst üste ekleme reddedilir; cevap verilemese de sıra kilitli kalmaz', async () => {
  const haberKomutu = komut('haber');
  // Her ekleme, test bitir[] içindeki çözücüsünü çağırana kadar sürer
  const bitir = [];
  const ekle = mock.method(haber, 'ekle', () => new Promise((coz) => bitir.push(coz)));
  try {
    const ilk = etkilesim({ sunucu: 'haber-1', alt: 'ekle', secenekler: { adres: 'ornek.com' } });
    const suren = haberKomutu.execute(ilk);
    await turBekle();
    const ikinci = etkilesim({ sunucu: 'haber-1', alt: 'ekle', secenekler: { adres: 'baska.com' } });
    await haberKomutu.execute(ikinci);
    assert.match(son(ikinci).content, /^⏳ Bu sunucuda şu an başka bir kaynak ekleniyor/);
    // Başka sunucu beklemez
    const baska = etkilesim({ sunucu: 'haber-2', alt: 'ekle', secenekler: { adres: 'baska.com' } });
    const baskaSuren = haberKomutu.execute(baska);
    await turBekle();
    assert.equal(bitir.length, 2);
    bitir[0]({ besleme: { ad: '[Örnek](https://kotu.example)' } });
    bitir[1]({ hata: 'Bu adreste bir haber beslemesi (RSS) bulamadım.' });
    await Promise.all([suren, baskaSuren]);
    // Kaynağın adı siteden gelir: cevapta gizli bağlantıya dönüşmez
    assert.equal(son(ilk).content, '✅ **[Örnek]\\(https://kotu.example)** takibe alındı. Bundan sonra yayınlanan haberler duyurulacak. Haberlerin gelmesi için `/haber kanal` ile bir kanal seç.');
    assert.equal(son(baska).content, '❌ Bu adreste bir haber beslemesi (RSS) bulamadım.');

    // Beklenmeyen hata genel bir mesajla söylenir, sıra serbest kalır
    ekle.mock.mockImplementation(async () => Promise.reject(new Error('EAI_AGAIN')));
    const hatali = etkilesim({ sunucu: 'haber-1', alt: 'ekle', secenekler: { adres: 'ornek.com' } });
    const asilHata = console.error;
    console.error = () => {};
    await haberKomutu.execute(hatali).finally(() => (console.error = asilHata));
    assert.equal(son(hatali).content, '❌ Kaynak eklenirken bir hata oluştu.');

    // Discord etkileşimi zaman aşımına uğrarsa (Unknown interaction) cevap ertelenemez;
    // sunucu, bot yeniden başlayana kadar kaynak ekleyemez hale gelmemeli
    const gec = etkilesim({ sunucu: 'haber-3', alt: 'ekle', secenekler: { adres: 'ornek.com' }, ertele: async () => Promise.reject(new Error('Unknown interaction')) });
    await assert.rejects(haberKomutu.execute(gec), /Unknown interaction/); // index.js bunu kayda yazar
    ekle.mock.mockImplementation(async () => ({ besleme: { ad: 'Örnek' } }));
    const sonra = etkilesim({ sunucu: 'haber-3', alt: 'ekle', secenekler: { adres: 'ornek.com' } });
    await haberKomutu.execute(sonra);
    assert.match(son(sonra).content, /^✅ \*\*Örnek\*\* takibe alındı/);
  } finally {
    ekle.mock.restore();
  }
});

test('/haber cikar ve liste: sıra numarası ya da adla çıkarılır; liste sınırı gösterir', async () => {
  const haberKomutu = komut('haber');
  depo.yaz('haber', {
    'haber-4': [
      { adres: 'https://ornek.com/rss', ad: 'Örnek Haber' },
      { adres: 'https://teknoloji.com/feed', ad: 'Teknoloji *Gündem*' },
      { adres: 'https://spor.com/rss.xml', ad: 'Spor' },
      { adres: 'https://kotu.example/rss', ad: 'x](https://kotu.example/tuzak) [Tuzak' },
    ],
  });
  const calistir = async (alt, secenekler) => {
    const e = etkilesim({ sunucu: 'haber-4', alt, secenekler });
    await haberKomutu.execute(e);
    return son(e);
  };
  const liste = (await calistir('liste')).embeds[0].data.fields[0];
  assert.equal(liste.name, `Kaynaklar · 4/${haber.SUNUCU_BASI_SINIR}`);
  assert.match(liste.value, /^\*\*1\.\*\* \[Örnek Haber\]\(https:\/\/ornek\.com\)/);
  assert.match(liste.value, /\[Teknoloji \\\*Gündem\\\*\]\(https:\/\/teknoloji\.com\)/);
  // Ad, etiketi erken kapatıp kendi adresine giden bir bağlantı kuramaz
  assert.ok(!liste.value.includes('](https://kotu.example/tuzak)'), liste.value);
  assert.match(liste.value, /\[x\]\\\(https:\/\/kotu\.example\/tuzak\) \[Tuzak\]\(https:\/\/kotu\.example\)$/);
  assert.match((await calistir('cikar', { kaynak: '4' })).content, /^✅ \*\*x\]\\\(https/);

  assert.match((await calistir('cikar', { kaynak: '9' })).content, /Listede böyle bir kaynak yok/);
  assert.equal((await calistir('cikar', { kaynak: '3' })).content, '✅ **Spor** takipten çıkarıldı.');
  assert.equal((await calistir('cikar', { kaynak: 'GÜNDEM' })).content, '✅ **Teknoloji \\*Gündem\\*** takipten çıkarıldı.');
  assert.deepEqual(haber.liste('haber-4').map((k) => k.ad), ['Örnek Haber']);
  assert.equal((await calistir('liste')).embeds[0].data.footer.text, 'Kaynaklar 10 dakikada bir kontrol edilir');
});

test('/instagram: bağlantı kurulmamışsa komut yüklenmez, ekleme reddedilir, liste uyarır', async () => {
  const instagramKomutu = komut('instagram');
  assert.equal(instagram.hazir(), false);
  assert.equal(instagramKomutu.etkin(), false, 'Discord\'a yüklenmez');

  const e = etkilesim({ sunucu: 'insta-1', alt: 'ekle', secenekler: { hesap: 'ornek' } });
  await instagramKomutu.execute(e);
  assert.match(son(e).content, /^❌ Instagram bağlantısı henüz kurulmamış/);
  assert.deepEqual(instagram.liste('insta-1'), []);

  const liste = etkilesim({ sunucu: 'insta-1', alt: 'liste' });
  await instagramKomutu.execute(liste);
  const kart = son(liste).embeds[0].data;
  assert.match(kart.description, /^⚠️ Instagram bağlantısı kurulmamış/);
  assert.equal(kart.fields[0].value, 'Henüz hesap eklenmemiş');
});

test('/instagram ekle, cikar ve test: hesap adı ya da profil adresiyle; deneme bildirimi etiketlemez', async () => {
  const instagramKomutu = komut('instagram');
  const ekle = mock.method(instagram, 'ekle', async () => ({ hesap: { ad: 'Örnek Hesap', giris: 'ornek' } }));
  try {
    const e = etkilesim({ sunucu: 'insta-2', alt: 'ekle', secenekler: { hesap: 'ornek' } });
    await instagramKomutu.execute(e);
    assert.match(son(e).content, /^✅ \*\*Örnek Hesap\*\* \(@ornek\) takibe alındı\. .*`\/instagram kanal`/);
    ekle.mock.mockImplementation(async () => Promise.reject(new Error('ECONNRESET')));
    const hata = etkilesim({ sunucu: 'insta-2', alt: 'ekle', secenekler: { hesap: 'ornek' } });
    const asilHata = console.error;
    console.error = () => {};
    await instagramKomutu.execute(hata).finally(() => (console.error = asilHata));
    assert.match(son(hata).content, /^❌ Eklenemedi: Instagram'a ulaşılamadı/);
  } finally {
    ekle.mock.restore();
  }

  depo.yaz('instagram', { 'insta-2': [{ giris: 'ornek', ad: 'Örnek Hesap' }, { giris: 'tuzak', ad: 'x](https://kotu.example) [y' }] });
  const liste = etkilesim({ sunucu: 'insta-2', alt: 'liste' });
  await instagramKomutu.execute(liste);
  // Profil adı serbest metin: listede etiketi kapatıp başka adrese bağlantı kuramaz
  assert.equal(
    son(liste).embeds[0].data.fields[0].value,
    '[Örnek Hesap](https://www.instagram.com/ornek/) · [x]\\(https://kotu.example) [y](https://www.instagram.com/tuzak/)',
  );
  const cikar = async (hesap) => {
    const e = etkilesim({ sunucu: 'insta-2', alt: 'cikar', secenekler: { hesap } });
    await instagramKomutu.execute(e);
    return son(e).content;
  };
  assert.match(await cikar('baska'), /Listede böyle bir hesap yok/);
  assert.equal(await cikar('https://www.instagram.com/ornek/'), '✅ **Örnek Hesap** (@ornek) takipten çıkarıldı.');

  const kanal = sahteKanal('insta');
  depo.ayarKaydet('insta-2', 'instagramKanali', 'insta');
  depo.ayarKaydet('insta-2', 'instagramRol', 'takipci');
  const test_ = etkilesim({ sunucu: 'insta-2', alt: 'test', kanallar: { insta: kanal } });
  await instagramKomutu.execute(test_);
  assert.equal(son(test_).content, '✅ <#insta> kanalına deneme bildirimi gönderildi.');
  assert.deepEqual(kanal.gonderilen[0].allowedMentions, { parse: [] }, 'deneme bildirimi seçili rolü etiketlemez');
});
