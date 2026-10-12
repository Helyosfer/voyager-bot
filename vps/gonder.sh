#!/usr/bin/env bash
# Çalışma klasöründeki bot kodunu VPS'e gönderir ve botu yeniden başlatır.
# Önce erisim-kur.sh ile VPS'te voyager-deploy kullanıcısı kurulmuş olmalı.
# Hedef adres vps/.hedef dosyasından okunur (ör. voyager-deploy@203.0.113.5);
# bu dosya repoya girmez.
# Kullanım: bash vps/gonder.sh
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [[ ! -f vps/.hedef ]]; then
  echo "vps/.hedef yok. İçine hedefi yaz: voyager-deploy@SUNUCU_ADRESI"
  exit 1
fi
HEDEF="$(tr -d '[:space:]' < vps/.hedef)"
SSH_AYAR=(-o BatchMode=yes -o IdentitiesOnly=yes -i "$HOME/.ssh/voyager_vps")

echo ">> Dosyalar gönderiliyor: $HEDEF"
# Önce eski kopyayı sil: yoksa silinen dosyalar sunucuda kalır
ssh "${SSH_AYAR[@]}" "$HEDEF" 'rm -rf voyager/src'
scp -q "${SSH_AYAR[@]}" -r src package.json package-lock.json "$HEDEF:voyager/"

echo ">> Bot güncelleniyor..."
ssh "${SSH_AYAR[@]}" "$HEDEF" 'sudo /usr/local/sbin/voyager-guncelle'
