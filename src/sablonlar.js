// Hazır sunucu şablonları (/ayarlar → Kurulum): her kullanım senaryosu için roller, kategoriler, kanallar, izinler ve
// kurulumla birlikte açılan varsayılan ayarlar. Kurulumu ve akışları topluluk.js yürütür.
//
// İzin mantığı: erişim kategori düzeyinde tanımlanır ve kanallar kategorisiyle eşitlenmiş
// (senkron) oluşturulur. Yalnızca farklı davranması gereken kanallar (duyuru, kurallar, bot
// akışları...) kendi iznini (erisim) taşır.
//
// Üyelik onayı (onay: true) olan şablonlarda yeni gelen "Yeni Gelen" rolüyle başlar, kuralları
// onaylayınca "Üye" olur ve topluluk kanalları açılır. Onaysız şablonlarda herkes her şeyi görür.
const { PermissionFlagsBits: P } = require('discord.js');

// --- Rol havuzu: hiyerarşi sırasıyla, en üstteki en başta ---
// ayri: üye listesinde ayrı gösterilir · ilgi: rol seçimi menüsündeki açıklama (üye kendisi alır)
// bildirim: etiketlenebilir rol (bildirimlerde ve duyurularda etiketlenir)
const ROL = {
  yonetici: { ad: '⚙️ Yönetici', renk: 0xe74c3c, ayri: true, izinler: [P.KickMembers, P.BanMembers, P.ModerateMembers, P.ManageMessages, P.ViewAuditLog] },
  moderator: { ad: '🛡️ Moderatör', renk: 0xe67e22, ayri: true, izinler: [P.KickMembers, P.ModerateMembers, P.ManageMessages, P.ViewAuditLog] },
  destek: { ad: '🆘 Destek Ekibi', renk: 0x1abc9c, ayri: true },
  etkinlik: { ad: '📅 Etkinlik Ekibi', renk: 0x3498db, ayri: true },
  uretici: { ad: '🎥 İçerik Üreticisi', renk: 0xe84393, ayri: true },
  destekci: { ad: '💎 Destekçi', renk: 0xf1c40f, ayri: true },
  uye: { ad: '✅ Üye', renk: 0x2ecc71 },
  yeni: { ad: '🆕 Yeni Gelen', renk: 0x95a5a6 },
  // Bildirim rolleri
  bildirim: { ad: '🔔 Etkinlik Bildirimleri', renk: 0xf1c40f, ilgi: 'Etkinlik duyurularında etiketlen', bildirim: true },
  firsat: { ad: '🎁 Oyun Fırsatları', renk: 0x57f287, ilgi: 'Bedava oyun ve indirimlerde etiketlen', bildirim: true },
  oyunHaber: { ad: '📰 Oyun Haberleri', renk: 0x3b82f6, ilgi: 'Yeni oyun haberlerinde etiketlen', bildirim: true },
  teknoHaber: { ad: '📰 Teknoloji Haberleri', renk: 0x3b82f6, ilgi: 'Teknoloji haberlerinde etiketlen', bildirim: true },
  yayinBildirim: { ad: '🔴 Yayın Bildirimi', renk: 0xed4245, ilgi: 'Yayın başlayınca etiketlen', bildirim: true },
  guncelleme: { ad: '📢 Güncelleme Bildirimi', renk: 0x5865f2, ilgi: 'Yeni sürüm ve duyurularda etiketlen', bildirim: true },
  ders: { ad: '📚 Ders Bildirimleri', renk: 0x5865f2, ilgi: 'Ders, ödev ve sınav duyurularında etiketlen', bildirim: true },
  // İlgi alanları
  oyuncu: { ad: '🎮 Oyuncu', renk: 0x5865f2, ilgi: 'Oyun sohbetleri ve takım arama' },
  teknoloji: { ad: '💻 Teknoloji', renk: 0x3498db, ilgi: 'Donanım, ürünler, haberler' },
  yazilim: { ad: '👨‍💻 Yazılım', renk: 0x2ecc71, ilgi: 'Programlama ve projeler' },
  tasarim: { ad: '🎨 Tasarım', renk: 0xe84393, ilgi: 'Görsel, UI ve fotoğraf' },
  muzik: { ad: '🎵 Müzik', renk: 0x9b59b6, ilgi: 'Müzik önerileri' },
  film: { ad: '🎬 Film & Dizi', renk: 0xe67e22, ilgi: 'Film, dizi, belgesel' },
  fps: { ad: '🔫 FPS', renk: 0xe74c3c, ilgi: 'Valorant, CS2 ve nişancı oyunları' },
  rekabetci: { ad: '⚔️ MOBA ve Strateji', renk: 0x9b59b6, ilgi: 'LoL, Dota 2 ve strateji oyunları' },
  rpg: { ad: '🐉 RPG ve MMO', renk: 0xe67e22, ilgi: 'Rol yapma ve çevrim içi dünya oyunları' },
  hayattaKalma: { ad: '⛏️ Minecraft ve Hayatta Kalma', renk: 0x2ecc71, ilgi: 'Minecraft, Rust ve açık dünya' },
  mobil: { ad: '📱 Mobil Oyunlar', renk: 0x1abc9c, ilgi: 'PUBG Mobile, Brawl Stars ve diğerleri' },
  web: { ad: '🌐 Web', renk: 0x3498db, ilgi: 'Ön yüz, arka uç ve web çatıları' },
  mobilGelistirme: { ad: '📲 Mobil Geliştirme', renk: 0x1abc9c, ilgi: 'Android, iOS, Flutter, React Native' },
  oyunGelistirme: { ad: '🕹️ Oyun Geliştirme', renk: 0x9b59b6, ilgi: 'Unity, Unreal, Godot' },
  sistem: { ad: '🐧 Linux ve DevOps', renk: 0xf1c40f, ilgi: 'Sunucular, konteynerler, otomasyon' },
  guvenlik: { ad: '🔐 Siber Güvenlik', renk: 0xe74c3c, ilgi: 'Savunma, gizlilik, güvenli yapılandırma' },
  yapayZeka: { ad: '🤖 Yapay Zekâ', renk: 0x5865f2, ilgi: 'Makine öğrenmesi ve dil modelleri' },
};
const ROL_SIRASI = Object.keys(ROL);

const YONETIM = ['yonetici'];
const MOD = ['yonetici', 'moderator'];
const DESTEK = ['yonetici', 'moderator', 'destek'];
const EKIP = ['yonetici', 'moderator', 'destek', 'etkinlik'];

const GOR = [P.ViewChannel, P.ReadMessageHistory];
const YAZ = [P.SendMessages];
const SES = [P.Connect, P.Speak, P.Stream];
// Bağlan: bot ses kanalına girmez, ama Discord o kanalın izinlerini düzenleyebilmesi (ör. acil kilit) için ister
const BOT = [P.ViewChannel, P.ReadMessageHistory, P.SendMessages, P.EmbedLinks, P.AttachFiles, P.Connect];

const kural = (roller, izin = [], yasak = []) => roller.map((rol) => ({ rol, izin, yasak }));

// Kategori politikaları. "herkes" = @everyone. Şablonda olmayan rollerin kuralları kurulumda atlanır.
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
  // Üyelik onayı olmayan şablonlar: herkes görür ve yazar
  acik: [...kural(['herkes'], [...GOR, ...YAZ]), ...kural(EKIP, [...GOR, ...YAZ])],
  acikSes: [...kural(['herkes'], [...GOR, ...YAZ, ...SES]), ...kural(EKIP, [...GOR, ...YAZ, ...SES])],
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
  // Onaysız şablonlar: herkes okur; içerik üreticisi, etkinlik ekibi ve yöneticiler yazar
  acikSalt: [...kural(['herkes'], GOR, YAZ), ...kural(['uretici', 'etkinlik', 'destek', ...YONETIM], [...GOR, ...YAZ])],
};

// --- Ortak kategoriler ---
// Kanal alanları: ad, konu, yavas (saniye), erisim (yoksa kategoriyle eşitlenir), ses,
// ayar (botun bu ayarı o kanala bağlanır), anahtar (akışların ve tanıtım mesajlarının kullandığı kanal)
// Kategori alanları: ad, politika, rehber (sunucu rehberinde gösterilen açıklama), anahtar, kanallar

// Üyelik onaylı başlangıç
const BASLANGIC_ONAYLI = {
  ad: '📌・BAŞLANGIÇ', politika: 'baslangic',
  kanallar: [
    { ad: '👋・hoş-geldin', konu: 'Sunucuya hoş geldin! Önce kuralları ve rehberi oku.', erisim: 'salt', ayar: 'hosgeldinKanali', anahtar: 'hosgeldin' },
    { ad: '📜・kurallar', konu: 'Sunucudaki herkes için geçerli temel kurallar.', erisim: 'yoneticiYazar', anahtar: 'kurallar' },
    { ad: '📢・duyurular', konu: 'Sunucu duyuruları ve önemli güncellemeler.', erisim: 'salt' },
    { ad: '🧭・sunucu-rehberi', konu: 'Kategoriler ve kanallar hakkında kısa rehber.', erisim: 'yoneticiYazar', anahtar: 'rehber' },
    { ad: '✅・üyelik-onay', konu: 'Kuralları okuduktan sonra düğmeye basarak üye ol.', erisim: 'salt', anahtar: 'onay' },
    { ad: '🎭・rol-seçimi', konu: 'İlgi alanlarını ve bildirim rollerini seç; istediğin zaman değiştirebilirsin.', erisim: 'uyeSalt', anahtar: 'rol' },
    { ad: '🙋・tanışma', konu: 'Kendini tanıt. Adres, telefon gibi kişisel bilgilerini paylaşma.', yavas: 10, erisim: 'uyeYazar' },
  ],
};

// Onaysız başlangıç: herkes okur, yönetim yazar
const BASLANGIC_ACIK = {
  ad: '📌・BAŞLANGIÇ', politika: 'baslangic',
  kanallar: [
    { ad: '👋・hoş-geldin', konu: 'Sunucuya hoş geldin! Önce kuralları oku.', erisim: 'salt', ayar: 'hosgeldinKanali', anahtar: 'hosgeldin' },
    { ad: '📜・kurallar', konu: 'Sunucudaki herkes için geçerli temel kurallar.', erisim: 'yoneticiYazar', anahtar: 'kurallar' },
    { ad: '📢・duyurular', konu: 'Sunucu duyuruları ve önemli güncellemeler.', erisim: 'salt' },
    { ad: '🎭・rol-seçimi', konu: 'Bildirim rollerini ve ilgi alanlarını seç; istediğin zaman değiştirebilirsin.', erisim: 'salt', anahtar: 'rol' },
  ],
};

const DESTEK_MERKEZI = (politika) => ({
  ad: '🆘・DESTEK MERKEZİ', politika, rehber: 'herkese açık sorular ve özel destek odaları',
  kanallar: [
    { ad: '🎫・destek-merkezi', konu: 'Özel destek odası açmak için düğmeyi kullan.', erisim: 'salt', anahtar: 'destek' },
    { ad: '🆘・destek-sohbeti', konu: 'Genel yardım soruları. Özel bilgilerini burada paylaşma.', yavas: 5 },
  ],
});
const DESTEK_TALEPLERI = { ad: '🎫・DESTEK TALEPLERİ', politika: 'destekOzel', anahtar: 'talepler', kanallar: [] };
const DESTEK_EKIBI = {
  ad: '🧰・DESTEK EKİBİ', politika: 'destekOzel',
  kanallar: [
    { ad: '🧰・destek-ekip', konu: 'Destek ekibinin koordinasyon alanı.' },
    { ad: '🗂️・destek-kayıtları', konu: 'Destek taleplerinin açılış ve kapanış kayıtları.', anahtar: 'destekKayit' },
  ],
};
const MODERASYON = {
  ad: '🛡️・MODERASYON', politika: 'moderasyon',
  kanallar: [
    { ad: '🛡️・mod-sohbeti', konu: 'Moderatör ekibinin koordinasyonu.' },
    { ad: '📋・mod-log', konu: 'Voyager sunucu günlüğü: üye, mesaj, ses ve yönetim olayları.', ayar: 'logKanali' },
    { ad: '⚖️・ceza-kayıtları', konu: 'Uyarı, susturma, atma ve yasaklama kararlarının gerekçeli kayıtları.' },
  ],
};
const MOD_LOG = {
  ad: '🛡️・MODERASYON', politika: 'moderasyon',
  kanallar: [
    { ad: '🛡️・mod-sohbeti', konu: 'Moderatör ekibinin koordinasyonu.' },
    { ad: '📋・mod-log', konu: 'Voyager sunucu günlüğü: üye, mesaj, ses ve yönetim olayları.', ayar: 'logKanali' },
  ],
};

// --- Şablonlar ---
// roller: ROL anahtarları (sırası önemsiz; hiyerarşi ROL'deki sıradır). Ad değiştirmek için { k, ad }.
// ayarlar: kurulumda açılan ayarlar; sunucuda daha önce elle ayarlanmışsa dokunulmaz.
//   icerik: true olanlar mesaj metnini okumayı gerektirir (Message Content Intent kapalıysa atlanır).
// rolAyarlari: ayar anahtarı → rol (ör. oyun fırsatlarında etiketlenecek rol)
// sonraki: kurulumdan sonra yapılabilecekler
const VARSAYILAN_KORUMA = [
  { anahtar: 'korumaSpam', deger: true, ad: 'Spam koruması' },
  { anahtar: 'korumaBaglanti', deger: true, ad: 'Zararlı bağlantı denetimi', icerik: true },
];
const KUFUR = { anahtar: 'korumaKufur', deger: true, ad: 'Küfür filtresi', icerik: true };
const SEVIYE = { anahtar: 'seviyeAcik', deger: true, ad: 'Seviye sistemi' };

const SABLONLAR = {
  topluluk: {
    ad: '🌐 Topluluk',
    aciklama: 'Her konuya kanalı olan geniş topluluk: üyelik onayı, ilgi rolleri, etkinlikler, destek talepleri',
    onay: true,
    roller: ['yonetici', 'moderator', 'destek', 'etkinlik', 'uretici', 'destekci', 'uye', 'yeni', 'bildirim', 'firsat', 'yayinBildirim', 'oyuncu', 'teknoloji', 'yazilim', 'tasarim', 'muzik', 'film'],
    ayarlar: [...VARSAYILAN_KORUMA, SEVIYE],
    rolAyarlari: { oyunRol: 'firsat', yayinRol: 'yayinBildirim' },
    kategoriler: [
      BASLANGIC_ONAYLI,
      {
        ad: '💬・TOPLULUK', politika: 'uyeler', rehber: 'genel sohbet, gündem, sorular ve öneriler',
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
        ad: '🎮・OYUN', politika: 'uyeler', rehber: 'oyun sohbeti, takım arama, fırsatlar ve yayın bildirimleri',
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
        ad: '💻・TEKNOLOJİ & YAZILIM', politika: 'uyeler', rehber: 'donanım, programlama, Linux ve güvenlik',
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
        ad: '🎨・MEDYA & HOBİ', politika: 'uyeler', rehber: 'müzik, film/dizi, fotoğraf ve tasarım',
        kanallar: [
          { ad: '🎵・müzik', konu: 'Müzik önerileri ve sohbet.', yavas: 3 },
          { ad: '🎬・film-dizi', konu: 'Film, dizi ve belgesel önerileri. Sürprizbozanları gizle.', yavas: 3 },
          { ad: '📷・fotoğraf-tasarım', konu: 'Fotoğraf, illüstrasyon, arayüz ve tasarım çalışmaları.', yavas: 3 },
        ],
      },
      {
        ad: '🔊・SES KANALLARI', politika: 'ses', rehber: 'sohbet, dinlenme, oyun ve birlikte çalışma',
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
        ad: '📅・ETKİNLİKLER', politika: 'ses', rehber: 'etkinlik duyuruları ve katılımcı sohbeti',
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
      DESTEK_MERKEZI('destekAcik'),
      DESTEK_TALEPLERI,
      DESTEK_EKIBI,
      {
        ...MODERASYON,
        kanallar: [...MODERASYON.kanallar, { ad: '🚩・rapor-inceleme', konu: 'Üye raporlarının ve kanıtların incelenmesi.' }],
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
    ],
    sonraki: [
      '`/ayarlar` → Yayın bildirimleri bölümünden yayıncı ekle; Haber bildirimleri bölümünden konuya göre etiketlenen haber kaynakları ekle.',
      'Kuralları ve rehberi sunucuna göre düzenle.',
    ],
  },

  oyun: {
    ad: '🎮 Oyun topluluğu',
    aciklama: 'Oyuncu topluluğu ya da klan: oyun türü rolleri, takım arama, fırsatlar, oyun haberleri, turnuvalar',
    onay: true,
    roller: ['yonetici', 'moderator', 'etkinlik', 'uretici', 'destekci', 'uye', 'yeni', 'bildirim', 'firsat', 'oyunHaber', 'yayinBildirim', 'fps', 'rekabetci', 'rpg', 'hayattaKalma', 'mobil'],
    ayarlar: [...VARSAYILAN_KORUMA, SEVIYE],
    rolAyarlari: { oyunRol: 'firsat', haberRol: 'oyunHaber', yayinRol: 'yayinBildirim' },
    kategoriler: [
      BASLANGIC_ONAYLI,
      {
        ad: '💬・SOHBET', politika: 'uyeler', rehber: 'genel sohbet, klipler ve bot komutları',
        kanallar: [
          { ad: '💬・genel-sohbet', konu: 'Günlük sohbet.', yavas: 2 },
          { ad: '🎬・klipler', konu: 'En iyi anlarını, kliplerini ve ekran görüntülerini paylaş.', yavas: 5 },
          { ad: '😂・mizah', konu: 'Oyun mizahı ve eğlenceli paylaşımlar.', yavas: 2 },
          { ad: '🤖・bot-komut', konu: 'Bot komutlarını burada kullan. /yardim ile başla.', yavas: 2 },
        ],
      },
      {
        ad: '🎮・OYUNLAR', politika: 'uyeler', rehber: 'oyun türlerine göre sohbet ve takım arama',
        kanallar: [
          { ad: '🎮・oyun-sohbeti', konu: 'Oyunlar, güncellemeler ve deneyimler.', yavas: 2 },
          { ad: '🤝・takım-arama', konu: 'Oyun, rütbe ve saat yaz; birlikte oynayacak takım arkadaşı bul.', yavas: 10 },
          { ad: '🔫・fps', konu: 'Valorant, CS2 ve nişancı oyunları.', yavas: 3 },
          { ad: '⚔️・moba-strateji', konu: 'LoL, Dota 2 ve strateji oyunları.', yavas: 3 },
          { ad: '🐉・rpg-mmo', konu: 'Rol yapma ve çevrim içi dünya oyunları.', yavas: 3 },
          { ad: '⛏️・minecraft-hayatta-kalma', konu: 'Minecraft, Rust ve açık dünya oyunları.', yavas: 3 },
          { ad: '📱・mobil-oyunlar', konu: 'Mobil oyun sohbeti.', yavas: 3 },
        ],
      },
      {
        ad: '📰・OYUN DÜNYASI', politika: 'uyeler', rehber: 'bedava oyunlar, indirimler, oyun haberleri ve yayınlar (Voyager paylaşır)',
        kanallar: [
          { ad: '🏷️・oyun-fırsatları', konu: 'İndirimler ve bedava oyunlar. Voyager kendiliğinden paylaşır.', erisim: 'botAkisi', ayar: 'oyunKanali' },
          { ad: '📰・oyun-haberleri', konu: 'Oyun haberleri. Kaynakları yöneticiler /ayarlar ile ekler.', erisim: 'botAkisi', ayar: 'haberKanali' },
          { ad: '📡・yayınlar', konu: 'Takip edilen yayıncılar yayına geçince burada duyurulur.', erisim: 'botAkisi', ayar: 'yayinKanali' },
        ],
      },
      {
        ad: '🏆・TURNUVA & ETKİNLİK', politika: 'ses', rehber: 'turnuva duyuruları, kayıtlar ve maç sonuçları',
        kanallar: [
          { ad: '📣・turnuva-duyuru', konu: 'Turnuva ve etkinlik ilanları.', erisim: 'etkinlikYazar' },
          { ad: '📝・kayıt-ve-sonuçlar', konu: 'Takım kayıtları, eşleşmeler ve sonuçlar.', yavas: 5 },
          { ad: '🎤 Turnuva Sahnesi', ses: true },
        ],
      },
      {
        ad: '🔊・SES KANALLARI', politika: 'ses', rehber: 'lobi, takım odaları ve AFK',
        kanallar: [
          { ad: '🎙️ Lobi', ses: true },
          { ad: '🎮 Takım 1', ses: true },
          { ad: '🎮 Takım 2', ses: true },
          { ad: '🎮 Takım 3', ses: true },
          { ad: '🎮 Takım 4', ses: true },
          { ad: '🎧 Müzik ve Sohbet', ses: true },
          { ad: '💤 AFK', ses: true },
        ],
      },
      {
        ad: '🌟・ÖZEL ALAN', politika: 'ozel',
        kanallar: [
          { ad: '💎・destekçi-sohbet', konu: 'Destekçiler ve içerik üreticileri için özel sohbet.', yavas: 3 },
          { ad: '💎 Özel Ses', ses: true },
        ],
      },
      MODERASYON,
    ],
    sonraki: [
      '`/ayarlar` → Haber bildirimleri → **Ekle** ile oyun haberi siteleri ekle; haberlerde **📰 Oyun Haberleri** rolü etiketlenir.',
      'İstersen `/ayarlar` → Oyun fırsatları bölümündeki **@everyone** düğmesiyle popüler oyunlardaki önemli fırsatlarda @everyone attır.',
      'Klanın oyunlarına göre kanal ve ses odalarını yeniden adlandır.',
    ],
  },

  yayinci: {
    ad: '🎥 Yayıncı',
    aciklama: 'Kick, Twitch ya da YouTube yayıncısı: yayın duyurusu, klipler, yayın takvimi, abone alanı',
    onay: false,
    roller: ['yonetici', 'moderator', 'uretici', 'destekci', 'yayinBildirim', 'bildirim', 'oyuncu', 'muzik', 'film'],
    ayarlar: [...VARSAYILAN_KORUMA, KUFUR, SEVIYE],
    rolAyarlari: { yayinRol: 'yayinBildirim' },
    rolAdlari: { uretici: '🎥 Yayıncı', destekci: '💎 Abone' },
    kategoriler: [
      BASLANGIC_ACIK,
      {
        ad: '🔴・YAYIN', politika: 'baslangic', rehber: 'yayın duyuruları ve yayın takvimi',
        kanallar: [
          { ad: '📡・yayın-duyuru', konu: 'Yayına geçince Voyager burada duyurur.', erisim: 'acikSalt', ayar: 'yayinKanali' },
          { ad: '📅・yayın-takvimi', konu: 'Haftalık yayın programı.', erisim: 'acikSalt' },
        ],
      },
      {
        ad: '💬・TOPLULUK', politika: 'acik', rehber: 'sohbet, yayın sohbeti, klipler, öneriler ve istekler',
        kanallar: [
          { ad: '💬・genel-sohbet', konu: 'Günlük sohbet.', yavas: 2 },
          { ad: '🎮・yayın-sohbeti', konu: 'Yayın sırasında ve sonrasında sohbet.', yavas: 2 },
          { ad: '✂️・klipler', konu: 'Yayından en iyi anlar. Klip bağlantısını ve kısa bir açıklama paylaş.', yavas: 10 },
          { ad: '💡・öneri-ve-istekler', konu: 'Yayın, oyun ve içerik önerilerini yaz.', yavas: 10 },
          { ad: '🖼️・medya', konu: 'Görsel, video ve fan çizimleri.', yavas: 3 },
          { ad: '🤖・bot-komut', konu: 'Bot komutlarını burada kullan. /yardim ile başla.', yavas: 2 },
        ],
      },
      {
        ad: '🔊・SES KANALLARI', politika: 'acikSes', rehber: 'sohbet, izleme partisi ve oyun',
        kanallar: [
          { ad: '🎙️ Sohbet', ses: true },
          { ad: '📺 İzleme Partisi', ses: true },
          { ad: '🎮 Oyun', ses: true },
          { ad: '💤 AFK', ses: true },
        ],
      },
      {
        ad: '💎・ABONE ALANI', politika: 'ozel', rehber: 'abonelere ve destekçilere özel sohbet',
        kanallar: [
          { ad: '💎・abone-sohbet', konu: 'Abonelere ve destekçilere özel sohbet.', yavas: 3 },
          { ad: '💎 Abone Sesi', ses: true },
        ],
      },
      MODERASYON,
    ],
    sonraki: [
      '`/ayarlar` → Yayın bildirimleri → **Ekle** ile kendi Kick, Twitch ya da YouTube kanalını ekle; yayına geçince **🔴 Yayın Bildirimi** rolü etiketlenir.',
      'Abonelerine **💎 Abone** rolünü ver (ya da abonelik entegrasyonunu bu role bağla).',
      'Moderatörlerine **🛡️ Moderatör** rolünü ver.',
    ],
  },

  basit: {
    ad: '🏠 Basit',
    aciklama: 'Arkadaş grubu ya da küçük sunucu: birkaç sohbet ve ses kanalı, günlük; onay ve destek sistemi yok',
    onay: false,
    roller: ['yonetici', 'moderator'],
    ayarlar: [VARSAYILAN_KORUMA[0]],
    kategoriler: [
      {
        ad: '📌・BİLGİ', politika: 'baslangic',
        kanallar: [
          { ad: '👋・hoş-geldin', konu: 'Sunucuya hoş geldin!', erisim: 'salt', ayar: 'hosgeldinKanali', anahtar: 'hosgeldin' },
          { ad: '📢・duyurular', konu: 'Duyurular.', erisim: 'salt' },
        ],
      },
      {
        ad: '💬・SOHBET', politika: 'acik', rehber: 'sohbet, medya ve bot komutları',
        kanallar: [
          { ad: '💬・sohbet', konu: 'Günlük sohbet.' },
          { ad: '🖼️・medya', konu: 'Görsel, video ve bağlantılar.' },
          { ad: '🤖・bot-komut', konu: 'Bot komutlarını burada kullan. /yardim ile başla.' },
        ],
      },
      {
        ad: '🔊・SES', politika: 'acikSes', rehber: 'sohbet ve oyun',
        kanallar: [
          { ad: '🎙️ Sohbet', ses: true },
          { ad: '🎮 Oyun', ses: true },
          { ad: '💤 AFK', ses: true },
        ],
      },
      MOD_LOG,
    ],
    sonraki: ['İhtiyaç duydukça `/ayarlar` ile oyun fırsatı, yayın ya da haber bildirimlerini aç.'],
  },

  egitim: {
    ad: '🎓 Eğitim',
    aciklama: 'Sınıf, kurs ya da çalışma grubu: duyurular, ödevler, kaynaklar, soru-cevap, ders ve çalışma odaları',
    onay: false,
    roller: ['yonetici', 'moderator', 'ders'],
    rolAdlari: { yonetici: '🎓 Eğitmen', moderator: '🧑‍🏫 Asistan' },
    ayarlar: [...VARSAYILAN_KORUMA, KUFUR],
    kategoriler: [
      BASLANGIC_ACIK,
      {
        ad: '📚・DERS', politika: 'baslangic', rehber: 'duyurular, ödevler, kaynaklar ve sınav takvimi (eğitmenler yazar)',
        kanallar: [
          { ad: '📣・ders-duyuruları', konu: 'Ders, ödev ve sınav duyuruları.', erisim: 'yoneticiYazar' },
          { ad: '📝・ödevler', konu: 'Ödevler ve teslim tarihleri.', erisim: 'yoneticiYazar' },
          { ad: '📎・kaynaklar', konu: 'Ders notları, sunumlar ve faydalı bağlantılar.', erisim: 'yoneticiYazar' },
          { ad: '📅・sınav-takvimi', konu: 'Sınav ve etkinlik tarihleri.', erisim: 'yoneticiYazar' },
        ],
      },
      {
        ad: '💬・SINIF', politika: 'acik', rehber: 'soru-cevap, ders sohbeti ve proje paylaşımı',
        kanallar: [
          { ad: '❓・soru-cevap', konu: 'Konuyu ve takıldığın yeri açıkça yaz. Cevabı bulunca paylaş.', yavas: 5 },
          { ad: '💬・ders-sohbeti', konu: 'Dersle ilgili genel sohbet.', yavas: 3 },
          { ad: '🚀・proje-paylaşımı', konu: 'Projelerini ve çalışmalarını paylaş, geri bildirim al.', yavas: 5 },
          { ad: '☕・serbest-sohbet', konu: 'Ders dışı sohbet.', yavas: 2 },
          { ad: '🤖・bot-komut', konu: 'Bot komutlarını burada kullan. /yardim ile başla.', yavas: 2 },
        ],
      },
      {
        ad: '🔊・SINIFLAR', politika: 'acikSes', rehber: 'ders salonu ve çalışma odaları',
        kanallar: [
          { ad: '🏫 Ders Salonu', ses: true },
          { ad: '📖 Çalışma Odası 1', ses: true },
          { ad: '📖 Çalışma Odası 2', ses: true },
          { ad: '🙋 Birebir Görüşme', ses: true },
        ],
      },
      MOD_LOG,
    ],
    sonraki: [
      'Eğitmenlere **🎓 Eğitmen**, asistanlara **🧑‍🏫 Asistan** rolünü ver.',
      'Duyurularda **📚 Ders Bildirimleri** rolünü etiketle; öğrenciler rolü rol seçimi kanalından alır.',
      'Hatırlatmalar için öğrenciler bir mesaja sağ tıklayıp *Uygulamalar → Hatırlat* seçebilir.',
    ],
  },

  yazilim: {
    ad: '👨‍💻 Yazılım ve teknoloji',
    aciklama: 'Yazılımcı topluluğu: alan rolleri, kod yardımı, projeler, iş ilanları, teknoloji haberleri',
    onay: true,
    roller: ['yonetici', 'moderator', 'destek', 'etkinlik', 'uye', 'yeni', 'bildirim', 'teknoHaber', 'web', 'mobilGelistirme', 'oyunGelistirme', 'sistem', 'guvenlik', 'yapayZeka'],
    ayarlar: [...VARSAYILAN_KORUMA, SEVIYE],
    rolAyarlari: { haberRol: 'teknoHaber' },
    kategoriler: [
      BASLANGIC_ONAYLI,
      {
        ad: '💬・SOHBET', politika: 'uyeler', rehber: 'genel sohbet, tanıtım ve bot komutları',
        kanallar: [
          { ad: '💬・genel-sohbet', konu: 'Günlük sohbet.', yavas: 2 },
          { ad: '📰・teknoloji-haberleri', konu: 'Teknoloji haberleri. Kaynakları yöneticiler /ayarlar ile ekler.', erisim: 'botAkisi', ayar: 'haberKanali' },
          { ad: '🤖・bot-komut', konu: 'Bot komutlarını burada kullan. /yardim ile başla.', yavas: 2 },
        ],
      },
      {
        ad: '🧑‍💻・GELİŞTİRME', politika: 'uyeler', rehber: 'kod yardımı ve alanlara göre sohbet',
        kanallar: [
          { ad: '🆘・kod-yardımı', konu: 'Hata mesajını, kodu (``` içinde) ve denediklerini yaz. Çözülünce paylaş.', yavas: 5 },
          { ad: '🌐・web', konu: 'Ön yüz, arka uç, web çatıları.', yavas: 3 },
          { ad: '📲・mobil', konu: 'Android, iOS, Flutter, React Native.', yavas: 3 },
          { ad: '🕹️・oyun-geliştirme', konu: 'Unity, Unreal, Godot.', yavas: 3 },
          { ad: '🐧・linux-devops', konu: 'Linux, sunucular, konteynerler, CI/CD.', yavas: 3 },
          { ad: '🔐・siber-güvenlik', konu: 'Savunma, gizlilik ve güvenli yapılandırma. İzinsiz erişim paylaşımı yasaktır.', yavas: 5 },
          { ad: '🤖・yapay-zeka', konu: 'Makine öğrenmesi ve dil modelleri.', yavas: 3 },
        ],
      },
      {
        ad: '🚀・PROJELER & KARİYER', politika: 'uyeler', rehber: 'proje vitrini, kaynaklar ve iş ilanları',
        kanallar: [
          { ad: '🚀・proje-vitrini', konu: 'Projelerini ve açık kaynak çalışmalarını paylaş.', yavas: 10 },
          { ad: '📎・kaynaklar', konu: 'Faydalı kaynaklar, kitaplar ve kurslar.', yavas: 10 },
          { ad: '💼・iş-ilanları', konu: 'İş ve staj ilanları: pozisyon, şehir/uzaktan ve başvuru yolu.', yavas: 60 },
        ],
      },
      {
        ad: '🔊・SES KANALLARI', politika: 'ses', rehber: 'sohbet, birlikte kodlama ve etkinlikler',
        kanallar: [
          { ad: '🎙️ Sohbet', ses: true },
          { ad: '👨‍💻 Birlikte Kodlama 1', ses: true },
          { ad: '👨‍💻 Birlikte Kodlama 2', ses: true },
          { ad: '🎤 Etkinlik ve Sunum', ses: true },
        ],
      },
      MODERASYON,
    ],
    sonraki: ['`/ayarlar` → Haber bildirimleri → **Ekle** ile teknoloji siteleri ekle; haberlerde **📰 Teknoloji Haberleri** rolü etiketlenir.'],
  },

  destek: {
    ad: '🛠️ Ürün ve destek',
    aciklama: 'Ürün, uygulama ya da hizmet sunucusu: duyurular, güncellemeler, SSS, hata bildirimi, destek odaları',
    onay: false,
    roller: ['yonetici', 'moderator', 'destek', 'guncelleme'],
    ayarlar: [...VARSAYILAN_KORUMA, KUFUR],
    kategoriler: [
      {
        ad: '📌・BİLGİ', politika: 'baslangic', rehber: 'duyurular, güncellemeler, sık sorulan sorular',
        kanallar: [
          { ad: '👋・hoş-geldin', konu: 'Hoş geldin! Önce kuralları ve sık sorulan soruları oku.', erisim: 'salt', ayar: 'hosgeldinKanali', anahtar: 'hosgeldin' },
          { ad: '📜・kurallar', konu: 'Sunucu kuralları.', erisim: 'yoneticiYazar', anahtar: 'kurallar' },
          { ad: '📢・duyurular', konu: 'Önemli duyurular.', erisim: 'salt' },
          { ad: '🆕・güncellemeler', konu: 'Sürüm notları ve yenilikler.', erisim: 'salt' },
          { ad: '❔・sss', konu: 'Sık sorulan sorular.', erisim: 'yoneticiYazar' },
          { ad: '🎭・rol-seçimi', konu: 'Güncelleme bildirimlerini aç ya da kapat.', erisim: 'salt', anahtar: 'rol' },
        ],
      },
      {
        ad: '💬・TOPLULUK', politika: 'acik', rehber: 'kullanıcı sohbeti, öneriler ve hata bildirimleri',
        kanallar: [
          { ad: '💬・genel-sohbet', konu: 'Kullanıcılar arası sohbet.', yavas: 3 },
          { ad: '💡・öneriler', konu: 'Özellik önerilerini yaz; başkalarının önerilerine tepkiyle oy ver.', yavas: 30 },
          { ad: '🐞・hata-bildirimi', konu: 'Sürümü, ne yaptığını, ne beklediğini ve ne olduğunu yaz. Ekran görüntüsü ekle.', yavas: 30 },
        ],
      },
      DESTEK_MERKEZI('acik'),
      DESTEK_TALEPLERI,
      DESTEK_EKIBI,
      MOD_LOG,
    ],
    sonraki: [
      'Destek ekibine **🆘 Destek Ekibi** rolünü ver; özel destek odalarını onlar görür.',
      'Sürüm duyurularında **📢 Güncelleme Bildirimi** rolünü etiketle.',
    ],
  },
};

// Şablonun rolleri, hiyerarşi sırasıyla ve şablona özel adlarıyla
function rolleri(sablon) {
  const secilen = new Set(sablon.roller);
  return ROL_SIRASI.filter((k) => secilen.has(k)).map((k) => ({ k, ...ROL[k], ad: sablon.rolAdlari?.[k] ?? ROL[k].ad }));
}

module.exports = { ROL, SABLONLAR, POLITIKALAR, ERISIMLER, DESTEK, GOR, YAZ, BOT, rolleri };
