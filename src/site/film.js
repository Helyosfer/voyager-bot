// Giriş bölümünün arka planındaki filmi başlatır: NASA'nın Big Bang animasyonu, sessiz.
// Patlama bir kez oynar; film bitince data-dongu saniyesine sarıp oradan sonrasını döndürür.
// Film oynamaya başlayana kadar ilk karesi (poster) görünür.
(() => {
  const film = document.getElementById('film');
  if (!film?.dataset.src) return;

  // ~4 MB'lık bir dosya: istemeyene, veri tasarrufu açık olana ya da yavaş bağlantıya yükleme;
  // onlar yalnızca durağan ilk kareyi görür
  const baglanti = navigator.connection;
  const yavas = /(^|-)2g$|^3g$/.test(baglanti?.effectiveType ?? '');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || baglanti?.saveData || yavas) return;

  const dongu = Number(film.dataset.dongu);
  if (dongu > 0) {
    film.addEventListener('ended', () => {
      film.currentTime = dongu;
      film.play().catch(() => {});
    });
  } else {
    film.loop = true;
  }

  // autoplay ile tarayıcı, film ekran dışındayken kendisi duraklatır ve geri gelince sürdürür
  film.autoplay = true;
  film.src = film.dataset.src;
  film.play().catch(() => {}); // Otomatik oynatma engellenirse ilk kare durağan kalır
})();
