// /sunucukur şablonlarının testleri: her şablon tutarlı ve Discord sınırlarına uygun, kurulum
// rolleri ve kanalları oluşturur, bot ayarlarını bağlar, varsayılanları yalnızca boş olanlara uygular;
// kaldırma yalnızca kurulumun oluşturduklarını siler ve değişen ayarları eski haline getirir.
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
        const rol = { id: yeniId(), name: o.name, mentionable: o.mentionable, hoist: o.hoist, permissions: o.permissions, position: roller.size, toString: () => `<@&${rol.id}>`, delete: async () => roller.delete(rol.id) };
        roller.set(rol.id, rol);
        return rol;
      },
      setPositions: async () => {},
    },
    channels: {
      cache: kanallar,
      create: async (o) => {
        const kanal = { ...o, id: yeniId(), parentId: o.parent ?? null, gonderilen: [], send: async (m) => kanal.gonderilen.push(m), toString: () => `<#${kanal.id}>`, delete: async () => kanallar.delete(kanal.id) };
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

// --- Kurulu şablonu kaldırma ---
// Sunucuyu kurulumdan önceki haliyle karşılaştırmak için: ad listeleri
const adlar = (guild) => ({
  roller: [...guild.roles.cache.values()].map((r) => r.name).sort(),
  kanallar: [...guild.channels.cache.values()].map((k) => `${k.type}:${k.name}`).sort(),
});

// Sunucunun kurulumdan önce zaten sahip olduğu şeyler: şablonla aynı adda bir rol ve bir kanal da var
async function kullanilmisSunucu(id) {
  const guild = kurulumSunucusu(id);
  await guild.roles.create({ name: '🎮 Oyuncu' }); // topluluk şablonundaki bir rolle aynı ad
  await guild.roles.create({ name: 'Kendi Rolüm' });
  await guild.channels.create({ name: '💬・genel-sohbet', type: ChannelType.GuildText }); // şablondakiyle aynı ad, kategorisiz
  await guild.channels.create({ name: 'benim-kanalim', type: ChannelType.GuildText });
  depo.ayarKaydet(id, 'logKanali', 'eski-log-kanali'); // kurulum bunu kendi kanalına çevirir
  return guild;
}

test('kaldırma: kurulumun oluşturduklarını siler, önceden var olanlara ve senin eklediklerine dokunmaz, ayarları eski haline getirir', async () => {
  const guild = await kullanilmisSunucu('kaldir-1');
  const oncesi = adlar(guild);
  const ayarOncesi = depo.ayarlariGetir(guild.id);
  assert.equal(topluluk.kuruluMu(guild.id), false);
  assert.equal(topluluk.kaldirmaPlani(guild), null);

  const sonuc = await topluluk.kur(guild, topluluk.planla(guild, 'topluluk'), 'y#0');
  assert.equal(sonuc.hata, null);
  assert.equal(topluluk.kuruluMu(guild.id), true);

  // Kurulumdan sonra: üye bir destek odası açmış, yönetici kendi kanalını şablon kategorisine koymuş, bir ayarı değiştirmiş
  const t = depo.ayarlariGetir(guild.id).topluluk;
  const oda = await guild.channels.create({ name: 'talep-giris-1234', type: ChannelType.GuildText, parent: t.kategoriler.talepler });
  oda.topic = 'sahip=111; konu=giris';
  const topluluk_kategorisi = kanalBul(guild, '💬・TOPLULUK');
  await guild.channels.create({ name: 'benim-ek-kanalim', type: ChannelType.GuildText, parent: topluluk_kategorisi.id });
  depo.ayarKaydet(guild.id, 'korumaSpam', false);

  const plan = topluluk.kaldirmaPlani(guild);
  assert.equal(plan.eski, false);
  assert.equal(plan.odalar.length, 1, 'destek odası kaldırılan kategoriyle gider');
  assert.ok(!plan.roller.some((r) => r.name === 'Kendi Rolüm'));
  assert.ok(!plan.roller.some((r) => r.name === '🎮 Oyuncu' && r.id.startsWith('kaldir-1-1')), 'önceden var olan rol listede değil');
  const korunan = plan.kategoriler.find((k) => k.kategori.id === topluluk_kategorisi.id);
  assert.equal(korunan.kalan.length, 1, 'senin eklediğin kanal kategoriyi ayakta tutar');

  const silme = await topluluk.kaldir(guild, plan, 'y#0');
  assert.deepEqual(silme.basarisiz, []);
  assert.deepEqual(silme.kalanKategoriler, [{ ad: '💬・TOPLULUK', adet: 1 }]);

  const sonra = adlar(guild);
  // Kalanlar: kurulumdan önceki her şey + senin eklediğin kanal + onu taşıyan kategori
  const beklenenKanallar = [...oncesi.kanallar, `${ChannelType.GuildText}:benim-ek-kanalim`, `${ChannelType.GuildCategory}:💬・TOPLULUK`].sort();
  assert.deepEqual(sonra.kanallar, beklenenKanallar);
  assert.deepEqual(sonra.roller, oncesi.roller, 'roller kurulumdan önceki haline döndü');

  // Ayarlar: kurulumun değiştirdikleri eski haline döndü; sonradan elle değiştirilen kaldı; kayıt silindi
  const ayar = depo.ayarlariGetir(guild.id);
  assert.equal(ayar.logKanali, ayarOncesi.logKanali, 'üzerine yazılan ayar eski değerine döner');
  for (const anahtar of ['hosgeldinKanali', 'oyunKanali', 'yayinKanali', 'haberKanali', 'oyunRol', 'yayinRol', 'otoRol', 'korumaBaglanti', 'seviyeAcik']) {
    assert.equal(ayar[anahtar], undefined, anahtar);
  }
  assert.equal(ayar.korumaSpam, false, 'sonradan elle değiştirilen ayara dokunulmaz');
  assert.equal(ayar.topluluk, undefined);
  assert.equal(ayar.sablonKaydi, undefined);
  assert.equal(topluluk.kuruluMu(guild.id), false);
});

test('kaldırma: hiçbir şeyin önceden var olmadığı sunucu kurulumdan önceki haline döner; kaldırdıktan sonra yeniden kurulabilir', async () => {
  for (const ad of Object.keys(SABLONLAR)) {
    const guild = kurulumSunucusu(`kaldir-hepsi-${ad}`);
    const oncesi = adlar(guild);
    await topluluk.kur(guild, topluluk.planla(guild, ad), 'y#0');
    const silme = await topluluk.kaldir(guild, topluluk.kaldirmaPlani(guild), 'y#0');
    assert.deepEqual(silme.basarisiz, [], ad);
    assert.deepEqual(adlar(guild), oncesi, `${ad}: sunucu eski haline döndü`);
    assert.deepEqual(depo.ayarlariGetir(guild.id), {}, `${ad}: ayarlar eski haline döndü`);
    // Yeniden kurulabilir
    assert.equal((await topluluk.kur(guild, topluluk.planla(guild, ad), 'y#0')).hata, null, ad);
  }
});

test('kaldırma: art arda iki şablon kurulduysa ikisi de kaldırılır', async () => {
  const guild = kurulumSunucusu('kaldir-iki');
  const oncesi = adlar(guild);
  await topluluk.kur(guild, topluluk.planla(guild, 'basit'), 'y#0');
  await topluluk.kur(guild, topluluk.planla(guild, 'oyun'), 'y#0');
  const silme = await topluluk.kaldir(guild, topluluk.kaldirmaPlani(guild), 'y#0');
  assert.deepEqual(silme.basarisiz, []);
  assert.deepEqual(adlar(guild), oncesi);
  assert.deepEqual(depo.ayarlariGetir(guild.id), {});
});

test('kaldırma: yarıda kalan kurulumun oluşturdukları da kaldırılır', async () => {
  const guild = kurulumSunucusu('kaldir-yari');
  const oncesi = adlar(guild);
  const asil = guild.channels.create;
  let sayac = 0;
  guild.channels.create = async (o) => {
    if (++sayac === 6) throw new Error('Discord hatası');
    return asil(o);
  };
  const sonuc = await topluluk.kur(guild, topluluk.planla(guild, 'basit'), 'y#0');
  assert.equal(sonuc.hata, 'Discord hatası');
  assert.equal(depo.ayarlariGetir(guild.id).topluluk, undefined, 'tamamlanmayan kurulumun akış kaydı yok');
  assert.ok(topluluk.kuruluMu(guild.id));
  guild.channels.create = asil;
  const silme = await topluluk.kaldir(guild, topluluk.kaldirmaPlani(guild), 'y#0');
  assert.deepEqual(silme.basarisiz, []);
  assert.deepEqual(adlar(guild), oncesi);
});

test('kaldırma: silinemeyen öğe kayıtta kalır, komut yeniden çalışınca tamamlanır', async () => {
  const guild = kurulumSunucusu('kaldir-hata');
  const oncesi = adlar(guild);
  await topluluk.kur(guild, topluluk.planla(guild, 'basit'), 'y#0');
  const inatci = rolBul(guild, '🛡️ Moderatör') ?? [...guild.roles.cache.values()].find((r) => r.id !== guild.id);
  const asilSil = inatci.delete;
  inatci.delete = async () => {
    throw Object.assign(new Error('Missing Permissions'), { code: 50013 });
  };
  const silme = await topluluk.kaldir(guild, topluluk.kaldirmaPlani(guild), 'y#0');
  assert.equal(silme.basarisiz.length, 1);
  assert.match(silme.basarisiz[0], /Missing Permissions/);
  assert.ok(topluluk.kuruluMu(guild.id), 'kayıt silinmedi');
  assert.equal(topluluk.kaldirmaPlani(guild).roller.length, 1, 'yalnızca silinemeyen kaldı');
  inatci.delete = asilSil;
  const ikinci = await topluluk.kaldir(guild, topluluk.kaldirmaPlani(guild), 'y#0');
  assert.deepEqual(ikinci.basarisiz, []);
  assert.deepEqual(adlar(guild), oncesi);
  assert.equal(topluluk.kuruluMu(guild.id), false);
});

test('kaldırma: kayıt tutulmadan önce yapılmış kurulum şablondaki adlarla tanınır ve uyarılır', async () => {
  const guild = kurulumSunucusu('kaldir-eski');
  const oncesi = adlar(guild);
  await topluluk.kur(guild, topluluk.planla(guild, 'oyun'), 'y#0');
  // Eski sürümün durumu: akış kaydı var, neyin oluşturulduğu kaydı yok
  const ayar = depo.ayarlariGetir(guild.id);
  const hepsi = depo.oku('ayarlar', {});
  delete hepsi[guild.id].sablonKaydi;
  depo.yaz('ayarlar', hepsi);
  assert.ok(ayar.topluluk);

  const plan = topluluk.kaldirmaPlani(guild);
  assert.equal(plan.eski, true);
  const silme = await topluluk.kaldir(guild, plan, 'y#0');
  assert.deepEqual(silme.basarisiz, []);
  assert.deepEqual(adlar(guild), oncesi);
  const son = depo.ayarlariGetir(guild.id);
  assert.equal(son.logKanali, undefined, 'silinen kanala bağlı ayar temizlenir');
  assert.equal(son.oyunRol, undefined);
  assert.equal(son.topluluk, undefined);
  assert.equal(son.korumaSpam, true, 'hangisini açtığı bilinmeyen koruma ayarları olduğu gibi kalır');
  assert.match(silme.uyarilar.join(' '), /Eski bir kurulumda/);
});

test('kaldırma: botun rolünün üstündeki rol silinemez diye önizlemede uyarılır', async () => {
  const guild = kurulumSunucusu('kaldir-yetmez');
  await topluluk.kur(guild, topluluk.planla(guild, 'basit'), 'y#0');
  guild.members.me.roles.highest.position = 1;
  const plan = topluluk.kaldirmaPlani(guild);
  assert.ok(plan.yetmeyenRoller.length > 0);
  assert.match(sunucukur.kaldirOnizleme(plan).toJSON().fields.at(-1).value, /benim rolümün üstünde/);
});

test('kaldırma: önizleme ve sonuç kartı Discord sınırlarına sığar; menüde seçenek yalnızca kurulum varsa görünür', async () => {
  for (const ad of Object.keys(SABLONLAR)) {
    const guild = kurulumSunucusu(`kaldir-kart-${ad}`);
    await topluluk.kur(guild, topluluk.planla(guild, ad), 'y#0');
    const t = depo.ayarlariGetir(guild.id).topluluk;
    if (t.kategoriler.talepler) for (let i = 0; i < 25; i++) {
      const oda = await guild.channels.create({ name: `talep-${i}`, type: ChannelType.GuildText, parent: t.kategoriler.talepler });
      oda.topic = `sahip=${i}; konu=x`;
    }
    const plan = topluluk.kaldirmaPlani(guild);
    sigar(sunucukur.kaldirOnizleme(plan).toJSON(), `${ad} kaldırma önizlemesi`);
    const sonuc = { roller: 20, kanallar: 60, kategoriler: 8, kalanKategoriler: [{ ad: 'X', adet: 2 }], basarisiz: Array(30).fill('🛡️ Moderatör: Missing Permissions'), geriAlinan: ['Spam koruması', 'Seviye sistemi'], uyarilar: ['uyarı'] };
    sigar(sunucukur.kaldirSonucu(sonuc).toJSON(), `${ad} kaldırma sonucu`);
  }
  const secenekler = (kurulu) => sunucukur.sablonMenusu(kurulu).toJSON().components[0].options.map((o) => o.value);
  assert.deepEqual(secenekler(false), Object.keys(SABLONLAR));
  assert.deepEqual(secenekler(true), [...Object.keys(SABLONLAR), 'kaldir']);
  assert.equal(sunucukur.sablonListesi(true).toJSON().fields.length, Object.keys(SABLONLAR).length + 1);
  assert.equal(sunucukur.sablonListesi().toJSON().fields.length, Object.keys(SABLONLAR).length);
});

// Komutun tamamı: menüden "kaldır", onay düğmesi
function komutEtkilesimi(guild, secimler) {
  const gonderilen = [];
  const sira = [...secimler];
  const bilesen = (s) => ({
    ...s,
    update: async (m) => gonderilen.push(m),
    editReply: async (m) => gonderilen.push(m),
  });
  const mesaj = { awaitMessageComponent: async () => (sira.length ? bilesen(sira.shift()) : Promise.reject(new Error('süre doldu'))) };
  return {
    gonderilen,
    guild,
    guildId: guild.id,
    user: { id: 'yonetici', tag: 'yonetici#0', send: async (m) => gonderilen.push({ ozel: m }) },
    options: { getString: () => null },
    reply: async (m) => gonderilen.push(m),
    fetchReply: async () => mesaj,
    editReply: async (m) => gonderilen.push(m),
  };
}

test('/sunucukur: menüden kaldır, önizleme ve onayla; vazgeçince hiçbir şey silinmez', async () => {
  const guild = kurulumSunucusu('komut-kaldir');
  const oncesi = adlar(guild);
  await topluluk.kur(guild, topluluk.planla(guild, 'oyun'), 'y#0');
  const kurulu = adlar(guild);

  // Vazgeç
  const vazgec = komutEtkilesimi(guild, [{ values: ['kaldir'] }, { customId: 'sunucukur-vazgec' }]);
  await sunucukur.execute(vazgec);
  assert.deepEqual(adlar(guild), kurulu);
  assert.match(vazgec.gonderilen.at(-1).content, /hiçbir şey silinmedi/);
  assert.ok(vazgec.gonderilen[0].components[0].toJSON().components[0].options.some((o) => o.value === 'kaldir'), 'kurulu sunucuda menüde kaldırma seçeneği var');

  // Süre dolsun
  const sure = komutEtkilesimi(guild, [{ values: ['kaldir'] }]);
  await sunucukur.execute(sure);
  assert.deepEqual(adlar(guild), kurulu);

  // Onayla
  const onay = komutEtkilesimi(guild, [{ values: ['kaldir'] }, { customId: 'sunucukur-kaldir-onay' }]);
  await sunucukur.execute(onay);
  assert.deepEqual(adlar(guild), oncesi);
  const kart = onay.gonderilen.at(-1).embeds[0].toJSON();
  assert.match(kart.title, /Şablon kaldırıldı/);
  assert.equal(topluluk.kuruluMu(guild.id), false);
});

test('/sunucukur: kurulum yokken menüde kaldırma seçeneği çıkmaz', async () => {
  const guild = kurulumSunucusu('komut-bos');
  const e = komutEtkilesimi(guild, []);
  await sunucukur.execute(e);
  assert.ok(!e.gonderilen[0].components[0].toJSON().components[0].options.some((o) => o.value === 'kaldir'));
});
