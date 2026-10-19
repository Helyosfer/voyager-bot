// Uyarı sistemi: moderatörlerin üyelere verdiği uyarılar kalıcı olarak tutulur. Uyarı sayısı
// sunucunun belirlediği bir eşiğe gelince otomatik işlem (susturma, atma, yasaklama) uygulanır.
// Kayıt: uyarilar.json → { [sunucuId]: { [kullaniciId]: [{ id, sebep, yetkiliId, zaman }] } }
// Kurallar sunucu ayarlarında: uyariKurallari → [{ esik, islem, dakika }]
const { PermissionFlagsBits } = require('discord.js');
const { oku, yaz, ayarlariGetir, ayarKaydet } = require('./depo');
const { sureMetni } = require('./yardimci');

const KISI_BASI_SINIR = 50; // Bir üyenin en fazla bu kadar uyarısı saklanır; eskiler düşer
const KURAL_SINIRI = 5;
// Kural eşiği kişi başı sınırın altında kalmalı; yoksa sınırdaki üyenin sayısı hep aynı kalır ve
// kural her yeni uyarıda yeniden tetiklenir.
const ESIK_SINIRI = 20;

// Otomatik işlemler ve onları tetikleyebilmek için uyarıyı verenin taşıması gereken yetki.
// Yalnızca susturma yetkisi olan bir moderatör, uyarı vererek bot üzerinden birini atamaz
// ya da yasaklayamaz; o durumda işlem uygulanmaz ve yetkililere bildirilir.
const ISLEMLER = {
  sustur: { ad: 'Susturma', yetki: PermissionFlagsBits.ModerateMembers },
  at: { ad: 'Atma', yetki: PermissionFlagsBits.KickMembers },
  yasakla: { ad: 'Yasaklama', yetki: PermissionFlagsBits.BanMembers },
};

function uyarilar(sunucuId, kullaniciId) {
  return oku('uyarilar', {})[sunucuId]?.[kullaniciId] ?? [];
}

// Kişinin uyarılarını değiştirip kaydeder. degistir(liste) yeni listeyi döndürür.
function guncelle(sunucuId, kullaniciId, degistir) {
  const hepsi = oku('uyarilar', {});
  const sunucu = (hepsi[sunucuId] ??= {});
  const yeni = degistir(sunucu[kullaniciId] ?? []);
  if (yeni.length) sunucu[kullaniciId] = yeni.slice(-KISI_BASI_SINIR);
  else delete sunucu[kullaniciId];
  if (!Object.keys(sunucu).length) delete hepsi[sunucuId];
  yaz('uyarilar', hepsi);
  return yeni.slice(-KISI_BASI_SINIR);
}

const ekle = (sunucuId, kullaniciId, kayit) => guncelle(sunucuId, kullaniciId, (liste) => [...liste, kayit]);

// numara: listede görünen 1'den başlayan sıra. Silinen kaydı döndürür, yoksa null.
function sil(sunucuId, kullaniciId, numara) {
  let silinen = null;
  guncelle(sunucuId, kullaniciId, (liste) => {
    silinen = liste[numara - 1] ?? null;
    return liste.filter((_, i) => i !== numara - 1);
  });
  return silinen;
}

// Silinen uyarı sayısını döndürür
function temizle(sunucuId, kullaniciId) {
  let adet = 0;
  guncelle(sunucuId, kullaniciId, (liste) => {
    adet = liste.length;
    return [];
  });
  return adet;
}

const kurallar = (sunucuId) => ayarlariGetir(sunucuId).uyariKurallari ?? [];

// Aynı eşikte kural varsa yerine geçer. Sınır dolduysa false döndürür.
function kuralEkle(sunucuId, kural) {
  const diger = kurallar(sunucuId).filter((k) => k.esik !== kural.esik);
  if (diger.length >= KURAL_SINIRI) return false;
  ayarKaydet(sunucuId, 'uyariKurallari', [...diger, kural].sort((a, b) => a.esik - b.esik));
  return true;
}

function kuralSil(sunucuId, esik) {
  const onceki = kurallar(sunucuId);
  const kalan = onceki.filter((k) => k.esik !== esik);
  ayarKaydet(sunucuId, 'uyariKurallari', kalan);
  return kalan.length !== onceki.length;
}

// Uyarı sayısı tam olarak eşiğe geldiğinde kural tetiklenir; eşik aşıldıktan sonraki her
// uyarıda aynı işlem yeniden uygulanmaz.
const tetiklenen = (sunucuId, sayi) => kurallar(sunucuId).find((k) => k.esik === sayi) ?? null;

const kuralMetni = (k) => `${k.esik} uyarı → ${ISLEMLER[k.islem].ad.toLocaleLowerCase('tr')}${k.islem === 'sustur' ? ` (${sureMetni(k.dakika)})` : ''}`;

module.exports = { ISLEMLER, KISI_BASI_SINIR, KURAL_SINIRI, ESIK_SINIRI, uyarilar, ekle, sil, temizle, kurallar, kuralEkle, kuralSil, tetiklenen, kuralMetni };
