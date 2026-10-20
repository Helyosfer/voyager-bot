// /sunucukur şablonlarının testleri: her şablon tutarlı ve Discord sınırlarına uygun, kurulum
// rolleri ve kanalları oluşturur, bot ayarlarını bağlar, varsayılanları yalnızca boş olanlara uygular.
// Çalıştırmak için: npm test
//
// Bot başlatılmaz, Discord'a bağlanılmaz: kurulum sahte bir sunucuya yapılır. Veri geçici bir klasöre yazılır.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const VERI = fs.mkdtempSync(path.join(os.tmpdir(), 'voyager-sablon-'));
process.env.VERI_KLASORU = VERI;
after(() => fs.rmSync(VERI, { recursive: true, force: true }));

const { ChannelType, Collection, GatewayIntentBits, IntentsBitField, PermissionsBitField } = require('discord.js');
const src = (dosya) => require(path.join(__dirname, '..', 'src', dosya));
const depo = src('depo');
const { ROL, SABLONLAR, POLITIKALAR, ERISIMLER, rolleri } = src('sablonlar');
const topluluk = src('topluluk');
const sunucukur = src('commands/sunucukur');

// Botun bağlayabildiği ayarlar (kanal ve rol)
const KANAL_AYARLARI = ['logKanali', 'hosgeldinKanali', 'oyunKanali', 'yayinKanali', 'haberKanali'];
const ROL_AYARLARI = ['oyunRol', 'yayinRol', 'haberRol'];

test('şablonlar: roller, izinler ve kanallar tutarlı; Discord sınırlarına sığar', () => {
  assert.ok(Object.keys(SABLONLAR).length >= 7);
  for (const [ad, s] of Object.entries(SABLONLAR)) {
    assert.ok(s.ad && s.aciklama.length <= 100, `${ad}: açıklama menüye sığmalı`);
    for (const k of s.roller) assert.ok(ROL[k], `${ad}: "${k}" diye rol yok`);
    for (const k of Object.keys(s.rolAdlari ?? {})) assert.ok(s.roller.includes(k), `${ad}: adı değişen ${k} şablonda yok`);
    const roller = rolleri(s);
    assert.equal(new Set(roller.map((r) => r.ad)).size, roller.length, `${ad}: rol adları tekil`);

    // Rol seçimi menüsü en fazla 25 seçenek alır
    const ilgi = topluluk.ilgiRolleri(s);
    assert.ok(ilgi.length <= 25, `${ad}: ${ilgi.length} seçilebilir rol`);

    const goruldu = new Set();
    const anahtarlar = new Set();
    let toplam = 0;
    for (const kategori of s.kategoriler) {
      assert.ok(POLITIKALAR[kategori.politika], `${ad}/${kategori.ad}: politika yok`);
      assert.ok(kategori.kanallar.length <= 50, `${ad}/${kategori.ad}: Discord kategoride en fazla 50 kanal`);
      assert.ok(!goruldu.has(`kategori:${kategori.ad}`), `${ad}: ${kategori.ad} iki kez`);
      goruldu.add(`kategori:${kategori.ad}`);
      if (kategori.anahtar) anahtarlar.add(kategori.anahtar);
      for (const kanal of kategori.kanallar) {
        toplam++;
        const tur = kanal.ses ? 'ses' : 'yazi';
        // Kurulum mevcut kanalları adıyla tanır: aynı adda iki kanal birbirinin yerine sayılır
        assert.ok(!goruldu.has(`${tur}:${kanal.ad}`), `${ad}: "${kanal.ad}" iki kez`);
        goruldu.add(`${tur}:${kanal.ad}`);
        assert.ok(kanal.ad.length <= 100 && (kanal.konu ?? '').length <= 1024, `${ad}/${kanal.ad}`);
        if (kanal.erisim) assert.ok(ERISIMLER[kanal.erisim], `${ad}/${kanal.ad}: erişim "${kanal.erisim}" yok`);
        if (kanal.ayar) assert.ok(KANAL_AYARLARI.includes(kanal.ayar), `${ad}/${kanal.ad}: "${kanal.ayar}" bağlanamaz`);
        if (kanal.anahtar) anahtarlar.add(kanal.anahtar);
        if (kanal.ses) assert.equal(kanal.konu, undefined, `${ad}/${kanal.ad}: ses kanalına konu yazılamaz`);
      }
    }
    assert.ok(toplam + s.kategoriler.length <= 500, `${ad}: sunucu en fazla 500 kanal`);

    // Akışların gerektirdikleri
    if (s.onay) {
      for (const k of ['uye', 'yeni']) assert.ok(s.roller.includes(k), `${ad}: üyelik onayı "${k}" rolünü ister`);
      assert.ok(anahtarlar.has('onay'), `${ad}: üyelik onayı kanalı yok`);
    } else {
      assert.ok(!anahtarlar.has('onay') && !s.roller.includes('yeni'), `${ad}: onaysız şablonda onay akışı olmaz`);
    }
    if (anahtarlar.has('rol')) assert.ok(ilgi.length, `${ad}: rol seçimi kanalı var ama seçilecek rol yok`);
    if (anahtarlar.has('destek')) {
      assert.ok(anahtarlar.has('talepler') && anahtarlar.has('destekKayit'), `${ad}: destek akışı eksik`);
      assert.ok(s.roller.includes('destek'), `${ad}: destek odalarını görecek ekip rolü yok`);
    }
    assert.ok(goruldu.has('yazi:📋・mod-log'), `${ad}: her şablonda günlük kanalı olmalı`);
    for (const [ayar, rol] of Object.entries(s.rolAyarlari ?? {})) {
      assert.ok(ROL_AYARLARI.includes(ayar) && s.roller.includes(rol) && ROL[rol].bildirim, `${ad}: ${ayar} → ${rol}`);
    }
    for (const v of s.ayarlar ?? []) assert.ok(v.anahtar && v.ad && v.deger !== undefined, `${ad}: varsayılan ayar eksik`);
  }
});

// Gömülü mesajın Discord'un saydığı toplam uzunluğu (sınır 6000)
const gomuluUzunluk = (e) =>
  (e.title?.length ?? 0) +
  (e.description?.length ?? 0) +
  (e.footer?.text.length ?? 0) +
  (e.fields ?? []).reduce((t, f) => t + f.name.length + f.value.length, 0);
const sigar = (e, ad) => {
  assert.ok(gomuluUzunluk(e) <= 6000, `${ad}: ${gomuluUzunluk(e)} karakter`);
  assert.ok((e.fields ?? []).length <= 25 && (e.description ?? '').length <= 4096, ad);
  for (const f of e.fields ?? []) assert.ok(f.value.length <= 1024 && f.name.length <= 256, `${ad} · ${f.name}`);
};

// Sahte sunucu: oluşturulan rol ve kanallar önbelleğe girer, kanallara gönderilenler tutulur
function kurulumSunucusu(id, { intents = [GatewayIntentBits.MessageContent] } = {}) {
  let sayac = 0;
  const yeniId = () => `${id}-${++sayac}`;
  const roller = new Collection([[id, { id, name: '@everyone', position: 0 }]]);
  const kanallar = new Collection();
  return {
    id,
    client: { options: { intents: new IntentsBitField(intents) } },
    members: { me: { id: 'bot', permissions: new PermissionsBitField(PermissionsBitField.All), roles: { highest: { position: 1000 } } } },
    roles: {
      everyone: { id },
      cache: roller,
      create: async (o) => {
        const rol = { id: yeniId(), name: o.name, mentionable: o.mentionable, hoist: o.hoist, permissions: o.permissions, position: roller.size, toString: () => `<@&${rol.id}>` };
        roller.set(rol.id, rol);
        return rol;
      },
      setPositions: async () => {},
    },
    channels: {
      cache: kanallar,
      create: async (o) => {
        const kanal = { ...o, id: yeniId(), parentId: o.parent ?? null, gonderilen: [], send: async (m) => kanal.gonderilen.push(m), toString: () => `<#${kanal.id}>` };
        kanallar.set(kanal.id, kanal);
        return kanal;
      },
    },
  };
}
const kanalBul = (guild, ad) => guild.channels.cache.find((k) => k.name === ad);
const rolBul = (guild, ad) => guild.roles.cache.find((r) => r.name === ad);

test('önizleme, şablon listesi ve sonuç kartı Discord sınırlarına sığar', () => {
  sigar(sunucukur.sablonListesi().toJSON(), 'şablon listesi');
  for (const ad of Object.keys(SABLONLAR)) {
    const plan = topluluk.planla(kurulumSunucusu(`onizleme-${ad}`), ad);
    sigar(sunucukur.onizleme(plan, ['Bağlan', 'Konuş']).toJSON(), `${ad} önizlemesi`);
    const sonuc = { olusturulan: 99, baglanan: Array(12).fill('<#123456789012345678> → oyun fırsatları'), acilan: ['Spam koruması', 'Seviye sistemi'], uyarilar: [], hata: null };
    sigar(sunucukur.sonucKarti(sonuc, SABLONLAR[ad]).toJSON(), `${ad} sonuç kartı`);
  }
});

test('kurulum: her şablon kurulur, kanallar bota bağlanır, ikinci çalıştırmada eksik kalmaz', async () => {
  for (const ad of Object.keys(SABLONLAR)) {
    const guild = kurulumSunucusu(`kur-${ad}`);
    const sablon = SABLONLAR[ad];
    const plan = topluluk.planla(guild, ad);
    const sonuc = await topluluk.kur(guild, plan, 'yonetici#0');
    assert.equal(sonuc.hata, null, `${ad}: ${sonuc.hata}`);
    assert.equal(sonuc.olusturulan, plan.yeni, ad);
    assert.equal(topluluk.planla(guild, ad).yeni, 0, `${ad}: yeniden çalıştırınca oluşturulacak bir şey kalmaz`);

    const ayar = depo.ayarlariGetir(guild.id);
    assert.equal(ayar.topluluk.sablon, ad);
    for (const kanal of sablon.kategoriler.flatMap((k) => k.kanallar).filter((k) => k.ayar)) {
      assert.equal(ayar[kanal.ayar], kanalBul(guild, kanal.ad).id, `${ad}: ${kanal.ayar}`);
    }
    // Bildirim rolleri etiketlenebilir, diğerleri değil
    for (const rol of rolleri(sablon)) assert.equal(rolBul(guild, rol.ad).mentionable, Boolean(rol.bildirim), `${ad}: ${rol.ad}`);
    for (const [anahtar, rol] of Object.entries(sablon.rolAyarlari ?? {})) assert.equal(ayar[anahtar], ayar.topluluk.roller[rol], `${ad}: ${anahtar}`);
    // Üyelik onayı yalnızca onaylı şablonlarda: yeni gelen "Yeni Gelen" rolüyle başlar
    assert.equal(ayar.otoRol, sablon.onay ? ayar.topluluk.roller.yeni : undefined, `${ad}: oto rol`);
    for (const v of sablon.ayarlar ?? []) assert.equal(ayar[v.anahtar], v.deger, `${ad}: ${v.ad}`);
  }
});

test('kurulum: önceden seçilmiş ayarlara dokunulmaz; mesaj metni okunamıyorsa ona dayanan korumalar açılmaz', async () => {
  const guild = kurulumSunucusu('kur-dokunma', { intents: [] });
  depo.ayarKaydet(guild.id, 'korumaSpam', false); // Yönetici spam korumasını bilerek kapatmış
  depo.ayarKaydet(guild.id, 'yayinRol', 'kendi-rolum');
  const plan = topluluk.planla(guild, 'yayinci');
  assert.deepEqual(plan.ayarlar.map((a) => a.anahtar), ['seviyeAcik']);
  assert.deepEqual(plan.atlanan.map((a) => a.anahtar), ['korumaBaglanti', 'korumaKufur']);
  assert.match(sunucukur.onizleme(plan, []).toJSON().fields.at(-1).value, /Açılmayacak: Zararlı bağlantı denetimi, Küfür filtresi/);

  const sonuc = await topluluk.kur(guild, plan, 'yonetici#0');
  const ayar = depo.ayarlariGetir(guild.id);
  assert.equal(ayar.korumaSpam, false);
  assert.equal(ayar.korumaBaglanti, undefined);
  assert.equal(ayar.yayinRol, 'kendi-rolum');
  assert.deepEqual(sonuc.acilan, ['Seviye sistemi']);
});

test('kurulum: tanıtım mesajları şablona uyar; hoş geldin yalnızca var olan kanalları anlatır', async () => {
  const basit = kurulumSunucusu('mesaj-basit');
  await topluluk.kur(basit, topluluk.planla(basit, 'basit'), 'y#0');
  const hosgeldin = kanalBul(basit, '👋・hoş-geldin').gonderilen[0].embeds[0].data.description;
  assert.doesNotMatch(hosgeldin, /üye ol|destek|#onay|#rol/, 'basit şablonda onay, rol seçimi ve destek yok');

  const oyun = kurulumSunucusu('mesaj-oyun');
  await topluluk.kur(oyun, topluluk.planla(oyun, 'oyun'), 'y#0');
  const metin = kanalBul(oyun, '👋・hoş-geldin').gonderilen[0].embeds[0].data.description;
  assert.match(metin, /\*\*1\.\*\* <#.+> kanalını oku\.\n\*\*2\.\*\* <#.+> kanalındaki düğmeye basarak üye ol\./);
  // Rol seçimi menüsü şablonun ilgi ve bildirim rollerini sunar
  const menu = kanalBul(oyun, '🎭・rol-seçimi').gonderilen[0].components[0].toJSON().components[0];
  assert.deepEqual(menu.options.map((o) => o.value), topluluk.ilgiRolleri(SABLONLAR.oyun).map((r) => r.k));
  assert.ok(menu.options.some((o) => o.value === 'oyunHaber'), 'oyun haberleri bildirim rolü seçilebilir');
  assert.equal(menu.max_values, menu.options.length);
  // Rehber şablonun kategorilerini anlatır
  const rehber = kanalBul(oyun, '🧭・sunucu-rehberi').gonderilen[0].embeds[0].data.description;
  assert.match(rehber, /OYUN DÜNYASI\*\* · bedava oyunlar/);
});

// Sahte üye ve rol menüsü etkileşimi
function rolSecimi(guild, values, uyeRolleri = []) {
  const roller = new Set(uyeRolleri);
  const cevaplar = [];
  return {
    roller,
    cevaplar,
    customId: 'tp:rol',
    guildId: guild.id,
    guild,
    values,
    inCachedGuild: () => true,
    member: { roles: { cache: { has: (id) => roller.has(id) }, add: async (id) => roller.add(id), remove: async (id) => roller.delete(id) } },
    reply: async (m) => cevaplar.push(m),
  };
}

test('rol seçimi: onaysız şablonda herkes seçer; onaylı şablonda önce üye olmak gerekir', async () => {
  const yayinci = kurulumSunucusu('secim-yayinci');
  await topluluk.kur(yayinci, topluluk.planla(yayinci, 'yayinci'), 'y#0');
  const t = depo.ayarlariGetir(yayinci.id).topluluk;
  const e = rolSecimi(yayinci, ['yayinBildirim', 'muzik']);
  await topluluk.etkilesim(e);
  assert.deepEqual([...e.roller].sort(), [t.roller.yayinBildirim, t.roller.muzik].sort());
  assert.match(e.cevaplar[0].content, /Yayın Bildirimi/);
  // Seçmediği rol bırakılır
  const birak = rolSecimi(yayinci, ['muzik'], [t.roller.yayinBildirim, t.roller.muzik]);
  await topluluk.etkilesim(birak);
  assert.deepEqual([...birak.roller], [t.roller.muzik]);

  const oyun = kurulumSunucusu('secim-oyun');
  await topluluk.kur(oyun, topluluk.planla(oyun, 'oyun'), 'y#0');
  const to = depo.ayarlariGetir(oyun.id).topluluk;
  const uyeDegil = rolSecimi(oyun, ['firsat']);
  await topluluk.etkilesim(uyeDegil);
  assert.match(uyeDegil.cevaplar[0].content, /Önce .* üye ol/);
  assert.equal(uyeDegil.roller.size, 0);
  const uye = rolSecimi(oyun, ['firsat', 'oyunHaber'], [to.roller.uye]);
  await topluluk.etkilesim(uye);
  assert.ok(uye.roller.has(to.roller.firsat) && uye.roller.has(to.roller.oyunHaber));
});

test('eski kurulum (şablon adı yok) topluluk şablonu sayılır', async () => {
  const guild = kurulumSunucusu('eski-kurulum');
  await topluluk.kur(guild, topluluk.planla(guild, 'topluluk'), 'y#0');
  const t = depo.ayarlariGetir(guild.id).topluluk;
  delete t.sablon;
  depo.ayarKaydet(guild.id, 'topluluk', t);
  const e = rolSecimi(guild, ['muzik', 'film'], [t.roller.uye]);
  await topluluk.etkilesim(e);
  assert.ok(e.roller.has(t.roller.muzik) && e.roller.has(t.roller.film));
});

test('/sunucukur: şablon verilmezse açıklamalı liste ve menü gösterilir; komut şablon seçeneği taşır', () => {
  const veri = sunucukur.data.toJSON();
  const secenek = veri.options.find((o) => o.name === 'sablon');
  assert.deepEqual(secenek.choices.map((c) => c.value), Object.keys(SABLONLAR));
  assert.equal(secenek.required, false);
  const liste = sunucukur.sablonListesi().toJSON();
  assert.equal(liste.fields.length, Object.keys(SABLONLAR).length);
  assert.match(liste.fields.find((f) => f.name.includes('Yayıncı')).value, /onaysız/);
  assert.match(liste.fields.find((f) => f.name.includes('Topluluk')).value, /üyelik onayı, destek talepleri/);
  assert.equal(ChannelType.GuildCategory, 4);
});
