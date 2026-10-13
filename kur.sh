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
  apt-get install -y curl ca-certificates gnupg
  # NodeSource deposu elle eklenir: internetten indirilen bir betik root olarak çalıştırılmaz,
  # paketler deponun imza anahtarıyla doğrulanır.
  install -d -m 755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  apt-get update
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
  if [[ ! -d "$KAYNAK/src" || ! -f "$KAYNAK/package.json" ]]; then
    echo "$KAYNAK içinde src/ veya package.json yok. Dosyaların hepsi gönderildi mi?"
    exit 1
  fi
  # Eski src'yi sil: yoksa kaynakta silinen komut dosyaları sunucuda kalır ve yüklenmeye devam eder
  rm -rf "$HEDEF/src"
  cp -r "$KAYNAK/package.json" "$KAYNAK/.env.example" "$KAYNAK/src" "$HEDEF/"
  if [[ -f "$KAYNAK/package-lock.json" ]]; then
    cp "$KAYNAK/package-lock.json" "$HEDEF/"
  fi
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

if grep -Eq '^(DISCORD_TOKEN|CLIENT_ID)=[[:space:]]*$' "$HEDEF/.env"; then
  echo "$HEDEF/.env içinde boş değer var. Doldur: sudo nano $HEDEF/.env"
  exit 1
fi

chown -R "$KULLANICI:$KULLANICI" "$HEDEF"
chmod 600 "$HEDEF/.env"
# Kayıt klasörü servis başlamadan önce var olmalı: servis dosya sistemini salt okunur görür,
# yalnızca burası yazılabilir (aşağıdaki ReadWritePaths)
install -d -m 700 -o "$KULLANICI" -g "$KULLANICI" "$HEDEF/data"

cd "$HEDEF"
echo ">> Bağımlılıklar kuruluyor..."
# Kilit dosyası varsa tam olarak oradaki sürümler kurulur. Paketlerin kurulum betikleri çalıştırılmaz.
if [[ -f package-lock.json ]]; then
  sudo -H -u "$KULLANICI" npm ci --omit=dev --ignore-scripts
else
  sudo -H -u "$KULLANICI" npm install --omit=dev --ignore-scripts
fi
echo ">> Komutlar Discord'a yükleniyor..."
sudo -H -u "$KULLANICI" npm run komutlar

# Node ev klasörlerinin altındaysa (ör. nvm ile kurulmuşsa) ProtectHome servisin Node'u görmesini engeller
EV_KORUMASI="ProtectHome=true"
case "$(readlink -f "$NODE")" in
  /home/* | /root/* | /run/user/*) EV_KORUMASI="" ;;
esac

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
# Bot ele geçirilse bile yapabilecekleri sınırlı kalsın: dosya sistemi salt okunurdur (kendi kodunu
# da değiştiremez), yalnızca kayıt klasörüne yazabilir; ev klasörlerini ve aygıtları göremez.
ProtectSystem=strict
ReadWritePaths=$HEDEF/data
$EV_KORUMASI
PrivateDevices=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
RestrictNamespaces=true
LockPersonality=true
CapabilityBoundingSet=
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX AF_NETLINK
UMask=0077

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable voyager >/dev/null
systemctl restart voyager
sleep 3
systemctl --no-pager --lines=5 status voyager || true

if ! systemctl is-active --quiet voyager; then
  echo
  echo ">> Bot başlamadı. Kayıtlara bak: sudo journalctl -u voyager -n 50"
  echo "   Sorun servis kısıtlamalarındaysa /etc/systemd/system/voyager.service içinde"
  echo "   ProtectSystem satırından UMask satırına kadar olan bölümü sil, sonra şunu çalıştır:"
  echo "     sudo systemctl daemon-reload && sudo systemctl restart voyager"
  exit 1
fi

echo
echo ">> Bitti. Canlı kayıtları izlemek için: sudo journalctl -u voyager -f"
