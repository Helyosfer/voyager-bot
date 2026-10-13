// Topluluk sunucusu şablonu: /sunucukur ile kurulan roller, kategoriler, kanallar ve
// bunlara bağlı akışlar (üyelik onayı, ilgi rolleri, destek talepleri).
//
// İzin mantığı: erişim kategori düzeyinde tanımlanır ve kanallar kategorisiyle
// eşitlenmiş (senkron) oluşturulur. Yalnızca farklı davranması gereken kanallar
// (duyuru, kurallar, bot akışları...) kendi iznini taşır.
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits: P,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  SnowflakeUtil,
  escapeMarkdown,
} = require('discord.js');
const { ayarlariGetir, ayarKaydet } = require('./depo');
const { beklemeSayaci, neZaman } = require('./yardimci');

// --- Roller: hiyerarşi sırasıyla, en üstteki en başta ---
const ROLLER = [
  { k: 'yonetici', ad: '⚙️ Yönetici', renk: 0xe74c3c, ayri: true, izinler: [P.KickMembers, P.BanMembers, P.ModerateMembers, P.ManageMessages, P.ViewAuditLog] },
  { k: 'moderator', ad: '🛡️ Moderatör', renk: 0xe67e22, ayri: true, izinler: [P.KickMembers, P.ModerateMembers, P.ManageMessages, P.ViewAuditLog] },
  { k: 'destek', ad: '🆘 Destek Ekibi', renk: 0x1abc9c, ayri: true },
  { k: 'etkinlik', ad: '📅 Etkinlik Ekibi', renk: 0x3498db, ayri: true },
  { k: 'uretici', ad: '🎥 İçerik Üreticisi', renk: 0xe84393, ayri: true },
  { k: 'destekci', ad: '💎 Destekçi', renk: 0xf1c40f, ayri: true },
  { k: 'uye', ad: '✅ Üye', renk: 0x2ecc71 },
  { k: 'yeni', ad: '🆕 Yeni Gelen', renk: 0x95a5a6 },
  { k: 'bildirim', ad: '🔔 Etkinlik Bildirimleri', renk: 0xf1c40f, ilgi: 'Etkinlik duyurularında etiketlen' },
  { k: 'oyuncu', ad: '🎮 Oyuncu', renk: 0x5865f2, ilgi: 'Oyun sohbetleri ve takım arama' },
  { k: 'teknoloji', ad: '💻 Teknoloji', renk: 0x3498db, ilgi: 'Donanım, ürünler, haberler' },
  { k: 'yazilim', ad: '👨‍💻 Yazılım', renk: 0x2ecc71, ilgi: 'Programlama ve projeler' },
  { k: 'tasarim', ad: '🎨 Tasarım', renk: 0xe84393, ilgi: 'Görsel, UI ve fotoğraf' },
  { k: 'muzik', ad: '🎵 Müzik', renk: 0x9b59b6, ilgi: 'Müzik önerileri' },
  { k: 'film', ad: '🎬 Film & Dizi', renk: 0xe67e22, ilgi: 'Film, dizi, belgesel' },
];

const YONETIM = ['yonetici'];
const MOD = ['yonetici', 'moderator'];
const DESTEK = ['yonetici', 'moderator', 'destek'];
const EKIP = ['yonetici', 'moderator', 'destek', 'etkinlik'];

const GOR = [P.ViewChannel, P.ReadMessageHistory];
const YAZ = [P.SendMessages];
const SES = [P.Connect, P.Speak, P.Stream];
const BOT = [P.ViewChannel, P.ReadMessageHistory, P.SendMessages, P.EmbedLinks, P.AttachFiles];

const kural = (roller, izin = [], yasak = []) => roller.map((rol) => ({ rol, izin, yasak }));

// Kategori politikaları. "herkes" = @everyone
const POLITIKALAR = {
  // Herkes görür, yalnızca ekip yazar; kanallar gerekirse kendi iznini taşır
  baslangic: [...kural(['herkes', 'yeni', 'uye'], GOR, YAZ), ...kural(EKIP, [...GOR, ...YAZ])],
  // Yalnızca üyeliğini onaylamış olanlar
  uyeler: [...kural(['herkes'], [], [P.ViewChannel]), ...kural(['uye', ...EKIP], [...GOR, ...YAZ])],
  ses: [...kural(['herkes'], [], [P.ViewChannel, P.Connect]), ...kural(['uye', ...EKIP], [...GOR, ...YAZ, ...SES])],
  ozel: [...kural(['herkes'], [], [P.ViewChannel, P.Connect]), ...kural(['destekci', 'uretici', ...EKIP], [...GOR, ...YAZ, ...SES])],
  // Herkes görür, üyeler yazar
  destekAcik: [...kural(['herkes', 'yeni'], GOR, YAZ), ...kural(['uye', ...EKIP], [...GOR, ...YAZ])],
  destekOzel: [...kural(['herkes'], [], [P.ViewChannel]), ...kural(DESTEK, [...GOR, ...YAZ])],
  moderasyon: [...kural(['herkes'], [], [P.ViewChannel]), ...kural(MOD, [...GOR, ...YAZ])],
  ekip: [...kural(['herkes'], [], [P.ViewChannel, P.Connect]), ...kural(EKIP, [...GOR, ...YAZ, ...SES])],
  yonetim: [...kural(['herkes'], [], [P.ViewChannel]), ...kural(YONETIM, [...GOR, ...YAZ])],
};

// Kategorisinden farklı davranan kanalların izinleri
const ERISIMLER = {
  // Herkes okur, ekip yazar (duyuru, düğmeli kanallar)
  salt: [...kural(['herkes', 'yeni', 'uye'], GOR, YAZ), ...kural(EKIP, [...GOR, ...YAZ])],
  // Herkes okur, yalnızca yöneticiler yazar
  yoneticiYazar: [...kural(['herkes', 'yeni', 'uye'], GOR, YAZ), ...kural(EKIP, GOR, YAZ), ...kural(YONETIM, [...GOR, ...YAZ])],
  // Yalnızca üyeler görür ve yazar (herkese açık kategoride)
  uyeYazar: [...kural(['herkes', 'yeni'], [], [P.ViewChannel]), ...kural(['uye', ...EKIP], [...GOR, ...YAZ])],
  // Yalnızca üyeler görür, ekip yazar
  uyeSalt: [...kural(['herkes', 'yeni'], [], [P.ViewChannel]), ...kural(['uye'], GOR, YAZ), ...kural(EKIP, [...GOR, ...YAZ])],
  // Üyeler okur; etkinlik ekibi ve yöneticiler yazar
  etkinlikYazar: [...kural(['herkes'], [], [P.ViewChannel]), ...kural(['uye', ...EKIP], GOR, YAZ), ...kural(['etkinlik', ...YONETIM], [...GOR, ...YAZ])],
  // Üyeler okur; botun doldurduğu akış (fırsatlar, yayınlar)
  botAkisi: [...kural(['herkes'], [], [P.ViewChannel]), ...kural(['uye', ...EKIP], GOR, YAZ), ...kural(YONETIM, [...GOR, ...YAZ])],
  // Ekip okur, yalnızca yöneticiler yazar
  ekipSalt: [...kural(['herkes'], [], [P.ViewChannel]), ...kural(EKIP, GOR, YAZ), ...kural(YONETIM, [...GOR, ...YAZ])],
};

// Kanal alanları: ad, konu, yavas (saniye), erisim (yoksa kategoriyle eşitlenir), ses,
// ayar (botun bu ayarı o kanala bağlanır), anahtar (akışların kullandığı kanal)
const KATEGORILER = [
  {
    ad: '📌・BAŞLANGIÇ', politika: 'baslangic',
    kanallar: [
      { ad: '👋・hoş-geldin', konu: 'Sunucuya hoş geldin! Önce kuralları ve rehberi oku.', erisim: 'salt', ayar: 'hosgeldinKanali', anahtar: 'hosgeldin' },
      { ad: '📜・kurallar', konu: 'Sunucudaki herkes için geçerli temel kurallar.', erisim: 'yoneticiYazar', anahtar: 'kurallar' },
      { ad: '📢・duyurular', konu: 'Sunucu duyuruları ve önemli güncellemeler.', erisim: 'salt' },
      { ad: '🧭・sunucu-rehberi', konu: 'Kategoriler ve kanallar hakkında kısa rehber.', erisim: 'yoneticiYazar', anahtar: 'rehber' },
      { ad: '✅・üyelik-onay', konu: 'Kuralları okuduktan sonra düğmeye basarak üye ol.', erisim: 'salt', anahtar: 'onay' },
      { ad: '🎭・rol-seçimi', konu: 'İlgi alanlarını seç; istediğin zaman değiştirebilirsin.', erisim: 'uyeSalt', anahtar: 'rol' },
      { ad: '🙋・tanışma', konu: 'Kendini tanıt. Adres, telefon gibi kişisel bilgilerini paylaşma.', yavas: 10, erisim: 'uyeYazar' },
    ],
  },
  {
    ad: '💬・TOPLULUK', politika: 'uyeler',
    kanallar: [
      { ad: '💬・genel-sohbet', konu: 'Günlük sohbet ve topluluk muhabbeti.', yavas: 2 },
      { ad: '🗞️・gündem', konu: 'Güncel konular; saygılı ve kaynaklı tartışma.', yavas: 3 },
      { ad: '😂・mizah', konu: 'Mizah ve eğlenceli paylaşımlar.', yavas: 2 },
      { ad: '🖼️・medya', konu: 'Görsel, video ve bağlantı paylaşımları.', yavas: 2 },
      { ad: '❓・yardım-sorular', konu: 'Sorunu açıkça yaz; çözülünce sonucu paylaş.', yavas: 5 },
      { ad: '💡・öneriler', konu: 'Sunucu ve topluluk için öneriler.', yavas: 5 },
      { ad: '🤖・bot-komut', konu: 'Bot komutlarını burada kullan. /yardim ile başla.', yavas: 2 },
    ],
  },
  {
    ad: '🎮・OYUN', politika: 'uyeler',
    kanallar: [
      { ad: '🎮・oyun-sohbeti', konu: 'Oyunlar, güncellemeler ve deneyimler.', yavas: 2 },
      { ad: '🤝・takım-arama', konu: 'Birlikte oynayacak oyuncu ya da takım arkadaşı bul.', yavas: 5 },
      { ad: '⛏️・minecraft', konu: 'Minecraft sohbeti, yapılar ve sunucular.', yavas: 3 },
      { ad: '🤠・rdr2-gta', konu: 'Red Dead Redemption, GTA ve açık dünya oyunları.', yavas: 3 },
      { ad: '🏷️・oyun-fırsatları', konu: 'İndirimler ve bedava oyunlar. Voyager kendiliğinden paylaşır.', erisim: 'botAkisi', ayar: 'oyunKanali' },
      { ad: '📡・yayınlar', konu: 'Takip edilen yayıncılar yayına geçince burada duyurulur.', erisim: 'botAkisi', ayar: 'yayinKanali' },
    ],
  },
  {
    ad: '💻・TEKNOLOJİ & YAZILIM', politika: 'uyeler',
    kanallar: [
      { ad: '📱・teknoloji', konu: 'Teknoloji haberleri, ürünler ve genel sohbet.', yavas: 3 },
      { ad: '🖥️・donanım', konu: 'PC donanımı, çevre birimleri ve sistem toplama.', yavas: 3 },
      { ad: '📦・mini-pc', konu: 'Mini PC seçenekleri, performans ve deneyimler.', yavas: 3 },
      { ad: '👨‍💻・yazılım', konu: 'Programlama, hata ayıklama ve yazılım geliştirme.', yavas: 3 },
      { ad: '🐧・linux-sunucular', konu: 'Linux, VPS, SSH, kendi sunucunu barındırma.', yavas: 3 },
      { ad: '🔐・siber-güvenlik', konu: 'Savunma, gizlilik ve güvenli yapılandırma. İzinsiz erişim paylaşımı yasaktır.', yavas: 5 },
      { ad: '🚀・projeler', konu: 'Kişisel projelerini ve açık kaynak çalışmalarını paylaş.', yavas: 5 },
    ],
  },
  {
    ad: '🎨・MEDYA & HOBİ', politika: 'uyeler',
    kanallar: [
      { ad: '🎵・müzik', konu: 'Müzik önerileri ve sohbet.', yavas: 3 },
      { ad: '🎬・film-dizi', konu: 'Film, dizi ve belgesel önerileri. Sürprizbozanları gizle.', yavas: 3 },
      { ad: '📷・fotoğraf-tasarım', konu: 'Fotoğraf, illüstrasyon, arayüz ve tasarım çalışmaları.', yavas: 3 },
    ],
  },
  {
    ad: '🔊・SES KANALLARI', politika: 'ses',
    kanallar: [
      { ad: '🎙️ Genel Sohbet', ses: true },
      { ad: '☕ Dinlenme Odası', ses: true },
      { ad: '🎮 Oyun Odası 1', ses: true },
      { ad: '🎮 Oyun Odası 2', ses: true },
      { ad: '📚 Birlikte Çalışma', ses: true },
      { ad: '💤 AFK', ses: true },
    ],
  },
  {
    ad: '📅・ETKİNLİKLER', politika: 'ses',
    kanallar: [
      { ad: '📣・etkinlik-duyuru', konu: 'Resmî etkinlik ilanları ve programları.', erisim: 'etkinlikYazar' },
      { ad: '🎉・etkinlik-sohbeti', konu: 'Etkinlikler hakkında sohbet ve katılım planları.', yavas: 3 },
      { ad: '🎤 Etkinlik Sahnesi', ses: true },
    ],
  },
  {
    ad: '🌟・ÖZEL ALAN', politika: 'ozel',
    kanallar: [
      { ad: '💎・destekçi-sohbet', konu: 'Destekçiler ve içerik üreticileri için özel sohbet.', yavas: 3 },
      { ad: '🎥・içerik-üretici', konu: 'İçerik üretimi, yayın ve topluluk projeleri.', yavas: 3 },
      { ad: '💎 Özel Ses', ses: true },
    ],
  },
  {
    ad: '🆘・DESTEK MERKEZİ', politika: 'destekAcik',
    kanallar: [
      { ad: '🎫・destek-merkezi', konu: 'Özel destek odası açmak için düğmeyi kullan.', erisim: 'salt', anahtar: 'destek' },
      { ad: '🆘・destek-sohbeti', konu: 'Genel yardım soruları. Özel bilgilerini burada paylaşma.', yavas: 5 },
    ],
  },
  { ad: '🎫・DESTEK TALEPLERİ', politika: 'destekOzel', anahtar: 'talepler', kanallar: [] },
  {
    ad: '🧰・DESTEK EKİBİ', politika: 'destekOzel',
    kanallar: [
      { ad: '🧰・destek-ekip', konu: 'Destek ekibinin koordinasyon alanı.' },
      { ad: '🗂️・destek-kayıtları', konu: 'Destek taleplerinin açılış ve kapanış kayıtları.', anahtar: 'destekKayit' },
    ],
  },
  {
    ad: '🛡️・MODERASYON', politika: 'moderasyon',
    kanallar: [
      { ad: '🛡️・mod-sohbeti', konu: 'Moderatör ekibinin koordinasyonu.' },
      { ad: '📋・mod-log', konu: 'Voyager sunucu günlüğü: üye, mesaj, ses ve yönetim olayları.', ayar: 'logKanali' },
      { ad: '⚖️・ceza-kayıtları', konu: 'Uyarı, susturma, atma ve yasaklama kararlarının gerekçeli kayıtları.' },
      { ad: '🚩・rapor-inceleme', konu: 'Üye raporlarının ve kanıtların incelenmesi.' },
    ],
  },
  {
    ad: '🔐・EKİP ALANI', politika: 'ekip',
    kanallar: [
      { ad: '🔐・ekip-sohbeti', konu: 'Sunucu ekibinin iç iletişimi.' },
      { ad: '📌・ekip-duyurular', konu: 'Ekip içi önemli duyurular.', erisim: 'ekipSalt' },
      { ad: '🔐 Ekip Sesi', ses: true },
    ],
  },
  {
    ad: '⚙️・YÖNETİM', politika: 'yonetim',
    kanallar: [
      { ad: '⚙️・yönetim', konu: 'Sunucu yapılandırması ve yönetim notları.' },
      { ad: '🤖・bot-notları', konu: 'Bot ayarları ve otomasyon notları.' },
    ],
  },
];

const RENK = 0x5865f2;
const turu = (kanal) => (kanal.ses ? ChannelType.GuildVoice : ChannelType.GuildText);

// Şablonu sunucunun mevcut haliyle karşılaştırır. Aynı adda olan öğeler "mevcut" sayılır
// ve onlara dokunulmaz.
function planla(guild) {
  const kanallar = [...guild.channels.cache.values()];
  const roller = [...guild.roles.cache.values()];
  const plan = { roller: [], kategoriler: [], yeni: 0, mevcut: 0 };
  const say = (bulunan) => (bulunan ? plan.mevcut++ : plan.yeni++);

  for (const rol of ROLLER) {
    const mevcut = roller.find((r) => r.name === rol.ad) ?? null;
    say(mevcut);
    plan.roller.push({ ...rol, mevcut });
  }
  for (const kategori of KATEGORILER) {
    const mevcut = kanallar.find((k) => k.type === ChannelType.GuildCategory && k.name === kategori.ad) ?? null;
    say(mevcut);
    const alt = kategori.kanallar.map((kanal) => {
      const bulunan = kanallar.find((k) => k.type === turu(kanal) && k.name === kanal.ad) ?? null;
      say(bulunan);
      return { ...kanal, mevcut: bulunan };
    });
    plan.kategoriler.push({ ...kategori, mevcut, kanallar: alt });
  }
  return plan;
}

// Planı uygular. ilerleme(metin) varsa her kategoriden sonra çağrılır.
async function kur(guild, plan, yapan, ilerleme = async () => {}) {
  const sebep = `Voyager /sunucukur (${yapan})`;
  const ben = guild.members.me;
  const sonuc = { olusturulan: 0, baglanan: [], uyarilar: [], hata: null };
  const roller = {};
  // Bot yalnızca kendisinde olan izinleri verebilir ya da yasaklayabilir
  const suz = (izinler) => izinler.filter((izin) => ben.permissions.has(izin));

  const izinListesi = (kurallar) => [
    ...kurallar
      .map(({ rol, izin, yasak }) => ({
        id: rol === 'herkes' ? guild.roles.everyone.id : roller[rol]?.id,
        allow: suz(izin),
        deny: suz(yasak),
      }))
      .filter((k) => k.id),
    { id: ben.id, allow: suz(BOT) },
  ];

  try {
    for (const rol of plan.roller) {
      roller[rol.k] =
        rol.mevcut ??
        (await guild.roles.create({
          name: rol.ad,
          color: rol.renk,
          hoist: Boolean(rol.ayri),
          mentionable: rol.k === 'bildirim',
          permissions: suz(rol.izinler ?? []),
          reason: sebep,
        }));
      if (!rol.mevcut) sonuc.olusturulan++;
    }

    // Yeni rolleri hiyerarşiye diz: listenin başındaki en üstte. Yalnızca bu kurulumda
    // oluşturulanlar taşınır; mevcut rollerin sırasına dokunulmaz.
    const yeniRoller = plan.roller.filter((r) => !r.mevcut).map((r) => roller[r.k]);
    await guild.roles
      .setPositions(yeniRoller.map((rol, i) => ({ role: rol.id, position: yeniRoller.length - i })))
      .catch(() => sonuc.uyarilar.push('Roller sıralanamadı; Sunucu Ayarları → Roller bölümünden elle sıralaman gerekebilir.'));

    const kanallar = {};
    const kategoriler = {};
    for (const kategori of plan.kategoriler) {
      const ust =
        kategori.mevcut ??
        (await guild.channels.create({
          name: kategori.ad,
          type: ChannelType.GuildCategory,
          permissionOverwrites: izinListesi(POLITIKALAR[kategori.politika]),
          reason: sebep,
        }));
      if (!kategori.mevcut) sonuc.olusturulan++;
      if (kategori.anahtar) kategoriler[kategori.anahtar] = ust.id;

      for (const kanal of kategori.kanallar) {
        const olusan =
          kanal.mevcut ??
          (await guild.channels.create({
            name: kanal.ad,
            type: turu(kanal),
            parent: ust.id,
            topic: kanal.ses ? undefined : kanal.konu,
            rateLimitPerUser: kanal.ses ? undefined : kanal.yavas,
            // İzin verilmezse kanal kategorisiyle eşitlenmiş (senkron) oluşur
            permissionOverwrites: kanal.erisim ? izinListesi(ERISIMLER[kanal.erisim]) : undefined,
            reason: sebep,
          }));
        if (!kanal.mevcut) sonuc.olusturulan++;
        if (kanal.anahtar) kanallar[kanal.anahtar] = { id: olusan.id, yeni: !kanal.mevcut, kanal: olusan };
        if (kanal.ayar) {
          ayarKaydet(guild.id, kanal.ayar, olusan.id);
          sonuc.baglanan.push(`${olusan} → ${AYAR_ADLARI[kanal.ayar]}`);
        }
      }
      await ilerleme(`⏳ Kuruluyor… **${kategori.ad}** tamam (${sonuc.olusturulan} öğe)`).catch(() => {});
    }

    // Akışların (onay, roller, destek) kullanacağı kimlikleri sakla
    ayarKaydet(guild.id, 'topluluk', {
      roller: Object.fromEntries(Object.entries(roller).map(([k, r]) => [k, r.id])),
      kanallar: Object.fromEntries(Object.entries(kanallar).map(([k, v]) => [k, v.id])),
      kategoriler,
    });
    // Yeni gelenler "Yeni Gelen" rolüyle başlar; onay düğmesi "Üye"ye çevirir
    if (roller.yeni.position < ben.roles.highest.position) {
      ayarKaydet(guild.id, 'otoRol', roller.yeni.id);
      sonuc.baglanan.push(`Yeni gelenlere ${roller.yeni} rolü verilecek`);
    } else {
      sonuc.uyarilar.push('"Yeni Gelen" rolü benim rolümün üstünde olduğu için otomatik veremiyorum. Voyager rolünü yukarı taşı.');
    }

    // Tanıtım mesajları yalnızca bu kurulumda oluşturulan kanallara atılır
    for (const [anahtar, hazirla] of Object.entries(MESAJLAR)) {
      if (kanallar[anahtar]?.yeni) await kanallar[anahtar].kanal.send(hazirla(kanallar)).catch(() => {});
    }
  } catch (hata) {
    sonuc.hata = hata.message;
  }
  return sonuc;
}

const AYAR_ADLARI = {
  logKanali: 'sunucu günlüğü',
  hosgeldinKanali: 'hoş geldin mesajları',
  oyunKanali: 'oyun fırsatları',
  yayinKanali: 'yayın bildirimleri',
};

const etiket = (kanallar, anahtar) => (kanallar[anahtar] ? `<#${kanallar[anahtar].id}>` : `#${anahtar}`);
const kart = (baslik, aciklama) => new EmbedBuilder().setTitle(baslik).setColor(RENK).setDescription(aciklama);

// Kanallara atılan ilk mesajlar
const MESAJLAR = {
  hosgeldin: (k) => ({
    embeds: [
      kart(
        '👋 Hoş geldin!',
        [
          `**1.** ${etiket(k, 'kurallar')} kanalını oku.`,
          `**2.** ${etiket(k, 'onay')} kanalındaki düğmeye basarak üye ol.`,
          `**3.** ${etiket(k, 'rol')} kanalından ilgi alanlarını seç.`,
          `**4.** Yardıma ihtiyacın olursa ${etiket(k, 'destek')} kanalından özel destek odası aç.`,
          '',
          'Güvenliğin için şifre, token ya da adres gibi özel bilgilerini kimseyle paylaşma.',
        ].join('\n'),
      ),
    ],
  }),
  kurallar: () => ({
    embeds: [
      kart(
        '📜 Sunucu kuralları',
        [
          '**1.** Herkese saygılı davran. Taciz, nefret söylemi ve hedef gösterme yasaktır.',
          '**2.** Spam, flood, izinsiz reklam ve davet bağlantısı paylaşma.',
          '**3.** Kişisel bilgileri, şifreleri, API anahtarlarını ya da tokenları paylaşma.',
          '**4.** Telif ihlali, dolandırıcılık, zararlı yazılım ve izinsiz erişim yönlendirmesi paylaşma.',
          '**5.** Tartışmalarda konuya odaklan; sürprizbozan ve hassas içerikleri belirt.',
          '**6.** Moderatör kararlarına itirazını özel destek odasından, saygılı biçimde yap.',
          '**7.** Yetkililer senden asla şifre ya da token istemez. Şüpheli bir durumu bildir.',
          '',
          'Sunucuda bulunmak bu kurallara uymayı kabul ettiğin anlamına gelir.',
        ].join('\n'),
      ).setFooter({ text: 'Bu metni sunucuna göre düzenleyebilirsin.' }),
    ],
  }),
  rehber: () => ({
    embeds: [
      kart(
        '🧭 Sunucu rehberi',
        [
          '**💬 Topluluk** · genel sohbet, gündem, sorular ve öneriler',
          '**🎮 Oyun** · oyun sohbeti, takım arama, fırsatlar ve yayın bildirimleri',
          '**💻 Teknoloji & Yazılım** · donanım, programlama, Linux ve güvenlik',
          '**🎨 Medya & Hobi** · müzik, film/dizi, fotoğraf ve tasarım',
          '**🔊 Ses kanalları** · sohbet, dinlenme, oyun ve birlikte çalışma',
          '**📅 Etkinlikler** · etkinlik duyuruları ve katılımcı sohbeti',
          '**🆘 Destek** · herkese açık sorular ve özel destek odaları',
        ].join('\n'),
      ),
    ],
  }),
  onay: () => ({
    embeds: [kart('✅ Üyeliğini etkinleştir', 'Kuralları okuyup kabul ettikten sonra aşağıdaki düğmeye bas. **Üye** rolünü alırsın ve topluluk kanalları açılır.')],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tp:onay').setLabel('Kuralları okudum, üye ol').setEmoji('✅').setStyle(ButtonStyle.Success))],
  }),
  rol: () => ({
    embeds: [kart('🎭 İlgi alanı rolleri', 'Aşağıdaki menüden ilgi alanlarını seç. Birden fazla seçebilir, istediğin zaman değiştirebilirsin; seçmediklerin kaldırılır.')],
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('tp:rol')
          .setPlaceholder('İlgi alanlarını seç')
          .setMinValues(0)
          .setMaxValues(ROLLER.filter((r) => r.ilgi).length)
          .addOptions(ROLLER.filter((r) => r.ilgi).map((r) => ({ label: r.ad.replace(/^\S+\s/, ''), value: r.k, description: r.ilgi, emoji: r.ad.split(' ')[0] }))),
      ),
    ],
  }),
  destek: () => ({
    embeds: [kart('🆘 Özel destek talebi', 'Düğmeye basıp konuyu kısaca yaz. Yalnızca senin ve destek ekibinin görebildiği bir oda açılır. İşin bitince odadaki **Talebi kapat** düğmesini kullan.')],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tp:talep').setLabel('Destek talebi aç').setEmoji('🎫').setStyle(ButtonStyle.Primary))],
  }),
};

// ---------------------------------------------------------------------------
// Akışlar: düğme, menü ve form etkileşimleri (customId "tp:" ile başlar)
// ---------------------------------------------------------------------------
const gizli = (interaction, content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

async function uyeOl(interaction, t) {
  const { member, guild } = interaction;
  const uye = guild.roles.cache.get(t.roller.uye);
  if (!uye) return gizli(interaction, '❌ Üye rolü bulunamadı. Bir yöneticiye haber ver.');
  if (member.roles.cache.has(uye.id)) return gizli(interaction, 'Üye rolün zaten var. Hoş geldin!');
  try {
    await member.roles.add(uye, 'Üyelik onayı');
    if (member.roles.cache.has(t.roller.yeni)) await member.roles.remove(t.roller.yeni, 'Üyelik onayı tamamlandı');
  } catch {
    return gizli(interaction, '❌ Rol veremedim. Bir yönetici Voyager rolünü rol listesinde yukarı taşımalı.');
  }
  return gizli(interaction, `✅ Üyeliğin etkinleştirildi! ${t.kanallar.rol ? `<#${t.kanallar.rol}> kanalından ilgi alanlarını seçebilirsin.` : ''}`);
}

async function rolSec(interaction, t) {
  const { member } = interaction;
  if (!member.roles.cache.has(t.roller.uye)) {
    return gizli(interaction, `❌ Önce ${t.kanallar.onay ? `<#${t.kanallar.onay}>` : 'üyelik onayı'} kanalından üye ol.`);
  }
  const secilen = new Set(interaction.values);
  const verilen = [];
  try {
    for (const rol of ROLLER.filter((r) => r.ilgi)) {
      const id = t.roller[rol.k];
      if (!id) continue;
      if (secilen.has(rol.k)) {
        if (!member.roles.cache.has(id)) await member.roles.add(id, 'İlgi rolü seçimi');
        verilen.push(rol.ad);
      } else if (member.roles.cache.has(id)) await member.roles.remove(id, 'İlgi rolü seçimi');
    }
  } catch {
    return gizli(interaction, '❌ Rolleri güncelleyemedim. Bir yönetici Voyager rolünü rol listesinde yukarı taşımalı.');
  }
  return gizli(interaction, verilen.length ? `✅ Rollerin güncellendi: ${verilen.join(', ')}` : '✅ Bütün ilgi rollerin kaldırıldı.');
}

// Konu "sahip=<kimlik>; konu=<üyenin yazdığı metin>" biçimindedir. Sahip yalnızca baştan
// okunur: üye konuya başkasının kimliğini yazarak onun talep açmasını engelleyemesin.
const acikTalep = (guild, t, uyeId) =>
  guild.channels.cache.find((k) => k.parentId === t.kategoriler.talepler && k.topic?.startsWith(`sahip=${uyeId};`) && !k.name.startsWith('kapalı-'));

// --- Destek odalarının sınırları ---
// Kapatılan oda hemen silinmez, ama süresiz de durmaz. Yoksa bir üye aç-kapat yaparak kategoriyi
// doldurur (Discord bir kategoride en fazla 50 kanala izin verir) ve kimse talep açamaz.
const TALEP_ARALIGI = 10 * 60_000; // Bir üye bu aralıktan sık talep açamaz
const KAPALI_ODA_OMRU = 30 * 24 * 60 * 60_000; // Kapalı oda bu kadar süre sonra silinir
const UYE_BASI_KAPALI_ODA = 3; // Bir üyenin saklanan kapalı oda sayısı; fazlası en eskiden başlayarak silinir
// Yukarıdakiler hesap başınadır; çok sayıda hesap kullanan biri için ayrıca sunucu geneli sınırlar:
const SUNUCU_SAATLIK_TALEP = 15; // Bir sunucuda bir saatte açılabilen talep sayısı
const KATEGORI_ESIGI = 40; // Kategori bu kadar kanala ulaşınca en eski kapalı odalar silinir (Discord sınırı 50)
// Aynı anda açık oda sayısı. Eşikten küçük olduğu için kategori açık odalarla doldurulamaz:
// kapalı odalar eşikte silinir, açık odalar bu sınırı geçemez.
const ACIK_ODA_SINIRI = 25;
const UYELIK_BEKLEMESI = 10 * 60_000; // Sunucuya yeni katılan bu süre dolmadan talep açamaz
const SAAT = 60 * 60_000;
const talepSayaci = beklemeSayaci(TALEP_ARALIGI);
const sinirUyarisi = beklemeSayaci(SAAT);
const sonTalepler = new Map(); // sunucuId -> son bir saatte açılan taleplerin zamanları

function sonSaattekiler(sunucuId) {
  const liste = (sonTalepler.get(sunucuId) ?? []).filter((zaman) => Date.now() - zaman < SAAT);
  sonTalepler.set(sunucuId, liste);
  return liste;
}

// Talep açılamıyorsa üyeye gösterilecek mesajı döndürür, açılabiliyorsa null.
// Ekibe destek kayıt kanalından haber verir; aynı türden uyarı en sık saatte bir yazılır
async function ekibeHaber(interaction, t, tur, metin) {
  const anahtar = `${interaction.guildId}:${tur}`;
  if (sinirUyarisi.bekle(anahtar)) return;
  sinirUyarisi.isaretle(anahtar);
  await kayitYaz(interaction.guild, t, metin);
}

async function talepBeklemesi(interaction, t) {
  // Yeni açılmış hesaplarla sunucuya girip hemen oda açmaya karşı
  const katildi = interaction.member?.joinedTimestamp;
  if (katildi && Date.now() - katildi < UYELIK_BEKLEMESI) {
    return `⏳ Sunucuya yeni katıldın. Destek talebini ${neZaman(katildi + UYELIK_BEKLEMESI - Date.now())} açabilirsin.`;
  }
  const kalan = talepSayaci.bekle(`${interaction.guildId}:${interaction.user.id}`);
  if (kalan) return `⏳ Az önce bir destek talebi açtın. Yenisini ${neZaman(kalan)} açabilirsin.`;

  const acik = interaction.guild.channels.cache.filter((k) => k.parentId === t.kategoriler.talepler && !k.name.startsWith('kapalı-')).size;
  if (acik >= ACIK_ODA_SINIRI) {
    await ekibeHaber(interaction, t, 'acik', `⚠️ Aynı anda ${ACIK_ODA_SINIRI} destek odası açık; biri kapanana kadar yeni talep açılamaz. Biten talepleri kapat; kötüye kullanım varsa hesapları sunucudan at.`);
    return '⏳ Destek ekibi şu an çok yoğun, yeni talep açılamıyor. Biraz sonra yeniden dene.';
  }
  if (sonSaattekiler(interaction.guildId).length >= SUNUCU_SAATLIK_TALEP) {
    await ekibeHaber(interaction, t, 'saatlik', `⚠️ Son bir saatte ${SUNUCU_SAATLIK_TALEP} destek talebi açıldı; yenileri bir süre reddedilecek. Kötüye kullanım olabilir: açılan odalara bak.`);
    return '⏳ Şu an çok fazla destek talebi açılıyor. Biraz sonra yeniden dene.';
  }
  return null;
}

const odaSahibi = (kanal) => /^sahip=(\d+);/.exec(kanal.topic ?? '')?.[1] ?? null;
// Kapanma zamanı ayrıca saklanmaz: odadaki son mesajın (çoğunlukla "kapatıldı" mesajı) zamanı kullanılır
const sonHareket = (kanal) => (kanal.lastMessageId ? SnowflakeUtil.timestampFrom(kanal.lastMessageId) : kanal.createdTimestamp);

// Süresi dolan kapalı odaları ve bu üyenin fazla kapalı odalarını siler; kategori dolmaya
// yaklaştıysa yeni odaya yer açar. Yeni talep açılırken çağrılır.
async function eskiOdalariSil(guild, t, uyeId) {
  const odalar = [...guild.channels.cache.values()].filter((k) => k.parentId === t.kategoriler.talepler);
  const kapali = odalar.filter((k) => k.name.startsWith('kapalı-')).sort((a, b) => sonHareket(b) - sonHareket(a)); // En yeni başta
  const silinecek = new Set([
    ...kapali.filter((k) => Date.now() - sonHareket(k) > KAPALI_ODA_OMRU),
    ...kapali.filter((k) => odaSahibi(k) === uyeId).slice(UYE_BASI_KAPALI_ODA),
  ]);
  // Kategori eşiğe ulaştıysa: sahibine ve yaşına bakmadan en eski kapalı odalar da silinir
  let fazla = odalar.length - silinecek.size - KATEGORI_ESIGI + 1;
  for (const kanal of [...kapali].reverse()) {
    if (fazla <= 0) break;
    if (silinecek.has(kanal)) continue;
    silinecek.add(kanal);
    fazla--;
  }
  for (const kanal of silinecek) {
    const ad = kanal.name;
    const silindi = await kanal.delete('Eski kapalı destek odası').then(() => true, () => false);
    if (silindi) await kayitYaz(guild, t, `🗑️ Eski kapalı destek odası silindi: #${ad}`);
  }
}

async function talepFormu(interaction, t) {
  const mevcut = acikTalep(interaction.guild, t, interaction.user.id);
  if (mevcut) return gizli(interaction, `Zaten açık bir destek odan var: ${mevcut}`);
  const bekleme = await talepBeklemesi(interaction, t);
  if (bekleme) return gizli(interaction, bekleme);
  const konu = new TextInputBuilder()
    .setCustomId('konu')
    .setLabel('Konu')
    .setPlaceholder('Sorununu birkaç kelimeyle yaz')
    .setStyle(TextInputStyle.Short)
    .setMinLength(3)
    .setMaxLength(80)
    .setRequired(true);
  return interaction.showModal(new ModalBuilder().setCustomId('tp:talep-form').setTitle('Destek talebi').addComponents(new ActionRowBuilder().addComponents(konu)));
}

// "Giriş yapamıyorum!" -> "giris-yapamiyorum"
function kisaAd(metin) {
  const sade = metin
    .toLocaleLowerCase('tr')
    .replace(/[ıİ]/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sade.slice(0, 28).replace(/-+$/, '') || 'destek';
}

async function talepAc(interaction, t) {
  const { guild, member } = interaction;
  if (!guild.channels.cache.has(t.kategoriler.talepler)) return gizli(interaction, '❌ Destek talepleri kategorisi bulunamadı. Bir yöneticiye haber ver.');
  const mevcut = acikTalep(guild, t, member.id);
  if (mevcut) return gizli(interaction, `Zaten açık bir destek odan var: ${mevcut}`);
  const bekleme = await talepBeklemesi(interaction, t);
  if (bekleme) return gizli(interaction, bekleme);
  // Oda oluşmadan önce işaretle: form art arda gönderilirse ikincisi buraya takılır
  talepSayaci.isaretle(`${guild.id}:${member.id}`);
  sonSaattekiler(guild.id).push(Date.now());

  const konu = interaction.fields.getTextInputValue('konu').trim();
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await eskiOdalariSil(guild, t, member.id);
  const ben = guild.members.me;
  const suz = (izinler) => izinler.filter((izin) => ben.permissions.has(izin));
  const oda = await guild.channels.create({
    name: `talep-${kisaAd(konu)}-${member.id.slice(-4)}`,
    type: ChannelType.GuildText,
    parent: t.kategoriler.talepler,
    topic: `sahip=${member.id}; konu=${konu}`,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: suz([P.ViewChannel]) },
      { id: member.id, allow: suz([...GOR, ...YAZ, P.AttachFiles, P.EmbedLinks]) },
      ...DESTEK.filter((k) => guild.roles.cache.has(t.roller[k])).map((k) => ({ id: t.roller[k], allow: suz([...GOR, ...YAZ]) })),
      { id: ben.id, allow: suz(BOT) },
    ],
    reason: `Destek talebi: ${member.user.tag}`,
  });
  await oda.send({
    content: `${member}`,
    embeds: [
      kart('🎫 Destek talebin açıldı', `**Konu:** ${escapeMarkdown(konu)}\n\nSorunu, aldığın hata mesajını ve denediğin adımları yaz. Şifre, token ya da kişisel bilgi gönderme.`),
    ],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tp:kapat').setLabel('Talebi kapat').setEmoji('🔒').setStyle(ButtonStyle.Secondary))],
    allowedMentions: { users: [member.id] },
  });
  await kayitYaz(guild, t, `🎫 ${oda} açıldı · ${member} · konu: ${escapeMarkdown(konu)}`);
  return interaction.editReply(`✅ Özel destek odan oluşturuldu: ${oda}`);
}

async function talepKapat(interaction, t) {
  const { channel, member, guild } = interaction;
  if (channel.parentId !== t.kategoriler.talepler) return gizli(interaction, '❌ Bu düğme yalnızca destek odalarında çalışır.');
  if (channel.name.startsWith('kapalı-')) return gizli(interaction, 'Bu destek odası zaten kapalı.');
  const sahip = odaSahibi(channel);
  const ekipten = DESTEK.some((k) => member.roles.cache.has(t.roller[k])) || member.permissions.has(P.ManageChannels);
  if (member.id !== sahip && !ekipten) return gizli(interaction, '❌ Bu odayı yalnızca talep sahibi ya da destek ekibi kapatabilir.');

  await interaction.reply({
    content: `🔒 Destek odası ${member} tarafından kapatıldı. Oda bir süre daha okunabilir; en geç ${KAPALI_ODA_OMRU / 86_400_000} gün sonra silinir.`,
    allowedMentions: { parse: [] },
  });
  // Oda hemen silinmez: talep sahibi okuyabilir ama yazamaz (silinme kuralı: eskiOdalariSil)
  if (sahip) await channel.permissionOverwrites.edit(sahip, { SendMessages: false }, { reason: 'Destek odası kapatıldı' }).catch(() => {});
  await channel.setName(`kapalı-${channel.name}`.slice(0, 100), 'Destek odası kapatıldı').catch(() => {});
  await kayitYaz(guild, t, `🔒 ${channel} kapatıldı · kapatan: ${member}`);
}

async function kayitYaz(guild, t, metin) {
  const kanal = guild.channels.cache.get(t.kanallar.destekKayit);
  if (kanal?.isTextBased()) await kanal.send({ content: metin, allowedMentions: { parse: [] } }).catch(() => {});
}

const ISLEMLER = { 'tp:onay': uyeOl, 'tp:rol': rolSec, 'tp:talep': talepFormu, 'tp:talep-form': talepAc, 'tp:kapat': talepKapat };

// index.js, customId'si "tp:" ile başlayan etkileşimleri buraya yönlendirir.
async function etkilesim(interaction) {
  const islem = ISLEMLER[interaction.customId];
  if (!islem || !interaction.inCachedGuild()) return;
  const t = ayarlariGetir(interaction.guildId).topluluk;
  if (!t) return gizli(interaction, '❌ Bu sunucuda kurulum bilgisi bulunamadı. Bir yönetici `/sunucukur` komutunu çalıştırmalı.');
  return islem(interaction, t);
}

module.exports = { ROLLER, KATEGORILER, planla, kur, etkilesim, kisaAd };
