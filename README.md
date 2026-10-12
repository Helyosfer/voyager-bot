# Voyager

Moderasyon ve yardımcı araçlar içeren özel Discord botu (Node.js + discord.js).

## Komutlar

| Komut | Ne yapar | Gereken yetki |
|---|---|---|
| `/yardim` | Tüm komutları ve ne işe yaradıklarını listeler | Herkes |
| `/ping` | Bot çalışıyor mu kontrol eder | Herkes |
| `/ban` | Kullanıcıyı yasaklar | Üyeleri Yasakla |
| `/unban` | Kullanıcının yasağını kaldırır | Üyeleri Yasakla |
| `/kick` | Üyeyi atar | Üyeleri At |
| `/sustur` | Üyeyi belirli dakika susturur (0 = kaldır) | Üyelere Zaman Aşımı Uygula |
| `/temizle` | Kanaldaki son 1-100 mesajı siler | Mesajları Yönet |
| `/ayarla` | Log kanalı ve kategorileri, hoş geldin kanalı, oto rol (`sifirla` ile kaldırılır) | Sunucuyu Yönet |
| `/hatirlat` | Belirtilen süre sonra hatırlatma yapar (kişi başı en fazla 5) | Herkes |
| `/koruma` | Otomatik spam koruması ve ağır küfür filtresi | Sunucuyu Yönet |
| `/yayin` | Canlı yayın bildirimlerini ayarlar (Twitch, Kick, YouTube) | Sunucuyu Yönet |
| `/oyun` | Bedava oyun ve indirim bildirimlerini ayarlar (Steam, Epic, GOG) | Sunucuyu Yönet |

Ayrıca: yeni üyeye hoş geldin mesajı ve otomatik rol.

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

Anahtarlar `.env` dosyasına yazılır (`.env.example` içinde açıklamalı). Bir platformun anahtarı yoksa yalnızca
o platform kapalı kalır.

Twitch ve Kick için bot `127.0.0.1:8788` üzerinde küçük bir HTTP sunucusu açar; bunu web sunucunla dışarı
açman gerekir. Caddy örneği:

```
voyager.ornek.com {
	reverse_proxy 127.0.0.1:8788
}
```

`.env` içinde `YAYIN_ADRESI=https://voyager.ornek.com` olur; Kick uygulamasının webhook adresi
`https://voyager.ornek.com/kick` olarak girilir. Gelen her istek imzasıyla doğrulanır.

### Tanıtım sayfası

Bot, yayın webhook'ları için açtığı HTTP sunucusunun ana adresinde tek sayfalık bir tanıtım sitesi de verir
(`src/site/`): başlık, özellikler ve "Sunucuna ekle" düğmesi. Düğmenin linki `bot` kapsamını ve gereken izinleri
açıkça taşır, Developer Portal'daki varsayılan kurulum ayarlarına bağlı değildir. Arka planda NASA'nın
[helyosfer animasyonu](https://svs.gsfc.nasa.gov/20363) oynar (kaynak: NASA's Goddard Space Flight Center
Conceptual Image Lab); dosya NASA'nın sunucusundan yüklenir.

### Bot sahibi komutları

`/sunucular liste` ve `/sunucular ayril` yalnızca `.env` içindeki `GUILD_IDS` sunucularına yüklenir ve yalnızca
uygulamanın sahibi kullanabilir: botun bulunduğu sunucuları gösterir, istenen sunucudan çıkarır.

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
| `/oyun simdi` | Şu an yayında olan fırsatları hemen gönderir |
| `/oyun goster` | Ayarları gösterir |
| `/oyun kapat` | Bildirimleri kapatır |

Kanal ilk seçildiğinde o an yayında olanlar gönderilmez, yalnızca sonradan çıkanlar bildirilir.

Popüler oyunlar (Steam'de en az 20.000 incelemesi olanlar) resimli büyük bir kartla, diğerleri toplu bir
listede gösterilir. Aynı oyun birden fazla mağazada indirimdeyse tek kayıtta birleştirilir. Eşik
`src/firsatlar.js` içindeki `POPULER_ESIK` değeridir.

## Kurulum

### 1. Node.js kur

<https://nodejs.org> adresinden **LTS** sürümünü indirip kur. Kurulumdan sonra terminali kapatıp yeniden aç.

### 2. Discord'da botu oluştur

1. <https://discord.com/developers/applications> → **New Application** → bir isim ver.
2. **General Information** sayfasındaki **Application ID**'yi kopyala → `.env` içinde `CLIENT_ID`.
3. Soldan **Bot** → **Reset Token** → çıkan token'ı kopyala → `.env` içinde `DISCORD_TOKEN`.
   Token botun şifresidir; kimseyle paylaşma.
4. Aynı sayfada **Server Members Intent**'i aç (hoş geldin mesajı için gerekli).
5. Soldan **Installation** → *Guild Install* altında scope olarak `bot` ve `applications.commands` seç.
   Bot izinleri: Ban Members, Kick Members, Moderate Members, Manage Messages, Manage Roles,
   View Channels, Send Messages, Embed Links, Read Message History.
6. Oluşan davet linkini tarayıcıda aç ve botu sunucuya ekle.

### 3. .env dosyasını hazırla

`.env.example` dosyasını kopyalayıp adını `.env` yap; `DISCORD_TOKEN` ve `CLIENT_ID` değerlerini doldur.
Komutlar genel yüklenir: bot hangi sunucuya eklenirse orada kendiliğinden görünür, sunucu ID'si gerekmez.

### Botu başka sunuculara açmak

Developer Portal → Bot → **Public Bot** açıksa davet linkine sahip herkes botu kendi sunucusuna ekleyebilir.
Her sunucunun ayarları, yayıncı listesi ve günlüğü ayrıdır. Bot 100 sunucuyu geçerse Discord doğrulama ister.

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

Terminalde `Bot hazır: ...` yazısını görünce Discord'da `/ping` yaz.

`npm run komutlar` sadece komut eklediğinde veya komutun adını/seçeneklerini değiştirdiğinde gerekir.

### 5. Sunucuda ilk ayarlar

- Sunucu Ayarları → Roller: **botun rolünü**, yöneteceği rollerin üstüne sürükle.
  (Bot, kendi rolünden yüksek kişilere işlem yapamaz ve yüksek rolleri veremez.)
- `/ayarla log-kanali`, `/ayarla hosgeldin-kanali`, `/ayarla oto-rol`

## VPS'te 7/24 çalıştırma (Ubuntu)

`kur.sh` botu `/opt/voyager` altına kurar, ayrı bir kullanıcıyla `systemd` servisi olarak başlatır.
Çökerse veya sunucu yeniden başlarsa bot kendiliğinden açılır.

Dosyaları sunucuya gönder (kendi bilgisayarından):

```bash
scp -r package.json .env.example kur.sh src KULLANICI@IP:voyager/
```

Sunucuda:

```bash
cd ~/voyager && sudo bash kur.sh
```

İlk çalıştırmada `.env` dosyasını oluşturup durur. `sudo nano /opt/voyager/.env` ile doldur,
sonra aynı komutu tekrar çalıştır. Kodu güncellediğinde de aynı iki adımı tekrarlaman yeterli.

| Ne için | Komut |
|---|---|
| Canlı kayıtları izle | `sudo journalctl -u voyager -f` |
| Durumu gör | `sudo systemctl status voyager` |
| Yeniden başlat | `sudo systemctl restart voyager` |

## Dosya yapısı

```
kur.sh                VPS kurulum betiği
src/
  index.js            Botun başlangıç noktası
  komutlari-yukle.js  Komutları Discord'a tanıtır
  depo.js             Ayarları data/ klasörüne kaydeder
  yardimci.js         Yetki kontrolü ve log gönderme
  hatirlatici.js      Hatırlatıcı zamanlayıcıları
  commands/           Her dosya bir komut
```

Yeni komut eklemek için `src/commands/` içine `ping.js` gibi bir dosya ekleyip `npm run komutlar` çalıştır.
