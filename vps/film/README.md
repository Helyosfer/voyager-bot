# Sitenin arka plan filmi: durum ve devir notu

voyager.helyosfer.me'nin giriş bölümünde NASA'nın Big Bang animasyonu oynar: patlama bir kez, ardından
galaksilerin uçuştuğu 6 saniyelik döngü. Bu klasör filmi ve kaynağını tutar; filmi `vps/film-hazirla.sh`
üretir (ayrıntılar betiğin başında).

| Dosya | Ne |
|---|---|
| `film.mp4` | Sitedeki film: 1920x1080, 30 fps, 13.5 sn, sessiz, H.264 High level 4.0 (~4 MB) |
| `film.jpg` | Filmin ilk karesi; film inene kadar poster olarak görünür |
| `kaynak-bigbang.mp4` | Animasyonun ilk 15 saniyesi, 1080p60, yeniden kodlanmadan kesildi (film bundan üretilir) |

Kaynak: [NASA SVS 12656](https://svs.gsfc.nasa.gov/12656), NASA's Goddard Space Flight Center/CI Lab
(NASA içeriği, kaynak göstererek serbestçe kullanılabilir; sayfanın altındaki satır bunu yapar).
`kaynak-bigbang.mp4` bu animasyonun YouTube'daki bir kopyasından alındı; kopyanın 27. saniyeden sonraki,
yükleyene ait "Thanks for watching" ekranı dışarıda bırakıldı. NASA'nın orijinal 4K dosyası
(`12656_Big_Bang_4k.m4v`, 93.5 MB) kullanılacaksa önce zamanlamayı karşılaştır: `film-hazirla.sh`'taki
süreler, patlamanın en parlak anı ~3. saniyede olan bu sürüme göre ayarlı.

## Sunucudaki düzen

- **Caddy:** `/etc/caddy/sites/voyager.caddy`. `/film.mp4` ve `/film.jpg` istekleri
  `/var/www/voyager/` klasöründen doğrudan verilir (`Cache-Control: public, max-age=604800`); geri kalan
  her şey `127.0.0.1:8788`'deki bota gider. Blok README'deki Caddy örneğinin aynısı.
- **Film dosyaları:** `/var/www/voyager/film.mp4` ve `film.jpg`. Eski helyosfer filminin yedeği
  `/root/film-yedek/`.
- **Bot:** `/opt/voyager` (kur.sh düzeni). Kod `/home/voyager-deploy/voyager/` klasörüne konur ve
  `/usr/local/sbin/voyager-guncelle` ile alınıp bot yeniden başlatılır (vps/erisim-kur.sh).
- **Cloudflare:** alan adı proxy'li. Film adresleri `index.html`'de `?v=N` ile verilir; film değişince N
  artırılmazsa tarayıcılar ve Cloudflare eski dosyayı bir hafta boyunca verebilir.

## Durum (17 Ekim 2026)

- **Canlıda:** `?v=3` filmi. Ziyaretçi filmin takılarak oynadığını ("dona dona") söyledi.
- **Bu dalda hazır, canlıda değil:** takılma için iki düzeltme ve `?v=4`.
  1. **Film yeniden kodlandı.** Canlıdaki film `-preset veryslow` ile 1080p'de 16 referans kare ve
     H.264 level 5.1 kullanıyor. Birçok ekran kartı bunu donanımda çözemez; tarayıcı işlemcide çözmeye
     düşer ve kare atlar. Yeni film level 4.0, en fazla 3 referans ve 3 B karesi kullanıyor.
     Görüntü aynı (SSIM 0.989).
  2. **Döngü durmadan sarıyor.** Eskiden film bitince (`ended`) 7.5. saniyeye sarılıp yeniden
     başlatılıyordu; bu her 6 sn'de kısa bir donma yaratabilir. `film.js` artık
     `requestVideoFrameCallback` ile son 0.1 sn'ye gelince, film durmadan sarıyor; `ended` yedek olarak
     duruyor. Headless Chromium'da (VP9 kopyayla) üç tur boyunca hiç `ended` olmadan sardığı görüldü.
  Takılmanın gerçek sebebi ziyaretçinin tarayıcısında ölçülmedi; bu iki değişiklik en olası iki sebebi
  hedefliyor.
- **Dal `main`'e birleştirilmedi** (`claude/gifted-hamilton-3krezm`). `main`'den yayına alınırsa site
  eski NASA helyosfer filmine (doğrudan NASA'nın sunucusundan, yavaş) döner.

## v=4'ü yayına almak (sunucuda, root)

Önce film, sonra kod; ikisi aynı anda yayına girmeli (kod `?v=4` ister, aynı dosya adını kullanır).

```bash
rm -rf /tmp/voyager-yeni
git clone --depth 1 -b claude/gifted-hamilton-3krezm https://github.com/Helyosfer/voyager-bot /tmp/voyager-yeni

# Film
echo "fd251943a9573ad8ce6c18e1ee606fb33929c6171d4acab70ddce4407ff3d4ff  /tmp/voyager-yeni/vps/film/film.mp4" | sha256sum -c \
  && cp /tmp/voyager-yeni/vps/film/film.mp4 /tmp/voyager-yeni/vps/film/film.jpg /var/www/voyager/ \
  && chmod 644 /var/www/voyager/*

# Kod
rm -rf /home/voyager-deploy/voyager/src
cp -r /tmp/voyager-yeni/src /tmp/voyager-yeni/package.json /tmp/voyager-yeni/package-lock.json /home/voyager-deploy/voyager/
chown -R voyager-deploy:voyager-deploy /home/voyager-deploy/voyager
/usr/local/sbin/voyager-guncelle
rm -rf /tmp/voyager-yeni

# Kontrol: content-length 4137015 ve data-src="/film.mp4?v=4"
curl -sI "https://voyager.helyosfer.me/film.mp4?v=4" | grep -iE '^(content-length|cf-cache-status)'
curl -s https://voyager.helyosfer.me/ | grep -o 'data-src="[^"]*"'
```

## Takılma sürerse

1. **Kod çözücüyü gör:** Chrome'da sayfa açıkken `chrome://media-internals` → oynatıcı →
   `kVideoDecoderName` ve `kIsPlatformVideoDecoder`. Donanım çözücü (ör. `D3D11VideoDecoder`,
   `VaapiVideoDecoder`) yerine `FFmpegVideoDecoder` görünüyorsa film işlemcide çözülüyor.
   Aynı yerde atlanan kare sayısı (dropped frames) da görünür.
2. **720p'ye düş:** `YUKSEKLIK=720 bash vps/film-hazirla.sh` (~1.5 MB). Önceki 720p helyosfer filmi
   takılmıyordu. Sonra `index.html`'de `?v=` sayısını artır.
3. **CSS'i dene:** `.film` üzerindeki `filter` ve `mask-image`, tam ekran videoda her karede ekran kartına
   iş çıkarır. DevTools'ta ikisini kapatıp farkı gör; fark büyükse karartmayı filme gömmek (ffmpeg `eq`
   ve gradyan katmanı) daha ucuz olur.
4. **Döngü dikişi:** Sarma noktasında (13.4 → 7.5 sn) görüntü normal iki kare arasından biraz daha fazla
   değişir (SSIM 0.90, normalde ~0.95); bu takılma değil, küçük bir sıçramadır.
