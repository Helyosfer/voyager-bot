// Giriş bölümünün arka planındaki filmi başlatır: NASA'nın Big Bang animasyonu, sessiz.
// Patlama bir kez oynar; film bitince data-dongu saniyesine sarıp oradan sonrasını döndürür.
// Film inip oynamaya başlayana kadar ilk karesi (poster) görünür.
(() => {
  const film = document.getElementById('film');
  if (!film?.dataset.src) return;

  // ~10 MB'lık bir dosya: istemeyene, veri tasarrufu açık olana ya da yavaş bağlantıya yükleme;
  // onlar yalnızca durağan ilk kareyi görür
  const baglanti = navigator.connection;
  const yavas = /(^|-)2g$|^3g$/.test(baglanti?.effectiveType ?? '');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || baglanti?.saveData || yavas) return;

  const dongu = Number(film.dataset.dongu);
  if (dongu > 0) {
    // Film bitip durduktan sonra yeniden başlatmak her turda kısa bir donma yaratır. Destekleyen
    // tarayıcıda son kare ekrana gelince, film durmadan sarılır.
    if ('requestVideoFrameCallback' in film) {
      const izle = (_simdi, kare) => {
        if (film.duration && kare.mediaTime >= film.duration - 0.1) film.currentTime = dongu;
        film.requestVideoFrameCallback(izle);
      };
      film.requestVideoFrameCallback(izle);
    }
    // Yedek: desteklemeyen tarayıcıda ya da son kare atlanırsa
    film.addEventListener('ended', () => {
      film.currentTime = dongu;
      film.play().catch(() => {});
    });
  } else {
    film.loop = true;
  }

  // Videonun ilk ~0.65 saniyesi neredeyse tamamen hareketsiz karanlıktır; doğrudan patlamanın
  // genişlemeye başladığı andan başlat. Film +faststart ile üretildiği için tamamının inmesini
  // beklemeden ilk tamponla hemen oynar.
  const baslangic = Number(film.dataset.baslangic) || 0;
  film.preload = 'auto';
  film.autoplay = true;
  film.src = film.dataset.src;
  if (baslangic > 0) {
    film.addEventListener(
      'loadedmetadata',
      () => {
        if (film.currentTime < baslangic) film.currentTime = baslangic;
      },
      { once: true },
    );
  }
  film.play().catch(() => {}); // Otomatik oynatma engellenirse ilk kare durağan kalır
})();
