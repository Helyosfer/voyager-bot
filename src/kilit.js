// Acil durum kilidi (/kilit kapat, /kilit ac): saldırı anında sunucudaki bütün kanalları
// tek komutla kullanılamaz hale getirir, sonra eski haline döndürür.
//
// Nasıl çalışır: önce bütün kanalların izin listeleri saklanır. Sonra her kanalda,
// listedeki her rol ve üye için (ve @everyone için) yazma, bağlanma, tepki ve konu
// açma izinleri yasaklanır. Kilit açılınca saklanan listeler aynen geri yüklenir.
//
// Discord'un iki kuralı tasarımı belirler:
// 1. Bot bir kanalda yalnızca o kanalda kendisinde olan izinleri değiştirebilir;
//    kanalda "İzinleri Yönet" satırı varsa bu sınır kalkar. Bu yüzden her kanalda önce
//    bota bu satır verilir, sonra kilit uygulanır. Yoksa kilit, botun kendi izinlerini
//    de kapattığı için bir sonraki kanalda (ve kilidi açarken) bot yetkisiz kalır.
// 2. Bir kategorinin izinleri değişince onunla eşitlenmiş kanallar da değişir. Bu
//    yüzden yedek, hiçbir şeye dokunulmadan önce topluca alınır; kategoriler önce
//    kilitlenir (sunucunun çoğu ilk saniyelerde kapanır), en son açılır.
//
// İki istisna: sunucu sahibi ve "Yönetici" (Administrator) iznine sahip roller kanal
// izinlerinden etkilenmez; onlar kilitliyken de yazabilir.
const { ChannelType, EmbedBuilder, Events, OverwriteType, PermissionFlagsBits: P, PermissionsBitField } = require('discord.js');
const { oku, yaz, ayarlariGetir, ayarKaydet } = require('./depo');
const { gunlukGonder } = require('./gunluk');

const KILITLENEN = [
  [P.SendMessages, 'Mesaj Gönder'],
  [P.SendMessagesInThreads, 'Konularda Mesaj Gönder'],
  [P.CreatePublicThreads, 'Herkese Açık Konu Oluştur'],
  [P.CreatePrivateThreads, 'Özel Konu Oluştur'],
  [P.AddReactions, 'Tepki Ekle'],
  [P.Connect, 'Bağlan'],
  [P.Speak, 'Konuş'],
];
// Kilitliyken botun her kanalda elinde tuttuğu izinler. ManageRoles kanal düzeyinde
// "İzinleri Yönet" demektir; kilidi uygulayıp geri alabilmesi buna bağlıdır.
const BOT_IZINLERI = [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ReadMessageHistory, P.ManageRoles];
const AYNI_ANDA = 5; // Aynı anda düzenlenen kanal sayısı
const YETKI_YOK = 50013; // Discord hata kodu: Missing Permissions (izin yok)

const kilitli = (sunucuId) => Boolean(ayarlariGetir(sunucuId).kilit);
const bitler = (izinler) => new PermissionsBitField(izinler).bitfield;

// Listeyi küçük gruplar halinde işler; her öğe için hatayı (başarılıysa null) döndürür
async function gruplarHalinde(liste, islem) {
  const hatalar = [];
  for (let i = 0; i < liste.length; i += AYNI_ANDA) {
    hatalar.push(...(await Promise.all(liste.slice(i, i + AYNI_ANDA).map((oge) => islem(oge).then(() => null, (hata) => hata)))));
  }
  return hatalar;
}

// Başarısız kanalların sebeplerini kayıtlara yazar ve kısa bir özet döndürür
function hataOzeti(islem, kanallar, hatalar) {
  const sebepler = new Map();
  hatalar.forEach((hata, i) => {
    if (!hata) return;
    console.error(`${islem} başarısız (#${kanallar[i].name}):`, hata.code ?? '', hata.message);
    const sebep = hata.code === YETKI_YOK ? 'Yetkim yetmedi' : hata.code === 50001 ? 'Kanala erişimim yok' : hata.message;
    sebepler.set(sebep, (sebepler.get(sebep) ?? 0) + 1);
  });
  return [...sebepler].map(([sebep, adet]) => `${sebep} (${adet} kanal)`);
}

// Konular (thread) üst kanalın izinlerini kullanır; ayrıca kilitlenmeleri gerekmez
const kilitlenebilir = (kanal) => !kanal.isThread() && kanal.permissionOverwrites;
const kategoriMi = (kanal) => kanal.type === ChannelType.GuildCategory;

async function kilitle(guild, yapan) {
  // Zaten kilitliyse yedeğe dokunulmaz (bkz. dosya sonundaki tekSefer)
  if (kilitli(guild.id)) return null;
  const ben = guild.members.me;
  const sebep = `Acil durum kilidi (${yapan.tag})`;
  const kanallar = [...guild.channels.cache.values()].filter(kilitlenebilir);

  // Hiçbir şeye dokunulmadan önce her kanalın izinleri saklanıp diske yazılır:
  // işlem yarıda kesilse bile /kilit ac geri alabilsin.
  const yedek = Object.fromEntries(
    kanallar.map((kanal) => [
      kanal.id,
      [...kanal.permissionOverwrites.cache.values()].map((i) => ({ id: i.id, type: i.type, allow: i.allow.bitfield.toString(), deny: i.deny.bitfield.toString() })),
    ]),
  );
  const hepsi = oku('kilit', {});
  hepsi[guild.id] = yedek;
  yaz('kilit', hepsi);
  ayarKaydet(guild.id, 'kilit', { zaman: Date.now(), yapan: yapan.id });

  const tumu = bitler(KILITLENEN.map(([izin]) => izin));
  const botTemel = bitler(BOT_IZINLERI);
  let kilitlenemeyen = 0n; // Hiçbir yolla yasaklanamayan izinler
  let gizlenen = 0; // İzinleri kilitlenemediği için kilit boyunca gizlenen kanallar
  let satirVerilebiliyor = true; // Discord bota "İzinleri Yönet" satırı verilmesine izin veriyor mu (ilk retten sonra false)
  let tam = 0; // Bütün izinleri tek seferde kilitlenen kanallar
  let kismi = 0; // Yalnızca botun elindeki izinlerle kilitlenen kanallar

  // botAllow: botun bu kanalda elinde tutacağı izinler. Bot, kilitlediği izinleri kendi
  // satırında açık tutar; herkese yasaklanan bir izni kendisi de kaybederse onu bir daha değiştiremez.
  const kilitliListe = (kanal, yasak, botAllow) => {
    const eski = yedek[kanal.id];
    const liste = eski
      // Sunucu sahibi zaten etkilenmez; botun satırı aşağıda yeniden yazılır
      .filter((i) => i.id !== ben.id && i.id !== guild.ownerId)
      .map((i) => ({ id: i.id, type: i.type, allow: BigInt(i.allow) & ~yasak, deny: BigInt(i.deny) | yasak }));
    if (!liste.some((i) => i.id === guild.roles.everyone.id)) {
      liste.push({ id: guild.roles.everyone.id, type: OverwriteType.Role, allow: 0n, deny: yasak });
    }
    liste.push({ id: ben.id, type: OverwriteType.Member, allow: botAllow });
    const sahip = eski.find((i) => i.id === guild.ownerId);
    if (sahip) liste.push({ id: sahip.id, type: sahip.type, allow: BigInt(sahip.allow), deny: BigInt(sahip.deny) });
    return liste;
  };

  const kanaliKilitle = async (kanal) => {
    // 1. Bota bu kanalda "İzinleri Yönet" satırı verilir (bkz. dosya başındaki 1. kural).
    //    Discord buna her zaman izin vermez (botta Yönetici izni yoksa reddedebilir);
    //    verilemezse kanal 3. adımdaki gibi, botun elindeki izinlerle kilitlenir.
    //    Bir kanalda reddedildiyse diğerlerinde de reddedilir; saldırı anında zaman kaybetmemek
    //    için kalan kanallarda yeniden denenmez.
    let satirVar = satirVerilebiliyor;
    if (satirVar) {
      try {
        await kanal.permissionOverwrites.edit(ben, { ManageRoles: true }, { reason: sebep });
      } catch (hata) {
        if (hata.code !== YETKI_YOK) throw hata;
        satirVar = satirVerilebiliyor = false;
      }
    }
    if (satirVar) {
      try {
        // 2. Satır sınırı kaldırdıysa bütün izinler tek seferde kilitlenir
        await kanal.permissionOverwrites.set(kilitliListe(kanal, tumu, botTemel | tumu), sebep);
        tam++;
        return;
      } catch (hata) {
        if (hata.code !== YETKI_YOK) throw hata;
      }
    }
    // 3. Yalnızca botun bu kanalda elinde olan izinler kilitlenebilir
    const eldeki = kanal.permissionsFor(ben)?.bitfield ?? 0n;
    let yasak = tumu & eldeki;
    const acikKalan = tumu & ~yasak;
    // Yazma ya da bağlanma açık kaldıysa kanal kilit boyunca gizlenir: göremeyen giremez de
    const gizle = Boolean(acikKalan & (P.SendMessages | P.Connect)) && Boolean(eldeki & P.ViewChannel);
    if (gizle) yasak |= P.ViewChannel;
    // Satır verilemediyse botun kendi satırına da "İzinleri Yönet" yazılmaz; aynı sebeple reddedilir
    const botIzni = ((botTemel & eldeki) | yasak) & (satirVar ? ~0n : ~P.ManageRoles);
    await kanal.permissionOverwrites.set(kilitliListe(kanal, yasak, botIzni), sebep);
    kismi++;
    if (gizle) gizlenen++;
    kilitlenemeyen |= gizle ? acikKalan & ~(P.SendMessages | P.Connect | P.Speak) : acikKalan;
  };

  // Kategoriler önce: eşitlenmiş kanalları da kapattığı için sunucunun çoğu hemen kilitlenir
  const sirali = [...kanallar.filter(kategoriMi), ...kanallar.filter((k) => !kategoriMi(k))];
  const hatalar = await gruplarHalinde(sirali, kanaliKilitle);

  // Ses kanallarındakiler bağlı kalır; yetki varsa sahip ve bot dışındakiler kanaldan çıkarılır
  let cikarilan = 0;
  if (ben.permissions.has(P.MoveMembers)) {
    const seste = [...guild.voiceStates.cache.values()].filter((s) => s.channelId && s.id !== guild.ownerId && s.id !== ben.id);
    cikarilan = (await gruplarHalinde(seste, (s) => s.disconnect(sebep))).filter((hata) => !hata).length;
  }

  const basarisiz = hatalar.filter(Boolean).length;
  console.log(`Kilit (${guild.id}): ${tam} kanal tam, ${kismi} kanal botun elindeki izinlerle kilitlendi, ${basarisiz} kanal kilitlenemedi`);
  const sonuc = {
    kilitlenen: sirali.length - basarisiz,
    basarisiz,
    sebepler: hataOzeti('Kilitleme', sirali, hatalar),
    atlanan: KILITLENEN.filter(([izin]) => kilitlenemeyen & izin).map(([, ad]) => ad),
    cikarilan,
    gizlenen,
  };
  await gunlukGonder(
    guild,
    'moderasyon',
    new EmbedBuilder()
      .setTitle('🔒 Sunucu kilitlendi')
      .setColor(0xed4245)
      .addFields(
        { name: 'Kilitleyen', value: `${yapan} (${yapan.tag})` },
        { name: 'Kanallar', value: `${sonuc.kilitlenen} kilitlendi${basarisiz ? `, ${basarisiz} kilitlenemedi` : ''}` },
      ),
  );
  return sonuc;
}

async function ac(guild, yapan) {
  const sebep = `Kilit açıldı (${yapan.tag})`;
  const hepsi = oku('kilit', {});
  const yedek = hepsi[guild.id] ?? {};
  const kanallar = Object.keys(yedek)
    .map((id) => guild.channels.cache.get(id))
    .filter(Boolean); // Kilit sırasında silinen kanallar atlanır
  // Kanallar önce, kategoriler sonra: kategori açılınca eşitlenmiş kanallar botun
  // "İzinleri Yönet" satırını kaybeder; kanalların kendi izinleri ondan önce dönmüş olmalı.
  const sirali = [...kanallar.filter((k) => !kategoriMi(k)), ...kanallar.filter(kategoriMi)];

  const hatalar = await gruplarHalinde(sirali, (kanal) =>
    kanal.permissionOverwrites.set(
      yedek[kanal.id]
        // Kilit sırasında silinmiş bir rol geri yüklenemez
        .filter((i) => i.type !== OverwriteType.Role || guild.roles.cache.has(i.id))
        .map((i) => ({ id: i.id, type: i.type, allow: BigInt(i.allow), deny: BigInt(i.deny) })),
      sebep,
    ),
  );

  const basarisiz = hatalar.filter(Boolean).length;
  // Açılamayan kanal kaldıysa onların yedeği saklanır; komut yeniden çalıştırılabilsin
  if (basarisiz) {
    hepsi[guild.id] = Object.fromEntries(sirali.filter((_, i) => hatalar[i]).map((k) => [k.id, yedek[k.id]]));
  } else {
    delete hepsi[guild.id];
    ayarKaydet(guild.id, 'kilit', null);
  }
  yaz('kilit', hepsi);

  const sonuc = { acilan: sirali.length - basarisiz, basarisiz, sebepler: hataOzeti('Kilit açma', sirali, hatalar) };
  await gunlukGonder(
    guild,
    'moderasyon',
    new EmbedBuilder()
      .setTitle('🔓 Sunucunun kilidi açıldı')
      .setColor(0x57f287)
      .addFields(
        { name: 'Açan', value: `${yapan} (${yapan.tag})` },
        { name: 'Kanallar', value: `${sonuc.acilan} eski haline döndü${basarisiz ? `, ${basarisiz} açılamadı` : ''}` },
      ),
  );
  return sonuc;
}

function baslat(client) {
  // Kilitliyken sunucuya eklenen botlar saldırının parçası sayılır ve atılır
  client.on(Events.GuildMemberAdd, async (uye) => {
    if (!uye.user.bot) return;
    // Ayar dosyası okunamazsa hata burada yakalansın; yakalanmazsa bot bütün sunucularda kapanır
    let kilitliMi = false;
    try {
      kilitliMi = kilitli(uye.guild.id);
    } catch (hata) {
      console.error('Kilit durumu okunamadı:', hata.message);
    }
    if (!kilitliMi) return;
    const atildi = await uye.kick('Sunucu kilitliyken eklenen bot').then(() => true, () => false);
    await gunlukGonder(
      uye.guild,
      'moderasyon',
      new EmbedBuilder()
        .setTitle(atildi ? '🤖 Kilit sırasında eklenen bot atıldı' : '🤖 Kilit sırasında bot eklendi, atılamadı')
        .setColor(0xed4245)
        .addFields({ name: 'Bot', value: `${uye.user} (${uye.user.tag})` }),
    ).catch(() => {});
  });
}

// Bir sunucuda aynı anda tek bir kilitleme ya da açma işlemi yürütülür; süren bir işlem varsa
// null döner. İki /kilit kapat üst üste binerse ikincisi yedeği, birincinin kilitlemeye başladığı
// izinlerle yeniden alır ve kilitten önceki izinler bir daha geri getirilemez.
const islemde = new Set();
const tekSefer = (islem) => async (guild, yapan) => {
  if (islemde.has(guild.id)) return null;
  islemde.add(guild.id);
  try {
    return await islem(guild, yapan);
  } finally {
    islemde.delete(guild.id);
  }
};

module.exports = { baslat, kilitli, kilitle: tekSefer(kilitle), ac: tekSefer(ac), KILITLENEN };
