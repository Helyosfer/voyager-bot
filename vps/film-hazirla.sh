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
# Süreler, patlamanın en parlak anı ~3. saniyede olan 33 sn'lik sürüme göre ayarlandı.
# Kullanım: bash vps/film-hazirla.sh <kaynak-video>   (film.mp4 ve film.jpg bulunduğun klasöre yazılır)
set -euo pipefail

KAYNAK="${1:?Kullanım: bash vps/film-hazirla.sh <kaynak-video>}"

GRAF="[0:v]fps=30,scale=-2:1080,format=yuv420p,split[a][b];"
# Patlamayı yumuşatan siyah katman: 1.6 sn'de belirir, 2.2'de %60'a ulaşır, 4–6 sn arasında kaybolur
GRAF+="color=black:s=1920x1080:r=30:d=40,format=rgba,fade=t=in:st=1.6:d=0.6:alpha=1,"
GRAF+="fade=t=out:st=4.0:d=2.0:alpha=1,colorchannelmixer=aa=0.6[k];"
GRAF+="[a][k]overlay=shortest=1,trim=0.5:8.0,setpts=PTS-STARTPTS[giris];"
# Döngü: kaynağın 8–14 sn'si; son 1.5 sn'si kaynağın 6.5–8 sn'siyle karışarak başa bağlanır
GRAF+="[b]trim=6.5:14,setpts=PTS-STARTPTS,split[c][d];"
GRAF+="[c]trim=1.5:7.5,setpts=PTS-STARTPTS[p1];[d]trim=0:1.5,setpts=PTS-STARTPTS[p2];"
GRAF+="[p1][p2]xfade=transition=fade:duration=1.5:offset=4.5[dongu];"
GRAF+="[giris][dongu]concat=n=2:v=1:a=0,format=yuv420p"

# faststart: tarayıcı dosyanın tamamını beklemeden oynatmaya başlar
nice -n 19 ffmpeg -hide_banner -y -i "$KAYNAK" -an -filter_complex "$GRAF" \
  -c:v libx264 -preset veryslow -crf 28 -force_key_frames 7.5 -movflags +faststart film.mp4
ffmpeg -hide_banner -loglevel error -y -i film.mp4 -frames:v 1 -q:v 4 -update 1 film.jpg
ls -lh film.mp4 film.jpg
