# Sitenin arka plan filmi: durum ve devir notu

voyager.helyosfer.me'nin giriş bölümünde NASA'nın Big Bang animasyonu oynar: patlama bir kez, ardından
galaksilerin uçuştuğu 6 saniyelik döngü. Bu klasör filmi ve kaynağını tutar; filmi `vps/film-hazirla.sh`
üretir (ayrıntılar betiğin başında).

| Dosya | Ne |
|---|---|
| `film.mp4` | Sitedeki film: 1920x1080, 30 fps, 13.5 sn, sessiz, H.264 High level 4.0, crf 19 (~10 MB) |
| `film.jpg` | Filmin ilk karesi; film inene kadar poster olarak görünür |

Kaynak: [NASA SVS 12656](https://svs.gsfc.nasa.gov/12656), NASA's Goddard Space Flight Center/CI Lab
(NASA içeriği, kaynak göstererek serbestçe kullanılabilir; sayfanın altındaki satır bunu yapar).
Film NASA'nın orijinal 4K dosyasından (`12656_Big_Bang_4k.m4v`, 93.5 MB, ~29 Mbps) üretilir.
`film-hazirla.sh` dosyayı ilk çalıştırmada `vps/film/kaynak-4k.m4v` olarak indirir (repoya girmez) ve
sha256'sını denetler. Önceki kaynak animasyonun YouTube kopyasıydı (1080p, ~4 Mbps); zamanlaması 4K
dosyayla birebir aynı (iki sürümde de patlamanın en parlak anı ~3. saniyede), betikteki süreler değişmedi.

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
- **Bu dalda hazır, canlıda değil:** `?v=5`. (`?v=4` hiç yayına alınmadı; değişikliklerini v=5 içerir.)
  1. **Kolay çözülen kodlama (v=4'ten).** Canlıdaki film `-preset veryslow` ile 1080p'de 16 referans kare
     ve H.264 level 5.1 kullanıyor. Birçok ekran kartı bunu donanımda çözemez; tarayıcı işlemcide çözmeye
     düşer ve kare atlar. Yeni film level 4.0, en fazla 3 referans ve 3 B karesi kullanıyor.
  2. **Döngü durmadan sarıyor (v=4'ten).** `film.js`, `requestVideoFrameCallback` ile son 0.1 sn'ye
     gelince filmi durmadan 7.5. saniyeye sarar; `ended` yedek olarak duruyor.
  3. **Daha yüksek kalite (v=5).** Kaynak NASA'nın 4K dosyası; crf 28 yerine crf 19 (ortalama ~5 Mbps,
     anlık en fazla ~8 Mbps). crf 28 küçük yıldızları siliyor, galaksileri bulanıklaştırıyordu.
  4. **CSS filtresi ve maskesi kalktı, film daha belirgin (v=5).** Filme verilen `brightness(0.82)
     contrast(1.05)` kaldırıldı; film NASA'nın parlaklığında. Yazıların okunması için ortadaki koyu
     katman %66'dan %45'e indi. Alttaki siyaha geçiş `mask-image` yerine `.hero::before`'daki
     gradyanla yapılıyor. Tam ekran videoda filter ve mask her karede ekran kartına iş çıkarıyordu.
  5. **Film tamamen indikten sonra oynar (v=5).** `film.js` filmi `fetch` ile indirip bellekten
     (`blob:`) oynatır; o sırada ilk kare (poster) görünür. Akarak oynayan film bağlantı yetişmezse
     yarıda bekliyordu; geri sarma da ağa gitmez. İndirme olmazsa eskisi gibi akarak oynar. CSP'ye
     `connect-src 'self'` ve `media-src blob:` eklendi.
  Ölçüm (yerelde, Chromium, 1080p): 612 karede 0 atlanan kare; iki sarmada `ended` yok; kareler arası en
  büyük boşluk 35 ms (normali 33 ms), sarma anında 5 ms. Parlak film (10 MB) baştan oynatılınca da
  483 karede 0 atlanan kare.
- **Dal `main`'e birleştirilmedi** (`claude/gifted-hamilton-3krezm`). `main`'den yayına alınırsa site
  eski NASA helyosfer filmine (doğrudan NASA'nın sunucusundan, yavaş) döner.

## v=5'i yayına almak (sunucuda, root)

Önce film, sonra kod; ikisi aynı anda yayına girmeli (kod `?v=5` ister, aynı dosya adını kullanır).
Caddy ayarı değişmez.

```bash
rm -rf /tmp/voyager-yeni
git clone --depth 1 -b claude/gifted-hamilton-3krezm https://github.com/Helyosfer/voyager-bot /tmp/voyager-yeni

# Film
echo "1c7679f31abc6bab2ce7c1437e340975a954884d0b189a9d22ecd640a08fbd5d  /tmp/voyager-yeni/vps/film/film.mp4" | sha256sum -c \
  && cp /tmp/voyager-yeni/vps/film/film.mp4 /tmp/voyager-yeni/vps/film/film.jpg /var/www/voyager/ \
  && chmod 644 /var/www/voyager/*

# Kod
rm -rf /home/voyager-deploy/voyager/src
cp -r /tmp/voyager-yeni/src /tmp/voyager-yeni/package.json /tmp/voyager-yeni/package-lock.json /home/voyager-deploy/voyager/
chown -R voyager-deploy:voyager-deploy /home/voyager-deploy/voyager
/usr/local/sbin/voyager-guncelle
rm -rf /tmp/voyager-yeni

# Kontrol: content-length 10428043 ve data-src="/film.mp4?v=5"
curl -sI "https://voyager.helyosfer.me/film.mp4?v=5" | grep -iE '^(content-length|cf-cache-status)'
curl -s https://voyager.helyosfer.me/ | grep -o 'data-src="[^"]*"'
```

## Takılma sürerse

1. **Kod çözücüyü gör:** Chrome'da sayfa açıkken `chrome://media-internals` → oynatıcı →
   `kVideoDecoderName` ve `kIsPlatformVideoDecoder`. Donanım çözücü (ör. `D3D11VideoDecoder`,
   `VaapiVideoDecoder`) yerine `FFmpegVideoDecoder` görünüyorsa film işlemcide çözülüyor.
   Aynı yerde atlanan kare sayısı (dropped frames) da görünür.
2. **720p'ye düş:** `YUKSEKLIK=720 bash vps/film-hazirla.sh`. Önceki 720p helyosfer filmi
   takılmıyordu. Sonra `index.html`'de `?v=` sayısını artır.
3. **Döngü dikişi:** Sarma noktasında (13.4 → 7.5 sn) görüntü normal iki kare arasından biraz daha fazla
   değişir (SSIM 0.90, normalde ~0.95); bu takılma değil, küçük bir sıçramadır.
