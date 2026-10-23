# Voyager

Yapay zekâ destekli bir Discord botu. Sorulara cevap verir, oyun fırsatlarını inceler ve metin filtrelerinin
göremediği dolandırıcılık resimlerini yakalar. Bunun yanında hazır topluluk sunucusu kurulumu, moderasyon, otomatik
koruma, acil durum kilidi, sunucu günlüğü; yayın, haber ve oyun fırsatı bildirimleri tek botta.

**Site:** [voyager.helyosfer.me](https://voyager.helyosfer.me) · botu sunucuna eklemek için sitedeki **Sunucuna ekle**
düğmesini kullan. Düğme botu bütün özellikleri için gereken izinlerle ekler; ayrıca izin seçmen gerekmez.

Node.js ve [discord.js](https://discord.js.org) ile yazıldı. Kodu alıp kendi botunu da çalıştırabilirsin; adımlar
[Kendi botunu çalıştırmak](#kendi-botunu-çalıştırmak) bölümünde.

## İçindekiler

- [Neler yapar](#neler-yapar)
- [Komutlar](#komutlar)
- [Özellikler](#özellikler)
  - [Yapay zekâ](#yapay-zekâ)
  - [Sunucu kurulumu](#sunucu-kurulumu-ayarlar--kurulum)
  - [Rol menüsü](#rol-menüsü-ayarlar--kurulum)
  - [Çekilişler](#çekilişler-cekilis)
  - [Seviye sistemi](#seviye-sistemi-yardim--seviye-ve-sıralama)
  - [Acil durum kilidi](#acil-durum-kilidi-ayarlar--acil-kilit)
  - [Moderasyon ve uyarılar](#moderasyon-ve-uyarılar-mod)
  - [Otomatik koruma](#otomatik-koruma)
  - [Sunucu günlüğü](#sunucu-günlüğü)
  - [Canlı yayın bildirimleri](#canlı-yayın-bildirimleri)
  - [Haber bildirimleri](#haber-bildirimleri)
  - [Instagram gönderi bildirimleri](#instagram-gönderi-bildirimleri)
  - [Oyun fırsatları](#oyun-fırsatları)
  - [Soru cevaplama](#soru-cevaplama-sor)
  - [Kanal özeti](#kanal-özeti-sağ-tık--buradan-özetle)
- [Sunucuna ekledikten sonra](#sunucuna-ekledikten-sonra)
- [Kendi botunu çalıştırmak](#kendi-botunu-çalıştırmak)
- [VPS'te 7/24 çalıştırma](#vpste-724-çalıştırma-ubuntu)
- [Güvenlik](#güvenlik)
- [Dosya yapısı](#dosya-yapısı)
- [Lisans](#lisans)

## Neler yapar

**Yapay zekâ** (Google Gemini; [ayrıntılar](#yapay-zekâ)):

- **Soru cevaplama:** `/sor` ile yapay zekâya soru sorulur; kısa, Türkçe cevap gelir. İstenirse cevabı yalnızca soran görür.
- **Kanal özeti:** mesaja sağ tık → **Uygulamalar** → **Buradan özetle** o mesajdan itibaren konuşulanları kısa maddelerle özetler; sonradan katılan neler konuşulduğunu hemen görür.
- **Oyun incelemeleri:** popüler ve yeni oyunların fırsat kartlarına spoilersiz konu, kısa yorum, kimlere hitap
  ettiği ve 10 üzerinden puan eklenir.
- **Dolandırıcılık görseli denetimi:** "ünlü adına para dağıtılıyor, siteye gir kodu yaz" türü sahte çekiliş, kripto
  kumarhane ve bedava Nitro resimlerini, resmin içini okuyarak yakalar.

**Diğer özellikler:**

- **Sunucu kurulumu:** tek komutla roller, kanallar, izinler, üyelik onayı ve destek sistemi.
- **Moderasyon:** üyeye sağ tıklayınca açılan kartta uyarma, süreli susturma, atma ve yasaklama; ayrıca toplu mesaj silme, kalıcı uyarılar ve uyarı sayısına göre otomatik ceza.
- **Otomatik koruma:** ele geçirilmiş hesapların spam'ini durdurur, ağır küfürleri ve Discord/Steam taklidi zararlı bağlantıları siler.
- **Acil durum kilidi:** saldırı anında bütün kanalları kilitler, sonra eski haline döndürür.
- **Sunucu günlüğü:** üye giriş çıkışları, silinen ve düzenlenen mesajlar, ses kanalları ve yönetim işlemleri tek kanalda.
- **Canlı yayın bildirimleri:** Twitch, Kick ve YouTube'da takip ettiğin yayıncılar yayına geçince haber verir.
- **Haberler:** takip ettiğin sitelerin yeni haberlerini duyurur (RSS).
- **Instagram:** seçtiğin hesapların yeni gönderilerini duyurur (ayrıca kurulum ister).
- **Oyun fırsatları:** Steam, Epic ve GOG'daki bedava oyunları ve indirimleri Türkiye fiyatlarıyla duyurur.
- **Karşılama:** yeni üyeye hoş geldin mesajı ve otomatik rol.
- **Rol menüsü:** üyeler düğmeye basarak seçtiğin rolleri alıp bırakır.
- **Seviye sistemi:** mesaj yazdıkça XP, seviye atlayınca duyuru ve ödül rolleri, `/yardim` içinde seviye ve sıralama.
- **Çekiliş:** `/cekilis` formuyla başlayan, mesaj üstündeki düğmelerle katılınan ve yönetilen çekilişler.
- **Hatırlatıcı:** mesaja sağ tık → **Uygulamalar** → **Hatırlat** ile seçtiğin süre sonra seni etiketler.

Her sunucunun ayarları ayrıdır ve bir özellik açılmadıkça kapalı kalır.

Bekleme süresi bildiren mesajlardaki sayaçlar (ör. "5 dakika içinde") Discord tarafından, okuyan kişinin uygulama
diliyle gösterilir.

## Komutlar

Bot **5 slash komutu** ve **3 sağ tık menüsü** ile çalışır:

| Komut | Ne yapar | Gereken yetki |
|---|---|---|
| `/ayarlar` | Botun bütün sunucu ayarları tek kartta: bildirimler (oyun fırsatları, yayın, haber, Instagram), koruma, günlük, karşılama, seviye, uyarı kuralları, acil kilit, kurulum (hazır sunucu şablonu, rol menüsü) | Sunucuyu Yönet (acil kilit ve şablon için Yönetici) |
| `/mod` | Moderasyon: `uye` (moderasyon kartı), `temizle` (1-100 mesaj sil), `yasakla` (kimlikle yasakla), `yasak-kaldir` | Üyelere Zaman Aşımı Uygula / Üyeleri At / Üyeleri Yasakla / Mesajları Yönet |
| `/cekilis` | Çekiliş başlatma formunu açar; bitirme, yeniden çekme ve iptal çekiliş mesajındaki düğmelerle yapılır | Sunucuyu Yönet |
| `/sor` | Yapay zekâya soru sorar (yalnızca kurulduysa; günlük hak kullanıma göre ayarlanır) | Herkes |
| `/yardim` | Başlangıç adımları, "Nasıl yapılır?" rehberleri, seviye ve sıralama (seviye açıksa), bölüm bölüm komutlar ve alt komut sayfaları. `/yardim komut:mod temizle` ile doğrudan açılır. Ana sayfanın altında botun gecikmesi yazar | Herkes |

### Sağ tık menüleri (Uygulamalar)

| Menü | Nerede | Ne yapar | Gereken yetki |
|---|---|---|---|
| **Moderasyon** | Üyeye sağ tık → Uygulamalar | Üyenin moderasyon kartını açar: uyarı geçmişi, **Uyar**, **Sustur**, **At**, **Yasakla** ve uyarı silme | Üyelere Zaman Aşımı Uygula / Üyeleri At / Üyeleri Yasakla |
| **Hatırlat** | Mesaja sağ tık → Uygulamalar | Mesaj metni hazır dolu hatırlatıcı formu açar; süre dolunca seni etiketler (kişi başı en fazla 5) | Herkes |
| **Buradan özetle** | Mesaja sağ tık → Uygulamalar | O mesajdan itibaren kanaldaki konuşmaları yapay zekâyla özetler (`/ayarlar` → Günlük'te açıksa; `/sor` hakkını kullanır) | Herkes (kanal geçmişini okuyabilen) |

Yetki gerektiren komutlar yalnızca o yetkisi olanlara görünür. Moderasyon işlemleri ayrıca rol sırasına
bakar: kendinle aynı ya da daha yüksek roldeki bir üyeye işlem yapamazsın. `/ayarlar` paneli Sunucu Ayarları →
Entegrasyonlar'dan başka bir role açılsa bile Sunucuyu Yönet yetkisini bot da denetler; acil kilit ve hazır sunucu
şablonu yalnızca Yönetici yetkisi olanlarca kullanılabilir.

### Ayarlar paneli (`/ayarlar`)

Botun bütün sunucu ayarları tek komutta. `/ayarlar` hiç seçenek almaz; yazılınca yalnızca yazana görünen bir kart
açılır. Kartın en üstünde her zaman bir **bölüm menüsü** durur; bölüm seçilince kart o bölümün ekranına döner ve her
şey düğmeler, seçme menüleri ve küçük formlarla yapılır:

| Bölüm | Kartta neler var |
|---|---|
| 🏠 Genel bakış | Her bölümün tek satırlık durumu |
| 🎮 Oyun fırsatları | Kanal ve rol menüleri; bedava oyunlar, indirimler, @everyone aç/kapat; **Şimdi gönder**; **Bildirimleri kapat** |
| 📡 Yayın · 📰 Haber · 📸 Instagram | Kanal ve rol menüleri; **➕ Ekle** formu (kayda özel rol de seçilir; kayıt zaten listedeyse yalnızca rolü değişir); listeden seçerek çıkarma (25'ten fazla kayıt sayfalara bölünür); **Deneme bildirimi** (yayın, Instagram); **Bildirimleri kapat** |
| 🛡️ Koruma | Spam, küfür, görsel ve bağlantı filtrelerini aç/kapat; görsel kapsamı ve kısaltıcılar; susturma süreleri, özel kelimeler, engel ve izin alanları (formla) |
| 📋 Günlük | Günlük kanalı (boşaltınca kayıt durur), kaydedilecek olay türleri, kanal özetleri aç/kapat |
| 👋 Karşılama | Hoş geldin kanalı ve oto rol (boşaltınca kalkar) |
| 📈 Seviye | Sistemi aç/kapat, duyuru kanalı, ödül ekle (formla) ve kaldır, üyenin XP'sini sıfırla |
| ⚠️ Uyarı kuralları | Kural ekle (formla), listeden kaldır |
| 🚨 Acil kilit | Tek düğmeyle bütün sunucuyu kilitle ve kilidi aç (yalnızca Yönetici görür) |
| 🧰 Kurulum | Hazır sunucu şablonu (Yönetici) ve rol menüsü kur (Rolleri Yönet) |

Instagram bölümü, botta Instagram bağlantısı kuruluysa görünür.

## Özellikler

### Yapay zekâ

Dört özellik Google'ın Gemini modelleriyle çalışır. Her biri ayrıntılı olarak kendi bölümünde anlatılır:

| Özellik | Nasıl açılır | Ayrıntılar |
|---|---|---|
| `/sor`: yapay zekâya soru sorma | Her sunucuda kendiliğinden açık | [Soru cevaplama](#soru-cevaplama-sor) |
| Sağ tık → **Buradan özetle**: kanaldaki konuşmaları özetleme | Sunucu başına `/ayarlar` → Günlük ile; varsayılan olarak kapalı | [Kanal özeti](#kanal-özeti-sağ-tık--buradan-özetle) |
| Oyun fırsatı kartlarına inceleme ve puan | `/ayarlar` → Oyun fırsatları'nda kanal seçilince | [Oyun fırsatları](#oyun-fırsatları) |
| Dolandırıcılık görseli denetimi (`/ayarlar` → Koruma) | Sunucu başına; varsayılan olarak kapalı | [Otomatik koruma](#otomatik-koruma) |

Ortak noktalar:

- **Yapay zekâ yanılabilir.** Bot bunu her cevabın ve her incelemenin altında söyler. Görsel denetimi yanlış alarm
  verirse susturma elle kaldırılır.
- **Ne Google'a gider:** `/sor` soruları, **Buradan özetle** ile özetlenen mesajlar (yazanların görünen adlarıyla), oyun incelemeleri için Steam mağaza bilgileri ve görsel denetimi açık
  sunucularda denetlenen resimler. Ücretsiz katmanda Google bu verileri ürünlerini geliştirmek için kullanabilir.
  Bot soruları ve özetlenen mesajları kaydetmez. Resimleri de saklamaz, yalnızca parmak izlerini (SHA-256) tutar; yakalanan resmin kanıtı
  sunucunun kendi günlük kanalına bulanık olarak düşer.
- **Model yalnızca metin üretir.** Sunucuda hiçbir işlem yapamaz ve yazdığı metin kimseyi etiketleyemez; `/sor`
  cevaplarında, özetlerde ve incelemelerde bağlantılar da etkisizleştirilir. Görsel denetiminde silme ve susturmayı bot yapar,
  bunun için model en az %70 emin olmalıdır.
- **Kota ortaktır.** Günlük haklar sunucu ve kişi sayısına göre kendiliğinden paylaştırılır; incelemeler ve görsel
  denetiminin ayrı günlük payları vardır.
- **Kurulum** (kendi botunu çalıştıranlar için): `.env` içinde `GEMINI_API_KEY` ve `GEMINI_MODEL`. İkisi yoksa
  `/sor` yüklenmez, kartlar incelemesiz gider, görsel denetimi açılamaz. Diğer `GEMINI_*` ayarları isteğe bağlıdır
  ve `.env.example` içinde açıklanır.

### Sunucu kurulumu (`/ayarlar` → Kurulum)

Yalnızca Yönetici yetkisi olanlar çalıştırabilir. Sunucuyu kullanım amacına uyan bir şablonla kurar. **Hazır sunucu
şablonu** düğmesine basınca şablonlar açıklamalarıyla listelenir; seçince ne oluşturulacağı gösterilir ve **Kur**
düğmesiyle onay istenir. Mevcut kanal ve roller silinmez ya da değiştirilmez; aynı adda olanlar atlanır,
komut yeniden çalıştırılırsa yalnızca eksikler tamamlanır.

| Şablon | Kimin için | Rol / kategori / kanal | Üyelik onayı | Kendiliğinden açılanlar |
|---|---|---|---|---|
| 🌐 Topluluk | Her konuya kanalı olan geniş topluluk; etkinlikler, özel alan, destek talepleri | 17 / 14 / 55 | Var | Spam, bağlantı denetimi, seviye |
| 🎮 Oyun topluluğu | Oyuncu topluluğu ya da klan: oyun türü rolleri, takım arama, fırsatlar, oyun haberleri, turnuvalar | 16 / 8 / 36 | Var | Spam, bağlantı denetimi, seviye |
| 🎥 Yayıncı | Kick, Twitch ya da YouTube yayıncısı: yayın duyurusu, yayın takvimi, klipler, abone alanı | 9 / 6 / 21 | Yok | Spam, bağlantı, küfür, seviye |
| 🏠 Basit | Arkadaş grubu ya da küçük sunucu: birkaç sohbet ve ses kanalı, günlük | 2 / 4 / 10 | Yok | Spam |
| 🎓 Eğitim | Sınıf, kurs, çalışma grubu: duyurular, ödevler, kaynaklar, soru-cevap, çalışma odaları | 3 / 5 / 19 | Yok | Spam, bağlantı, küfür |
| 👨‍💻 Yazılım ve teknoloji | Yazılımcı topluluğu: alan rolleri, kod yardımı, projeler, iş ilanları, teknoloji haberleri | 14 / 6 / 27 | Var | Spam, bağlantı denetimi, seviye |
| 🛠️ Ürün ve destek | Ürün ya da hizmet sunucusu: güncellemeler, SSS, hata bildirimi, özel destek odaları | 4 / 6 / 15 | Yok | Spam, bağlantı, küfür |

- **Bot kendiliğinden ayarlanır:** günlük, hoş geldin, oyun fırsatları, yayın ve haber kanalları botun ayarlarına
  bağlanır. Bildirimlerde etiketlenecek roller (🎁 Oyun Fırsatları, 📰 Oyun Haberleri, 🔴 Yayın Bildirimi...) oluşturulur
  ve ilgili bildirime bağlanır; şablona göre koruma ve seviye sistemi açılır. **Daha önce elle seçilmiş bir ayara
  dokunulmaz.** Mesaj metnini okumayı gerektiren korumalar (küfür, bağlantı) botta Message Content Intent kapalıysa açılmaz.
- **Bildirim rolleri:** üyeler `rol-seçimi` kanalındaki menüden ilgi alanlarıyla birlikte bildirim rollerini de seçer;
  yalnızca ilgilendikleri konularda etiketlenirler. Haber kaynaklarına sonradan `/ayarlar` → Haber bildirimleri → **Ekle** formundan konu rolü verilebilir.

- **İzinler kategori düzeyinde tanımlanır** ve kanallar kategorisiyle eşitlenmiş (senkron) oluşur. Yalnızca farklı
  davranması gereken kanallar (kurallar, duyurular, bot akışları...) kendi iznini taşır.
- **Üyelik onayı:** Yeni gelenler `Yeni Gelen` rolüyle başlar ve yalnızca başlangıç ile destek kanallarını görür.
  `üyelik-onay` kanalındaki düğmeye basınca `Üye` olur, topluluk kanalları açılır.
- **İlgi ve bildirim rolleri:** `rol-seçimi` kanalındaki menüden seçilir. Onaysız şablonlarda herkes seçebilir.
- **Destek talepleri:** `destek-merkezi` kanalındaki düğme, yalnızca talep sahibinin ve destek ekibinin gördüğü bir oda açar.
  Kapatılan oda hemen silinmez; sahibi okuyabilir ama yazamaz. Kapalı odalar 30 gün sonra silinir; bir üyenin en fazla
  3 kapalı odası saklanır. Bir üye 10 dakikada bir talep açabilir; sunucuya yeni katılan ilk 10 dakika açamaz.
  Aynı anda en fazla 25 oda açık olabilir; sınıra gelince destek kayıt kanalına uyarı düşer.

Topluluk şablonunda roller ve erişim (diğer şablonlarda bunların bir kısmı vardır):

| Rol | Erişim |
|---|---|
| Yeni Gelen | Başlangıç ve herkese açık destek (yalnızca okur) |
| Üye | Topluluk, oyun, teknoloji, medya, ses, etkinlik ve destek |
| Destekçi, İçerik Üreticisi | Üye alanları + Özel Alan |
| Etkinlik Ekibi | Üye alanları + etkinlik duyurusu yazma + Ekip Alanı |
| Destek Ekibi | Üye alanları + destek talepleri + Ekip Alanı |
| Moderatör | Yukarıdakiler + Moderasyon (üye atma, susturma, mesaj yönetme) |
| Yönetici | Her yer (ayrıca yasaklama); **Administrator izni verilmez** |

Botta **Kanalları Yönet** ve **Rolleri Yönet** izinleri olmalı; bot yalnızca kendisinde olan izinleri kanal kurallarına
yazabildiği için **Bağlan**, **Konuş**, **Video** ve **Dosya Ekle** izinleri de önerilir. Kurulumdan sonra Voyager rolü
yeni rollerin üstüne taşınmalıdır.

### Rol menüsü (`/ayarlar` → Kurulum)

**Rol menüsü kur** düğmesi tek bir form açar: başlık, açıklama, roller (en fazla 10), kanal (boşsa kartın açıldığı
kanal) ve üyenin kaç rol alabileceği. Gönderince seçilen kanala başlık, açıklama ve her rol için bir düğme içeren bir
mesaj konur. Üye düğmeye basınca rolü alır, yeniden basınca bırakır. "Yalnızca bir tane" seçilirse üye o menüden
yalnızca bir rol taşıyabilir; yenisini seçince
eskisi bırakılır (renk ya da takım rolleri için). Menüyü kaldırmak için mesajı silmek yeterlidir; bot ayrıca bir kayıt
tutmaz, hangi rollerin menüde olduğunu mesajın düğmelerinden okur.

- Menüye oto rolle aynı kurallar uygulanır: yönetim yetkisi taşıyan (ör. üye atma, mesaj ya da rol yönetme), botun
  rolünden yüksek ya da menüyü kuranın kendisinin veremeyeceği roller eklenemez.
- Menü kurulduktan sonra role yönetim yetkisi verilirse ya da rol botun üstüne taşınırsa düğme o rolü vermez.
- Bot için **Rolleri Yönet** izni gerekir.

### Çekilişler (`/cekilis`)

`/cekilis` hiç seçenek almaz; yazılınca çekiliş başlatma formunu açar: ödül, süre (en fazla 14 gün), kazanan sayısı (en
fazla 20), isteğe bağlı rol şartı ve kanal (boşsa komutun yazıldığı kanal).

- Üyeler mesajdaki **🎉 Katıl** düğmesiyle katılır, yeniden basınca çekilir. Süre dolunca kazananlar rastgele seçilir,
  mesaj güncellenir ve kanalda yalnızca kazananlar etiketlenerek duyurulur.
- Çekiliş mesajının üstündeki **Bitir** ve **İptal** düğmeleriyle (bittiğinde **Yeniden çek** düğmesiyle) **Sunucuyu
  Yönet** yetkisi olanlar çekilişi doğrudan mesajdan yönetir.
- Kazananlar yalnızca hâlâ sunucuda olan katılımcılar arasından seçilir; yeniden çekilişte önceki kazananlar tekrar seçilmez.
- Çekilişler kaydedilir; bot yeniden başlarsa süren çekilişler kaldığı yerden devam eder. Biten çekilişler yeniden
  çekiliş için 7 gün saklanır.
- Bir sunucuda aynı anda en fazla 10 çekiliş sürebilir; bir çekilişe en fazla 5.000 kişi katılabilir.

### Seviye sistemi (`/yardim` → Seviye ve sıralama)

`/ayarlar` → Seviye bölümünden sunucu başına açılır; varsayılan olarak kapalıdır. Duyuru kanalı, ödül rolleri (en
fazla 10) ve üyenin XP'sini sıfırlama da oradadır.

Sistem açıkken üyeler `/yardim` yazıp menüden **📈 Seviye ve sıralama** sayfasını açarak kendi seviyelerini, sıralarını,
sonraki seviyeye kalan XP'yi ve sunucudaki ilk 10 kişiyi görür.

- Üye her mesajda 15-25 XP kazanır, ama dakikada en fazla bir kez; art arda yazmak XP kazandırmaz. Botlar ve
  webhook'lar XP kazanmaz. Seviye atlamak giderek zorlaşır (0→1: 100 XP, 9→10: 1.005 XP).
- Otomatik korumanın sildiği mesajlar (spam, küfür, zararlı bağlantı) XP kazandırmaz. Görsel denetiminin kararı
  30-60 saniye sürdüğü için onun sildiği mesajlar bu kurala girmez.
- Mesajların içeriği okunmaz, yalnızca yazıldıkları bilinir; Message Content Intent gerekmez.
- Seviye atlayan, mesajı yazdığı kanalda (ya da seçilen duyuru kanalında) etiketlenerek duyurulur.
- Ödül rollerine oto rolle aynı kurallar uygulanır: yönetim yetkisi taşıyan, botun rolünden yüksek ya da ödülü
  ekleyenin kendisinin veremeyeceği roller ödül yapılamaz. Rol sonradan yönetim yetkisi alırsa verilmez.
  Ödül eklenmeden önce o seviyeyi geçmiş üyeler rolü bir sonraki seviye atlayışlarında alır.
- Seviye ayarları Sunucuyu Yönet yetkisi ister. Sistem kapatılınca XP silinmez.
- XP her mesajda diske yazılmaz; dakikada bir ve bot kapanırken kaydedilir. Bot çökerse en fazla son dakikanın
  XP'si kaybolur.

### Acil durum kilidi (`/ayarlar` → Acil kilit)

**Sunucuyu kilitle** düğmesi saldırı anında bütün kanalları kilitler: sunucu sahibi dışındaki üyeler yazamaz, tepki
ekleyemez, konu açamaz ve ses kanallarına giremez. Onay sorulmaz. Her kanalın izinleri saklanır; **Kilidi aç** hepsini
kilitten önceki haline birebir döndürür. Bölümü yalnızca Yönetici yetkisi olanlar görür.

- Kilitliyken sunucuya eklenen botlar kendiliğinden atılır.
- Yetki varsa (Üyeleri Taşı) ses kanallarındakiler çıkarılır.
- Discord kuralı gereği sunucu sahibi ve **Administrator** iznine sahip roller kanal izinlerinden etkilenmez.
- Bot bir izni ancak kendisinde de varsa kilitleyebilir; eksik olanlar kartta listelenir.
- Bir ses kanalını kilitleyebilmesi için botun o kanalda **Bağlan** izni olmalıdır. Hazır sunucu şablonu bunu kendisi
  verir; elle kurulmuş ya da eski bir kurulumdan kalan ses kanallarında izin yoksa o kanallar "erişimim yok" diye bildirilir.
- Bot **Yönetici** olmak zorunda değildir. Kilit, botun kanalda elinde olan izinlerle uygulanır.

### Moderasyon ve uyarılar (`/mod`)

Bir üyeye sağ tıklayıp **Uygulamalar** → **Moderasyon** seçildiğinde (ya da `/mod uye` ile) yalnızca yetkiliye görünen
moderasyon kartı açılır:

- Kartta üyenin durumu, varsa aktif susturması ve numaralı uyarı geçmişi görünür.
- Yetkiye göre **⚠️ Uyar**, **🔇 Sustur** (susturulmuşsa **🔊 Susturmayı kaldır**), **👢 At** ve **🔨 Yasakla** düğmeleri
  çıkar; uyarma, susturma, atma ve yasaklama sebep soran küçük bir form açar.
- Uyarılar karttaki seçme menüsünden tek tek ya da **🗑️ Tüm uyarıları sil** düğmesiyle topluca silinir.
- Diğer işlemler `/mod` alt komutlarındadır: `/mod temizle` (1-100 mesaj siler), `/mod yasakla` (sunucuda olmayan
  birini de kullanıcı kimliğiyle yasaklar) ve `/mod yasak-kaldir`.

Otomatik ceza kuralları `/ayarlar` → Uyarı kuralları bölümünden kurulur (Sunucuyu Yönet): uyarı sayısı bir eşiğe gelince
susturma, atma ya da yasaklama.

- Kural, üyenin uyarı sayısı **tam** eşiğe geldiğinde bir kez uygulanır (ör. 3. uyarıda 1 gün susturma, 5. uyarıda
  atma). En fazla 5 kural olabilir; eşik en fazla 20'dir. Bir üyenin en fazla 50 uyarısı saklanır.
- Kural bot üzerinden yetki aşmaya yaramaz: uyarıyı veren yetkili kuralın işlemini kendisi yapamıyorsa (ör. yalnızca
  susturma yetkisi varken atma kuralı) işlem uygulanmaz, bu durum cevapta ve günlükte söylenir. Kural ekleyen de
  işlemi kendisi yapabiliyor olmalıdır.
- Bütün moderasyon işlemleri rol sırasına bakar: kendinle aynı ya da daha yüksek roldeki üyeye işlem yapamazsın.
- Verilen, silinen ve temizlenen uyarılar ile diğer işlemler günlüğün Moderasyon kategorisine yazılır.

### Otomatik koruma

`/ayarlar` → Koruma bölümünde her filtre bir düğmeyle açılıp kapanır; hepsi varsayılan olarak kapalıdır. Mesajları
Yönet yetkisi olanlar ve botlar muaftır. Susturma süreleri (0 = yalnızca sil), özel kelimeler ve alan listeleri aynı
karttaki formlarla değişir.

| Filtre | Ne yapar |
|---|---|
| Spam | 30 saniyede 3 farklı kanala yazan, aynı içeriği 4 kez tekrarlayan ya da yetkisiz `@everyone` ile bağlantı/dosya gönderen üyenin mesajlarını siler ve üyeyi susturur (varsayılan 60 dakika) |
| Küfür | Ağır küfür içeren mesajları siler; istenirse yazanı susturur |
| Dolandırıcılık görseli | Dolandırıcılık resimlerini (ünlü adına para dağıtma, kripto kumarhane bonusu, bedava Nitro vb.) yapay zekâyla yakalar; mesajı siler, atanı susturur (varsayılan 1 gün), günlüğe kanıtıyla yazar. Kartta yalnızca riskli ya da bütün resimler seçilir |
| Zararlı ve sahte bağlantı | Discord, Steam, Epic Games, Roblox ve Twitch'i taklit eden alanları, yanıltıcı bağlantıları ve bedava Nitro alanlarını siler; atanı susturur (varsayılan 60 dakika). Kartta istenirse kısaltılmış bağlantıları (bit.ly vb.) da siler |

| Kartta | Ne yapar |
|---|---|
| 📝 Özel kelimeler | Sunucuya özel yasaklı kelime ekler ya da çıkarır |
| 🔗 Alanlar | Bağlantı denetimi için sunucuya özel engel ve izin listesi (alt alan adları da kapsanır) |

Spam koruması özellikle ele geçirilmiş hesapların bütün kanallara aynı görselleri atmasını hedefler; bu yüzden
üyeyi banlamaz, susturur. Küfür filtresi yalnızca ağır küfürleri yakalar ve masum kelimelere takılmamak için
bilerek dardır ("amk", "aq" gibi kısaltmalar hazır listede yoktur). Küfür filtresi için Message Content Intent gerekir.

**Bağlantı denetimi** bağlantıları açmaz ve hiçbir yere göndermez; karar yalnızca adresin kendisinden verilir:

- Taklit alanlar: harfi benzeyeniyle değiştirilmiş (`dlscord`, `disc0rd`, Kiril harfli `dіscord`, `stearncommunity`),
  bir harfi oynatılmış (`dicsord`), markanın yanına hediye kelimesi eklenmiş (`discord-nitro`, `discordgift`), başka
  uzantıda açılmış (`discord.ru`) ya da gerçek adresi alt alan adına gizlemiş (`steamcommunity.com.kotu.ru`) alanlar.
- Yanıltıcı bağlantılar: görünen adresiyle gittiği adres farklı olanlar (`[discord.com](https://kotu.site)`) ve
  adresin başına başka site adı gizleyenler (`https://discord.com@kotu.site`).
- `free-nitro` gibi bedava Nitro/hediye alanları.
- Kurallar yanlış alarm vermemek için bilerek dardır: markanın adını taşıyan ama hediye kelimesi içermeyen siteler
  (`discordbotlist.com`, `discord.js.org`) yakalanmaz. Yine de yanlış alarm olursa alan **🔗 Alanlar** formundan
  izin listesine eklenir. Bilinen her zararlı alanı tanımaz; gördüğün bir alanı aynı formdan engelle.
- Mesajı düzenleyerek bağlantı eklemek de yakalanır. Message Content Intent gerekir.

**Görsel denetimi** metin filtrelerinin göremediği, resmin içindeki dolandırıcılığı yakalar:

- Resimler indirilir (yalnızca Discord'un kendi sunucularından, en fazla 8 MB ve mesaj başına 4 resim) ve parmak izi
  çıkarılır. Daha önce yakalanmış bir resim yeniden atılırsa yapay zekâya sorulmadan anında silinir; bu saldırılarda
  aynı resim art arda birçok kanala atıldığı için ilk mesajdan sonrakiler beklemeden temizlenir.
- Varsayılan kapsam **riskli** mesajlardır: yeni üyeler (son 7 gün), bağlantı ya da toplu etiket içeren mesajlar,
  tek mesajda birden fazla resim ve aynı resmin birden fazla kanala atılması. Kartta "bütün resimler" seçilirse hepsi denetlenir.
- Model en az %70 emin olduğunda işlem yapılır: mesaj ve aynı kişinin aynı resimli son mesajları silinir, kişi
  susturulur, kanala kısa bir uyarı yazılır, günlüğe sebep ve bulanık kanıt resmi düşer. Banlamaz; bu hesaplar
  çoğu zaman sahibinin elinden çalınmıştır.
- Denetlenen resimler Google'a gönderilir. Model yanılabilir; yanlış alarmda susturma elle kaldırılır.
- Model `.env` içindeki `GEMINI_GORSEL_MODEL` ile seçilir (önerilen: Gemma; yavaştır ama günlük sınırı yüksektir).
  Karar Gemma ile 30-70 saniye sürebilir. Botun tamamı için günlük denetim sayısı `GEMINI_GORSEL_GUNLUK` ile
  sınırlanır (Gemma'da varsayılan 1.000, diğer modellerde 60); bir sunucu günde en fazla 200 denetim kullanır.

### Sunucu günlüğü

`/ayarlar` → Günlük bölümünde seçilen kanala sunucuda olan biten yazılır. Kaydedilecek olay türleri aynı karttaki
menüden seçilir; hepsi varsayılan olarak açıktır.

| Kategori | Neler yazılır |
|---|---|
| Moderasyon | Ban, yasak kaldırma, kick, susturma, uyarılar, `/mod temizle` (botla ya da elle yapılanlar) |
| Üyeler | Katılma, ayrılma, takma ad ve rol değişikliği |
| Mesajlar | Silinen ve düzenlenen mesajlar, toplu silme |
| Ses kanalları | Girme, çıkma, kanal değiştirme |
| Sunucu | Kanal ve rol oluşturma/silme |

- Elle yapılan moderasyon ve sunucu değişikliklerinin görünmesi için bot rolünde **Denetim Kaydını Görüntüle** izni olmalı.
- Silinen/düzenlenen mesajların **içeriği** varsayılan olarak yazılmaz. Açmak için önce Developer Portal > Bot >
  **Message Content Intent**'i aç, sonra `.env` dosyasına `MESAJ_ICERIGI=1` yazıp botu yeniden başlat.
  Sıra önemli: intent açılmadan `MESAJ_ICERIGI=1` yapılırsa bot bağlanamaz.

### Canlı yayın bildirimleri

Seçilen yayıncılar yayına geçince bot seçilen kanala haber verir. Yalnızca **Sunucuyu Yönet** yetkisi olanlar ayarlar.
Her şey `/ayarlar` → Yayın bildirimleri kartından yapılır: **➕ Ekle** formunda platform, kanal adı (ya da adresi) ve isteğe bağlı olarak o
yayıncıya özel etiket rolü seçilir; çıkarmak için kartın listesinden yayıncı seçilir. Kartta ayrıca kanal ve genel rol
menüleri, **Deneme bildirimi** ve **Bildirimleri kapat** vardır.

| Platform | Hız | Gereken |
|---|---|---|
| Twitch | Anında (Twitch haber verir) | Twitch geliştirici uygulaması + botun dışarıdan ulaşılan adresi |
| Kick | Anında (Kick haber verir) | Kick geliştirici uygulaması + botun dışarıdan ulaşılan adresi |
| YouTube | 1-3 dakika (dakikada bir kontrol) | YouTube Data API anahtarı |

Bir sunucu en fazla 50 yayıncı takip edebilir. Etiketlenecek rolü, ancak o rolü kendisi de etiketleyebilen biri seçebilir.
Kendi rolü olan yayıncı yayına geçince genel rol yerine o rol etiketlenir; böylece üyeler rol menüsünden yalnızca
takip etmek istedikleri yayıncıların rolünü alabilir. Kanal seçilmeden ilk yayıncı eklenirse komutun yazıldığı kanal
(bot oraya yazabiliyorsa) bildirim kanalı olur.

### Haber bildirimleri

`/ayarlar` → Haber bildirimleri kartıyla haber sitelerinin yeni haberleri bir kanala duyurulur (**Ekle** formu, çıkarma listesi, kanal ve rol menüleri). Sitelerin
kendi RSS/Atom beslemeleri okunur; anahtar ya da hesap gerekmez.

- **Konuya göre etiket:** her kaynağın kendi rolü olabilir (**Ekle** formunda rol seçilir; kaynak listedeyse yalnızca rolü değişir).
  Örneğin oyun sitelerine `@Oyun Haberleri`, teknoloji sitelerine `@Teknoloji Haberleri` verilir; üyeler bu rolleri rol
  menüsünden alır ve yalnızca ilgilendikleri haberlerde etiketlenir. Kendi rolü olmayan kaynak genel haber rolünü kullanır.

- **Ekle** formu sitenin adresini (ör. `webtekno.com`) ya da doğrudan RSS adresini kabul eder; site adresi verilirse besleme otomatik bulunur.
- Kaynaklar 10 dakikada bir kontrol edilir; bir kaynaktan tek seferde en fazla 3 haber duyurulur. Sunucu başına 15 kaynak.
- Kaynak eklendiğinde mevcut haberler gönderilmez, yalnızca sonradan yayınlananlar duyurulur.
- Adresi kullanıcılar verdiği için bot yalnızca herkese açık adreslere, standart portlardan bağlanır; iç ağ adresleri reddedilir.
- Bütün sunucuların takip ettiği toplam kaynak sayısı sınırlıdır; aynı kişinin sahip olduğu sunucular toplamda 30 kaynak ekleyebilir.

### Instagram gönderi bildirimleri

`/ayarlar` → Instagram bildirimleri kartıyla seçilen hesapların yeni gönderileri bir kanala duyurulur (**Ekle** formu, çıkarma listesi, kanal ve rol menüleri); her hesabın kendi etiket rolü olabilir.
Sunucu başına 20 hesap. Instagram'ın resmi Business Discovery servisi kullanılır:

- Yalnızca **profesyonel** (işletme / içerik üreticisi) ve herkese açık hesaplar takip edilebilir.
- İstek sınırı bütün sunucular arasında ortak olduğu için özellik yalnızca izin verilen sunucularda açıktır:
  `.env` içindeki `INSTAGRAM_SUNUCULAR` ve `GUILD_IDS`. İkisi de boşsa her sunucuda açık olur.
- Anında değildir; hesaplar yaklaşık 5 dakikada bir kontrol edilir (hesap sayısı arttıkça aralık uzar).
- Botun sahibinin, bir Facebook Sayfasına bağlı profesyonel bir Instagram hesabı ve bir Meta geliştirici uygulaması olmalıdır.
  `.env` içinde `META_APP_ID`, `META_APP_SECRET` ve `INSTAGRAM_TOKEN` doldurulur; bot jetonu uzun ömürlüsüyle değiştirip kendisi yeniler.

### Oyun fırsatları

Bot 15 dakikada bir bedava oyunları ve mağaza indirimlerini kontrol eder:

- **Önemli fırsatlar anında gelir:** popüler oyunlar (Steam'de en az 20.000 incelemesi olanlar) ve son 6 ayda
  çıkmış, en az 2.000 incelemesi olan oyunlar. Bunlar resimli büyük kartla ve kısa bir yapay zekâ incelemesiyle
  (spoilersiz konu, yorum, kimlere hitap ettiği ve 10 üzerinden puan) gönderilir. Bir gönderimde en fazla 5 kart
  olur; kalan önemli fırsatlar kartların altında listelenir.
- **Diğer fırsatlar 3 saatte bir** tek liste halinde gelir. Arada süresi biten fırsat listeye girmez.
- Steam'in DLC ya da ek paket olarak bildirdikleri gösterilmez.

| Ne | Kaynak | Fiyat |
|---|---|---|
| Bedava oyunlar | [GamerPower](https://www.gamerpower.com) | |
| Steam indirimleri | Steam'in öne çıkan indirimleri | Türkiye bölgesi (dolar) |
| Epic Games indirimleri | Epic mağaza vitrinindeki indirimli oyunlar | Türkiye bölgesi (TL) |
| GOG indirimleri | GOG'da en çok ilgi gören 15 indirim | Türkiye bölgesi (dolar) |

Steam, Epic Games ve GOG takip edilir; indirimlerde en az %50 aranır. Her şey `/ayarlar` → Oyun fırsatları kartından yapılır:

| Kartta | Ne yapar |
|---|---|
| Kanal menüsü | Kanalı seçer ve bildirimleri başlatır |
| Rol menüsü | Fırsat geldiğinde etiketlenecek rol (boşaltınca kimse etiketlenmez) |
| Bedava oyunlar | Bedava oyun bildirimlerini açar/kapatır (başlangıçta açık) |
| İndirimler | İndirim bildirimlerini açar/kapatır (başlangıçta açık) |
| @everyone | Önemli fırsatlarda @everyone atılsın mı (başlangıçta kapalı; en fazla 6 saatte bir, arada gelenlerde rol etiketlenir). Botta **@everyone, @here ve Tüm Rollerden Bahset** izni olmalı |
| Şimdi gönder | Şu an yayında olan fırsatları hemen gönderir (sunucu başına 5 dakikada bir) |
| Bildirimleri kapat | Kanalı kaldırır; ayarlar silinmez |

Kanal ilk seçildiğinde o an yayında olanlar gönderilmez, yalnızca sonradan çıkanlar bildirilir.

Aynı oyun birden fazla mağazada indirimdeyse tek kayıtta birleştirilir. Eşikler ve aralıklar
`src/firsatlar.js` başındaki sabitlerdir (`POPULER_ESIK`, `YENI_ESIK`, `OZET_ARALIGI`, `EVERYONE_ARALIGI`).

**İncelemeler** `/sor` ile aynı Gemini anahtarıyla yazılır; anahtar yoksa kartlar incelemesiz gider. Model, oyunu
uydurmasın diye Steam mağaza bilgileri, Steam kullanıcı oranı ve Metacritic puanıyla beslenir; kartta bu
puanlar da yazar. Bir oyunun incelemesi bir kez yazılır, 60 gün saklanır ve bütün sunucularda aynısı gösterilir.
İncelemeler günlük Gemini kotasından en fazla 60 istek kullanır, kalanı `/sor` içindir. İnceleme yapay zekâ
ürünüdür ve yanlış olabilir; kartın altında bu not yer alır.

### Soru cevaplama (`/sor`)

`/sor soru:<metin>` soruyu Google'ın Gemini modeline sorar ve cevabı kanala yazar; `gizli` seçeneğiyle cevabı
yalnızca soran görür. Cevaplar yanlış olabilir; her cevabın altında bu not yer alır.

Açık cevaplar Discord'da **Yanıtla** ile cevaplanarak sürdürülebilir: bot yanıt zincirini geriye doğru izler
(en fazla 10 mesaj), önceki soru ve cevapları bağlam olarak modele gönderir ve cevabını yanıt olarak yazar. Her
yanıt `/sor` hakkından bir tane kullanır. Bunun için `MESAJ_ICERIGI=1` gerekir; kapalıysa Discord yalnızca botu
etiketleyen mesajların içeriğini verdiğinden, yanıt yalnızca etiket (Yanıtla'daki "@ AÇIK") açıkken çalışır.

- Model yalnızca metin üretir: sunucuda hiçbir işlem yapamaz ve cevabı kimseyi etiketleyemez.
- Sorulan metin Google'a gönderilir. Ücretsiz katmanda Google bu metni ürünlerini geliştirmek için kullanabilir;
  kişisel bilgi yazılmamalıdır. Bot soruları kaydetmez.
- Kota bütün sunucular arasında ortaktır ve sınırlar kullanıma göre kendiliğinden ayarlanır. Bot, `/sor`
  modelinin günlük sınırının (`GEMINI_GUNLUK`, varsayılan 500) %90'ını kullanır; incelemeler aynı modeldeyse
  bunun 60'ı incelemelere ayrılır. Kalan havuz, son 7 günde soru soran sunucular arasında eşit bölünür; sunucunun
  payı da orada soru soran kişilere göre ayarlanır. Az sunucu varken paylar geniştir, sunucu ve kişi sayısı arttıkça
  küçülür; hiç soru sormayan sunucular payı küçültmez. Payların alt ve üst sınırları havuzla birlikte büyür: 390'lık
  havuzda sunucu başı 10-150 ve kişi başı 3-20; Gemma'nın 14.400'lük sınırında sunucu başı 32-1.296 ve kişi başı 6-43.
  Ayrıca kişi başı 2 dakikada en fazla 4 açık soru (gizli sorular hariç; kanal boğulmasın diye) ve bütün bot için modelin dakikalık sınırı (`GEMINI_DAKIKALIK`). Sayaçlar diske yazılır, bot yeniden
  başlayınca sıfırlanmaz. Cevabın altında kişinin o gün kalan hakkı yazar. Sabitler `src/yapayzeka.js` içindedir.
- Kurulum: `.env` içinde `GEMINI_API_KEY` (AI Studio'dan, başka anahtarlardan ayrı) ve `GEMINI_MODEL` (modelin
  API'deki adı). İkisi yoksa komut yüklenmez. İsteğe bağlı `GEMINI_YEDEK_MODEL`: asıl model yoğunken ya da kotası
  dolduğunda soru bu modellere sorulur (virgülle ayır, sırayla denenir). `GEMINI_INCELEME_MODEL`: oyun incelemelerini
  ayrı modellere yazdırır. Özellik her sunucuda açıktır; istenirse `GEMINI_SUNUCULAR` ile belirli sunuculara
  kısıtlanır (o zaman `GUILD_IDS` içindekiler de izinlidir).
- Google sınırları her model için ayrı sayar; aynı anahtarla her işe ayrı model vermek yükü dağıtır. Önerilen düzen:
  sorular hızlı bir Gemini modelinde, incelemeler başka bir Gemini modelinde, en sonda yedek olarak Gemma.
- Gemma modelleri desteklenir. Bunlar ayrı talimat alanını, JSON şemasını ve düşünme ayarını desteklemediği için
  bot talimatı soruyla birlikte gönderir ve JSON biçimini talimatla ister. Gemma'nın günlük sınırı yüksektir ama
  yavaştır: cevaptan önce kendiliğinden düşünür, bu kapatılamaz ve cevap 15-30 saniye sürer. Bu yüzden asıl model
  olarak değil, yedek olarak uygundur.

### Kanal özeti (sağ tık → Buradan özetle)

Kanaldaki bir mesaja sağ tıklayıp **Uygulamalar** → **Buradan özetle** seçildiğinde, bot o mesajdan başlayarak kanaldaki
son konuşmaları (en fazla 100 mesaj) yapay zekâya özetletir: konuşulan konular, varılan kararlar, açık kalan sorular.
Özet yalnızca isteyene görünür.

- **Sunucu başına açılır.** Özetlenen mesajlar başkalarının yazdıklarıdır ve Google'a gönderilir; bu yüzden özellik
  varsayılan olarak kapalıdır, bir yönetici `/ayarlar` → Günlük bölümünden açar. Bot mesajları saklamaz.
- Yalnızca kanalın mesaj geçmişini okuyabilen üyeler özet alabilir; göremediği mesajların özetini bu yoldan alamaz.
- Botların ve sistemin mesajları özete katılmaz. Her mesajın en fazla 400 karakteri, toplamda en fazla 15.000
  karakter gönderilir; sığmazsa en yeni mesajlar kalır.
- Mesajlar modele "yalnızca özetlenecek veri" olarak verilir; içlerine yazılmış talimatları uygulamaması istenir.
  Model yine de kandırılabilir, ama `/sor`'daki gibi özet kimseyi etiketleyemez, başlık ve gizli bağlantı içeremez.
- Her özet, kişinin günlük `/sor` hakkından bir tane kullanır; sınırlar `/sor` ile ortaktır.
- Mesajların metnini okuyabilmek için **Message Content Intent** gerekir (`.env` içinde `MESAJ_ICERIGI=1`).

## Sunucuna ekledikten sonra

Boş bir sunucuyu baştan kurmak istiyorsan `/ayarlar` → Kurulum → **Hazır sunucu şablonu** ile başla ve amacına uyan şablonu seç (oyun, yayıncı, basit...);
günlük, hoş geldin ve bildirim kanallarını, bildirim rollerini ve temel korumayı kendisi ayarlar. Hazır bir sunucuda:

1. Sunucu Ayarları → Roller: **Voyager rolünü**, yöneteceği rollerin üstüne sürükle. Bot kendi rolünden yüksek
   kişilere işlem yapamaz ve yüksek rolleri veremez.
2. `/ayarlar` yaz; **Günlük** bölümünden günlük kanalını seç.
3. İstersen **Karşılama** bölümünden hoş geldin kanalını ve oto rolü seç.
4. **Koruma** bölümünde **Spam** düğmesine basarak otomatik korumayı aç. Ele geçirilmiş hesapların attığı
   dolandırıcılık resimlerine karşı **Görsel** denetimini de açabilirsin.
5. Gerisi için `/yardim`.

Oto rolü, ancak o rolü kendisi de verebilen biri ayarlayabilir (Rolleri Yönet yetkisi ve rol sırası). Yönetim
yetkisi taşıyan bir rol (üye atma, mesaj ya da rol yönetme gibi) oto rol yapılamaz.

## Kendi botunu çalıştırmak

Hazır botu kullanmak yerine kodu kendi Discord uygulamanla çalıştırmak istersen.

### 1. Node.js kur

<https://nodejs.org> adresinden **LTS** sürümünü indirip kur (en az 18). Kurulumdan sonra terminali kapatıp yeniden aç.

### 2. Discord'da botu oluştur

1. <https://discord.com/developers/applications> → **New Application** → bir isim ver.
2. **General Information** sayfasındaki **Application ID**'yi kopyala → `.env` içinde `CLIENT_ID`.
3. Soldan **Bot** → **Reset Token** → çıkan token'ı kopyala → `.env` içinde `DISCORD_TOKEN`.
   Token botun şifresidir; kimseyle paylaşma.
4. Aynı sayfada **Server Members Intent**'i aç (hoş geldin mesajı için gerekli).
5. Soldan **Installation** → **User Install** kutusunu kaldır, yalnızca **Guild Install** kalsın. Komutlar botun
   bulunduğu sunucular için yazıldı.

### 3. .env dosyasını hazırla

`.env.example` dosyasını kopyalayıp adını `.env` yap; `DISCORD_TOKEN` ve `CLIENT_ID` değerlerini doldur.
Diğer satırlar isteğe bağlıdır ve dosyanın içinde açıklamalıdır. Bir platformun anahtarı yoksa yalnızca o
platform kapalı kalır.

### 4. Çalıştır

```bash
npm install
```

```bash
npm run komutlar
```

```bash
npm start
```

Terminalde `Bot hazır: ...` yazısını görünce bot çalışıyor demektir.

`npm run komutlar` yalnızca komut eklediğinde ya da bir komutun adını/seçeneklerini değiştirdiğinde gerekir.
Komutlar genel yüklenir: bot hangi sunucuya eklenirse orada kendiliğinden görünür.

### 5. Botu sunucuna ekle

Bot çalışırken tarayıcıda <http://localhost:8788> adresini aç. Sayfadaki bütün **Sunucuna ekle** düğmeleri aynı
davete gider: bot, moderasyon, günlük, bildirimler, hazır sunucu şablonu ve acil kilit dahil bütün özellikleri için gereken
izinlerle eklenir. Yönetici (Administrator) izni istenmez. Davet `bot` kapsamını ve izinleri açıkça taşır;
Developer Portal'daki varsayılan kurulum ayarlarına bağlı değildir.

Sonra Discord'da `/yardim` yaz; ana sayfanın altında botun gecikmesi görünür.

### Tanıtım sayfası ve yayın webhook'ları

Bot `127.0.0.1:8788` üzerinde küçük bir HTTP sunucusu açar. Bu sunucu iki iş görür:

- **Tanıtım sayfası** (`src/site/`): başlık, özellikler, komut listesi ve "Sunucuna ekle" düğmesi.
  [voyager.helyosfer.me](https://voyager.helyosfer.me) bu sayfadır. Arka planda NASA'nın
  [Big Bang animasyonu](https://svs.gsfc.nasa.gov/12656) oynar (kaynak: NASA's Goddard Space Flight
  Center/CI Lab): patlama bir kez, ardından galaksilerin uçuştuğu kısa bir döngü. Film (`/film.mp4`) ve ilk karesi (`/film.jpg`) botun sunucusundan değil, web
  sunucusundan verilir (aşağıdaki Caddy örneği); dosyalar yoksa zemin siyah kalır.
- **Twitch ve Kick webhook'ları** (`/twitch`, `/kick`): yayın başladığında platformlar buraya haber verir.
  Gelen her istek imzasıyla doğrulanır.

Sunucu yalnızca kendi makinesinden erişilir; internete web sunucunla açarsın. Caddy örneği:

```
voyager.ornek.com {
	@film path /film.mp4 /film.jpg
	handle @film {
		root * /var/www/voyager
		header Cache-Control "public, max-age=604800"
		file_server
	}
	handle {
		reverse_proxy 127.0.0.1:8788
	}
}
```

Film dosyaları hazır olarak `vps/film/` klasöründe durur; durum ve sunucu düzeni `vps/film/README.md`'de.
Yeniden üretmek için `vps/film-hazirla.sh` (sonuç ~10 MB, 1080p, sessiz). Betik patlamayı yumuşatır,
döngüyü keser ve sayfanın sardığı saniyeye anahtar kare koyar; ayrıntılar betiğin başında:

```bash
bash vps/film-hazirla.sh            # kaynak: NASA'nın 4K dosyası, yoksa indirir
sudo mkdir -p /var/www/voyager && sudo cp film.mp4 film.jpg /var/www/voyager/
```

Film değişince `src/site/index.html`'deki `?v=` sayısını artır; yoksa tarayıcılar ve Cloudflare bir hafta
boyunca eski dosyayı verebilir.

`.env` içinde `YAYIN_ADRESI=https://voyager.ornek.com` olur; Kick uygulamasının webhook adresi
`https://voyager.ornek.com/kick` olarak girilir.

### Botu başka sunuculara açmak

Developer Portal → Bot → **Public Bot** açıksa davet linkine sahip herkes botu kendi sunucusuna ekleyebilir.
Her sunucunun ayarları, yayıncı listesi ve günlüğü ayrıdır. Bot 100 sunucuyu geçerse Discord doğrulama ister.

### Bot sahibi komutları

`/sunucular liste` ve `/sunucular ayril` yalnızca `.env` içindeki `GUILD_IDS` sunucularına yüklenir ve yalnızca
uygulamanın sahibi kullanabilir: botun bulunduğu sunucuları gösterir, istenen sunucudan çıkarır.

## VPS'te 7/24 çalıştırma (Ubuntu)

### İlk kurulum

`kur.sh` botu `/opt/voyager` altına kurar ve ayrı, yetkisiz bir kullanıcıyla `systemd` servisi olarak başlatır.
Node.js yoksa onu da kurar. Çökerse veya sunucu yeniden başlarsa bot kendiliğinden açılır.

Dosyaları sunucuya gönder (kendi bilgisayarından):

```bash
scp -r package.json package-lock.json .env.example kur.sh src KULLANICI@IP:voyager/
```

Sunucuda:

```bash
cd ~/voyager && sudo bash kur.sh
```

İlk çalıştırmada `.env` dosyasını oluşturup durur. `sudo nano /opt/voyager/.env` ile doldur,
sonra aynı komutu tekrar çalıştır.

### Güncelleme

Her güncellemede dosyaları elle kopyalamak yerine, tek komutla gönderen bir düzen kurabilirsin.

Bir kez, sunucuda (`vps/erisim-kur.sh` dosyasını ve bilgisayarında ürettiğin SSH anahtarının `.pub` dosyasını gönderdikten sonra):

```bash
sudo bash erisim-kur.sh anahtar.pub
```

Bu, yalnızca SSH anahtarıyla girebilen ve root olarak yalnızca botu güncelleyen betiği ve bot kayıtlarını
okuyan iki sabit komutu (`sudo journalctl -u voyager -n 200 --no-pager`, `sudo journalctl -u voyager -f --no-pager`)
çalıştırabilen `voyager-deploy` kullanıcısını kurar. Önce `kur.sh`'ın son sürümü çalıştırılmış olmalı. Sonra bilgisayarında `vps/.hedef` dosyasına hedefi yaz
(ör. `voyager-deploy@SUNUCU_ADRESI`; bu dosya repoya girmez) ve her güncellemede:

```bash
bash vps/gonder.sh
```

Betik commit'i değil, o an klasörde duran `src/` içeriğini gönderir; göndermeden önce klasörde ne olduğuna bak.

### İşletim

| Ne için | Komut |
|---|---|
| Canlı kayıtları izle | `sudo journalctl -u voyager -f` |
| Durumu gör | `sudo systemctl status voyager` |
| Yeniden başlat | `sudo systemctl restart voyager` |

## Güvenlik

- **Sırlar** `.env` dosyasında durur; dosya repoya girmez ve sunucuda root dışında yalnızca bot kullanıcısı okuyabilir.
  `.env` dosyasını ve bot jetonunu kimseyle paylaşma.
- **Ayarlar ve kayıtlar** `data/` klasöründedir; bu klasör de repoya girmez ve yalnızca bota açıktır.
- **Servis** (`kur.sh` ile kurulduğunda) kısıtlı çalışır: dosya sistemini salt okunur görür, yalnızca `data/` klasörüne yazabilir.
  Kod ve bağımlılıklar root'a aittir; güncellemede gönderilen kod (komut yükleme, bağımlılık kurulumu) da aynı
  kısıtlamalarla çalışır.
- **Webhook'lar** imzasıyla doğrulanır; 10 dakikadan eski mesajlar reddedilir.
- **Etiketler:** kullanıcının yazdığı metindeki `@everyone` ve rol etiketleri bildirim göndermez.
- **Mesaj içeriği** yalnızca `MESAJ_ICERIGI=1` ise okunur ve yalnızca sunucunun kendi log kanalına yazılır.
- **Yapay zekâ** çıktısına güvenilmez: cevap ve incelemeler etiketler kapalı gönderilir, bağlantılar etkisizleştirilir,
  uzunluk sınırlanır. Mağaza metni ve resimdeki yazılar modele yalnızca veri olarak verilir. Gemini anahtarı yalnızca
  istek başlığında gider.

### Bağımsız denetim (Ekim 2026)

Bot 15 Ekim 2026'da bağımsız olarak denetlendi. `npm test`'in yanında ayrı bir test takımı kullanıldı:

- **Tanıtım sayfası, gerçek tarayıcıda (Playwright).** Denenenler:
  - güvenlik başlıkları (CSP, HSTS, `nosniff`)
  - yalnızca iki yolun sunulması
  - davet bağlantılarında Yönetici izninin istenmemesi
  - hareket azaltma açıkken arka plan filmin indirilmemesi
  - mobilde taşma ve erişilebilirlik (axe)
- **`/sor` için kandırılmış model simülasyonu.** Model saldırganın istediğini aynen yazsa bile botun
  gönderdiği mesajda şunların etkisiz kaldığı denendi:
  - `@everyone` ve rol etiketleri
  - gizli bağlantı (`[yazı](adres)`)
  - sahte başlık ve botun dipnotunu taklit eden `-#` satırı
  - mesaj sınırını aşan uzunluk
- **Mutasyon kontrolü.** Şu savunmalar tek tek geçici olarak bozuldu; her birini en az bir test yakaladı:
  - etiket kapatma (`allowedMentions`)
  - gizli bağlantı kırıcı
  - `frame-ancestors`
  - tanıtım sayfasının yol beyaz listesi
  - hareket azaltma kontrolü
- **Statik analiz.** ESLint güvenlik uyarıları (dosya yolları, `require`, `new RegExp`) incelendi; hepsi
  sabit girdiyle çalışıyor. Haber ayrıştırıcısındaki düzenli ifadeler özel hazırlanmış bir beslemede
  girdinin karesiyle yavaşlayabiliyor. Ayrıştırma ayrı bir iş parçacığında 5 saniye ve 3 MB sınırıyla
  yapıldığı için bot kilitlenmiyor.
- **Bulunan ve düzeltilenler:**
  - **Güncelleme hesabından root'a yükselme (VGR-29).** Güncelleme kullanıcısı bir sembolik bağ ile root
    yetkisi alabiliyordu. Artık kod root'a ait, gönderilen dosyalar denetimli bir arşivle alınıyor ve
    güncellemede çalışan her şey servisle aynı kısıtlamalara tabi.
  - **`/sor` cevaplarında biçim taklidi.** Kandırılmış model başlık ya da botun dipnotuna benzeyen satır
    yazabiliyordu; alıntı ve liste içindekiler de dahil artık kaçırılıyor.
  - **Haber indiricinin iç ağ engel listesi.** İki eski IPv6 aralığı eksikti; eklendi.

Bilinen sınırlar:
- Yeni komutlar gerçek bir Discord sunucusunda henüz elle denenmedi ([test/DISCORD_DENEME.md](test/DISCORD_DENEME.md)).
- `/sor` modeli kendi talimatlarını yazabilir. Talimatlar zaten bu depoda açık ve gizli bilgi içermez.

Ayrıntılı kurallar ve yayından önce yapılacak kontroller: [SECURITY_PROTOCOL.md](SECURITY_PROTOCOL.md). Denetim
bulguları: [SECURITY_AUDIT.md](SECURITY_AUDIT.md). Güvenlik kurallarının testleri `npm test` ile çalışır.

Bir güvenlik sorunu bulursan herkese açık bir kayıt açmak yerine [helyosfer.me](https://helyosfer.me)
üzerindeki iletişim bilgileriyle haber ver.

## Dosya yapısı

```
kur.sh                VPS kurulum betiği
vps/
  erisim-kur.sh       Sunucuda güncelleme kullanıcısını kurar
  film-hazirla.sh     Sitenin arka plan filmini NASA videosundan hazırlar
  film/               Sitenin arka plan filmi, kaynağı ve durum notu
  gonder.sh           Kodu sunucuya gönderir ve botu yeniden başlatır
src/
  index.js            Botun başlangıç noktası
  komutlari-yukle.js  Komutları Discord'a tanıtır
  commands/           Her dosya bir komut
  ayarlar/            /ayarlar paneli: index.js (bölüm menüsü ve yönlendirme) ve her bölüm ayrı dosyada
  depo.js             Ayarları data/ klasörüne kaydeder
  yardimci.js         Yetki kontrolleri ve log gönderme
  gunluk.js           Sunucu günlüğü
  moderasyon.js       Moderasyon kartı (sağ tık → Moderasyon ve /mod uye) ve /mod alt komutları
  koruma.js           Spam koruması ve küfür filtresi
  baglanti.js         Zararlı bağlantı denetimi
  uyari.js            Uyarı kayıtları ve otomatik ceza kuralları
  rolmenu.js          Rol menüsü düğmeleri
  cekilis.js          Çekiliş başlatma formu, kart düğmeleri, zamanlayıcılar ve kazanan seçimi
  seviye.js           Seviye sistemi: XP, seviye atlama, ödül rolleri, /yardim seviye sayfası
  ozet.js             Sağ tık → Buradan özetle ile kanal özeti
  gorsel.js           Dolandırıcılık görseli denetimi
  sablonlar.js        Hazır sunucu şablonları: roller, kategoriler, kanallar, izinler, varsayılan ayarlar
  topluluk.js         Şablon kurulumu, üyelik onayı, ilgi ve bildirim rolleri, destek talepleri
  bildirim-ayar.js    /ayarlar'ın bildirim bölümleri için ortak kart: menüler, düğmeler, ekleme formu, çıkarma listesi
  kilit.js            Acil durum kilidi
  haber.js            Haber bildirimleri; haber-ayristir.js ayrı iş parçacığında çalışır
  instagram.js        Instagram gönderi bildirimleri
  yapayzeka.js        Gemini bağlantısı ve /sor
  yardim-rehberi.js   /yardim komut ve alt komut sayfalarının anlatımları, örnekleri ve notları
  yardim-gorevler.js  /yardim "Nasıl yapılır?" rehberleri ve başlangıç adımları
  sohbet.js           /sor cevabına "Yanıtla" ile devam edilen konuşmalar
  inceleme.js         Oyun fırsatı kartlarındaki yapay zekâ incelemesi
  firsatlar.js        Oyun fırsatları
  hatirlatici.js      Hatırlatıcı zamanlayıcıları
  yayin/              Yayın bildirimleri (Twitch, Kick, YouTube) ve HTTP sunucusu
  site.js, site/      Tanıtım sayfası
test/                 Güvenlik, özellik ve komut testleri (npm test), Discord deneme listesi
```

Yeni komut eklemek için `src/commands/` içine `ping.js` gibi bir dosya ekleyip `npm run komutlar` çalıştır.

## Lisans

Telif hakkı © 2026 Helyosfer.

Voyager özgür yazılımdır; [GNU Genel Kamu Lisansı sürüm 3](LICENSE) (GPL-3.0) koşullarıyla dağıtılır. Kodu
kullanabilir, değiştirebilir ve dağıtabilirsin; değiştirip dağıttığın sürümü de aynı lisansla, kaynak koduyla
birlikte paylaşman gerekir. Yazılım hiçbir garanti olmadan sunulur.
