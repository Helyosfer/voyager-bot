# Voyager güvenlik denetimi

| | |
|---|---|
| Tarih | 12-13 Ekim 2026 |
| İncelenen | Bu çalışma kopyası: `ozellik/instagram` dalı, `3377162` commit'i ve üzerindeki commit edilmemiş değişiklikler (`/sunucukur`, `/kitle`, `/haber`, `/instagram` dahil) |
| Yöntem | Kaynak kodun tamamının okunması, yerel doğrulama ve depoya eklenen testler (`npm test`) |
| Yapılmayanlar | Bot başlatılmadı, dağıtım yapılmadı, Discord'a ya da başka bir canlı servise istek atılmadı, canlı sunucuya bağlanılmadı |

Bu rapor bir güvence belgesi değildir. Kodda görülebilenleri anlatır; canlı sunucunun ve üçüncü taraf hesapların
durumu incelenmedi (bkz. [Doğrulanamayanlar](#doğrulanamayanlar)).

## Özet

26 konunun hepsinde bir değişiklik yapıldı. İlk 11'i doğrudan düzeltildi; 12-26 arası önce karar olarak sunuldu,
sonra proje sahibinin seçtiği yolla uygulandı. Bazılarında kalan risk var; bunlar [Açık kalanlar](#açık-kalanlar)
bölümünde. Sunucu tarafındaki iki değişiklik (VGR-19, VGR-20) Linux'ta denenmedi ve canlıya ancak betikler sunucuda
yeniden çalıştırılınca yansır (bkz. [Yayına alma notları](#7-yayına-alma-notları)).

| Kimlik | Önem | Başlık | Durum |
|---|---|---|---|
| VGR-01 | Yüksek | Ayrıştırılamayan bir istek adresi botu kapatıyor | Düzeltildi |
| VGR-02 | Yüksek | Özel hazırlanmış bir haber beslemesi botu dakikalarca kilitliyor | Düzeltildi |
| VGR-03 | Yüksek | `/ayarla oto-rol` ile yetki yükseltme | Düzeltildi |
| VGR-04 | Orta | Haber indirmede toplam süre sınırı yok | Düzeltildi |
| VGR-05 | Orta | Üst üste binen `/kitle`, izin yedeğini geri getirilemez biçimde eziyor | Düzeltildi |
| VGR-06 | Düşük | Sahte Kick webhook'ları bota dış istek attırıyor | Düzeltildi |
| VGR-07 | Düşük | Twitch imza karşılaştırması bazı girdilerde hata fırlatıyor | Düzeltildi |
| VGR-08 | Düşük | Destek talebi konusuyla başka bir üyenin talep açması engellenebiliyor | Düzeltildi |
| VGR-09 | Düşük | Eşzamanlı işlemlerde kayıp güncelleme ve çift kurulum | Düzeltildi |
| VGR-10 | Düşük | Dış kaynaktan gelen metin, bildirimde biçimlendirme ve gizli bağlantı oluşturabiliyor | Düzeltildi |
| VGR-11 | Bilgilendirme | İç ağ engel listesi genişletildi (sıkılaştırma) | Uygulandı |
| VGR-12 | Orta | Komut yetkileri yalnızca Discord'un varsayılan kuralına dayanıyor | Uygulandı: yıkıcı üç komutta bot da denetliyor |
| VGR-13 | Orta | Destek talebi açıp kapatarak kanal biriktirme | Uygulandı: hesap ve sunucu başına sınırlar, eski odaların silinmesi |
| VGR-14 | Düşük | Yönetim yetkisi taşıyan bir rol oto rol yapılabiliyor | Uygulandı |
| VGR-15 | Düşük | Etiketlenecek rolü seçenin o rolü etiketleme yetkisi denetlenmiyor | Uygulandı |
| VGR-16 | Düşük | `/oyun simdi` ve `/haber ekle` için bekleme süresi yok | Uygulandı |
| VGR-17 | Düşük | Ortak haber ve Instagram kapasitesi birkaç sunucu tarafından tüketilebilir | Uygulandı: haber havuzu yayın bildirimlerindeki oranla; sahip başına sınır |
| VGR-18 | Düşük | Yakalanmamış bir hata bütün botu yeniden başlatıyor | Uygulandı: üç yer; kapanmadan önce sebep kayda yazılıyor |
| VGR-19 | Düşük | systemd servisi az kısıtlı; bot kendi kodunun sahibi | Uygulandı (`kur.sh`); WSL'de Ubuntu üzerinde denendi |
| VGR-20 | Düşük | Kurulumda kilit dosyası zorunlu değil; Node kurulumu `curl \| bash` ile | Uygulandı; WSL'de ve canlı sunucuda denendi |
| VGR-21 | Bilgilendirme | Tanıtım sayfasında HSTS başlığı yok | Uygulandı |
| VGR-22 | Bilgilendirme | İç hata metni komutu kullanan yöneticiye gösteriliyor | Uygulandı |
| VGR-23 | Bilgilendirme | Kayıtlarda kullanıcının yazdığı metin | Uygulandı |
| VGR-24 | Bilgilendirme | Davet linki bütün özelliklerin izinlerini birden istiyor | Sahibin kararıyla geri alındı (Ekim 2026): tek davet, bütün izinler, Yönetici yok |
| VGR-25 | Bilgilendirme | Mağaza servislerinden gelen adresler doğrulanmadan bağlantı yapılıyor | Uygulandı |
| VGR-26 | Bilgilendirme | Otomatik test ve CI yok | Uygulandı: 25 test ve CI (CI ilk push'ta çalışır) |
| VGR-27 | Orta | Komutlar botun bulunmadığı sunucularda da çalıştırılabiliyor | Düzeltildi (kod); Developer Portal ayarı proje sahibinde |
| VGR-28 | Orta | `/kitle` hiçbir kanalı kilitlemiyordu | Düzeltildi; Discord üzerinde denendi |
| VGR-29 | Yüksek | Dağıtım kullanıcısı güncelleme betiği üzerinden root yetkisi alabiliyor | Düzeltildi (`kur.sh`, `vps/erisim-kur.sh`); Linux'ta denenmedi |

## 1. Kapsam ve mimari

**Ne olduğu.** Node.js (≥ 18) üzerinde `discord.js` 14 ile yazılmış bir Discord botu. Bağımlılıklar `discord.js` ve
`dotenv`; ikisi de `package-lock.json` ile sabitlenmiş (kurulu sürümler 14.27.0 ve 16.6.1). Kanıt: `package.json`,
`src/index.js`.

**Giriş noktaları**

| Giriş | Dosya | Kim ulaşır |
|---|---|---|
| Slash komutları | `src/index.js:95-113`, `src/commands/*.js` | Botun bulunduğu sunucuların üyeleri (Discord üzerinden) |
| Düğme, menü ve form | `src/index.js:84-94`, `src/topluluk.js:629-637` | `/sunucukur` ile kurulmuş sunucuların üyeleri |
| Sunucu olayları | `src/gunluk.js`, `src/koruma.js`, `src/kilit.js`, `src/index.js:120` | Discord'un gönderdiği olaylar |
| HTTP sunucusu | `src/yayin/index.js:141-180` | `127.0.0.1:8788`; README'ye göre Caddy ile internete açılır |
| Zamanlayıcılar | `firsatlar.js`, `haber.js`, `instagram.js`, `yayin/youtube.js`, `hatirlatici.js` | Botun kendisi |
| Komut kaydı | `src/komutlari-yukle.js` | Sahibi, elle ya da dağıtımda |

HTTP sunucusunun üç işi var: tanıtım sayfası (`/`, `/film.js`), Twitch webhook'u (`/twitch`) ve Kick webhook'u (`/kick`).

**Yetkilendirme modeli.** Her komut gereken yetkiyi `setDefaultMemberPermissions` ile bildirir; denetimi Discord yapar.
Kod içinde ek olarak şunlar var (hepsi `src/yardimci.js` içinde, tek yerde):

| Kontrol | Yer | Ne sağlar |
|---|---|---|
| `mudahaleEngeli` | `yardimci.js:5` | `/ban`, `/kick`, `/sustur`: kendine, bota, sahibe ve eşit ya da yüksek roldeki üyeye işlem yapılamaz |
| `komutYetkisiVar` + `kesinYetki` | `yardimci.js:106`, `index.js:99-103` | `/kitle`, `/kilidiac`, `/sunucukur`: Yönetici yetkisini bot da denetler |
| `otoRolEngeli`, `otoRolVer` | `yardimci.js:64`, `83` | Oto rolü ancak o rolü verebilen biri ayarlar; yönetim yetkisi taşıyan rol ayarlanamaz ve verilmez |
| `etiketEngeli` | `yardimci.js:125` | Bildirimlerde etiketlenecek rolü ancak onu etiketleyebilen biri seçer |
| `sahipMi` | `commands/sunucular.js:10` | `/sunucular` yalnızca uygulama sahibine açık |
| Talep kapatma | `topluluk.js:606-612` | Yalnızca talep sahibi ya da destek ekibi |
| İlgi rolleri | `topluluk.js:451-471` | Menüden yalnızca şablondaki ilgi rolleri alınıp bırakılabilir |

**Veri akışı**

| Girdi | Kaynak | Güven düzeyi | Nereye gider |
|---|---|---|---|
| Komut seçenekleri, form metni | Sunucu üyeleri | Güvenilmez | Discord mesajları, `data/` |
| Mesaj içeriği (yalnızca `MESAJ_ICERIGI=1` ise) | Sunucu üyeleri | Güvenilmez | Küfür filtresi, log kanalı |
| Webhook gövdeleri | İnternet (Twitch, Kick olduğu imzayla doğrulanır) | İmza geçene kadar güvenilmez | Yayın bildirimi |
| RSS, Atom ve HTML sayfaları | Sunucu yöneticilerinin verdiği adresler | Güvenilmez | Haber bildirimi |
| Mağaza, YouTube ve Instagram verisi | Üçüncü taraf servisler | Kısmen güvenilir | Bildirimler |

**Kalıcı veri.** Hepsi `data/` altında JSON dosyaları (`src/depo.js`); klasör `0700`, dosyalar `0600` izinle yazılır.
Sunucu ayarları, takip listeleri, görülen içerik kayıtları, hatırlatıcılar (kullanıcının yazdığı metinle) ve kilit
sırasındaki izin yedekleri burada durur.

**Sırların yeri** (değerler incelenmedi; bu çalışma kopyasında `.env` ve `data/` yok)

| Sır | Yer |
|---|---|
| Discord jetonu; Twitch, Kick, YouTube ve Meta anahtarları; ilk Instagram jetonu | Sunucuda `/opt/voyager/.env` (`chmod 600`), git dışında |
| Twitch webhook imza anahtarı (bot üretir) | `data/yayin-gizli.json` |
| Uzun ömürlü Instagram jetonu (bot yeniler) | `data/instagram-jeton.json` |
| Dağıtım SSH anahtarı ve hedef adresi | Geliştirici makinesinde `~/.ssh/voyager_vps`, `vps/.hedef` (git dışında) |

**Dağıtım.** `kur.sh` botu `/opt/voyager` altına kurar ve yetkisiz `voyager` kullanıcısıyla systemd servisi olarak
çalıştırır. `vps/erisim-kur.sh`, yalnızca tek bir root betiğini çalıştırabilen `voyager-deploy` kullanıcısını kurar.
`vps/gonder.sh` çalışma klasöründeki `src/` içeriğini gönderip botu yeniden başlatır. Container yok.
`.github/workflows/test.yml` her push'ta testleri çalıştırır; dağıtım yapmaz.

### Doğrulanamayanlar

Aşağıdakiler depodan anlaşılamaz; raporda bunlar hakkında varsayım yapılmadı.

- Canlı sunucunun gerçek durumu: dosya izinleri, güvenlik duvarı, Caddy yapılandırması, sistem güncellemeleri.
- Caddy'nin `//` gibi bir yolu botun sunucusuna değiştirmeden iletip iletmediği (VGR-01'in internetten tetiklenebilmesi buna bağlı).
- Developer Portal ayarları (Public Bot, intent'ler) ve Twitch, Kick, Google, Meta hesaplarının ayarları.
- `.env` içindeki değerler ve sunucudaki `data/` içeriği.
- `kur.sh` içindeki yeni servis kısıtlamalarının ve `vps/erisim-kur.sh` içindeki yeni kurulum adımının Linux'ta çalışması.
  İkisi için yalnızca sözdizimi denetlendi (`bash -n`); bu ortam Windows.
- `node_modules` içeriği satır satır incelenmedi; yalnızca `npm audit` sonucu ve kilit dosyası değerlendirildi.

## 2. Tehdit modeli

**Korunan varlıklar.** Discord jetonu ve diğer anahtarlar; botun sunuculardaki yetkileri (yasaklama, atma, rol ve kanal
yönetimi); sunucuların ayarları ve izin yedekleri; botun erişilebilirliği (bir sorun bütün sunucuları etkiler); botun
çalıştığı makine ve iç ağı.

**Olası saldırganlar**

| Saldırgan | Elindeki | Örnek hedef |
|---|---|---|
| İnternetteki herhangi biri | HTTP sunucusuna istek | Botu düşürmek, sahte yayın bildirimi |
| Sıradan sunucu üyesi | Herkese açık komutlar, düğmeler | Spam, başkasını engelleme, rol kapma |
| Kısmi yetkili (ör. yalnızca Sunucuyu Yönet) | Ayar komutları | Yetkisini botun yetkisiyle büyütmek |
| Kendi sunucusunun yöneticisi (bot herkese açıksa) | Bütün komutlar, kendi sunucusunda | Diğer sunucuları etkilemek: botu kilitlemek, ortak kapasiteyi tüketmek, botun makinesinden iç ağa istek attırmak |
| İçeriği kontrol eden üçüncü taraf | Besleme, yayıncı adı, gönderi metni | Bildirim kanalına yanıltıcı içerik |

**Güven sınırları.** Discord ile bot arası (Discord'un kimlik bilgisi güvenilir, kullanıcı metni değil); internet ile
HTTP sunucusu arası (yalnızca imzası doğrulanan webhook güvenilir); bot ile üçüncü taraf içerik arası; sunucular arası
(bir sunucunun yöneticisi başka sunucuyu etkileyememeli).

**Değerlendirilen tehditler**

| Tehdit | Sonuç |
|---|---|
| Yetkisiz komut, rol ve izin yükseltme | Bulgu: VGR-03, VGR-12, VGR-14, VGR-15 |
| Webhook sahteciliği, tekrar oynatma | İncelendi, sorun görülmedi (imza ve 10 dakikalık zaman penceresi); yan bulgular VGR-06, VGR-07 |
| SSRF (botun makinesinden iç ağa istek) | İncelendi, koruma var; sıkılaştırma VGR-11 |
| Hizmet engelleme | Bulgu: VGR-01, VGR-02, VGR-04, VGR-13, VGR-16, VGR-17, VGR-18 |
| Kötü amaçlı içerik (biçimlendirme, toplu etiket) | Bulgu: VGR-10, VGR-25; toplu etiket için sorun görülmedi |
| Sır ve kişisel veri sızması | Sır sızması görülmedi; kayıtlar için VGR-22, VGR-23 |
| Yarış durumları | Bulgu: VGR-05, VGR-09 |
| Tedarik zinciri | VGR-20 |

**Bu projeye uygulanmayanlar**

| Tehdit | Neden |
|---|---|
| Prompt injection | Denetim sırasında kodda dil modeli yoktu. Sonradan eklenen `/sor` için bkz. "Denetimden sonra eklenenler" |
| SQL enjeksiyonu | Veritabanı yok; veri JSON dosyalarında |
| Komut enjeksiyonu | `src/` içinde `child_process`, `eval` ya da `new Function` yok (arandı). Betikler kullanıcı girdisi almıyor |
| Yol geçişi | Dosya adları kodda sabit (`depo.js`); HTTP sunucusu yalnızca iki sabit dosyayı verir (`site.js:48-60`) |
| Kötü amaçlı dosya işleme | Bot dosya indirip açmıyor; eklerin yalnızca boyutuna bakılıyor (`koruma.js:123-127`) |
| Container riskleri | Depoda container tanımı yok |

## 3. Başlık başlık sonuçlar

| Başlık | Sonuç | Kanıt |
|---|---|---|
| Kimlik doğrulama | Sorun görülmedi | Kullanıcı kimliği Discord'dan gelir; bot kendi kimlik sistemi kurmuyor |
| Rol, izin ve yönetici kontrolleri | Bulgu, kapatıldı | VGR-03, VGR-12, VGR-14, VGR-15 |
| Varsayılan olarak reddetme | Sorun görülmedi | Tanınmayan komut ve `customId` yok sayılır (`index.js:96-97`, `topluluk.js:633-634`); HTTP'de tanınmayan yol 404 |
| Güvenli hata davranışı | Bulgu, kapatıldı | VGR-01, VGR-18, VGR-22 |
| Girdi doğrulama ve kodlama | Bulgu, kapatıldı | VGR-02, VGR-08, VGR-10, VGR-25. Kullanıcı adları adrese konmadan önce düzenli ifadeyle sınanıyor (`twitch.js:32`, `kick.js:22`, `youtube.js:24`, `instagram.js:119`) |
| URL işleme, SSRF | Sorun görülmedi, sıkılaştırıldı | `haber.js:64-73`: yalnızca http/https, standart port, bütün DNS kayıtları herkese açık olmalı, doğrulanan IP'ye bağlanılır, yönlendirmeler yeniden denetlenir. Testte 13 iç adres ve 8 URL reddedildi |
| Toplu etiket | Sorun görülmedi | Varsayılan `allowedMentions: { parse: ['users'] }` (`index.js:53`); bildirimlerde yalnızca seçilen rol; hatırlatmada yalnızca sahibi (`hatirlatici.js:28`) |
| Sırların saklanması | Sorun görülmedi | `.gitignore` `.env`, `data/` ve `vps/.hedef` içeriyor; depoda ve geçmişte jeton kalıbı araması boş döndü; `.env` `600`, `data/` `700` |
| Sırların kayıtlarda görünmesi | Sorun görülmedi | Jeton ve anahtar yazdıran bir satır yok. Anahtar taşıyan adresler (`youtube.js:14`, `instagram.js:71`) kayda yazılmıyor, yalnızca `hata.message` yazılıyor |
| Webhook imzası ve tekrar oynatma | Sorun görülmedi | Twitch: HMAC-SHA256, sabit zamanlı karşılaştırma (`twitch.js:100-105`). Kick: RSA-SHA256 (`kick.js:71-85`). İkisinde de 10 dakikadan eski mesaj reddedilir; aynı yayın ikinci kez duyurulmaz (`yayin/index.js:120-125`). Testte geçerli, yanlış ve eski imza denendi |
| İstek boyutu | Sorun görülmedi | Webhook gövdesi 1 MB (`yayin/index.js:163`), indirilen sayfa 3 MB (sıkıştırma açıldıktan sonra ölçülür) |
| Hız sınırı ve kaynak tüketimi | Bulgu, kapatıldı | VGR-13, VGR-16, VGR-17. Sınırların tamamı `SECURITY_PROTOCOL.md` bölüm 4'te |
| Zaman aşımı | Bulgu, kapatıldı | VGR-04. Diğer bütün dış isteklerde `AbortSignal.timeout` var |
| Eşzamanlılık | Bulgu, kapatıldı | VGR-05, VGR-09 |
| Dosya izinleri ve güvenli varsayılanlar | Sorun görülmedi | Koruma özellikleri varsayılan olarak kapalı; mesaj içeriği okuma ayrıca açılır; HTTP sunucusu yalnızca `127.0.0.1` dinler |
| Debug modu, üretim ve geliştirme ayrımı | Uygulanmıyor | Kodda debug bayrağı ya da ortam ayrımı yok. `VERI_KLASORU` yalnızca testlerin veri klasörünü değiştirir (`depo.js:6-7`) |
| Bağımlılıklar | Sorun görülmedi | `npm audit --omit=dev`: 0 açık (12 Ekim 2026). Kilit dosyası depoda; hiçbir bağımlılığın kurulum betiği yok |
| Dağıtım ve en az ayrıcalık | Bulgu, kapatıldı (denenmedi) | VGR-19, VGR-20. Önceden var olanlar: ayrı yetkisiz kullanıcı, `NoNewPrivileges`, dağıtım kullanıcısına tek betik için sudo, gönderilen dosyalarda sembolik bağ denetimi (`erisim-kur.sh:65`) |
| CI | Sorun görülmedi | `.github/workflows/test.yml`: depoya yalnızca okuma izni, sır kullanmıyor, eylemler commit özetiyle sabit, `pull_request_target` yok, dağıtım yapmıyor |
| Kayıtlarda kişisel veri | Bulgu, kapatıldı | VGR-23 |
| Testler | Bulgu, kapatıldı | VGR-26. Testlerde gerçek kimlik bilgisi yok; anahtarlar testin içinde üretiliyor |

## 4. Bulgular

### Doğrudan düzeltilenler

#### VGR-01 · Ayrıştırılamayan bir istek adresi botu kapatıyor

- **Önem:** Yüksek
- **Yer:** `src/yayin/index.js:143-151`
- **Kanıt:** İstek işleyicisinin ilk satırı `new URL(istek.url, ...)` idi. `//` ve `/\` gibi yollar `Invalid URL` hatası
  fırlatıyor; hata yakalanmadığı için Node süreci kapanıyor. Eski satır yerelde tekrarlandı: tek bir `GET //` isteğiyle
  süreç 1 koduyla çıktı.
- **Etki:** Bot bütün sunucularda kapanır. systemd 5 saniyede yeniden başlatır, ama istek tekrarlandıkça yine düşer.
  Saldırganın kimlik doğrulamasına ihtiyacı yok; sunucuya istek atabilmesi yeter. Düzeltme yayına alındıktan sonra
  (13 Ekim 2026) canlı adrese `//` isteği atıldı ve bottan 400 döndü: Caddy bu yolu aynen iletiyor, yani açık
  internetten gerçekten tetiklenebiliyordu.
- **Düzeltme:** Hata yakalanıp 400 dönülüyor.
- **Uyumluluk:** Geçerli isteklerde değişiklik yok.

#### VGR-02 · Özel hazırlanmış bir haber beslemesi botu dakikalarca kilitliyor

- **Önem:** Yüksek
- **Yer:** `src/haber-ayristir.js:31-64` (düzenli ifadeler), `src/haber.js:155-176` (çözüm)
- **Kanıt:** Ayrıştırıcıdaki `<etiket>…</etiket>` biçimli düzenli ifadeler, kapanışı olmayan çok sayıda açılış
  etiketinde karesel süre harcıyor. Yerel ölçüm (`<rss>` ardından tekrarlanan `<title>`): 0,14 MB 0,6 saniye,
  0,28 MB 2,9 saniye, 0,56 MB 15,3 saniye. İndirme sınırı 3 MB olduğu için süre dakikaları bulur (hesapla; 3 MB ölçülmedi).
- **Etki:** Bot tek iş parçacığında çalışır; bu sürede hiçbir sunucuda komutlara cevap veremez ve Discord bağlantısı
  kopabilir. Saldırgan, botu kendi sunucusuna ekleyip `/haber ekle` ile kendi hazırladığı adresi veren herhangi biri
  olabilir. Kaynak 10 dakikada bir yeniden okunduğu için etki tekrarlanır.
- **Düzeltme:** Ayrıştırma ayrı bir iş parçacığına (`worker_threads`) taşındı; 5 saniyeyi aşan iş sonlandırılır,
  bellek 128 MB ile sınırlanır. Yeni bağımlılık yok.
- **Uyumluluk:** Ayrıştırma kodu `src/haber-ayristir.js` dosyasına taşındı; davranışı aynı. Kötü niyetli bir kaynak
  her kontrolde bir işlemci çekirdeğini en fazla 5 saniye meşgul edebilir.

#### VGR-03 · `/ayarla oto-rol` ile yetki yükseltme

- **Önem:** Yüksek
- **Yer:** `src/commands/ayarla.js:125-133`, `src/yardimci.js:60-78`
- **Kanıt:** Komut yalnızca rolün botun rolünden aşağıda olup olmadığına bakıyordu; komutu kullananın o rolü verip
  veremeyeceğine bakmıyordu. Oto rolü yeni gelen herkese bot verir.
- **Etki:** Yalnızca Sunucuyu Yönet yetkisi olan biri, kendi veremeyeceği bir rolü (ör. moderatör ya da yönetici
  rolünü) oto rol yapıp ikinci bir hesapla sunucuya girerek o rolü alabilir. README, Voyager rolünün diğer rollerin
  üstüne taşınmasını önerdiği için botun verebildiği rol aralığı geniştir.
- **Düzeltme:** Komutu kullanan sunucu sahibi değilse Rolleri Yönet yetkisine sahip olmalı ve rol kendi en yüksek
  rolünden aşağıda olmalı. Bu, Discord'un rol verme kuralıyla ve `mudahaleEngeli`'ndeki sıralama denetimiyle aynı mantık.
- **Uyumluluk:** Kayıtlı oto rol ayarları değişmez. Rolleri Yönet yetkisi olmayan bir Sunucuyu Yönet yetkilisi artık
  oto rol ayarlayamaz.

#### VGR-04 · Haber indirmede toplam süre sınırı yok

- **Önem:** Orta
- **Yer:** `src/haber.js:75-83`, `104-113`, `133-138`
- **Kanıt:** (kod incelemesi) İstekteki `timeout` yalnızca bağlantının sessiz kaldığı süreyi ölçüyor; veriyi yavaş
  yavaş gönderen bir site bağlantıyı sınırsız açık tutabiliyordu. Yönlendirmede eski cevabın gövdesi `resume()` ile
  arka planda okunmaya devam ediyordu. Sıkıştırılmış cevapta bağlantı koparsa hata açıcıya ulaşmadığı için bekleyen
  söz hiç sonuçlanmıyordu.
- **Etki:** Kontrol döngüsü tek bir kaynakta takılır ve bütün sunucuların haber bildirimleri durur.
- **Düzeltme:** İndirmenin tamamı için 20 saniyelik sınır; yönlendirme ve hata cevaplarında bağlantı kapatılıyor;
  bağlantı kopması yakalanıyor.
- **Uyumluluk:** 20 saniyede inmeyen kaynak o turda atlanır.
- **Doğrulama:** Testte DNS cevabı ve bağlantı sahtesiyle değiştirilerek bu makinedeki geçici bir sunucuya karşı
  denendi: veriyi damla damla gönderen cevap 20 saniyede kesildi, yarıda kesilen sıkıştırılmış cevap askıda kalmadı,
  iç ağa yönlendirme reddedildi. Gerçek bir siteye istek atılmadı.

#### VGR-05 · Üst üste binen `/kitle`, izin yedeğini eziyor

- **Önem:** Orta
- **Yer:** `src/kilit.js:66-68`, `234-248`; `src/commands/kitle.js:26-27`; `src/commands/kilidiac.js:21-22`
- **Kanıt:** Komut "kilitli mi" diye bakıp cevabı erteledikten sonra kilitlemeye geçiyordu. İki komut aynı anda
  gelirse ikisi de denetimi geçiyor; ikincisi yedeği, birincinin kilitlemeye başladığı izinlerle yeniden alıyordu.
- **Etki:** `/kilidiac` kilitli izinleri "önceki hal" diye geri yükler; kanalların asıl izinleri kaybolur ve elle
  yeniden kurulmaları gerekir. Yönetici yetkisi gerekir; saldırıdan çok, panik anında iki yöneticinin aynı anda
  basmasıyla tetiklenir.
- **Düzeltme:** Sunucu başına aynı anda tek kilitleme ya da açma işlemi yürür; kilitliyken yedek yeniden alınmaz.
- **Uyumluluk:** İkinci komut "işlem sürüyor" cevabı alır.

#### VGR-06 · Sahte Kick webhook'ları bota dış istek attırıyor

- **Önem:** Düşük
- **Yer:** `src/yayin/kick.js:56-85`, `src/yayin/index.js:153`
- **Kanıt:** İmzası tutmayan her istekte açık anahtar Kick'ten yeniden indiriliyordu. Kick bağlantısı hiç kurulmamış
  olsa da `/kick` yolu işleniyordu.
- **Etki:** `/kick` adresine istek yağdıran biri, botun Kick'e aynı sayıda istek atmasına ve Kick tarafında
  sınırlanmasına yol açabilir.
- **Düzeltme:** Anahtar en sık dakikada bir indirilir; bağlantısı kurulmamış platformun webhook yolu 404 döner.
- **Uyumluluk:** Kick anahtarını değiştirirse yenisi en geç bir dakika içinde alınır.

#### VGR-07 · Twitch imza karşılaştırması bazı girdilerde hata fırlatıyor

- **Önem:** Düşük
- **Yer:** `src/yayin/twitch.js:101-103`
- **Kanıt:** Uzunluk karakter sayısıyla karşılaştırılıp `timingSafeEqual` bayt dizileriyle çağrılıyordu. ASCII dışı
  karakter içeren aynı uzunlukta bir imza hata fırlatıyordu.
- **Etki:** İstek 403 yerine 500 alır ve kayda bir hata satırı düşer. İmza atlatılamaz.
- **Düzeltme:** Uzunluk bayt olarak karşılaştırılıyor.

#### VGR-08 · Destek talebi konusuyla başka bir üyenin talep açması engellenebiliyor

- **Önem:** Düşük
- **Yer:** `src/topluluk.js:473-476`, `511`
- **Kanıt:** Oda konusu `sahip=<kimlik>; konu=<üyenin yazdığı metin>` biçiminde. Açık talep araması kimliği konunun
  herhangi bir yerinde arıyordu.
- **Etki:** Konuya `sahip=<başkasının kimliği>;` yazan üye, kendi odası açık kaldıkça o kişinin talep açmasını engeller.
- **Düzeltme:** Sahip yalnızca konunun başından okunuyor.

#### VGR-09 · Eşzamanlı işlemlerde kayıp güncelleme ve çift kurulum

- **Önem:** Düşük
- **Yer:** `src/haber.js:222-250`, `src/instagram.js:116-155`, `src/commands/sunucukur.js:107-116`
- **Kanıt:** `/haber ekle` ve `/instagram ekle` listeyi okuyup dış servisi bekledikten sonra baştaki kopyayı yazıyordu.
  Bu sırada başka bir sunucunun yaptığı ekleme ya da çıkarma siliniyordu. `/sunucukur` aynı anda iki kez onaylanırsa
  her şey çift oluşuyordu.
- **Düzeltme:** Liste beklemeden sonra yeniden okunuyor; kurulum sunucu başına tek seferde yürüyor.

#### VGR-10 · Dış kaynaktan gelen metin biçimlendirme ve gizli bağlantı oluşturabiliyor

- **Önem:** Düşük
- **Yer:** `src/yayin/index.js:101-102`, `src/instagram.js:177` ve `183-184`, `src/haber.js:279`, `src/yardimci.js:130-132`
- **Kanıt:** Yayıncı adı ve Instagram hesap adı mesaj metnine, haber özeti ve gönderi açıklaması kart açıklamasına
  olduğu gibi konuyordu. Discord bu alanlarda `[yazı](adres)` yazımını bağlantıya çevirir.
- **Etki:** İçeriği yazan kişi (ör. bir YouTube kanalının adını belirleyen) bildirim kanalına farklı görünen bir
  bağlantı koyabilir. Etiketler `allowedMentions` ile zaten engelli.
- **Düzeltme:** Adlar `escapeMarkdown` ile kaçırılıyor; açıklamalarda bağlantı yazımı etkisizleştiriliyor.
- **Uyumluluk:** Adındaki `_` ya da `*` işaretleri artık biçimlendirme yapmaz, olduğu gibi görünür.

#### VGR-11 · İç ağ engel listesi genişletildi

- **Önem:** Bilgilendirme (sıkılaştırma; istismar edilebilirliği gösterilmedi)
- **Yer:** `src/haber.js:42-49`
- **Açıklama:** İçine IPv4 adresi gömülen IPv6 geçiş adresleri (6to4, Teredo, yerel NAT64) ile belgeleme ağları
  listeye eklendi. Bu adresler ancak botun makinesinde ilgili geçiş arayüzü varsa iç ağa ulaşabilir; canlı sunucuda
  böyle bir arayüz olup olmadığı bilinmiyor.
- **Uyumluluk:** Bu aralıklarda yayın yapan bir haber sitesi eklenemez; bunlar gerçek sitelerde beklenen adresler değil.

### Karar verilip uygulananlar

Bunlar yetki politikasını, ürün davranışını ya da dağıtımı değiştiriyor. Önce seçenekleriyle sunuldu; proje sahibi
önerilen seçeneklerin uygulanmasını istedi (13 Ekim 2026). Her birinde seçilen yol ve davranış değişikliği yazılı.

#### VGR-12 · Komut yetkileri yalnızca Discord'un varsayılan kuralına dayanıyor

- **Önem:** Orta
- **Yer:** `src/index.js:99-103`, `src/yardimci.js:103-109`; `kesinYetki` işareti: `commands/kitle.js:6`, `kilidiac.js:6`, `sunucukur.js:66`
- **Kanıt:** Yetki denetimini Discord yapıyor. Sunucu yöneticileri bu kuralı Sunucu Ayarları → Entegrasyonlar
  bölümünden komut bazında değiştirebilir; kodda ikinci bir denetim yoktu.
- **Etki:** Bir yönetici bir komutu yanlışlıkla daha geniş bir role açarsa, o roldekiler işlemi botun yetkisiyle
  yapar (ör. Yönetici olmayan biri `/kitle` çalıştırır).
- **Seçilen:** Yalnızca geri alınması zor üç komutta (`/kitle`, `/kilidiac`, `/sunucukur`) bot yetkiyi kendisi de
  denetliyor. Kural tek yerde (`index.js`); bir komuta `kesinYetki: true` eklemek yeterli.
- **Davranış değişikliği:** Bu üç komut Entegrasyonlar'dan Yönetici olmayan bir role açılsa bile o roldekiler
  kullanamaz. Diğer komutlarda Discord'un esnekliği aynen duruyor.

#### VGR-13 · Destek talebi açıp kapatarak kanal biriktirme

- **Önem:** Orta
- **Yer:** `src/topluluk.js:478-537` (sınırlar ve silme), `539-544`, `565-578`, `614-618`
- **Kanıt:** Üyenin aynı anda tek açık talebi olabiliyordu, ama kapatılan oda silinmiyor ve hemen yenisi
  açılabiliyordu.
- **Etki:** Destek kanalını gören herkes, üyeliğini henüz onaylamamış yeni gelenler dahil (kanal herkese açık kurulur),
  açıp kapatarak kategoriyi doldurabilir. Discord bir kategoride 50 kanala izin verir; kategori dolunca kimse talep açamaz.
- **Seçilen:** Hesap başına ve sunucu geneli sınırlar; hepsi `topluluk.js` içindeki sabitlerle ayarlanır.
  - Bir üye 10 dakikada bir talep açabilir (`TALEP_ARALIGI`).
  - Bir sunucuda bir saatte en fazla 15 talep açılabilir (`SUNUCU_SAATLIK_TALEP`). Sınıra ulaşılınca destek kayıt
    kanalına uyarı düşer.
  - Kapalı oda son mesajından 30 gün sonra silinir (`KAPALI_ODA_OMRU`).
  - Bir üyenin en fazla 3 kapalı odası saklanır; fazlası en eskiden başlayarak silinir (`UYE_BASI_KAPALI_ODA`).
  - Kategori 40 kanala ulaşınca, sahibine ve yaşına bakılmadan en eski kapalı odalar silinir (`KATEGORI_ESIGI`).
  Silme, yeni bir talep açılırken yapılır ve destek kayıt kanalına yazılır.
- **Davranış değişikliği:** **Kapalı destek odaları artık kalıcı değil; silinen odanın mesajları geri getirilemez.**
  README ve kapatma mesajı buna göre güncellendi. Bekleme süresi ve saatlik sayaç bellekte tutulur; bot yeniden
  başlayınca sıfırlanır. Yoğun bir sunucuda saatte 15'ten fazla gerçek talep gelirse fazlası bir süre reddedilir.
- **Uygulanmayan:** Talep açmak için Üye rolü istemek değerlendirildi ve uygulanmadı. Üyelik onayı tek tıklık bir
  düğme olduğu için saldırgana engel olmaz; buna karşılık üyeliğini onaylayamayan gerçek bir kullanıcının tek destek
  yolunu kapatır (onaylanmamış hesaplar destek sohbetine de yazamaz).
- **Sonradan eklenen (13 Ekim 2026):** aynı anda en fazla 25 açık oda (`ACIK_ODA_SINIRI`) ve sunucuya yeni katılan
  için 10 dakikalık bekleme (`UYELIK_BEKLEMESI`). Açık oda sınırı kategori eşiğinden küçük olduğu için kategori artık
  doldurulamaz.
- **Kalan risk:** Çok sayıda hesap kullanan biri 25 açık oda sınırını doldurup yeni taleplerin açılmasını
  geçici olarak engelleyebilir. Ekip uyarıyı kayıt kanalında görür; odaları kapatıp hesapları atınca düzelir.

#### VGR-14 · Yönetim yetkisi taşıyan bir rol oto rol yapılabiliyor

- **Önem:** Düşük
- **Yer:** `src/yardimci.js:39-58` (izin listesi), `67-69`, `80-101`; `src/index.js:125`
- **Seçilen:** Yönetim yetkisi taşıyan rol (üye atma ve yasaklama, mesaj, rol, kanal ve sunucu yönetimi, susturma,
  toplu etiket, denetim kaydı vb.) oto rol olarak ayarlanamaz. Rol ayarlandıktan sonra ona böyle bir yetki eklenirse
  bot vermeyi bırakır; kayda ve sunucunun log kanalına (en sık saatte bir) uyarı yazar.
- **Davranış değişikliği:** Hâlihazırda yönetim yetkili bir rolü oto rol yapmış sunucularda rol verilmez olur. Log
  kanalı yoksa sunucu yöneticisi bunu yalnızca yeni gelenlerin rol almadığını görünce fark eder.

#### VGR-15 · Etiketlenecek rolü seçenin o rolü etiketleme yetkisi denetlenmiyor

- **Önem:** Düşük
- **Yer:** `src/yardimci.js:123-128`; `commands/yayin.js:116-117`, `oyun.js:128-129`, `haber.js:108-109`, `instagram.js:95-96`
- **Seçilen:** Rolü seçen kişide "Herkesten bahset" yetkisi olmalı ya da rol herkesin bahsedebildiği bir rol olmalı.
- **Davranış değişikliği:** Bu yetkisi olmayan bir Sunucuyu Yönet yetkilisi, bahsedilemeyen bir rolü seçemez.
  Kayıtlı ayarlar değişmez.

#### VGR-16 · `/oyun simdi` ve `/haber ekle` için bekleme süresi yok

- **Önem:** Düşük
- **Yer:** `src/commands/oyun.js:13-15`, `147-152`; `src/commands/haber.js:14`, `73-87`
- **Seçilen:** `/oyun simdi` sunucu başına 5 dakikada bir çalışır. `/haber ekle` sunucu başına aynı anda tek işlem
  yürütür.
- **Davranış değişikliği:** Süre dolmadan gelen komut "biraz sonra" cevabı alır. Bekleme bellekte tutulur.

#### VGR-17 · Ortak kapasite birkaç sunucu tarafından tüketilebilir

- **Önem:** Düşük
- **Yer:** `src/haber.js:16-23`, `226`, `241`, `308-361`; `src/yardimci.js:111-121`; `src/instagram.js:17-20`, `127`, `148`
- **Kanıt:** Haber için sunucu başına 15, toplamda 150 kaynak vardı: on sunucu havuzu dolduruyordu. Yayın
  bildirimlerinde aynı oran 50'ye 9000'dir: havuzu doldurmak için 180 sunucu gerekir.
- **Seçilen (haber):** Proje sahibinin isteğiyle yayın bildirimlerindeki oran uygulandı: toplam sınır
  `180 × 15 = 2700`. Tek bir sunucu havuzun en fazla %0,6'sını, tek bir sahip (30 kaynak) %1,1'ini kullanabilir.
  Havuz büyüdüğü için kontrol döngüsü de değişti: kaynakların dördü aynı anda okunur; art arda üç kez hata veren
  ya da 5 saniyeden uzun süren kaynak saatte bir okunur. Böylece bilerek yavaş cevap veren kaynaklar diğer
  sunucuların haberlerini geciktiremez.
- **Aynı kalan (Instagram):** Toplam sınır 100'de kaldı, sahip başına sınır (40) duruyor. Instagram'da havuzu
  Meta'nın saatlik istek sınırı belirler: hesap sayısı arttıkça kontrol aralığı uzar (100 hesapta 50 dakika). Havuzu
  aynı oranla büyütmek (3600 hesap) aralığı 30 saate çıkarırdı.
- **Davranış değişikliği:** Haber kaynağı sayısı çok artarsa botun işlemci ve ağ kullanımı da artar; 2700 kaynakta
  her 10 dakikalık turda 2700 sayfa indirilir.
- **Sonradan eklenen (13 Ekim 2026):** Instagram yalnızca izin verilen sunucularda açık (`INSTAGRAM_SUNUCULAR` ve
  `GUILD_IDS`). İzin listesi boş değilse yabancı sunucular havuza hesap ekleyemez.
- **Kalan risk:** İzin listesi boş bırakılırsa (ikisi de tanımsız) özellik her sunucuda açıktır ve havuz birkaç
  sunucuyla doldurulabilir.

#### VGR-18 · Yakalanmamış bir hata bütün botu yeniden başlatıyor

- **Önem:** Düşük
- **Yer:** `src/index.js:17-25`, `120-135`; `src/hatirlatici.js:44-49`; `src/kilit.js:212-221`
- **Seçilen:** Hata fırlatabildiği görülen üç yer `try/catch` içine alındı (yeni üye işleyicisi, hatırlatıcı
  kaydının silinmesi, kilit sırasındaki bot denetimi). Bunların dışında yakalanmamış bir hata çıkarsa bot yine
  kapanır ve systemd yeniden başlatır; ama kapanmadan önce sebep kayda yazılır. Node'un kendi çıktısı hata
  nesnesinin tamamını bastığı için (VGR-23) yerine hata mesajı ve yığın izi yazılıyor.
- **Davranış değişikliği:** Üç yoldaki dosya hatası artık botu kapatmaz. Diğer çökmelerde davranış aynı, kayıt
  satırı farklı: `Yakalanmamış hata (...), bot kapanıyor`.
- **Doğrulama:** Kod incelemesi. `index.js` Discord'a bağlandığı için testte yüklenmez.

#### VGR-19 · systemd servisi az kısıtlı; bot kendi kodunun sahibi

- **Önem:** Düşük (derinlemesine savunma)
- **Yer:** `kur.sh:73-76`, `89-93`, `109-124`, `136-143`
- **Seçilen:** Servise şu kısıtlamalar eklendi: dosya sistemi salt okunur (`ProtectSystem=strict`), yalnızca
  `/opt/voyager/data` yazılabilir; ev klasörleri ve aygıtlar görünmez; çekirdek ayarları, denetim grupları ve ad
  alanları kısıtlı; yetki kümesi boş; yalnızca ağ ve yerel soket aileleri açık. Böylece bot süreci kendi kodunu da
  değiştiremez.
- **Doğrulama:** WSL üzerindeki Ubuntu 26.04'te (systemd açık) denendi, 13 Ekim 2026. Bot bütün kısıtlamalarla açıldı, Discord'a bağlandı, tanıtım sayfasını
  sundu ve `/hatirlat` ile `/ayarla log-kanali` komutlarında veri yazdı; kayıtlarda `EROFS`, `EACCES` ya da `EPERM` yok.
  Aynı gün canlı sunucuda (VPS) `kur.sh` çalıştırıldı: kısıtlamalar uygulandı (`ProtectSystem=strict`,
  `ReadWritePaths=/opt/voyager/data`, `ProtectHome=yes`), bot açıldı ve site cevap veriyor.
- **İşletim etkisi:** Değişiklik ancak `kur.sh` sunucuda yeniden çalıştırılınca yürürlüğe
  girer. Bot başlamazsa betik bunu söyler ve kısıtlamaların nasıl kaldırılacağını yazar. Node ev klasörünün altında
  kuruluysa (ör. nvm) `ProtectHome` kendiliğinden atlanır.

#### VGR-20 · Kurulumda kilit dosyası zorunlu değil; Node kurulumu `curl | bash` ile

- **Önem:** Düşük
- **Yer:** `kur.sh:17-27`, `50-52`, `81-85`; `vps/erisim-kur.sh:77-92`
- **Seçilen:**
  - Kilit dosyası varsa bağımlılıklar `npm ci --omit=dev --ignore-scripts` ile, tam olarak kilitteki sürümlerle
    kurulur. Güncelleme betiği bağımlılıkları yalnızca kilit dosyası değiştiğinde yeniden kurar (kilit dosyasının
    özeti `node_modules/.kilit-ozeti` içinde tutulur). `kur.sh` artık `package-lock.json` dosyasını da kopyalar.
  - Node kurulumunda internetten indirilen betik root olarak çalıştırılmıyor. NodeSource deposu imza anahtarıyla
    elle ekleniyor; paketleri `apt` bu anahtarla doğruluyor.
- **Doğrulama:** `kur.sh` WSL üzerindeki Ubuntu 26.04'te (systemd açık) denendi, 13 Ekim 2026: Node'u olmayan makinede Node 24 imzalı depodan kuruldu,
  `npm ci --ignore-scripts` bağımlılıkları kurdu, bot çalıştı. Güncelleme betiği aynı gün canlı sunucuda denendi:
  kilit dosyası değişen ilk gönderimde bağımlılıklar `npm ci` ile yeniden kuruldu, hemen ardından yapılan ikinci
  gönderimde kurulum atlandı; ikisinde de bot yeniden açıldı.
- **İşletim etkisi:** `vps/erisim-kur.sh` sunucuda yeniden çalıştırılana kadar eski
  güncelleme betiği kullanılır. Yeni betiğin ilk çalışmasında bağımlılıklar bir kez baştan kurulur; o sırada ağ
  kesilirse `node_modules` eksik kalır ve bot yeniden başlatılmaz (çalışan kopya devam eder); betik yeniden
  çalıştırılınca düzelir. Node kurulumu yalnızca Node'u olmayan bir sunucuyu etkiler.
- **Kalan risk:** Depo anahtarı ilk kurulumda NodeSource'tan https ile indirilir; parmak izi betikte sabit değil.

#### VGR-21 · Tanıtım sayfasında HSTS başlığı yok

- **Önem:** Bilgilendirme
- **Yer:** `src/site.js:42-44`
- **Seçilen:** `Strict-Transport-Security: max-age=31536000` eklendi; alt alan adlarını kapsamaz.
- **İşletim etkisi:** Siteyi https ile açan tarayıcı bir yıl boyunca bu alan adında http kullanmaz. Alan adı ileride
  yalnızca http ile sunulursa o tarayıcılar siteyi açamaz.

#### VGR-22 · İç hata metni komutu kullanan yöneticiye gösteriliyor

- **Önem:** Bilgilendirme
- **Yer:** `src/commands/yayin.js:91`, `src/commands/instagram.js:73`
- **Seçilen:** `/yayin ekle` ve `/instagram ekle` başarısız olunca genel bir mesaj gösteriliyor; ayrıntı kayıtta.
- **Davranış değişikliği:** Bot sahibi yapılandırma sorununu artık Discord cevabından değil, kayıtlardan görür.

#### VGR-23 · Kayıtlarda kullanıcının yazdığı metin

- **Önem:** Bilgilendirme
- **Yer:** `src/yardimci.js:134-136`; `src/index.js:22`, `88`, `108`, `133`; `src/firsatlar.js:479`
- **Kanıt:** Komut hatalarında hata nesnesinin tamamı yazılıyordu. Yerelde doğrulandı: `discord.js` hata nesnesi
  gönderilen isteğin gövdesini taşıyor; tamamı yazdırılınca kullanıcının yazdığı metin (ör. yasaklama sebebi) kayda
  düşüyor.
- **Seçilen:** Yalnızca hata mesajı ve yığın izi yazılıyor (`hataMetni`).
- **Aynı kalan:** Açılışta ve sunucu eklenip çıkarıldığında sunucu adı, kimliği ve üye sayısı kayda yazılıyor; bu
  proje sahibinin bilerek eklediği bir özellik. Kayıtları `voyager-deploy` kullanıcısı da okuyabilir (`erisim-kur.sh:36`).

#### VGR-25 · Mağaza servislerinden gelen adresler doğrulanmadan bağlantı yapılıyor

- **Önem:** Bilgilendirme
- **Yer:** `src/firsatlar.js:65-76`, `93-94`, `120`, `154`, `174-175`
- **Seçilen:** Mağaza servislerinden gelen bağlantı ve resim adresleri yalnızca http(s) ise kullanılıyor; geçersiz
  bağlantısı olan fırsat atlanıyor.

#### VGR-24 · Davet linki bütün izinleri birden istiyor

- **Önem:** Bilgilendirme
- **Yer:** `src/site.js:9-23`, `30-31`; `src/site/index.html` (`{{DAVET}}` ve `{{DAVET_TAM}}`)
- **Kanıt:** Tek link `/sunucukur` ve `/kitle` dahil her özelliğin iznini istiyordu; bu özellikleri kullanmayan
  sunucular da botu kanal yönetme yetkisiyle ekliyordu.
- **Seçilen:** Sayfadaki üç ana düğme botu temel izinlerle ekliyor: kanalları görme, mesaj gönderme, bağlantı
  yerleştirme, geçmişi okuma, mesajları yönetme, üye atma ve yasaklama, zaman aşımı, rolleri yönetme, denetim kaydı.
  Tam izinleri (ek olarak kanal yönetimi, ses ve konu izinleri, üyeleri taşıma) isteyen iki ayrı bağlantı var.
- **Davranış değişikliği:** Ana düğmeyle ekleyen bir sunucuda `/sunucukur` ve `/kitle` ilk denemede eksik izni
  söyler; izin Sunucu Ayarları → Roller'den açılır ya da bot tam izinli bağlantıyla yeniden eklenir. Botun zaten
  bulunduğu sunucular etkilenmez.
- **Sonraki karar (20 Ekim 2026, bot sahibi):** İki ayrı davet kullanıcıya hangi izinle ekleyeceğini seçtiriyordu ve
  kafa karıştırıyordu. Sayfada artık tek davet var; bot bütün özellikleri için gereken izinlerle eklenir (ek olarak
  @everyone ve rol etiketleme izni). Kabul edilen risk: `/sunucukur` ve `/kilit` kullanmayan sunucular da botu kanal
  yönetme yetkisiyle ekler. Sınır korunur: Yönetici (Administrator) istenmez, bot yalnızca kullandığı izinleri alır;
  test bunu denetler. Sunucu yöneticisi izinleri Sunucu Ayarları → Roller'den yine daraltabilir.

#### VGR-26 · Otomatik test ve CI yok

- **Önem:** Bilgilendirme
- **Yer:** `test/guvenlik.test.js`, `test/DISCORD_DENEME.md`, `.github/workflows/test.yml`, `.github/dependabot.yml`,
  `package.json` (`test` betiği), `src/depo.js:6-7`
- **Seçilen:**
  - Bu denetimdeki kontroller Node'un kendi test çalıştırıcısıyla depoya eklendi (25 test, yeni bağımlılık yok).
    `npm test` botu başlatmaz, ağa çıkmaz ve veriyi geçici bir klasöre yazar; yaklaşık 30 saniye sürer.
  - GitHub Actions iş akışı her push ve pull request'te testleri, sözdizimi denetimini ve `npm audit`'i çalıştırır.
    Depoya yalnızca okuma izniyle çalışır ve sır kullanmaz. Dependabot bağımlılıklar ve eylemler için haftalık
    güncelleme önerir.
  - Discord üzerinde elle yapılacak deneme için işaretlenebilir bir liste eklendi.
- **Doğrulama:** İş akışı dosyası yalnızca YAML olarak ayrıştırıldı; GitHub'da henüz çalışmadı. İlk push'ta
  sonucuna bakılmalı.
- **Kalan:** Testler güvenlik kurallarını kapsar, botun bütün işlevlerini değil.

#### VGR-27 · Komutlar botun bulunmadığı sunucularda da çalıştırılabiliyor

- **Önem:** Orta
- **Yer:** `src/komutlari-yukle.js` (`integration_types`), `src/index.js` (etkileşim işleyicisinin başı)
- **Kanıt:** Deneme sırasında görüldü (13 Ekim 2026): canlı bot eklenmediği halde komutları deneme sunucusunda
  görünüyor ve çalışıyordu. Komutlar nereye kurulabileceklerini bildirmiyordu; uygulamada "User Install" açıksa botu
  kendi hesabına kuran herkes komutları herhangi bir sunucuda kullanabilir. Uygulamada "User Install" şu an kapalı;
  sebep eski bir hesap kurulumuydu: proje sahibi botu Yetkili Uygulamalar'dan kaldırınca komutlar deneme sunucusundan
  kayboldu. Ayarı kapatmak önceki hesap kurulumlarını silmez; botu geçmişte hesabına kurmuş başka kullanıcılar olabilir.
- **Etki:** Kod, botun o sunucuda olduğunu varsayıyor. Bulunmadığı sunucuda bazı komutlar hata verir; bazıları ise
  o sunucu adına veri yazar (hatırlatıcı, ayarlar, haber kaynağı). Sahip başına sınır (VGR-17) sunucunun sahibini
  bilemediği için uygulanmaz.
- **Düzeltme:** Komutlar yalnızca sunucuya kurulum için kaydediliyor; ayrıca botun bulunmadığı bir sunucudan gelen
  etkileşim tek yerde reddediliyor.
- **Proje sahibine kalan:** Developer Portal → Installation sayfasında **User Install** seçeneğini kapatmak. Kod
  değişikliği yayına alınıp `npm run komutlar` çalışana kadar tek koruma budur.
- **Doğrulama:** Sözdizimi ve mevcut testler. Discord üzerinde, deneme kurulumu yeniden kurulduktan sonra bakılmalı.

#### VGR-28 · `/kitle` hiçbir kanalı kilitlemiyordu

- **Önem:** Orta (bir koruma özelliği çalışmıyor ve çalıştığı izlenimini veriyordu)
- **Yer:** `src/kilit.js` (`kanaliKilitle`), `src/topluluk.js` (`BOT` izin listesi)
- **Kanıt:** Deneme sunucusunda görüldü (13 Ekim 2026): 73 kanalın hiçbiri kilitlenmedi. Kilit her kanalda önce bota
  "İzinleri Yönet" satırı vermeye çalışıyordu; Discord bunu bot Yönetici olsa bile reddetti ve kod reddedilen kanalı
  tamamen bırakıyordu. `/sunucukur`'un kurduğu ses kanallarında ise botun Bağlan izni olmadığı için izinler hiç
  düzenlenemiyordu.
- **Etki:** Saldırı anında `/kitle` çalıştıran yönetici sunucunun kilitlendiğini sanar, ama kanallar açık kalır.
- **Düzeltme:** Satır verilemezse kanal botun elindeki izinlerle kilitlenir; ret bir kez görüldükten sonra diğer
  kanallarda yeniden denenmez. `/sunucukur` şablonu bota ses kanallarında Bağlan iznini de verir.
- **Doğrulama:** Yeni kurulan bir deneme sunucusunda `/kitle` 75 kanalın hepsini kilitledi, `/kilidiac` 75'ini de
  eski haline döndürdü; kayıtta hata yok. Kilit sırasında yetkisiz bir hesabın yazamadığı ayrıca denenmedi.
- **Kalan:** Bu düzeltmeden önce `/sunucukur` ile kurulmuş sunuculardaki ses kanalları, bot Yönetici değilse
  kilitlenemez; komut bunu "erişimim yok" diye bildirir.

### Denetimden sonra eklenenler

#### `/sor`: Gemini ile soru cevaplama (13 Ekim 2026)

- **Yer:** `src/yapayzeka.js`, `src/commands/sor.js`
- **Yeni risk:** prompt injection, ortak kotanın tüketilmesi, kullanıcı metninin üçüncü tarafa (Google) gitmesi.
- **Alınan önlemler:** model yalnızca metin üretir ve hiçbir işlem yapamaz; cevap etiket atamaz, gizli bağlantı
  içeremez, uzunluğu sınırlıdır; anahtar başlıkta gider, soru kayda yazılmaz; kişi, sunucu ve toplam günlük
  sınırlar vardır; özellik yalnızca izin verilen sunucularda ve yalnızca anahtar tanımlıysa açıktır.
- **Doğrulama:** testler (sahte Gemini cevabıyla). Gerçek Gemini'ye karşı ilk deneme canlıda yapıldı.
- **Kalan risk:** model yanlış ya da uygunsuz metin üretebilir; içerik süzgeci Google'ın kendi süzgecidir.
  Sayaçlar bellekte tutulur; bot yeniden başlayınca sıfırlanır (Google'ın kendi günlük sınırı yine geçerlidir).

### Denetimden sonra bulunanlar

#### VGR-29 · Dağıtım kullanıcısı güncelleme betiği üzerinden root yetkisi alabiliyor

- **Önem:** Yüksek
- **Yer:** `vps/erisim-kur.sh` (`voyager-guncelle`), `kur.sh`
- **Sorun:** `/opt/voyager` bot kullanıcısına aitti ve `voyager-guncelle`, gönderilen `package.json` betiklerini
  (`npm run komutlar`) bot kullanıcısıyla, servis kısıtlamaları olmadan çalıştırıyordu. Böylece `voyager-deploy`
  kod klasörüne sembolik bağ koyabiliyordu. Root sonraki güncellemede bu klasöre `cp -rP` ile kopyalıyordu; `-P`
  yalnızca kaynağı etkilediği için hedefteki bağ izleniyor ve root, bağın gösterdiği dosyaya yazıyordu. `kur.sh`
  içindeki `chmod`/`chown`/`cp` adımları da bağları izliyordu.
- **Düzeltme:**
  - `/opt/voyager` ve içindeki kod (`src`, `package*.json`, `node_modules`) root'a ait; bot kullanıcısı yalnızca
    okur. `.env` `root:voyager 640`. Yalnızca `data/` bot kullanıcısına ait; servisin `ReadWritePaths`'i değişmedi.
  - `kur.sh` ve `voyager-guncelle`, yazdıkları ya da okudukları yollarda sembolik bağ bulursa durur. Güncelleme
    önce root'a ait geçici bir klasöre alınır, yerine `mv` (rename) ile geçer; rename hedefteki bağı izlemez.
  - `npm run komutlar` yerine `voyager-komutlar` birimi: `node src/komutlari-yukle.js` servisle aynı
    kısıtlamalarla çalışır. `package.json` betikleri kullanılmaz.
  - Bağımlılıklar `voyager-bagimliliklar` biriminde kurulur (`npm ci --omit=dev --ignore-scripts`): bot
    kullanıcısıyla, aynı kısıtlamalarla, yalnızca ara klasöre yazarak. Birim bitince kurulanlar root'a alınır,
    setuid/setgid bitleri ve başkalarına yazma izni kaldırılır, sonra yerine taşınır. npm root olarak
    çalıştırılmaz, çünkü paket arşivindeki izin bitlerini (setuid dahil) korur ve paket listesi deploy
    kullanıcısından gelir.
  - `package-lock.json` artık zorunlu; VGR-20'deki "kilit yoksa `npm install`" yolu kaldırıldı.
  - Eski düzendeki bir sunucuda `kur.sh` önce botu durdurur ve bot kullanıcısının geride kalmış süreçlerini sonlandırır.
  - Root, deploy kullanıcısının klasörünü kendisi okumaz. `voyager-deploy`, kendi yetkisiyle (`runuser`) en fazla
    512 MB'lık bir tar arşivi üretir. Root yalnızca arşivi okur ve içinde `src/`, `package.json` ve
    `package-lock.json` dışında yol ya da sıradan dosya ve klasör dışında bir öğe (sembolik bağ, sabit bağ, özel
    dosya) varsa reddeder. Böylece kopya sırasında konan bir bağ, root'un okuyabildiği bir dosyayı herkesin
    okuyabildiği `/opt/voyager/src` altına taşıyamaz.
  - `voyager-deploy` artık `systemd-journal` grubunda değil (eski kurulumda gruptan çıkarılır), çünkü grup bütün
    sistem kayıtlarını açıyordu. Bot kayıtları için iki sabit sudo kuralı var:
    `journalctl -u voyager -n 200 --no-pager` ve `journalctl -u voyager -f --no-pager`. Kurallarda joker yok;
    `--no-pager` şart, yoksa sayfalayıcı (`less`) root olarak açılır ve içinden kabuk çalıştırılabilir.
- **Doğrulama:** `bash -n`, ShellCheck 0.11.0 (bulgu yok), birim dosyalarının örnek değerlerle üretilmesi,
  `npm test`. Arşiv denetimi yerelde GNU tar 1.35 ile dört arşivle denendi: normal arşiv kabul edildi; sembolik
  bağ, sabit bağ ve fazladan yol içerenler reddedildi. Betikler Linux'ta çalıştırılmadı; bu ortamda systemd ve
  sembolik bağ izni yok. Deneme adımları: bölüm 7.
- **İşletim etkisi:** Önce `sudo bash kur.sh`, sonra `sudo bash erisim-kur.sh <açık-anahtar.pub>` yeniden
  çalıştırılmalı. `kur.sh` çalıştırılmadan yeni `voyager-guncelle` eski düzende çalışmayı reddeder.
- **Kalan risk:** Gönderilen kod, servisle aynı kısıtlamalarla bot kullanıcısı olarak çalışır ve `.env`'i
  okuyabilir. Bu, tasarımın gereğidir: botun kodunu deploy kullanıcısı belirler. `voyager-guncelle` çıktısı,
  komut yükleyicinin ve bağımlılık kurulumunun kendi kayıtlarını zaten gösterir.

### Açık kalanlar

Hepsi yukarıdaki bölümlerde ayrıntısıyla yazılı; burada toplu halde.

- **Çok hesaplı kötüye kullanım.** VGR-13: açık destek odalarıyla kategoriyi doldurma, saatte 15 odayla sınırlı.
  VGR-17: Instagram havuzu.
- **Discord üzerinde denenmeyenler.** Yeni komutların hiçbiri gerçek bir sunucuda çalıştırılmadı. Liste:
  `test/DISCORD_DENEME.md`.
- **GitHub'da çalışmayan.** CI iş akışı (VGR-26).
- **Botun herkese açık olup olmadığı.** Developer Portal'daki Public Bot ayarı depodan görülemez. Kapalıysa
  "kendi sunucusunun yöneticisi" saldırganı ve çok hesaplı kötüye kullanımın çoğu ortadan kalkar.

## 5. Doğrulama

**Çalıştırılanlar** (hepsi yerel)

| Kontrol | Sonuç |
|---|---|
| `npm test` (25 test) | 25 geçti, 0 kaldı |
| Bütün `.js` dosyalarında `node --check` | Hata yok |
| 18 komutun ve bütün modüllerin yüklenmesi (bot başlatılmadan) | Hata yok |
| VGR-01: eski satırın tekrarı | Süreç 1 koduyla kapandı |
| VGR-02: 0,14 / 0,28 / 0,56 MB ölçümü (düzeltmeden önce) | 0,6 / 2,9 / 15,3 saniye |
| VGR-23: hata nesnesinin tamamı ile `hataMetni` karşılaştırması | İlki kullanıcı metnini içeriyor, ikincisi içermiyor |
| `kur.sh`, `vps/erisim-kur.sh` ve güncelleme betiğinde `bash -n` | Sözdizimi hatası yok |
| systemd servis dosyasının örnek değerlerle üretilmesi | Beklenen içerik |
| CI dosyalarının YAML olarak ayrıştırılması | Geçerli |
| NodeSource anahtar ve depo adreslerinin varlığı (yalnızca durum kodu) | 200 |
| `npm audit --omit=dev` (npm kayıt defterine salt okunur sorgu) | 0 açık |
| Depoda ve git geçmişinde sır kalıbı araması (değer yazdırmadan) | Eşleşme yok |

Testlerin kapsadığı kontroller: VGR-01, 02, 03, 04, 05, 06, 07, 08, 10, 11, 12, 13, 14, 15, 17, 21, 23, 24, 25.

**Çalıştırılmayanlar**

| Kontrol | Neden |
|---|---|
| `npm start`, `npm run komutlar` | Discord'a gerçek jetonla bağlanır |
| `kur.sh`, `vps/*.sh` | Canlı sunucuyu değiştirir; bu ortamda systemd yok |
| VGR-16 komut beklemeleri, VGR-18, VGR-22 | Komutların tamamı sahte nesnelerle kurulmadı; kod incelemesine dayanır |
| CI iş akışı | GitHub'da çalışır; henüz push edilmedi |
| Canlı adrese istek, tarama | Kapsam dışı |
| Discord üzerinde uçtan uca deneme | Canlı bot gerektirir; yeni komutlar gerçek bir sunucuda denenmedi |

## 6. Değişen dosyalar

| Dosya | Değişiklik |
|---|---|
| `src/index.js` | VGR-12, VGR-14, VGR-18, VGR-23 |
| `src/yardimci.js` | VGR-03, VGR-10, VGR-12, VGR-14, VGR-15, VGR-17, VGR-23; bekleme sayacı |
| `src/yayin/index.js` | VGR-01, VGR-06, VGR-10 |
| `src/yayin/kick.js`, `src/yayin/twitch.js` | VGR-06, VGR-07 |
| `src/haber.js` | VGR-02, VGR-04, VGR-09, VGR-10, VGR-11, VGR-17 |
| `src/haber-ayristir.js` (yeni) | VGR-02: ayrıştırma kodu `haber.js`'ten buraya taşındı |
| `src/instagram.js` | VGR-09, VGR-10, VGR-17 |
| `src/topluluk.js` | VGR-08, VGR-13 |
| `src/kilit.js` | VGR-05, VGR-18 |
| `src/hatirlatici.js` | VGR-18 |
| `src/firsatlar.js` | VGR-23, VGR-25 |
| `src/site.js` | VGR-21, VGR-24 |
| `src/depo.js` | VGR-26: testler için `VERI_KLASORU` |
| `src/commands/ayarla.js` | VGR-03 |
| `src/commands/kitle.js`, `kilidiac.js`, `sunucukur.js` | VGR-05, VGR-09, VGR-12 |
| `src/commands/yayin.js`, `oyun.js`, `haber.js`, `instagram.js` | VGR-15, VGR-16, VGR-22 |
| `kur.sh`, `vps/erisim-kur.sh` | VGR-19, VGR-20 |
| `test/guvenlik.test.js`, `test/DISCORD_DENEME.md` (yeni), `package.json` | VGR-26 |
| `.github/workflows/test.yml`, `.github/dependabot.yml` (yeni) | VGR-26 |
| `README.md`, `src/site/index.html` | Destek odalarının saklanma süresi, davet bağlantıları (VGR-24), `scp` satırı |

Commit oluşturulmadı; dağıtım yapılmadı.

## 7. Yayına alma notları

Bu değişiklikler canlıya şu sırayla yansır:

1. **Bot kodu** (`src/`): `bash vps/gonder.sh` ile. Öncesinde `test/DISCORD_DENEME.md` listesinin ayrı bir deneme
   sunucusunda uygulanması gerekir; bu denetimde yeni komutların hiçbiri Discord üzerinde çalıştırılmadı.
2. **Güncelleme betiği** (VGR-20): sunucuda `sudo bash erisim-kur.sh <açık-anahtar.pub>` yeniden çalıştırılana
   kadar eskisi kullanılır. Bu adım botu yeniden başlatmaz.
3. **Servis kısıtlamaları** (VGR-19): sunucuda `sudo bash kur.sh` yeniden çalıştırılana kadar yürürlüğe girmez.

Yayından sonra sunucu yöneticilerinin fark edebileceği değişiklikler: kapalı destek odalarının silinmesi (VGR-13),
yönetim yetkili oto rolün verilmemesi (VGR-14), `/oyun simdi` beklemesi (VGR-16), ana düğmenin daha az izin
istemesi (VGR-24).

### Servis kısıtlamalarını mevcut sunucuda denemek

`kur.sh` kısıtlamaları yeni kodla birlikte getirir; ikisini aynı anda canlıya almak, sorun çıkarsa sebebini
bulmayı zorlaştırır. Kısıtlamalar önce tek başına, şu an çalışan kodla denenebilir. systemd'nin "ek dosya"
(drop-in) özelliği kullanılır; geri almak tek komuttur. Her yeniden başlatmada bot birkaç saniye kapalı kalır.

1. Node'un ev klasörlerinin dışında kurulu olduğuna bak. Çıktı `/home`, `/root` ya da `/run/user` ile başlıyorsa
   aşağıdaki listeden `ProtectHome=true` satırını çıkar.

```bash
readlink -f "$(command -v node)"
```

2. Kayıt klasörünün var olduğundan emin ol:

```bash
sudo install -d -m 700 -o voyager -g voyager /opt/voyager/data
```

3. Ek dosyayı aç ve aşağıdaki satırları yapıştırıp kaydet:

```bash
sudo systemctl edit voyager
```

```
[Service]
ProtectSystem=strict
ReadWritePaths=/opt/voyager/data
ProtectHome=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
RestrictNamespaces=true
LockPersonality=true
CapabilityBoundingSet=
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX AF_NETLINK
UMask=0077
```

4. Yeniden başlat ve durumuna bak:

```bash
sudo systemctl restart voyager && sleep 5 && systemctl --no-pager status voyager
```

5. Discord'da veri yazan bir komut çalıştır (ör. `/hatirlat dakika:1`) ve bir yayın ya da fırsat bildiriminin
   gelmesini bekle. Kayıtlarda `EROFS`, `EACCES` ya da `EPERM` olmamalı:

```bash
sudo journalctl -u voyager --since "10 minutes ago" | grep -E "EROFS|EACCES|EPERM|Error" || echo "sorun yok"
```

6. Sorun çıkarsa geri al; bot eski haliyle açılır:

```bash
sudo systemctl revert voyager && sudo systemctl restart voyager
```

Bir iki gün sorunsuz çalıştıysa kısıtlamalar güvenle kalıcı yapılabilir: `kur.sh` aynı satırları asıl servis
dosyasına yazar, ek dosya o zaman `sudo systemctl revert voyager` ile kaldırılır.

### VGR-29 düzeltmesini Linux'ta denemek

Canlı sunucuda değil, ayrı bir Ubuntu makinesinde (systemd açık WSL ya da VM) ve ayrı bir deneme jetonuyla yapılır.
Amaç, kod klasörünün artık bot ve deploy kullanıcılarına kapalı olduğunu ve betiklerin sembolik bağ gördüğünde
durduğunu göstermek.

1. Önce eski düzeni kur: `main` dalındaki `kur.sh` ve `vps/erisim-kur.sh` ile botu ve `voyager-deploy`
   kullanıcısını kur (README, "VPS'te 7/24 çalıştırma"). Sonra bu daldaki dosyaları gönderip sırayla
   `sudo bash kur.sh` ve `sudo bash erisim-kur.sh anahtar.pub` çalıştır. `kur.sh` "Eski kurulum düzeni root'a
   alınıyor" demeli ve bot sonunda açılmalı.

2. Sahiplikler:

```bash
sudo stat -c '%U:%G %a %n' /opt/voyager /opt/voyager/src /opt/voyager/package.json /opt/voyager/node_modules /opt/voyager/.env /opt/voyager/data
sudo find /opt/voyager -path /opt/voyager/data -prune -o ! -user root -print
sudo find /opt/voyager/node_modules -perm /6000 -print
```

   Beklenen: `/opt/voyager`, `src`, `package.json` ve `node_modules` `root:root`; `.env` `root:voyager 640`;
   `data` `voyager:voyager 700`. İkinci ve üçüncü komut hiçbir şey yazmamalı.

3. Bot ve deploy kullanıcıları kod klasörüne yazamıyor (her ikisi de "Permission denied" vermeli):

```bash
sudo -u voyager touch /opt/voyager/deneme
sudo -u voyager-deploy touch /opt/voyager/deneme
```

4. Birimler ve kısıtlamalar:

```bash
systemctl cat voyager-komutlar voyager-bagimliliklar
systemctl show -p ProtectSystem,ReadWritePaths,User voyager voyager-komutlar voyager-bagimliliklar
sudo cat /usr/local/sbin/voyager-guncelle | grep -n "npm run\|sudo -H" || echo "npm run / sudo -u yok"
```

5. Normal güncelleme: bilgisayarından `bash vps/gonder.sh`. Komut yükleyicinin çıktısı ("... komut yüklendi")
   görünmeli, bot yeniden başlamalı. Kilit dosyası değişmeden ikinci kez gönderince bağımlılık kurulumu atlanmalı.
   `package-lock.json` değiştiğinde `voyager-bagimliliklar` çalışmalı ve 2. adımdaki sahiplikler aynı kalmalı.

6. Hedefte sembolik bağ varsa iki betik de durur. Bunu yalnızca deneme makinesinde, root olarak zararsız bir
   hedefle dene:

```bash
sudo cp -a /opt/voyager/package.json /root/package.json.yedek
sudo ln -sfn /tmp/zararsiz-hedef /opt/voyager/package.json
sudo -u voyager-deploy sudo /usr/local/sbin/voyager-guncelle; echo "çıkış: $?"
sudo bash kur.sh; echo "çıkış: $?"
ls -l /tmp/zararsiz-hedef 2>/dev/null || echo "hedef dosya oluşmadı"
sudo rm /opt/voyager/package.json && sudo cp -a /root/package.json.yedek /opt/voyager/package.json
```

   Beklenen: iki betik de "sembolik bağ; ... durduruldu" yazıp 1 ile çıkar, `/tmp/zararsiz-hedef` oluşmaz.

7. Gönderilen klasörde sembolik bağ ya da fazladan dosya varsa güncelleme reddedilir ve sunucudaki kod değişmez:

```bash
sudo -u voyager-deploy sh -c 'echo deneme > ~/hedef.txt && ln -sfn ~/hedef.txt ~/voyager/src/bag.js'
sudo -u voyager-deploy sudo /usr/local/sbin/voyager-guncelle; echo "çıkış: $?"
sudo -u voyager-deploy rm ~voyager-deploy/voyager/src/bag.js
sudo -u voyager-deploy touch ~voyager-deploy/voyager/fazla.txt
sudo -u voyager-deploy sudo /usr/local/sbin/voyager-guncelle; echo "çıkış: $?"
sudo -u voyager-deploy rm ~voyager-deploy/voyager/fazla.txt
```

   Beklenen: ilki "sembolik bağ, beklenmeyen yol veya özel dosya var" yazıp 1 ile çıkar. İkincisi geçer,
   çünkü arşive yalnızca `src`, `package.json` ve `package-lock.json` alınır; `fazla.txt` `/opt/voyager`'a gelmez.

8. Kayıtlara erişim:

```bash
id voyager-deploy
sudo -u voyager-deploy sudo -l
sudo -u voyager-deploy sudo journalctl -u voyager -n 200 --no-pager | tail -3
sudo -u voyager-deploy sudo -n journalctl -u ssh -n 5 --no-pager; echo "çıkış: $?"
```

   Beklenen: `id` çıktısında `systemd-journal` yok; `sudo -l` yalnızca güncelleme betiğini ve iki sabit
   `journalctl` komutunu listeler; üçüncü komut bot kayıtlarını gösterir; dördüncüsü parola ister ya da
   reddedilir (`-n` ile 1 çıkış kodu).

9. Kayıtlarda kısıtlama hatası olmamalı:

```bash
sudo journalctl -u voyager -u voyager-komutlar -u voyager-bagimliliklar --since "30 minutes ago" | grep -E "EROFS|EACCES|EPERM" || echo "sorun yok"
```

Sonuçları VGR-29'un "Doğrulama" satırına ekle.
