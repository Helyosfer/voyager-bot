// /yardim'daki komut sayfalarının elle yazılmış metinleri. Alt komutlar ve seçenekler buraya yazılmaz:
// /yardim onları komutun tanımından okur, böylece komut değişince yardım sayfası eskimez.
//
// anlatim: komutun ne işe yaradığı (sayfanın girişi)
// kim: "Kim kullanabilir" satırına eklenecek not (isteğe bağlı; yetki komutun tanımından okunur)
// ornekler: Discord'a yazıldığı haliyle örnek kullanımlar. Testler, örneklerdeki alt komut ve seçenek
//   adlarının gerçekten var olduğunu denetler.
// notlar: bilinmesi gerekenler (sınırlar, gereken bot izinleri, ipuçları)
module.exports = {
  // --- Genel ---
  sor: {
    anlatim:
      'Yapay zekâya (Google Gemini) bir soru sorar; kısa ve Türkçe bir cevap kanala yazılır. Cevabı Discord\'da **Yanıtla** ile cevaplarsan konuşma kaldığı yerden sürer: bot önceki soru ve cevapları hatırlar.',
    ornekler: ['/sor soru:Kara delikler nasıl oluşur?', "/sor soru:'İyi akşamlar' İngilizcede nasıl söylenir? gizli:True"],
    notlar: [
      'Cevaplar yanlış olabilir; her cevabın altında bu not ve o gün kalan soru hakkın yazar.',
      '`gizli` seçeneğiyle cevabı yalnızca sen görürsün (gizli cevaplar yanıtlanamaz).',
      'Günlük soru hakkı sunucudaki kullanıma göre kendiliğinden ayarlanır; 2 dakikada en fazla 4 açık soru sorulabilir.',
      'Sorduğun metin Google\'a gönderilir; kişisel bilgi yazma. Bot soruları kaydetmez.',
    ],
  },
  ozetle: {
    anlatim:
      'Bulunduğun kanalın son mesajlarını yapay zekâya özetletir: konuşulan konular, varılan kararlar ve açık kalan sorular. Uzun bir konuşmaya sonradan katıldıysan neler olduğunu hızlıca öğrenirsin.',
    kim: 'Kanalın mesaj geçmişini okuyabilen herkes. Sunucuda bir yöneticinin `/ayarla ozet` ile açması gerekir.',
    ornekler: ['/ozetle', '/ozetle adet:100', '/ozetle adet:30 paylas:True'],
    notlar: [
      'Varsayılan olarak son 50 mesaj özetlenir ve özeti yalnızca sen görürsün; `paylas` ile kanala yazılır.',
      'Botların mesajları özete katılmaz. Her özet günlük `/sor` hakkından bir tane kullanır.',
      'Özetlenen mesajlar Google\'a gönderilir; bu yüzden özellik varsayılan olarak kapalıdır.',
    ],
  },
  hatirlat: {
    anlatim: 'Belirttiğin kadar dakika sonra bu kanalda seni etiketleyerek yazdığın şeyi hatırlatır. Bot yeniden başlasa da hatırlatıcın kaybolmaz.',
    ornekler: ['/hatirlat dakika:30 mesaj:Çamaşırları as', '/hatirlat dakika:1440 mesaj:Yarınki toplantı'],
    notlar: [
      'En fazla 7 gün (10080 dakika) sonrası için kurulabilir; aynı anda en fazla 5 hatırlatıcın olabilir.',
      'Hatırlatmada yalnızca sen etiketlenirsin; mesaja `@everyone` yazsan bile kimseye bildirim gitmez.',
      'O zamana kadar kanala yazma iznini kaybedersen ya da susturulursan hatırlatma gönderilmez.',
    ],
  },
  ping: {
    anlatim: 'Botun çalışıp çalışmadığını ve Discord\'a bağlantısının gecikmesini milisaniye olarak gösterir. Bot cevap vermiyor gibi göründüğünde ilk buna bak.',
    ornekler: ['/ping'],
    notlar: ['Gecikme genelde 50-200 ms arasındadır; çok yüksekse Discord tarafında yavaşlık olabilir.'],
  },
  yardim: {
    anlatim: 'Komutları bölüm bölüm gösterir. Bir bölüm seçtikten sonra ikinci menüden bir komut seçersen o komutun ayrıntılı sayfası açılır: ne işe yaradığı, seçenekleri, örnekleri ve bilmen gerekenler.',
    ornekler: ['/yardim', '/yardim komut:ban'],
    notlar: ['Yalnızca senin kullanabildiğin komutlar listelenir.', '`komut` seçeneğine yazmaya başlayınca Discord eşleşen komutları önerir.'],
  },

  // --- Moderasyon ---
  uyari: {
    anlatim:
      'Üyelere kalıcı uyarı verir ve uyarıları saklar. Uyarı sayısı belirlediğin bir eşiğe gelince bot kendiliğinden susturur, atar ya da yasaklar. Tek seferlik cezalar yerine üyenin geçmişini tutmak için kullan.',
    kim: 'Üyelere Zaman Aşımı Uygula yetkisi olanlar. `kural-ekle` ve `kural-sil` ayrıca Sunucuyu Yönet ister.',
    ornekler: [
      '/uyari ver kullanici:@Ali sebep:Kanalda reklam',
      '/uyari liste kullanici:@Ali',
      '/uyari kural-ekle esik:3 islem:Sustur dakika:1440',
      '/uyari kural-ekle esik:5 islem:At',
    ],
    notlar: [
      'Uyarılan üyeye sebebiyle birlikte özel mesaj gider.',
      'Kural, uyarı sayısı **tam** eşiğe geldiğinde bir kez uygulanır. En fazla 5 kural, üye başına en fazla 50 uyarı.',
      'Kural yetki aşmaya yaramaz: uyarıyı veren kişi kuralın işlemini kendisi yapamıyorsa işlem uygulanmaz.',
      'Kendinle aynı ya da daha yüksek roldeki birine uyarı veremezsin. Bütün işlemler günlüğe yazılır.',
    ],
  },
  sustur: {
    anlatim: 'Bir üyeyi belirli bir süre susturur (Discord\'un zaman aşımı özelliği): bu sürede yazamaz, tepki ekleyemez ve sesli kanalda konuşamaz. Süre dolunca susturma kendiliğinden kalkar.',
    ornekler: ['/sustur kullanici:@Ali dakika:60 sebep:Spam', '/sustur kullanici:@Ali dakika:0'],
    notlar: [
      '`dakika:0` susturmayı hemen kaldırır. En uzun süre 28 gündür (40320 dakika).',
      'Kendinle aynı ya da daha yüksek roldeki birini, sunucu sahibini ve yöneticileri susturamazsın.',
      'Botun rolü, susturulacak üyenin rolünden yukarıda olmalı.',
    ],
  },
  kick: {
    anlatim: 'Bir üyeyi sunucudan atar. Atılan kişi bir davet bağlantısıyla yeniden katılabilir; kalıcı olarak uzaklaştırmak için `/ban` kullan.',
    ornekler: ['/kick kullanici:@Ali sebep:Kurallara uymuyor'],
    notlar: [
      'Sebep, sunucunun denetim kaydına seninle birlikte yazılır ve günlük kanalına düşer.',
      'Kendinle aynı ya da daha yüksek roldeki birini atamazsın; botun rolü de üyenin rolünden yukarıda olmalı.',
    ],
  },
  ban: {
    anlatim: 'Bir kullanıcıyı sunucudan yasaklar; yasak kaldırılana kadar yeniden katılamaz. Sunucuda olmayan birini de kullanıcı kimliğiyle (ID) önceden yasaklayabilirsin.',
    ornekler: ['/ban kullanici:@Ali sebep:Dolandırıcılık', '/ban kullanici:123456789012345678 sebep:Başka sunucuda taciz'],
    notlar: [
      'Yasağı kaldırmak için `/unban`.',
      'Kendinle aynı ya da daha yüksek roldeki birini yasaklayamazsın. Sebep denetim kaydına ve günlüğe yazılır.',
      'Kimlik almak için: Discord ayarlarında Geliştirici Modu\'nu aç, kişiye sağ tıkla → Kullanıcı ID\'sini Kopyala.',
    ],
  },
  unban: {
    anlatim: 'Yasaklanmış bir kullanıcının yasağını kaldırır; kişi bundan sonra bir davet bağlantısıyla yeniden katılabilir.',
    ornekler: ['/unban kullanici:123456789012345678 sebep:İtirazı kabul edildi'],
    notlar: ['Kullanıcı sunucuda olmadığı için genelde kimliğini (ID) yapıştırman gerekir. Yasaklı listesini Sunucu Ayarları → Yasaklar\'da görebilirsin.'],
  },
  temizle: {
    anlatim: 'Bulunduğun kanaldaki son mesajları toplu siler (en fazla 100). Spam ya da istenmeyen mesaj seli sonrası kanalı temizlemek için.',
    ornekler: ['/temizle adet:20'],
    notlar: [
      'Discord 14 günden eski mesajların toplu silinmesine izin vermez; bunlar atlanır ve cevapta kaç mesajın silindiği yazar.',
      'Silme işlemi günlüğe kimin yaptığıyla birlikte yazılır.',
    ],
  },

  // --- Güvenlik ---
  koruma: {
    anlatim:
      'Otomatik korumayı ayarlar: spam, ağır küfür, Discord\'u ya da Steam\'i taklit eden zararlı bağlantılar ve dolandırıcılık resimleri. Açtığın korumalar mesajları kendiliğinden siler ve gerekirse yazanı susturur. Hepsi varsayılan olarak kapalıdır.',
    ornekler: [
      '/koruma spam durum:Açık',
      '/koruma kufur durum:Açık susturma-dakika:10',
      '/koruma baglanti durum:Açık kisaltici:True',
      '/koruma alan alan:ornek-site.com islem:İzin ver',
      '/koruma gorsel durum:Açık kapsam:Yalnızca riskli olanlar',
    ],
    notlar: [
      'Mesajları Yönet yetkisi olanlar ve botlar korumadan muaftır.',
      '**Spam:** 30 saniyede 3 farklı kanala yazan ya da aynı şeyi 4 kez tekrarlayan hesabın mesajları silinir, hesap susturulur (ele geçirilmiş hesaplar için; banlamaz).',
      '**Küfür:** yalnızca ağır küfürler yakalanır; `kelime-ekle` ile sunucuna özel kelime ekleyebilirsin.',
      '**Bağlantı:** bağlantılar açılmaz, karar adresten verilir. Yanlış alarm olursa `alan` ile izin listesine ekle.',
      '**Görsel:** resimler yapay zekâyla denetlenir ve Google\'a gönderilir; karar 30-70 saniye sürebilir. Yakalanan mesaj silinir, kanıtı günlüğe düşer.',
    ],
  },
  kitle: {
    anlatim:
      'Acil durum kilidi: bir saldırı ya da baskın anında bütün kanalları tek komutla kilitler. Sunucu sahibi dışında kimse yazamaz, tepki ekleyemez, konu açamaz ve sesli kanala giremez. Her kanalın izinleri saklanır.',
    ornekler: ['/kitle'],
    notlar: [
      'Kilidi açmak için `/kilidiac`: bütün izinler kilitten önceki haline birebir döner.',
      'Kilitliyken sunucuya eklenen botlar kendiliğinden atılır; yetki varsa sesli kanaldakiler çıkarılır.',
      'Administrator izni olan roller Discord kuralı gereği kilitten etkilenmez.',
      'Bot bir izni ancak kendisinde de varsa kilitleyebilir; eksik kalanlar cevapta listelenir.',
    ],
  },
  kilidiac: {
    anlatim: '`/kitle` ile kilitlenen kanalları açar: her kanalın izinleri kilitten önceki haline birebir döner.',
    ornekler: ['/kilidiac'],
    notlar: ['Açılamayan bir kanal olursa cevapta yazar; sorunu giderip komutu yeniden çalıştırınca kalanlar açılır.'],
  },

  // --- Bildirimler ---
  oyun: {
    anlatim:
      'Bedava oyunları ve mağaza indirimlerini (Steam, Epic Games, GOG) Türkiye fiyatlarıyla seçtiğin kanala duyurur. Popüler oyunlardaki önemli fırsatlar yapay zekâ incelemesi ve puanıyla anında gelir; diğerleri 3 saatte bir tek liste halinde.',
    ornekler: [
      '/oyun kanal kanal:#oyun-fırsatları',
      '/oyun indirim durum:Açık magaza:Steam en-az-yuzde:75',
      '/oyun bedava durum:Açık magaza:Tüm PC mağazaları',
      '/oyun rol rol:@Oyuncular',
    ],
    notlar: [
      'Bildirimler `/oyun kanal` ile başlar; kanal seçildiği anda yayında olanlar gönderilmez, yalnızca sonradan çıkanlar.',
      'Fırsatlar 15 dakikada bir kontrol edilir. `/oyun simdi` güncel fırsatları hemen gönderir (5 dakikada bir).',
      '`/oyun everyone` açıksa önemli fırsatlarda en fazla 6 saatte bir @everyone atılır; bot için @everyone etiketleme izni gerekir.',
    ],
  },
  yayin: {
    anlatim: 'Takip ettiğin yayıncılar Twitch, Kick ya da YouTube\'da yayına başlayınca seçtiğin kanala haber verir.',
    ornekler: [
      '/yayin kanal kanal:#yayınlar',
      '/yayin ekle platform:Twitch yayinci:pqueen',
      '/yayin ekle platform:YouTube yayinci:https://www.youtube.com/@kanal',
      '/yayin rol rol:@Yayın Bildirimi',
    ],
    notlar: [
      'Twitch ve Kick bildirimleri anında, YouTube bildirimleri 1-3 dakika içinde gelir.',
      'Sunucu başına en fazla 50 yayıncı. `/yayin test` kanala örnek bir bildirim atar.',
      'Bir platform bot sahibi tarafından kurulmamışsa o platformdan yayıncı eklenemez.',
      'Etiketlenecek rolü yalnızca o rolü kendisi de etiketleyebilen biri seçebilir.',
    ],
  },
  haber: {
    anlatim: 'Haber sitelerinin yeni haberlerini seçtiğin kanala duyurur. Sitenin adresini vermen yeterli; bot sitenin RSS beslemesini kendisi bulur.',
    ornekler: ['/haber kanal kanal:#haberler', '/haber ekle adres:webtekno.com', '/haber cikar kaynak:2', '/haber liste'],
    notlar: [
      'Kaynaklar 10 dakikada bir kontrol edilir; bir kaynaktan tek seferde en fazla 3 haber gelir.',
      'Kaynak eklendiğinde eski haberler gönderilmez, yalnızca sonradan yayınlananlar. Sunucu başına en fazla 15 kaynak.',
      '`/haber kapat` bildirimleri durdurur ama kaynak listesini silmez.',
    ],
  },
  instagram: {
    anlatim: 'Seçtiğin Instagram hesaplarının yeni gönderilerini bir kanala duyurur.',
    ornekler: ['/instagram kanal kanal:#instagram', '/instagram ekle hesap:nasa', '/instagram test'],
    notlar: [
      'Yalnızca herkese açık **profesyonel** (işletme ya da içerik üreticisi) hesaplar takip edilebilir.',
      'Anında değildir: hesaplar yaklaşık 5 dakikada bir kontrol edilir. Sunucu başına en fazla 20 hesap.',
      'Bot sahibinin Meta bağlantısını kurmuş olması gerekir; kurulmamışsa komut görünmez.',
    ],
  },

  // --- Topluluk ---
  seviye: {
    anlatim:
      'Üyeler mesaj yazdıkça XP kazanır ve seviye atlar; seviye atlayan kanalda duyurulur. Belirli seviyelere ödül rolleri bağlayabilir, sunucunun en aktif üyelerini sıralamada görebilirsin.',
    kim: 'Herkes kendi seviyesine ve sıralamaya bakabilir. `ayar`, `odul-ekle`, `odul-sil` ve `sifirla` Sunucuyu Yönet ister.',
    ornekler: [
      '/seviye ayar durum:Açık kanal:#seviye-duyuru',
      '/seviye odul-ekle seviye:10 rol:@Aktif Üye',
      '/seviye goster kullanici:@Ali',
      '/seviye siralama',
    ],
    notlar: [
      'Her mesaj 15-25 XP kazandırır, ama dakikada en fazla bir kez; art arda yazmak XP kazandırmaz.',
      'Seviye atlamak giderek zorlaşır (0→1: 100 XP, 9→10: 1.005 XP). En fazla 10 ödül rolü.',
      'Otomatik korumanın sildiği mesajlar XP kazandırmaz. Sistem kapatılınca XP silinmez.',
    ],
  },
  cekilis: {
    anlatim: 'Üyelerin **Katıl** düğmesiyle girdiği çekilişler başlatır. Süre dolunca bot kazananları rastgele seçer, mesajı günceller ve kazananları etiketleyerek duyurur.',
    ornekler: [
      '/cekilis baslat odul:Discord Nitro dakika:1440 kazanan:2',
      '/cekilis baslat odul:Steam kodu dakika:60 gereken-rol:@Üye',
      '/cekilis yeniden mesaj:https://discord.com/channels/1/2/3',
    ],
    notlar: [
      'Çekiliş en fazla 14 gün sürebilir, en fazla 20 kazanan seçilebilir. Sunucuda aynı anda en fazla 10 çekiliş.',
      'Kazananlar yalnızca hâlâ sunucuda olan katılımcılar arasından seçilir. Düğmeye yeniden basan çekilişten çıkar.',
      '`bitir`, `yeniden` ve `iptal` çekiliş mesajının bağlantısını ister: mesaja sağ tıkla → Mesaj Bağlantısını Kopyala.',
      'Bot yeniden başlasa da süren çekilişler kaldığı yerden devam eder.',
    ],
  },
  rolmenu: {
    anlatim: 'Seçtiğin kanala, her rol için bir düğme içeren bir menü mesajı koyar. Üyeler düğmeye basarak rolü alır, yeniden basarak bırakır. Bildirim, oyun ya da ilgi alanı rolleri için kullan.',
    ornekler: [
      '/rolmenu baslik:Bildirim rolleri rol1:@Duyurular rol2:@Etkinlikler rol3:@Oyun Fırsatları',
      '/rolmenu baslik:Renk seç rol1:@Kırmızı rol2:@Mavi rol3:@Yeşil tek-secim:True',
    ],
    notlar: [
      'En fazla 10 rol. `tek-secim` açıksa üye yalnızca bir rol taşıyabilir; yenisini seçince eskisi bırakılır.',
      'Yönetim yetkisi taşıyan, botun rolünden yüksek ya da senin veremeyeceğin roller menüye eklenemez.',
      'Menüyü kaldırmak için mesajı silmen yeterli. Bot için Rolleri Yönet izni gerekir.',
    ],
  },

  // --- Sunucu ayarları ---
  ayarla: {
    anlatim: 'Botun sunucundaki temel ayarlarını yapar: olayların yazılacağı günlük (log) kanalı, hoş geldin kanalı, yeni gelenlere verilecek otomatik rol ve kanal özetleri.',
    ornekler: [
      '/ayarla log-kanali kanal:#günlük',
      '/ayarla log-kategori kategori:Ses kanalları (girme, çıkma, kanal değiştirme) durum:Kapalı',
      '/ayarla oto-rol rol:@Üye',
      '/ayarla goster',
    ],
    notlar: [
      'Günlüğe yazılanlar kategorilere ayrılır (moderasyon, üyeler, mesajlar, ses, sunucu); hepsi varsayılan olarak açıktır.',
      'Oto rol yönetim yetkisi taşıyamaz ve botun rolünden aşağıda olmalı.',
      '`/ayarla sifirla` bir ayarı kaldırır. `/ayarla ozet` ile `/ozetle` komutu bu sunucuda açılır.',
      'Elle yapılan banların da günlükte görünmesi için botta Denetim Kaydını Görüntüle izni olmalı.',
    ],
  },
  sunucukur: {
    anlatim:
      'Boş ya da yeni bir sunucuya eksiksiz bir topluluk düzeni kurar: roller, kategoriler, kanallar ve izinler, yeni gelenler için üyelik onayı, ilgi rolleri ve destek talebi sistemi.',
    ornekler: ['/sunucukur'],
    notlar: [
      'Önce ne oluşturulacağını gösterir ve onay ister. Mevcut kanal ve roller silinmez; aynı adda olanlar atlanır.',
      'Yeniden çalıştırılırsa yalnızca eksikler tamamlanır.',
      'Botta Kanalları Yönet ve Rolleri Yönet izinleri olmalı; kurulumdan sonra bot rolünü yeni rollerin üstüne taşı.',
    ],
  },

  // --- Bot sahibi ---
  sunucular: {
    anlatim: 'Botun bulunduğu sunucuları listeler ve botu bir sunucudan çıkarır. Yalnızca bot sahibinin sunucularında görünür.',
    ornekler: ['/sunucular liste', '/sunucular ayril id:123456789012345678'],
    notlar: [],
  },
};
