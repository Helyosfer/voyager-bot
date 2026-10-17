#!/usr/bin/env bash
# Sitenin arka plan filmini (film.mp4) ve ilk karesini (film.jpg) NASA'nın Big Bang animasyonundan hazırlar:
# https://svs.gsfc.nasa.gov/12656 (NASA's Goddard Space Flight Center/CI Lab)
#
# Film iki parçadır:
#   0–7.5 sn  giriş: patlama bir kez oynar. En parlak anı (kaynakta 1.6–6 sn) %60'a kadar karartılır;
#             yoksa ekran bembeyaz olur ve sayfadaki yazılar okunmaz.
#   7.5–13.5  döngü: galaksilerin uçuştuğu 6 sn. Sonu başına 1.5 sn'lik yumuşak geçişle bağlanır.
# Sayfa filmi sonuna gelince 7.5. saniyeye sarar (index.html'deki data-dongu, film.js). O saniyede bir
# anahtar kare vardır, sarma takılmadan olur. Süreleri değiştirirsen data-dongu'yu da güncelle.
#
# Kaynak verilmezse NASA'nın 4K dosyası (12656_Big_Bang_4k.m4v, 93.5 MB) vps/film/kaynak-4k.m4v olarak
# indirilir (repoya girmez) ve sha256'sı denetlenir. Film 4K'dan küçültülür; YouTube kopyası gibi
# önceden sıkıştırılmış bir kaynaktan üretmek küçük yıldızları siler.
# Kullanım: bash vps/film-hazirla.sh [kaynak-video]   (film.mp4 ve film.jpg bulunduğun klasöre yazılır)
# Çözünürlük: YUKSEKLIK=720 bash vps/film-hazirla.sh   (varsayılan 1080)
set -euo pipefail

KLASOR="$(dirname "${BASH_SOURCE[0]}")/film"
NASA_4K='https://svs.gsfc.nasa.gov/vis/a010000/a012600/a012656/12656_Big_Bang_4k.m4v'
NASA_4K_SHA256='454d6fbfef7cebb395062c769efa1138e7ce0196d582bdfe412e986855d8d95e'

if [[ $# -ge 1 ]]; then
  KAYNAK="$1"
else
  KAYNAK="$KLASOR/kaynak-4k.m4v"
  if [[ ! -f "$KAYNAK" ]]; then
    echo ">> NASA'nın 4K dosyası indiriliyor (93.5 MB)..."
    curl -fL --retry 3 -o "$KAYNAK.yarim" "$NASA_4K"
    mv "$KAYNAK.yarim" "$KAYNAK"
  fi
  echo "$NASA_4K_SHA256  $KAYNAK" | sha256sum -c --quiet
fi

Y="${YUKSEKLIK:-1080}"
G=$(( Y * 16 / 9 / 2 * 2 ))

GRAF="[0:v]fps=30,scale=${G}:${Y}:flags=lanczos,format=yuv420p,split[a][b];"
# Patlamayı yumuşatan siyah katman: 1.6 sn'de belirir, 2.2'de %60'a ulaşır, 4–6 sn arasında kaybolur
GRAF+="color=black:s=${G}x${Y}:r=30:d=40,format=rgba,fade=t=in:st=1.6:d=0.6:alpha=1,"
GRAF+="fade=t=out:st=4.0:d=2.0:alpha=1,colorchannelmixer=aa=0.6[k];"
GRAF+="[a][k]overlay=shortest=1,trim=0.5:8.0,setpts=PTS-STARTPTS[giris];"
# Döngü: kaynağın 8–14 sn'si; son 1.5 sn'si kaynağın 6.5–8 sn'siyle karışarak başa bağlanır
GRAF+="[b]trim=6.5:14,setpts=PTS-STARTPTS,split[c][d];"
GRAF+="[c]trim=1.5:7.5,setpts=PTS-STARTPTS[p1];[d]trim=0:1.5,setpts=PTS-STARTPTS[p2];"
GRAF+="[p1][p2]xfade=transition=fade:duration=1.5:offset=4.5[dongu];"
GRAF+="[giris][dongu]concat=n=2:v=1:a=0,"
# Karartma filme gömülü: CSS'teki filter: brightness(0.82) contrast(1.05) ile aynı sonuç
# (x · 0.861 − 0.025). Tam ekran videoda CSS filtresi her karede ekran kartına ek iş çıkarıyordu.
GRAF+="lutyuv=y='clip(16+0.861*(val-16)-5.475,16,235)':u='128+0.861*(val-128)':v='128+0.861*(val-128)',"
GRAF+="format=yuv420p"

# Çözmesi kolay ayarlar: level 4.0, en fazla 3 referans ve 3 B karesi. "veryslow" 1080p'de 16 referansla
# level 5.1 üretir; bunu birçok ekran kartı donanımda çözemez, tarayıcı işlemciye düşer ve film takılır.
# Kalite: crf 19 (~8 MB). crf 28 (~2.5 Mbps) küçük yıldızları siliyor, galaksileri bulanıklaştırıyordu.
# tune film ve aq-mode 3 koyu zemindeki ince ayrıntıyı korur; vbv anlık bit hızını 8 Mbps'ta tutar:
# faststart: dosyanın başındaki bilgiyle tarayıcı oynatmaya hemen hazırlanır
nice -n 19 ffmpeg -hide_banner -y -i "$KAYNAK" -an -filter_complex "$GRAF" \
  -c:v libx264 -preset slow -tune film -profile:v high -level:v 4.0 \
  -x264-params ref=3:bframes=3:aq-mode=3:vbv-maxrate=8000:vbv-bufsize=8000 -crf 19 \
  -force_key_frames 7.5 -movflags +faststart film.mp4
ffmpeg -hide_banner -loglevel error -y -i film.mp4 -frames:v 1 -q:v 3 -update 1 film.jpg
ls -lh film.mp4 film.jpg
