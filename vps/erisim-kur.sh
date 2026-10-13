#!/usr/bin/env bash
# Botu uzaktan güncellemek için VPS'te kısıtlı bir kullanıcı kurar.
# Bu kullanıcı yalnızca SSH anahtarıyla girer ve root olarak tek bir şey
# çalıştırabilir: /usr/local/sbin/voyager-guncelle
# Kullanım: sudo bash erisim-kur.sh <açık-anahtar-dosyası.pub>
set -euo pipefail

KULLANICI=voyager-deploy
ANAHTAR="${1:-}"

if [[ $EUID -ne 0 ]]; then
  echo "Bu betik sudo ile çalıştırılmalı."
  exit 1
fi
if [[ ! -d /opt/voyager || ! -f /opt/voyager/.env ]]; then
  echo "/opt/voyager kurulu değil. Önce kur.sh ile botu kur."
  exit 1
fi
if [[ ! -f "$ANAHTAR" ]]; then
  echo "Kullanım: sudo bash erisim-kur.sh <açık-anahtar-dosyası.pub>"
  exit 1
fi
if grep -q 'PRIVATE KEY' "$ANAHTAR"; then
  echo "Bu ÖZEL anahtar. Sunucuya .pub uzantılı AÇIK anahtar gönderilmeli; özel anahtarı sunucudan sil."
  exit 1
fi
if ! ssh-keygen -l -f "$ANAHTAR" >/dev/null 2>&1; then
  echo "$ANAHTAR geçerli bir SSH açık anahtarı değil."
  exit 1
fi

if ! id "$KULLANICI" &>/dev/null; then
  adduser --disabled-password --gecos "" "$KULLANICI"
fi
# Bot kayıtlarını sudo'suz okuyabilsin
usermod -aG systemd-journal "$KULLANICI"

EV="$(getent passwd "$KULLANICI" | cut -d: -f6)"
install -d -m 700 -o "$KULLANICI" -g "$KULLANICI" "$EV/.ssh"
install -m 600 -o "$KULLANICI" -g "$KULLANICI" "$ANAHTAR" "$EV/.ssh/authorized_keys"
install -d -o "$KULLANICI" -g "$KULLANICI" "$EV/voyager"

# Güncelleme betiği root'a aittir; deploy kullanıcısı içeriğini değiştiremez.
cat > /usr/local/sbin/voyager-guncelle <<'EOF'
#!/usr/bin/env bash
# voyager-deploy kullanıcısının gönderdiği kodu /opt/voyager'a alır ve botu yeniden başlatır.
set -euo pipefail

KAYNAK=/home/voyager-deploy/voyager
HEDEF=/opt/voyager

if [[ ! -d "$KAYNAK/src" || ! -f "$KAYNAK/package.json" ]]; then
  echo "$KAYNAK içinde src/ veya package.json yok."
  exit 1
fi

# Önce root'a ait geçici klasöre al ve orada denetle; kaynak klasör
# deploy kullanıcısının elinde olduğu için doğrudan güvenilmez.
GECICI="$(mktemp -d)"
trap 'rm -rf "$GECICI"' EXIT
cp -rP "$KAYNAK/src" "$KAYNAK/package.json" "$GECICI/"
if [[ -e "$KAYNAK/package-lock.json" ]]; then
  cp -P "$KAYNAK/package-lock.json" "$GECICI/"
fi
if [[ -n "$(find "$GECICI" -mindepth 1 ! -type f ! -type d -print -quit)" ]]; then
  echo "Gönderilen dosyalar arasında sembolik bağ veya özel dosya var, reddedildi."
  exit 1
fi

rm -rf "$HEDEF/src"
cp -rP "$GECICI/." "$HEDEF/"
chown -hR voyager:voyager "$HEDEF/src" "$HEDEF/package.json"
if [[ -e "$HEDEF/package-lock.json" ]]; then
  chown -h voyager:voyager "$HEDEF/package-lock.json"
fi

cd "$HEDEF"
# Bağımlılıklar yalnızca kilit dosyası değiştiyse yeniden kurulur. "npm ci" tam olarak kilit
# dosyasındaki sürümleri kurar, ama önce node_modules klasörünü siler; bu yüzden her güncellemede
# değil, yalnızca gerektiğinde çalışır. Paketlerin kurulum betikleri çalıştırılmaz.
OZET_DOSYASI=node_modules/.kilit-ozeti
if [[ -f package-lock.json ]]; then
  OZET="$(sha256sum package-lock.json | cut -d' ' -f1)"
  if [[ ! -f "$OZET_DOSYASI" || "$(cat "$OZET_DOSYASI")" != "$OZET" ]]; then
    sudo -H -u voyager npm ci --omit=dev --ignore-scripts
    # Özet bot kullanıcısıyla yazılır: klasör ona ait, root burada dosya oluşturmaz
    echo "$OZET" | sudo -H -u voyager tee "$OZET_DOSYASI" >/dev/null
  fi
else
  sudo -H -u voyager npm install --omit=dev --ignore-scripts
fi
sudo -H -u voyager npm run komutlar
systemctl restart voyager
sleep 3
systemctl --no-pager --lines=10 status voyager
EOF
chown root:root /usr/local/sbin/voyager-guncelle
chmod 755 /usr/local/sbin/voyager-guncelle

# sudo izni: yalnızca bu betik, argümansız
SUDOERS="$(mktemp)"
echo "$KULLANICI ALL=(root) NOPASSWD: /usr/local/sbin/voyager-guncelle \"\"" > "$SUDOERS"
if ! visudo -cf "$SUDOERS" >/dev/null; then
  rm -f "$SUDOERS"
  echo "sudoers satırı doğrulanamadı, sudo izni eklenmedi."
  exit 1
fi
install -m 440 -o root -g root "$SUDOERS" /etc/sudoers.d/voyager-deploy
rm -f "$SUDOERS"

echo
echo ">> Hazır. '$KULLANICI' kullanıcısı anahtarla girebilir."
echo "   Gönderilen açık anahtar dosyasını artık silebilirsin: rm $ANAHTAR"
