# Voyager

Moderasyon ve yardımcı araçlar içeren özel Discord botu (Node.js + discord.js).

## Komutlar

| Komut | Ne yapar | Gereken yetki |
|---|---|---|
| `/ping` | Bot çalışıyor mu kontrol eder | Herkes |
| `/ban` | Kullanıcıyı yasaklar | Üyeleri Yasakla |
| `/unban` | Kullanıcının yasağını kaldırır | Üyeleri Yasakla |
| `/kick` | Üyeyi atar | Üyeleri At |
| `/sustur` | Üyeyi belirli dakika susturur (0 = kaldır) | Üyelere Zaman Aşımı Uygula |
| `/temizle` | Kanaldaki son 1-100 mesajı siler | Mesajları Yönet |
| `/ayarla` | Log kanalı, hoş geldin kanalı, oto rol (`sifirla` ile kaldırılır) | Sunucuyu Yönet |
| `/hatirlat` | Belirtilen süre sonra hatırlatma yapar (kişi başı en fazla 5) | Herkes |

Ayrıca: yeni üyeye hoş geldin mesajı ve otomatik rol.

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

### 3. Sunucu ID'sini al

Discord → Ayarlar → Gelişmiş → **Geliştirici Modu**'nu aç. Sonra sunucu adına sağ tıkla →
**Sunucu ID'sini Kopyala** → `.env` içinde `GUILD_IDS`. (İki sunucu varsa virgülle ayır.)

### 4. .env dosyasını hazırla

`.env.example` dosyasını kopyalayıp adını `.env` yap ve üç değeri doldur.

### 5. Çalıştır

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

### 6. Sunucuda ilk ayarlar

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
