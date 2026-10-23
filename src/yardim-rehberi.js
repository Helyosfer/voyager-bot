// /yardim'daki komut sayfalarının elle yazılmış metinleri. Alt komutlar ve seçenekler buraya yazılmaz:
// /yardim onları komutun tanımından okur, böylece komut değişince yardım sayfası eskimez.
//
// anlatim: komutun ne işe yaradığı (sayfanın girişi)
// kim: "Kim kullanabilir" satırına eklenecek not (isteğe bağlı; yetki komutun tanımından okunur)
// ornekler: Discord'a yazıldığı haliyle örnek kullanımlar. Testler, örneklerdeki alt komut ve seçenek
//   adlarının gerçekten var olduğunu denetler.
// notlar: bilinmesi gerekenler (sınırlar, gereken bot izinleri, ipuçları)
module.exports = {
  // --- Genel ---
  sor: {
    anlatim:
      "Yapay zekâya (Google Gemini) bir soru sorar; kısa ve Türkçe bir cevap kanala yazılır. Cevabı Discord'da **Yanıtla** ile cevaplarsan konuşma kaldığı yerden sürer: bot önceki soru ve cevapları hatırlar.",
    ornekler: ['/sor soru:Kara delikler nasıl oluşur?', "/sor soru:'İyi akşamlar' İngilizcede nasıl söylenir? gizli:True"],
    notlar: [
      'Cevaplar yanlış olabilir; her cevabın altında bu not ve o gün kalan soru hakkın yazar.',
      '`gizli` seçeneğiyle cevabı yalnızca sen görürsün (gizli cevaplar yanıtlanamaz).',
      'Günlük soru hakkı sunucudaki kullanıma göre kendiliğinden ayarlanır; 2 dakikada en fazla 4 açık soru sorulabilir.',
      "Sorduğun metin Google'a gönderilir; kişisel bilgi yazma. Bot soruları kaydetmez.",
    ],
  },
  yardim: {
    anlatim:
      'Komutları bölüm bölüm gösterir, seviyeni ve sunucu sıralamasını listeler, adım adım kurulum rehberleri sunar. Bir bölüm seçtikten sonra ikinci menüden bir komut seçersen o komutun ayrıntılı sayfası açılır.',
    ornekler: ['/yardim', '/yardim komut:mod'],
    notlar: [
      'Menüden **📈 Seviye ve sıralama** seçerek seviyene, sırana ve ilk 10 üyeye bakabilirsin.',
      '**Sağ tık menüleri:** mesaja sağ tık → *Uygulamalar* → **Hatırlat** ya da **Buradan özetle**; üyeye sağ tık → **Moderasyon**.',
      '`komut` seçeneğine yazmaya başlayınca Discord eşleşen komutları önerir.',
      "Ana sayfanın altında botun Discord'a gecikmesi yazar; bot yavaşsa önce ona bak.",
    ],
  },

  // --- Moderasyon ---
  mod: {
    anlatim:
      'Moderasyon işlemleri. Bir üyeye sağ tıklayıp *Uygulamalar → Moderasyon* seçtiğinde ya da `/mod uye` yazdığında yalnızca sana görünen moderasyon kartı açılır: üyeyi uyarabilir, susturabilir, atabilir, yasaklayabilir ve uyarılarını silebilirsin. Mesaj temizleme, kimlikle yasaklama ve yasak kaldırma ise alt komutlardadır.',
    kim: 'Üyelere Zaman Aşımı Uygula yetkisi olanlar. Karttaki ve alt komutlardaki her işlem ayrıca kendi yetkisini (Mesajları Yönet, Üyeleri At, Üyeleri Yasakla) ve rol sırasını denetler. Otomatik ceza kuralları `/ayarlar` → Uyarı kuralları bölümünden kurulur.',
    ornekler: [
      '/mod uye kullanici:@Ali',
      '/mod temizle adet:20',
      '/mod yasakla kullanici:123456789012345678 sebep:Dolandırıcılık',
      '/mod yasak-kaldir kullanici:123456789012345678 sebep:İtirazı kabul edildi',
    ],
    notlar: [
      '**En hızlı yol:** Discord\'da üyeye sağ tıkla → *Uygulamalar* → **Moderasyon**.',
      'Karttaki **⚠️ Uyar**, **🔇 Sustur**, **👢 At** ve **🔨 Yasakla** düğmeleri sebep (susturmada ayrıca süre) soran küçük bir form açar.',
      'Uyarı sayısı `/ayarlar` → Uyarı kuralları\'ndaki eşiğe gelince otomatik ceza uygulanır (uyarıyı verenin o cezaya yetkisi varsa).',
      'Kendinle aynı ya da daha yüksek roldeki birine işlem yapamazsın; botun rolü de hedefin üstünde olmalı.',
    ],
  },

  // --- Topluluk ---
  cekilis: {
    anlatim:
      'Üyelerin **Katıl** düğmesiyle girdiği çekilişler başlatır. `/cekilis` yazınca ödül, süre, kazanan sayısı, katılma şartı rolü ve kanal seçilen bir form açılır. Süre dolunca bot kazananları rastgele seçip duyurur; erken bitirme, iptal ve yeniden çekme çekiliş mesajının altındaki düğmelerle yapılır.',
    ornekler: ['/cekilis'],
    notlar: [
      'Çekiliş en fazla 14 gün (20160 dakika) sürebilir, en fazla 20 kazanan seçilebilir. Sunucuda aynı anda en fazla 10 çekiliş.',
      'Kazananlar yalnızca hâlâ sunucuda olan katılımcılar arasından seçilir. Katıl düğmesine yeniden basan çekilişten çıkar.',
      'Çekiliş mesajının altındaki **Bitir**, **İptal** ve bittikten sonra çıkan **Yeniden çek** düğmelerini yalnızca **Sunucuyu Yönet** yetkisi olanlar kullanabilir.',
      'Bot yeniden başlasa da süren çekilişler kaldığı yerden devam eder.',
    ],
  },

  // --- Sunucu ayarları ---
  ayarlar: {
    anlatim:
      'Botun bütün sunucu ayarları tek komutta. `/ayarlar` yazınca yalnızca sana görünen bir kart açılır; en üstteki menüden bölüm seçip her şeyi düğmeler, menüler ve küçük formlarla değiştirirsin. Komutun seçeneği yoktur.',
    ornekler: ['/ayarlar'],
    notlar: [
      '**🎮 Oyun fırsatları · 📡 Yayın · 📰 Haber · 📸 Instagram:** kanal ve rol menüleri, **➕ Ekle** formu, listeden çıkarma, deneme bildirimi, bildirimleri kapat.',
      '**🛡️ Koruma:** spam, küfür, görsel ve bağlantı filtrelerini aç/kapat; susturma süreleri, özel kelimeler, izinli ve engelli alanlar.',
      '**📋 Günlük:** olayların yazılacağı kanal, olay türleri ve kanal özetleri. **👋 Karşılama:** hoş geldin kanalı ve oto rol.',
      "**📈 Seviye:** sistemi aç/kapat, duyuru kanalı, ödül rolleri, üyenin XP'sini sıfırla. **⚠️ Uyarı kuralları:** uyarı sayısına göre otomatik ceza.",
      '**🚨 Acil kilit:** saldırı anında bütün kanalları tek düğmeyle kilitler (yalnızca Yönetici). Onay sorulmaz; kilidi açınca her şey eski haline döner.',
      '**🧰 Kurulum:** hazır sunucu şablonu (Yönetici) ve rol menüsü kur (Rolleri Yönet).',
      'Elle yapılan banların da günlükte görünmesi için botta Denetim Kaydını Görüntüle izni olmalı.',
    ],
  },

  // --- Bot sahibi ---
  sunucular: {
    anlatim: 'Botun bulunduğu sunucuları listeler ve botu bir sunucudan çıkarır. Yalnızca bot sahibinin sunucularında görünür.',
    ornekler: ['/sunucular liste', '/sunucular ayril id:123456789012345678'],
    notlar: [],
  },
};

// Alt komut sayfalarına özel anlatım ve notlar: /yardim'da üçüncü menüden alt komut seçilince
// ya da /yardim komut:<komut> <alt> yazılınca gösterilir. Seçenekler komutun tanımından okunur.
const ALTLAR = {
  mod: {
    uye: {
      anlatim:
        'Seçilen üye için moderasyon kartını açar (üyeye sağ tıklayıp *Uygulamalar → Moderasyon* seçmekle aynıdır). Karttan uyarı verebilir, susturabilir, atabilir, yasaklayabilir ve uyarıları silebilirsin.',
    },
    temizle: {
      anlatim: 'Bulunduğun kanaldaki son 1-100 mesajı toplu siler (14 günden eski mesajlar Discord kuralı gereği atlanır). Mesajları Yönet yetkisi gerekir.',
    },
    yasakla: {
      anlatim: 'Bir kullanıcıyı sunucudan yasaklar; sunucuda olmayan birini de kullanıcı kimliğiyle (ID) önceden yasaklayabilirsin. Üyeleri Yasakla yetkisi gerekir.',
    },
    'yasak-kaldir': {
      anlatim: 'Yasaklanmış bir kullanıcının yasağını kaldırır. Üyeleri Yasakla yetkisi gerekir.',
    },
  },
};
for (const [komut, altlar] of Object.entries(ALTLAR)) module.exports[komut].altlar = altlar;
