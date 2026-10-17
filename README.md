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
  - [Sunucu kurulumu](#sunucu-kurulumu-sunucukur)
  - [Rol menüsü](#rol-menüsü-rolmenu)
  - [Çekilişler](#çekilişler-cekilis)
  - [Seviye sistemi](#seviye-sistemi-seviye)
  - [Acil durum kilidi](#acil-durum-kilidi-kitle-kilidiac)
  - [Uyarılar](#uyarılar-uyari)
  - [Otomatik koruma](#otomatik-koruma)
  - [Sunucu günlüğü](#sunucu-günlüğü)
  - [Canlı yayın bildirimleri](#canlı-yayın-bildirimleri)
  - [Haber bildirimleri](#haber-bildirimleri)
  - [Instagram gönderi bildirimleri](#instagram-gönderi-bildirimleri)
  - [Oyun fırsatları](#oyun-fırsatları)
  - [Soru cevaplama](#soru-cevaplama-sor)
  - [Kanal özeti](#kanal-özeti-ozetle)
- [Sunucuna ekledikten sonra](#sunucuna-ekledikten-sonra)
- [Kendi botunu çalıştırmak](#kendi-botunu-çalıştırmak)
- [VPS'te 7/24 çalıştırma](#vpste-724-çalıştırma-ubuntu)
- [Güvenlik](#güvenlik)
- [Dosya yapısı](#dosya-yapısı)
- [Lisans](#lisans)

## Neler yapar

**Yapay zekâ** (Google Gemini; [ayrıntılar](#yapay-zekâ)):

- **Soru cevaplama:** `/sor` ile yapay zekâya soru sorulur; kısa, Türkçe cevap gelir. İstenirse cevabı yalnızca soran görür.
- **Kanal özeti:** `/ozetle` kanaldaki son mesajları kısa maddelerle özetler; sonradan katılan neler konuşulduğunu hemen görür.
- **Oyun incelemeleri:** popüler ve yeni oyunların fırsat kartlarına spoilersiz konu, kısa yorum, kimlere hitap
  ettiği ve 10 üzerinden puan eklenir.
- **Dolandırıcılık görseli denetimi:** "ünlü adına para dağıtılıyor, siteye gir kodu yaz" türü sahte çekiliş, kripto
  kumarhane ve bedava Nitro resimlerini, resmin içini okuyarak yakalar.

**Diğer özellikler:**

- **Sunucu kurulumu:** tek komutla roller, kanallar, izinler, üyelik onayı ve destek sistemi.
- **Moderasyon:** yasaklama, atma, süreli susturma, toplu mesaj silme; kalıcı uyarılar ve uyarı sayısına göre otomatik ceza.
- **Otomatik koruma:** ele geçirilmiş hesapların spam'ini durdurur, ağır küfürleri ve Discord/Steam taklidi zararlı bağlantıları siler.
- **Acil durum kilidi:** saldırı anında bütün kanalları kilitler, sonra eski haline döndürür.
- **Sunucu günlüğü:** üye giriş çıkışları, silinen ve düzenlenen mesajlar, ses kanalları ve yönetim işlemleri tek kanalda.
- **Canlı yayın bildirimleri:** Twitch, Kick ve YouTube'da takip ettiğin yayıncılar yayına geçince haber verir.
- **Haberler:** takip ettiğin sitelerin yeni haberlerini duyurur (RSS).
- **Instagram:** seçtiğin hesapların yeni gönderilerini duyurur (ayrıca kurulum ister).
- **Oyun fırsatları:** Steam, Epic ve GOG'daki bedava oyunları ve indirimleri Türkiye fiyatlarıyla duyurur.
- **Karşılama:** yeni üyeye hoş geldin mesajı ve otomatik rol.
- **Rol menüsü:** üyeler düğmeye basarak seçtiğin rolleri alıp bırakır.
- **Seviye sistemi:** mesaj yazdıkça XP, seviye atlayınca duyuru ve ödül rolleri, sıralama.
- **Çekiliş:** düğmeyle katılınan, süre dolunca kazananı kendiliğinden seçip duyuran çekilişler.
- **Hatırlatıcı:** belirttiğin süre sonra seni etiketler.

Her sunucunun ayarları ayrıdır ve bir özellik açılmadıkça kapalı kalır.

Bekleme süresi bildiren mesajlardaki sayaçlar (ör. "5 dakika içinde") Discord tarafından, okuyan kişinin uygulama
diliyle gösterilir.

## Komutlar

| Komut | Ne yapar | Gereken yetki |
|---|---|---|
| `/yardim` | Başlangıç adımları, "Nasıl yapılır?" rehberleri (yayın bildirimi kur, korumayı aç, haberleri konuya göre etiketle…), bölüm bölüm komutlar; her komutun ve alt komutun ayrıntılı sayfası (seçenekler, örnekler, bilmen gerekenler). `/yardim komut:ban` ya da `/yardim komut:oyun ayar` ile doğrudan açılır. Ana sayfanın altında botun gecikmesi yazar | Herkes |
| `/hatirlat` | Belirtilen süre sonra hatırlatma yapar (kişi başı en fazla 5) | Herkes |
| `/seviye` | Seviyeni ve sunucu sıralamasını gösterir; yöneticiler sistemi açar, seviye ödülü rolleri belirler | Herkes (ayarlar için Sunucuyu Yönet) |
| `/ozetle` | Kanaldaki son 10-100 mesajı yapay zekâyla özetler (sunucuda `/ayarla ozet` ile açılırsa; `/sor` hakkını kullanır) | Herkes (kanal geçmişini okuyabilen) |
| `/sor` | Yapay zekâya soru sorar (yalnızca kurulduysa; günlük hak kullanıma göre ayarlanır) | Herkes |
| `/ban` | Kullanıcıyı yasaklar | Üyeleri Yasakla |
| `/unban` | Kullanıcının yasağını kaldırır | Üyeleri Yasakla |
| `/kick` | Üyeyi atar | Üyeleri At |
| `/sustur` | Üyeyi belirli dakika susturur (0 = kaldır) | Üyelere Zaman Aşımı Uygula |
| `/temizle` | Kanaldaki son 1-100 mesajı siler | Mesajları Yönet |
| `/uyari` | Üyeye kalıcı uyarı verir; uyarı sayısına göre otomatik susturma, atma ya da yasaklama | Üyelere Zaman Aşımı Uygula (kural değiştirmek için Sunucuyu Yönet) |
| `/ayarla` | Günlük kanalı ve kategorileri, hoş geldin kanalı ve oto rol, kanal özetleri (`sifirla` ile kaldırılır) | Sunucuyu Yönet |
| `/koruma` | Otomatik spam koruması, ağır küfür filtresi, zararlı bağlantı ve dolandırıcılık görseli denetimi | Sunucuyu Yönet |
| `/cekilis` | Düğmeyle katılınan çekiliş başlatır, erken bitirir, yeniden çeker ya da iptal eder | Sunucuyu Yönet |
| `/rolmenu` | Üyelerin düğmeyle rol alıp bırakabildiği bir menü mesajı kurar (en fazla 10 rol) | Rolleri Yönet |
| `/sunucukur` | Hazır şablonla sunucu kurar (topluluk, oyun, yayıncı, basit, eğitim, yazılım, ürün desteği): roller, kanallar, izinler ve bot ayarları | Yönetici |
| `/kilit` | Acil durumda bütün kanalları kilitler (`kapat`) ve geri açar (`ac`) | Yönetici |
| `/yayin` | Canlı yayın bildirimlerini ayarlar (Twitch, Kick, YouTube) | Sunucuyu Yönet |
| `/haber` | Haber sitelerinin yeni haberlerini duyurur (RSS) | Sunucuyu Yönet |
| `/instagram` | Instagram hesaplarının yeni gönderilerini duyurur | Sunucuyu Yönet |
| `/oyun` | Bedava oyun ve indirim bildirimlerini ayarlar (Steam, Epic, GOG) | Sunucuyu Yönet |

Yetki gerektiren komutlar yalnızca o yetkisi olanlara görünür. `/ban`, `/kick`, `/sustur` ve `/uyari ver` ayrıca rol sırasına
bakar: kendinle aynı ya da daha yüksek roldeki bir üyeye işlem yapamazsın. `/sunucukur` ve `/kilit`
Sunucu Ayarları → Entegrasyonlar'dan başka bir role açılsa bile yalnızca Yönetici yetkisi olanlarca kullanılabilir.

**Ayar alt komutları:** `/oyun ayar`, `/yayin ayar`, `/haber ayar`, `/instagram ayar`, `/seviye ayar`, `/ayarla gunluk` ve
`/ayarla hosgeldin` seçeneksiz yazılırsa mevcut ayarları gösterir; seçenek verilirse yalnızca verilenler değişir, gerisi
olduğu gibi (ya da varsayılan) kalır. Bir ayarı kaldırmak için `kaldir` seçeneği kullanılır.

## Özellikler

### Yapay zekâ

Dört özellik Google'ın Gemini modelleriyle çalışır. Her biri ayrıntılı olarak kendi bölümünde anlatılır:

| Özellik | Nasıl açılır | Ayrıntılar |
|---|---|---|
| `/sor`: yapay zekâya soru sorma | Her sunucuda kendiliğinden açık | [Soru cevaplama](#soru-cevaplama-sor) |
| `/ozetle`: kanaldaki son mesajları özetleme | Sunucu başına `/ayarla ozet` ile; varsayılan olarak kapalı | [Kanal özeti](#kanal-özeti-ozetle) |
| Oyun fırsatı kartlarına inceleme ve puan | `/oyun ayar kanal:` ile fırsat bildirimleri açılınca | [Oyun fırsatları](#oyun-fırsatları) |
| Dolandırıcılık görseli denetimi (`/koruma filtre`) | Sunucu başına; varsayılan olarak kapalı | [Otomatik koruma](#otomatik-koruma) |

Ortak noktalar:

- **Yapay zekâ yanılabilir.** Bot bunu her cevabın ve her incelemenin altında söyler. Görsel denetimi yanlış alarm
  verirse susturma elle kaldırılır.
- **Ne Google'a gider:** `/sor` soruları, `/ozetle` ile özetlenen mesajlar (yazanların görünen adlarıyla), oyun incelemeleri için Steam mağaza bilgileri ve görsel denetimi açık
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

### Sunucu kurulumu (`/sunucukur`)

Yalnızca Yönetici yetkisi olanlar çalıştırabilir. Sunucuyu kullanım amacına uyan bir şablonla kurar. Şablon
seçilmezse (`/sunucukur`) hepsi açıklamalarıyla listelenir; `/sunucukur sablon:` ile doğrudan seçilebilir. Önce ne
oluşturulacağını gösterir ve onay ister. Mevcut kanal ve roller silinmez ya da değiştirilmez; aynı adda olanlar atlanır,
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
  yalnızca ilgilendikleri konularda etiketlenirler. Haber kaynaklarına sonradan `/haber ekle adres: rol:` ile konu rolü verilebilir.

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

### Rol menüsü (`/rolmenu`)

`/rolmenu` seçtiğin kanala başlık, açıklama ve her rol için bir düğme içeren bir mesaj koyar. Üye düğmeye basınca
rolü alır, yeniden basınca bırakır. `tek-secim` açıksa üye o menüden yalnızca bir rol taşıyabilir; yenisini seçince
eskisi bırakılır (renk ya da takım rolleri için). Menüyü kaldırmak için mesajı silmek yeterlidir; bot ayrıca bir kayıt
tutmaz, hangi rollerin menüde olduğunu mesajın düğmelerinden okur.

- Menüye oto rolle aynı kurallar uygulanır: yönetim yetkisi taşıyan (ör. üye atma, mesaj ya da rol yönetme), botun
  rolünden yüksek ya da menüyü kuranın kendisinin veremeyeceği roller eklenemez.
- Menü kurulduktan sonra role yönetim yetkisi verilirse ya da rol botun üstüne taşınırsa düğme o rolü vermez.
- Bot için **Rolleri Yönet** izni gerekir.

### Çekilişler (`/cekilis`)

| Komut | Ne yapar |
|---|---|
| `/cekilis baslat` | Ödül, süre (en fazla 14 gün), kazanan sayısı (en fazla 20) ve isteğe bağlı rol şartıyla çekiliş başlatır |
| `/cekilis bitir` | Çekilişi süresi dolmadan bitirir ve kazananları seçer |
| `/cekilis yeniden` | Biten çekilişte daha önce kazanmamış katılımcılar arasından yeniden seçer |
| `/cekilis iptal` | Çekilişi kimseyi seçmeden iptal eder |

- Üyeler mesajdaki **Katıl** düğmesiyle katılır, yeniden basınca çekilir. Süre dolunca kazananlar rastgele seçilir,
  mesaj güncellenir ve kanalda yalnızca kazananlar etiketlenerek duyurulur.
- Kazananlar yalnızca hâlâ sunucuda olan katılımcılar arasından seçilir.
- Çekilişler kaydedilir; bot yeniden başlarsa süren çekilişler kaldığı yerden devam eder. Biten çekilişler yeniden
  çekiliş için 7 gün saklanır.
- Bir sunucuda aynı anda en fazla 10 çekiliş sürebilir; bir çekilişe en fazla 5.000 kişi katılabilir.
- `bitir`, `yeniden` ve `iptal` çekiliş mesajının bağlantısını (Mesaj → Bağlantıyı Kopyala) ya da kimliğini ister.

### Seviye sistemi (`/seviye`)

`/seviye ayar durum:Açık` ile sunucu başına açılır; varsayılan olarak kapalıdır.

| Komut | Ne yapar |
|---|---|
| `/seviye goster` | Seviyeni (ya da başka bir üyenin seviyesini), sırasını ve sonraki seviyeye kalan XP'yi gösterir |
| `/seviye siralama` | En yüksek seviyedeki 10 üyeyi gösterir |
| `/seviye ayar` | Ayarları gösterir; sistemi açar, kapatır, seviye duyurularının yapılacağı kanalı seçer |
| `/seviye odul` | Bir seviyeye ulaşanlara verilecek rolü belirler (en fazla 10 ödül); rol boş bırakılırsa o seviyenin ödülünü kaldırır |
| `/seviye sifirla` | Bir üyenin XP'sini sıfırlar |

- Üye her mesajda 15-25 XP kazanır, ama dakikada en fazla bir kez; art arda yazmak XP kazandırmaz. Botlar ve
  webhook'lar XP kazanmaz. Seviye atlamak giderek zorlaşır (0→1: 100 XP, 9→10: 1.005 XP).
- Otomatik korumanın sildiği mesajlar (spam, küfür, zararlı bağlantı) XP kazandırmaz. Görsel denetiminin kararı
  30-60 saniye sürdüğü için onun sildiği mesajlar bu kurala girmez.
- Mesajların içeriği okunmaz, yalnızca yazıldıkları bilinir; Message Content Intent gerekmez.
- Seviye atlayan, mesajı yazdığı kanalda (ya da seçilen duyuru kanalında) etiketlenerek duyurulur.
- Ödül rollerine oto rolle aynı kurallar uygulanır: yönetim yetkisi taşıyan, botun rolünden yüksek ya da ödülü
  ekleyenin kendisinin veremeyeceği roller ödül yapılamaz. Rol sonradan yönetim yetkisi alırsa verilmez.
  Ödül eklenmeden önce o seviyeyi geçmiş üyeler rolü bir sonraki seviye atlayışlarında alır.
- `ayar`, `odul` ve `sifirla` Sunucuyu Yönet yetkisi ister. Sistem kapatılınca XP silinmez.
- XP her mesajda diske yazılmaz; dakikada bir ve bot kapanırken kaydedilir. Bot çökerse en fazla son dakikanın
  XP'si kaybolur.

### Acil durum kilidi (`/kilit`)

`/kilit kapat` saldırı anında bütün kanalları kilitler: sunucu sahibi dışındaki üyeler yazamaz, tepki ekleyemez, konu açamaz ve
ses kanallarına giremez. Her kanalın izinleri saklanır; `/kilit ac` hepsini kilitten önceki haline birebir döndürür.

- Kilitliyken sunucuya eklenen botlar kendiliğinden atılır.
- Yetki varsa (Üyeleri Taşı) ses kanallarındakiler çıkarılır.
- Discord kuralı gereği sunucu sahibi ve **Administrator** iznine sahip roller kanal izinlerinden etkilenmez.
- Bot bir izni ancak kendisinde de varsa kilitleyebilir; eksik olanlar komutun cevabında listelenir.
- Bir ses kanalını kilitleyebilmesi için botun o kanalda **Bağlan** izni olmalıdır. `/sunucukur` bunu kendisi verir;
  elle kurulmuş ya da eski bir kurulumdan kalan ses kanallarında izin yoksa komut o kanalları "erişimim yok" diye bildirir.
- Bot **Yönetici** olmak zorunda değildir. Kilit, botun kanalda elinde olan izinlerle uygulanır.

### Uyarılar (`/uyari`)

Moderatörlerin verdiği uyarılar kalıcı olarak saklanır; bot yeniden başlasa da kaybolmaz.

| Komut | Ne yapar |
|---|---|
| `/uyari ver` | Üyeye sebebiyle birlikte uyarı verir; üyeye özel mesajla da bildirilir |
| `/uyari liste` | Üyenin uyarılarını numaralarıyla gösterir (yalnızca komutu kullanan görür) |
| `/uyari sil` | Tek bir uyarıyı (`numara`) ya da bütün uyarıları (`hepsi:True`) siler |
| `/uyari kural` | Seçeneksiz kuralları gösterir. `esik` ve `islem` ile uyarı sayısı bir eşiğe gelince uygulanacak işlemi belirler: susturma, atma ya da yasaklama; `islem:Kuralı kaldır` kuralı siler (değiştirmek Sunucuyu Yönet ister) |

- Kural, üyenin uyarı sayısı **tam** eşiğe geldiğinde bir kez uygulanır (ör. 3. uyarıda 1 gün susturma, 5. uyarıda
  atma). En fazla 5 kural olabilir; eşik en fazla 20'dir. Bir üyenin en fazla 50 uyarısı saklanır.
- Kural bot üzerinden yetki aşmaya yaramaz: uyarıyı veren yetkili kuralın işlemini kendisi yapamıyorsa (ör. yalnızca
  susturma yetkisi varken atma kuralı) işlem uygulanmaz, bu durum cevapta ve günlükte söylenir. Kural ekleyen de
  işlemi kendisi yapabiliyor olmalıdır.
- Uyarılar, susturma gibi rol sırasına bakar: kendinle aynı ya da daha yüksek roldeki üyeye uyarı veremezsin.
- Verilen, silinen ve temizlenen uyarılar günlüğün Moderasyon kategorisine yazılır.

### Otomatik koruma

`/koruma filtre tur:<filtre> durum:Açık` ile sunucu başına açılır; hepsi varsayılan olarak kapalıdır. Mesajları Yönet
yetkisi olanlar ve botlar muaftır. `/koruma filtre` yalnızca tür seçilerek yazılırsa bütün ayarları gösterir; `durum`
verilmeden yalnızca susturma süresi gibi ayarlar değiştirilebilir.

| Filtre (`tur`) | Ne yapar |
|---|---|
| Spam | 30 saniyede 3 farklı kanala yazan, aynı içeriği 4 kez tekrarlayan ya da yetkisiz `@everyone` ile bağlantı/dosya gönderen üyenin mesajlarını siler ve üyeyi susturur (varsayılan 60 dakika) |
| Küfür | Ağır küfür içeren mesajları siler; istenirse yazanı susturur |
| Dolandırıcılık görseli | Dolandırıcılık resimlerini (ünlü adına para dağıtma, kripto kumarhane bonusu, bedava Nitro vb.) yapay zekâyla yakalar; mesajı siler, atanı susturur (varsayılan 1 gün), günlüğe kanıtıyla yazar. `kapsam` ile yalnızca riskli ya da bütün resimler |
| Zararlı ve sahte bağlantı | Discord, Steam, Epic Games, Roblox ve Twitch'i taklit eden alanları, yanıltıcı bağlantıları ve bedava Nitro alanlarını siler; atanı susturur (varsayılan 60 dakika). `kisaltici:True` ile kısaltılmış bağlantıları (bit.ly vb.) da siler |

| Komut | Ne yapar |
|---|---|
| `/koruma kelime` | Sunucuya özel yasaklı kelime ekler (`islem:Çıkar` ile çıkarır) |
| `/koruma alan` | Bağlantı denetimi için sunucuya özel engel ve izin listesi (alt alan adları da kapsanır) |
| `/koruma goster` | Ayarları gösterir |

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
  (`discordbotlist.com`, `discord.js.org`) yakalanmaz. Yine de yanlış alarm olursa alan `/koruma alan islem:İzin ver`
  ile izin listesine eklenir. Bilinen her zararlı alanı tanımaz; gördüğün bir alanı `/koruma alan islem:Engelle` ile ekle.
- Mesajı düzenleyerek bağlantı eklemek de yakalanır. Message Content Intent gerekir.

**Görsel denetimi** metin filtrelerinin göremediği, resmin içindeki dolandırıcılığı yakalar:

- Resimler indirilir (yalnızca Discord'un kendi sunucularından, en fazla 8 MB ve mesaj başına 4 resim) ve parmak izi
  çıkarılır. Daha önce yakalanmış bir resim yeniden atılırsa yapay zekâya sorulmadan anında silinir; bu saldırılarda
  aynı resim art arda birçok kanala atıldığı için ilk mesajdan sonrakiler beklemeden temizlenir.
- Varsayılan kapsam **riskli** mesajlardır: yeni üyeler (son 7 gün), bağlantı ya da toplu etiket içeren mesajlar,
  tek mesajda birden fazla resim ve aynı resmin birden fazla kanala atılması. `kapsam: Bütün resimler` ile hepsi denetlenir.
- Model en az %70 emin olduğunda işlem yapılır: mesaj ve aynı kişinin aynı resimli son mesajları silinir, kişi
  susturulur, kanala kısa bir uyarı yazılır, günlüğe sebep ve bulanık kanıt resmi düşer. Banlamaz; bu hesaplar
  çoğu zaman sahibinin elinden çalınmıştır.
- Denetlenen resimler Google'a gönderilir. Model yanılabilir; yanlış alarmda susturma elle kaldırılır.
- Model `.env` içindeki `GEMINI_GORSEL_MODEL` ile seçilir (önerilen: Gemma; yavaştır ama günlük sınırı yüksektir).
  Karar Gemma ile 30-70 saniye sürebilir. Botun tamamı için günlük denetim sayısı `GEMINI_GORSEL_GUNLUK` ile
  sınırlanır (Gemma'da varsayılan 1.000, diğer modellerde 60); bir sunucu günde en fazla 200 denetim kullanır.

### Sunucu günlüğü

`/ayarla gunluk kanal:` ile seçilen kanala sunucuda olan biten yazılır. Kategoriler `/ayarla gunluk kategori: durum:` ile
tek tek açılıp kapatılır (kategori seçilmezse hepsine uygulanır); hepsi varsayılan olarak açıktır.

| Kategori | Neler yazılır |
|---|---|
| Moderasyon | Ban, yasak kaldırma, kick, susturma, uyarılar, `/temizle` (bot komutuyla ya da elle yapılanlar) |
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

| Komut | Ne yapar |
|---|---|
| `/yayin ekle` | Platform ve kanal adı (ya da adresi) ile yayıncı ekler; isteğe bağlı olarak o yayıncıya özel etiket rolü |
| `/yayin cikar` | Yayıncıyı çıkarır (yazarken takip edilenler önerilir) |
| `/yayin ayar` | Seçeneksiz: takip edilenler ve ayarlar. `kanal`, `rol` (genel ya da `yayinci` ile o yayıncının), `kaldir`, `test:True` (örnek bildirim) |

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

`/haber` ile haber sitelerinin yeni haberleri bir kanala duyurulur (`ekle`, `cikar`, `ayar`). Sitelerin
kendi RSS/Atom beslemeleri okunur; anahtar ya da hesap gerekmez.

- **Konuya göre etiket:** her kaynağın kendi rolü olabilir (`/haber ekle adres: rol:` ya da `/haber ayar kaynak: rol:`).
  Örneğin oyun sitelerine `@Oyun Haberleri`, teknoloji sitelerine `@Teknoloji Haberleri` verilir; üyeler bu rolleri rol
  menüsünden alır ve yalnızca ilgilendikleri haberlerde etiketlenir. Kendi rolü olmayan kaynak genel haber rolünü kullanır.

- `/haber ekle` sitenin adresini (ör. `webtekno.com`) ya da doğrudan RSS adresini kabul eder; site adresi verilirse besleme otomatik bulunur.
- Kaynaklar 10 dakikada bir kontrol edilir; bir kaynaktan tek seferde en fazla 3 haber duyurulur. Sunucu başına 15 kaynak.
- Kaynak eklendiğinde mevcut haberler gönderilmez, yalnızca sonradan yayınlananlar duyurulur.
- Adresi kullanıcılar verdiği için bot yalnızca herkese açık adreslere, standart portlardan bağlanır; iç ağ adresleri reddedilir.
- Bütün sunucuların takip ettiği toplam kaynak sayısı sınırlıdır; aynı kişinin sahip olduğu sunucular toplamda 30 kaynak ekleyebilir.

### Instagram gönderi bildirimleri

`/instagram` ile seçilen hesapların yeni gönderileri bir kanala duyurulur (`ekle`, `cikar`, `ayar`); her hesabın kendi etiket rolü olabilir.
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

| Komut | Ne yapar |
|---|---|
| `/oyun ayar` | Seçeneksiz ayarları gösterir; seçenek verilirse yalnızca onları değiştirir (aşağıda) |
| `/oyun simdi` | Şu an yayında olan fırsatları hemen gönderir (sunucu başına 5 dakikada bir) |

| `/oyun ayar` seçeneği | Ne yapar |
|---|---|
| `kanal` | Kanalı seçer ve bildirimleri başlatır |
| `bedava`, `bedava-magaza` | Bedava oyunları açar/kapatır; mağaza seçer (varsayılan: açık; Steam, Epic ve GOG) |
| `indirim`, `indirim-magaza`, `en-az-yuzde` | İndirimleri açar/kapatır; mağaza ve en az indirim oranı (varsayılan: açık; Steam, Epic ve GOG; %50) |
| `rol` | Fırsat geldiğinde etiketlenecek rol |
| `everyone` | Önemli fırsatlarda @everyone atılsın mı (en fazla 6 saatte bir; arada gelenlerde rol etiketlenir). Botta **@everyone, @here ve Tüm Rollerden Bahset** izni olmalı |
| `kaldir` | Rol etiketlemesini kaldırır ya da bildirimleri kapatır |

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

### Kanal özeti (`/ozetle`)

`/ozetle` bulunduğun kanalın son mesajlarını (varsayılan 50, `adet` ile 10-100) yapay zekâya özetletir: konuşulan
konular, varılan kararlar, açık kalan sorular. Özet varsayılan olarak yalnızca isteyene görünür; `paylas` seçeneğiyle
kanala yazılır.

- **Sunucu başına açılır.** Özetlenen mesajlar başkalarının yazdıklarıdır ve Google'a gönderilir; bu yüzden özellik
  varsayılan olarak kapalıdır, bir yönetici `/ayarla ozet durum:Açık` ile açar. Bot mesajları saklamaz.
- Yalnızca kanalın mesaj geçmişini okuyabilen üyeler özet alabilir; göremediği mesajların özetini bu yoldan alamaz.
- Botların ve sistemin mesajları özete katılmaz. Her mesajın en fazla 400 karakteri, toplamda en fazla 15.000
  karakter gönderilir; sığmazsa en yeni mesajlar kalır.
- Mesajlar modele "yalnızca özetlenecek veri" olarak verilir; içlerine yazılmış talimatları uygulamaması istenir.
  Model yine de kandırılabilir, ama `/sor`'daki gibi özet kimseyi etiketleyemez, başlık ve gizli bağlantı içeremez.
- Her özet, kişinin günlük `/sor` hakkından bir tane kullanır; sınırlar `/sor` ile ortaktır.
- Mesajların metnini okuyabilmek için **Message Content Intent** gerekir (`.env` içinde `MESAJ_ICERIGI=1`).

## Sunucuna ekledikten sonra

Boş bir sunucuyu baştan kurmak istiyorsan `/sunucukur` ile başla ve amacına uyan şablonu seç (oyun, yayıncı, basit...);
günlük, hoş geldin ve bildirim kanallarını, bildirim rollerini ve temel korumayı kendisi ayarlar. Hazır bir sunucuda:

1. Sunucu Ayarları → Roller: **Voyager rolünü**, yöneteceği rollerin üstüne sürükle. Bot kendi rolünden yüksek
   kişilere işlem yapamaz ve yüksek rolleri veremez.
2. `/ayarla gunluk kanal:` ile günlük kanalını seç.
3. İstersen `/ayarla hosgeldin kanal: oto-rol:` ile karşılamayı aç.
4. `/koruma filtre tur:Spam durum:Açık` ile otomatik korumayı aç. Ele geçirilmiş hesapların attığı dolandırıcılık
   resimlerine karşı `tur:Dolandırıcılık görseli` ile görsel denetimini de açabilirsin.
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
davete gider: bot, moderasyon, günlük, bildirimler, `/sunucukur` ve `/kilit` dahil bütün özellikleri için gereken
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
Yeniden üretmek için `vps/film-hazirla.sh` (sonuç ~9 MB, 1080p, sessiz). Betik patlamayı yumuşatır,
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
  depo.js             Ayarları data/ klasörüne kaydeder
  yardimci.js         Yetki kontrolleri ve log gönderme
  gunluk.js           Sunucu günlüğü
  koruma.js           Spam koruması ve küfür filtresi
  baglanti.js         Zararlı bağlantı denetimi
  uyari.js            Uyarı kayıtları ve otomatik ceza kuralları
  rolmenu.js          Rol menüsü düğmeleri
  cekilis.js          Çekiliş kayıtları, zamanlayıcıları ve kazanan seçimi
  seviye.js           Seviye sistemi: XP, seviye atlama, ödül rolleri
  gorsel.js           Dolandırıcılık görseli denetimi
  sablonlar.js        /sunucukur şablonları: roller, kategoriler, kanallar, izinler, varsayılan ayarlar
  topluluk.js         /sunucukur kurulumu, üyelik onayı, ilgi ve bildirim rolleri, destek talepleri
  bildirim-ayar.js    /oyun, /yayin, /haber, /instagram ayar alt komutlarının ortak kanal ve rol denetimi
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
