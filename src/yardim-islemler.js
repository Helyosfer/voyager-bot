// /yardim panelindeki işlemlerin adları: bölümün "Ne yapmak istiyorsun?" menüsünde ve komut sayfasının
// altındaki düğmelerde bu adlar görünür. Anahtar "komut" ya da "komut alt" biçimindedir.
//
// tehlikeli: geri alınması zor işlem; düğmesi kırmızı olur. Seçeneği yoksa (doğrudan çalışıyorsa)
//   çalıştırmadan önce bir kez onay sorulur. Seçeneği olanlarda formu doldurup göndermek onay sayılır.
//
// Testler, buradaki her anahtarın gerçek bir komuta ait olduğunu ve panelden çalışabilen her komutun
// burada bir adı olduğunu denetler.
module.exports = {
  // --- Genel ---
  sor: { simge: '💬', ad: 'Yapay zekâya soru sor' },
  ozetle: { simge: '📝', ad: 'Kanalı özetle' },
  hatirlat: { simge: '⏰', ad: 'Hatırlatıcı kur' },

  // --- Moderasyon ---
  'uyari ver': { simge: '⚠️', ad: 'Uyarı ver' },
  'uyari liste': { simge: '📋', ad: 'Uyarılarına bak' },
  'uyari sil': { simge: '🗑️', ad: 'Uyarı sil' },
  'uyari kural': { simge: '⚙️', ad: 'Otomatik uyarı kuralları' },
  sustur: { simge: '🔇', ad: 'Sustur / susturmayı kaldır' },
  kick: { simge: '👢', ad: 'Sunucudan at', tehlikeli: true },
  ban: { simge: '🔨', ad: 'Yasakla', tehlikeli: true },
  unban: { simge: '🕊️', ad: 'Yasağı kaldır' },
  temizle: { simge: '🧹', ad: 'Mesajları toplu sil', tehlikeli: true },

  // --- Güvenlik ---
  'koruma filtre': { simge: '🛡️', ad: 'Filtreyi aç / kapat' },
  'koruma kelime': { simge: '🤬', ad: 'Yasaklı kelime ekle / çıkar' },
  'koruma alan': { simge: '🔗', ad: 'Bağlantı alanı engelle / izin ver' },
  'koruma goster': { simge: '📋', ad: 'Koruma ayarlarını gör' },
  'kilit kapat': { simge: '🔒', ad: 'Kilitle', tehlikeli: true },
  'kilit ac': { simge: '🔓', ad: 'Kilidi aç' },

  // --- Bildirimler ---
  'oyun ayar': { simge: '🎮', ad: 'Oyun fırsatı ayarları' },
  'oyun simdi': { simge: '🎁', ad: 'Fırsatları şimdi gönder' },
  'yayin ayar': { simge: '📺', ad: 'Yayın bildirimi ayarları' },
  'yayin ekle': { simge: '➕', ad: 'Yayıncı ekle' },
  'yayin cikar': { simge: '➖', ad: 'Yayıncı çıkar' },
  'haber ayar': { simge: '📰', ad: 'Haber bildirimi ayarları' },
  'haber ekle': { simge: '➕', ad: 'Haber kaynağı ekle' },
  'haber cikar': { simge: '➖', ad: 'Haber kaynağı çıkar' },
  'instagram ayar': { simge: '📸', ad: 'Instagram bildirimi ayarları' },
  'instagram ekle': { simge: '➕', ad: 'Instagram hesabı ekle' },
  'instagram cikar': { simge: '➖', ad: 'Instagram hesabı çıkar' },

  // --- Topluluk ---
  'seviye goster': { simge: '📊', ad: 'Seviyeye bak' },
  'seviye siralama': { simge: '🏆', ad: 'Seviye sıralaması' },
  'seviye ayar': { simge: '⚙️', ad: 'Seviye sistemi ayarları' },
  'seviye odul': { simge: '🎁', ad: 'Seviye ödül rolü' },
  'seviye sifirla': { simge: '♻️', ad: 'Seviyeyi sıfırla', tehlikeli: true },
  'cekilis baslat': { simge: '🎉', ad: 'Çekiliş başlat' },
  'cekilis bitir': { simge: '🏁', ad: 'Çekilişi hemen bitir' },
  'cekilis yeniden': { simge: '🔁', ad: 'Kazananı yeniden çek' },
  'cekilis iptal': { simge: '✖️', ad: 'Çekilişi iptal et', tehlikeli: true },
  rolmenu: { simge: '🎭', ad: 'Rol menüsü kur' },

  // --- Sunucu ayarları ---
  'ayarla gunluk': { simge: '📜', ad: 'Günlük (log) kanalı' },
  'ayarla hosgeldin': { simge: '👋', ad: 'Hoş geldin mesajı ve oto rol' },
  'ayarla ozet': { simge: '📝', ad: 'Kanal özetini aç / kapat' },
  'ayarla goster': { simge: '📋', ad: 'Sunucu ayarlarını gör' },
  'ayarla sifirla': { simge: '♻️', ad: 'Bir ayarı sıfırla', tehlikeli: true },
  sunucukur: { simge: '🏗️', ad: 'Hazır sunucu kurulumu' },
  sunucusil: { simge: '🧹', ad: 'Kurulumu sil', tehlikeli: true },
};
