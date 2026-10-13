# Voyager güvenlik protokolü

Bu belge, botu geliştirirken ve işletirken uyulacak kuralları anlatır. Yalnızca bu depoda gerçekten bulunan araçlara
dayanır: Node.js, `discord.js`, `.env`, `data/` klasörü, `npm test`, GitHub Actions (`.github/workflows/test.yml`),
`kur.sh` ve `vps/` betikleri. Depoda container yoktur. Testler her push'ta kendiliğinden çalışır; yayına alma elle yapılır.

Denetimde bulunanlar, alınan kararlar ve kalan riskler için: [SECURITY_AUDIT.md](SECURITY_AUDIT.md).

## 1. Sırlar

**Nerede dururlar**

| Sır | Yer | Kim üretir |
|---|---|---|
| `DISCORD_TOKEN` | `.env` | Developer Portal → Bot → Reset Token |
| `TWITCH_CLIENT_SECRET`, `KICK_CLIENT_SECRET` | `.env` | Platformların geliştirici konsolları |
| `YOUTUBE_API_KEY` | `.env` | Google Cloud Console |
| `META_APP_SECRET`, `INSTAGRAM_TOKEN` | `.env` | Meta geliştirici paneli, Graph API Explorer |
| Twitch webhook imza anahtarı | `data/yayin-gizli.json` | Bot (ilk kullanımda) |
| Uzun ömürlü Instagram jetonu | `data/instagram-jeton.json` | Bot (`.env`'deki jetonu değiştirir ve yeniler) |
| Dağıtım SSH anahtarı | Geliştirici makinesinde `~/.ssh/voyager_vps` | `ssh-keygen` |
| Dağıtım hedefi | `vps/.hedef` | Elle |

**Kurallar**

- `.env`, `data/` ve `vps/.hedef` git dışındadır (`.gitignore`). Commit'ten önce `git status` ile bunların listede
  olmadığına bak. Yeni bir sır dosyası eklersen `.gitignore`'a da ekle.
- Sunucuda `.env` `600`, `data/` `700` izinlidir; `kur.sh` ve `src/depo.js` bunu kendisi ayarlar. Elle gevşetme.
- Sır değerlerini koda, README'ye, commit mesajına, sohbet mesajına ya da ekran görüntüsüne koyma. `.env.example`
  yalnızca anahtar adlarını ve açıklamaları içerir; değer yazma.
- Yerelde denerken ayrı bir Discord uygulaması ve ayrı bir jeton kullan. Canlı jetonla yerelde bot başlatma: iki
  kopya aynı anda çalışır ve aynı olaylara iki kez cevap verir.
- Kodda sırları yalnızca `process.env` üzerinden oku. Bir sırrı `console.log` ya da `console.error` ile yazdırma;
  anahtar taşıyan bir adresi (ör. `…&key=…`, `…access_token=…`) hata mesajına ya da kayda koyma.
- Testlere gerçek anahtar koyma. Gereken anahtarı testin içinde üret (`test/guvenlik.test.js` böyle yapar).

**Yenileme (rotasyon)**

| Sır | Nasıl |
|---|---|
| Discord jetonu | Developer Portal → Bot → Reset Token. Sunucuda `sudo nano /opt/voyager/.env`, sonra `sudo systemctl restart voyager`. Eski jeton anında geçersiz olur |
| Twitch, Kick gizli anahtarı | Platformun konsolunda yenile, `.env`'i güncelle, botu yeniden başlat |
| YouTube anahtarı | Google Cloud Console'da yenisini üret, eskisini sil, `.env`'i güncelle, yeniden başlat |
| Instagram jetonu | Yeni jetonu `.env`'e yaz ve bir saat içinde botu yeniden başlat. Bot jetonun değiştiğini anlar, saklananı atıp uzun ömürlüsünü yeniden alır |
| Twitch webhook imza anahtarı | Hazır bir adım yok. `data/yayin-gizli.json` silinirse bot yeni anahtar üretir, ama Twitch'teki mevcut abonelikler eski anahtarla imzalamaya devam eder ve bildirimleri reddedilir. Temiz yol: dosyayı sildikten sonra Twitch yayıncılarını `/yayin cikar` ile çıkarıp yeniden eklemek |
| Dağıtım SSH anahtarı | Yeni anahtar çifti üret; açık anahtarı sunucuya gönderip `sudo bash vps/erisim-kur.sh <yeni.pub>` çalıştır (eski anahtarın yerine yazar). Eski özel anahtarı sil |

Bir sırrın sızdığından şüpheleniyorsan beklemeden yenile (bkz. bölüm 6).

## 2. Yeni komut ya da özellik eklerken yetki

Yetki denetimleri `src/yardimci.js` içinde, tek yerde durur. Yeni bir komutta aynı kuralı yeniden yazma; oradakini
çağır. Yeni bir komut yazarken şunların her birine cevap ver.

1. **Kim kullanabilir?** Herkese açık değilse `setDefaultMemberPermissions` ile gereken yetkiyi bildir. Sunucu
   dışında anlamı yoksa `setContexts(InteractionContextType.Guild)` ekle.
2. **Geri alınması zor mu?** Discord'un yetki denetimini sunucu yöneticileri Entegrasyonlar bölümünden gevşetebilir.
   Komut sunucunun yapısını değiştiriyorsa (kanalları kilitlemek, toplu kanal ya da rol oluşturmak, toplu silmek)
   komuta `kesinYetki: true` ekle: `index.js` bildirilen yetkiyi `komutYetkisiVar` ile kendisi de denetler.
   Şu an `/kitle`, `/kilidiac` ve `/sunucukur` böyle.
3. **Başka bir üyeye işlem yapıyor mu?** `mudahaleEngeli`'ni çağır: kendine, bota, sunucu sahibine ve eşit ya da
   yüksek roldeki üyeye işlem yapılmasını engeller.
4. **Bot bir rol veriyor ya da bir rolü ayara bağlıyor mu?** Komutu kullanan kişi o rolü kendisi de verebiliyor
   olmalı; bot kendi yetkisiyle iş yaptığı için "komutu kullanabiliyor" olmak "bu rolü verebilir" demek değildir.
   Örnek `otoRolEngeli`: Rolleri Yönet yetkisi, rol sıralaması ve yönetim yetkisi taşıyan rolün reddi
   (`YONETIM_IZINLERI`). Rolü sonradan veren kod da aynı listeye bakar (`otoRolVer`).
5. **Bot bir rolü etiketleyecek mi?** Rolü seçen kişi onu kendisi de etiketleyebiliyor olmalı: `etiketEngeli`.
6. **Yalnızca bot sahibine mi?** `sahipKomutu: true` koy ve çalıştırırken `sahipMi` ile denetle
   (`src/commands/sunucular.js`).
7. **Düğme, menü ya da form mu?** `customId`'yi sabit bir tabloda karşıla (`src/topluluk.js` içindeki `ISLEMLER`).
   Düğmeye kimin bastığını her seferinde yeniden denetle: düğmeyi gören herkes basabilir. Menüden gelen değerleri
   kodda tanımlı listeyle eşle; gelen değeri doğrudan rol ya da kanal kimliği olarak kullanma.
8. **Botun yetkisi yetiyor mu?** İşlemden önce botun iznini denetle ve eksikse açıkça söyle
   (`yazabilirMi`, `uye.moderatable`, `ben.permissions.has`).
9. **Ayar cevabı mı?** `MessageFlags.Ephemeral` ile yalnızca komutu kullanana göster.
10. **Sunucular birbirini etkiliyor mu?** Veriyi her zaman `interaction.guildId` ile ayır. Bütün sunucuların
    paylaştığı bir kaynağa (ortak sınır, dış servis kotası) dokunuyorsan bölüm 4'teki sınırları koy.

## 3. Dış girdiler

Kullanıcının yazdığı her şey, webhook gövdeleri ve internetten indirilen her içerik güvenilmezdir.

**Kullanıcı metni**

- Seçeneklere `setMaxLength`, `setMinValue`, `setMaxValue` koy; seçilebilecek değerler belliyse `addChoices` kullan.
- Bir adı dış servisin adresine koymadan önce düzenli ifadeyle sına (`adAyikla` ve ardından gelen denetimler:
  `twitch.js`, `kick.js`, `youtube.js`, `instagram.js`). Adrese `encodeURIComponent` olmadan metin ekleme.
- Kullanıcının yazdığı metni bir kimlik ya da yetki kararına karıştırma. Karıştırmak zorundaysan değeri sabit bir
  yerden oku (örnek: destek odasının sahibi konunun yalnızca başından okunur, `odaSahibi`).
- Dosya adı, klasör yolu ya da `depo.oku`/`depo.yaz` anahtarı olarak asla kullanıcı metni kullanma; bunlar kodda
  sabittir.

**Etiketler ve biçimlendirme**

- Botun varsayılanı yalnızca kullanıcı etiketlerine izin verir (`index.js` içindeki `allowedMentions`). Bir mesajda
  rol etiketleyeceksen yalnızca o rolü aç: `allowedMentions: { roles: [rol] }`. `parse: ['everyone']` kullanma.
- Dış kaynaktan gelen adı mesaj metnine koyarken `escapeMarkdown(ad, { maskedLink: true })` kullan. Kart
  açıklamasına koyduğun dış metni `baglantisiz` ile geçir. Uzun metni `kisalt` ile sınırla.
- Dış servisten gelen bir adresi bağlantı ya da resim yapmadan önce `httpAdresi` ile denetle (`firsatlar.js`).

**Adres indirme**

- Kullanıcının verdiği bir adresi yalnızca `src/haber.js` içindeki `indir` ile indir. `fetch` ya da `http.get` ile
  doğrudan indirme: `indir` iç ağ adreslerini, standart dışı portları ve kullanıcı bilgisi içeren adresleri reddeder,
  doğrulanan IP'ye bağlanır, yönlendirmeleri yeniden denetler, boyutu ve süreyi sınırlar.
- İndirilen içeriği ana iş parçacığında düzenli ifadeyle ayrıştırma. `haber.js` içindeki `incele` gibi ayrı bir iş
  parçacığında ve süre sınırıyla çalıştır. Bot tek iş parçacığında çalışır; uzun süren bir ayrıştırma bütün
  sunucuları bekletir.
- Sabit, bilinen servislere (Steam, Twitch vb.) giden isteklerde `AbortSignal.timeout` kullan.

**Webhook**

- İmza doğrulanmadan gövdeyi ayrıştırma (`JSON.parse` imzadan sonra gelir).
- İmzayı sabit zamanlı karşılaştır (`crypto.timingSafeEqual`), uzunlukları bayt olarak karşılaştır.
- Zaman damgası 10 dakikadan eski olan mesajı reddet. Aynı olayı ikinci kez işleme (`yayin/index.js` içindeki `bildir`).
- İmzası tutmayan bir isteğin dış servise istek attırmasına izin verme.
- Yeni bir webhook yolu eklersen gövde boyutu sınırını koru ve bağlantısı kurulmamış platformun yolunu kapalı tut.

**HTTP sunucusu**

- Sunucu yalnızca `127.0.0.1` dinler; internete Caddy üzerinden açılır. Dinleme adresini değiştirme.
- İstek işleyicisinde hata fırlatabilecek her şeyi (`new URL`, `JSON.parse`) `try/catch` içine al. Yakalanmamış bir
  hata botu bütün sunucularda kapatır.
- Tanıtım sayfasına dış kaynak eklersen `site.js` içindeki içerik güvenlik politikasını yalnızca o kaynak kadar genişlet.
- Sayfa `Strict-Transport-Security` başlığı gönderir; alan adı https ile sunulmaya devam etmelidir.

## 4. Hız sınırı, zaman aşımı, hata ve kayıt

**Var olan sınırlar.** Kullanıcının çoğaltabildiği her şeyin bir üst sınırı olmalı. Yeni bir liste ya da dış istek
eklerken aynı türden bir sınır koy.

| Ne | Sınır | Yer |
|---|---|---|
| Hatırlatıcı | Kişi başı 5 | `hatirlatici.js` |
| Yayıncı | Sunucu başı 50, platform başı 9000 | `yayin/index.js` |
| Haber kaynağı | Sunucu başı 15, sahip başı 30, toplam 2700 | `haber.js` |
| Haber kontrol turu | Aynı anda 4 kaynak; art arda üç kez hata veren ya da yavaş kalan kaynak saatte bir | `haber.js` |
| Instagram hesabı | Sunucu başı 20, sahip başı 40, toplam 100; yalnızca izin verilen sunucularda | `instagram.js` |
| Özel yasaklı kelime | Sunucu başı 100 | `commands/koruma.js` |
| Destek talebi | Üye başı 10 dakikada bir ve aynı anda tek açık oda; yeni katılan 10 dakika bekler; sunucu başı saatte 15 ve aynı anda 25 açık oda | `topluluk.js` |
| Kapalı destek odası | 30 gün; üye başı en fazla 3; kategori 40 kanala ulaşınca en eskiler silinir | `topluluk.js` |
| `/oyun simdi` | Sunucu başı 5 dakikada bir | `commands/oyun.js` |
| `/haber ekle` | Sunucu başı aynı anda tek işlem | `commands/haber.js` |
| İndirilen sayfa | 3 MB, 20 saniye; ayrıştırma 5 saniye | `haber.js` |
| Webhook gövdesi | 1 MB | `yayin/index.js` |

**Kurallar**

- **Bekleme süresi.** Dış servise istek attıran ya da kanal, rol gibi kalıcı şeyler oluşturan bir komutu kullanıcı
  tekrar tekrar çalıştırabilir. Böyle bir komutta `yardimci.js` içindeki `beklemeSayaci`'nı kullan. Sayaç bellekte
  durur; bot yeniden başlayınca sıfırlanır.
- **Ortak kapasite.** Bütün sunucuların paylaştığı bir havuz varsa (toplam kaynak sayısı gibi) tek bir sunucu onun
  ancak küçük bir payını kullanabilmeli. Yayın ve haberde havuz, 180 sunucunun kendi sınırı kadardır. Havuz
  büyütülemiyorsa (Instagram'da dış servisin kotası belirler) sahip başına sınır koy (`sahibinToplami`).
- **Hesap başına sınır yetmez.** Hesap açmak bedava olduğu için kişi başı sınırın yanına sunucu geneli bir sınır
  da koy (destek taleplerindeki saatlik sınır gibi) ve sınıra ulaşıldığında ekibe haber ver.
- **Düzenli okunan kaynaklar.** Kullanıcının eklediği adresler düzenli okunuyorsa birkaçını aynı anda oku ve
  sorun çıkaranı seyrekleştir; tek bir yavaş kaynak diğer sunucuların sırasını uzatmasın.
- **Zaman aşımı.** Her dış istekte süre sınırı olmalı. Bir zamanlayıcı döngüsü (`calisiyor` bayrağı) tek bir
  istekte takılırsa bütün sunucular için durur.
- **Eşzamanlılık.** Bir dosyayı okuyup `await` ettikten sonra baştaki kopyayı yazma; beklemeden sonra yeniden oku.
  Aynı sunucuda iki kez başlatılmaması gereken uzun işlemlere (kilit, kurulum, kaynak ekleme) "sürüyor" denetimi koy.
- **Yakalanmamış hata.** Olay dinleyicilerinde ve zamanlayıcılarda hata fırlatabilecek her şeyi `try/catch` içine
  al. Komutlar `index.js` içinde zaten sarılıdır; `client.on(...)` ve `setTimeout` içindeki kod sarılı değildir ve
  yakalanmamış bir hata botu bütün sunucularda yeniden başlatır. `index.js` böyle bir hatada sebebi kayda yazıp
  kapanır; kayıtta `Yakalanmamış hata` satırı görürsen o yolu bul ve sar.
- **Kullanıcıya hata.** Kullanıcıya ne yapması gerektiğini söyleyen kısa bir mesaj göster. İç hata metnini
  (`hata.message`), yığın izini, dosya yolunu ve yapılandırma ayrıntısını gösterme; ayrıntıyı kayda yaz.
- **Kayıt.** Kayıtlar journald'de durur (`sudo journalctl -u voyager`). Kayda jeton, anahtar, anahtar taşıyan adres
  ya da mesaj içeriği yazma. Hata yazarken hata nesnesinin tamamını değil, `hata.message` ya da `hataMetni(hata)`
  yaz: Discord hata nesneleri gönderilen isteğin gövdesini, yani kullanıcının yazdığı metni taşır.
- **Mesaj içeriği.** Silinen ve düzenlenen mesajların içeriği yalnızca `MESAJ_ICERIGI=1` iken ve yalnızca sunucunun
  kendi log kanalına yazılır. Bu veriyi başka bir yere (dosya, kayıt, başka sunucu) taşıma.
- **Veri silen davranış.** Bot kullanıcı verisini kendiliğinden siliyorsa (kapalı destek odaları gibi) bunu README'ye
  ve kullanıcının gördüğü mesaja yaz; silmeyi kayda geçir.

## 5. Bağımlılıklar

- Bağımlılık sayısını düşük tut (şu an iki tane: `discord.js`, `dotenv`). Node'un kendi modülüyle yapılabilen bir iş
  için paket ekleme. Eklemek zorundaysan nedenini commit mesajına yaz.
- `package-lock.json` depoda durur; `package.json` değişince birlikte commit et. Sunucudaki kurulum kilit
  dosyasındaki sürümleri kurar (`npm ci`) ve paketlerin kurulum betiklerini çalıştırmaz (`--ignore-scripts`).
  Kurulum betiğine ihtiyaç duyan bir paket eklersen bu ayar onu bozar; eklemeden önce düşün.
- `npm audit --omit=dev` her push'ta CI'da çalışır. Yerelde de çalıştırabilirsin:

```bash
npm audit --omit=dev
```

- Dependabot bağımlılıklar ve CI eylemleri için haftalık güncelleme önerir (pull request). Testler geçmeden
  birleştirme; büyük sürüm atlamalarında değişiklik notlarını oku.

- Bir açık çıkarsa önce botun o kodu kullanıp kullanmadığına bak, sonra `npm update <paket>` ile güncelle. Güncellemeden
  sonra bölüm 7'deki kontrolleri çalıştır.
- `discord.js` büyük sürüm atlamasını (14 → 15) ayrı bir değişiklik olarak yap; izin ve olay adları değişebilir.
- Sunucudaki Node.js sürümünü güncel bir LTS'te tut. `kur.sh` Node'u yalnızca yoksa, NodeSource'un imzalı
  deposundan kurar; sonraki güncellemeler sistem güncellemeleriyle (`apt upgrade`) gelir.

## 6. Güvenlik olayı

Örnekler: jetonun sızması, botun beklenmedik mesaj atması ya da üyeleri yasaklaması, sunucuya yetkisiz giriş.

**1. Erişimi sınırla**

```bash
sudo systemctl stop voyager
```

- Sızan sır Discord jetonuysa botu durdurmak yetmez: jetonu hemen yenile (Developer Portal → Bot → Reset Token).
  Eski jeton o anda geçersiz olur.
- Sorun tek bir sunucudaysa: `/sunucular ayril` ile botu o sunucudan çıkar.
- Bir Discord sunucusuna saldırı varsa: `/kitle` kanalları kilitler, `/kilidiac` geri açar.

**2. Kanıtı koru.** Bir şeyi silmeden ya da yeniden kurmadan önce kayıtları ve veriyi kopyala.

```bash
sudo journalctl -u voyager --since "2 days ago" > voyager-kayit.txt
```

```bash
sudo cp -a /opt/voyager/data voyager-data-kopya
```

Bu kopyalar sır içerir (`data/` içinde imza anahtarı ve Instagram jetonu vardır); paylaşma, iş bitince sil.

**3. Sırları yenile.** Hangisinin sızdığından emin değilsen hepsini yenile: Discord jetonu, platform anahtarları,
Instagram jetonu, dağıtım SSH anahtarı (bölüm 1). Sunucuya girildiyse sunucunun kendi SSH erişimini de gözden geçir.

**4. Etkiyi belirle.**

- Kayıtlarda beklenmedik `Sunucuya eklendi` satırları, hata dalgaları ve yeniden başlamalar.
- Etkilenen Discord sunucularında Denetim Kaydı: botun yaptığı yasaklama, atma, rol ve kanal işlemleri.
- `data/ayarlar.json` içinde beklenmedik oto rol, log kanalı ya da kilit kaydı.
- Sunucuda `/opt/voyager/src` içeriğinin depodakiyle aynı olup olmadığı.

**5. Düzelt ve doğrula.** Açığı kapatan değişikliği yap, bölüm 7'deki kontrolleri çalıştır, sonra yayına al. Sunucudaki
koddan şüphe varsa `kur.sh` ile temiz kurulum yap. Bot açıldıktan sonra kayıtları bir süre izle:

```bash
sudo journalctl -u voyager -f
```

**6. Haber ver.** Başka sunucuların üyeleri etkilendiyse o sunucuların yöneticilerine ne olduğunu ve ne yaptığını yaz.

## 7. Yayından önce kontrol listesi

`vps/gonder.sh` commit'i değil, çalışma klasöründeki `src/` içeriğini gönderir. Yayına giden şey, o an diskte olandır.

- [ ] `git status`: yayına gidecek değişiklikler beklediğin dosyalar; `.env`, `data/`, `vps/.hedef` listede yok.
- [ ] `git diff` gözden geçirildi; içinde sır, deneme kodu ya da kişisel veri yok.
- [ ] Testler geçiyor (bot başlamaz, ağa çıkmaz, veriyi geçici klasöre yazar; yaklaşık 30 saniye):

```bash
npm test
```

- [ ] Değişiklik GitHub'a gönderildiyse CI (Actions sekmesi) yeşil.

- [ ] Sözdizimi denetimi:

```bash
for f in src/*.js src/commands/*.js src/yayin/*.js; do node --check "$f"; done
```

- [ ] `npm audit --omit=dev` temiz.
- [ ] Yeni ya da değişen her komut için bölüm 2'deki on soru cevaplandı.
- [ ] Yeni bir yetki ya da sınır kuralı eklendiyse `test/guvenlik.test.js` içine testi de eklendi.
- [ ] Yeni dış girdi varsa bölüm 3'teki kurallar uygulandı: boyut, süre, doğrulama, kaçırma.
- [ ] Yeni bir sır eklendiyse `.env.example`'da yalnızca adı var ve README'de nasıl üretileceği yazıyor.
- [ ] Yeni bir özellik botta yeni bir izin gerektiriyorsa önce `site.js` içindeki `TAM_IZINLER`'e eklendi.
      `TEMEL_IZINLER`'e (ana düğme) yalnızca her sunucunun ihtiyaç duyduğu izinler girer; gerekçesi yorumda yazıyor.
- [ ] Değişiklik önce ayrı bir deneme sunucusunda, ayrı bir jetonla denendi (`test/DISCORD_DENEME.md`).
- [ ] Yayından sonra `sudo journalctl -u voyager -f` ile açılış satırları ve ilk dakikalar izlendi.

**Sunucu betikleri değiştiyse**

- `kur.sh` (servis tanımı ve kısıtlamaları) ancak sunucuda `sudo bash kur.sh` çalıştırılınca yürürlüğe girer.
  Servis dosya sistemini salt okunur görür ve yalnızca `/opt/voyager/data` klasörüne yazabilir. Bot `data/` dışında
  bir yere yazacaksa `kur.sh` içindeki `ReadWritePaths` satırına eklenmelidir. Çalıştırdıktan sonra botun açıldığını
  ve veri yazan bir komutun (ör. `/hatirlat`) çalıştığını doğrula. Kısıtlamaları önce tek başına, geri alınabilir
  biçimde denemek için: `SECURITY_AUDIT.md` bölüm 7.
- `vps/erisim-kur.sh` (güncelleme betiği) ancak sunucuda `sudo bash erisim-kur.sh <açık-anahtar.pub>` çalıştırılınca
  yenilenir; o zamana kadar `vps/gonder.sh` eski betiği kullanır.
