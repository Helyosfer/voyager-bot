// Otomatik koruma: spam (özellikle ele geçirilmiş hesapların her kanala aynı
// şeyi atması), ağır küfür filtresi, zararlı bağlantı denetimi (baglanti.js) ve
// dolandırıcılık görseli denetimi (gorsel.js).
// Sunucu başına /koruma ile açılır; hepsi varsayılan olarak kapalıdır.
const { EmbedBuilder, Events, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const { ayarlariGetir } = require('./depo');
const { gunlukGonder, temizlemeBildir } = require('./gunluk');
const { sureMetni } = require('./yardimci');
const gorsel = require('./gorsel');
const baglanti = require('./baglanti');

// --- Spam ---
const PENCERE = 30_000; // Bu süre içindeki mesajlara bakılır
const KANAL_ESIGI = 3; // Bu kadar farklı kanala yazan kişi spam sayılır
const TEKRAR_ESIGI = 4; // Aynı içeriği bu kadar kez gönderen kişi spam sayılır
const VARSAYILAN_SUSTURMA = 60; // dakika
const GORSEL_SUSTURMA = 24 * 60; // dakika; dolandırıcılık görseli atan (çoğu zaman ele geçirilmiş) hesap
const BAGLANTI_SUSTURMA = 60; // dakika

// Kayıtlı ayarları varsayılanlarla tamamlar
function ayarCoz(ayar) {
  return {
    spam: ayar.korumaSpam === true,
    spamDakika: ayar.korumaSpamDakika ?? VARSAYILAN_SUSTURMA,
    kufur: ayar.korumaKufur === true,
    kufurDakika: ayar.korumaKufurDakika ?? 0,
    kelimeler: ayar.korumaKelimeler ?? [],
    gorsel: ayar.korumaGorsel === true,
    gorselKapsam: ayar.korumaGorselKapsam === 'hepsi' ? 'hepsi' : 'riskli',
    gorselDakika: ayar.korumaGorselDakika ?? GORSEL_SUSTURMA,
    baglanti: ayar.korumaBaglanti === true,
    baglantiDakika: ayar.korumaBaglantiDakika ?? BAGLANTI_SUSTURMA,
    kisaltici: ayar.korumaKisaltici === true,
    alanEngel: ayar.korumaAlanEngel ?? [],
    alanIzin: ayar.korumaAlanIzin ?? [],
  };
}

// --- Küfür ---
// Yalnızca ağır küfürler. Kalıplar kelimenin BAŞINDAN eşleşir ve bilerek dardır:
// "sıkıntı", "klasik", "götür", "yara", "pic", "got" gibi masum kelimeler ve
// Türkçe karaktersiz yazımları ("sikinti", "canimi sikiyor") yakalanmamalı.
// "amk", "aq" gibi kısaltmalar listede yok; isteyen sunucu /koruma kelime ile ekler.
const AGIR_KUFURLER = [
  /^s(?:ik|k)t[iı]?r/, // siktir, sktr
  /^sik(?:er|ey|ec|em$|icem|ti[gğ]|ik$|ikler)/,
  /^sikim(?:i|e|in|den)?$/,
  /^am[ıi]n[aı]/,
  /^amc[ıi][kgğ]/,
  /^oro[sş][pb]u/,
  /^orspu/,
  /^oç$/,
  /^piç/,
  /^pic(?:ler|lik)$/,
  /^pezeven[kg]/,
  /^yarr?a[kgğ]/,
  /^dalyara[kgğ]/,
  /^ta[sş]a[kgğ]/,
  /^göt(?:e|ü|ün|üne|ünü|üm|veren|lek|oş)?$/,
  /^got(?:veren|lek|os)/,
  /^kahpe/,
  /^ibne/,
  /^kalta[kgğ]/,
  /^s[uü]rt[uü][kgğ]/,
  /^gavat/,
  /^pu[sş]t/,
  /^yav[sş]a[kgğ]/,
  /^fuck/,
  /^motherf/,
  /^bitch/,
  /^cunt/,
  /^nigg(?:a|er)/,
  /^fagg?ot/,
];

const RAKAM_HARF = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };

// Metni karşılaştırılabilir kelimelere böler: küçük harf, rakamla yazılmış harfler
// çevrilir ("0r0spu"), araya boşluk/nokta konmuş harfler birleştirilir ("s.i.k.t.i.r").
function kelimeler(metin) {
  const parcalar = metin
    .toLocaleLowerCase('tr')
    .replace(/[013457@$]/g, (k) => RAKAM_HARF[k])
    .split(/[^\p{L}]+/u)
    .filter(Boolean);

  const sonuc = [];
  let tekHarfler = '';
  for (const parca of parcalar) {
    if (parca.length === 1) {
      tekHarfler += parca;
      continue;
    }
    if (tekHarfler.length >= 3) sonuc.push(tekHarfler);
    tekHarfler = '';
    sonuc.push(parca);
  }
  if (tekHarfler.length >= 3) sonuc.push(tekHarfler);
  return sonuc;
}

// Uzatılmış harfleri teke indirir: "siiiktir" -> "siktir"
const sadelestir = (kelime) => kelime.replace(/(.)\1+/gu, '$1');

// Metinde yakalanan ilk küfrü döndürür, yoksa null.
function kufurBul(metin, ekKelimeler = []) {
  const ekler = new Set(ekKelimeler);
  for (const kelime of kelimeler(metin)) {
    for (const bicim of new Set([kelime, sadelestir(kelime)])) {
      if (ekler.has(bicim) || AGIR_KUFURLER.some((kalip) => kalip.test(bicim))) return kelime;
    }
  }
  return null;
}

// /koruma kelime için: kelimeyi filtrenin karşılaştırdığı biçime çevirir
const kelimeBicimi = (girdi) => kelimeler(girdi).map(sadelestir).join('');

// --- Ortak ---
// Yetkililer, botlar ve sistem mesajları korumadan muaftır
function muaf(mesaj) {
  if (!mesaj.guild || !mesaj.member || mesaj.author?.bot || mesaj.webhookId || mesaj.system) return true;
  return mesaj.member.permissions.has(PermissionFlagsBits.ManageMessages);
}

async function sustur(uye, dakika, sebep) {
  if (!dakika || !uye.moderatable) return false;
  await uye.timeout(dakika * 60_000, sebep);
  return true;
}

// --- Spam takibi ---
// { "sunucu:kullanici": [{ kanal, mesaj, zaman, imza }] }
const sonMesajlar = new Map();

// Aynı içeriğin tekrarını anlamak için: metin + eklerin boyutları
function imza(mesaj) {
  const ekler = [...(mesaj.attachments?.values() ?? [])].map((e) => e.size).join(',');
  const metin = (mesaj.content ?? '').trim().toLocaleLowerCase('tr');
  return metin || ekler ? `${metin}|${ekler}` : null; // İçerik okunamıyorsa tekrar kuralı uygulanmaz
}

// Mesajı kaydeder ve bir spam kuralı tetiklendiyse sebebini döndürür.
function spamSebebi(mesaj) {
  const anahtar = `${mesaj.guild.id}:${mesaj.author.id}`;
  const simdi = Date.now();
  const kayitlar = (sonMesajlar.get(anahtar) ?? []).filter((k) => simdi - k.zaman < PENCERE);
  kayitlar.push({ kanal: mesaj.channelId, mesaj, zaman: simdi, imza: imza(mesaj) });
  sonMesajlar.set(anahtar, kayitlar);

  const kanalSayisi = new Set(kayitlar.map((k) => k.kanal)).size;
  if (kanalSayisi >= KANAL_ESIGI) return `${PENCERE / 1000} saniye içinde ${kanalSayisi} farklı kanala mesaj`;

  const sonImza = kayitlar.at(-1).imza;
  if (sonImza && kayitlar.filter((k) => k.imza === sonImza).length >= TEKRAR_ESIGI) {
    return `Aynı içerik ${PENCERE / 1000} saniye içinde ${TEKRAR_ESIGI} kez`;
  }

  // Yetkisi olmadığı halde herkesi etiketlemeye çalışıp bağlantı ya da dosya gönderen
  const icerik = mesaj.content ?? '';
  const topluEtiket = /@(everyone|here)\b/.test(icerik) && !mesaj.member.permissions.has(PermissionFlagsBits.MentionEveryone);
  if (topluEtiket && (/https?:\/\//i.test(icerik) || mesaj.attachments?.size)) return 'Toplu etiket ile bağlantı ya da dosya';

  return null;
}

async function spamUygula(mesaj, sebep, ayar) {
  const anahtar = `${mesaj.guild.id}:${mesaj.author.id}`;
  const kayitlar = sonMesajlar.get(anahtar) ?? [];
  sonMesajlar.delete(anahtar);

  // Önce sustur ki silme sürerken yeni mesaj gelmesin
  const susturuldu = await sustur(mesaj.member, ayar.spamDakika, `Otomatik koruma: ${sebep}`).catch(() => false);

  const kanallar = new Map();
  for (const k of kayitlar) kanallar.set(k.kanal, [...(kanallar.get(k.kanal) ?? []), k.mesaj]);
  let silinen = 0;
  for (const mesajlar of kanallar.values()) {
    const kanal = mesajlar[0].channel;
    temizlemeBildir(kanal.id); // Günlükte ayrıca "toplu mesaj silindi" çıkmasın
    await kanal
      .bulkDelete(mesajlar.map((m) => m.id))
      .then((s) => {
        silinen += s.size;
      })
      .catch(() => {});
  }

  const embed = new EmbedBuilder()
    .setTitle('🛡️ Spam engellendi')
    .setColor(0xed4245)
    .setDescription('Bu hesap ele geçirilmiş olabilir. Üyeye haber ver: şifresini değiştirsin ve iki adımlı doğrulamayı açsın.')
    .addFields(
      { name: 'Kullanıcı', value: `${mesaj.author} (${mesaj.author.tag})` },
      { name: 'Sebep', value: sebep },
      {
        name: 'Yapılanlar',
        value: [
          `${silinen} mesaj silindi (${kanallar.size} kanal)`,
          susturuldu ? `Üye ${sureMetni(ayar.spamDakika)} susturuldu` : 'Susturulamadı (yetkim yetmedi ya da susturma kapalı)',
        ].join('\n'),
      },
    );
  await gunlukGonder(mesaj.guild, 'moderasyon', embed);
}

async function kufurUygula(mesaj, kelime, ayar) {
  await mesaj.delete().catch(() => {});
  const susturuldu = await sustur(mesaj.member, ayar.kufurDakika, 'Otomatik koruma: ağır küfür').catch(() => false);

  // Kısa bir uyarı; kanalda kalıp kalabalık yapmasın diye kendiliğinden silinir
  const uyari = await mesaj.channel
    .send({ content: `${mesaj.author}, mesajın ağır küfür içerdiği için silindi.`, allowedMentions: { users: [mesaj.author.id] } })
    .catch(() => null);
  if (uyari) setTimeout(() => uyari.delete().catch(() => {}), 8000);

  const embed = new EmbedBuilder()
    .setTitle('🛡️ Küfür filtresi')
    .setColor(0xfee75c)
    .addFields(
      { name: 'Kullanıcı', value: `${mesaj.author} (${mesaj.author.tag})` },
      { name: 'Kanal', value: `${mesaj.channel}` },
      { name: 'Yakalanan kelime', value: `||${kelime}||` },
      { name: 'Yapılanlar', value: susturuldu ? `Mesaj silindi, üye ${sureMetni(ayar.kufurDakika)} susturuldu` : 'Mesaj silindi' },
    );
  await gunlukGonder(mesaj.guild, 'moderasyon', embed);
}

// Mesajdaki zararlı bağlantıyı bulur; yoksa null
const zararliBaglanti = (icerik, ayar) =>
  baglanti.denetle(icerik, { kisaltici: ayar.kisaltici, engel: ayar.alanEngel, izin: ayar.alanIzin });

async function baglantiUygula(mesaj, bulgu, ayar) {
  await mesaj.delete().catch(() => {});
  const susturuldu = await sustur(mesaj.member, ayar.baglantiDakika, `Otomatik koruma: ${bulgu.sebep}`).catch(() => false);

  // Kısa bir uyarı; kanalda kalıp kalabalık yapmasın diye kendiliğinden silinir
  const uyari = await mesaj.channel
    .send({ content: `${mesaj.author}, mesajın zararlı olabilecek bir bağlantı içerdiği için silindi.`, allowedMentions: { users: [mesaj.author.id] } })
    .catch(() => null);
  if (uyari) setTimeout(() => uyari.delete().catch(() => {}), 8000);

  const embed = new EmbedBuilder()
    .setTitle('🛡️ Zararlı bağlantı')
    .setColor(0xed4245)
    .setDescription('Bu hesap ele geçirilmiş olabilir. Yanlış alarmsa alanı `/koruma alan` ile izin listesine ekle.')
    .addFields(
      { name: 'Kullanıcı', value: `${mesaj.author} (${mesaj.author.tag})` },
      { name: 'Kanal', value: `${mesaj.channel}` },
      // Kod biçiminde: günlükte tıklanabilir bağlantı olmasın
      { name: 'Alan', value: `\`${bulgu.alan}\`` },
      { name: 'Sebep', value: bulgu.sebep },
      { name: 'Yapılanlar', value: susturuldu ? `Mesaj silindi, üye ${sureMetni(ayar.baglantiDakika)} susturuldu` : 'Mesaj silindi' },
    );
  await gunlukGonder(mesaj.guild, 'moderasyon', embed);
}

// Silinmek üzere yakalanan mesajlar. Seviye sistemi bunlara XP vermez (bkz. seviye.js).
// Spam, küfür ve bağlantı kararı mesaj geldiği anda, ilk beklemeden önce verilip işaretlenir.
// Görsel denetiminin kararı 30-60 saniye sürdüğü için o mesajlar işaretlenemez.
const yakalananlar = new WeakSet();
const yakalandi = (mesaj) => yakalananlar.has(mesaj);

async function mesajGeldi(mesaj) {
  if (muaf(mesaj)) return;
  const ayar = ayarCoz(ayarlariGetir(mesaj.guild.id));

  if (ayar.spam) {
    const sebep = spamSebebi(mesaj);
    if (sebep) {
      yakalananlar.add(mesaj);
      return spamUygula(mesaj, sebep, ayar);
    }
  }
  if (ayar.kufur && mesaj.content) {
    const kelime = kufurBul(mesaj.content, ayar.kelimeler);
    if (kelime) {
      yakalananlar.add(mesaj);
      return kufurUygula(mesaj, kelime, ayar);
    }
  }
  if (ayar.baglanti && mesaj.content) {
    const bulgu = zararliBaglanti(mesaj.content, ayar);
    if (bulgu) {
      yakalananlar.add(mesaj);
      return baglantiUygula(mesaj, bulgu, ayar);
    }
  }
  if (ayar.gorsel && mesaj.attachments?.size) return gorsel.denetle(mesaj, ayar);
}

// Düzenleyerek filtreyi atlatmaya karşı
async function mesajDuzenlendi(eski, yeni) {
  if (muaf(yeni) || !yeni.content || eski.content === yeni.content) return;
  const ayar = ayarCoz(ayarlariGetir(yeni.guild.id));
  const kelime = ayar.kufur && kufurBul(yeni.content, ayar.kelimeler);
  if (kelime) return kufurUygula(yeni, kelime, ayar);
  const bulgu = ayar.baglanti && zararliBaglanti(yeni.content, ayar);
  if (bulgu) await baglantiUygula(yeni, bulgu, ayar);
}

function baslat(client) {
  const dinle = (olay, islev) =>
    client.on(olay, (...argumanlar) => {
      Promise.resolve()
        .then(() => islev(...argumanlar))
        .catch((hata) => console.error(`Koruma hatası (${olay}):`, hata.message));
    });
  dinle(Events.MessageCreate, mesajGeldi);
  dinle(Events.MessageUpdate, mesajDuzenlendi);

  // Bellek birikmesin: penceresi dolan kayıtları at
  setInterval(() => {
    const simdi = Date.now();
    for (const [anahtar, kayitlar] of sonMesajlar) {
      if (kayitlar.every((k) => simdi - k.zaman >= PENCERE)) sonMesajlar.delete(anahtar);
    }
    gorsel.temizlik();
  }, 60_000);
}

// Küfür filtresi mesaj metnini okuyabilmeli; bu ayrıcalıklı izin açık mı?
const icerikOkunabilir = (client) => client.options.intents.has(GatewayIntentBits.MessageContent);

module.exports = { baslat, ayarCoz, kufurBul, kelimeBicimi, icerikOkunabilir, mesajGeldi, mesajDuzenlendi, yakalandi, KANAL_ESIGI, PENCERE };
