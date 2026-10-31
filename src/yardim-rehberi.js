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
  yardim: {
    anlatim: 'Komutları bölüm bölüm gösterir. Bir bölüm seçtikten sonra ikinci menüden bir komut seçersen o komutun ayrıntılı sayfası açılır: ne işe yaradığı, seçenekleri, örnekleri ve bilmen gerekenler.',
    ornekler: ['/yardim', '/yardim komut:ban'],
    notlar: [
      'Yalnızca senin kullanabildiğin komutlar listelenir.',
      '`komut` seçeneğine yazmaya başlayınca Discord eşleşen komutları önerir.',
      'Ana sayfanın altında botun Discord\'a gecikmesi yazar; bot yavaşsa önce ona bak.',
    ],
  },

  // --- Moderasyon ---
  uyari: {
    anlatim:
      'Üyelere kalıcı uyarı verir ve uyarıları saklar. Uyarı sayısı belirlediğin bir eşiğe gelince bot kendiliğinden susturur, atar ya da yasaklar. Tek seferlik cezalar yerine üyenin geçmişini tutmak için kullan.',
    kim: 'Üyelere Zaman Aşımı Uygula yetkisi olanlar. Kural eklemek ve kaldırmak ayrıca Sunucuyu Yönet ister.',
    ornekler: [
      '/uyari ver kullanici:@Ali sebep:Kanalda reklam',
      '/uyari liste kullanici:@Ali',
      '/uyari sil kullanici:@Ali numara:2',
      '/uyari sil kullanici:@Ali hepsi:True',
      '/uyari kural esik:3 islem:Sustur dakika:1440',
      '/uyari kural esik:5 islem:At',
      '/uyari kural',
    ],
    notlar: [
      'Uyarılan üyeye sebebiyle birlikte özel mesaj gider.',
      'Kural, uyarı sayısı **tam** eşiğe geldiğinde bir kez uygulanır. En fazla 5 kural, üye başına en fazla 50 uyarı.',
      '`/uyari kural` seçeneksiz yazılırsa kuralları listeler; `islem:Kuralı kaldır` o eşikteki kuralı siler.',
      'Kural yetki aşmaya yaramaz: uyarıyı veren kişi kuralın işlemini kendisi yapamıyorsa işlem uygulanmaz.',
      'Kendinle aynı ya da daha yüksek roldeki birine uyarı veremezsin. Bütün işlemler günlüğe yazılır.',
      'Komut yazmadan da yapılır: üyeye ya da mesajına sağ tıkla → **Uygulamalar → Moderasyon**.',
    ],
  },
  sustur: {
    anlatim: 'Bir üyeyi belirli bir süre susturur (Discord\'un zaman aşımı özelliği): bu sürede yazamaz, tepki ekleyemez ve sesli kanalda konuşamaz. Süre dolunca susturma kendiliğinden kalkar.',
    ornekler: ['/sustur kullanici:@Ali dakika:60 sebep:Spam', '/sustur kullanici:@Ali dakika:0'],
    notlar: [
      '`dakika:0` susturmayı hemen kaldırır. En uzun süre 28 gündür (40320 dakika).',
      'Kendinle aynı ya da daha yüksek roldeki birini, sunucu sahibini ve yöneticileri susturamazsın.',
      'Botun rolü, susturulacak üyenin rolünden yukarıda olmalı.',
      'Komut yazmadan da yapılır: üyeye ya da mesajına sağ tıkla → **Uygulamalar → Moderasyon**; süre listeden seçilir.',
    ],
  },
  kick: {
    anlatim: 'Bir üyeyi sunucudan atar. Atılan kişi bir davet bağlantısıyla yeniden katılabilir; kalıcı olarak uzaklaştırmak için `/ban` kullan.',
    ornekler: ['/kick kullanici:@Ali sebep:Kurallara uymuyor'],
    notlar: [
      'Sebep, sunucunun denetim kaydına seninle birlikte yazılır ve günlük kanalına düşer.',
      'Kendinle aynı ya da daha yüksek roldeki birini atamazsın; botun rolü de üyenin rolünden yukarıda olmalı.',
      'Komut yazmadan da yapılır: üyeye ya da mesajına sağ tıkla → **Uygulamalar → Moderasyon**.',
    ],
  },
  ban: {
    anlatim: 'Bir kullanıcıyı sunucudan yasaklar; yasak kaldırılana kadar yeniden katılamaz. Sunucuda olmayan birini de kullanıcı kimliğiyle (ID) önceden yasaklayabilirsin.',
    ornekler: ['/ban kullanici:@Ali sebep:Dolandırıcılık', '/ban kullanici:123456789012345678 sebep:Başka sunucuda taciz'],
    notlar: [
      'Yasağı kaldırmak için `/unban`.',
      'Kendinle aynı ya da daha yüksek roldeki birini yasaklayamazsın. Sebep denetim kaydına ve günlüğe yazılır.',
      'Kimlik almak için: Discord ayarlarında Geliştirici Modu\'nu aç, kişiye sağ tıkla → Kullanıcı ID\'sini Kopyala.',
      'Komut yazmadan da yapılır: üyeye ya da mesajına sağ tıkla → **Uygulamalar → Moderasyon**.',
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
      'Otomatik korumayı ayarlar: spam, ağır küfür, Discord\'u ya da Steam\'i taklit eden zararlı bağlantılar ve dolandırıcılık resimleri. Açtığın korumalar mesajları kendiliğinden siler ve gerekirse yazanı susturur. Hepsi varsayılan olarak kapalıdır; her biri `/koruma filtre` ile tek tek açılır.',
    ornekler: [
      '/koruma filtre tur:Spam (kısa sürede çok kanala yazma, tekrar) durum:Açık',
      '/koruma filtre tur:Küfür durum:Açık susturma-dakika:10',
      '/koruma filtre tur:Zararlı ve sahte bağlantı durum:Açık kisaltici:True',
      '/koruma filtre tur:Dolandırıcılık görseli (yapay zekâ) durum:Açık kapsam:Yalnızca riskli olanlar',
      '/koruma kelime kelime:ornekkelime',
      '/koruma alan alan:ornek-site.com islem:İzin ver',
    ],
    notlar: [
      'Mesajları Yönet yetkisi olanlar ve botlar korumadan muaftır.',
      '**Spam:** 30 saniyede 3 farklı kanala yazan ya da aynı şeyi 4 kez tekrarlayan hesabın mesajları silinir, hesap susturulur (ele geçirilmiş hesaplar için; banlamaz).',
      '**Küfür:** yalnızca ağır küfürler yakalanır; `/koruma kelime` ile sunucuna özel kelime ekleyip çıkarabilirsin.',
      '`/koruma filtre` yalnızca türü seçerek yazılırsa bütün ayarları gösterir; `durum` vermeden yalnızca susturma süresini de değiştirebilirsin.',
      '**Bağlantı:** bağlantılar açılmaz, karar adresten verilir. Yanlış alarm olursa `alan` ile izin listesine ekle.',
      '**Görsel:** resimler yapay zekâyla denetlenir ve Google\'a gönderilir; karar 30-70 saniye sürebilir. Yakalanan mesaj silinir, kanıtı günlüğe düşer.',
    ],
  },
  kilit: {
    anlatim:
      'Acil durum kilidi: bir saldırı ya da baskın anında `/kilit kapat` bütün kanalları tek komutla kilitler. Sunucu sahibi dışında kimse yazamaz, tepki ekleyemez, konu açamaz ve sesli kanala giremez. Her kanalın izinleri saklanır; `/kilit ac` hepsini kilitten önceki haline birebir döndürür.',
    ornekler: ['/kilit kapat', '/kilit ac'],
    notlar: [
      'Saldırı anında hız önemli olduğu için komutla yazınca onay sorulmaz. `/yardim` panelindeki 🔒 Kilitle düğmesi yanlışlıkla basılmasın diye bir kez onay ister.',
      'Kilitliyken sunucuya eklenen botlar kendiliğinden atılır; yetki varsa sesli kanaldakiler çıkarılır.',
      'Administrator izni olan roller Discord kuralı gereği kilitten etkilenmez.',
      'Bot bir izni ancak kendisinde de varsa kilitleyebilir; eksik kalanlar cevapta listelenir.',
      'Açılamayan bir kanal olursa cevapta yazar; sorunu giderip `/kilit ac` komutunu yeniden çalıştırınca kalanlar açılır.',
    ],
  },

  // --- Bildirimler ---
  oyun: {
    anlatim:
      'Bedava oyunları ve mağaza indirimlerini (Steam, Epic Games, GOG) Türkiye fiyatlarıyla seçtiğin kanala duyurur. Popüler oyunlardaki önemli fırsatlar yapay zekâ incelemesi ve puanıyla anında gelir; diğerleri 3 saatte bir tek liste halinde.',
    ornekler: [
      '/oyun ayar kanal:#oyun-fırsatları',
      '/oyun ayar indirim:Açık indirim-magaza:Steam en-az-yuzde:75',
      '/oyun ayar bedava-magaza:Tüm PC mağazaları',
      '/oyun ayar rol:@Oyuncular everyone:Açık',
      '/oyun ayar',
      '/oyun simdi',
    ],
    notlar: [
      'Bildirimler kanal seçilince başlar; varsayılan olarak hem bedava oyunlar hem en az %50 indirimler gelir. Yalnızca değiştirmek istediğin seçeneği ver, gerisi olduğu gibi kalır.',
      '`/oyun ayar` seçeneksiz yazılırsa bütün ayarları gösterir. `kaldir` ile rol etiketlemesini kaldırabilir ya da bildirimleri kapatabilirsin.',
      'Kanal seçildiği anda yayında olanlar gönderilmez, yalnızca sonradan çıkanlar. Fırsatlar 15 dakikada bir kontrol edilir; `/oyun simdi` güncel fırsatları hemen gönderir (5 dakikada bir).',
      '`everyone` açıksa önemli fırsatlarda en fazla 6 saatte bir @everyone atılır; bot için @everyone etiketleme izni gerekir.',
    ],
  },
  yayin: {
    anlatim: 'Takip ettiğin yayıncılar Twitch, Kick ya da YouTube\'da yayına başlayınca seçtiğin kanala haber verir.',
    ornekler: [
      '/yayin ekle platform:Twitch yayinci:pqueen',
      '/yayin ekle platform:Kick yayinci:ornekyayinci rol:@Kick Yayınları',
      '/yayin ekle platform:YouTube yayinci:https://www.youtube.com/@kanal',
      '/yayin ayar kanal:#yayınlar rol:@Yayın Bildirimi',
      '/yayin ayar yayinci:pqueen rol:@PQueen Hayranları',
      '/yayin ayar test:True',
      '/yayin cikar yayinci:pqueen',
    ],
    notlar: [
      'Twitch ve Kick bildirimleri anında, YouTube bildirimleri 1-3 dakika içinde gelir.',
      'Kanal seçmeden ilk yayıncıyı eklersen komutu yazdığın kanal bildirim kanalı olur.',
      '**Yayıncı başına rol:** `ekle` ya da `ayar yayinci:` ile bir yayıncıya kendi rolünü verirsen o yayına geçince genel rol yerine o rol etiketlenir. Üyeler bu rolleri rol menüsünden alırsa yalnızca sevdikleri yayıncılar için bildirim alır.',
      'Sunucu başına en fazla 50 yayıncı. `ayar test:True` kanala örnek bir bildirim atar.',
      'Bir platform bot sahibi tarafından kurulmamışsa o platformdan yayıncı eklenemez.',
      'Etiketlenecek rolü yalnızca o rolü kendisi de etiketleyebilen biri seçebilir.',
    ],
  },
  haber: {
    anlatim: 'Haber sitelerinin yeni haberlerini seçtiğin kanala duyurur. Sitenin adresini vermen yeterli; bot sitenin RSS beslemesini kendisi bulur.',
    ornekler: [
      '/haber ekle adres:webtekno.com',
      '/haber ekle adres:oyungezer.com.tr rol:@Oyun Haberleri',
      '/haber ayar kanal:#haberler',
      '/haber ayar kaynak:webtekno.com rol:@Teknoloji Haberleri',
      '/haber ayar',
      '/haber cikar kaynak:2',
    ],
    notlar: [
      '**Konuya göre etiket:** her kaynağa kendi rolünü verebilirsin (ör. oyun sitelerine @Oyun Haberleri, teknoloji sitelerine @Teknoloji Haberleri). Üyeler bu rolleri rol menüsünden alır; böylece yalnızca ilgilendikleri haberlerde etiketlenirler. Kendi rolü olmayan kaynak genel rolü kullanır.',
      'Kanal seçmeden ilk kaynağı eklersen komutu yazdığın kanal haber kanalı olur.',
      'Kaynaklar 10 dakikada bir kontrol edilir; bir kaynaktan tek seferde en fazla 3 haber gelir.',
      'Kaynak eklendiğinde eski haberler gönderilmez, yalnızca sonradan yayınlananlar. Sunucu başına en fazla 15 kaynak.',
      '`/haber ayar kaldir:Bildirimleri kapat (kanalı kaldır)` bildirimleri durdurur ama kaynak listesini silmez.',
    ],
  },
  instagram: {
    anlatim: 'Seçtiğin Instagram hesaplarının yeni gönderilerini bir kanala duyurur.',
    ornekler: ['/instagram ekle hesap:nasa', '/instagram ayar kanal:#instagram', '/instagram ayar hesap:nasa rol:@Uzay', '/instagram ayar test:True'],
    notlar: [
      'Her hesaba kendi rolünü verebilirsin; o hesabın gönderilerinde genel rol yerine o rol etiketlenir.',
      'Yalnızca herkese açık **profesyonel** (işletme ya da içerik üreticisi) hesaplar takip edilebilir.',
      'Anında değildir: hesaplar yaklaşık 5 dakikada bir kontrol edilir. Sunucu başına en fazla 20 hesap.',
      'Bot sahibinin Meta bağlantısını kurmuş olması gerekir; kurulmamışsa komut görünmez.',
    ],
  },

  // --- Topluluk ---
  seviye: {
    anlatim:
      'Üyeler mesaj yazdıkça XP kazanır ve seviye atlar; seviye atlayan kanalda duyurulur. Belirli seviyelere ödül rolleri bağlayabilir, sunucunun en aktif üyelerini sıralamada görebilirsin.',
    kim: 'Herkes kendi seviyesine ve sıralamaya bakabilir. `ayar`, `odul` ve `sifirla` Sunucuyu Yönet ister.',
    ornekler: [
      '/seviye ayar durum:Açık kanal:#seviye-duyuru',
      '/seviye odul seviye:10 rol:@Aktif Üye',
      '/seviye odul seviye:10',
      '/seviye goster kullanici:@Ali',
      '/seviye siralama',
    ],
    notlar: [
      'Her mesaj 15-25 XP kazandırır, ama dakikada en fazla bir kez; art arda yazmak XP kazandırmaz.',
      'Seviye atlamak giderek zorlaşır (0→1: 100 XP, 9→10: 1.005 XP). En fazla 10 ödül rolü; `odul` komutunda rolü boş bırakırsan o seviyenin ödülü kaldırılır.',
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
  ayarlar: {
    anlatim:
      'Botun bütün sunucu ayarlarını tek kartta açar: koruma filtreleri, günlük kanalı, karşılama, seviye sistemi, uyarı cezaları, oyun fırsatları, canlı yayın ve haber bildirimleri, kurulum. Komut yazmazsın: menüden bölümü seçer, düğmelerle açıp kapatır, kanal ve rolleri menüden seçersin.',
    ornekler: ['/ayarlar'],
    notlar: [
      'Kartı yalnızca sen görürsün; düğmeleri süre dolmadan, istediğin zaman kullanabilirsin.',
      'Her düğme ilgili komutu çalıştırır (ör. spam düğmesi `/koruma filtre`); yazarak yapmakla aynı denetimlerden geçer. Komutla yapmayı seviyorsan `/koruma`, `/ayarla`, `/seviye` gibi komutlar da yerinde.',
      'Bir menüyü boşaltırsan o ayar kalkar (ör. günlük kanalını boşaltınca kayıt tutulmaz).',
      'Yalnızca senin yetkinin yettiği düğmeler görünür; ör. acil durum kilidi yalnızca Yöneticilere.',
    ],
  },
  ayarla: {
    anlatim: 'Botun sunucundaki temel ayarlarını yapar: olayların yazılacağı günlük (log) kanalı, hoş geldin kanalı, yeni gelenlere verilecek otomatik rol ve kanal özetleri.',
    ornekler: [
      '/ayarla gunluk kanal:#günlük',
      '/ayarla gunluk kategori:Ses kanalları (girme, çıkma, kanal değiştirme) durum:Kapalı',
      '/ayarla hosgeldin kanal:#hoş-geldin oto-rol:@Üye',
      '/ayarla goster',
    ],
    notlar: [
      'Her alt komut seçeneksiz yazılırsa mevcut ayarları gösterir; yalnızca verdiğin seçenekler değişir.',
      'Günlüğe yazılanlar kategorilere ayrılır (moderasyon, üyeler, mesajlar, ses, sunucu); hepsi varsayılan olarak açıktır. Kategori seçmeden `durum` verirsen hepsine uygulanır.',
      'Oto rol yönetim yetkisi taşıyamaz ve botun rolünden aşağıda olmalı.',
      '`/ayarla sifirla` bir ayarı kaldırır. `/ayarla ozet` ile `/ozetle` komutu bu sunucuda açılır.',
      'Elle yapılan banların da günlükte görünmesi için botta Denetim Kaydını Görüntüle izni olmalı.',
    ],
  },
  sunucukur: {
    anlatim:
      'Boş ya da yeni bir sunucuyu hazır bir şablonla kurar: roller, kategoriler, kanallar, izinler ve botun ayarları. Şablonlar: **Topluluk** (her konuya kanal, üyelik onayı, destek talepleri), **Oyun topluluğu** (oyun türü rolleri, takım arama, fırsatlar, oyun haberleri, turnuvalar), **Yayıncı** (Kick/Twitch/YouTube duyurusu, klipler, abone alanı), **Basit** (arkadaş grubu), **Eğitim** (sınıf ya da kurs), **Yazılım ve teknoloji**, **Ürün ve destek**.',
    ornekler: ['/sunucukur', '/sunucukur sablon:🎮 Oyun topluluğu', '/sunucukur sablon:🎥 Yayıncı'],
    notlar: [
      'Şablon seçmezsen hepsi açıklamalarıyla listelenir. Önce ne oluşturulacağını gösterir ve onay ister. Mevcut kanal ve roller silinmez; aynı adda olanlar atlanır.',
      'Bildirim kanalları (günlük, hoş geldin, oyun fırsatları, yayınlar, haberler) bota bağlanır; bildirimlerde etiketlenecek roller (ör. 🎁 Oyun Fırsatları, 🔴 Yayın Bildirimi) oluşturulur ve üyeler bunları rol seçimi kanalından alır.',
      'Şablona göre spam koruması, zararlı bağlantı denetimi ve seviye sistemi gibi özellikler de açılır; daha önce elle ayarladıkların değişmez.',
      'Yeniden çalıştırılırsa yalnızca eksikler tamamlanır.',
      'Botta Kanalları Yönet ve Rolleri Yönet izinleri olmalı; kurulumdan sonra bot rolünü yeni rollerin üstüne taşı.',
      'Kurulumu geri almak için `/sunucusil`.',
    ],
  },
  sunucusil: {
    anlatim:
      '`/sunucukur` ile kurduğum kanalları, kategorileri ve rolleri siler. Önce silinecek her şeyi adıyla gösterir ve "Emin misin?" diye sorar; onaylamazsan hiçbir şey silinmez.',
    ornekler: ['/sunucusil'],
    notlar: [
      'Yalnızca benim oluşturduklarım silinir. Sunucuda önceden olan ya da senin eklediğin kanal ve roller kalır; aynı adı taşısalar bile.',
      'Silinen kanallardaki mesajlar da gider; geri alınamaz.',
      'Silinen kanal ve rollere bağlı bot ayarları (günlük kanalı, hoş geldin, oto rol, bildirim rolleri) temizlenir. Açılan özellikler (koruma, seviye) kapanmaz.',
      'Eski kurulumları denetim kaydından tanırım: bunun için Denetim Kaydını Görüntüle izni gerekir ve Discord kaydı 45 gün saklar.',
      'Benim rolümün üstündeki roller silinemez; Voyager rolünü üstlerine taşıyıp yeniden çalıştır.',
    ],
  },

  // --- Bot sahibi ---
  sunucular: {
    anlatim: 'Botun bulunduğu sunucuları listeler ve botu bir sunucudan çıkarır. Yalnızca bot sahibinin sunucularında görünür.',
    ornekler: ['/sunucular liste', '/sunucular ayril id:123456789012345678'],
    notlar: [],
  },
};

// Alt komut sayfalarına özel anlatım ve notlar: /yardim'da üçüncü menüden alt komut seçilince
// ya da /yardim komut:<komut> <alt> yazılınca gösterilir. Seçenekler komutun tanımından okunur.
const ALTLAR = {
  oyun: {
    ayar: {
      anlatim:
        'Seçeneksiz yazarsan bütün fırsat ayarlarını gösterir. Seçenek verirsen yalnızca onları değiştirir; vermediklerin olduğu gibi (ya da varsayılan) kalır. Bildirimleri başlatmak için yalnızca `kanal` seçmen yeterli.',
      notlar: [
        'Varsayılanlar: bedava oyunlar açık (Steam, Epic ve GOG), indirimler açık (Steam, Epic ve GOG, en az %50), @everyone kapalı.',
        '`kaldir` ile rol etiketlemesini kaldırırsın ya da bildirimleri kapatırsın (ayarlar silinmez).',
        'Rolü yalnızca o rolü kendisi de etiketleyebilen biri seçebilir; rolün "herkes bahsedebilir" ayarı kapalıysa ve botta @everyone izni yoksa bildirim gitmeyeceği söylenir.',
      ],
    },
    simdi: {
      anlatim: 'Ayarlarına uyan ve şu an yayında olan bütün fırsatları hemen fırsat kanalına gönderir; daha önce gönderilmiş olsalar da.',
      notlar: ['Sunucu başına 5 dakikada bir kullanılabilir (mağazalara istek atar).'],
    },
  },
  yayin: {
    ayar: {
      anlatim:
        'Seçeneksiz yazarsan takip edilen yayıncıları ve ayarları gösterir. `kanal` bildirim kanalını, `rol` yayın başlayınca etiketlenecek genel rolü seçer. `yayinci` ile birlikte `rol` verirsen yalnızca o yayıncının rolü değişir.',
      notlar: [
        '`test:True` bildirim kanalına örnek bir bildirim gönderir (kimse etiketlenmez).',
        '`yayinci` yazarken takip edilenler önerilir. Aynı ad birden fazla platformda varsa `platform` seç.',
        '`kaldir` ile rol etiketlemesini kaldırırsın (yayıncı seçiliyse genel role döner) ya da bildirimleri kapatırsın.',
      ],
    },
    ekle: {
      anlatim: 'Platformu seç, yayıncının kanal adını ya da adresini yaz. İstersen `rol` ile bu yayıncıya özel etiket rolü ver.',
      notlar: ['Bildirim kanalı seçilmemişse komutu yazdığın kanal bildirim kanalı olur.', 'Sunucu başına en fazla 50 yayıncı.'],
    },
    cikar: { anlatim: 'Yayıncıyı takipten çıkarır. Yazarken takip edilenler önerilir.' },
  },
  haber: {
    ayar: {
      anlatim:
        'Seçeneksiz yazarsan kaynakları ve ayarları gösterir. `kanal` haber kanalını, `rol` genel haber rolünü seçer. `kaynak` ile birlikte `rol` verirsen yalnızca o kaynağın haberlerinde o rol etiketlenir: böylece her konunun (oyun, teknoloji, spor…) ayrı rolü olur.',
      notlar: [
        '`kaynak` yazarken listedeki kaynaklar önerilir; sıra numarası ya da adı da yazılabilir.',
        '`kaldir:Rol etiketlemesini kaldır` kaynak seçiliyse o kaynağı genel role döndürür, değilse genel rolü kaldırır.',
        '`kaldir:Bildirimleri kapat (kanalı kaldır)` haberleri durdurur; kaynak listesi silinmez.',
      ],
    },
    ekle: {
      anlatim: 'Sitenin adresini (ör. webtekno.com) ya da RSS adresini yaz; bot beslemeyi kendisi bulur. İstersen `rol` ile bu kaynağın konusuna ait etiket rolünü ver (ör. @Oyun Haberleri).',
      notlar: ['Kanal seçilmemişse komutu yazdığın kanal haber kanalı olur.', 'Eski haberler gönderilmez, yalnızca eklendikten sonra yayınlananlar.'],
    },
    cikar: { anlatim: 'Kaynağı takipten çıkarır. Yazarken kaynaklar önerilir; sıra numarası da yazılabilir.' },
  },
  instagram: {
    ayar: {
      anlatim:
        'Seçeneksiz yazarsan hesapları ve ayarları gösterir. `hesap` ile birlikte `rol` verirsen yalnızca o hesabın gönderilerinde o rol etiketlenir. `test:True` örnek bildirim gönderir.',
    },
    ekle: { anlatim: 'Kullanıcı adını ya da profil adresini yaz. Yalnızca herkese açık profesyonel hesaplar takip edilebilir.' },
  },
  koruma: {
    filtre: {
      anlatim:
        'Bir filtreyi (`tur`) açar, kapatır ya da ayarlar. Yalnızca türü seçersen bütün koruma ayarlarını gösterir. `durum` vermeden yalnızca susturma süresini (ya da görselde `kapsam`, bağlantıda `kisaltici`) değiştirebilirsin; filtrenin açık/kapalı durumu değişmez.',
      notlar: [
        '**Spam:** 30 saniyede 3 farklı kanala yazan ya da aynı şeyi tekrarlayan hesabın mesajları silinir, hesap susturulur (varsayılan 60 dakika).',
        '**Küfür:** yalnızca ağır küfürler; varsayılan olarak yalnızca silinir.',
        '**Dolandırıcılık görseli:** yapay zekâ gerekir; varsayılan 1 gün susturma.',
        '**Zararlı ve sahte bağlantı:** taklit siteler ve yanıltıcı bağlantılar; varsayılan 60 dakika susturma.',
        '`susturma-dakika:0` yalnızca mesajı siler, susturmaz.',
      ],
    },
    kelime: { anlatim: 'Küfür filtresine bu sunucuya özel kelime ekler (varsayılan) ya da `islem:Çıkar` ile çıkarır. Yalnızca tam kelime yakalanır.' },
    alan: { anlatim: 'Bağlantı denetiminde bir alanı engeller ya da yanlış alarm veren bir alanı izin listesine ekler. Alt alan adları da kapsanır.' },
  },
  uyari: {
    sil: { anlatim: 'Tek bir uyarıyı `numara` ile (numaraları `/uyari liste` gösterir) ya da üyenin bütün uyarılarını `hepsi:True` ile siler.' },
    kural: {
      anlatim:
        'Seçeneksiz yazarsan kuralları listeler. `esik` (kaçıncı uyarıda) ve `islem` verirsen kural ekler; aynı eşikte kural varsa yerine geçer. `islem:Kuralı kaldır` o eşikteki kuralı siler.',
      notlar: ['Kural eklemek ve kaldırmak Sunucuyu Yönet ister; listeyi görmek istemez.', 'Susturma kuralında `dakika` verilmezse 60 dakika.'],
    },
  },
  seviye: {
    ayar: { anlatim: 'Seçeneksiz yazarsan seviye ayarlarını ve ödülleri gösterir. `durum` sistemi açar ya da kapatır; yalnızca `kanal` verirsen açık/kapalı durumu değişmez.' },
    odul: { anlatim: '`seviye` ve `rol` verirsen o seviyeye ulaşanlara rol verilir (aynı seviyedeki ödülün yerine geçer). Rolü boş bırakırsan o seviyenin ödülü kaldırılır.' },
  },
  ayarla: {
    gunluk: {
      anlatim:
        'Seçeneksiz yazarsan ayarları gösterir. `kanal` günlük kanalını seçer. `kategori` ve `durum` ile olay türlerini tek tek açıp kapatırsın; kategori seçmeden `durum` verirsen hepsine uygulanır.',
    },
    hosgeldin: { anlatim: 'Seçeneksiz yazarsan ayarları gösterir. `kanal` hoş geldin mesajlarının kanalını, `oto-rol` yeni gelenlere verilecek rolü seçer.' },
  },
  kilit: {
    kapat: { anlatim: 'Bütün kanalları hemen kilitler; komutla yazınca onay sormaz (paneldeki düğme bir kez sorar). Her kanalın izinleri saklanır.' },
    ac: { anlatim: 'Kilitlenen kanalları kilitten önceki izinlerine birebir döndürür. Açılamayan kanal kalırsa komutu yeniden çalıştır.' },
  },
};
for (const [komut, altlar] of Object.entries(ALTLAR)) module.exports[komut].altlar = altlar;
