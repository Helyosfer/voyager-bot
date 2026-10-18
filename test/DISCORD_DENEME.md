# Discord üzerinde deneme listesi

`npm test` güvenlik kurallarını sahte nesnelerle dener; komutların gerçek bir sunucuda çalıştığını göstermez.
Bu liste, yayına almadan önce ayrı bir deneme sunucusunda elle yapılacak denemedir. Canlı botla ve canlı
jetonla yapılmaz.

## Hazırlık

1. Developer Portal'da ayrı bir uygulama oluştur (ör. "Voyager Test"). Bot sekmesinde jeton üret;
   **Server Members Intent**'i aç. Küfür filtresini de deneyeceksen **Message Content Intent**'i aç.
2. Boş bir Discord sunucusu aç. Denemelerin bir kısmı için yetkisiz ikinci bir hesap gerekir.
3. Depoyu ayrı bir klasöre kopyala (canlı `data/` ile karışmasın). O klasörde `.env.example` dosyasını `.env`
   olarak kopyalayıp deneme uygulamasının `DISCORD_TOKEN` ve `CLIENT_ID` değerlerini yaz. Küfür filtresi için
   `MESAJ_ICERIGI=1`.
4. Çalıştır:

```bash
npm install
```

```bash
npm run komutlar
```

```bash
npm start
```

5. Açılışta yazan adresi (`127.0.0.1:8788`) tarayıcıda aç; sayfadaki **tam izinlerle ekle** bağlantısıyla botu
   deneme sunucusuna ekle.

Her satırda beklenen sonuç yazıyor. Farklı bir şey görürsen terminaldeki kaydı not al.

## Temel

- [ ] `/ping` cevap veriyor; `/yardim` komutları listeliyor.
- [ ] `/hatirlat dakika:1` bir dakika sonra seni etiketliyor. Mesaja `@everyone` yazarsan kimse etiketlenmiyor.
- [ ] Altıncı hatırlatıcı reddediliyor.

## Sunucu kurulumu

- [ ] `/sunucukur` önce listeyi gösteriyor; **Vazgeç** hiçbir şey oluşturmuyor.
- [ ] **Kur** ile roller, kategoriler ve kanallar oluşuyor; sonuç mesajı "Kurulum tamamlandı" diyor.
- [ ] Komutu yeniden çalıştırınca "oluşturulacak bir şey yok" diyor (hiçbir şey çift oluşmuyor).
- [ ] Voyager rolünü yeni rollerin üstüne taşıdıktan sonra: ikinci hesap sunucuya girince **Yeni Gelen** rolünü
      alıyor, `üyelik-onay` düğmesiyle **Üye** oluyor, `rol-seçimi` menüsünden ilgi rolü alıp bırakabiliyor.
- [ ] İkinci hesap `/sunucukur` komutunu göremiyor.

## Destek talepleri

- [ ] `destek-merkezi` düğmesi form açıyor; gönderince yalnızca talep sahibinin ve ekibin gördüğü oda oluşuyor.
- [ ] Açık odası varken ikinci talep reddediliyor.
- [ ] **Talebi kapat**: oda `kapalı-` ile başlıyor, sahibi yazamıyor, mesaj 30 gün sonra silineceğini söylüyor.
- [ ] Kapattıktan hemen sonra yeni talep "az önce açtın" diye reddediliyor (10 dakika).
- [ ] Başka bir üyenin odasındaki kapatma düğmesine, ekipten olmayan biri basınca reddediliyor.

## Moderasyon ve günlük

- [ ] `/ayarla log-kanali` sonrası: `/sustur`, `/kick`, `/ban`, `/unban`, `/temizle` çalışıyor ve log kanalına düşüyor.
- [ ] Moderatör hesabı kendinden yüksek roldeki üyeye `/ban` uygulayamıyor.
- [ ] Elle (Discord arayüzünden) yapılan yasaklama da log kanalında görünüyor.

## Uyarılar

- [ ] `/uyari ver` ile verilen uyarı üyeye özel mesajla geliyor ve log kanalına düşüyor; `/uyari liste` numaralarıyla gösteriyor.
- [ ] `/uyari kural-ekle esik:2 islem:Sustur dakika:5` sonrası 2. uyarıda üye 5 dakika susturuluyor, 3. uyarıda yeniden susturulmuyor.
- [ ] Yalnızca **Üyelere Zaman Aşımı Uygula** yetkisi olan ikinci hesap: `/uyari kural-ekle` göremiyor ya da reddediliyor;
      atma kuralının eşiğine geldiğinde verdiği uyarı üyeyi atmıyor, cevapta "uygulanmadı" yazıyor.
- [ ] `/uyari sil` ve `/uyari temizle` uyarıları siliyor ve log kanalına düşüyor.

## Oto rol (yetki denetimi)

- [ ] Yalnızca **Sunucuyu Yönet** yetkisi olan ikinci hesap `/ayarla oto-rol` ile rol ayarlayamıyor
      ("Rolleri Yönet yetkin olmalı").
- [ ] Sunucu sahibi, **Üyeleri At** yetkisi olan bir rolü oto rol yapamıyor ("yönetim yetkisi taşıyor").
- [ ] Yetkisiz bir rol oto rol yapılabiliyor ve yeni gelene veriliyor.
- [ ] Oto rol ayarlıyken o role **Mesajları Yönet** yetkisi ver: yeni gelen rolü almıyor, log kanalına uyarı düşüyor.

## Rol menüsü

- [ ] `/rolmenu` ile iki rollü menü kuruluyor; ikinci hesap düğmeye basınca rolü alıyor, yeniden basınca bırakıyor.
- [ ] `tek-secim: Evet` menüde ikinci rolü seçince ilki bırakılıyor.
- [ ] **Üyeleri At** yetkisi olan bir rol menüye eklenemiyor; menü kurulduktan sonra role bu yetki verilince düğme rolü vermiyor.

## Acil durum kilidi

- [ ] `/kitle`: ikinci hesap hiçbir kanala yazamıyor, sese giremiyor; sunucu sahibi yazabiliyor.
- [ ] Kilitliyken ikinci `/kitle` "zaten kilitli" diyor.
- [ ] Kilitliyken eklenen başka bir bot atılıyor.
- [ ] `/kilidiac`: kanalların izinleri kilitten öncekiyle aynı (özel izinli bir kanalda ayrıca bak).
- [ ] Sunucu Ayarları → Entegrasyonlar → Voyager'dan `/kitle` komutunu Yönetici olmayan bir role aç: o roldeki
      ikinci hesap komutu görüyor ama çalıştırınca "gereken yetkin yok" cevabı alıyor.

## Otomatik koruma

- [ ] `/koruma spam durum:Açık` sonrası ikinci hesap 30 saniyede üç farklı kanala yazınca mesajları siliniyor
      ve susturuluyor.
- [ ] `/koruma kufur durum:Açık` sonrası ağır küfür içeren mesaj siliniyor; mesajı düzenleyerek küfür eklemek de
      yakalanıyor. "sıkıntı", "klasik" gibi masum kelimeler silinmiyor.

## Bildirimler

- [ ] `/oyun kanal`, sonra `/oyun simdi`: fırsatlar geliyor. Hemen ikinci `/oyun simdi` "az önce gönderildi"
      diyor (5 dakika).
- [ ] `/haber kanal`, sonra `/haber ekle adres:<bir haber sitesi>`: kaynak ekleniyor; `/haber liste` gösteriyor.
- [ ] `/haber ekle adres:http://127.0.0.1` ve `adres:localhost:8788` reddediliyor.
- [ ] `/haber rol` ile, senin etiketleyemediğin bir rolü (ikinci hesapla dene) seçmek reddediliyor.
- [ ] Platform anahtarları `.env`'de varsa: `/yayin ekle`, `/yayin test`. Yoksa `/yayin ekle` "bağlantı kurulmamış" diyor.

## Tanıtım sayfası

- [ ] `http://127.0.0.1:8788/` açılıyor; **Sunucuna ekle** düğmesi izin ekranında kanal yönetimi istemiyor,
      **tam izinlerle ekle** bağlantısı istiyor.

## Bittiğinde

- Terminali kapat, deneme klasörünü sil. Deneme uygulamasının jetonunu Developer Portal'dan sıfırla ya da
  uygulamayı sil.
