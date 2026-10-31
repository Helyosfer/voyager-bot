// /yardim'daki "Nasıl yapılır?" rehberleri ve başlangıç sayfası: komut komut değil, yapılacak iş
// adım adım anlatılır.
//
// Adımlardaki {komut alt} yazımı /yardim'da tıklanabilir komut bağlantısına çevrilir. Rehber,
// üyenin kullanamadığı bir komutu anlatıyorsa (yetki yok ya da komut kapalı) ona gösterilmez.
// yetki: komut herkese açık olsa da anlatılan alt komutların istediği yetki (ör. /seviye ayar).
// Testler her {…} yazımının gerçek bir komut ve alt komut olduğunu denetler.

const GOREVLER = [
  // --- Herkes ---
  {
    id: 'sor',
    simge: '🤖',
    ad: 'Yapay zekâya soru sor',
    adimlar: [
      '{sor} yaz, `soru` kutusuna sorunu yaz ve gönder. Cevap kanala gelir.',
      'Konuşmayı sürdürmek için cevaba Discord\'da **Yanıtla** de ve yeni sorunu yaz; bot önceki soru ve cevapları hatırlar.',
      'Cevabı yalnızca senin görmeni istersen `gizli:True` ekle.',
    ],
    ipuclari: ['Günlük soru hakkın her cevabın altında yazar.', 'Cevaplar yanlış olabilir; önemli konularda kaynağından doğrula.'],
  },
  {
    id: 'hatirlat',
    simge: '⏰',
    ad: 'Kendine hatırlatıcı kur',
    adimlar: ['{hatirlat} yaz; `dakika` kutusuna kaç dakika sonra, `mesaj` kutusuna neyi hatırlatacağını yaz.', 'Süre dolunca bot bu kanalda seni etiketleyerek hatırlatır.'],
    ipuclari: ['1 gün = 1440 dakika. En fazla 7 gün sonrası ve aynı anda 5 hatırlatıcı.'],
  },
  {
    id: 'ozetle',
    simge: '📝',
    ad: 'Kaçırdığın konuşmayı özetlet',
    adimlar: ['Özetini istediğin kanalda {ozetle} yaz.', 'İstersen `adet` ile kaç mesajın özetleneceğini seç (varsayılan 50).', 'Özet yalnızca sana görünür; kanalla paylaşmak için `paylas:True`.'],
    ipuclari: ['Sunucuda bir yöneticinin özetlemeyi açmış olması gerekir.'],
  },
  {
    id: 'seviye',
    simge: '📈',
    ad: 'Seviyeni ve sıralamayı gör',
    adimlar: ['{seviye goster} seviyeni, sıranı ve sonraki seviyeye kalan XP\'yi gösterir.', '{seviye siralama} en aktif 10 üyeyi gösterir.'],
    ipuclari: ['Mesaj yazdıkça XP kazanırsın, ama dakikada en fazla bir kez.'],
  },

  // --- Kurulum ---
  {
    id: 'kurulum',
    simge: '🛠️',
    ad: 'Sunucuyu hazır şablonla kur',
    adimlar: [
      'Sunucu Ayarları → Roller: **Voyager** rolünü listenin en üstlerine sürükle.',
      '{sunucukur} yaz ve sunucunun amacına uyan şablonu seç: Topluluk, Oyun, Yayıncı, Basit, Eğitim, Yazılım ya da Ürün ve destek.',
      'Önizlemede neler kurulacağına ve hangi ayarların açılacağına bak, sonra **Kur** düğmesine bas.',
      'Bitince ekibine yetkili rollerini ver; kuralları ve rehberi sunucuna göre düzenle.',
    ],
    ipuclari: ['Mevcut kanal ve rollerin silinmez. Komutu yeniden çalıştırırsan yalnızca eksikler tamamlanır.', 'Bildirim kanalları, bildirim rolleri ve temel koruma kendiliğinden ayarlanır.'],
  },
  {
    id: 'gunluk',
    simge: '📋',
    ad: 'Günlük (log) kanalını kur',
    adimlar: [
      'Yalnızca yetkililerin gördüğü bir kanal aç (ör. #mod-log).',
      '{ayarla gunluk} yaz ve `kanal` seçeneğinde o kanalı seç.',
      'İstemediğin olay türlerini kapat: `kategori` ve `durum:Kapalı` (ör. ses kanalı giriş-çıkışları).',
    ],
    ipuclari: ['Elle yapılan ban ve kanal silme işlemlerinin de yazılması için Voyager\'a **Denetim Kaydını Görüntüle** izni ver.'],
  },
  {
    id: 'hosgeldin',
    simge: '👋',
    ad: 'Yeni gelenleri karşıla, otomatik rol ver',
    adimlar: ['{ayarla hosgeldin} yaz; `kanal` ile karşılama kanalını, `oto-rol` ile yeni gelene verilecek rolü seç.', 'Voyager rolünün, verilecek rolün üstünde olduğundan emin ol.'],
    ipuclari: ['Yönetim yetkisi taşıyan bir rol oto rol yapılamaz.'],
  },
  {
    id: 'koruma',
    simge: '🛡️',
    ad: 'Spam ve dolandırıcılığa karşı korumayı aç',
    adimlar: [
      '{koruma filtre} yaz, `tur:Spam` ve `durum:Açık` seç. Ele geçirilmiş hesapların kanallara yağdırdığı mesajlar silinir, hesap susturulur.',
      'Aynı komutla `tur:Zararlı ve sahte bağlantı` ve `tur:Küfür` filtrelerini de aç.',
      'Dolandırıcılık resimlerine karşı `tur:Dolandırıcılık görseli` filtresini aç (yapay zekâ gerekir).',
      'Hepsini {koruma goster} ile kontrol et. Yanlış alarm veren bir siteyi {koruma alan} ile izin listesine ekle.',
    ],
    ipuclari: ['Mesajları Yönet yetkisi olanlar korumadan muaftır.', 'Olanları görmek için bir günlük kanalı seç.'],
  },
  {
    id: 'uyari',
    simge: '⚠️',
    ad: 'Uyarı ve otomatik ceza sistemi kur',
    yetki: 'ManageGuild',
    adimlar: [
      'Kuralları belirle: {uyari kural} ile ör. `esik:3 islem:Sustur dakika:1440`, `esik:5 islem:At`.',
      'Kural ihlalinde {uyari ver} ile uyarı ver; üyeye sebebiyle özel mesaj gider.',
      'Eşiğe gelen üyeye ceza kendiliğinden uygulanır. Geçmişi {uyari liste} gösterir, {uyari sil} ile silinir.',
    ],
    ipuclari: ['Kural yetki aşmaya yaramaz: uyarıyı veren, cezayı kendisi uygulayabiliyor olmalı.'],
  },

  // --- Bildirimler ---
  {
    id: 'oyun',
    simge: '🎮',
    ad: 'Bedava oyun ve indirim bildirimlerini aç',
    adimlar: [
      '{oyun ayar} yaz ve `kanal` seçeneğinde fırsatların geleceği kanalı seç. Bu kadarı yeter: bedava oyunlar ve %50 üstü indirimler gelmeye başlar.',
      'İstersen aynı komutla ince ayar yap: `indirim-magaza`, `en-az-yuzde`, `bedava:Kapalı`…',
      'Fırsatlarda etiketlenecek bir rol oluştur (ör. @Oyun Fırsatları), "herkes bahsedebilir" seçeneğini aç ve `rol` ile seç.',
      'Şu an yayında olan fırsatları hemen görmek için {oyun simdi}.',
    ],
    ipuclari: ['Rolü üyelerin kendisi alabilsin diye rol menüsüne ekle (aşağıdaki "Üyelerin kendi rolünü seçmesi" rehberi).'],
  },
  {
    id: 'yayin',
    simge: '📡',
    ad: 'Kick, Twitch ya da YouTube yayın bildirimi kur',
    adimlar: [
      'Bildirimlerin geleceği kanalda {yayin ekle} yaz; `platform` ve `yayinci` (kanal adı ya da adresi) seç. Kanal seçilmemişse bildirimler bu kanala gelir.',
      'Yayın başlayınca herkesin değil, isteyenlerin etiketlenmesi için bir rol oluştur (ör. @Yayın Bildirimi) ve {yayin ayar} ile `rol` seç.',
      'Birden fazla yayıncı varsa her birine kendi rolünü verebilirsin: `ekle` sırasında `rol`, sonradan {yayin ayar} ile `yayinci` + `rol`.',
      'Her şeyin çalıştığını {yayin ayar} ile `test:True` vererek dene.',
    ],
    ipuclari: ['Twitch ve Kick anında, YouTube 1-3 dakika içinde bildirir.'],
  },
  {
    id: 'haber',
    simge: '📰',
    ad: 'Haberleri konusuna göre etiketle',
    adimlar: [
      'Her konu için bir rol oluştur (ör. @Oyun Haberleri, @Teknoloji Haberleri) ve "herkes bahsedebilir" seçeneğini aç.',
      'Haber kanalında {haber ekle} yaz; sitenin adresini ve o kaynağın konusunun rolünü seç (`rol:@Oyun Haberleri`).',
      'Diğer siteleri de kendi konularının rolüyle ekle. Eklenmiş bir kaynağın rolünü {haber ayar} ile `kaynak` + `rol` vererek değiştir.',
      'Konu rollerini rol menüsüne koy ({rolmenu}); üyeler yalnızca ilgilendikleri haberlerde etiketlenir.',
    ],
    ipuclari: ['Kendi rolü olmayan kaynak genel haber rolünü kullanır ({haber ayar} ile `rol`).', 'Kaynaklar 10 dakikada bir kontrol edilir.'],
  },

  // --- Topluluk ---
  {
    id: 'rolmenu',
    simge: '🎭',
    ad: 'Üyelerin kendi rolünü seçmesini sağla',
    adimlar: [
      'Seçilecek rolleri oluştur (bildirim rolleri, oyunlar, ilgi alanları…). Voyager rolü bunların üstünde olmalı.',
      'Menünün duracağı kanalda {rolmenu} yaz; `baslik` ve `rol1`, `rol2`… seç.',
      'Üyeler düğmeye basarak rolü alır, yeniden basarak bırakır. Yalnızca bir seçim istiyorsan `tek-secim:True`.',
    ],
    ipuclari: ['Menüyü kaldırmak için mesajı silmen yeterli.'],
  },
  {
    id: 'seviyeKur',
    simge: '🏆',
    ad: 'Seviye sistemini ve ödül rollerini aç',
    yetki: 'ManageGuild',
    adimlar: ['{seviye ayar} yaz ve `durum:Açık` seç; istersen `kanal` ile seviye duyurularının kanalını belirle.', 'Ödül rollerini {seviye odul} ile ekle: ör. `seviye:10 rol:@Aktif Üye`.'],
    ipuclari: ['Ödülü kaldırmak için {seviye odul} komutunda rolü boş bırak.'],
  },
  {
    id: 'cekilis',
    simge: '🎉',
    ad: 'Çekiliş düzenle',
    adimlar: [
      'Çekilişin yapılacağı kanalda {cekilis baslat} yaz; `odul`, `dakika` ve isteğe bağlı `kazanan` sayısını gir.',
      'Üyeler **Katıl** düğmesiyle katılır. Süre dolunca kazananlar kendiliğinden seçilir ve duyurulur.',
      'Erken bitirmek için {cekilis bitir}, yeniden çekmek için {cekilis yeniden}; ikisi de çekiliş mesajının bağlantısını ister.',
    ],
  },
  {
    id: 'kilit',
    simge: '🔒',
    ad: 'Saldırı anında sunucuyu kilitle',
    adimlar: [
      '{kilit kapat} yaz: bütün kanallar kilitlenir, sunucu sahibi dışında kimse yazamaz ve sese giremez.',
      'Sunucu Ayarları → Davetler bölümünden davetleri duraklat; kötü niyetli hesapları at ya da yasakla.',
      'Ortalık durulunca {kilit ac}: her kanal kilitten önceki izinlerine döner.',
    ],
    ipuclari: ['Kilitliyken sunucuya eklenen botlar kendiliğinden atılır.'],
  },
];

// Başlangıç sayfası. yonetici: Sunucuyu Yönet yetkisi olanlar için kurulum adımları
const BASLANGIC = {
  yonetici: [
    '**Voyager rolünü yukarı taşı.** Sunucu Ayarları → Roller: Voyager, yöneteceği rollerin üstünde olmalı.',
    '**Boş sunucu mu?** {sunucukur} ile amacına uyan şablonu kur; kanallar, roller, bildirimler ve temel koruma kendiliğinden ayarlanır.',
    '**Ayarlar tek kartta:** {ayarlar} paneli açılır. 🛡️ Koruma\'dan spam ve zararlı bağlantı filtrelerini aç, 📜 Günlük\'ten bir kayıt kanalı seç, 👋 Karşılama\'dan hoş geldin kanalını seç. Hepsi düğme ve menüyle.',
    '**Bildirimler:** yine {ayarlar} panelinde 🎮 Oyun fırsatları, 📺 Canlı yayınlar ve 📰 Haberler bölümleri. Her birinde yalnızca kanalı seçmen yeter, gerisi varsayılanla gelir.',
    '**Tıklayarak moderasyon:** bir üyeye ya da mesaja sağ tıkla → **Uygulamalar → Moderasyon**. Uyar, sustur, at, yasakla düğmeleri çıkar.',
    'Takıldığın her şey için aşağıdaki **Nasıl yapılır?** rehberlerine bak.',
  ],
  uye: [
    '{sor} ile yapay zekâya soru sor; cevaba **Yanıtla** diyerek konuşmayı sürdür.',
    '{hatirlat} ile kendine hatırlatıcı kur.',
    '{seviye goster} ile seviyene, {seviye siralama} ile sıralamaya bak.',
    'Bir komutun ne yaptığını görmek için bölümlerden birini seç ya da `/yardim komut:` yaz.',
  ],
};

module.exports = { GOREVLER, BASLANGIC };
