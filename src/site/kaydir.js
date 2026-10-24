// Kaydırdıkça beliren öğeler (helyosfer.me'deki gibi). Her .reveal öğesine, ekranın altından girip
// yüksekliğin %60'ı kadar yukarı çıkana dek 0'dan 1'e giden bir --e değeri yazılır; hareketin kendisini
// index.html'deki CSS çizer. Efekt kaydırmaya bağlıdır: geri kaydırınca da tersine döner.
// Betik çalışmazsa ya da ziyaretçi hareket azaltmayı seçtiyse --e 1 kalır ve her şey yerinde görünür.
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ogeler = [...document.querySelectorAll('.reveal')];
  let bekliyor = false;

  function guncelle() {
    bekliyor = false;
    const yukseklik = window.innerHeight;
    for (const oge of ogeler) {
      const ust = oge.getBoundingClientRect().top;
      // Ekranın çok altındakiler henüz hesaplanmaz; --e'leri 0'da bekler
      if (ust > yukseklik * 1.5) continue;
      const e = Math.min(1, Math.max(0, (yukseklik - ust) / (yukseklik * 0.6)));
      oge.style.setProperty('--e', e.toFixed(4));
    }
  }

  // Kaydırma olayı karede birkaç kez gelebilir; hesap kare başına bir kez yapılır
  function sirayaAl() {
    if (bekliyor) return;
    bekliyor = true;
    requestAnimationFrame(guncelle);
  }

  // Ekranın altındaki öğeler ilk hesaptan önce görünmesin
  for (const oge of ogeler) oge.style.setProperty('--e', '0');
  window.addEventListener('scroll', sirayaAl, { passive: true });
  window.addEventListener('resize', sirayaAl);
  guncelle();
})();
