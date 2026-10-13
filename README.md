# Voyager

Sunucunu kuran, koruyan ve haber veren bir Discord botu. Hazır topluluk sunucusu kurulumu, moderasyon, otomatik
koruma, acil durum kilidi, sunucu günlüğü; yayın, haber ve oyun fırsatı bildirimleri tek botta.

**Site:** [voyager.helyosfer.me](https://voyager.helyosfer.me) · botu sunucuna eklemek için sitedeki **Sunucuna ekle**
düğmesini kullan. `/sunucukur` ve `/kitle` kullanacaksan sayfadaki **tam izinlerle ekle** bağlantısıyla ekle.

Node.js ve [discord.js](https://discord.js.org) ile yazıldı. Kodu alıp kendi botunu da çalıştırabilirsin; adımlar
[Kendi botunu çalıştırmak](#kendi-botunu-çalıştırmak) bölümünde.

## İçindekiler

- [Neler yapar](#neler-yapar)
- [Komutlar](#komutlar)
- [Özellikler](#özellikler)
  - [Sunucu kurulumu](#sunucu-kurulumu-sunucukur)
  - [Acil durum kilidi](#acil-durum-kilidi-kitle-kilidiac)
  - [Otomatik koruma](#otomatik-koruma)
  - [Sunucu günlüğü](#sunucu-günlüğü)
  - [Canlı yayın bildirimleri](#canlı-yayın-bildirimleri)
  - [Haber bildirimleri](#haber-bildirimleri)
  - [Instagram gönderi bildirimleri](#instagram-gönderi-bildirimleri)
  - [Oyun fırsatları](#oyun-fırsatları)
- [Sunucuna ekledikten sonra](#sunucuna-ekledikten-sonra)
- [Kendi botunu çalıştırmak](#kendi-botunu-çalıştırmak)
- [VPS'te 7/24 çalıştırma](#vpste-724-çalıştırma-ubuntu)
- [Güvenlik](#güvenlik)
- [Dosya yapısı](#dosya-yapısı)
- [Lisans](#lisans)

## Neler yapar

- **Sunucu kurulumu:** tek komutla roller, kanallar, izinler, üyelik onayı ve destek sistemi.
- **Moderasyon:** yasaklama, atma, süreli susturma, toplu mesaj silme.
- **Otomatik koruma:** ele geçirilmiş hesapların spam'ini durdurur, ağır küfürleri siler.
- **Acil durum kilidi:** saldırı anında bütün kanalları kilitler, sonra eski haline döndürür.
- **Sunucu günlüğü:** üye giriş çıkışları, silinen ve düzenlenen mesajlar, ses kanalları ve yönetim işlemleri tek kanalda.
- **Canlı yayın bildirimleri:** Twitch, Kick ve YouTube'da takip ettiğin yayıncılar yayına geçince haber verir.
- **Haberler:** takip ettiğin sitelerin yeni haberlerini duyurur (RSS).
- **Instagram:** seçtiğin hesapların yeni gönderilerini duyurur (ayrıca kurulum ister).
- **Oyun fırsatları:** Steam, Epic ve GOG'daki bedava oyunları ve indirimleri Türkiye fiyatlarıyla duyurur.
- **Karşılama:** yeni üyeye hoş geldin mesajı ve otomatik rol.
- **Hatırlatıcı:** belirttiğin süre sonra seni etiketler.

Her sunucunun ayarları ayrıdır ve bir özellik açılmadıkça kapalı kalır.

Bekleme süresi bildiren mesajlardaki sayaçlar (ör. "5 dakika içinde") Discord tarafından, okuyan kişinin uygulama
diliyle gösterilir.

## Komutlar

| Komut | Ne yapar | Gereken yetki |
|---|---|---|
| `/yardim` | Tüm komutları ve ne işe yaradıklarını listeler | Herkes |
| `/ping` | Bot çalışıyor mu kontrol eder | Herkes |
| `/hatirlat` | Belirtilen süre sonra hatırlatma yapar (kişi başı en fazla 5) | Herkes |
| `/ban` | Kullanıcıyı yasaklar | Üyeleri Yasakla |
| `/unban` | Kullanıcının yasağını kaldırır | Üyeleri Yasakla |
| `/kick` | Üyeyi atar | Üyeleri At |
| `/sustur` | Üyeyi belirli dakika susturur (0 = kaldır) | Üyelere Zaman Aşımı Uygula |
| `/temizle` | Kanaldaki son 1-100 mesajı siler | Mesajları Yönet |
| `/ayarla` | Log kanalı ve kategorileri, hoş geldin kanalı, oto rol (`sifirla` ile kaldırılır) | Sunucuyu Yönet |
| `/koruma` | Otomatik spam koruması ve ağır küfür filtresi | Sunucuyu Yönet |
| `/sunucukur` | Topluluk sunucusu kurar: roller, kanallar, izinler, üyelik onayı, destek sistemi | Yönetici |
| `/kitle`, `/kilidiac` | Acil durumda bütün kanalları kilitler ve geri açar | Yönetici |
| `/yayin` | Canlı yayın bildirimlerini ayarlar (Twitch, Kick, YouTube) | Sunucuyu Yönet |
| `/haber` | Haber sitelerinin yeni haberlerini duyurur (RSS) | Sunucuyu Yönet |
| `/instagram` | Instagram hesaplarının yeni gönderilerini duyurur | Sunucuyu Yönet |
| `/oyun` | Bedava oyun ve indirim bildirimlerini ayarlar (Steam, Epic, GOG) | Sunucuyu Yönet |

Yetki gerektiren komutlar yalnızca o yetkisi olanlara görünür. `/ban`, `/kick` ve `/sustur` ayrıca rol sırasına
bakar: kendinle aynı ya da daha yüksek roldeki bir üyeye işlem yapamazsın. `/sunucukur`, `/kitle` ve `/kilidiac`
Sunucu Ayarları → Entegrasyonlar'dan başka bir role açılsa bile yalnızca Yönetici yetkisi olanlarca kullanılabilir.

## Özellikler

### Sunucu kurulumu (`/sunucukur`)

Yalnızca Yönetici yetkisi olanlar çalıştırabilir. Eksiksiz bir topluluk sunucusu kurar: 15 rol, 14 kategori, 55 kanal.
Önce ne oluşturulacağını gösterir ve onay ister. Mevcut kanal ve roller silinmez ya da değiştirilmez; aynı adda
olanlar atlanır, komut yeniden çalıştırılırsa yalnızca eksikler tamamlanır.

- **İzinler kategori düzeyinde tanımlanır** ve kanallar kategorisiyle eşitlenmiş (senkron) oluşur. Yalnızca farklı
  davranması gereken kanallar (kurallar, duyurular, bot akışları...) kendi iznini taşır.
- **Üyelik onayı:** Yeni gelenler `Yeni Gelen` rolüyle başlar ve yalnızca başlangıç ile destek kanallarını görür.
  `üyelik-onay` kanalındaki düğmeye basınca `Üye` olur, topluluk kanalları açılır.
- **İlgi rolleri:** `rol-seçimi` kanalındaki menüden seçilir.
- **Destek talepleri:** `destek-merkezi` kanalındaki düğme, yalnızca talep sahibinin ve destek ekibinin gördüğü bir oda açar.
  Kapatılan oda hemen silinmez; sahibi okuyabilir ama yazamaz. Kapalı odalar 30 gün sonra silinir; bir üyenin en fazla
  3 kapalı odası saklanır. Bir üye 10 dakikada bir talep açabilir; sunucuya yeni katılan ilk 10 dakika açamaz.
  Aynı anda en fazla 25 oda açık olabilir; sınıra gelince destek kayıt kanalına uyarı düşer.
- Günlük, hoş geldin, oyun fırsatları ve yayın kanalları botun ayarlarına kendiliğinden bağlanır.

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

### Acil durum kilidi (`/kitle`, `/kilidiac`)

`/kitle` saldırı anında bütün kanalları kilitler: sunucu sahibi dışındaki üyeler yazamaz, tepki ekleyemez, konu açamaz ve
ses kanallarına giremez. Her kanalın izinleri saklanır; `/kilidiac` hepsini kilitten önceki haline birebir döndürür.

- Kilitliyken sunucuya eklenen botlar kendiliğinden atılır.
- Yetki varsa (Üyeleri Taşı) ses kanallarındakiler çıkarılır.
- Discord kuralı gereği sunucu sahibi ve **Administrator** iznine sahip roller kanal izinlerinden etkilenmez.
- Bot bir izni ancak kendisinde de varsa kilitleyebilir; eksik olanlar komutun cevabında listelenir.
- Bir ses kanalını kilitleyebilmesi için botun o kanalda **Bağlan** izni olmalıdır. `/sunucukur` bunu kendisi verir;
  elle kurulmuş ya da eski bir kurulumdan kalan ses kanallarında izin yoksa komut o kanalları "erişimim yok" diye bildirir.
- Bot **Yönetici** olmak zorunda değildir. Kilit, botun kanalda elinde olan izinlerle uygulanır.

### Otomatik koruma

`/koruma` ile sunucu başına açılır; ikisi de varsayılan olarak kapalıdır. Mesajları Yönet yetkisi olanlar ve botlar muaftır.

| Komut | Ne yapar |
|---|---|
| `/koruma spam` | 30 saniyede 3 farklı kanala yazan, aynı içeriği 4 kez tekrarlayan ya da yetkisiz `@everyone` ile bağlantı/dosya gönderen üyenin mesajlarını siler ve üyeyi susturur (varsayılan 60 dakika) |
| `/koruma kufur` | Ağır küfür içeren mesajları siler; istenirse yazanı susturur |
| `/koruma kelime-ekle` / `kelime-cikar` | Sunucuya özel yasaklı kelime listesi |
| `/koruma goster` | Ayarları gösterir |

Spam koruması özellikle ele geçirilmiş hesapların bütün kanallara aynı görselleri atmasını hedefler; bu yüzden
üyeyi banlamaz, susturur. Küfür filtresi yalnızca ağır küfürleri yakalar ve masum kelimelere takılmamak için
bilerek dardır ("amk", "aq" gibi kısaltmalar hazır listede yoktur). Küfür filtresi için Message Content Intent gerekir.

### Sunucu günlüğü

`/ayarla log-kanali` ile seçilen kanala sunucuda olan biten yazılır. Kategoriler `/ayarla log-kategori` ile
tek tek açılıp kapatılır; hepsi varsayılan olarak açıktır.

| Kategori | Neler yazılır |
|---|---|
| Moderasyon | Ban, yasak kaldırma, kick, susturma, `/temizle` (bot komutuyla ya da elle yapılanlar) |
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
| `/yayin kanal` | Bildirim kanalını seçer |
| `/yayin ekle` | Platform ve kanal adı (ya da adresi) ile yayıncı ekler |
| `/yayin cikar` | Yayıncıyı çıkarır |
| `/yayin liste` | Takip edilenleri ve ayarları gösterir |
| `/yayin rol` | Yayın başlayınca etiketlenecek rol |
| `/yayin test` | Kanala örnek bir bildirim gönderir |
| `/yayin kapat` | Bildirimleri kapatır |

| Platform | Hız | Gereken |
|---|---|---|
| Twitch | Anında (Twitch haber verir) | Twitch geliştirici uygulaması + botun dışarıdan ulaşılan adresi |
| Kick | Anında (Kick haber verir) | Kick geliştirici uygulaması + botun dışarıdan ulaşılan adresi |
| YouTube | 1-3 dakika (dakikada bir kontrol) | YouTube Data API anahtarı |

Bir sunucu en fazla 50 yayıncı takip edebilir. Etiketlenecek rolü, ancak o rolü kendisi de etiketleyebilen biri seçebilir.

### Haber bildirimleri

`/haber` ile haber sitelerinin yeni haberleri bir kanala duyurulur (kanal, ekle, cikar, liste, rol, kapat). Sitelerin
kendi RSS/Atom beslemeleri okunur; anahtar ya da hesap gerekmez.

- `/haber ekle` sitenin adresini (ör. `webtekno.com`) ya da doğrudan RSS adresini kabul eder; site adresi verilirse besleme otomatik bulunur.
- Kaynaklar 10 dakikada bir kontrol edilir; bir kaynaktan tek seferde en fazla 3 haber duyurulur. Sunucu başına 15 kaynak.
- Kaynak eklendiğinde mevcut haberler gönderilmez, yalnızca sonradan yayınlananlar duyurulur.
- Adresi kullanıcılar verdiği için bot yalnızca herkese açık adreslere, standart portlardan bağlanır; iç ağ adresleri reddedilir.
- Bütün sunucuların takip ettiği toplam kaynak sayısı sınırlıdır; aynı kişinin sahip olduğu sunucular toplamda 30 kaynak ekleyebilir.

### Instagram gönderi bildirimleri

`/instagram` ile seçilen hesapların yeni gönderileri bir kanala duyurulur (kanal, ekle, cikar, liste, rol, test, kapat).
Sunucu başına 20 hesap. Instagram'ın resmi Business Discovery servisi kullanılır:

- Yalnızca **profesyonel** (işletme / içerik üreticisi) ve herkese açık hesaplar takip edilebilir.
- İstek sınırı bütün sunucular arasında ortak olduğu için özellik yalnızca izin verilen sunucularda açıktır:
  `.env` içindeki `INSTAGRAM_SUNUCULAR` ve `GUILD_IDS`. İkisi de boşsa her sunucuda açık olur.
- Anında değildir; hesaplar yaklaşık 5 dakikada bir kontrol edilir (hesap sayısı arttıkça aralık uzar).
- Botun sahibinin, bir Facebook Sayfasına bağlı profesyonel bir Instagram hesabı ve bir Meta geliştirici uygulaması olmalıdır.
  `.env` içinde `META_APP_ID`, `META_APP_SECRET` ve `INSTAGRAM_TOKEN` doldurulur; bot jetonu uzun ömürlüsüyle değiştirip kendisi yeniler.

### Oyun fırsatları

Bot 30 dakikada bir bedava oyunları ve mağaza indirimlerini kontrol eder, yeni çıkanları seçtiğin kanala gönderir.

| Ne | Kaynak | Fiyat |
|---|---|---|
| Bedava oyunlar | [GamerPower](https://www.gamerpower.com) | |
| Steam indirimleri | Steam'in öne çıkan indirimleri | Türkiye bölgesi (dolar) |
| Epic Games indirimleri | Epic mağaza vitrinindeki indirimli oyunlar | Türkiye bölgesi (TL) |
| GOG indirimleri | GOG'da en çok ilgi gören 15 indirim | Türkiye bölgesi (dolar) |

| Komut | Ne yapar |
|---|---|
| `/oyun kanal` | Kanalı seçer ve bildirimleri başlatır |
| `/oyun bedava` | Bedava oyunları açar/kapatır; mağaza seçer (varsayılan: Steam, Epic ve GOG) |
| `/oyun indirim` | İndirimleri açar/kapatır; mağaza (varsayılan: Steam, Epic ve GOG) ve en az indirim oranını (varsayılan: %50) belirler |
| `/oyun rol` | Fırsat geldiğinde etiketlenecek rol |
| `/oyun simdi` | Şu an yayında olan fırsatları hemen gönderir (sunucu başına 5 dakikada bir) |
| `/oyun goster` | Ayarları gösterir |
| `/oyun kapat` | Bildirimleri kapatır |

Kanal ilk seçildiğinde o an yayında olanlar gönderilmez, yalnızca sonradan çıkanlar bildirilir.

Popüler oyunlar (Steam'de en az 20.000 incelemesi olanlar) resimli büyük bir kartla, diğerleri toplu bir
listede gösterilir. Aynı oyun birden fazla mağazada indirimdeyse tek kayıtta birleştirilir. Eşik
`src/firsatlar.js` içindeki `POPULER_ESIK` değeridir.

## Sunucuna ekledikten sonra

Boş bir sunucuyu baştan kurmak istiyorsan `/sunucukur` ile başla; günlük, hoş geldin, yayın ve oyun kanallarını
kendisi bağlar. Hazır bir sunucuda:

1. Sunucu Ayarları → Roller: **Voyager rolünü**, yöneteceği rollerin üstüne sürükle. Bot kendi rolünden yüksek
   kişilere işlem yapamaz ve yüksek rolleri veremez.
2. `/ayarla log-kanali` ile günlük kanalını seç.
3. İstersen `/ayarla hosgeldin-kanali` ve `/ayarla oto-rol` ile karşılamayı aç.
4. `/koruma spam` ile otomatik korumayı aç.
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

Bot çalışırken tarayıcıda <http://localhost:8788> adresini aç. **Sunucuna ekle** düğmesi botu temel izinlerle
(moderasyon, günlük, bildirimler, oto rol) ekler; `/sunucukur` ve `/kitle` için gereken kanal yönetimi izinlerini
isteyen **tam izinlerle ekle** bağlantısı sayfanın altındadır. İki link de `bot` kapsamını ve izinleri açıkça taşır;
Developer Portal'daki varsayılan kurulum ayarlarına bağlı değildir.

Sonra Discord'da `/ping` yaz.

### Tanıtım sayfası ve yayın webhook'ları

Bot `127.0.0.1:8788` üzerinde küçük bir HTTP sunucusu açar. Bu sunucu iki iş görür:

- **Tanıtım sayfası** (`src/site/`): başlık, özellikler, komut listesi ve "Sunucuna ekle" düğmesi.
  [voyager.helyosfer.me](https://voyager.helyosfer.me) bu sayfadır. Arka planda NASA'nın
  [helyosfer animasyonu](https://svs.gsfc.nasa.gov/20363) oynar (kaynak: NASA's Goddard Space Flight Center
  Conceptual Image Lab); dosya NASA'nın sunucusundan yüklenir.
- **Twitch ve Kick webhook'ları** (`/twitch`, `/kick`): yayın başladığında platformlar buraya haber verir.
  Gelen her istek imzasıyla doğrulanır.

Sunucu yalnızca kendi makinesinden erişilir; internete web sunucunla açarsın. Caddy örneği:

```
voyager.ornek.com {
	reverse_proxy 127.0.0.1:8788
}
```

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

Bu, yalnızca SSH anahtarıyla girebilen ve root olarak tek bir şeyi (botu güncelleyen betiği) çalıştırabilen
`voyager-deploy` kullanıcısını kurar. Sonra bilgisayarında `vps/.hedef` dosyasına hedefi yaz
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

- **Sırlar** `.env` dosyasında durur; dosya repoya girmez ve sunucuda yalnızca bot kullanıcısı okuyabilir.
  `.env` dosyasını ve bot jetonunu kimseyle paylaşma.
- **Ayarlar ve kayıtlar** `data/` klasöründedir; bu klasör de repoya girmez ve yalnızca bota açıktır.
- **Servis** (`kur.sh` ile kurulduğunda) kısıtlı çalışır: dosya sistemini salt okunur görür, yalnızca `data/` klasörüne yazabilir.
- **Webhook'lar** imzasıyla doğrulanır; 10 dakikadan eski mesajlar reddedilir.
- **Etiketler:** kullanıcının yazdığı metindeki `@everyone` ve rol etiketleri bildirim göndermez.
- **Mesaj içeriği** yalnızca `MESAJ_ICERIGI=1` ise okunur ve yalnızca sunucunun kendi log kanalına yazılır.

Ayrıntılı kurallar ve yayından önce yapılacak kontroller: [SECURITY_PROTOCOL.md](SECURITY_PROTOCOL.md). Denetim
bulguları: [SECURITY_AUDIT.md](SECURITY_AUDIT.md). Güvenlik kurallarının testleri `npm test` ile çalışır.

Bir güvenlik sorunu bulursan herkese açık bir kayıt açmak yerine [helyosfer.me](https://helyosfer.me)
üzerindeki iletişim bilgileriyle haber ver.

## Dosya yapısı

```
kur.sh                VPS kurulum betiği
vps/
  erisim-kur.sh       Sunucuda güncelleme kullanıcısını kurar
  gonder.sh           Kodu sunucuya gönderir ve botu yeniden başlatır
src/
  index.js            Botun başlangıç noktası
  komutlari-yukle.js  Komutları Discord'a tanıtır
  commands/           Her dosya bir komut
  depo.js             Ayarları data/ klasörüne kaydeder
  yardimci.js         Yetki kontrolleri ve log gönderme
  gunluk.js           Sunucu günlüğü
  koruma.js           Spam koruması ve küfür filtresi
  topluluk.js         /sunucukur şablonu, üyelik onayı, ilgi rolleri, destek talepleri
  kilit.js            Acil durum kilidi
  haber.js            Haber bildirimleri; haber-ayristir.js ayrı iş parçacığında çalışır
  instagram.js        Instagram gönderi bildirimleri
  firsatlar.js        Oyun fırsatları
  hatirlatici.js      Hatırlatıcı zamanlayıcıları
  yayin/              Yayın bildirimleri (Twitch, Kick, YouTube) ve HTTP sunucusu
  site.js, site/      Tanıtım sayfası
test/                 Güvenlik testleri (npm test) ve Discord deneme listesi
```

Yeni komut eklemek için `src/commands/` içine `ping.js` gibi bir dosya ekleyip `npm run komutlar` çalıştır.

## Lisans

Telif hakkı © 2026 Helyosfer.

Voyager özgür yazılımdır; [GNU Genel Kamu Lisansı sürüm 3](LICENSE) (GPL-3.0) koşullarıyla dağıtılır. Kodu
kullanabilir, değiştirebilir ve dağıtabilirsin; değiştirip dağıttığın sürümü de aynı lisansla, kaynak koduyla
birlikte paylaşman gerekir. Yazılım hiçbir garanti olmadan sunulur.
