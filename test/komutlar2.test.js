// Sunucu günlüğü (gunluk.js), /ayarla, acil durum kilidi (/kilit), bildirim komutlarının (/oyun,
// /yayin, /haber, /instagram), /koruma, /uyari ve /seviye ayar alt komutlarının testleri. Çalıştırmak için: npm test
//
// komutlar.test.js'teki gibi: bot başlatılmaz, Discord'a bağlanılmaz. Komutlar sahte (elle yazılmış)
// Discord nesneleriyle çalıştırılır. Veri geçici bir klasöre yazılır; hiçbir test ağa çıkmaz.
const { test, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const VERI = fs.mkdtempSync(path.join(os.tmpdir(), 'voyager-komut2-'));
process.env.VERI_KLASORU = VERI;
// Yapay zekâ ve bildirim platformlarının bağlantısı bilerek kurulmaz: "kurulu değil" davranışı
// denenir, hiçbir istek dışarıya çıkmaz
for (const ad of [
  'GEMINI_API_KEY', 'GEMINI_MODEL', 'TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'KICK_CLIENT_ID', 'KICK_CLIENT_SECRET',
  'YOUTUBE_API_KEY', 'YAYIN_ADRESI', 'META_APP_ID', 'META_APP_SECRET', 'INSTAGRAM_TOKEN',
]) delete process.env[ad];
after(() => fs.rmSync(VERI, { recursive: true, force: true }));

const {
  AuditLogEvent, ChannelType, Collection, Events, GatewayIntentBits, IntentsBitField, MessageFlags, OverwriteType,
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
    type: ChannelType.GuildText,
    gonderilen,
    guild: { members: { me: { id: 'bot' } } },
    toString: () => `<#${id}>`,
    isThread: () => false,
    isTextBased: () => true,
    permissionsFor: () => izinli(...izinler),
    send: async (m) => gonderilen.push(m),
  };
}

// Alt komutlu komut etkileşimi sahtesi. secenekler: seçenek adı → değer.
// Cevaplar cevaplar[]'a düşer; ilk cevabın gizli (yalnızca komutu kullanana görünür) olup olmadığı da tutulur.
// kanal: komutun yazıldığı kanal. odak: öneri isteğinde yazılmakta olan metin.
function etkilesim({ sunucu = 'g', alt, secenekler = {}, izinler = [P.ManageGuild], botIzinleri = [], kanallar = {}, intents = [], ertele, kanal = null, odak = '' } = {}) {
  const cevaplar = [];
  const guild = {
    id: sunucu,
    ownerId: 'sahip',
    members: { me: { id: 'bot', permissions: izinli(...botIzinleri), roles: { highest: { position: 10 } } } },
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
    channel: kanal,
    user: kullanici('mod'),
    member: { permissions: izinli(...izinler), roles: { highest: { position: 5 } } },
    memberPermissions: izinli(...izinler),
    options: {
      getSubcommand: () => alt,
      getChannel: (ad) => secenekler[ad] ?? null,
      getUser: (ad) => secenekler[ad] ?? null,
      getRole: (ad) => secenekler[ad] ?? null,
      getString: (ad) => secenekler[ad] ?? null,
      getInteger: (ad) => secenekler[ad] ?? null,
      getBoolean: (ad) => secenekler[ad] ?? null,
      getFocused: () => odak,
    },
    respond: async (oneriler) => cevaplar.push({ oneriler }),
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
  await gunluk.olaylar.uyeKatildi(uye); // Hata fırlatılmaz
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

  // Yalnızca rol alındıysa boş bir "Verilen" alanı eklenmez
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
    istemci.emit(Events.GuildMemberAdd, { guild: { id: 'gunluk-9' } }); // user alanı yok: dinleyicide TypeError oluşur
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
// Komutu çalıştırır, son cevabı döndürür
async function calistir(ad, ayarlar) {
  const e = etkilesim(ayarlar);
  await komut(ad).execute(e);
  return son(e);
}
const kartAlani = (cevap, ad) => cevap.embeds[0].data.fields.find((a) => a.name === ad)?.value;

test('/ayarla gunluk ve hosgeldin: bot yazamadığı kanalı kabul etmez; seçeneksiz ayarları gösterir', async () => {
  // Günlük kart (embed) gönderir; Bağlantı Yerleştir izni olmadan kart görünmez
  const kartsiz = sahteKanal('kartsiz', [P.ViewChannel, P.SendMessages]);
  const red = await calistir('ayarla', { sunucu: 'ayar-1', alt: 'gunluk', secenekler: { kanal: kartsiz } });
  assert.match(red.content, /^❌ <#kartsiz> kanalına yazamıyorum.*Bağlantı Yerleştir/);
  assert.equal(red.flags, MessageFlags.Ephemeral);
  assert.equal(ayar('ayar-1').logKanali, undefined);

  const kabul = await calistir('ayarla', { sunucu: 'ayar-1', alt: 'gunluk', secenekler: { kanal: sahteKanal('log') } });
  assert.equal(kabul.content, '✅ Günlük kanalı <#log> olarak ayarlandı.');
  assert.equal(kartAlani(kabul, 'Günlük kanalı'), '<#log>', 'cevapta güncel ayarlar da görünür');
  assert.equal(ayar('ayar-1').logKanali, 'log');

  // Hoş geldin mesajı düz metindir: Bağlantı Yerleştir gerekmez, görme ve yazma gerekir
  await calistir('ayarla', { sunucu: 'ayar-1', alt: 'hosgeldin', secenekler: { kanal: kartsiz } });
  assert.equal(ayar('ayar-1').hosgeldinKanali, 'kartsiz');
  const gorunmez = await calistir('ayarla', { sunucu: 'ayar-1', alt: 'hosgeldin', secenekler: { kanal: sahteKanal('gizli', [P.SendMessages]) } });
  assert.match(gorunmez.content, /^❌/);
  assert.equal(ayar('ayar-1').hosgeldinKanali, 'kartsiz');

  // Seçeneksiz: yalnızca ayarlar
  const goster = await calistir('ayarla', { sunucu: 'ayar-1', alt: 'hosgeldin' });
  assert.equal(goster.content, undefined);
  assert.equal(kartAlani(goster, 'Hoş geldin kanalı'), '<#kartsiz>');
});

test('/ayarla hosgeldin oto-rol: komutu kullanan rolü verebiliyor olmalı; hatalı seçenekte hiçbir şey kaydedilmez', async () => {
  const uyeRolu = rol('uye', { managed: false, position: 3, permissions: izinli() });
  const yetkisiz = await calistir('ayarla', { sunucu: 'ayar-oto', alt: 'hosgeldin', izinler: [P.ManageGuild], secenekler: { 'oto-rol': uyeRolu, kanal: sahteKanal('hg') } });
  assert.match(yetkisiz.content, /^❌/);
  assert.equal(ayar('ayar-oto').hosgeldinKanali, undefined, 'rol reddedilince kanal da kaydedilmez');

  const kabul = await calistir('ayarla', { sunucu: 'ayar-oto', alt: 'hosgeldin', izinler: [P.ManageGuild, P.ManageRoles], secenekler: { 'oto-rol': uyeRolu, kanal: sahteKanal('hg') } });
  assert.equal(kabul.content, '✅ Hoş geldin kanalı <#hg> olarak ayarlandı.\n✅ Yeni üyelere <@&uye> rolü verilecek.');
  assert.deepEqual([ayar('ayar-oto').hosgeldinKanali, ayar('ayar-oto').otoRol], ['hg', 'uye']);
});

test('/ayarla gunluk kategori: tek kategori ya da hepsi açılıp kapanır; günlük buna uyar', async () => {
  const kategori = async (secenekler, sunucu = 'ayar-2') => (await calistir('ayarla', { sunucu, alt: 'gunluk', secenekler })).content;
  // Kanal seçilmeden açılırsa kayıtların neden gelmediği söylenir
  assert.match(await kategori({ kategori: 'ses', durum: 'acik' }, 'ayar-2b'), /`\/ayarla gunluk kanal:` ile bir kanal seç/);
  assert.match(await kategori({ kategori: 'ses' }), /^❌ .*`durum`/, 'durumsuz kategori');

  const { guild, giden } = gunlukSunucusu('ayar-2');
  assert.equal(await kategori({ kategori: 'mesajlar', durum: 'kapali' }), '✅ Mesajlar (silinen ve düzenlenen mesajlar): kapalı.');
  assert.deepEqual(ayar('ayar-2').logKategorileri, { mesajlar: false });
  await gunluk.olaylar.mesajSilindi({ guild, author: kullanici('a'), channel: '<#genel>', content: 'gizli' });
  await gunluk.olaylar.uyeKatildi({ guild, user: kullanici('a') });
  assert.deepEqual(giden.map(baslik), ['Üye katıldı']);

  // Kategori seçilmezse durum hepsine uygulanır
  assert.equal(await kategori({ durum: 'kapali' }), '✅ Tüm kategoriler: kapalı.');
  assert.ok(Object.keys(gunluk.KATEGORILER).every((k) => !gunluk.kategoriAcik(ayar('ayar-2'), k)));
  assert.doesNotMatch(await kategori({ kategori: 'hepsi', durum: 'acik' }), /gunluk kanal/, 'kanal seçiliyken uyarı yok');
  assert.ok(Object.keys(gunluk.KATEGORILER).every((k) => gunluk.kategoriAcik(ayar('ayar-2'), k)));
});

test('/ayarla sifirla: seçilen ayar kaldırılır, diğerleri kalır', async () => {
  for (const [anahtar, deger] of [['logKanali', 'l'], ['hosgeldinKanali', 'h'], ['otoRol', 'r']]) depo.ayarKaydet('ayar-3', anahtar, deger);
  for (const [secim, anahtar] of [['log-kanali', 'logKanali'], ['hosgeldin-kanali', 'hosgeldinKanali'], ['oto-rol', 'otoRol']]) {
    const cevap = await calistir('ayarla', { sunucu: 'ayar-3', alt: 'sifirla', secenekler: { ayar: secim } });
    assert.equal(cevap.content, `✅ ${secim} ayarı kaldırıldı.`);
    assert.equal(ayar('ayar-3')[anahtar], null);
  }
});

test('/ayarla ozet: yapay zekâ kurulu değilse ya da mesaj içeriği okunamıyorsa açılmaz', async () => {
  const yapayzeka = src('yapayzeka');
  const ozet = async (durum, intents = [GatewayIntentBits.MessageContent]) => (await calistir('ayarla', { sunucu: 'ayar-4', alt: 'ozet', secenekler: { durum }, intents })).content;
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
  // Kapatmak her zaman serbesttir
  assert.equal(await ozet('kapali', []), '✅ Özetleme kapatıldı.');
  assert.equal(ayar('ayar-4').ozetAcik, false);
});

test('/ayarla goster: ayarlar ve günlük kategorileri gizli kartla gösterilir', async () => {
  const bos = await calistir('ayarla', { sunucu: 'ayar-5', alt: 'goster' });
  assert.equal(bos.flags, MessageFlags.Ephemeral);
  assert.equal(kartAlani(bos, 'Günlük kanalı'), 'Ayarlanmadı');
  assert.equal(kartAlani(bos, 'Kanal özetleri (/ozetle)'), '⚫ Kapalı');
  assert.ok(kartAlani(bos, 'Günlük kategorileri').split('\n').every((s) => s.startsWith('🟢')));

  depo.ayarKaydet('ayar-5', 'logKanali', 'l');
  depo.ayarKaydet('ayar-5', 'otoRol', 'r');
  depo.ayarKaydet('ayar-5', 'logKategorileri', { ses: false });
  const dolu = await calistir('ayarla', { sunucu: 'ayar-5', alt: 'goster' });
  assert.equal(kartAlani(dolu, 'Günlük kanalı'), '<#l>');
  assert.equal(kartAlani(dolu, 'Oto rol'), '<@&r>');
  assert.match(kartAlani(dolu, 'Günlük kategorileri'), /⚫ Ses kanalları/);
  assert.match(kartAlani(dolu, 'Günlük kategorileri'), /🟢 Moderasyon/);
});

// --- Acil durum kilidi: /kilit kapat ve /kilit ac ---
// İzin satırları listesini karşılaştırılabilir hale getirir
const satirlar = (kanal) =>
  [...kanal.permissionOverwrites.cache.values()]
    .map((i) => ({ id: i.id, type: i.type, allow: i.allow.bitfield, deny: i.deny.bitfield }))
    .sort((a, b) => a.id.localeCompare(b.id));

// Sahte kanal: permissionOverwrites.set, Discord'daki gibi listenin tamamını yazar. hatalar: set'in sırayla fırlatacağı hatalar
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

// /kilit kapat ya da /kilit ac etkileşimi
const kilitEtkilesimi = (guild, alt) => ({ ...etkilesim({ sunucu: guild.id, alt }), guild, user: kullanici('yonetici') });
// kilit.js her işlemde konsola bir özet yazar; test çıktısını kirletmesin
async function sessizce(islem) {
  const [log, hata] = [console.log, console.error];
  console.log = console.error = () => {};
  try {
    return await islem();
  } finally {
    [console.log, console.error] = [log, hata];
  }
}
const kilitKomutu = komut('kilit');

test('/kilit kapat ve ac: kanallar kilitlenir, kilit açılınca izinler aynen geri gelir', async () => {
  const kilit = src('kilit');
  const { guild, kanallar, sesteki, gunlukKaydi } = kilitSunucusu('kilit-a');
  const once = Object.fromEntries(Object.entries(kanallar).map(([ad, k]) => [ad, satirlar(k)]));

  const acik = kilitEtkilesimi(guild, 'ac');
  await kilitKomutu.execute(acik);
  assert.equal(son(acik).content, '🔓 Sunucu kilitli değil.');

  const e = kilitEtkilesimi(guild, 'kapat');
  await sessizce(() => kilitKomutu.execute(e));
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

  const tekrar = kilitEtkilesimi(guild, 'kapat');
  await kilitKomutu.execute(tekrar);
  assert.equal(son(tekrar).content, '🔒 Sunucu zaten kilitli. Açmak için `/kilit ac` kullan.');

  const ac = kilitEtkilesimi(guild, 'ac');
  await sessizce(() => kilitKomutu.execute(ac));
  assert.equal(son(ac).content, '🔓 Kilit açıldı: 3 kanal kilitten önceki izinlerine döndü.');
  for (const [ad, kanal] of Object.entries(kanallar)) assert.deepEqual(satirlar(kanal), once[ad], ad);
  assert.equal(kilit.kilitli(guild.id), false);
  assert.equal(depo.oku('kilit', {})[guild.id], undefined, 'yedek silinir');
  assert.equal(baslik(gunlukKaydi[1]), '🔓 Sunucunun kilidi açıldı');
});

test('/kilit kapat: bot izinleri yetmiyorsa hiçbir kanala dokunulmaz', async () => {
  const { guild, kanallar } = kilitSunucusu('kilit-b', { botIzinleri: [P.ManageChannels] });
  const once = satirlar(kanallar.genel);
  const e = kilitEtkilesimi(guild, 'kapat');
  await kilitKomutu.execute(e);
  assert.match(son(e).content, /Rolleri Yönet.*Kanalları Yönet/);
  assert.deepEqual(satirlar(kanallar.genel), once);
  assert.equal(src('kilit').kilitli(guild.id), false);
});

test('/kilit kapat: aynı anda iki kez çalıştırılırsa ikincisi beklemesini söyler', async () => {
  const { guild } = kilitSunucusu('kilit-c');
  const [ilk, ikinci] = [kilitEtkilesimi(guild, 'kapat'), kilitEtkilesimi(guild, 'kapat')];
  await sessizce(() => Promise.all([kilitKomutu.execute(ilk), kilitKomutu.execute(ikinci)]));
  assert.ok(son(ilk).embeds, 'ilki kilitler');
  assert.match(son(ikinci).content, /^⏳/);
  await sessizce(() => kilitKomutu.execute(kilitEtkilesimi(guild, 'ac')));
});

test('/kilit ac: açılamayan kanal kalırsa sunucu kilitli sayılır, yeniden çalıştırınca kalanlar açılır', async () => {
  const yetkiYok = Object.assign(new Error('Missing Permissions'), { code: 50013 });
  // genel kanalın 1. set çağrısı (kilitleme) başarılı olur, 2. çağrısı (açma) reddedilir
  const { guild, kanallar } = kilitSunucusu('kilit-d', { hatalar: [null, yetkiYok] });
  const once = Object.fromEntries(Object.entries(kanallar).map(([ad, k]) => [ad, satirlar(k)]));
  await sessizce(() => kilitKomutu.execute(kilitEtkilesimi(guild, 'kapat')));

  // Kilit sırasında bir rol ve bir kanal silindi: geri yüklenemezler, işlemi de bozmazlar
  guild.roles.cache.delete('uyeler');
  guild.channels.cache.delete('ses');

  const ilk = kilitEtkilesimi(guild, 'ac');
  await sessizce(() => kilitKomutu.execute(ilk));
  assert.equal(son(ilk).content, '⚠️ 1 kanal eski haline döndü, **1 kanal açılamadı** (Yetkim yetmedi (1 kanal)). Sunucu hâlâ kilitli sayılıyor; `/kilit ac` komutunu yeniden çalıştır.');
  assert.equal(src('kilit').kilitli(guild.id), true);
  assert.deepEqual(Object.keys(depo.oku('kilit', {})[guild.id]), ['genel'], 'yalnızca açılamayanın yedeği kalır');
  assert.deepEqual(satirlar(kanallar.kategori), once.kategori);

  const ikinci = kilitEtkilesimi(guild, 'ac');
  await sessizce(() => kilitKomutu.execute(ikinci));
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
// Konsola hata yazan işlemler test çıktısını kirletmesin
async function hatasiz(islem) {
  const asil = console.error;
  console.error = () => {};
  try {
    return await islem();
  } finally {
    console.error = asil;
  }
}

test('bildirim komutları: ayar seçeneksiz yalnızca ayarları gösterir; kanal yalnızca bot kart gönderebiliyorsa kaydedilir', async () => {
  for (const { ad, kanalAyari } of BILDIRIM_KOMUTLARI) {
    const sunucu = `kanal-${ad}`;
    const goster = await calistir(ad, { sunucu, alt: 'ayar' });
    assert.equal(goster.content, undefined, ad);
    assert.match(goster.embeds[0].data.description, /ayarlanmadı \(bildirimler kapalı\)/, ad);
    assert.equal(goster.flags, MessageFlags.Ephemeral, ad);

    const kartsiz = await calistir(ad, { sunucu, alt: 'ayar', secenekler: { kanal: sahteKanal('k', [P.ViewChannel, P.SendMessages]) } });
    assert.match(kartsiz.content, /^❌ <#k> kanalına yazamıyorum/, ad);
    assert.equal(ayar(sunucu)[kanalAyari], undefined, ad);

    const kabul = await calistir(ad, { sunucu, alt: 'ayar', secenekler: { kanal: sahteKanal('k') } });
    assert.match(kabul.content, /^✅ .* <#k> kanalına gönderilecek\./, ad);
    assert.match(kabul.embeds[0].data.description, /\*\*Kanal:\*\* <#k>/, `${ad}: cevapta güncel ayarlar`);
    assert.equal(ayar(sunucu)[kanalAyari], 'k', ad);

    const celiski = await calistir(ad, { sunucu, alt: 'ayar', secenekler: { kanal: sahteKanal('k2'), kaldir: 'kanal' } });
    assert.match(celiski.content, /^❌ Aynı anda/, ad);
    assert.equal(ayar(sunucu)[kanalAyari], 'k', ad);

    const kapat = await calistir(ad, { sunucu, alt: 'ayar', secenekler: { kaldir: 'kanal' } });
    assert.match(kapat.content, /^✅ .*kapatıldı/, ad);
    assert.equal(ayar(sunucu)[kanalAyari], null, ad);
  }
});

test('bildirim komutları: rolü yalnızca etiketleyebilen seçer; @everyone seçilemez; bot etiketleyemiyorsa uyarılır', async () => {
  for (const { ad, rolAyari } of BILDIRIM_KOMUTLARI) {
    const sunucu = `rol-${ad}`;
    const rolSec = async (secenekler, { izinler = [P.ManageGuild], botIzinleri = [] } = {}) =>
      (await calistir(ad, { sunucu, alt: 'ayar', secenekler, izinler, botIzinleri })).content;

    assert.match(await rolSec({ rol: rol(sunucu, { mentionable: true }) }), /@everyone seçilemez/, ad);
    assert.match(await rolSec({ rol: rol('gizli') }), /etiketleme yetkin yok/, ad);
    assert.equal(ayar(sunucu)[rolAyari], undefined, `${ad}: etiketleyemediği rol kaydedilmez`);

    assert.equal(await rolSec({ rol: rol('acik', { mentionable: true }) }), '✅ Bildirimlerde <@&acik> etiketlenecek.', ad);
    assert.equal(ayar(sunucu)[rolAyari], 'acik', ad);

    // Herkesi etiketleyebilen yetkili kapalı rolü seçebilir; bot etiketleyemiyorsa bildirim gitmeyeceği söylenir
    assert.match(await rolSec({ rol: rol('kapali') }, { izinler: [P.ManageGuild, P.MentionEveryone] }), /^⚠️ <@&kapali> kaydedildi ama bildirim gitmeyecek/, ad);
    assert.equal(ayar(sunucu)[rolAyari], 'kapali', ad);
    assert.match(await rolSec({ rol: rol('kapali') }, { izinler: [P.MentionEveryone], botIzinleri: [P.MentionEveryone] }), /^✅/, ad);

    assert.match(await rolSec({ rol: rol('x', { mentionable: true }), kaldir: 'rol' }), /^❌ Aynı anda/, ad);
    assert.equal(await rolSec({ kaldir: 'rol' }), '✅ Bildirimlerde artık rol etiketlenmeyecek.', ad);
    assert.equal(ayar(sunucu)[rolAyari], null, ad);
  }
});

test('/oyun ayar: yalnızca verilen seçenekler değişir, gerisi varsayılan kalır', async () => {
  const oyunAyar = async (secenekler) => (await calistir('oyun', { sunucu: 'oyun-1', alt: 'ayar', secenekler })).content;
  assert.equal(await oyunAyar({ bedava: 'acik', 'bedava-magaza': 'epic' }), '✅ Bedava oyun bildirimleri açık. Mağaza: Epic Games.');
  // Mağaza seçilmezse önceki seçim kalır
  assert.equal(await oyunAyar({ bedava: 'kapali' }), '✅ Bedava oyun bildirimleri kapalı.');
  assert.equal(await oyunAyar({ 'indirim-magaza': 'gog', 'en-az-yuzde': 75 }), '✅ İndirim bildirimleri açık. Mağaza: GOG. En az indirim: %75.');
  assert.deepEqual(
    (({ bedava, magaza, indirim, indirimMagaza, yuzde, everyone }) => ({ bedava, magaza, indirim, indirimMagaza, yuzde, everyone }))(firsatlar.ayarCoz(ayar('oyun-1'))),
    { bedava: false, magaza: 'epic', indirim: true, indirimMagaza: 'gog', yuzde: 75, everyone: false },
  );

  // Kanal ilk kez seçilince mevcut fırsatlar için /oyun simdi önerilir; sonraki seçimlerde değil
  const ilk = await oyunAyar({ kanal: sahteKanal('firsat') });
  assert.match(ilk, /`\/oyun simdi`/);
  assert.doesNotMatch(await oyunAyar({ kanal: sahteKanal('firsat2') }), /oyun simdi/);

  // Kart güncel durumu gösterir
  const kart = (await calistir('oyun', { sunucu: 'oyun-1', alt: 'ayar' })).embeds[0].data;
  assert.equal(kart.fields[0].value, '⚫ Kapalı');
  assert.equal(kart.fields[1].value, '🟢 Açık\nGOG\nEn az %75');
});

test('/oyun ayar everyone: bot o kanalda @everyone atamıyorsa uyarılır', async () => {
  const everyone = async (durum, { kanalIzinleri, botIzinleri = [] } = {}) => {
    const kanallar = kanalIzinleri ? { firsat: sahteKanal('firsat', kanalIzinleri) } : {};
    depo.ayarKaydet('oyun-2', 'oyunKanali', kanalIzinleri ? 'firsat' : null);
    return (await calistir('oyun', { sunucu: 'oyun-2', alt: 'ayar', secenekler: { everyone: durum }, kanallar, botIzinleri })).content;
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

test('/oyun simdi: kanal ister, sunucu başına 5 dakikada bir çalışır', async () => {
  const gonder = mock.method(firsatlar, 'simdiGonder', async () => ({ bedava: 2, indirim: 0 }));
  mock.timers.enable({ apis: ['Date'], now: 5_000_000 });
  try {
    const simdi = async () => (await calistir('oyun', { sunucu: 'oyun-3', alt: 'simdi' })).content;
    assert.equal(await simdi(), '❌ Önce `/oyun ayar kanal:` ile bir kanal seç.');
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
});

test('/yayin: bağlantısı kurulmamış platform eklenmez, ayar kartı bunu gösterir', async () => {
  for (const platform of Object.keys(yayin.PLATFORMLAR)) {
    assert.equal(yayin.PLATFORMLAR[platform].hazir(), false, platform);
    const e = etkilesim({ sunucu: 'yayin-1', alt: 'ekle', secenekler: { platform, yayinci: 'deneme' } });
    await komut('yayin').execute(e);
    assert.equal(e.cevaplar[0].ertelendi, true, 'platforma sorulacağı için önce ertelenir');
    assert.match(son(e).content, /^❌ .*bağlantısı henüz kurulmamış/, platform);
  }
  assert.deepEqual(yayin.liste('yayin-1'), []);

  const kart = (await calistir('yayin', { sunucu: 'yayin-1', alt: 'ayar' })).embeds[0].data;
  assert.ok(kart.fields.every((a) => a.value === '⚠️ Bağlantı kurulmamış'));
});

// Sahte ekleme: kaydı gerçekten listeye yazar (rol ataması ve kanal varsayımı bunun üstünde çalışır)
function yayinEkleSahtesi(sonuc) {
  return mock.method(yayin, 'ekle', async (sunucuId, platform) => {
    if (sonuc instanceof Error) throw sonuc;
    if (sonuc.yayinci) {
      const hepsi = depo.oku('yayincilar', {});
      (hepsi[sunucuId] ??= []).push({ platform, ...sonuc.yayinci });
      depo.yaz('yayincilar', hepsi);
    }
    return sonuc;
  });
}

test('/yayin ekle: platform hatası genel bir mesajla söylenir; kanal seçilmemişse komutun yazıldığı kanal varsayılır', async () => {
  const ekle = async (sonuc, ek = {}) => {
    const sahte = yayinEkleSahtesi(sonuc);
    try {
      return (await hatasiz(() => calistir('yayin', { sunucu: 'yayin-2', alt: 'ekle', secenekler: { platform: 'twitch', yayinci: 'deneme', ...ek.secenekler }, ...ek }))).content;
    } finally {
      sahte.mock.restore();
    }
  };
  assert.match(await ekle(new Error('ETIMEDOUT')), /^❌ Eklenemedi: platforma ulaşılamadı/);
  assert.equal(await ekle({ hata: 'Twitch üzerinde "x" adında bir kanal bulamadım.' }), '❌ Twitch üzerinde "x" adında bir kanal bulamadım.');

  // Bot o kanala yazamıyorsa varsayılmaz, nasıl seçileceği söylenir
  const yazamaz = await ekle({ yayinci: { id: '1', giris: 'bir', ad: 'Bir' } }, { kanal: sahteKanal('sohbet', [P.ViewChannel]) });
  assert.match(yazamaz, /`\/yayin ayar kanal:` ile bir kanal seç/);
  assert.equal(ayar('yayin-2').yayinKanali, undefined);

  const varsayilan = await ekle({ yayinci: { id: '2', giris: 'iki', ad: 'İki' } }, { kanal: sahteKanal('yayinlar') });
  assert.match(varsayilan, /^✅ \*\*İki\*\* \(Twitch\) takibe alındı\.\nℹ️ .*bu kanala \(<#yayinlar>\) gelecek/);
  assert.equal(ayar('yayin-2').yayinKanali, 'yayinlar');
  // Kanal seçiliyken başka kanalda eklemek kanalı değiştirmez
  assert.equal(await ekle({ yayinci: { id: '3', giris: 'uc', ad: 'Üç' } }, { kanal: sahteKanal('baska') }), '✅ **Üç** (Twitch) takibe alındı.');
  assert.equal(ayar('yayin-2').yayinKanali, 'yayinlar');

  // Kanal adı platformdan gelir (YouTube'da serbest metin): biçimlendirme ve gizli bağlantı oluşturmaz
  assert.equal(await ekle({ yayinci: { id: '4', giris: 'dort', ad: '[tıkla](https://kotu.example) **' } }), '✅ **[tıkla]\\(https://kotu.example) \\*\\*** (Twitch) takibe alındı.');
});

test('/yayin: yayıncı başına rol; ekle ile verilir, ayar ile değişir; aynı ad iki platformdaysa platform sorulur', async () => {
  const sunucu = 'yayin-3';
  depo.ayarKaydet(sunucu, 'yayinKanali', 'yayinlar');
  depo.ayarKaydet(sunucu, 'yayinRol', 'genel');
  const sahte = yayinEkleSahtesi({ yayinci: { id: 'k1', giris: 'ornek', ad: 'Örnek' } });
  try {
    // Etiketleyemediği rol, platforma sorulmadan reddedilir
    const red = etkilesim({ sunucu, alt: 'ekle', secenekler: { platform: 'kick', yayinci: 'ornek', rol: rol('gizli') } });
    await komut('yayin').execute(red);
    assert.match(son(red).content, /etiketleme yetkin yok/);
    assert.equal(sahte.mock.callCount(), 0);

    const e = await calistir('yayin', { sunucu, alt: 'ekle', secenekler: { platform: 'kick', yayinci: 'ornek', rol: rol('kick-hayran', { mentionable: true }) } });
    assert.equal(e.content, '✅ **Örnek** (Kick) takibe alındı.\nYayına geçince <@&kick-hayran> etiketlenecek.');
    assert.equal(yayin.liste(sunucu)[0].rol, 'kick-hayran');
  } finally {
    sahte.mock.restore();
  }
  // Aynı kanal adı Twitch'te de takip ediliyor
  const hepsi = depo.oku('yayincilar', {});
  hepsi[sunucu].push({ platform: 'twitch', id: 't1', giris: 'ornek', ad: 'Örnek' });
  depo.yaz('yayincilar', hepsi);

  const rolVer = async (secenekler) => (await calistir('yayin', { sunucu, alt: 'ayar', secenekler })).content;
  assert.match(await rolVer({ yayinci: 'ornek', rol: rol('r', { mentionable: true }) }), /birden fazla platformda var/);
  assert.equal(await rolVer({ yayinci: 'ornek', platform: 'twitch', rol: rol('twitch-hayran', { mentionable: true }) }), '✅ **Örnek** (Twitch) yayına geçince <@&twitch-hayran> etiketlenecek.');
  // Öneriden gelen "platform:kimlik" değeri tek kaydı bulur
  assert.equal(await rolVer({ yayinci: 'kick:k1', kaldir: 'rol' }), '✅ **Örnek** (Kick) artık genel yayın rolünü kullanacak.');
  assert.deepEqual(yayin.liste(sunucu).map((y) => y.rol), [undefined, 'twitch-hayran']);
  assert.match(await rolVer({ yayinci: 'kick:k1', kanal: sahteKanal('x') }), /yalnızca o yayıncının rolü/);
  assert.match(await rolVer({ yayinci: 'yok' , rol: rol('r', { mentionable: true }) }), /Listede böyle bir yayıncı yok/);

  // Kart: kendi rolü olan yayıncı oklu gösterilir
  const kart = (await calistir('yayin', { sunucu, alt: 'ayar' })).embeds[0].data;
  assert.match(kart.fields.find((a) => a.name.includes('Twitch')).value, /\[Örnek\]\(https:\/\/www\.twitch\.tv\/ornek\) → <@&twitch-hayran>/);
  assert.match(kart.description, /\*\*Etiketlenecek rol:\*\* <@&genel>/);

  // Öneriler: takip edilenler, değer platform:kimlik
  const oneri = etkilesim({ sunucu, odak: 'ÖRN' });
  await komut('yayin').autocomplete(oneri);
  assert.deepEqual(son(oneri).oneriler.map((o) => o.value), ['kick:k1', 'twitch:t1']);

  // Çıkarma: platform belirsizse sorulur; platformla çıkarılınca abonelik eşitlenir
  const esitle = mock.method(yayin, 'esitle', async () => {});
  try {
    assert.match((await calistir('yayin', { sunucu, alt: 'cikar', secenekler: { yayinci: 'ornek' } })).content, /birden fazla platformda var/);
    assert.equal((await calistir('yayin', { sunucu, alt: 'cikar', secenekler: { yayinci: 'https://kick.com/ornek', platform: 'kick' } })).content, '✅ **Örnek** (Kick) takipten çıkarıldı.');
    assert.deepEqual(esitle.mock.calls.map((c) => c.arguments), [['kick']]);
    assert.deepEqual(yayin.liste(sunucu).map((y) => y.platform), ['twitch']);
  } finally {
    esitle.mock.restore();
  }
});

test('/yayin ayar test: deneme bildirimi kimseyi etiketlemez; uzun liste kısaltılır', async () => {
  const deneme = async (kanallar) => (await calistir('yayin', { sunucu: 'yayin-4', alt: 'ayar', secenekler: { test: true }, kanallar })).content;
  assert.match(await deneme({}), /önce bir kanal seç/);
  depo.ayarKaydet('yayin-4', 'yayinKanali', 'bildirim');
  assert.match(await deneme({}), /Bildirim kanalı bulunamadı/);
  const kanal = sahteKanal('bildirim');
  depo.ayarKaydet('yayin-4', 'yayinRol', 'herkes-rolu');
  assert.equal(await deneme({ bildirim: kanal }), '✅ <#bildirim> kanalına deneme bildirimi gönderildi (kimse etiketlenmedi).');
  assert.equal(kanal.gonderilen.length, 1);
  assert.deepEqual(kanal.gonderilen[0].allowedMentions, { parse: [] });

  // 50 Twitch yayıncısı: kart alanı 1024 karakteri aşmaz, sığmayanların yalnızca sayısı yazılır. Adlar biçimlendirme taşımaz.
  depo.yaz('yayincilar', {
    'yayin-4': [
      ...Array.from({ length: 50 }, (_, i) => ({ platform: 'twitch', id: String(i), giris: `yayinci_${i}`, ad: `*Yayıncı ${i}*` })),
      { platform: 'youtube', id: 'UC1', giris: 'tuzak', ad: 'x](https://kotu.example) [y' },
    ],
  });
  const kart = (await calistir('yayin', { sunucu: 'yayin-4', alt: 'ayar' })).embeds[0].data;
  const twitch = kart.fields[0];
  assert.equal(twitch.name, '🟣 Twitch · 50');
  assert.ok(twitch.value.length <= 1024, `${twitch.value.length} karakter`);
  assert.match(twitch.value, / · \+\d+ daha$/);
  assert.match(twitch.value, /\[\\\*Yayıncı 0\\\*\]\(https:\/\/www\.twitch\.tv\/yayinci_0\)/);
  assert.equal(kart.footer.text, '51 yayıncı takip ediliyor · Değiştirmek için: /yayin ayar');
  const youtube = kart.fields.find((a) => a.name.includes('YouTube'));
  assert.equal(youtube.value, '⚠️ Bağlantı kurulmamış\n[x]\\(https://kotu.example) [y](https://www.youtube.com/channel/UC1)');
});

// Sahte ekleme: kaynağı gerçekten listeye yazar
function haberEkleSahtesi(uygulama) {
  return mock.method(haber, 'ekle', async (sunucuId, adres) => {
    const sonuc = await uygulama(adres);
    if (sonuc?.besleme) {
      const hepsi = depo.oku('haber', {});
      (hepsi[sunucuId] ??= []).push(sonuc.besleme);
      depo.yaz('haber', hepsi);
    }
    return sonuc;
  });
}

test('/haber ekle: aynı sunucuda üst üste ekleme reddedilir; cevap verilemese de sıra kilitli kalmaz', async () => {
  const haberKomutu = komut('haber');
  // Her ekleme, test bitir[] içindeki çözücüsünü çağırana kadar sürer
  const bitir = [];
  const ekle = haberEkleSahtesi(() => new Promise((coz) => bitir.push(coz)));
  try {
    const ilk = etkilesim({ sunucu: 'haber-1', alt: 'ekle', secenekler: { adres: 'ornek.com' } });
    const suren = haberKomutu.execute(ilk);
    await turBekle();
    const ikinci = etkilesim({ sunucu: 'haber-1', alt: 'ekle', secenekler: { adres: 'baska.com' } });
    await haberKomutu.execute(ikinci);
    assert.match(son(ikinci).content, /^⏳ Bu sunucuda şu an başka bir kaynak ekleniyor/);
    // Başka bir sunucu sırada beklemez
    const baska = etkilesim({ sunucu: 'haber-2', alt: 'ekle', secenekler: { adres: 'baska.com' } });
    const baskaSuren = haberKomutu.execute(baska);
    await turBekle();
    assert.equal(bitir.length, 2);
    bitir[0]({ besleme: { adres: 'https://kotu.example/rss', ad: '[Örnek](https://kotu.example)' } });
    bitir[1]({ hata: 'Bu adreste bir haber beslemesi (RSS) bulamadım.' });
    await Promise.all([suren, baskaSuren]);
    // Kaynağın adı siteden gelir: cevapta gizli bağlantıya dönüşmez
    assert.equal(son(ilk).content, '✅ **[Örnek]\\(https://kotu.example)** takibe alındı. Bundan sonra yayınlanan haberler duyurulacak.\nℹ️ Bildirimlerin gelmesi için `/haber ayar kanal:` ile bir kanal seç.');
    assert.equal(son(baska).content, '❌ Bu adreste bir haber beslemesi (RSS) bulamadım.');

    // Beklenmeyen bir hata genel bir mesajla bildirilir ve sıra serbest kalır
    ekle.mock.mockImplementation(async () => Promise.reject(new Error('EAI_AGAIN')));
    const hatali = etkilesim({ sunucu: 'haber-1', alt: 'ekle', secenekler: { adres: 'ornek.com' } });
    await hatasiz(() => haberKomutu.execute(hatali));
    assert.equal(son(hatali).content, '❌ Kaynak eklenirken bir hata oluştu.');

    // Discord etkileşimi zaman aşımına uğrarsa (Unknown interaction) cevap ertelenemez;
    // sunucu, bot yeniden başlayana kadar kaynak ekleyemez hale gelmemeli
    const gec = etkilesim({ sunucu: 'haber-3', alt: 'ekle', secenekler: { adres: 'ornek.com' }, ertele: async () => Promise.reject(new Error('Unknown interaction')) });
    await assert.rejects(haberKomutu.execute(gec), /Unknown interaction/); // index.js bu hatayı kayda yazar
    ekle.mock.mockImplementation(async () => ({ besleme: { adres: 'https://ornek.com/rss', ad: 'Örnek' } }));
    const sonra = etkilesim({ sunucu: 'haber-3', alt: 'ekle', secenekler: { adres: 'ornek.com' } });
    await haberKomutu.execute(sonra);
    assert.match(son(sonra).content, /^✅ \*\*Örnek\*\* takibe alındı/);
  } finally {
    ekle.mock.restore();
  }
});

test('/haber: kaynak başına rol; ekle ile verilir, ayar ile değişir, kartta gösterilir', async () => {
  const sunucu = 'haber-rol';
  const ekle = haberEkleSahtesi(async (adres) => ({ besleme: { adres: `https://${adres}/rss`, ad: adres } }));
  try {
    const red = await calistir('haber', { sunucu, alt: 'ekle', secenekler: { adres: 'oyun.test', rol: rol('gizli') } });
    assert.match(red.content, /etiketleme yetkin yok/);
    assert.equal(ekle.mock.callCount(), 0, 'reddedilecek ekleme için site indirilmez');

    const oyun = await calistir('haber', { sunucu, alt: 'ekle', secenekler: { adres: 'oyun.test', rol: rol('oyun-haber', { mentionable: true }) }, kanal: sahteKanal('haberler') });
    assert.equal(oyun.content, '✅ **oyun.test** takibe alındı. Bundan sonra yayınlanan haberler duyurulacak.\nBu kaynağın haberlerinde <@&oyun-haber> etiketlenecek.\nℹ️ Henüz bildirim kanalı seçilmemişti; bildirimler bu kanala (<#haberler>) gelecek. Değiştirmek için `/haber ayar kanal:`.');
    assert.equal(ayar(sunucu).haberKanali, 'haberler');
    await calistir('haber', { sunucu, alt: 'ekle', secenekler: { adres: 'tekno.test' } });
  } finally {
    ekle.mock.restore();
  }
  assert.deepEqual(haber.liste(sunucu).map((k) => k.rol), ['oyun-haber', undefined]);

  const ayarla = async (secenekler) => (await calistir('haber', { sunucu, alt: 'ayar', secenekler })).content;
  assert.equal(await ayarla({ kaynak: 'tekno', rol: rol('tekno-haber', { mentionable: true }) }), '✅ **tekno.test** haberlerinde <@&tekno-haber> etiketlenecek.');
  assert.match(await ayarla({ kaynak: 'tekno' }), /^❌ Kaynağa ne yapılacağını seç/);
  assert.match(await ayarla({ kaynak: 'tekno', kanal: sahteKanal('x') }), /yalnızca o kaynağın rolü/);
  assert.match(await ayarla({ kaynak: 'yok', rol: rol('r', { mentionable: true }) }), /Listede böyle bir kaynak yok/);
  assert.match(await ayarla({ kaynak: 'tekno', rol: rol('gizli') }), /etiketleme yetkin yok/);
  assert.equal(haber.liste(sunucu)[1].rol, 'tekno-haber');

  const kart = (await calistir('haber', { sunucu, alt: 'ayar' })).embeds[0].data.fields[0].value;
  assert.equal(kart, '**1.** [oyun.test](https://oyun.test) → <@&oyun-haber>\n**2.** [tekno.test](https://tekno.test) → <@&tekno-haber>');
  // Öneriden gelen tam adresle de bulunur
  assert.equal(await ayarla({ kaynak: 'https://oyun.test/rss', kaldir: 'rol' }), '✅ **oyun.test** artık genel haber rolünü kullanacak.');
  assert.equal(haber.liste(sunucu)[0].rol, undefined);

  const oneri = etkilesim({ sunucu, odak: 'tek' });
  await komut('haber').autocomplete(oneri);
  assert.deepEqual(son(oneri).oneriler, [{ name: '2. tekno.test', value: 'https://tekno.test/rss' }]);
});

test('haber bildirimi: kendi rolü olan kaynak onu, olmayan genel rolü etiketler', async () => {
  const sunucu = 'haber-duyuru';
  const kanal = sahteKanal('haberler');
  depo.yaz('haber', {
    [sunucu]: [
      { adres: 'https://oyun.test/rss', ad: 'Oyun Sitesi', rol: 'oyun-haber' },
      { adres: 'https://tekno.test/rss', ad: 'Tekno Sitesi' },
    ],
  });
  depo.ayarKaydet(sunucu, 'haberKanali', 'haberler');
  depo.ayarKaydet(sunucu, 'haberRol', 'genel-haber');
  depo.yaz('haber-durum', { 'https://oyun.test/rss': ['eski'], 'https://tekno.test/rss': ['eski'] });
  // Bot istemcisi: kontrol döngüsünün zamanlayıcıları çalışmasın
  mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  try {
    haber.baslat({ guilds: { cache: new Collection([[sunucu, { channels: { fetch: async () => kanal } }]]) } });
  } finally {
    mock.timers.reset();
  }
  const okuyucu = async (adres) => ({
    besleme: { ad: 'x', haberler: [{ kimlik: `${adres}#1`, baslik: 'Yeni haber', url: `${adres.replace('/rss', '')}/haber` }, { kimlik: 'eski', baslik: 'Eski', url: 'https://oyun.test/eski' }] },
  });
  await haber.kontrolEt(okuyucu);
  const etiketler = Object.fromEntries(kanal.gonderilen.map((m) => [m.embeds[0].data.author.name, [m.content, m.allowedMentions]]));
  assert.deepEqual(etiketler, {
    'Oyun Sitesi': ['<@&oyun-haber>', { roles: ['oyun-haber'] }],
    'Tekno Sitesi': ['<@&genel-haber>', { roles: ['genel-haber'] }],
  });
  depo.yaz('haber', {});
});

test('/haber cikar ve ayar: sıra numarası ya da adla çıkarılır; kart sınırı ve kaynakları gösterir', async () => {
  depo.yaz('haber', {
    'haber-4': [
      { adres: 'https://ornek.com/rss', ad: 'Örnek Haber' },
      { adres: 'https://teknoloji.com/feed', ad: 'Teknoloji *Gündem*' },
      { adres: 'https://spor.com/rss.xml', ad: 'Spor' },
      { adres: 'https://kotu.example/rss', ad: 'x](https://kotu.example/tuzak) [Tuzak' },
    ],
  });
  const kart = async () => (await calistir('haber', { sunucu: 'haber-4', alt: 'ayar' })).embeds[0].data;
  const cikar = async (kaynak) => (await calistir('haber', { sunucu: 'haber-4', alt: 'cikar', secenekler: { kaynak } })).content;
  const liste = (await kart()).fields[0];
  assert.equal(liste.name, `Kaynaklar · 4/${haber.SUNUCU_BASI_SINIR}`);
  assert.match(liste.value, /^\*\*1\.\*\* \[Örnek Haber\]\(https:\/\/ornek\.com\)/);
  assert.match(liste.value, /\[Teknoloji \\\*Gündem\\\*\]\(https:\/\/teknoloji\.com\)/);
  // Ad, etiketi erken kapatıp kendi adresine giden bir bağlantı kuramaz
  assert.ok(!liste.value.includes('](https://kotu.example/tuzak)'), liste.value);
  assert.match(liste.value, /\[x\]\\\(https:\/\/kotu\.example\/tuzak\) \[Tuzak\]\(https:\/\/kotu\.example\)$/);
  assert.match(await cikar('4'), /^✅ \*\*x\]\\\(https/);

  assert.match(await cikar('9'), /Listede böyle bir kaynak yok/);
  assert.equal(await cikar('3'), '✅ **Spor** takipten çıkarıldı.');
  assert.equal(await cikar('GÜNDEM'), '✅ **Teknoloji \\*Gündem\\*** takipten çıkarıldı.');
  assert.deepEqual(haber.liste('haber-4').map((k) => k.ad), ['Örnek Haber']);
  assert.equal((await kart()).footer.text, 'Kaynaklar 10 dakikada bir kontrol edilir · Değiştirmek için: /haber ayar');
});

test('/instagram: bağlantı kurulmamışsa komut yüklenmez, ekleme reddedilir, kart uyarır', async () => {
  assert.equal(instagram.hazir(), false);
  assert.equal(komut('instagram').etkin(), false, 'Discord\'a yüklenmez');

  const e = await calistir('instagram', { sunucu: 'insta-1', alt: 'ekle', secenekler: { hesap: 'ornek' } });
  assert.match(e.content, /^❌ Instagram bağlantısı henüz kurulmamış/);
  assert.deepEqual(instagram.liste('insta-1'), []);

  const kart = (await calistir('instagram', { sunucu: 'insta-1', alt: 'ayar' })).embeds[0].data;
  assert.match(kart.description, /^⚠️ Instagram bağlantısı kurulmamış/);
  assert.match(kart.fields[0].value, /^Henüz hesap eklenmemiş/);
});

test('/instagram: hesap başına rol, çıkarma ve deneme bildirimi', async () => {
  const sunucu = 'insta-2';
  const ekle = mock.method(instagram, 'ekle', async (sunucuId) => {
    const hepsi = depo.oku('instagram', {});
    (hepsi[sunucuId] ??= []).push({ giris: 'ornek', ad: 'Örnek Hesap' });
    depo.yaz('instagram', hepsi);
    return { hesap: { ad: 'Örnek Hesap', giris: 'ornek' } };
  });
  try {
    const e = await calistir('instagram', { sunucu, alt: 'ekle', secenekler: { hesap: 'ornek', rol: rol('takipci', { mentionable: true }) } });
    assert.match(e.content, /^✅ \*\*Örnek Hesap\*\* \(@ornek\) takibe alındı\. .*\nBu hesabın gönderilerinde <@&takipci> etiketlenecek\./);
    assert.equal(instagram.liste(sunucu)[0].rol, 'takipci');
    ekle.mock.mockImplementation(async () => Promise.reject(new Error('ECONNRESET')));
    const hata = await hatasiz(() => calistir('instagram', { sunucu, alt: 'ekle', secenekler: { hesap: 'ornek' } }));
    assert.match(hata.content, /^❌ Eklenemedi: Instagram'a ulaşılamadı/);
  } finally {
    ekle.mock.restore();
  }

  const hepsi = depo.oku('instagram', {});
  hepsi[sunucu].push({ giris: 'tuzak', ad: 'x](https://kotu.example) [y' });
  depo.yaz('instagram', hepsi);
  // Profil adı serbest metin: kartta etiketi kapatıp başka adrese bağlantı kuramaz
  const kart = (await calistir('instagram', { sunucu, alt: 'ayar' })).embeds[0].data;
  assert.equal(kart.fields[0].value, '[Örnek Hesap](https://www.instagram.com/ornek/) → <@&takipci> · [x]\\(https://kotu.example) [y](https://www.instagram.com/tuzak/)');

  const ayarla = async (secenekler, kanallar) => (await calistir('instagram', { sunucu, alt: 'ayar', secenekler, kanallar })).content;
  assert.equal(await ayarla({ hesap: 'https://www.instagram.com/ornek/', kaldir: 'rol' }), '✅ **Örnek Hesap** (@ornek) artık genel Instagram rolünü kullanacak.');
  assert.match(await ayarla({ hesap: 'ornek', test: true }), /yalnızca o hesabın rolü/);

  const cikar = async (h) => (await calistir('instagram', { sunucu, alt: 'cikar', secenekler: { hesap: h } })).content;
  assert.match(await cikar('baska'), /Listede böyle bir hesap yok/);
  assert.equal(await cikar('ornek'), '✅ **Örnek Hesap** (@ornek) takipten çıkarıldı.');

  const kanal = sahteKanal('insta');
  depo.ayarKaydet(sunucu, 'instagramKanali', 'insta');
  depo.ayarKaydet(sunucu, 'instagramRol', 'takipci');
  assert.match(await ayarla({ test: true }, { insta: kanal }), /✅ <#insta> kanalına deneme bildirimi gönderildi/);
  assert.deepEqual(kanal.gonderilen[0].allowedMentions, { parse: [] }, 'deneme bildirimi seçili rolü etiketlemez');
});

// --- /koruma, /uyari, /seviye ayar alt komutları ---
test('/koruma filtre: yalnızca tür seçilirse ayarları gösterir; durum verilmezse açık/kapalı değişmez', async () => {
  const koruma = src('koruma');
  const filtre = async (secenekler) => calistir('koruma', { sunucu: 'koruma-1', alt: 'filtre', secenekler, botIzinleri: [P.ManageMessages, P.ModerateMembers] });
  const goster = await filtre({ tur: 'spam' });
  assert.equal(goster.embeds[0].data.title, '🛡️ Otomatik koruma');

  assert.match((await filtre({ tur: 'spam', durum: 'acik' })).content, /^✅ Spam koruması açık/);
  assert.equal(koruma.ayarCoz(ayar('koruma-1')).spam, true);
  // Açık filtrenin yalnızca süresi değişir
  assert.match((await filtre({ tur: 'spam', 'susturma-dakika': 5 })).content, /^✅ Spam koruması açık.*5 dakika susturulur/);
  assert.equal(koruma.ayarCoz(ayar('koruma-1')).spam, true);
  // Kapalı filtrenin süresi değişince "kapatıldı" denmez
  assert.equal((await filtre({ tur: 'kufur', 'susturma-dakika': 10 })).content, '✅ Ayar kaydedildi. Küfür filtresi şu an kapalı; açmak için `durum:Açık` ekle.');
  assert.equal(koruma.ayarCoz(ayar('koruma-1')).kufurDakika, 10);
  assert.equal((await filtre({ tur: 'spam', durum: 'kapali' })).content, '✅ Spam koruması kapatıldı.');

  // Türüne ait olmayan seçenek reddedilir
  assert.match((await filtre({ tur: 'spam', kapsam: 'hepsi' })).content, /`kapsam` yalnızca görsel/);
  assert.match((await filtre({ tur: 'gorsel', kisaltici: true })).content, /`kisaltici` yalnızca bağlantı/);
});

test('/koruma kelime: varsayılan işlem ekleme; çıkar ile kaldırılır', async () => {
  const kelime = async (secenekler) => (await calistir('koruma', { sunucu: 'koruma-2', alt: 'kelime', secenekler })).content;
  assert.match(await kelime({ kelime: 'Deneme' }), /^✅ \|\|deneme\|\| eklendi/);
  assert.match(await kelime({ kelime: 'deneme' }), /zaten listede/);
  assert.equal(await kelime({ kelime: 'deneme', islem: 'cikar' }), '✅ ||deneme|| çıkarıldı.');
  assert.match(await kelime({ kelime: 'deneme', islem: 'cikar' }), /özel listede yok/);
});

test('/uyari sil ve kural: tek uyarı ya da hepsi; kural seçeneksiz listelenir, kaldır ile silinir', async () => {
  const uyari = src('uyari');
  const sunucu = 'uyari-ayar';
  for (let i = 0; i < 3; i++) uyari.ekle(sunucu, 'h', { id: String(i), sebep: `s${i}`, yetkiliId: 'mod', zaman: 1 });
  const uyariKomutu = (alt, secenekler, izinler = [P.ModerateMembers, P.ManageGuild]) =>
    calistir('uyari', { sunucu, alt, secenekler: { kullanici: kullanici('h'), ...secenekler }, izinler }).then((c) => c.content);

  assert.match(await uyariKomutu('sil', {}), /^❌ Hangi uyarı silinsin\?/);
  assert.match(await uyariKomutu('sil', { numara: 1, hepsi: true }), /ikisi birden olmaz/);
  assert.match(await uyariKomutu('sil', { numara: 2 }), /2\. uyarısı silindi/);
  assert.deepEqual(uyari.uyarilar(sunucu, 'h').map((u) => u.sebep), ['s0', 's2']);
  assert.match(await uyariKomutu('sil', { hepsi: true }), /2 uyarısı silindi/);
  assert.equal(uyari.uyarilar(sunucu, 'h').length, 0);

  assert.match(await uyariKomutu('kural', {}), /Henüz kural yok/);
  assert.match(await uyariKomutu('kural', { esik: 3 }), /hem `esik`.*hem `islem`/);
  assert.match(await uyariKomutu('kural', { esik: 3, islem: 'sustur' }), /^✅ Kural kaydedildi: 3 uyarı → sustur/);
  // Kural listesi yalnızca görmek için Sunucuyu Yönet istemez
  assert.match(await uyariKomutu('kural', {}, [P.ModerateMembers]), /3 uyarı → sustur/);
  assert.match(await uyariKomutu('kural', { esik: 3, islem: 'kaldir' }, [P.ModerateMembers]), /Sunucuyu Yönet/);
  assert.equal(await uyariKomutu('kural', { esik: 3, islem: 'kaldir' }), '✅ 3 uyarı kuralı kaldırıldı.');
  assert.deepEqual(uyari.kurallar(sunucu), []);
});

test('/seviye ayar ve odul: seçeneksiz ayarları gösterir; yalnızca kanal verilirse sistem açılmaz; rolsüz ödül kaldırılır', async () => {
  const sunucu = 'seviye-ayar';
  const seviyeKomutu = (alt, secenekler) => calistir('seviye', { sunucu, alt, secenekler });
  const goster = await seviyeKomutu('ayar', {});
  assert.match(goster.embeds[0].data.description, /\*\*Durum:\*\* ⚫ Kapalı/);

  assert.equal((await seviyeKomutu('ayar', { kanal: sahteKanal('seviye') })).content, '✅ Duyuru kanalı <#seviye> olarak kaydedildi. Seviye sistemi şu an kapalı; açmak için `durum:Açık` ekle.');
  assert.deepEqual([ayar(sunucu).seviyeAcik, ayar(sunucu).seviyeKanali], [false, 'seviye']);
  assert.match((await seviyeKomutu('ayar', { durum: 'acik' })).content, /^✅ Seviye sistemi açık/);

  depo.ayarKaydet(sunucu, 'seviyeOdulleri', [{ seviye: 5, rolId: 'aktif' }]);
  assert.match((await seviyeKomutu('ayar', {})).embeds[0].data.description, /5\. seviye → <@&aktif>/);
  assert.match((await seviyeKomutu('odul', { seviye: 7 })).content, /7\. seviye için bir ödül yok/);
  assert.match((await seviyeKomutu('odul', { seviye: 5 })).content, /5\. seviye ödülü kaldırıldı/);
  assert.deepEqual(ayar(sunucu).seviyeOdulleri, []);
});
