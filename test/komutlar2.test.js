// Sunucu günlüğü (gunluk.js), /ayarla, acil durum kilidi (/kilit), bildirim komutlarının (/oyun,
// /yayin, /haber, /instagram), /koruma, /uyari ve /seviye ayar alt komutlarının testleri. Çalıştırmak için: npm test
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

// --- /ayarlar paneli ---
// Komutu çalıştırır, son cevabı döndürür
async function calistir(ad, ayarlar) {
  const e = etkilesim(ayarlar);
  await komut(ad).execute(e);
  return son(e);
}
const ayarlarPaneli = src('ayarlar');

// Kartın bileşenleri (bölüm menüsü hariç): [customId, etiket ya da yer tutucu]
const bilesenleri = (cevap) =>
  (cevap.components ?? []).flatMap((s) => s.toJSON().components.map((b) => [b.custom_id, b.label ?? b.placeholder])).filter(([id]) => id !== 'ay:nav');
const bilesen = (cevap, id) => (cevap.components ?? []).flatMap((s) => s.toJSON().components).find((b) => b.custom_id === id);

// Paneldeki bir bileşeni kullanır (customId "ay:<bölüm>:<işlem>"); kartın yeni hâlini döndürür.
// secilenKanal / secilenRol: seçme menüsü (null: seçim boşaltıldı); degerler: listeden seçim;
// form: { alan: değer } ile gönderilen form; guild: sahte sunucuyu değiştirir. Hiçbiri yoksa düğmeye basılmıştır.
async function kartta(bolum, islem, ek = {}) {
  const { secilenKanal, secilenRol, degerler, form, guild, ...ayarlar } = ek;
  const e = etkilesim(ayarlar);
  if (guild) Object.assign(e, { guild, guildId: guild.id });
  const secim = 'secilenKanal' in ek || 'secilenRol' in ek || Boolean(degerler);
  const koleksiyon = (deger) => (deger ? new Collection([deger].flat().map((d) => [d.id, d])) : null);
  Object.assign(e, {
    customId: `ay:${bolum}:${islem}`,
    isButton: () => !secim && !form,
    isModalSubmit: () => Boolean(form),
    isFromMessage: () => true,
    channels: new Collection(secilenKanal ? [[secilenKanal.id, secilenKanal]] : []),
    roles: new Collection(secilenRol ? [[secilenRol.id, secilenRol]] : []),
    values: degerler ?? [],
    fields: form && {
      getTextInputValue: (id) => form[id] ?? '',
      getStringSelectValues: (id) => (form[id] === undefined ? [] : [form[id]]),
      getSelectedRoles: (id) => koleksiyon(form[id]),
      getSelectedUsers: (id) => koleksiyon(form[id]),
      getSelectedChannels: (id) => koleksiyon(form[id]),
    },
    deferUpdate: async () => e.cevaplar.push({ ertelendi: true }),
    update: async (m) => e.cevaplar.push(m),
    showModal: async (m) => e.cevaplar.push({ form: m.toJSON() }),
  });
  await ayarlarPaneli.etkilesim(e);
  return son(e);
}
// Bir bölümün kartı (bölüm menüsünden seçilmiş gibi)
const kartAc = (bolum, ayarlar = {}) => ayarlarPaneli.mesaj(etkilesim(ayarlar), bolum);

test('/ayarlar: yalnızca kullanana görünen genel bakış açılır; menüde yetkiye göre bölümler var', async () => {
  assert.equal(komut('ayarlar').data.toJSON().options?.length ?? 0, 0, 'seçeneği yok');
  const e = etkilesim({ sunucu: 'panel-1' });
  await komut('ayarlar').execute(e);
  const kart = son(e);
  assert.equal(kart.flags, MessageFlags.Ephemeral);
  assert.equal(kart.content, undefined);
  assert.equal(kart.embeds[0].data.title, '⚙️ Voyager ayarları');
  const menu = kart.components[0].toJSON().components[0];
  assert.equal(menu.custom_id, 'ay:nav');
  assert.deepEqual(
    menu.options.map((o) => o.value),
    ['genel', 'oyun', 'yayin', 'haber', 'koruma', 'gunluk', 'karsilama', 'seviye', 'uyari', 'kurulum'],
    'Instagram bağlantısı kurulmamış; acil kilit yalnızca Yöneticiye',
  );
  assert.equal(kart.embeds[0].data.fields.length, menu.options.length - 1, 'genel bakışta her bölümün bir satırı var');

  const yonetici = etkilesim({ sunucu: 'panel-1', izinler: [P.Administrator] });
  await komut('ayarlar').execute(yonetici);
  assert.ok(son(yonetici).components[0].toJSON().components[0].options.some((o) => o.value === 'kilit'));

  // Menüden bölüm seçilir; bölüm menüsü her zaman ilk satırda kalır
  const secim = await kartta('nav', '', { sunucu: 'panel-1', degerler: ['koruma'] });
  assert.equal(secim.embeds[0].data.title, '🛡️ Otomatik koruma');
  assert.equal(secim.components[0].toJSON().components[0].options.find((o) => o.default).value, 'koruma');
  assert.equal((await kartta('nav', '', { sunucu: 'panel-1', degerler: ['genel'] })).embeds[0].data.title, '⚙️ Voyager ayarları');

  // Yetkisi olmayan bölüm açılamaz ve kullanılamaz; Sunucuyu Yönet'i olmayan hiçbir şeyi değiştiremez
  assert.match((await kartta('nav', '', { sunucu: 'panel-1', degerler: ['kilit'] })).content, /açamazsın/);
  assert.match((await kartta('kilit', 'kapat', { sunucu: 'panel-1' })).content, /Yönetici/);
  assert.match((await kartta('koruma', 'spam', { sunucu: 'panel-1', izinler: [] })).content, /Sunucuyu Yönet/);
  assert.equal(src('koruma').ayarCoz(ayar('panel-1')).spam, false);
  assert.match((await kartta('yok', 'x', { sunucu: 'panel-1' })).content, /kart eski/);
  // Önceki sürümün kartları yeni panele yönlendirilir
  const eski = etkilesim();
  await ayarlarPaneli.eskiKart(eski);
  assert.match(son(eski).content, /`\/ayarlar`/);
});

test('/ayarlar: her bölümün kartı en fazla 5 satır; genel bakış satırları sığar', async () => {
  for (const b of ayarlarPaneli.BOLUMLER) {
    const kart = kartAc(b.id, { sunucu: 'panel-2', izinler: [P.Administrator] });
    assert.ok(kart.components.length <= 5, `${b.id}: ${kart.components.length} satır`);
    assert.ok(b.ozet({ id: 'panel-2' }).length <= 1024, b.id);
  }
});

test('/ayarlar → Günlük: kanal yalnızca bot kart gönderebiliyorsa kaydedilir; olay türleri menüden seçilir', async () => {
  const sunucu = 'gunluk-panel';
  // Günlük kart (embed) gönderir; Bağlantı Yerleştir izni olmadan kart görünmez
  const red = await kartta('gunluk', 'kanal', { sunucu, secilenKanal: sahteKanal('kartsiz', [P.ViewChannel, P.SendMessages]) });
  assert.match(red.content, /^❌ <#kartsiz> kanalına yazamıyorum.*Bağlantı Yerleştir/);
  assert.equal(ayar(sunucu).logKanali, undefined);

  const kabul = await kartta('gunluk', 'kanal', { sunucu, secilenKanal: sahteKanal('log') });
  assert.equal(kabul.content, '✅ Günlük kanalı <#log> olarak ayarlandı.');
  assert.match(kabul.embeds[0].data.description, /\*\*Günlük kanalı:\*\* <#log>/, 'kart güncellenir');
  assert.ok(bilesen(kabul, 'ay:gunluk:kategoriler').options.every((o) => o.default), 'olay türleri başlangıçta açık');

  const { guild, giden } = gunlukSunucusu(sunucu);
  const secim = await kartta('gunluk', 'kategoriler', { sunucu, degerler: ['moderasyon', 'uyeler'] });
  assert.equal(secim.content, '✅ Kaydedilecek olaylar: Moderasyon, Üyeler.');
  assert.equal(bilesen(secim, 'ay:gunluk:kategoriler').options.filter((o) => o.default).length, 2);
  await gunluk.olaylar.mesajSilindi({ guild, author: kullanici('a'), channel: '<#genel>', content: 'gizli' });
  await gunluk.olaylar.uyeKatildi({ guild, user: kullanici('a') });
  assert.deepEqual(giden.map(baslik), ['Üye katıldı'], 'kapatılan olay türü yazılmaz');
  assert.equal((await kartta('gunluk', 'kategoriler', { sunucu, degerler: [] })).content, '✅ Kaydedilecek olaylar: hiçbiri.');

  // Kanal menüsünü boşaltmak kaydı durdurur
  assert.equal((await kartta('gunluk', 'kanal', { sunucu, secilenKanal: null })).content, '✅ Günlük kanalı kaldırıldı; artık kayıt tutulmuyor.');
  assert.equal(ayar(sunucu).logKanali, null);
});

test('/ayarlar → Günlük: kanal özetleri yapay zekâ ve mesaj içeriği olmadan açılmaz', async () => {
  const yapayzeka = src('yapayzeka');
  const ozet = async (intents = [GatewayIntentBits.MessageContent]) => (await kartta('gunluk', 'ozet', { sunucu: 'ozet-panel', intents })).content;
  assert.equal(yapayzeka.hazir(), false);
  assert.match(await ozet(), /yapay zekâ kurulu değil/);
  assert.equal(ayar('ozet-panel').ozetAcik, undefined);

  const hazir = mock.method(yapayzeka, 'hazir', () => true);
  try {
    assert.match(await ozet([]), /Message Content Intent/);
    assert.equal(ayar('ozet-panel').ozetAcik, undefined);
    const acik = await ozet();
    assert.match(acik, /^✅ Kanal özetleri açık/);
    assert.match(acik, /Google'ın yapay zekâsına gönderilir/, 'mesajların dışarı gittiği söylenir');
    assert.equal(ayar('ozet-panel').ozetAcik, true);
  } finally {
    hazir.mock.restore();
  }
  // Kapatmak her zaman serbest
  assert.equal(await ozet([]), '✅ Kanal özetleri kapatıldı.');
  assert.equal(ayar('ozet-panel').ozetAcik, false);
});

test('/ayarlar → Karşılama: hoş geldin kanalı ve oto rol; oto rolü yalnızca o rolü verebilen seçer; boşaltınca kalkar', async () => {
  const sunucu = 'karsilama-panel';
  // Hoş geldin mesajı düz metindir: Bağlantı Yerleştir gerekmez, görme ve yazma gerekir
  const kartsiz = sahteKanal('kartsiz', [P.ViewChannel, P.SendMessages]);
  assert.equal((await kartta('karsilama', 'kanal', { sunucu, secilenKanal: kartsiz })).content, '✅ Hoş geldin kanalı <#kartsiz> olarak ayarlandı.');
  assert.match((await kartta('karsilama', 'kanal', { sunucu, secilenKanal: sahteKanal('gizli', [P.SendMessages]) })).content, /^❌/);
  assert.equal(ayar(sunucu).hosgeldinKanali, 'kartsiz');

  const uyeRolu = rol('uye', { managed: false, position: 3, permissions: izinli() });
  assert.match((await kartta('karsilama', 'rol', { sunucu, secilenRol: uyeRolu })).content, /^❌.*sen de veremiyorsun/);
  assert.equal(ayar(sunucu).otoRol, undefined);
  const kabul = await kartta('karsilama', 'rol', { sunucu, secilenRol: uyeRolu, izinler: [P.ManageGuild, P.ManageRoles] });
  assert.equal(kabul.content, '✅ Yeni üyelere <@&uye> rolü verilecek.');
  assert.match(kabul.embeds[0].data.description, /\*\*Oto rol:\*\* <@&uye>/);

  assert.equal((await kartta('karsilama', 'rol', { sunucu, secilenRol: null })).content, '✅ Oto rol kaldırıldı.');
  assert.equal((await kartta('karsilama', 'kanal', { sunucu, secilenKanal: null })).content, '✅ Hoş geldin mesajı kapatıldı.');
  assert.deepEqual([ayar(sunucu).hosgeldinKanali, ayar(sunucu).otoRol], [null, null]);
});

// --- /ayarlar → Acil kilit ---
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

// Paneldeki kilitle ya da kilidi aç düğmesi (Yönetici olarak); kartın yeni hâlini döndürür
const kilitte = (guild, islem) => kartta('kilit', islem, { guild, izinler: [P.Administrator] });
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

test('acil kilit: kanallar kilitlenir, kilit açılınca izinler aynen geri gelir', async () => {
  const kilit = src('kilit');
  const { guild, kanallar, sesteki, gunlukKaydi } = kilitSunucusu('kilit-a');
  const once = Object.fromEntries(Object.entries(kanallar).map(([ad, k]) => [ad, satirlar(k)]));

  assert.equal((await kilitte(guild, 'ac')).content, '🔓 Sunucu kilitli değil.');

  const kapat = await sessizce(() => kilitte(guild, 'kapat'));
  assert.match(kapat.content, /\*\*3 kanal\*\* kilitlendi/, 'konular (thread) ayrıca kilitlenmez');
  assert.match(kapat.content, /1 kişi ses kanallarından çıkarıldı/);
  assert.equal(kapat.embeds[0].data.title, '🔒 Sunucu kilitli', 'kart güncellenir');
  assert.equal(bilesen(kapat, 'ay:kilit:ac').label, '🔓 Kilidi aç');
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

  assert.equal((await kilitte(guild, 'kapat')).content, '🔒 Sunucu zaten kilitli.');

  const ac = await sessizce(() => kilitte(guild, 'ac'));
  assert.equal(ac.content, '🔓 Kilit açıldı: 3 kanal kilitten önceki izinlerine döndü.');
  assert.equal(bilesen(ac, 'ay:kilit:kapat').label, '🔒 Sunucuyu kilitle');
  for (const [ad, kanal] of Object.entries(kanallar)) assert.deepEqual(satirlar(kanal), once[ad], ad);
  assert.equal(kilit.kilitli(guild.id), false);
  assert.equal(depo.oku('kilit', {})[guild.id], undefined, 'yedek silinir');
  assert.equal(baslik(gunlukKaydi[1]), '🔓 Sunucunun kilidi açıldı');
});

test('acil kilit: bot izinleri yetmiyorsa hiçbir kanala dokunulmaz', async () => {
  const { guild, kanallar } = kilitSunucusu('kilit-b', { botIzinleri: [P.ManageChannels] });
  const once = satirlar(kanallar.genel);
  assert.match((await kilitte(guild, 'kapat')).content, /Rolleri Yönet.*Kanalları Yönet/);
  assert.deepEqual(satirlar(kanallar.genel), once);
  assert.equal(src('kilit').kilitli(guild.id), false);
});

test('acil kilit: aynı anda iki kez basılırsa ikincisi beklemesini söyler', async () => {
  const { guild } = kilitSunucusu('kilit-c');
  const [ilk, ikinci] = await sessizce(() => Promise.all([kilitte(guild, 'kapat'), kilitte(guild, 'kapat')]));
  assert.match(ilk.content, /kilitlendi/, 'ilki kilitler');
  // İkincisi ya beklemesini ya da sunucunun zaten kilitlendiğini söyler; iki kez kilitlemez
  assert.match(ikinci.content, /^(⏳|🔒 Sunucu zaten kilitli)/);
  await sessizce(() => kilitte(guild, 'ac'));
});

test('acil kilit: açılamayan kanal kalırsa sunucu kilitli sayılır, yeniden basınca kalanlar açılır', async () => {
  const yetkiYok = Object.assign(new Error('Missing Permissions'), { code: 50013 });
  // genel kanalın 1. set çağrısı (kilitleme) geçer, 2.si (açma) reddedilir
  const { guild, kanallar } = kilitSunucusu('kilit-d', { hatalar: [null, yetkiYok] });
  const once = Object.fromEntries(Object.entries(kanallar).map(([ad, k]) => [ad, satirlar(k)]));
  await sessizce(() => kilitte(guild, 'kapat'));

  // Kilit sırasında bir rol ve bir kanal silindi: geri yüklenemezler, işlemi de bozmazlar
  guild.roles.cache.delete('uyeler');
  guild.channels.cache.delete('ses');

  const ilk = await sessizce(() => kilitte(guild, 'ac'));
  assert.equal(ilk.content, '⚠️ 1 kanal eski haline döndü, **1 kanal açılamadı** (Yetkim yetmedi (1 kanal)). Sunucu hâlâ kilitli sayılıyor; **Kilidi aç** düğmesine yeniden bas.');
  assert.equal(src('kilit').kilitli(guild.id), true);
  assert.deepEqual(Object.keys(depo.oku('kilit', {})[guild.id]), ['genel'], 'yalnızca açılamayanın yedeği kalır');
  assert.deepEqual(satirlar(kanallar.kategori), once.kategori);

  const ikinci = await sessizce(() => kilitte(guild, 'ac'));
  assert.match(ikinci.content, /^🔓 Kilit açıldı: 1 kanal/);
  assert.deepEqual(satirlar(kanallar.genel), once.genel.filter((s) => s.id !== 'uyeler'), 'silinen rolün satırı geri yazılmaz');
  assert.equal(src('kilit').kilitli(guild.id), false);
});

// --- /ayarlar → bildirim bölümleri: oyun, yayın, haber, Instagram ---
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

test('bildirim bölümleri: kanal ve rol menüleri; takip listesi olanlarda Ekle düğmesi', () => {
  for (const { ad } of BILDIRIM_KOMUTLARI) {
    const kart = kartAc(ad, { sunucu: `kart-${ad}` });
    assert.match(kart.embeds[0].data.description, /ayarlanmadı \(bildirimler kapalı\)/, ad);
    const kimlikler = bilesenleri(kart).map(([id]) => id);
    assert.deepEqual(kimlikler.slice(0, 2), [`ay:${ad}:kanal`, `ay:${ad}:rol`], `${ad}: kanal ve rol menüleri`);
    assert.ok(!kimlikler.includes(`ay:${ad}:kapat`), `${ad}: kanal yokken kapatma düğmesi yok`);
    assert.equal(kimlikler.includes(`ay:${ad}:ekle`), ad !== 'oyun', `${ad}: takip listesi olanlarda Ekle düğmesi`);
    assert.ok(kart.components.length <= 5, `${ad}: en fazla 5 satır`);
  }
});

test('bildirim bölümleri: kanal menüsü yalnızca botun kart gönderebildiği kanalı kaydeder; kapatma düğmesi kanalı kaldırır', async () => {
  for (const { ad, kanalAyari } of BILDIRIM_KOMUTLARI) {
    const sunucu = `kanal-${ad}`;
    const yazamaz = await kartta(ad, 'kanal', { sunucu, secilenKanal: sahteKanal('k', [P.ViewChannel, P.SendMessages]) });
    assert.match(yazamaz.content, /^❌ <#k> kanalına yazamıyorum/, ad);
    assert.equal(ayar(sunucu)[kanalAyari], undefined, ad);

    const kanal = sahteKanal('k');
    const kabul = await kartta(ad, 'kanal', { sunucu, secilenKanal: kanal, kanallar: { k: kanal } });
    assert.match(kabul.content, /^✅ .* <#k> kanalına gönderilecek\./, ad);
    assert.match(kabul.embeds[0].data.description, /\*\*Kanal:\*\* <#k>/, `${ad}: kart güncellenir`);
    assert.deepEqual(bilesen(kabul, `ay:${ad}:kanal`).default_values, [{ id: 'k', type: 'channel' }], `${ad}: seçili kanal menüde görünür`);
    assert.equal(ayar(sunucu)[kanalAyari], 'k', ad);
    assert.equal(bilesen(kabul, `ay:${ad}:kapat`).label, 'Bildirimleri kapat', ad);

    const kapat = await kartta(ad, 'kapat', { sunucu });
    assert.match(kapat.content, /^✅ .*kapatıldı/, ad);
    assert.equal(ayar(sunucu)[kanalAyari], null, ad);
    assert.equal(bilesen(kapat, `ay:${ad}:kapat`), undefined, ad);

    // Sunucuyu Yönet yetkisi olmayan kartı kullanamaz
    depo.ayarKaydet(sunucu, kanalAyari, 'k');
    assert.match((await kartta(ad, 'kapat', { sunucu, izinler: [] })).content, /Sunucuyu Yönet/, ad);
    assert.equal(ayar(sunucu)[kanalAyari], 'k', ad);
  }
});

test('bildirim bölümleri: rol menüsü; rolü yalnızca etiketleyebilen seçer, @everyone seçilemez, boşaltınca rol kalkar', async () => {
  for (const { ad, rolAyari } of BILDIRIM_KOMUTLARI) {
    const sunucu = `rol-${ad}`;
    const rolSec = async (secilenRol, { izinler = [P.ManageGuild], botIzinleri = [] } = {}) =>
      (await kartta(ad, 'rol', { sunucu, secilenRol, izinler, botIzinleri })).content;

    assert.match(await rolSec(rol(sunucu, { mentionable: true })), /@everyone seçilemez/, ad);
    assert.match(await rolSec(rol('gizli')), /etiketleme yetkin yok/, ad);
    assert.equal(ayar(sunucu)[rolAyari], undefined, `${ad}: etiketleyemediği rol kaydedilmez`);

    assert.equal(await rolSec(rol('acik', { mentionable: true })), '✅ Bildirimlerde <@&acik> etiketlenecek.', ad);
    assert.equal(ayar(sunucu)[rolAyari], 'acik', ad);

    // Herkesi etiketleyebilen yetkili kapalı rolü seçebilir; bot etiketleyemiyorsa bildirim gitmeyeceği söylenir
    assert.match(await rolSec(rol('kapali'), { izinler: [P.ManageGuild, P.MentionEveryone] }), /^⚠️ <@&kapali> kaydedildi ama bildirim gitmeyecek/, ad);
    assert.equal(ayar(sunucu)[rolAyari], 'kapali', ad);
    assert.match(await rolSec(rol('kapali'), { izinler: [P.ManageGuild, P.MentionEveryone], botIzinleri: [P.MentionEveryone] }), /^✅/, ad);

    assert.equal(await rolSec(null), '✅ Bildirimlerde artık rol etiketlenmeyecek.', `${ad}: seçimi boşaltmak rolü kaldırır`);
    assert.equal(ayar(sunucu)[rolAyari], null, ad);
  }
});

test('/oyun: bedava oyunlar, indirimler ve @everyone düğmeyle açılıp kapanır', async () => {
  const sunucu = 'oyun-1';
  // Eski sürümlerin kaydettiği mağaza ve oran ayarları yok sayılır
  depo.ayarKaydet(sunucu, 'oyunMagaza', 'epic');
  depo.ayarKaydet(sunucu, 'oyunMinYuzde', 75);
  const kart = await kartAc('oyun', { sunucu });
  assert.deepEqual(bilesenleri(kart).slice(2), [
    ['ay:oyun:bedava', '🎁 Bedava oyunlar: Açık'],
    ['ay:oyun:indirim', '🏷️ İndirimler: Açık'],
    ['ay:oyun:everyone', '📢 @everyone: Kapalı'],
  ]);
  assert.match(kart.embeds[0].data.description, /\*\*İndirimler:\*\* açık \(en az %50\)/);

  const bedava = await kartta('oyun', 'bedava', { sunucu });
  assert.equal(bedava.content, '✅ Bedava oyun bildirimleri kapatıldı.');
  assert.equal(bilesen(bedava, 'ay:oyun:bedava').label, '🎁 Bedava oyunlar: Kapalı', 'kart ve düğme güncellenir');
  assert.match(bedava.embeds[0].data.description, /\*\*Bedava oyunlar:\*\* kapalı/);
  assert.equal((await kartta('oyun', 'bedava', { sunucu })).content, '✅ Bedava oyun bildirimleri açıldı.');
  assert.equal((await kartta('oyun', 'indirim', { sunucu })).content, '✅ İndirim bildirimleri kapatıldı.');
  assert.deepEqual(firsatlar.ayarCoz(ayar(sunucu)), { kanal: null, rol: null, bedava: true, indirim: false, yuzde: 50, everyone: false });

  // Kanal ilk kez seçilince mevcut fırsatlar için "Şimdi gönder" önerilir; sonraki seçimlerde değil
  const ilk = await kartta('oyun', 'kanal', { sunucu, secilenKanal: sahteKanal('firsat') });
  assert.match(ilk.content, /Şimdi gönder/);
  assert.equal(bilesen(ilk, 'ay:oyun:simdi').label, 'Şimdi gönder');
  assert.doesNotMatch((await kartta('oyun', 'kanal', { sunucu, secilenKanal: sahteKanal('firsat2') })).content, /Şimdi gönder/);
});

test('/oyun @everyone düğmesi: bot o kanalda @everyone atamıyorsa uyarılır', async () => {
  const everyone = async ({ kanalIzinleri, botIzinleri = [] } = {}) => {
    const kanallar = kanalIzinleri ? { firsat: sahteKanal('firsat', kanalIzinleri) } : {};
    depo.ayarKaydet('oyun-2', 'oyunKanali', kanalIzinleri ? 'firsat' : null);
    depo.ayarKaydet('oyun-2', 'oyunEveryone', false);
    return (await kartta('oyun', 'everyone', { sunucu: 'oyun-2', kanallar, botIzinleri })).content;
  };
  // Kanal seçilmemişse sunucu geneli izne bakılır
  assert.match(await everyone(), /Tüm Rollerden Bahset\*\* izni yok/);
  assert.doesNotMatch(await everyone({ botIzinleri: [P.MentionEveryone] }), /izni yok/);
  // Kanal seçiliyse o kanaldaki izne: sunucu genelinde izin olsa da kanalda kapalıysa uyarılır
  assert.match(await everyone({ kanalIzinleri: [P.SendMessages], botIzinleri: [P.MentionEveryone] }), /izni yok/);
  assert.match(await everyone({ kanalIzinleri: [P.MentionEveryone] }), /en fazla 6 saatte bir/);
  assert.equal(ayar('oyun-2').oyunEveryone, true);
  // Yeniden basınca kapanır
  assert.equal((await kartta('oyun', 'everyone', { sunucu: 'oyun-2' })).content, '✅ Önemli fırsatlarda artık @everyone atılmayacak.');
  assert.equal(ayar('oyun-2').oyunEveryone, false);
});

test('/oyun Şimdi gönder: kanal ister, sunucu başına 5 dakikada bir çalışır', async () => {
  const gonder = mock.method(firsatlar, 'simdiGonder', async () => ({ bedava: 2, indirim: 0 }));
  mock.timers.enable({ apis: ['Date'], now: 5_000_000 });
  try {
    const simdi = async () => (await kartta('oyun', 'simdi', { sunucu: 'oyun-3' })).content;
    assert.equal(await simdi(), '❌ Önce yukarıdan bir kanal seç.');
    depo.ayarKaydet('oyun-3', 'oyunKanali', 'firsat');
    assert.equal(await simdi(), '✅ <#firsat> kanalına 2 bedava oyun ve 0 indirim gönderildi.');
    assert.match(await simdi(), /^⏳ Fırsatlar az önce gönderildi/);
    assert.equal(gonder.mock.callCount(), 1, 'beklerken mağazalara yeniden istek atılmaz');
    mock.timers.tick(5 * 60_000);
    gonder.mock.mockImplementation(async () => ({ bedava: 0, indirim: 0 }));
    assert.equal(await simdi(), 'Şu an ayarlarına uyan bir fırsat yok.');
    mock.timers.tick(5 * 60_000);
    gonder.mock.mockImplementation(async () => Promise.reject(new Error('Kaynaklara ulaşılamadı')));
    assert.match(await hatasiz(simdi), /^❌ Fırsatlar şu an alınamadı/);
  } finally {
    mock.timers.reset();
    gonder.mock.restore();
  }
});

test('Ekle düğmesi formu açar; formda platform, ad ve isteğe bağlı rol var', async () => {
  const yayinFormu = (await kartta('yayin', 'ekle', { sunucu: 'form-1' })).form;
  assert.equal(yayinFormu.custom_id, 'ay:yayin:ekle-form');
  assert.deepEqual(yayinFormu.components.map((c) => c.component.custom_id), ['platform', 'yayinci', 'rol']);
  assert.equal(yayinFormu.components[2].component.required, false, 'rol isteğe bağlı');
  assert.deepEqual((await kartta('haber', 'ekle', { sunucu: 'form-1' })).form.components.map((c) => c.component.custom_id), ['adres', 'rol']);
  assert.deepEqual((await kartta('instagram', 'ekle', { sunucu: 'form-1' })).form.components.map((c) => c.component.custom_id), ['hesap', 'rol']);
});

test('/yayin: bağlantısı kurulmamış platform eklenmez, ayar kartı bunu gösterir', async () => {
  for (const platform of Object.keys(yayin.PLATFORMLAR)) {
    assert.equal(yayin.PLATFORMLAR[platform].hazir(), false, platform);
    const sonuc = await kartta('yayin', 'ekle-form', { sunucu: 'yayin-1', form: { platform, yayinci: 'deneme' } });
    assert.match(sonuc.content, /^❌ .*bağlantısı henüz kurulmamış/, platform);
  }
  assert.deepEqual(yayin.liste('yayin-1'), []);

  const kart = (await kartAc('yayin', { sunucu: 'yayin-1' })).embeds[0].data;
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

test('/yayin ekle formu: platform hatası genel bir mesajla söylenir; kanal seçilmemişse kartın açıldığı kanal varsayılır', async () => {
  const ekle = async (sonuc, ek = {}) => {
    const sahte = yayinEkleSahtesi(sonuc);
    try {
      return (await hatasiz(() => kartta('yayin', 'ekle-form', { sunucu: 'yayin-2', form: { platform: 'twitch', yayinci: 'deneme' }, ...ek }))).content;
    } finally {
      sahte.mock.restore();
    }
  };
  assert.match(await ekle(new Error('ETIMEDOUT')), /^❌ Eklenemedi: platforma ulaşılamadı/);
  assert.equal(await ekle({ hata: 'Twitch üzerinde "x" adında bir kanal bulamadım.' }), '❌ Twitch üzerinde "x" adında bir kanal bulamadım.');

  // Bot o kanala yazamıyorsa varsayılmaz, nasıl seçileceği söylenir
  const yazamaz = await ekle({ yayinci: { id: '1', giris: 'bir', ad: 'Bir' } }, { kanal: sahteKanal('sohbet', [P.ViewChannel]) });
  assert.match(yazamaz, /yukarıdaki menüden bir kanal seç/);
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

test('/yayin: yayıncı başına rol formda verilir; listedeyse yalnızca rolü güncellenir; listeden seçilen çıkarılır', async () => {
  const sunucu = 'yayin-3';
  depo.ayarKaydet(sunucu, 'yayinKanali', 'yayinlar');
  depo.ayarKaydet(sunucu, 'yayinRol', 'genel');
  const ekle = (form) => kartta('yayin', 'ekle-form', { sunucu, form: { platform: 'kick', yayinci: 'ornek', ...form } });
  const sahte = yayinEkleSahtesi({ yayinci: { id: 'k1', giris: 'ornek', ad: 'Örnek' } });
  try {
    // Etiketleyemediği rol, platforma sorulmadan reddedilir
    assert.match((await ekle({ rol: rol('gizli') })).content, /etiketleme yetkin yok/);
    assert.equal(sahte.mock.callCount(), 0);

    assert.equal((await ekle({ rol: rol('kick-hayran', { mentionable: true }) })).content, '✅ **Örnek** (Kick) takibe alındı.\nYayına geçince <@&kick-hayran> etiketlenecek.');
    assert.equal(yayin.liste(sunucu)[0].rol, 'kick-hayran');
  } finally {
    sahte.mock.restore();
  }
  // Aynı kanal adı Twitch'te de takip ediliyor
  const hepsi = depo.oku('yayincilar', {});
  hepsi[sunucu].push({ platform: 'twitch', id: 't1', giris: 'ornek', ad: 'Örnek' });
  depo.yaz('yayincilar', hepsi);

  // Listedeki yayıncıyı yeniden eklemek yalnızca rolünü günceller
  const zaten = yayinEkleSahtesi({ hata: '**Örnek** zaten listede.', zaten: { id: 't1', giris: 'ornek', ad: 'Örnek' } });
  try {
    const yeniden = async (form) => (await kartta('yayin', 'ekle-form', { sunucu, form: { platform: 'twitch', yayinci: 'ornek', ...form } })).content;
    assert.equal(await yeniden({ rol: rol('twitch-hayran', { mentionable: true }) }), '✅ **Örnek** (Twitch) zaten listedeydi; yayına geçince <@&twitch-hayran> etiketlenecek.');
    assert.equal(await yeniden({}), '❌ **Örnek** zaten listede. Rolünü değiştirmek için formda bir rol seç.');
  } finally {
    zaten.mock.restore();
  }
  assert.deepEqual(yayin.liste(sunucu).map((y) => y.rol), ['kick-hayran', 'twitch-hayran']);

  // Kart: kendi rolü olan yayıncı oklu gösterilir; çıkarma listesinde ikisi de ayrı seçenek
  const kart = await kartAc('yayin', { sunucu });
  assert.match(kart.embeds[0].data.fields.find((a) => a.name.includes('Twitch')).value, /\[Örnek\]\(https:\/\/www\.twitch\.tv\/ornek\) → <@&twitch-hayran>/);
  assert.match(kart.embeds[0].data.description, /\*\*Etiketlenecek rol:\*\* <@&genel>/);
  assert.deepEqual(bilesen(kart, 'ay:yayin:cikar:0').options.map((o) => o.value), ['kick:k1', 'twitch:t1']);

  // Listeden seçilen tek kayıt çıkarılır; abonelik eşitlenir
  const esitle = mock.method(yayin, 'esitle', async () => {});
  try {
    const cikar = await kartta('yayin', 'cikar:0', { sunucu, degerler: ['kick:k1'] });
    assert.equal(cikar.content, '✅ **Örnek** (Kick) takipten çıkarıldı.');
    assert.deepEqual(bilesen(cikar, 'ay:yayin:cikar:0').options.map((o) => o.value), ['twitch:t1'], 'liste güncellenir');
    assert.deepEqual(esitle.mock.calls.map((c) => c.arguments), [['kick']]);
    assert.match((await kartta('yayin', 'cikar:0', { sunucu, degerler: ['kick:k1'] })).content, /listede yok/);
  } finally {
    esitle.mock.restore();
  }
});

test('/yayin: deneme bildirimi kimseyi etiketlemez; uzun liste kısaltılır ve sayfalara bölünür', async () => {
  const deneme = async (kanallar) => (await kartta('yayin', 'deneme', { sunucu: 'yayin-4', kanallar })).content;
  assert.match(await deneme({}), /önce yukarıdan bir kanal seç/);
  assert.equal(bilesen(await kartAc('yayin', { sunucu: 'yayin-4' }), 'ay:yayin:deneme'), undefined, 'kanal yokken düğme yok');
  depo.ayarKaydet('yayin-4', 'yayinKanali', 'bildirim');
  assert.equal(bilesen(await kartAc('yayin', { sunucu: 'yayin-4' }), 'ay:yayin:deneme').label, 'Deneme bildirimi');
  assert.match(await deneme({}), /Bildirim kanalı bulunamadı/);
  const kanal = sahteKanal('bildirim');
  depo.ayarKaydet('yayin-4', 'yayinRol', 'herkes-rolu');
  assert.equal(await deneme({ bildirim: kanal }), '✅ <#bildirim> kanalına deneme bildirimi gönderildi (kimse etiketlenmedi).');
  assert.equal(kanal.gonderilen.length, 1);
  assert.deepEqual(kanal.gonderilen[0].allowedMentions, { parse: [] });

  // 50 Twitch yayıncısı: kart alanı 1024 karakteri aşmaz, sığmayanlar sayıyla söylenir. Adlar biçimlendirme taşımaz.
  depo.yaz('yayincilar', {
    'yayin-4': [
      ...Array.from({ length: 50 }, (_, i) => ({ platform: 'twitch', id: String(i), giris: `yayinci_${i}`, ad: `*Yayıncı ${i}*` })),
      { platform: 'youtube', id: 'UC1', giris: 'tuzak', ad: 'x](https://kotu.example) [y' },
    ],
  });
  const cevap = await kartAc('yayin', { sunucu: 'yayin-4' });
  const kart = cevap.embeds[0].data;
  const twitch = kart.fields[0];
  assert.equal(twitch.name, '🟣 Twitch · 50');
  assert.ok(twitch.value.length <= 1024, `${twitch.value.length} karakter`);
  assert.match(twitch.value, / · \+\d+ daha$/);
  assert.match(twitch.value, /\[\\\*Yayıncı 0\\\*\]\(https:\/\/www\.twitch\.tv\/yayinci_0\)/);
  assert.equal(kart.footer.text, '51 yayıncı takip ediliyor · Her şeyi aşağıdan değiştirebilirsin');
  const youtube = kart.fields.find((a) => a.name.includes('YouTube'));
  assert.equal(youtube.value, '⚠️ Bağlantı kurulmamış\n[x]\\(https://kotu.example) [y](https://www.youtube.com/channel/UC1)');

  // 51 kayıt: çıkarma listesi 25'erli üç sayfa; sayfa düğmeleriyle gezilir
  assert.equal(cevap.components.length, 5);
  const ilk = bilesen(cevap, 'ay:yayin:cikar:0');
  assert.equal(ilk.options.length, 25);
  assert.match(ilk.placeholder, /sayfa 1\/3/);
  assert.equal(bilesen(cevap, 'ay:yayin:sayfa:-1').disabled, true);
  const son = await kartta('yayin', 'sayfa:2', { sunucu: 'yayin-4' });
  assert.deepEqual(bilesen(son, 'ay:yayin:cikar:2').options.map((o) => o.value), ['youtube:UC1']);
  assert.equal(bilesen(son, 'ay:yayin:sayfa:3').disabled, true);
  assert.equal(son.content, null, 'sayfa değiştirmek mesaj yazmaz');
});

test('YouTube: okunamayan kanal her dakika sorulmaz; hata bir kez yazılır, düzelince söylenir', async () => {
  const youtube = src('yayin/youtube');
  youtube.baslat({ bildir: async () => {}, takipEdilenler: () => ['UCbozuk'] }); // Anahtar yok: zamanlayıcı kurulmaz
  let durum = 404;
  const istekler = [];
  const kayit = [];
  const fetchAsil = global.fetch;
  const [hataAsil, logAsil] = [console.error, console.log];
  global.fetch = async (adres) => (istekler.push(adres), { ok: durum === 200, status: durum, text: async () => '' });
  console.error = (...m) => kayit.push(m.join(' '));
  console.log = (...m) => kayit.push(m.join(' '));
  mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
  try {
    await youtube.kontrolEt();
    await youtube.kontrolEt(); // Hemen ardından: kanala sorulmaz
    assert.equal(istekler.length, 1);
    mock.timers.tick(60_000);
    await youtube.kontrolEt(); // Bir dakika sonra yeniden denenir; aynı hata yeniden yazılmaz
    assert.equal(istekler.length, 2);
    mock.timers.tick(60_000);
    await youtube.kontrolEt(); // Aralık iki katına çıktı (2 dakika)
    assert.equal(istekler.length, 2);
    mock.timers.tick(60_000);
    durum = 200;
    await youtube.kontrolEt();
    assert.equal(istekler.length, 3);
    assert.deepEqual(kayit, [
      'YouTube kanalı okunamadı (UCbozuk): YouTube akışı HTTP 404. Kanala daha seyrek bakılacak.',
      'YouTube kanalı yeniden okunabiliyor (UCbozuk)',
    ]);
  } finally {
    mock.timers.reset();
    global.fetch = fetchAsil;
    [console.error, console.log] = [hataAsil, logAsil];
  }
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

test('/haber ekle formu: aynı sunucuda üst üste ekleme reddedilir; hata sırayı kilitli bırakmaz', async () => {
  // Her ekleme, test bitir[] içindeki çözücüsünü çağırana kadar sürer
  const bitir = [];
  const ekle = haberEkleSahtesi(() => new Promise((coz) => bitir.push(coz)));
  const formla = (sunucu, adres, ek = {}) => kartta('haber', 'ekle-form', { sunucu, form: { adres }, ...ek });
  try {
    const suren = formla('haber-1', 'ornek.com');
    await turBekle();
    assert.match((await formla('haber-1', 'baska.com')).content, /^⏳ Bu sunucuda şu an başka bir kaynak ekleniyor/);
    // Başka sunucu beklemez
    const baskaSuren = formla('haber-2', 'baska.com');
    await turBekle();
    assert.equal(bitir.length, 2);
    bitir[0]({ besleme: { adres: 'https://kotu.example/rss', ad: '[Örnek](https://kotu.example)' } });
    bitir[1]({ hata: 'Bu adreste bir haber beslemesi (RSS) bulamadım.' });
    const [ilk, baska] = await Promise.all([suren, baskaSuren]);
    // Kaynağın adı siteden gelir: cevapta gizli bağlantıya dönüşmez
    assert.equal(ilk.content, '✅ **[Örnek]\\(https://kotu.example)** takibe alındı. Bundan sonra yayınlanan haberler duyurulacak.\nℹ️ Bildirimlerin gelmesi için yukarıdaki menüden bir kanal seç.');
    assert.equal(baska.content, '❌ Bu adreste bir haber beslemesi (RSS) bulamadım.');

    // Beklenmeyen hata genel bir mesajla söylenir, sıra serbest kalır
    ekle.mock.mockImplementation(async () => Promise.reject(new Error('EAI_AGAIN')));
    assert.equal((await hatasiz(() => formla('haber-1', 'ornek.com'))).content, '❌ Kaynak eklenirken bir hata oluştu.');
    ekle.mock.mockImplementation(async () => ({ besleme: { adres: 'https://ornek.com/rss', ad: 'Örnek' } }));
    assert.match((await formla('haber-1', 'ornek.com')).content, /^✅ \*\*Örnek\*\* takibe alındı/);
  } finally {
    ekle.mock.restore();
  }
});

test('/haber: kaynak başına rol formda verilir; listedeyse yalnızca rolü güncellenir; kartta gösterilir', async () => {
  const sunucu = 'haber-rol';
  const ekle = haberEkleSahtesi(async (adres) => ({ besleme: { adres: `https://${adres}/rss`, ad: adres } }));
  const formla = (adres, { form, ...ek } = {}) => kartta('haber', 'ekle-form', { sunucu, form: { adres, ...form }, ...ek });
  try {
    assert.match((await formla('oyun.test', { form: { rol: rol('gizli') } })).content, /etiketleme yetkin yok/);
    assert.equal(ekle.mock.callCount(), 0, 'reddedilecek ekleme için site indirilmez');

    const oyun = await formla('oyun.test', { form: { rol: rol('oyun-haber', { mentionable: true }) }, kanal: sahteKanal('haberler') });
    assert.equal(oyun.content, '✅ **oyun.test** takibe alındı. Bundan sonra yayınlanan haberler duyurulacak.\nBu kaynağın haberlerinde <@&oyun-haber> etiketlenecek.\nℹ️ Henüz bildirim kanalı seçilmemişti; bildirimler bu kanala (<#haberler>) gelecek. Değiştirmek için yukarıdaki kanal menüsünü kullan.');
    assert.equal(ayar(sunucu).haberKanali, 'haberler');
    await formla('tekno.test');
  } finally {
    ekle.mock.restore();
  }
  assert.deepEqual(haber.liste(sunucu).map((k) => k.rol), ['oyun-haber', undefined]);

  // Listedeki kaynağı yeniden eklemek yalnızca rolünü günceller
  const zaten = haberEkleSahtesi(async (adres) => ({ hata: `**${adres}** zaten listede.`, zaten: `https://${adres}/rss` }));
  try {
    assert.equal((await formla('tekno.test', { form: { rol: rol('tekno-haber', { mentionable: true }) } })).content, '✅ **tekno.test** zaten listedeydi; haberlerinde <@&tekno-haber> etiketlenecek.');
    assert.match((await formla('tekno.test')).content, /^❌ \*\*tekno\.test\*\* zaten listede\. Rolünü değiştirmek için/);
  } finally {
    zaten.mock.restore();
  }
  const kart = (await kartAc('haber', { sunucu })).embeds[0].data.fields[0].value;
  assert.equal(kart, '**1.** [oyun.test](https://oyun.test) → <@&oyun-haber>\n**2.** [tekno.test](https://tekno.test) → <@&tekno-haber>');
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

test('/haber: kart sınırı ve kaynakları gösterir; listeden seçilen kaynak çıkarılır (uzun adres sıra numarasıyla)', async () => {
  const uzun = `https://uzun.example/${'a'.repeat(120)}`;
  depo.yaz('haber', {
    'haber-4': [
      { adres: 'https://ornek.com/rss', ad: 'Örnek Haber' },
      { adres: 'https://teknoloji.com/feed', ad: 'Teknoloji *Gündem*' },
      { adres: uzun, ad: 'Uzun' },
      { adres: 'https://kotu.example/rss', ad: 'x](https://kotu.example/tuzak) [Tuzak' },
    ],
  });
  const cevap = await kartAc('haber', { sunucu: 'haber-4' });
  const liste = cevap.embeds[0].data.fields[0];
  assert.equal(liste.name, `Kaynaklar · 4/${haber.SUNUCU_BASI_SINIR}`);
  assert.match(liste.value, /^\*\*1\.\*\* \[Örnek Haber\]\(https:\/\/ornek\.com\)/);
  assert.match(liste.value, /\[Teknoloji \\\*Gündem\\\*\]\(https:\/\/teknoloji\.com\)/);
  // Ad, etiketi erken kapatıp kendi adresine giden bir bağlantı kuramaz
  assert.ok(!liste.value.includes('](https://kotu.example/tuzak)'), liste.value);
  assert.match(liste.value, /\[x\]\\\(https:\/\/kotu\.example\/tuzak\) \[Tuzak\]\(https:\/\/kotu\.example\)$/);
  assert.equal(cevap.embeds[0].data.footer.text, 'Kaynaklar 10 dakikada bir kontrol edilir · Her şeyi aşağıdan değiştirebilirsin');

  const secenekler = bilesen(cevap, 'ay:haber:cikar:0').options;
  assert.deepEqual(secenekler.map((o) => o.value), ['https://ornek.com/rss', 'https://teknoloji.com/feed', '3', 'https://kotu.example/rss']);
  const cikar = async (deger) => (await kartta('haber', 'cikar:0', { sunucu: 'haber-4', degerler: [deger] })).content;
  assert.equal(await cikar('3'), '✅ **Uzun** takipten çıkarıldı.');
  assert.equal(await cikar('https://teknoloji.com/feed'), '✅ **Teknoloji \\*Gündem\\*** takipten çıkarıldı.');
  assert.match(await cikar('https://yok.example/rss'), /listede yok/);
  assert.deepEqual(haber.liste('haber-4').map((k) => k.ad), ['Örnek Haber', 'x](https://kotu.example/tuzak) [Tuzak']);
});

test('Instagram: bağlantı kurulmamışsa bölüm menüde görünmez, ekleme reddedilir, kart uyarır', async () => {
  assert.equal(instagram.hazir(), false);
  assert.equal(ayarlarPaneli.BOLUMLER.find((b) => b.id === 'instagram').gorunur(), false, 'menüde görünmez');
  assert.match((await kartta('nav', '', { sunucu: 'insta-1', degerler: ['instagram'] })).content, /açamazsın/);

  const e = await kartta('instagram', 'ekle-form', { sunucu: 'insta-1', form: { hesap: 'ornek' } });
  assert.match(e.content, /^❌ Instagram bağlantısı henüz kurulmamış/);
  assert.deepEqual(instagram.liste('insta-1'), []);

  const kart = (await kartAc('instagram', { sunucu: 'insta-1' })).embeds[0].data;
  assert.match(kart.description, /^⚠️ Instagram bağlantısı kurulmamış/);
  assert.match(kart.fields[0].value, /^Henüz hesap eklenmemiş/);
});

test('/instagram: hesap başına rol, listeden çıkarma ve deneme bildirimi', async () => {
  const sunucu = 'insta-2';
  const ekle = mock.method(instagram, 'ekle', async (sunucuId) => {
    const hepsi = depo.oku('instagram', {});
    (hepsi[sunucuId] ??= []).push({ giris: 'ornek', ad: 'Örnek Hesap' });
    depo.yaz('instagram', hepsi);
    return { hesap: { ad: 'Örnek Hesap', giris: 'ornek' } };
  });
  const formla = (form) => kartta('instagram', 'ekle-form', { sunucu, form: { hesap: 'ornek', ...form } });
  try {
    const e = await formla({ rol: rol('takipci', { mentionable: true }) });
    assert.match(e.content, /^✅ \*\*Örnek Hesap\*\* \(@ornek\) takibe alındı\. .*\nBu hesabın gönderilerinde <@&takipci> etiketlenecek\./);
    assert.equal(instagram.liste(sunucu)[0].rol, 'takipci');
    ekle.mock.mockImplementation(async () => Promise.reject(new Error('ECONNRESET')));
    assert.match((await hatasiz(() => formla({}))).content, /^❌ Eklenemedi: Instagram'a ulaşılamadı/);
  } finally {
    ekle.mock.restore();
  }

  const hepsi = depo.oku('instagram', {});
  hepsi[sunucu].push({ giris: 'tuzak', ad: 'x](https://kotu.example) [y' });
  depo.yaz('instagram', hepsi);
  // Profil adı serbest metin: kartta etiketi kapatıp başka adrese bağlantı kuramaz
  const kart = await kartAc('instagram', { sunucu });
  assert.equal(kart.embeds[0].data.fields[0].value, '[Örnek Hesap](https://www.instagram.com/ornek/) → <@&takipci> · [x]\\(https://kotu.example) [y](https://www.instagram.com/tuzak/)');
  assert.deepEqual(bilesen(kart, 'ay:instagram:cikar:0').options.map((o) => o.value), ['ornek', 'tuzak']);

  // Listedeki hesabı yeniden eklemek yalnızca rolünü günceller
  const zaten = mock.method(instagram, 'ekle', async () => ({ hata: '**@ornek** zaten listede.', zaten: 'ornek' }));
  try {
    assert.equal((await formla({ rol: rol('yeni-rol', { mentionable: true }) })).content, '✅ **Örnek Hesap** (@ornek) zaten listedeydi; gönderilerinde <@&yeni-rol> etiketlenecek.');
  } finally {
    zaten.mock.restore();
  }
  assert.equal(instagram.liste(sunucu)[0].rol, 'yeni-rol');

  assert.equal((await kartta('instagram', 'cikar:0', { sunucu, degerler: ['ornek'] })).content, '✅ **Örnek Hesap** (@ornek) takipten çıkarıldı.');
  assert.match((await kartta('instagram', 'cikar:0', { sunucu, degerler: ['ornek'] })).content, /listede yok/);

  const kanal = sahteKanal('insta');
  depo.ayarKaydet(sunucu, 'instagramKanali', 'insta');
  depo.ayarKaydet(sunucu, 'instagramRol', 'takipci');
  assert.match((await kartta('instagram', 'deneme', { sunucu, kanallar: { insta: kanal } })).content, /✅ <#insta> kanalına deneme bildirimi gönderildi/);
  assert.deepEqual(kanal.gonderilen[0].allowedMentions, { parse: [] }, 'deneme bildirimi seçili rolü etiketlemez');
});

// --- /ayarlar → Koruma, Uyarı kuralları, Seviye ---
test('/ayarlar → Koruma: filtreler düğmeyle açılıp kapanır; susturma süreleri formla değişir', async () => {
  const koruma = src('koruma');
  const sunucu = 'koruma-1';
  const bas = (islem, ek = {}) => kartta('koruma', islem, { sunucu, botIzinleri: [P.ManageMessages, P.ModerateMembers], intents: [GatewayIntentBits.MessageContent], ...ek });
  assert.deepEqual(bilesenleri(kartAc('koruma', { sunucu })).slice(0, 4), [
    ['ay:koruma:spam', 'Spam: Kapalı'],
    ['ay:koruma:kufur', 'Küfür: Kapalı'],
    ['ay:koruma:gorsel', 'Görsel: Kapalı'],
    ['ay:koruma:baglanti', 'Bağlantı: Kapalı'],
  ]);

  const acik = await bas('spam');
  assert.match(acik.content, /^✅ Spam koruması açık\..* ve üye 1 saat susturulur\./);
  assert.doesNotMatch(acik.content, /izinleri ver/);
  assert.equal(koruma.ayarCoz(ayar(sunucu)).spam, true);
  assert.equal(bilesen(acik, 'ay:koruma:spam').label, 'Spam: Açık', 'düğme güncellenir');
  assert.equal((await bas('spam')).content, '✅ Spam koruması kapatıldı.');
  // Bot izinleri eksikse açılır ama söylenir
  assert.match((await bas('spam', { botIzinleri: [] })).content, /bana şu izinleri ver: Mesajları Yönet, Üyelere Zaman Aşımı Uygula/);

  // Küfür ve bağlantı mesaj içeriğini okuyabilmeli; görsel ayrıca yapay zekâ ister
  assert.match((await bas('kufur', { intents: [] })).content, /Message Content Intent/);
  assert.equal(koruma.ayarCoz(ayar(sunucu)).kufur, false);
  assert.match((await bas('gorsel')).content, /yapay zekâ kurulu değil/);
  assert.match((await bas('baglanti')).content, /^✅ Bağlantı denetimi açık/);

  // Süreler formu mevcut değerlerle dolu açılır; geçersiz değer reddedilir, diğerleri kaydedilir
  const form = (await bas('sureler')).form;
  assert.equal(form.custom_id, 'ay:koruma:sureler-form');
  assert.deepEqual(form.components.map((c) => [c.component.custom_id, c.component.value]), [['spam', '60'], ['kufur', '0'], ['gorsel', '1440'], ['baglanti', '60']]);
  const kayit = await bas('sureler-form', { form: { spam: '5', kufur: '10', gorsel: 'abc', baglanti: '0' } });
  assert.equal(kayit.content, '❌ Görsel denetimi: 0 ile 40320 arasında bir sayı yaz.');
  const a = koruma.ayarCoz(ayar(sunucu));
  assert.deepEqual([a.spamDakika, a.kufurDakika, a.gorselDakika, a.baglantiDakika], [5, 10, 1440, 0]);
  assert.match(kayit.embeds[0].data.fields.find((f) => f.name === 'Bağlantı denetimi').value, /Yalnızca silme/);

  assert.match((await bas('kapsam')).content, /bütün resimlere/);
  assert.equal(koruma.ayarCoz(ayar(sunucu)).gorselKapsam, 'hepsi');
  assert.match((await bas('kisaltici')).content, /da silinecek/);
  assert.equal(koruma.ayarCoz(ayar(sunucu)).kisaltici, true);
});

test('/ayarlar → Koruma: özel kelimeler ve alan listeleri formla değişir', async () => {
  const koruma = src('koruma');
  const sunucu = 'koruma-2';
  const bas = (islem, form) => kartta('koruma', islem, { sunucu, form });
  // Kısa ve tekrar eden kelimeler atlanır
  assert.equal((await bas('kelimeler-form', { ekle: 'Deneme, ikinci deneme x' })).content, '✅ 2 kelime eklendi.');
  assert.deepEqual(koruma.ayarCoz(ayar(sunucu)).kelimeler, ['deneme', 'ikinci']);
  assert.equal((await bas('kelimeler-form', { ekle: 'deneme', cikar: 'İkinci' })).content, '✅ 1 kelime çıkarıldı.');
  assert.deepEqual(koruma.ayarCoz(ayar(sunucu)).kelimeler, ['deneme']);
  assert.match((await bas('kelimeler-form', {})).content, /Değişen bir şey olmadı/);

  const alan = await bas('alanlar-form', { engel: 'kotu.site https://sahte.link/x', izin: 'iyi.com' });
  assert.match(alan.content, /^✅ Alan listeleri kaydedildi\.\nBağlantı denetimi şu an kapalı/);
  let ayarlar = koruma.ayarCoz(ayar(sunucu));
  assert.deepEqual([ayarlar.alanEngel, ayarlar.alanIzin], [['kotu.site', 'sahte.link'], ['iyi.com']]);
  // Bir alan iki listede birden durmaz; geçersiz alan söylenir
  assert.match((await bas('alanlar-form', { izin: 'kotu.site', engel: 'gecersiz!' })).content, /Geçersiz alan adı, eklenmedi: `gecersiz!`/);
  ayarlar = koruma.ayarCoz(ayar(sunucu));
  assert.deepEqual([ayarlar.alanEngel, ayarlar.alanIzin], [['sahte.link'], ['iyi.com', 'kotu.site']]);
  await bas('alanlar-form', { cikar: 'iyi.com, sahte.link' });
  ayarlar = koruma.ayarCoz(ayar(sunucu));
  assert.deepEqual([ayarlar.alanEngel, ayarlar.alanIzin], [[], ['kotu.site']]);
});

test('moderasyon kartından uyarı silme; /ayarlar → Uyarı kuralları: kural formla eklenir, listeden kaldırılır', async () => {
  const uyari = src('uyari');
  const moderasyon = src('moderasyon');
  const sunucu = 'uyari-ayar';
  for (let i = 0; i < 3; i++) uyari.ekle(sunucu, 'h', { id: String(i), sebep: `s${i}`, yetkiliId: 'mod', zaman: 1 });
  const kartSil = async (customId, values = []) => {
    const e = etkilesim({ sunucu, izinler: [P.ModerateMembers] });
    e.guild.members.fetch = async (id) => ({ id, user: kullanici(id) });
    Object.assign(e, {
      customId,
      values,
      isButton: () => !values.length,
      isModalSubmit: () => false,
      isFromMessage: () => true,
      deferUpdate: async () => {},
    });
    await moderasyon.etkilesim(e);
    return e.cevaplar.at(-1).content;
  };

  assert.match(await kartSil('md:uyari-sil:h', ['2']), /2\. uyarısı silindi/);
  assert.deepEqual(uyari.uyarilar(sunucu, 'h').map((u) => u.sebep), ['s0', 's2']);
  assert.match(await kartSil('md:uyari-temizle:h'), /2 uyarısı silindi/);
  assert.equal(uyari.uyarilar(sunucu, 'h').length, 0);

  const bas = (islem, ek = {}) => kartta('uyari', islem, { sunucu, izinler: [P.ManageGuild, P.ModerateMembers], ...ek });
  assert.match(kartAc('uyari', { sunucu }).embeds[0].data.description, /Henüz kural yok/);
  assert.equal(bilesen(kartAc('uyari', { sunucu }), 'ay:uyari:sil'), undefined, 'kural yokken kaldırma listesi yok');
  assert.equal((await bas('ekle')).form.custom_id, 'ay:uyari:ekle-form');
  assert.match((await bas('ekle-form', { form: { esik: '0', islem: 'sustur' } })).content, /Eşik 1 ile 20/);
  assert.match((await bas('ekle-form', { form: { esik: '3' } })).content, /Ne yapılacağını seç/);
  // Kural yetki aşmaya yaramaz
  assert.match((await bas('ekle-form', { form: { esik: '3', islem: 'yasakla' } })).content, /Yasaklama kuralı ekleyebilmek için/);
  const kayit = await bas('ekle-form', { form: { esik: '3', islem: 'sustur', dakika: '1440' } });
  assert.equal(kayit.content, '✅ Kural kaydedildi: 3 uyarı → susturma (1 gün).\n⚠️ Bunun çalışması için bana Üyelere Zaman Aşımı Uygula iznini ver.');
  assert.deepEqual(bilesen(kayit, 'ay:uyari:sil').options.map((o) => o.value), ['3']);
  // Süre boşsa 60 dakika; aynı eşik yenisiyle değişir
  await bas('ekle-form', { form: { esik: '3', islem: 'sustur' } });
  assert.deepEqual(uyari.kurallar(sunucu), [{ esik: 3, islem: 'sustur', dakika: 60 }]);
  assert.equal((await bas('sil', { degerler: ['3'] })).content, '✅ 3 uyarı kuralı kaldırıldı.');
  assert.deepEqual(uyari.kurallar(sunucu), []);
});

test('/ayarlar → Seviye: aç/kapat, duyuru kanalı, ödül ekle ve kaldır, XP sıfırla', async () => {
  const sunucu = 'seviye-panel';
  const bas = (islem, ek = {}) => kartta('seviye', islem, { sunucu, ...ek });
  assert.match(kartAc('seviye', { sunucu }).embeds[0].data.description, /\*\*Durum:\*\* ⚫ Kapalı/);

  assert.equal((await bas('kanal', { secilenKanal: sahteKanal('seviye') })).content, '✅ Seviye atlayanlar <#seviye> kanalında duyurulacak.');
  assert.deepEqual([ayar(sunucu).seviyeAcik, ayar(sunucu).seviyeKanali], [undefined, 'seviye'], 'kanal seçmek sistemi açmaz');
  assert.equal((await bas('durum')).content, '✅ Seviye sistemi açık. Üyeler mesaj yazdıkça XP kazanır.\nSeviye atlayanlar <#seviye> kanalında duyurulur.');
  assert.equal(ayar(sunucu).seviyeAcik, true);

  const odulRolu = rol('aktif', { managed: false, position: 3, permissions: izinli(), name: 'Aktif' });
  assert.match((await bas('odul-form', { form: { seviye: '5', rol: odulRolu } })).content, /sen de veremiyorsun/);
  assert.match((await bas('odul-form', { form: { seviye: '500', rol: odulRolu } })).content, /1 ile 200/);
  const odul = await bas('odul-form', { form: { seviye: '5', rol: odulRolu }, izinler: [P.ManageGuild, P.ManageRoles], botIzinleri: [P.ManageRoles] });
  assert.match(odul.content, /^✅ 5\. seviyeye ulaşanlara <@&aktif> rolü verilecek\./);
  assert.match(odul.embeds[0].data.description, /5\. seviye → <@&aktif>/);
  assert.deepEqual(bilesen(odul, 'ay:seviye:odul-sil').options.map((o) => o.value), ['5']);
  assert.equal((await bas('odul-sil', { degerler: ['5'] })).content, '✅ 5. seviye ödülü kaldırıldı. Rolü almış olanlardan geri alınmaz.');
  assert.deepEqual(ayar(sunucu).seviyeOdulleri, []);

  assert.match((await bas('sifirla-form', { form: { uye: kullanici('yok') } })).content, /henüz XP kazanmamış/);
  assert.equal((await bas('kanal', { secilenKanal: null })).content, '✅ Seviye atlayanlar artık mesajı yazdıkları kanalda duyurulur.');
  assert.match((await bas('durum')).content, /^✅ Seviye sistemi kapatıldı/);
});
