// /yardim'daki "Nasıl yapılır?" rehberleri ve başlangıç sayfası: komut komut değil, yapılacak iş
// adım adım anlatılır.
//
// Adımlardaki {komut alt} yazımı /yardim'da tıklanabilir komut bağlantısına çevrilir. Rehber,
// üyenin kullanamadığı bir komutu anlatıyorsa (yetki yok ya da komut kapalı) ona gösterilmez.
// yetki: komut herkese açık olsa da anlatılan işin istediği yetki (ör. Sunucuyu Yönet).
// Testler her {…} yazımının gerçek bir komut ve alt komut olduğunu denetler.

const GOREVLER = [
  // --- Herkes ---
  {
    id: 'sor',
    simge: '🤖',
    ad: 'Yapay zekâya soru sor',
    adimlar: [
      '{sor} yaz, `soru` kutusuna sorunu yaz ve gönder. Cevap kanala gelir.',
      "Konuşmayı sürdürmek için cevaba Discord'da **Yanıtla** de ve yeni sorunu yaz; bot önceki soru ve cevapları hatırlar.",
      'Cevabı yalnızca senin görmeni istersen `gizli:True` ekle.',
    ],
    ipuclari: ['Günlük soru hakkın her cevabın altında yazar.', 'Cevaplar yanlış olabilir; önemli konularda kaynağından doğrula.'],
  },
  {
    id: 'hatirlat',
    simge: '⏰',
    ad: 'Kendine hatırlatıcı kur',
    adimlar: [
      'Kanaldaki herhangi bir mesaja sağ tıkla (mobilde basılı tut) → **Uygulamalar** → **Hatırlat**.',
      'Açılan formda kaç dakika sonra hatırlatılacağını yaz; hatırlatma metni mesajdan hazır gelir, istersen değiştir.',
      'Süre dolunca bot o kanalda seni etiketleyerek hatırlatır.',
    ],
    ipuclari: ['1 gün = 1440 dakika. En fazla 7 gün sonrası ve aynı anda 5 hatırlatıcı.'],
  },
  {
    id: 'ozetle',
    simge: '📝',
    ad: 'Kaçırdığın konuşmayı özetlet',
    adimlar: [
      'Özetin başlamasını istediğin mesaja (ya da kanaldaki son mesajlardan birine) sağ tıkla → **Uygulamalar** → **Buradan özetle**.',
      'Bot o mesajdan itibaren son konuşulanları maddeler halinde yalnızca sana gösterir.',
    ],
    ipuclari: ['Sunucuda bir yöneticinin `/ayarlar` → Günlük bölümünden kanal özetlerini açmış olması gerekir.'],
  },
  {
    id: 'seviye',
    simge: '📈',
    ad: 'Seviyeni ve sıralamayı gör',
    adimlar: [
      '{yardim} yaz ve üstteki menüden **📈 Seviye ve sıralama** sayfasını seç.',
      'Seviyeni, sıranı, sonraki seviyeye kalan XP\'yi ve sunucudaki en yüksek 10 üyeyi tek kartta görürsün.',
    ],
    ipuclari: ['Mesaj yazdıkça XP kazanırsın, ama dakikada en fazla bir kez.'],
  },

  // --- Kurulum ve ayarlar (hepsi /ayarlar panelinde) ---
  {
    id: 'kurulum',
    simge: '🛠️',
    ad: 'Sunucuyu hazır şablonla kur',
    adimlar: [
      'Sunucu Ayarları → Roller: **Voyager** rolünü listenin en üstlerine sürükle.',
      '{ayarlar} yaz, menüden **Kurulum** bölümünü seç ve **Hazır sunucu şablonu**na bas.',
      'Sunucunun amacına uyan şablonu seç: Topluluk, Oyun, Yayıncı, Basit, Eğitim, Yazılım ya da Ürün ve destek.',
      'Önizlemede neler kurulacağına ve hangi ayarların açılacağına bak, sonra **Kur** düğmesine bas.',
      'Bitince ekibine yetkili rollerini ver; kuralları ve rehberi sunucuna göre düzenle.',
    ],
    ipuclari: ['Yönetici yetkisi gerekir. Mevcut kanal ve rollerin silinmez; yeniden kurarsan yalnızca eksikler tamamlanır.', 'Bildirim kanalları, bildirim rolleri ve temel koruma kendiliğinden ayarlanır.'],
  },
  {
    id: 'gunluk',
    simge: '📋',
    ad: 'Günlük (log) kanalını kur',
    adimlar: [
      'Yalnızca yetkililerin gördüğü bir kanal aç (ör. #mod-log).',
      '{ayarlar} yaz, menüden **Günlük** bölümünü seç ve kanal menüsünden o kanalı seç.',
      'İstemediğin olay türlerini alttaki menüden çıkar (ör. ses kanalı giriş-çıkışları).',
    ],
    ipuclari: ["Elle yapılan ban ve kanal silme işlemlerinin de yazılması için Voyager'a **Denetim Kaydını Görüntüle** izni ver."],
  },
  {
    id: 'hosgeldin',
    simge: '👋',
    ad: 'Yeni gelenleri karşıla, otomatik rol ver',
    adimlar: ['{ayarlar} yaz, menüden **Karşılama** bölümünü seç; karşılama kanalını ve yeni gelene verilecek rolü seç.', 'Voyager rolünün, verilecek rolün üstünde olduğundan emin ol.'],
    ipuclari: ['Yönetim yetkisi taşıyan bir rol oto rol yapılamaz.'],
  },
  {
    id: 'koruma',
    simge: '🛡️',
    ad: 'Spam ve dolandırıcılığa karşı korumayı aç',
    adimlar: [
      '{ayarlar} yaz ve menüden **Koruma** bölümünü seç.',
      '**Spam** düğmesine bas: ele geçirilmiş hesapların kanallara yağdırdığı mesajlar silinir, hesap susturulur.',
      '**Bağlantı** ve **Küfür** filtrelerini de aç. Dolandırıcılık resimlerine karşı **Görsel** filtresini aç (yapay zekâ gerekir).',
      'Susturma sürelerini **⏱️ Susturma süreleri** ile değiştir. Yanlış alarm veren bir siteyi **🔗 Alanlar** ile izin listesine ekle.',
    ],
    ipuclari: ['Mesajları Yönet yetkisi olanlar korumadan muaftır.', 'Olanları görmek için bir günlük kanalı seç.'],
  },
  {
    id: 'uyari',
    simge: '⚠️',
    ad: 'Uyarı ve otomatik ceza sistemi kur',
    yetki: 'ManageGuild',
    adimlar: [
      'Kuralları belirle: {ayarlar} → **Uyarı kuralları** → **➕ Kural ekle** (ör. 3. uyarıda 1 gün susturma, 5. uyarıda atma).',
      'Kural ihlalinde üyeye sağ tıkla → **Uygulamalar** → **Moderasyon** (ya da {mod uye}) ve **⚠️ Uyar** düğmesine bas; üyeye sebebiyle özel mesaj gider.',
      'Eşiğe gelen üyeye ceza kendiliğinden uygulanır. Aynı karttan üyenin geçmiş uyarılarını görebilir ve silebilirsin.',
    ],
    ipuclari: ['Kural yetki aşmaya yaramaz: uyarıyı veren, cezayı kendisi uygulayabiliyor olmalı.'],
  },

  // --- Bildirimler ---
  {
    id: 'oyun',
    simge: '🎮',
    ad: 'Bedava oyun ve indirim bildirimlerini aç',
    adimlar: [
      '{ayarlar} yaz, menüden **Oyun fırsatları** bölümünü seç ve kanal menüsünden fırsatların geleceği kanalı seç. Bu kadarı yeter: bedava oyunlar ve %50 üstü indirimler gelmeye başlar.',
      'Bedava oyunları, indirimleri ya da @everyone etiketini kartın düğmeleriyle açıp kapat.',
      'Fırsatlarda etiketlenecek bir rol oluştur (ör. @Oyun Fırsatları), "herkes bahsedebilir" seçeneğini aç ve kartın rol menüsünden seç.',
      'Şu an yayında olan fırsatları hemen görmek için kartta **Şimdi gönder** düğmesine bas.',
    ],
    ipuclari: ['Rolü üyelerin kendisi alabilsin diye rol menüsüne ekle (aşağıdaki "Üyelerin kendi rolünü seçmesi" rehberi).'],
  },
  {
    id: 'yayin',
    simge: '📡',
    ad: 'Kick, Twitch ya da YouTube yayın bildirimi kur',
    adimlar: [
      'Bildirimlerin geleceği kanalda {ayarlar} yaz, menüden **Yayın bildirimleri** bölümünü seç ve **➕ Ekle**ye bas; formda platformu seç ve kanal adını ya da adresini yaz. Kanal seçilmemişse bildirimler bu kanala gelir.',
      'Yayın başlayınca herkesin değil, isteyenlerin etiketlenmesi için bir rol oluştur (ör. @Yayın Bildirimi) ve kartın rol menüsünden seç.',
      'Birden fazla yayıncı varsa her birine kendi rolünü verebilirsin: **Ekle** formunda rol seç (yayıncı listedeyse yalnızca rolü değişir).',
      'Her şeyin çalıştığını kartın **Deneme bildirimi** düğmesiyle dene.',
    ],
    ipuclari: ['Twitch ve Kick anında, YouTube 1-3 dakika içinde bildirir.'],
  },
  {
    id: 'haber',
    simge: '📰',
    ad: 'Haberleri konusuna göre etiketle',
    adimlar: [
      'Her konu için bir rol oluştur (ör. @Oyun Haberleri, @Teknoloji Haberleri) ve "herkes bahsedebilir" seçeneğini aç.',
      'Haber kanalında {ayarlar} yaz, menüden **Haber bildirimleri** bölümünü seç ve **➕ Ekle**ye bas; sitenin adresini yaz ve o kaynağın konusunun rolünü seç.',
      'Diğer siteleri de kendi konularının rolüyle ekle. Eklenmiş bir kaynağın rolünü değiştirmek için onu yeniden ekle ve yeni rolü seç.',
      'Konu rollerini bir rol menüsüne koy ({ayarlar} → **Kurulum** → **Rol menüsü kur**); üyeler yalnızca ilgilendikleri haberlerde etiketlenir.',
    ],
    ipuclari: ['Kendi rolü olmayan kaynak genel haber rolünü kullanır (kartın rol menüsü).', 'Kaynaklar 10 dakikada bir kontrol edilir.'],
  },

  // --- Topluluk ---
  {
    id: 'rolmenu',
    simge: '🎭',
    ad: 'Üyelerin kendi rolünü seçmesini sağla',
    adimlar: [
      'Seçilecek rolleri oluştur (bildirim rolleri, oyunlar, ilgi alanları…). Voyager rolü bunların üstünde olmalı.',
      'Menünün duracağı kanalda {ayarlar} yaz, menüden **Kurulum** bölümünü seç ve **Rol menüsü kur**a bas.',
      'Formda başlığı yaz, rolleri seç; istersen üyenin yalnızca bir rol alabilmesini seç. Menü kanala konur.',
      'Üyeler düğmeye basarak rolü alır, yeniden basarak bırakır.',
    ],
    ipuclari: ['Menüyü kaldırmak için mesajı silmen yeterli. Rolleri Yönet yetkisi gerekir.'],
  },
  {
    id: 'seviyeKur',
    simge: '🏆',
    ad: 'Seviye sistemini ve ödül rollerini aç',
    yetki: 'ManageGuild',
    adimlar: [
      '{ayarlar} yaz, menüden **Seviye** bölümünü seç ve **Seviye sistemi** düğmesine basarak aç.',
      'İstersen seviye duyurularının kanalını seç.',
      '**🏅 Ödül ekle** ile ödül rollerini ekle: ör. 10. seviyede @Aktif Üye.',
    ],
    ipuclari: ['Ödülü kaldırmak için kartın ödül listesinden seç.'],
  },
  {
    id: 'cekilis',
    simge: '🎉',
    ad: 'Çekiliş düzenle',
    adimlar: [
      'Çekilişin yapılacağı kanalda {cekilis} yaz; açılan formda ödülü, süreyi ve kazanan sayısını gir.',
      'Üyeler **Katıl** düğmesiyle katılır. Süre dolunca kazananlar kendiliğinden seçilir ve duyurulur.',
      'Erken bitirmek, iptal etmek ya da bittikten sonra yeniden çekmek için çekiliş mesajının altındaki düğmeleri kullan.',
    ],
  },
  {
    id: 'kilit',
    simge: '🔒',
    ad: 'Saldırı anında sunucuyu kilitle',
    adimlar: [
      '{ayarlar} yaz, menüden **Acil kilit** bölümünü seç ve **Sunucuyu kilitle**ye bas: bütün kanallar kilitlenir, sunucu sahibi dışında kimse yazamaz ve sese giremez.',
      'Sunucu Ayarları → Davetler bölümünden davetleri duraklat; kötü niyetli hesapları at ya da yasakla.',
      'Ortalık durulunca aynı yerden **Kilidi aç**: her kanal kilitten önceki izinlerine döner.',
    ],
    ipuclari: ['Yönetici yetkisi gerekir. Kilitliyken sunucuya eklenen botlar kendiliğinden atılır.'],
  },
];

// Başlangıç sayfası. yonetici: Sunucuyu Yönet yetkisi olanlar için kurulum adımları
const BASLANGIC = {
  yonetici: [
    '**Voyager rolünü yukarı taşı.** Sunucu Ayarları → Roller: Voyager, yöneteceği rollerin üstünde olmalı.',
    '**Bütün ayarlar tek yerde:** {ayarlar} yaz; menüden bölüm seçerek her şeyi açıp kapatırsın.',
    '**Boş sunucu mu?** {ayarlar} → **Kurulum** → **Hazır sunucu şablonu** ile amacına uyan şablonu kur; kanallar, roller, bildirimler ve temel koruma kendiliğinden ayarlanır.',
    '**Hazır sunucu mu?** {ayarlar} → **Günlük** ile günlük kanalını, **Karşılama** ile hoş geldin mesajını ayarla.',
    '**Korumayı aç:** {ayarlar} → **Koruma** bölümünde spam ve zararlı bağlantı filtrelerini aç.',
    '**Bildirimler:** {ayarlar} → **Oyun fırsatları**, **Yayın bildirimleri**, **Haber bildirimleri**. Kanalı seçmen yeter, gerisi varsayılanla gelir.',
    '**Moderasyon:** bir üyeye sağ tıkla → *Uygulamalar* → **Moderasyon** (ya da {mod uye}). Takıldığın her şey için **Nasıl yapılır?** rehberlerine bak.',
  ],
  uye: [
    '{sor} ile yapay zekâya soru sor; cevaba **Yanıtla** diyerek konuşmayı sürdür.',
    'Bir mesaja sağ tıkla → *Uygulamalar* → **Hatırlat** ile hatırlatıcı kur ya da **Buradan özetle** ile konuşmayı özetlet.',
    'Menüden **📈 Seviye ve sıralama** sayfasını seçerek seviyene ve sunucu sıralamasına bak.',
    'Bir komutun ne yaptığını görmek için bölümlerden birini seç ya da `/yardim komut:` yaz.',
  ],
};

module.exports = { GOREVLER, BASLANGIC };
