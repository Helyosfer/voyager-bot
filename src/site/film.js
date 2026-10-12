// Giriş bölümünün arka planındaki filmi başlatır: NASA'nın helyosfer animasyonu,
// sessiz ve döngü halinde. Film oynamaya başlayana kadar zemin siyahtır.
(() => {
  const film = document.getElementById('film');
  if (!film?.dataset.src) return;

  // 32 MB'lık bir dosya: istemeyene, veri tasarrufu açık olana ya da yavaş bağlantıya yükleme
  const baglanti = navigator.connection;
  const yavas = /(^|-)2g$|^3g$/.test(baglanti?.effectiveType ?? '');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || baglanti?.saveData || yavas) return;

  film.addEventListener('playing', () => film.parentElement.classList.add('film-oynuyor'));
  // autoplay ile tarayıcı, film ekran dışındayken kendisi duraklatır ve geri gelince sürdürür
  film.autoplay = true;
  film.src = film.dataset.src;
  film.play().catch(() => {}); // Otomatik oynatma engellenirse zemin siyah kalır
})();
