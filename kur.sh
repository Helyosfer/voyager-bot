#!/usr/bin/env bash
# Voyager botunu bu VPS'e kurar veya günceller.
# Kullanım: sudo bash kur.sh
set -euo pipefail

HEDEF=/opt/voyager
KULLANICI=voyager
KAYNAK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $EUID -ne 0 ]]; then
  echo "Bu betik sudo ile çalıştırılmalı: sudo bash kur.sh"
  exit 1
fi

# Node.js: yoksa kur. Varsa ama eskiyse dokunma; sunucudaki başka bir
# uygulama (ör. web sitesi) o sürüme bağlı olabilir.
if ! command -v node >/dev/null; then
  echo ">> Node.js kuruluyor..."
  apt-get update
  apt-get install -y curl ca-certificates
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
elif (( $(node -p 'process.versions.node.split(".")[0]') < 18 )); then
  echo "Bu sunucuda eski bir Node.js var: $(node --version). Bot için en az 18 gerekli."
  echo "Başka bir uygulaman bu sürümü kullanıyor olabilir, o yüzden otomatik yükseltmedim."
  exit 1
fi
NODE="$(command -v node)"
echo ">> Node.js: $(node --version)"

# Bot kendi yetkisiz kullanıcısıyla çalışır
if ! id "$KULLANICI" &>/dev/null; then
  useradd --system --home-dir "$HEDEF" --shell /usr/sbin/nologin "$KULLANICI"
fi

mkdir -p "$HEDEF"
if [[ "$KAYNAK" != "$HEDEF" ]]; then
  cp -r "$KAYNAK/package.json" "$KAYNAK/.env.example" "$KAYNAK/src" "$HEDEF/"
fi

if [[ ! -f "$HEDEF/.env" ]]; then
  cp "$HEDEF/.env.example" "$HEDEF/.env"
  chown -R "$KULLANICI:$KULLANICI" "$HEDEF"
  chmod 600 "$HEDEF/.env"
  echo
  echo ">> $HEDEF/.env oluşturuldu. Şimdi içini doldur:"
  echo "     sudo nano $HEDEF/.env"
  echo "   Sonra bu betiği tekrar çalıştır:"
  echo "     sudo bash kur.sh"
  exit 0
fi

if grep -Eq '^(DISCORD_TOKEN|CLIENT_ID|GUILD_IDS)=[[:space:]]*$' "$HEDEF/.env"; then
  echo "$HEDEF/.env içinde boş değer var. Doldur: sudo nano $HEDEF/.env"
  exit 1
fi

chown -R "$KULLANICI:$KULLANICI" "$HEDEF"
chmod 600 "$HEDEF/.env"

cd "$HEDEF"
echo ">> Bağımlılıklar kuruluyor..."
sudo -H -u "$KULLANICI" npm install --omit=dev
echo ">> Komutlar Discord'a yükleniyor..."
sudo -H -u "$KULLANICI" npm run komutlar

# systemd servisi: çökerse veya VPS yeniden başlarsa bot kendiliğinden açılır
cat > /etc/systemd/system/voyager.service <<EOF
[Unit]
Description=Voyager Discord botu
After=network-online.target
Wants=network-online.target

[Service]
User=$KULLANICI
WorkingDirectory=$HEDEF
ExecStart=$NODE src/index.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable voyager >/dev/null
systemctl restart voyager
sleep 3
systemctl --no-pager --lines=5 status voyager || true

echo
echo ">> Bitti. Canlı kayıtları izlemek için: sudo journalctl -u voyager -f"
