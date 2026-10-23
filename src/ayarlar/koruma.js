// /ayarlar → Koruma: spam, küfür, dolandırıcılık görseli ve zararlı bağlantı filtreleri.
// Filtreler düğmeyle açılıp kapanır; susturma süreleri, özel kelimeler ve alan listeleri formla değişir.
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { ayarlariGetir, ayarKaydet } = require('../depo');
const koruma = require('../koruma');
const yapayzeka = require('../yapayzeka');
const baglanti = require('../baglanti');
const { sureMetni } = require('../yardimci');
const { dugme, acKapat, satir, form, metinAlani, formMetni, sayi, liste, ButtonStyle } = require('./arac');

const ID = 'koruma';
const KELIME_SINIRI = 100;
const ALAN_SINIRI = 100; // Engel ve izin listelerinin her biri
const EN_UZUN_SUSTURMA = 40320; // Discord: en fazla 28 gün

// Filtre → depodaki anahtarlar ve ad
const FILTRELER = {
  spam: { ad: 'Spam koruması', kisa: 'Spam', anahtar: 'korumaSpam', dakika: 'korumaSpamDakika', ayarDakika: 'spamDakika' },
  kufur: { ad: 'Küfür filtresi', kisa: 'Küfür', anahtar: 'korumaKufur', dakika: 'korumaKufurDakika', ayarDakika: 'kufurDakika' },
  gorsel: { ad: 'Görsel denetimi', kisa: 'Görsel', anahtar: 'korumaGorsel', dakika: 'korumaGorselDakika', ayarDakika: 'gorselDakika' },
  baglanti: { ad: 'Bağlantı denetimi', kisa: 'Bağlantı', anahtar: 'korumaBaglanti', dakika: 'korumaBaglantiDakika', ayarDakika: 'baglantiDakika' },
};

const ayarCoz = (sunucuId) => koruma.ayarCoz(ayarlariGetir(sunucuId));
const gunlukNotu = (sunucuId, ne) => (ayarlariGetir(sunucuId).logKanali ? null : `ℹ️ ${ne} görmek için **Günlük** bölümünden bir günlük kanalı seç.`);

function kart(sunucuId) {
  const ayar = ayarCoz(sunucuId);
  const durum = (acik, dakika) => (acik ? `🟢 Açık\n${dakika ? `${sureMetni(dakika)} susturma` : 'Yalnızca silme'}` : '⚫ Kapalı');
  return new EmbedBuilder()
    .setTitle('🛡️ Otomatik koruma')
    .setColor(0x5865f2)
    .addFields(
      { name: 'Spam koruması', value: durum(ayar.spam, ayar.spamDakika), inline: true },
      { name: 'Küfür filtresi', value: durum(ayar.kufur, ayar.kufurDakika), inline: true },
      {
        name: 'Görsel denetimi',
        value: ayar.gorsel ? `${durum(true, ayar.gorselDakika)}\n${ayar.gorselKapsam === 'hepsi' ? 'Bütün resimler' : 'Riskli resimler'}` : '⚫ Kapalı',
        inline: true,
      },
      {
        name: 'Bağlantı denetimi',
        value: ayar.baglanti ? `${durum(true, ayar.baglantiDakika)}${ayar.kisaltici ? '\nKısaltıcılar da' : ''}` : '⚫ Kapalı',
        inline: true,
      },
      { name: `Engellenen alanlar · ${ayar.alanEngel.length}`, value: ayar.alanEngel.length ? `\`${ayar.alanEngel.join(', ').slice(0, 1000)}\`` : 'Yok', inline: true },
      { name: `İzin verilen alanlar · ${ayar.alanIzin.length}`, value: ayar.alanIzin.length ? `\`${ayar.alanIzin.join(', ').slice(0, 1000)}\`` : 'Yok', inline: true },
      { name: `Özel kelimeler · ${ayar.kelimeler.length}`, value: ayar.kelimeler.length ? `||${ayar.kelimeler.join(', ').slice(0, 1000)}||` : 'Yok' },
    )
    .setFooter({ text: 'Mesajları Yönet yetkisi olanlar ve botlar muaftır.' });
}

// Filtre açılınca anlatılanlar ve eksik izinler
function acildi(interaction, tur) {
  const sunucuId = interaction.guildId;
  const ayar = ayarCoz(sunucuId);
  const ben = interaction.guild.members.me;
  const dakika = ayar[FILTRELER[tur].ayarDakika];
  const eksik = [
    !ben.permissions.has(PermissionFlagsBits.ManageMessages) && 'Mesajları Yönet',
    dakika > 0 && !ben.permissions.has(PermissionFlagsBits.ModerateMembers) && 'Üyelere Zaman Aşımı Uygula',
  ].filter(Boolean);
  const izinNotu = eksik.length ? `⚠️ Bunun çalışması için bana şu izinleri ver: ${eksik.join(', ')}.` : null;
  const susturma = (ne) => (dakika ? ` ve ${ne} ${sureMetni(dakika)} susturulur` : '');
  const metinler = {
    spam: [`✅ Spam koruması açık. ${koruma.PENCERE / 1000} saniyede ${koruma.KANAL_ESIGI} farklı kanala yazan ya da aynı içeriği tekrarlayan üyenin mesajları silinir${susturma('üye')}.`],
    kufur: [
      `✅ Küfür filtresi açık. Ağır küfür içeren mesajlar silinir${susturma('yazan')}.`,
      'Yalnızca ağır küfürler yakalanır; "amk", "aq" gibi kısaltmalar listede yok. Eklemek istersen **📝 Özel kelimeler** düğmesini kullan.',
    ],
    gorsel: [
      `✅ Görsel denetimi açık. Dolandırıcılık resmi yakalanınca mesaj silinir${susturma('atan')} ve günlüğe kanıtıyla yazılır. Aynı resim yeniden atılırsa beklemeden silinir.`,
      "ℹ️ Denetlenen resimler Google'ın yapay zekâsına gönderilir. Yapay zekâ yanılabilir; yanlış alarmda susturmayı elle kaldırabilirsin. Karar 30-60 saniye sürebilir.",
    ],
    baglanti: [
      `✅ Bağlantı denetimi açık. Discord, Steam, Epic Games, Roblox ve Twitch'i taklit eden alanlar, görünen adresiyle gittiği adres farklı bağlantılar ve bedava Nitro alanları silinir${susturma('atan')}.`,
      'Bağlantılar açılmaz ve hiçbir yere gönderilmez. Yanlış alarmda alanı **🔗 Alanlar** düğmesiyle izin listesine ekle.',
    ],
  };
  return [...metinler[tur], 'Mesajları Yönet yetkisi olanlar muaftır.', izinNotu, gunlukNotu(sunucuId, tur === 'spam' ? 'Olanları' : 'Yakalananları')];
}

// Filtreyi açar ya da kapatır
function filtre(interaction, tur) {
  const sunucuId = interaction.guildId;
  const acik = !ayarCoz(sunucuId)[tur];
  if (acik && tur === 'gorsel' && !yapayzeka.hazir()) {
    return ['❌ Görsel denetimi yapay zekâ ister, ama bu botta yapay zekâ kurulu değil (botun sahibi .env içinde GEMINI_API_KEY ve GEMINI_MODEL girmeli).'];
  }
  if (acik && tur !== 'spam' && !koruma.icerikOkunabilir(interaction.client)) {
    return [`❌ ${FILTRELER[tur].ad} mesajların içeriğini okuyabilmeli, ama botta "Message Content Intent" açık değil. Botun sahibi bunu açmalı.`];
  }
  ayarKaydet(sunucuId, FILTRELER[tur].anahtar, acik);
  return acik ? acildi(interaction, tur) : [`✅ ${FILTRELER[tur].ad} kapatıldı.`];
}

const formlar = {
  sureler: (sunucuId) => {
    const ayar = ayarCoz(sunucuId);
    return form(
      ID,
      'sureler-form',
      'Susturma süreleri (dakika)',
      ...Object.entries(FILTRELER).map(([tur, f], i) =>
        metinAlani(tur, f.ad, {
          deger: ayar[f.ayarDakika],
          enFazla: 5,
          aciklama: i === 0 ? '0 yazarsan yalnızca silinir, susturulmaz. En fazla 40320 (28 gün).' : undefined,
        }),
      ),
    );
  },
  kelimeler: () =>
    form(
      ID,
      'kelimeler-form',
      'Küfür filtresine özel kelimeler',
      metinAlani('ekle', 'Eklenecek kelimeler', { zorunlu: false, uzun: true, aciklama: 'Virgülle ayır. Yalnızca tam bu kelimeler yakalanır; ekli halleri için ayrıca ekle.' }),
      metinAlani('cikar', 'Çıkarılacak kelimeler', { zorunlu: false, uzun: true, aciklama: 'Hazır listedeki kelimeler çıkarılamaz.' }),
    ),
  alanlar: () =>
    form(
      ID,
      'alanlar-form',
      'Bağlantı denetimi alanları',
      metinAlani('engel', 'Engellenecek alanlar', { zorunlu: false, uzun: true, yerTutucu: 'kotu.site, sahte.link', aciklama: 'Alt alan adları da engellenir.' }),
      metinAlani('izin', 'İzin verilecek alanlar', { zorunlu: false, uzun: true, aciklama: 'Yanlış alarm veren alanlar; bağlantı denetimi bunlara dokunmaz.' }),
      metinAlani('cikar', 'Listelerden çıkarılacak alanlar', { zorunlu: false, uzun: true }),
    ),
};

function sureler(interaction) {
  const satirlar = [];
  for (const [tur, f] of Object.entries(FILTRELER)) {
    const yazilan = formMetni(interaction, tur);
    if (yazilan === null) continue;
    const dakika = sayi(yazilan, 0, EN_UZUN_SUSTURMA);
    if (dakika === null) {
      satirlar.push(`❌ ${f.ad}: 0 ile ${EN_UZUN_SUSTURMA} arasında bir sayı yaz.`);
      continue;
    }
    ayarKaydet(interaction.guildId, f.dakika, dakika);
  }
  return satirlar.length ? satirlar : ['✅ Susturma süreleri kaydedildi.'];
}

function kelimeler(interaction) {
  const sunucuId = interaction.guildId;
  let mevcut = ayarCoz(sunucuId).kelimeler;
  const satirlar = [];
  const eklenen = [];
  for (const ham of liste(formMetni(interaction, 'ekle'))) {
    const kelime = koruma.kelimeBicimi(ham);
    if (kelime.length < 2 || mevcut.includes(kelime) || eklenen.includes(kelime)) continue;
    if (mevcut.length + eklenen.length >= KELIME_SINIRI) {
      satirlar.push(`⚠️ En fazla ${KELIME_SINIRI} özel kelime eklenebilir; fazlası eklenmedi.`);
      break;
    }
    eklenen.push(kelime);
  }
  mevcut = [...mevcut, ...eklenen];
  const cikarilacak = liste(formMetni(interaction, 'cikar')).map(koruma.kelimeBicimi);
  const kalan = mevcut.filter((k) => !cikarilacak.includes(k));
  const cikan = mevcut.length - kalan.length;
  ayarKaydet(sunucuId, 'korumaKelimeler', kalan);
  if (eklenen.length) satirlar.unshift(`✅ ${eklenen.length} kelime eklendi.`);
  if (cikan) satirlar.push(`✅ ${cikan} kelime çıkarıldı.`);
  return satirlar.length ? satirlar : ['Değişen bir şey olmadı (kelimeler zaten listede ya da listede değil).'];
}

function alanlar(interaction) {
  const ayar = ayarCoz(interaction.guildId);
  let engel = [...ayar.alanEngel];
  let izin = [...ayar.alanIzin];
  const gecersiz = [];
  const oku = (id) =>
    liste(formMetni(interaction, id)).flatMap((ham) => {
      const alan = baglanti.alanBicimi(ham);
      if (!alan) gecersiz.push(ham);
      return alan ? [alan] : [];
    });
  // Bir alan iki listede birden durmaz
  for (const alan of oku('engel')) {
    izin = izin.filter((a) => a !== alan);
    if (!engel.includes(alan)) engel.push(alan);
  }
  for (const alan of oku('izin')) {
    engel = engel.filter((a) => a !== alan);
    if (!izin.includes(alan)) izin.push(alan);
  }
  const cikarilacak = oku('cikar');
  engel = engel.filter((a) => !cikarilacak.includes(a));
  izin = izin.filter((a) => !cikarilacak.includes(a));
  if (engel.length > ALAN_SINIRI || izin.length > ALAN_SINIRI) return [`❌ Her listede en fazla ${ALAN_SINIRI} alan olabilir; hiçbir şey değiştirilmedi.`];
  ayarKaydet(interaction.guildId, 'korumaAlanEngel', engel);
  ayarKaydet(interaction.guildId, 'korumaAlanIzin', izin);
  return [
    '✅ Alan listeleri kaydedildi.',
    gecersiz.length ? `⚠️ Geçersiz alan adı, eklenmedi: ${gecersiz.map((g) => `\`${g.slice(0, 60)}\``).join(', ')}` : null,
    ayar.baglanti ? null : 'Bağlantı denetimi şu an kapalı; açmak için **Bağlantı** düğmesine bas.',
  ].filter(Boolean);
}

module.exports = {
  id: ID,
  ad: 'Koruma',
  simge: '🛡️',
  aciklama: 'Spam, küfür, dolandırıcılık görseli ve zararlı bağlantı filtreleri',
  ozet(guild) {
    const ayar = ayarCoz(guild.id);
    const acik = Object.keys(FILTRELER).filter((t) => ayar[t]);
    return acik.length ? `🟢 ${acik.map((t) => FILTRELER[t].kisa).join(', ')}` : '⚫ Hepsi kapalı';
  },
  ekran(interaction) {
    const ayar = ayarCoz(interaction.guildId);
    return {
      embeds: [kart(interaction.guildId)],
      components: [
        satir(...Object.entries(FILTRELER).map(([tur, f]) => acKapat(ID, tur, f.kisa, ayar[tur]))),
        satir(
          dugme(ID, 'sureler', '⏱️ Susturma süreleri'),
          dugme(ID, 'kapsam', `Görsel: ${ayar.gorselKapsam === 'hepsi' ? 'bütün resimler' : 'riskli resimler'}`, ayar.gorselKapsam === 'hepsi' ? ButtonStyle.Success : ButtonStyle.Secondary),
          dugme(ID, 'kisaltici', `Kısaltıcılar: ${ayar.kisaltici ? 'silinir' : 'silinmez'}`, ayar.kisaltici ? ButtonStyle.Success : ButtonStyle.Secondary),
          dugme(ID, 'kelimeler', '📝 Özel kelimeler', ButtonStyle.Primary),
          dugme(ID, 'alanlar', '🔗 Alanlar', ButtonStyle.Primary),
        ),
      ],
    };
  },
  form: (interaction, islem) => formlar[islem]?.(interaction.guildId) ?? null,
  islem(interaction, islem) {
    const sunucuId = interaction.guildId;
    if (FILTRELER[islem]) return filtre(interaction, islem);
    if (islem === 'kapsam') {
      const hepsi = ayarCoz(sunucuId).gorselKapsam !== 'hepsi';
      ayarKaydet(sunucuId, 'korumaGorselKapsam', hepsi ? 'hepsi' : 'riskli');
      return [
        hepsi
          ? '✅ Görsel denetimi artık **bütün resimlere** bakar.'
          : '✅ Görsel denetimi artık **yalnızca riskli resimlere** bakar (yeni üyeler, bağlantılı ya da toplu etiketli mesajlar, tek mesajda birden fazla resim, aynı resmi birden fazla kanala atma).',
      ];
    }
    if (islem === 'kisaltici') {
      const sil = !ayarCoz(sunucuId).kisaltici;
      ayarKaydet(sunucuId, 'korumaKisaltici', sil);
      return [sil ? '✅ Kısaltılmış bağlantılar (bit.ly vb.) da silinecek.' : '✅ Kısaltılmış bağlantılar (bit.ly vb.) artık silinmeyecek.'];
    }
    if (islem === 'sureler-form') return sureler(interaction);
    if (islem === 'kelimeler-form') return kelimeler(interaction);
    if (islem === 'alanlar-form') return alanlar(interaction);
    return [];
  },
  // Test için
  kart,
};
